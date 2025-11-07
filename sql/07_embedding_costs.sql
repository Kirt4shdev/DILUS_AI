-- ============================================
-- DILUS_AI - Embedding Costs Tracking
-- ============================================

-- Tabla para registrar costes de embeddings
CREATE TABLE IF NOT EXISTS embedding_costs (
  id SERIAL PRIMARY KEY,
  operation_type VARCHAR(50) NOT NULL, -- 'document_ingestion', 'query_search', 'chat_query'
  user_id INTEGER REFERENCES users(id),
  document_id INTEGER REFERENCES documents(id),
  project_id INTEGER REFERENCES projects(id),
  tokens_used INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  model_used VARCHAR(50) NOT NULL,
  operation_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embedding_costs_operation_type ON embedding_costs(operation_type);
CREATE INDEX IF NOT EXISTS idx_embedding_costs_user_id ON embedding_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_embedding_costs_created_at ON embedding_costs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_embedding_costs_document_id ON embedding_costs(document_id);

-- Vista para estadísticas agregadas de costes
CREATE OR REPLACE VIEW embedding_cost_stats AS
SELECT
  operation_type,
  COUNT(*) as total_operations,
  SUM(tokens_used) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(tokens_used) as avg_tokens,
  AVG(cost_usd) as avg_cost_usd,
  MAX(cost_usd) as max_cost_usd,
  MIN(cost_usd) as min_cost_usd
FROM embedding_costs
GROUP BY operation_type;

-- Vista para costes por usuario
CREATE OR REPLACE VIEW embedding_cost_by_user AS
SELECT
  u.id as user_id,
  u.email,
  u.username,
  COUNT(ec.id) as total_operations,
  SUM(ec.tokens_used) as total_tokens,
  SUM(ec.cost_usd) as total_cost_usd
FROM users u
LEFT JOIN embedding_costs ec ON u.id = ec.user_id
GROUP BY u.id, u.email, u.username;

-- Vista para costes por documento
CREATE OR REPLACE VIEW embedding_cost_by_document AS
SELECT
  d.id as document_id,
  d.filename,
  d.is_vault_document,
  COUNT(ec.id) as total_operations,
  SUM(ec.tokens_used) as total_tokens,
  SUM(ec.cost_usd) as total_cost_usd
FROM documents d
LEFT JOIN embedding_costs ec ON d.id = ec.document_id
GROUP BY d.id, d.filename, d.is_vault_document;

-- Función para obtener costes totales
CREATE OR REPLACE FUNCTION get_total_embedding_costs()
RETURNS TABLE (
  total_operations BIGINT,
  total_tokens BIGINT,
  total_cost_usd NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_operations,
    SUM(tokens_used)::BIGINT as total_tokens,
    SUM(cost_usd)::NUMERIC as total_cost_usd
  FROM embedding_costs;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PRINT SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Embedding costs tracking tables and views created successfully!';
END $$;

