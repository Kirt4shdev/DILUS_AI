-- OPTIMIZACIÓN DE BÚSQUEDA RAG
-- Problema: La búsqueda en Codex (Vector + BM25) tarda 90% del tiempo total
-- Solución: Optimizar índices y queries

-- 1. REINDEXAR IVFFLAT CON MENOS LISTAS
-- Para 636 embeddings, lists=100 es DEMASIADO
-- Regla: lists = sqrt(total_rows) → sqrt(636) ≈ 25, usaremos 10 para ser conservadores

DROP INDEX IF EXISTS idx_embeddings_embedding;
CREATE INDEX idx_embeddings_embedding ON embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 10);

-- 2. AÑADIR ÍNDICE JSONB PARA FILTRADO POR EQUIPO/FABRICANTE
-- Esto acelera las búsquedas con filtro de metadata
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_equipo 
ON embeddings USING gin ((metadata->'doc'));

-- 3. ÍNDICE EN METADATA PARA IS_VAULT_DOCUMENT
-- Acelera filtrado de documentos de vault
CREATE INDEX IF NOT EXISTS idx_embeddings_vault_filter 
ON embeddings ((metadata->'doc'->>'is_vault_document'));

-- 4. ANALIZAR TABLA PARA ACTUALIZAR ESTADÍSTICAS
ANALYZE embeddings;

-- 5. VERIFICAR ÍNDICES
\d embeddings

-- 6. VER ESTADÍSTICAS DE ÍNDICES
SELECT 
    schemaname,
    tablename, 
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'embeddings'
ORDER BY index_scans DESC;

