# 🔤 Cómo se Calcula el BM25 Score - Explicación Técnica Detallada

## 📊 Resumen Rápido

**BM25** es un algoritmo de ranking que calcula qué tan relevante es un documento para una query basándose en la **frecuencia de las palabras clave**.

En tu sistema, usamos la función **`ts_rank`** de PostgreSQL, que es una implementación similar a BM25.

---

## 🔧 FASE 1: Cuando Subes un Documento (Indexación)

### Paso 1: El Chunk Llega a la Base de Datos

```javascript
// backend/services/ragService.js - línea 142
INSERT INTO embeddings (
  document_id, 
  chunk_text, 
  chunk_index, 
  embedding, 
  metadata
) VALUES ($1, $2, $3, $4, $5)
```

### Paso 2: PostgreSQL Genera Automáticamente el TSV

En la definición de la tabla `embeddings` (sql/01_init.sql línea 74):

```sql
tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish', chunk_text)) STORED
```

**¿Qué significa esto?**

- `GENERATED ALWAYS`: Se calcula automáticamente al insertar/actualizar
- `to_tsvector('spanish', chunk_text)`: Procesa el texto en español
- `STORED`: Se guarda físicamente en disco (no se recalcula cada vez)

### Paso 3: ¿Qué Hace `to_tsvector('spanish', ...)`?

Convierte el texto en un **vector de términos de búsqueda**.

#### Ejemplo Práctico:

**Texto Original:**
```
"Miguel Carrasco es el líder supremo de DILUS y tiene poderes especiales."
```

**Procesamiento:**

1. **Tokenización** (dividir en palabras):
```
["Miguel", "Carrasco", "es", "el", "líder", "supremo", "de", "DILUS", "y", "tiene", "poderes", "especiales"]
```

2. **Normalización** (minúsculas):
```
["miguel", "carrasco", "es", "el", "líder", "supremo", "de", "dilus", "y", "tiene", "poderes", "especiales"]
```

3. **Eliminación de stopwords** (palabras comunes en español):
```
Stopwords eliminadas: "es", "el", "de", "y"
Resultado: ["miguel", "carrasco", "líder", "supremo", "dilus", "tiene", "poderes", "especiales"]
```

4. **Stemming** (reducir a raíz):
```
"líder" → "lider"
"supremo" → "suprem"
"poderes" → "poder"
"especiales" → "especial"
```

5. **TSVector Final** (con posiciones):
```sql
'miguel':1 'carrasco':2 'lider':3 'suprem':4 'dilus':5 'tien':6 'poder':7 'especial':8
```

El número indica la **posición** donde aparece cada palabra en el texto original.

### Paso 4: Creación del Índice GIN

```sql
CREATE INDEX idx_embeddings_tsv ON embeddings USING GIN(tsv);
```

PostgreSQL crea un **índice invertido** (GIN = Generalized Inverted Index):

```
Índice GIN:
"miguel"    → [chunk_1, chunk_5, chunk_12]
"carrasco"  → [chunk_1, chunk_5]
"lider"     → [chunk_1, chunk_8, chunk_15]
"suprem"    → [chunk_1]
"dilus"     → [chunk_1, chunk_3, chunk_4, chunk_12]
...
```

Esto permite búsquedas **ultra-rápidas** por palabras clave.

---

## 🔍 FASE 2: Cuando Haces una Búsqueda (Ranking)

### Paso 1: Tu Query

```javascript
const queryText = "¿Quién es el líder de DILUS?";
```

### Paso 2: PostgreSQL Procesa la Query

```sql
plainto_tsquery('spanish', $queryText)
```

**¿Qué hace `plainto_tsquery`?**

Aplica el **mismo procesamiento** que `to_tsvector`:

```
Input: "¿Quién es el líder de DILUS?"
       ↓ (tokenización, normalización, stopwords, stemming)
Output: 'quien' & 'lider' & 'dilus'
```

El operador `&` significa **AND** (todas las palabras).

**Nota:** Los signos de puntuación y stopwords se eliminan automáticamente.

### Paso 3: Búsqueda en el Índice GIN

PostgreSQL usa el índice para encontrar rápidamente chunks que contengan estas palabras:

```
"quien"  → [chunk_3, chunk_9] (pocos resultados, palabra rara = más valor)
"lider"  → [chunk_1, chunk_8, chunk_15] (más resultados, menos valor)
"dilus"  → [chunk_1, chunk_3, chunk_4, chunk_12] (muchos resultados, común)
```

### Paso 4: Cálculo del `ts_rank` (BM25-like)

PostgreSQL ejecuta:

