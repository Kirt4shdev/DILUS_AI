# 🔍 Cómo Funciona el RAG Híbrido - Explicación Paso a Paso

## 📚 ¿Qué es RAG Híbrido?

El **RAG Híbrido** combina **dos técnicas de búsqueda** para encontrar los chunks más relevantes:

1. **🧠 Búsqueda Vectorial (Semántica)** - Entiende el significado
2. **🔤 Búsqueda BM25 (Keywords)** - Busca palabras clave

---

## 🎯 Proceso Completo del RAG Híbrido

### **FASE 1: Cuando subes un documento**

#### Paso 1: Chunking
```
Documento original →  División en chunks
                    ↓
[Chunk 1: "Miguel Carrasco es..."]
[Chunk 2: "El vibranium tiene..."]
[Chunk 3: "Para cazar topos..."]
```

#### Paso 2: Vectorización (Embeddings)
Cada chunk se convierte en un **vector de 1536 dimensiones**:
```
Texto: "Miguel Carrasco es el líder supremo"
         ↓ (OpenAI text-embedding-ada-002)
Vector: [0.123, -0.456, 0.789, ..., 0.234] (1536 números)
```

Este vector representa el **significado semántico** del texto.

#### Paso 3: Indexación de Texto Completo (TSV)
PostgreSQL crea un índice de búsqueda por palabras:
```
Texto: "Miguel Carrasco es el líder supremo"
         ↓ (PostgreSQL Full-Text Search)
TSV: 'miguel':1 'carrasco':2 'lider':4 'supremo':5
```

Esto permite búsqueda rápida por **palabras clave exactas**.

#### Paso 4: Guardado en BD
```sql
INSERT INTO embeddings (
  document_id,
  chunk_text,
  chunk_index,
  embedding,      -- Vector de 1536 dimensiones
  tsv,            -- Índice de texto completo
  metadata
) VALUES (...);
```

---

### **FASE 2: Cuando haces una pregunta**

Supongamos que preguntas: **"¿Quién es Miguel Carrasco?"**

#### Paso 1: Vectorización de la Query
```
Query: "¿Quién es Miguel Carrasco?"
         ↓ (OpenAI text-embedding-ada-002)
Query Vector: [0.135, -0.442, 0.801, ..., 0.221]
```

#### Paso 2: Búsqueda Vectorial (Similitud Semántica)
PostgreSQL calcula la **distancia coseno** entre tu query y todos los chunks:

```sql
(1 - (embedding <=> query_vector))::FLOAT AS vector_similarity
```

**¿Cómo funciona?**
- `<=>` es el operador de distancia coseno de pgvector
- Compara el vector de tu pregunta con cada chunk
- Resultado: 0.0 (nada similar) a 1.0 (idéntico)

**Ejemplo de resultados:**
```
Chunk 1: "Miguel Carrasco es el líder supremo"     → 0.87 (muy similar)
Chunk 2: "El vibranium tiene propiedades mágicas"  → 0.34 (poco similar)
Chunk 3: "Para cazar topos necesitas..."           → 0.28 (poco similar)
```

#### Paso 3: Búsqueda BM25 (Keywords)
PostgreSQL usa `ts_rank` para buscar **coincidencias de palabras**:

```sql
ts_rank(tsv, plainto_tsquery('spanish', query_text))::FLOAT AS bm25_score
```

**¿Cómo funciona?**
- `plainto_tsquery('spanish', ...)` convierte tu pregunta en términos de búsqueda
- `ts_rank` calcula un score basado en:
  - **Frecuencia**: ¿Cuántas veces aparece la palabra?
  - **Posición**: ¿Dónde aparece? (al inicio es mejor)
  - **Rareza**: Palabras raras valen más que comunes

**Ejemplo de resultados:**
```
Query procesada: 'quien' 'miguel' 'carrasco'

Chunk 1: "Miguel Carrasco es el líder supremo"
  - Tiene "miguel" y "carrasco" ✅
  - BM25 Score: 0.45

Chunk 2: "El vibranium tiene propiedades mágicas"
  - No tiene ninguna palabra ❌
  - BM25 Score: 0.0

Chunk 3: "Para cazar topos necesitas..."
  - No tiene ninguna palabra ❌
  - BM25 Score: 0.0
```

#### Paso 4: Cálculo del Score Híbrido
Aquí viene la **magia** 🎩:

```sql
hybrid_score = (vector_similarity * vector_weight) + (bm25_score * bm25_weight)
```

Con los pesos configurables (por defecto: 0.6 vectorial, 0.4 BM25):

```
Chunk 1:
  vector_similarity: 0.87
  bm25_score: 0.45
  hybrid_score = (0.87 * 0.6) + (0.45 * 0.4) = 0.522 + 0.180 = 0.702 ✅

Chunk 2:
  vector_similarity: 0.34
  bm25_score: 0.0
  hybrid_score = (0.34 * 0.6) + (0.0 * 0.4) = 0.204 + 0.0 = 0.204 ❌

Chunk 3:
  vector_similarity: 0.28
  bm25_score: 0.0
  hybrid_score = (0.28 * 0.6) + (0.0 * 0.4) = 0.168 + 0.0 = 0.168 ❌
```

