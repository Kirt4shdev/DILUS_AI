#!/usr/bin/env python3
"""
DILUS AI - Codex Synapse
Reduce embeddings de 1536D a 3D para visualización
"""

import sys
import json
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

try:
    from umap import UMAP
    HAS_UMAP = True
except ImportError:
    HAS_UMAP = False
    from sklearn.decomposition import PCA

def reduce_embeddings_to_3d(embeddings, method='umap', n_clusters=8):
    """
    Reduce embeddings de alta dimensión a 3D
    
    Args:
        embeddings: array (N, 1536) - embeddings originales
        method: 'umap' o 'pca'
        n_clusters: número de clusters para k-means
    
    Returns:
        dict con coordenadas 3D, clusters, y metadata
    """
    
    # Convertir a numpy array
    embeddings_array = np.array(embeddings)
    n_samples = len(embeddings_array)
    
    # Normalizar
    scaler = StandardScaler()
    embeddings_scaled = scaler.fit_transform(embeddings_array)
    
    # Reducir dimensionalidad
    if method == 'umap' and HAS_UMAP:
        # UMAP: Mejor preservación de estructura local y global
        reducer = UMAP(
            n_components=3,
            n_neighbors=min(15, n_samples - 1),
            min_dist=0.1,
            metric='cosine',
            random_state=42,
            n_jobs=1
        )
        embeddings_3d = reducer.fit_transform(embeddings_scaled)
        variance_explained = None  # UMAP no tiene variance_explained
    else:
        # PCA: Fallback si no hay UMAP
        reducer = PCA(n_components=3, random_state=42)
        embeddings_3d = reducer.fit_transform(embeddings_scaled)
        variance_explained = sum(reducer.explained_variance_ratio_)
    
    # Normalizar coordenadas 3D al rango [-1, 1] para mejor visualización
    for i in range(3):
        col_min = embeddings_3d[:, i].min()
        col_max = embeddings_3d[:, i].max()
        if col_max > col_min:
            embeddings_3d[:, i] = 2 * (embeddings_3d[:, i] - col_min) / (col_max - col_min) - 1
    
    # Clustering (k-means)
    if n_samples >= n_clusters:
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(embeddings_scaled).tolist()
        
        # Calcular centros de clusters en 3D
        cluster_centers_3d = []
        for cluster_id in range(n_clusters):
            cluster_points = embeddings_3d[np.array(cluster_labels) == cluster_id]
            if len(cluster_points) > 0:
                center = cluster_points.mean(axis=0)
                cluster_centers_3d.append({
                    'id': int(cluster_id),
                    'x': float(center[0]),
                    'y': float(center[1]),
                    'z': float(center[2]),
                    'size': len(cluster_points)
                })
    else:
        cluster_labels = [0] * n_samples
        cluster_centers_3d = []
    
    # Convertir a lista de coordenadas
    coordinates = [
        {
            'x': float(embeddings_3d[i, 0]),
            'y': float(embeddings_3d[i, 1]),
            'z': float(embeddings_3d[i, 2]),
            'cluster': int(cluster_labels[i])
        }
        for i in range(n_samples)
    ]
    
    return {
        'coordinates': coordinates,
        'clusters': cluster_centers_3d,
        'metadata': {
            'method': 'umap' if (method == 'umap' and HAS_UMAP) else 'pca',
            'n_samples': n_samples,
            'n_clusters': len(cluster_centers_3d),
            'variance_explained': float(variance_explained) if variance_explained else None,
            'has_umap': HAS_UMAP
        }
    }

def main():
    """Función principal para procesar desde stdin"""
    try:
        # Leer JSON desde stdin
        input_data = json.loads(sys.stdin.read())
        
        embeddings = input_data.get('embeddings', [])
        method = input_data.get('method', 'umap')
        n_clusters = input_data.get('n_clusters', 8)
        
        if not embeddings:
            raise ValueError("No embeddings provided")
        
        # Procesar
        result = reduce_embeddings_to_3d(embeddings, method, n_clusters)
        
        # Output JSON
        print(json.dumps(result))
        sys.exit(0)
        
    except Exception as e:
        error_response = {
            'error': str(e),
            'type': type(e).__name__
        }
        print(json.dumps(error_response), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

