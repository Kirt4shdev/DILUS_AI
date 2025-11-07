-- ============================================
-- ANÁLISIS COMPLETO DE CHUNKS GENERADOS
-- ============================================

-- 1. VERIFICAR CONFIGURACIÓN ACTUAL
SELECT '============================================' as separator;
SELECT '1. CONFIGURACIÓN ACTUAL DE CHUNKING' as titulo;
SELECT '============================================' as separator;

SELECT 
  config_key,
  config_value,
  data_type,
  updated_at
FROM rag_config
WHERE config_key IN ('chunk_size', 'chunk_overlap', 'chunking_method')
ORDER BY config_key;

-- 2. ESTADÍSTICAS GENERALES DE DOCUMENTOS
SELECT '============================================' as separator;
SELECT '2. DOCUMENTOS VECTORIZADOS' as titulo;
SELECT '============================================' as separator;

SELECT 
  d.id,
  d.filename,
  d.vectorization_status,
  d.created_at,
  COUNT(dc.id) as total_chunks
FROM documents d
LEFT JOIN document_chunks dc ON d.id = dc.document_id
WHERE d.vectorization_status = 'completed'
GROUP BY d.id, d.filename, d.vectorization_status, d.created_at
ORDER BY d.created_at DESC;

-- 3. ESTADÍSTICAS DE TAMAÑOS DE CHUNKS
SELECT '============================================' as separator;
SELECT '3. ESTADÍSTICAS DE TAMAÑOS DE CHUNKS' as titulo;
SELECT '============================================' as separator;

SELECT 
  d.id as doc_id,
  d.filename,
  COUNT(dc.id) as total_chunks,
  MIN(LENGTH(dc.chunk_text)) as min_size,
  MAX(LENGTH(dc.chunk_text)) as max_size,
  ROUND(AVG(LENGTH(dc.chunk_text))) as avg_size,
  ROUND(STDDEV(LENGTH(dc.chunk_text))) as stddev_size
FROM documents d
JOIN document_chunks dc ON d.id = dc.document_id
WHERE d.vectorization_status = 'completed'
GROUP BY d.id, d.filename
ORDER BY d.created_at DESC;

-- 4. DISTRIBUCIÓN DE TAMAÑOS (HISTOGRAMA)
SELECT '============================================' as separator;
SELECT '4. DISTRIBUCIÓN DE TAMAÑOS (HISTOGRAMA)' as titulo;
SELECT '============================================' as separator;

SELECT 
  CASE 
    WHEN LENGTH(chunk_text) <= 500 THEN '0-500'
    WHEN LENGTH(chunk_text) <= 1000 THEN '501-1000'
    WHEN LENGTH(chunk_text) <= 1500 THEN '1001-1500'
    WHEN LENGTH(chunk_text) <= 2000 THEN '1501-2000'
    WHEN LENGTH(chunk_text) <= 2500 THEN '2001-2500'
    WHEN LENGTH(chunk_text) <= 3000 THEN '2501-3000'
    WHEN LENGTH(chunk_text) <= 3500 THEN '3001-3500'
    ELSE '>3500'
  END as rango_tamaño,
  COUNT(*) as cantidad_chunks,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.vectorization_status = 'completed'
GROUP BY 
  CASE 
    WHEN LENGTH(chunk_text) <= 500 THEN '0-500'
    WHEN LENGTH(chunk_text) <= 1000 THEN '501-1000'
    WHEN LENGTH(chunk_text) <= 1500 THEN '1001-1500'
    WHEN LENGTH(chunk_text) <= 2000 THEN '1501-2000'
    WHEN LENGTH(chunk_text) <= 2500 THEN '2001-2500'
    WHEN LENGTH(chunk_text) <= 3000 THEN '2501-3000'
    WHEN LENGTH(chunk_text) <= 3500 THEN '3001-3500'
    ELSE '>3500'
  END
ORDER BY rango_tamaño;

-- 5. CHUNKS QUE EXCEDEN EL MÁXIMO (3000)
SELECT '============================================' as separator;
SELECT '5. CHUNKS QUE EXCEDEN 3000 CARACTERES' as titulo;
SELECT '============================================' as separator;

SELECT 
  d.filename,
  dc.chunk_index,
  LENGTH(dc.chunk_text) as tamaño,
  SUBSTRING(dc.chunk_text, 1, 100) || '...' as preview
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE LENGTH(dc.chunk_text) > 3000
  AND d.vectorization_status = 'completed'
ORDER BY LENGTH(dc.chunk_text) DESC
LIMIT 20;

-- 6. VERIFICAR SI TERMINA EN LÍMITES DE PÁRRAFOS
SELECT '============================================' as separator;
SELECT '6. VERIFICACIÓN DE LÍMITES DE PÁRRAFOS' as titulo;
SELECT '============================================' as separator;

SELECT 
  d.filename,
  dc.chunk_index,
  LENGTH(dc.chunk_text) as tamaño,
  RIGHT(TRIM(dc.chunk_text), 50) as ultimos_50_chars,
  CASE 
    WHEN TRIM(dc.chunk_text) ~ '\.$' THEN '✓ Termina en punto (.)'
    WHEN TRIM(dc.chunk_text) ~ '[.!?]$' THEN '✓ Termina en puntuación'
    WHEN TRIM(dc.chunk_text) ~ '[a-zA-Z0-9]$' THEN '⚠ Corte en medio de texto'
    ELSE '? Otro'
  END as tipo_final
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.vectorization_status = 'completed'
ORDER BY d.id, dc.chunk_index
LIMIT 30;

-- 7. RESUMEN FINAL
SELECT '============================================' as separator;
SELECT '7. RESUMEN EJECUTIVO' as titulo;
SELECT '============================================' as separator;

SELECT 
  COUNT(DISTINCT d.id) as total_documentos,
  COUNT(dc.id) as total_chunks,
  MIN(LENGTH(dc.chunk_text)) as min_chunk_size,
  MAX(LENGTH(dc.chunk_text)) as max_chunk_size,
  ROUND(AVG(LENGTH(dc.chunk_text))) as avg_chunk_size,
  COUNT(CASE WHEN LENGTH(dc.chunk_text) > 3000 THEN 1 END) as chunks_exceden_3000,
  COUNT(CASE WHEN LENGTH(dc.chunk_text) > 3300 THEN 1 END) as chunks_exceden_3300,
  ROUND(COUNT(CASE WHEN LENGTH(dc.chunk_text) > 3000 THEN 1 END) * 100.0 / COUNT(*), 2) as pct_exceden_3000
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.vectorization_status = 'completed';