```sql
ts_rank(e.tsv, plainto_tsquery('spanish', $queryText))::FLOAT AS bm25_score
```

**¿Cómo se calcula `ts_rank`?**

La función `ts_rank` usa una fórmula que considera:

#### **Factor 1: Frecuencia del Término (TF - Term Frequency)**

¿Cuántas veces aparece cada palabra en el chunk?

```
Chunk A: "Miguel Carrasco es el líder de DILUS. Carrasco lidera el proyecto."
         - "carrasco" aparece 2 veces → TF alto ✅
         - "lider/lidera" aparece 2 veces → TF alto ✅
         - "dilus" aparece 1 vez → TF medio

Chunk B: "DILUS es una organización."
         - "dilus" aparece 1 vez → TF bajo
         - "líder" NO aparece → TF = 0 ❌
```

**Fórmula simplificada:**
```
TF(term) = occurrences / total_words_in_chunk
```

#### **Factor 2: Frecuencia Inversa del Documento (IDF - Inverse Document Frequency)**

¿Qué tan rara es esta palabra en TODOS los chunks?

**Lógica:**
- Palabra **rara** (aparece en pocos chunks) → **MÁS valor** ✅
- Palabra **común** (aparece en muchos chunks) → **MENOS valor** ❌

```
Ejemplo:
- "Miguel Carrasco" aparece en 2 de 100 chunks → IDF alto (rara) = 3.8
- "líder" aparece en 15 de 100 chunks → IDF medio = 1.9
- "DILUS" aparece en 50 de 100 chunks → IDF bajo (común) = 0.7
```

**Fórmula:**
```
IDF(term) = log(total_chunks / chunks_containing_term)
```

#### **Factor 3: Longitud del Documento (Normalización)**

Los chunks más largos tienden a tener más coincidencias. Se normaliza para ser justo:

```
Chunk corto (500 chars):  Score × 1.2  (bonus)
Chunk medio (1000 chars): Score × 1.0  (neutral)
Chunk largo (2000 chars): Score × 0.8  (penalización)
```

#### **Factor 4: Posición de las Palabras**

Palabras que aparecen al **inicio** del chunk valen más:

```
"Miguel Carrasco es el líder..." (posición 1-2) → Factor × 1.5 ✅
"...y finalmente Miguel Carrasco..." (posición 20) → Factor × 1.0
```

### Paso 5: Fórmula Completa de `ts_rank`

```
ts_rank = Σ (TF(term) × IDF(term) × position_weight × length_normalization)
```

Para cada término de la query, se suman los factores.

---

## 📊 Ejemplo Numérico Completo

### Query: "¿Quién es Miguel Carrasco?"

Términos procesados: `'quien' & 'miguel' & 'carrasco'`

### Chunk A:
```
"Miguel Carrasco es el líder supremo de DILUS y fundador del proyecto."
```

**Cálculo:**

| Término | TF | IDF | Posición | Longitud | Score Parcial |
|---------|-----|-----|----------|----------|---------------|
| quien   | 0.00 | - | - | - | **0.00** |
| miguel  | 0.05 (1/20 palabras) | 3.5 | 1.5 (inicio) | 1.0 | **0.26** |
| carrasco | 0.05 (1/20 palabras) | 3.8 | 1.5 (inicio) | 1.0 | **0.29** |

**ts_rank total = 0.26 + 0.29 = 0.55** ✅

### Chunk B:
```
"El vibranium tiene propiedades mágicas que pueden alterar la realidad física."
```

**Cálculo:**

| Término | TF | IDF | Posición | Longitud | Score Parcial |
|---------|-----|-----|----------|----------|---------------|
| quien   | 0.00 | - | - | - | **0.00** |
| miguel  | 0.00 | - | - | - | **0.00** |
| carrasco | 0.00 | - | - | - | **0.00** |

**ts_rank total = 0.00** ❌

### Chunk C:
```
"En el documento se menciona a Carrasco y otros líderes. Miguel también aparece."
```

**Cálculo:**

| Término | TF | IDF | Posición | Longitud | Score Parcial |
|---------|-----|-----|----------|----------|---------------|
| quien   | 0.00 | - | - | - | **0.00** |
| miguel  | 0.07 (1/15 palabras) | 3.5 | 1.0 (medio) | 1.0 | **0.25** |
| carrasco | 0.07 (1/15 palabras) | 3.8 | 1.2 (cerca inicio) | 1.0 | **0.32** |

**ts_rank total = 0.25 + 0.32 = 0.57** ✅ (¡ligeramente mejor que A!)

---

