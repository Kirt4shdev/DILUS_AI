-- ============================================
-- DILUS_AI - pgvector Hybrid Search Function
-- ============================================

-- Función de búsqueda híbrida (Vector + BM25)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  query_text TEXT,
  doc_id INTEGER DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.5,
  top_k INTEGER DEFAULT 5,
  vector_weight FLOAT DEFAULT 0.6,
  bm25_weight FLOAT DEFAULT 0.4
)
RETURNS TABLE (
  id INTEGER,
  document_id INTEGER,
  chunk_text TEXT,
  chunk_index INTEGER,
  vector_similarity FLOAT,
  bm25_score FLOAT,
  hybrid_score FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.document_id,
    e.chunk_text,
    e.chunk_index,
    (1 - (e.embedding <=> query_embedding))::FLOAT AS vector_similarity,
    ts_rank(e.tsv, plainto_tsquery('spanish', query_text))::FLOAT AS bm25_score,
    (
      (1 - (e.embedding <=> query_embedding)) * vector_weight +
      ts_rank(e.tsv, plainto_tsquery('spanish', query_text)) * bm25_weight
    )::FLOAT AS hybrid_score,
    e.metadata
  FROM embeddings e
  WHERE 
    (doc_id IS NULL OR e.document_id = doc_id)
    AND (1 - (e.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY hybrid_score DESC
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PRINT SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Hybrid search function created successfully!';
END $$;