#### Paso 5: Ordenamiento y Filtrado
```sql
ORDER BY hybrid_score DESC
LIMIT top_k
```

Los chunks se ordenan por score híbrido y se seleccionan los mejores.

#### Paso 6: Filtros de Threshold
Después de obtener los resultados, se aplican filtros:

```javascript
filteredResults = results.filter(chunk => 
  chunk.vector_similarity >= min_similarity || 
  chunk.hybrid_score >= min_hybrid_score
);
```

**Lógica del filtro (OR):**
- Si `vector_similarity >= 0.3` → ✅ Pasa (es semánticamente relevante)
- O si `hybrid_score >= 0.25` → ✅ Pasa (es relevante en general)
- Si ninguno → ❌ Se descarta

---

## 🎛️ Ajustes de Pesos

### **Más peso a Vectorial (Semántico)**
```
vector_weight = 0.8, bm25_weight = 0.2
```
**Mejor para:**
- Preguntas conceptuales: "¿Cuál es el propósito de X?"
- Sinónimos y paráfrasis
- Comprensión de contexto

### **Más peso a BM25 (Keywords)**
```
vector_weight = 0.4, bm25_weight = 0.6
```
**Mejor para:**
- Nombres propios específicos
- Términos técnicos exactos
- Búsquedas literales

### **Equilibrado (Por defecto)**
```
vector_weight = 0.6, bm25_weight = 0.4
```
**Mejor para:**
- Uso general
- Balance entre precisión y recall

---

## 📊 Ejemplo Completo Real

### Pregunta: "¿Cómo se caza un topo?"

#### 1. Vectorización
```
Query Vector: [0.234, -0.567, 0.891, ...]
```

#### 2. Búsqueda en BD
```sql
SELECT 
  chunk_text,
  (1 - (embedding <=> query_vector)) AS vector_similarity,
  ts_rank(tsv, plainto_tsquery('spanish', 'caza topo')) AS bm25_score,
  ((1 - (embedding <=> query_vector)) * 0.6 + 
   ts_rank(tsv, ...) * 0.4) AS hybrid_score
FROM embeddings
ORDER BY hybrid_score DESC
LIMIT 5;
```

#### 3. Resultados
```
Chunk A: "Para cazar un topo necesitas una pala y paciencia..."
  - vector_similarity: 0.75 (entiende que habla de cazar topos)
  - bm25_score: 0.62 (contiene "caza" y "topo")
  - hybrid_score: 0.75 * 0.6 + 0.62 * 0.4 = 0.698 🥇

Chunk B: "Los topos son animales subterráneos..."
  - vector_similarity: 0.58 (habla de topos pero no de cazar)
  - bm25_score: 0.31 (solo contiene "topo")
  - hybrid_score: 0.58 * 0.6 + 0.31 * 0.4 = 0.472 🥈

Chunk C: "La caza deportiva requiere licencia..."
  - vector_similarity: 0.42 (habla de caza pero no de topos)
  - bm25_score: 0.35 (solo contiene "caza")
  - hybrid_score: 0.42 * 0.6 + 0.35 * 0.4 = 0.392 🥉
```

#### 4. Filtrado
```
min_similarity = 0.3
min_hybrid_score = 0.25

Chunk A: 0.75 >= 0.3 ✅ (pasa)
Chunk B: 0.58 >= 0.3 ✅ (pasa)
Chunk C: 0.42 >= 0.3 ✅ (pasa)
```

#### 5. Resultado Final
Se envían los chunks A y B (top 2) al LLM para generar la respuesta.

---

## 💡 Ventajas del Sistema Híbrido

| Aspecto | Solo Vectorial | Solo BM25 | **Híbrido** |
|---------|---------------|-----------|-------------|
| Sinónimos | ✅ Excelente | ❌ No detecta | ✅ Excelente |
| Nombres propios | 🟡 Variable | ✅ Excelente | ✅ Excelente |
| Contexto | ✅ Excelente | ❌ No entiende | ✅ Excelente |
| Palabras raras | 🟡 Variable | ✅ Excelente | ✅ Excelente |
| Precisión | 🟡 Buena | 🟡 Buena | ✅ **Muy buena** |
| Recall | ✅ Alto | 🟡 Medio | ✅ **Muy alto** |

---

## 🔧 Configuración Actual en tu Sistema

Todos estos parámetros son ajustables desde **Admin Panel → Control del RAG**:

- **chunk_size**: 1000 caracteres
- **chunk_overlap**: 200 caracteres
- **chunking_method**: fixed / sentence / **paragraph** ⭐ (¡ya funciona!)
- **top_k**: 5 chunks
- **min_similarity**: 0.3 (threshold vectorial)
- **min_hybrid_score**: 0.25 (threshold híbrido)
- **vector_weight**: 0.6 (60% peso semántico)
- **bm25_weight**: 0.4 (40% peso keywords)

---

## 🎓 Resumen Ejecutivo

1. **Embeddings (Vectorial)** = Entiende el **significado**
2. **BM25 (Keywords)** = Busca **palabras exactas**
3. **Híbrido** = Combina ambos con **pesos configurables**
4. **Resultado** = Chunks más relevantes tanto semánticamente como por contenido literal

**¡Lo mejor de dos mundos!** 🌍🌎

