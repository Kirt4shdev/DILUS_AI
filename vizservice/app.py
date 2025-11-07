"""
DILUS AI - Codex Synapse Visualization Service
Microservicio para reducción dimensional de embeddings
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import psycopg2
import os
from dotenv import load_dotenv

try:
    from umap import UMAP
    HAS_UMAP = True
except ImportError:
    HAS_UMAP = False

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuración de base de datos
DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'postgres'),
    'port': int(os.getenv('POSTGRES_PORT', 5432)),
    'database': os.getenv('POSTGRES_DB', 'dilus_ai'),
    'user': os.getenv('POSTGRES_USER', 'postgres'),
    'password': os.getenv('POSTGRES_PASSWORD', 'postgres')
}

def get_db_connection():
    """Crear conexión a PostgreSQL con soporte UTF-8"""
    conn = psycopg2.connect(**DB_CONFIG)
    conn.set_client_encoding('UTF8')
    return conn

def fetch_embeddings_from_db(filters=None):
    """
    Obtener embeddings desde PostgreSQL
    
    Args:
        filters: dict con filtros opcionales (document_id, project_id, etc.)
    
    Returns:
        list of dicts con id, embedding, metadata
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Query base
    query = """
        SELECT 
            e.id,
            e.document_id,
            e.chunk_text,
            e.chunk_index,
            e.embedding,
            e.metadata,
            d.filename,
            d.project_id,
            d.is_vault_document
        FROM embeddings e
        JOIN documents d ON e.document_id = d.id
        WHERE e.embedding IS NOT NULL
    """
    
    params = []
    
    # Aplicar filtros
    if filters:
        if filters.get('document_id'):
            query += " AND e.document_id = %s"
            params.append(filters['document_id'])
        
        if filters.get('project_id'):
            query += " AND d.project_id = %s"
            params.append(filters['project_id'])
        
        if filters.get('is_vault_only'):
            query += " AND d.is_vault_document = TRUE"
    
    query += " ORDER BY e.id LIMIT 5000"  # Límite de seguridad
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    results = []
    for row in rows:
        # Convertir embedding de string a lista
        embedding_str = row[4]
        if embedding_str:
            # Formato: "[0.1, 0.2, ...]"
            embedding = eval(embedding_str) if isinstance(embedding_str, str) else embedding_str
            
            results.append({
                'id': row[0],
                'document_id': row[1],
                'chunk_text': row[2][:200],  # Preview
                'chunk_index': row[3],
                'embedding': embedding,
                'metadata': row[5] or {},
                'document_name': row[6],
                'project_id': row[7],
                'is_vault_document': row[8]
            })
    
    cursor.close()
    conn.close()
    
    return results

