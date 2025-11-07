-- ============================================
-- DILUS_AI - Chunk History Tracking
-- ============================================

-- Tabla para rastrear chunks seleccionados por el sistema RAG
CREATE TABLE IF NOT EXISTS chunk_selection_history (
  id SERIAL PRIMARY KEY,
  
  -- Información del chunk
  chunk_id INTEGER REFERENCES embeddings(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  document_name VARCHAR(255),
  
  -- Scores y métricas
  vector_similarity FLOAT NOT NULL,
  bm25_score FLOAT,
  hybrid_score FLOAT NOT NULL,
  
  -- Thresholds aplicados en el momento
  min_similarity_threshold FLOAT,
  min_hybrid_threshold FLOAT,
  
  -- Context de uso
  operation_type VARCHAR(50) NOT NULL, -- 'chat' o 'analysis'
  operation_subtype VARCHAR(100), -- 'vault_query', 'pliego_tecnico', 'contrato', etc.
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Query original
  query_text TEXT,
  query_embedding_preview TEXT, -- Primeros caracteres del embedding para debug
  
  -- Metadata adicional
  was_selected BOOLEAN DEFAULT TRUE, -- Si fue seleccionado o rechazado por filtros
  rejection_reason VARCHAR(255), -- Si fue rechazado, por qué
  rank_position INTEGER, -- Posición en el ranking de resultados
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_chunk_history_user ON chunk_selection_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chunk_history_operation ON chunk_selection_history(operation_type, operation_subtype);
CREATE INDEX IF NOT EXISTS idx_chunk_history_document ON chunk_selection_history(document_id);
CREATE INDEX IF NOT EXISTS idx_chunk_history_created ON chunk_selection_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chunk_history_scores ON chunk_selection_history(vector_similarity, hybrid_score);
CREATE INDEX IF NOT EXISTS idx_chunk_history_selected ON chunk_selection_history(was_selected);

-- Vista para análisis de chunks seleccionados vs rechazados
CREATE OR REPLACE VIEW chunk_selection_stats AS
SELECT 
  operation_type,
  operation_subtype,
  COUNT(*) as total_chunks,
  COUNT(*) FILTER (WHERE was_selected = TRUE) as selected_chunks,
  COUNT(*) FILTER (WHERE was_selected = FALSE) as rejected_chunks,
  ROUND(AVG(vector_similarity)::numeric, 3) as avg_similarity,
  ROUND(AVG(hybrid_score)::numeric, 3) as avg_hybrid_score,
  ROUND(MIN(vector_similarity)::numeric, 3) as min_similarity,
  ROUND(MIN(hybrid_score)::numeric, 3) as min_hybrid_score,
  ROUND(MAX(vector_similarity)::numeric, 3) as max_similarity,
  ROUND(MAX(hybrid_score)::numeric, 3) as max_hybrid_score,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM chunk_selection_history
GROUP BY operation_type, operation_subtype
ORDER BY last_seen DESC;

-- Vista para análisis por documento
CREATE OR REPLACE VIEW chunk_usage_by_document AS
SELECT 
  d.id as document_id,
  d.filename,
  d.is_vault_document,
  COUNT(DISTINCT csh.id) as times_used,
  COUNT(DISTINCT csh.chunk_id) as unique_chunks_used,
  ROUND(AVG(csh.vector_similarity)::numeric, 3) as avg_similarity,
  ROUND(AVG(csh.hybrid_score)::numeric, 3) as avg_hybrid_score,
  MAX(csh.created_at) as last_used
FROM documents d
LEFT JOIN chunk_selection_history csh ON d.id = csh.document_id
WHERE csh.was_selected = TRUE
GROUP BY d.id, d.filename, d.is_vault_document
ORDER BY times_used DESC;

-- ============================================
-- PRINT SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Chunk history tracking tables created successfully!';
END $$;