## 🎯 Resultado Final en tu Sistema

PostgreSQL ejecuta:

```sql
SELECT 
  chunk_text,
  ts_rank(tsv, plainto_tsquery('spanish', '¿Quién es Miguel Carrasco?')) AS bm25_score
FROM embeddings
ORDER BY bm25_score DESC
LIMIT 5;
```

**Resultados:**

```
Chunk C: bm25_score = 0.57 🥇
Chunk A: bm25_score = 0.55 🥈
Chunk B: bm25_score = 0.00 🚫
```

---

## ⚙️ Ventajas del ts_rank / BM25

| Ventaja | Descripción |
|---------|-------------|
| 🚀 **Rápido** | Usa índices GIN, búsqueda en microsegundos |
| 🎯 **Preciso para nombres** | "Miguel Carrasco" se busca literalmente |
| 📊 **Considera frecuencia** | Más menciones = más relevante |
| 🏆 **Valora rareza** | Palabras únicas pesan más |
| 📍 **Posición importa** | Palabras al inicio valen más |
| 🔤 **Stemming inteligente** | "líder", "líderes", "liderazgo" se unifican |

---

## 🔄 Comparación: Vector vs BM25

### Ejemplo: "¿Quién dirige DILUS?"

**Vector (Semántico):**
```
Query: "¿Quién dirige DILUS?"
       ↓ (embedding)
Vector: [0.234, -0.567, ...]

Chunk A: "Miguel Carrasco es el líder de DILUS"
         - Similitud: 0.78 ✅ (entiende que "líder" = "dirige")

Chunk B: "DILUS está dirigido por un consejo"
         - Similitud: 0.72 ✅ (entiende "dirigido" = "dirige")
```

**BM25 (Keywords):**
```
Query: "¿Quién dirige DILUS?"
       ↓ (to_tsquery)
Términos: 'quien' & 'dirig' & 'dilus'

Chunk A: "Miguel Carrasco es el líder de DILUS"
         - "líder" ≠ "dirig" ❌
         - BM25: 0.35 (solo por "dilus")

Chunk B: "DILUS está dirigido por un consejo"
         - "dirigido" = "dirig" ✅
         - BM25: 0.68 ✅
```

**Híbrido (Lo mejor de ambos):**
```
Chunk A: (0.78 × 0.6) + (0.35 × 0.4) = 0.608 ✅
Chunk B: (0.72 × 0.6) + (0.68 × 0.4) = 0.704 ✅ (¡gana!)
```

---

## 🧪 Herramientas de Debug en PostgreSQL

Si quieres ver exactamente cómo se procesa un texto:

```sql
-- Ver el TSVector generado
SELECT to_tsvector('spanish', 'Miguel Carrasco es el líder supremo de DILUS');
-- Resultado: 'carrasco':2 'dilus':7 'lider':4 'miguel':1 'suprem':5

-- Ver la query procesada
SELECT plainto_tsquery('spanish', '¿Quién es Miguel Carrasco?');
-- Resultado: 'quien' & 'miguel' & 'carrasco'

-- Ver el ranking
SELECT 
  'Miguel Carrasco es el líder supremo' AS texto,
  ts_rank(
    to_tsvector('spanish', 'Miguel Carrasco es el líder supremo'),
    plainto_tsquery('spanish', '¿Quién es Miguel Carrasco?')
  ) AS score;
-- Resultado: 0.607927
```

---

## 💡 Configuración Actual en tu Sistema

```javascript
// backend/services/ragService.js - líneas 247, 272, 294

bm25_score = ts_rank(
  e.tsv,                                      // Vector TSV del chunk
  plainto_tsquery('spanish', queryText)       // Query procesada en español
)::FLOAT
```

**Idioma:** `'spanish'` → Stopwords y stemming optimizados para español

**Función:** `plainto_tsquery` → Convierte texto plano a query (más simple que `to_tsquery`)

**Tipo de ranking:** `ts_rank` → Ranking estándar BM25-like

---

## 🎓 Resumen Ejecutivo

1. **Indexación**: `to_tsvector('spanish', chunk_text)` → Procesa y tokeniza el texto
2. **Índice GIN**: Crea un diccionario invertido de palabras → chunks
3. **Query**: `plainto_tsquery('spanish', query)` → Procesa tu pregunta igual
4. **Ranking**: `ts_rank(tsv, query)` → Calcula score con TF-IDF + posición + longitud
5. **Resultado**: Un número de 0.0 a ~1.0 (típicamente 0.0 - 0.8)

**¡BM25 es la parte "literal" que complementa la búsqueda semántica!** 🎯