def reduce_to_3d(chunks, method='umap', n_clusters=8):
    """
    Reduce embeddings de alta dimensión a 3D
    
    Args:
        chunks: lista de dicts con 'embedding'
        method: 'umap' o 'pca'
        n_clusters: número de clusters
    
    Returns:
        dict con resultados
    """
    
    # Extraer embeddings
    embeddings = np.array([chunk['embedding'] for chunk in chunks])
    n_samples = len(embeddings)
    
    if n_samples == 0:
        return {
            'chunks': [],
            'clusters': [],
            'metadata': {
                'method': method,
                'n_samples': 0,
                'error': 'No embeddings found'
            }
        }
    
    # Normalizar
    scaler = StandardScaler()
    embeddings_scaled = scaler.fit_transform(embeddings)
    
    # Reducir dimensionalidad
    if method == 'umap' and HAS_UMAP and n_samples >= 10:
        reducer = UMAP(
            n_components=3,
            n_neighbors=min(15, n_samples - 1),
            min_dist=0.1,
            metric='cosine',
            random_state=42,
            n_jobs=1
        )
        embeddings_3d = reducer.fit_transform(embeddings_scaled)
        variance_explained = None
        method_used = 'umap'
    else:
        reducer = PCA(n_components=min(3, n_samples), random_state=42)
        embeddings_3d = reducer.fit_transform(embeddings_scaled)
        variance_explained = sum(reducer.explained_variance_ratio_)
        method_used = 'pca'
    
    # Normalizar coordenadas al rango [-1, 1]
    for i in range(embeddings_3d.shape[1]):
        col_min = embeddings_3d[:, i].min()
        col_max = embeddings_3d[:, i].max()
        if col_max > col_min:
            embeddings_3d[:, i] = 2 * (embeddings_3d[:, i] - col_min) / (col_max - col_min) - 1
    
    # Clustering
    if n_samples >= n_clusters:
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(embeddings_scaled)
        
        # Calcular centros
        cluster_info = []
        for cluster_id in range(n_clusters):
            mask = cluster_labels == cluster_id
            cluster_points = embeddings_3d[mask]
            
            if len(cluster_points) > 0:
                center = cluster_points.mean(axis=0)
                cluster_info.append({
                    'id': int(cluster_id),
                    'x': float(center[0]),
                    'y': float(center[1]),
                    'z': float(center[2]) if embeddings_3d.shape[1] > 2 else 0.0,
                    'size': int(mask.sum()),
                    'color': get_cluster_color(cluster_id),
                    'theme': None  # Se llenará después
                })
    else:
        cluster_labels = np.zeros(n_samples)
        cluster_info = []
    
    # Extraer temas de los clusters
    cluster_themes = extract_cluster_themes(chunks, cluster_labels)
    
    # Actualizar cluster_info con temas
    for cluster in cluster_info:
        cluster['theme'] = cluster_themes.get(cluster['id'], f"Tema {cluster['id'] + 1}")
    
    # Preparar resultado
    result_chunks = []
    for i, chunk in enumerate(chunks):
        coords = {
            'x': float(embeddings_3d[i, 0]),
            'y': float(embeddings_3d[i, 1]),
            'z': float(embeddings_3d[i, 2]) if embeddings_3d.shape[1] > 2 else 0.0
        }
        
        result_chunks.append({
            'id': chunk['id'],
            'document_id': chunk['document_id'],
            'document_name': chunk['document_name'],
            'chunk_text': chunk['chunk_text'],
            'chunk_index': chunk['chunk_index'],
            'project_id': chunk['project_id'],
            'is_vault_document': chunk['is_vault_document'],
            'coordinates': coords,
            'cluster': int(cluster_labels[i]),
            'color': get_cluster_color(int(cluster_labels[i]))
        })
    
    return {
        'chunks': result_chunks,
        'clusters': cluster_info,
        'metadata': {
            'method': method_used,
            'n_samples': n_samples,
            'n_clusters': len(cluster_info),
            'variance_explained': float(variance_explained) if variance_explained else None,
            'has_umap': HAS_UMAP
        }
    }

def get_cluster_color(cluster_id):
    """Obtener color hexadecimal para un cluster"""
    colors = [
        '#3B82F6',  # blue
        '#10B981',  # green
        '#F59E0B',  # amber
        '#EF4444',  # red
        '#8B5CF6',  # purple
        '#EC4899',  # pink
        '#14B8A6',  # teal
        '#F97316',  # orange
        '#6366F1',  # indigo
        '#84CC16',  # lime
    ]
    return colors[cluster_id % len(colors)]

