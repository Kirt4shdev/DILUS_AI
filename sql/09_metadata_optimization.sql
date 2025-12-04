-- ============================================
-- METADATA SYSTEM - Optional Optimizations
-- ============================================
-- Este script es OPCIONAL y mejora el rendimiento
-- de queries sobre el campo metadata JSONB

-- ============================================
-- ÍNDICE GIN para búsquedas en metadata
-- ============================================
-- Mejora significativamente queries del tipo:
-- WHERE metadata->'doc'->>'equipo' = 'WS600'
-- WHERE metadata->>'doc_type' = 'manual'

CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_gin 
ON embeddings USING GIN(metadata jsonb_path_ops);

-- ============================================
-- ÍNDICE para búsquedas específicas de equipo
-- ============================================
-- Para filtrado ultra-rápido por equipo
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_equipo
ON embeddings ((metadata->'doc'->>'equipo'));

-- ============================================
-- ÍNDICE para búsquedas específicas de fabricante
-- ============================================
-- Para filtrado ultra-rápido por fabricante
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_fabricante
ON embeddings ((metadata->'doc'->>'fabricante'));

-- ============================================
-- ÍNDICE para búsquedas por tipo de documento
-- ============================================
-- Para filtrar por doc_type
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_doc_type
ON embeddings ((metadata->'doc'->>'doc_type'));

-- ============================================
-- VISTA MATERIALIZADA: Resumen de metadata
-- ============================================
-- Útil para dashboards y estadísticas
CREATE MATERIALIZED VIEW IF NOT EXISTS document_metadata_summary AS
SELECT 
  d.id as document_id,
  d.filename,
  d.is_vault_document,
  d.created_at,
  (SELECT metadata->'doc'->>'doc_id' FROM embeddings WHERE document_id = d.id LIMIT 1) as doc_id,
  (SELECT metadata->'doc'->>'equipo' FROM embeddings WHERE document_id = d.id LIMIT 1) as equipo,
  (SELECT metadata->'doc'->>'fabricante' FROM embeddings WHERE document_id = d.id LIMIT 1) as fabricante,
  (SELECT metadata->'doc'->>'doc_type' FROM embeddings WHERE document_id = d.id LIMIT 1) as doc_type,
  (SELECT metadata->'doc'->>'source' FROM embeddings WHERE document_id = d.id LIMIT 1) as source,
  (SELECT metadata->'doc'->>'creation_origin' FROM embeddings WHERE document_id = d.id LIMIT 1) as creation_origin,
  COUNT(e.id) as chunks_count
FROM documents d
LEFT JOIN embeddings e ON d.id = e.document_id
WHERE d.vectorization_status = 'completed'
GROUP BY d.id, d.filename, d.is_vault_document, d.created_at;

-- Índice en la vista materializada
CREATE INDEX IF NOT EXISTS idx_doc_metadata_summary_equipo
ON document_metadata_summary(equipo);

CREATE INDEX IF NOT EXISTS idx_doc_metadata_summary_fabricante
ON document_metadata_summary(fabricante);

CREATE INDEX IF NOT EXISTS idx_doc_metadata_summary_doc_type
ON document_metadata_summary(doc_type);

-- ============================================
-- FUNCIÓN: Refrescar vista materializada
-- ============================================
-- Ejecutar periódicamente o después de ingestas
CREATE OR REPLACE FUNCTION refresh_metadata_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW document_metadata_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CONSULTAS DE EJEMPLO
-- ============================================

-- 1. Buscar todos los chunks de un equipo específico
/*
SELECT 
  e.id,
  e.chunk_text,
  d.filename,
  e.metadata->'doc'->>'equipo' as equipo
FROM embeddings e
JOIN documents d ON e.document_id = d.id
WHERE e.metadata->'doc'->>'equipo' = 'WS600';
*/

-- 2. Estadísticas de equipos más documentados
/*
SELECT 
  metadata->'doc'->>'equipo' as equipo,
  COUNT(DISTINCT document_id) as documentos,
  COUNT(*) as chunks
FROM embeddings
WHERE metadata->'doc'->>'equipo' IS NOT NULL
GROUP BY metadata->'doc'->>'equipo'
ORDER BY documentos DESC
LIMIT 10;
*/

-- 3. Distribución de tipos de documentos
/*
SELECT 
  metadata->'doc'->>'doc_type' as doc_type,
  COUNT(DISTINCT document_id) as count
FROM embeddings
WHERE metadata->'doc'->>'doc_type' IS NOT NULL
GROUP BY metadata->'doc'->>'doc_type'
ORDER BY count DESC;
*/

-- 4. Documentos por fabricante
/*
SELECT 
  fabricante,
  COUNT(*) as documentos
FROM document_metadata_summary
WHERE fabricante IS NOT NULL
GROUP BY fabricante
ORDER BY documentos DESC;
*/

-- ============================================
-- PRINT SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Metadata optimization indexes created successfully!';
  RAISE NOTICE 'ℹ️  Run: SELECT refresh_metadata_summary(); to populate the summary view';
END $$;