def extract_cluster_themes(chunks, cluster_labels):
    """
    Extraer temas representativos de cada cluster basándose en palabras frecuentes
    """
    from collections import Counter
    import re
    
    # Palabras a ignorar (stopwords en español)
    stopwords = {
        'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'haber',
        'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo', 'todo',
        'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese',
        'si', 'me', 'ya', 'ver', 'porque', 'dar', 'cuando', 'él', 'muy', 'sin',
        'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo', 'yo',
        'también', 'hasta', 'año', 'dos', 'querer', 'entre', 'así', 'primero',
        'desde', 'grande', 'eso', 'ni', 'nos', 'llegar', 'pasar', 'tiempo', 'ella',
        'sí', 'día', 'uno', 'bien', 'poco', 'deber', 'entonces', 'poner', 'cosa',
        'tanto', 'hombre', 'parecer', 'nuestro', 'tan', 'donde', 'ahora', 'parte',
        'después', 'vida', 'quedar', 'siempre', 'creer', 'hablar', 'llevar', 'dejar',
        'nada', 'cada', 'seguir', 'menos', 'nuevo', 'encontrar', 'algo', 'solo',
        'decir', 'sentir', 'tomar', 'mano', 'venir', 'ver', 'pensar', 'salir',
        'volver', 'mayor', 'guerra', 'proceso', 'estado', 'mejor', 'forma', 'caso',
        'misma', 'ante', 'ellos', 'tus', 'son', 'fue', 'cual', 'quien', 'otros',
        'sus', 'las', 'los', 'una', 'del', 'este', 'estos', 'estas', 'esta',
        'son', 'del', 'al', 'es', 'ha', 'he', 'has', 'han', 'era', 'eras',
        'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
        'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
        'might', 'must', 'can', 'shall', 'and', 'or', 'but', 'if', 'then'
    }
    
    n_clusters = len(set(cluster_labels))
    themes = {}
    
    for cluster_id in range(n_clusters):
        # Obtener todos los chunks de este cluster
        cluster_chunks = [chunks[i] for i, label in enumerate(cluster_labels) if label == cluster_id]
        
        if not cluster_chunks:
            themes[cluster_id] = "Sin datos"
            continue
        
        # Combinar todo el texto del cluster
        all_text = ' '.join([chunk['chunk_text'] for chunk in cluster_chunks])
        
        # Extraer palabras (solo letras, mínimo 3 caracteres)
        words = re.findall(r'\b[a-záéíóúñA-ZÁÉÍÓÚÑ]{3,}\b', all_text.lower())
        
        # Filtrar stopwords
        words = [w for w in words if w not in stopwords]
        
        # Contar frecuencias
        word_counts = Counter(words)
        
        # Obtener top 3 palabras más frecuentes
        top_words = word_counts.most_common(5)
        
        if top_words:
            # Generar tema basado en las palabras más frecuentes
            theme_words = [word for word, count in top_words[:3]]
            
            # Capitalizar
            theme_words = [w.capitalize() for w in theme_words]
            
            # Crear tema
            theme = ' / '.join(theme_words)
            themes[cluster_id] = theme
        else:
            # Usar documentos como fallback
            doc_names = set([chunk['document_name'] for chunk in cluster_chunks[:3]])
            if len(doc_names) == 1:
                themes[cluster_id] = list(doc_names)[0].split('.')[0][:30]
            else:
                themes[cluster_id] = f"Tema {cluster_id + 1}"
    
    return themes

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'ok',
        'service': 'codex-synapse-viz',
        'has_umap': HAS_UMAP
    })

@app.route('/api/visualize', methods=['POST'])
def visualize():
    """
    Endpoint principal para visualización 3D
    
    Body:
        {
            "method": "umap" | "pca",
            "n_clusters": 8,
            "filters": {
                "document_id": 123,
                "project_id": 456,
                "is_vault_only": true
            }
        }
    """
    try:
        data = request.get_json() or {}
        
        method = data.get('method', 'umap')
        n_clusters = data.get('n_clusters', 8)
        filters = data.get('filters', {})
        
        # Obtener embeddings de BD
        chunks = fetch_embeddings_from_db(filters)
        
        if not chunks:
            return jsonify({
                'chunks': [],
                'clusters': [],
                'metadata': {
                    'error': 'No embeddings found with the specified filters'
                }
            })
        
        # Reducir a 3D
        result = reduce_to_3d(chunks, method, n_clusters)
        
        return jsonify(result)
        
    except Exception as e:
        import traceback
        error_details = {
            'error': str(e),
            'type': type(e).__name__,
            'traceback': traceback.format_exc()
        }
        print(f"ERROR en /api/visualize: {error_details}")
        return jsonify(error_details), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8091, debug=True)

