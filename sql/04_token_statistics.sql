-- ============================================
-- TABLA: token_usage
-- Registro detallado de uso de tokens por tipo de operación
-- ============================================
CREATE TABLE IF NOT EXISTS token_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL, -- 'analysis', 'chat', 'generation'
  operation_subtype VARCHAR(100), -- 'pliego', 'contrato', 'oferta', 'vault_query', etc.
  ai_model VARCHAR(50) NOT NULL, -- 'gpt-5', 'gpt-5-mini', 'text-embedding-3-small'
  tokens_used INTEGER NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  source_type VARCHAR(50), -- 'library', 'external' (para chat)
  cost_usd DECIMAL(10, 6), -- Coste estimado en USD
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  analysis_id INTEGER REFERENCES analysis_results(id) ON DELETE SET NULL,
  vault_query_id INTEGER REFERENCES vault_queries(id) ON DELETE SET NULL,
  query_object TEXT, -- Descripción del objeto de la consulta
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para análisis rápidos
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_operation_type ON token_usage(operation_type);
CREATE INDEX IF NOT EXISTS idx_token_usage_ai_model ON token_usage(ai_model);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_project_id ON token_usage(project_id);

-- ============================================
-- VISTA: daily_token_usage
-- Agregación diaria de tokens por usuario y tipo
-- ============================================
CREATE OR REPLACE VIEW daily_token_usage AS
SELECT 
  DATE(created_at) as usage_date,
  user_id,
  operation_type,
  ai_model,
  COUNT(*) as operation_count,
  SUM(tokens_used) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(tokens_used) as avg_tokens_per_operation,
  AVG(duration_ms) as avg_duration_ms
FROM token_usage
GROUP BY DATE(created_at), user_id, operation_type, ai_model
ORDER BY usage_date DESC, total_tokens DESC;

-- ============================================
-- VISTA: user_token_summary
-- Resumen de uso por usuario
-- ============================================
CREATE OR REPLACE VIEW user_token_summary AS
SELECT 
  u.id as user_id,
  u.username,
  u.email,
  COUNT(tu.id) as total_operations,
  SUM(tu.tokens_used) as total_tokens,
  SUM(CASE WHEN tu.operation_type = 'analysis' THEN tu.tokens_used ELSE 0 END) as tokens_analysis,
  SUM(CASE WHEN tu.operation_type = 'chat' THEN tu.tokens_used ELSE 0 END) as tokens_chat,
  SUM(CASE WHEN tu.operation_type = 'generation' THEN tu.tokens_used ELSE 0 END) as tokens_generation,
  SUM(tu.cost_usd) as total_cost_usd,
  MAX(tu.created_at) as last_usage
FROM users u
LEFT JOIN token_usage tu ON u.id = tu.user_id
GROUP BY u.id, u.username, u.email;

-- ============================================
-- VISTA: model_usage_stats
-- Estadísticas por modelo de IA
-- ============================================
CREATE OR REPLACE VIEW model_usage_stats AS
SELECT 
  ai_model,
  operation_type,
  COUNT(*) as usage_count,
  SUM(tokens_used) as total_tokens,
  AVG(tokens_used) as avg_tokens,
  MIN(tokens_used) as min_tokens,
  MAX(tokens_used) as max_tokens,
  SUM(cost_usd) as total_cost,
  AVG(duration_ms) as avg_duration_ms
FROM token_usage
GROUP BY ai_model, operation_type
ORDER BY total_tokens DESC;

-- ============================================
-- FUNCIÓN: Registrar uso de tokens
-- ============================================
CREATE OR REPLACE FUNCTION log_token_usage(
  p_user_id INTEGER,
  p_operation_type VARCHAR,
  p_operation_subtype VARCHAR,
  p_ai_model VARCHAR,
  p_tokens_used INTEGER,
  p_tokens_input INTEGER DEFAULT NULL,
  p_tokens_output INTEGER DEFAULT NULL,
  p_source_type VARCHAR DEFAULT NULL,
  p_project_id INTEGER DEFAULT NULL,
  p_analysis_id INTEGER DEFAULT NULL,
  p_vault_query_id INTEGER DEFAULT NULL,
  p_query_object TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_cost_usd DECIMAL(10, 6);
  v_input_cost DECIMAL(10, 6);
  v_output_cost DECIMAL(10, 6);
  v_id INTEGER;
BEGIN
  -- Calcular coste REAL según precios de OpenAI (Noviembre 2025)
  -- Precios por millón de tokens convertidos a por 1K tokens
  
  IF p_tokens_input IS NOT NULL AND p_tokens_output IS NOT NULL THEN
    -- Cálculo separado por input/output (más preciso)
    CASE p_ai_model
      WHEN 'gpt-5' THEN
        -- Input: $1.25/M = $0.00125/1K, Output: $10.00/M = $0.01/1K
        v_input_cost := (p_tokens_input / 1000.0) * 0.00125;
        v_output_cost := (p_tokens_output / 1000.0) * 0.01;
      WHEN 'gpt-5-mini' THEN
        -- Input: $0.25/M = $0.00025/1K, Output: $2.00/M = $0.002/1K
        v_input_cost := (p_tokens_input / 1000.0) * 0.00025;
        v_output_cost := (p_tokens_output / 1000.0) * 0.002;
      WHEN 'text-embedding-3-small' THEN
        -- $0.02/M = $0.00002/1K (solo input)
        v_input_cost := (p_tokens_used / 1000.0) * 0.00002;
        v_output_cost := 0;
      ELSE
        -- Precio por defecto (gpt-5-mini)
        v_input_cost := (p_tokens_input / 1000.0) * 0.00025;
        v_output_cost := (p_tokens_output / 1000.0) * 0.002;
    END CASE;
    v_cost_usd := v_input_cost + v_output_cost;
  ELSE
    -- Si no hay separación, usar total con precio promedio
    v_cost_usd := CASE p_ai_model
      WHEN 'gpt-5' THEN (p_tokens_used / 1000.0) * 0.005625 -- Promedio aproximado
      WHEN 'gpt-5-mini' THEN (p_tokens_used / 1000.0) * 0.001125 -- Promedio aproximado
      WHEN 'text-embedding-3-small' THEN (p_tokens_used / 1000.0) * 0.00002
      ELSE (p_tokens_used / 1000.0) * 0.001125
    END;
  END IF;
  
  -- Insertar registro
  INSERT INTO token_usage (
    user_id, operation_type, operation_subtype, ai_model, 
    tokens_used, tokens_input, tokens_output, source_type, cost_usd,
    project_id, analysis_id, vault_query_id, query_object, duration_ms
  ) VALUES (
    p_user_id, p_operation_type, p_operation_subtype, p_ai_model,
    p_tokens_used, p_tokens_input, p_tokens_output, p_source_type, v_cost_usd,
    p_project_id, p_analysis_id, p_vault_query_id, p_query_object, p_duration_ms
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comentarios para documentación
-- ============================================
COMMENT ON TABLE token_usage IS 'Registro detallado de uso de tokens de IA por usuario y operación';
COMMENT ON COLUMN token_usage.operation_type IS 'Tipo de operación: analysis, chat, generation';
COMMENT ON COLUMN token_usage.operation_subtype IS 'Subtipo: pliego, contrato, oferta, vault_query, etc.';
COMMENT ON COLUMN token_usage.source_type IS 'Fuente para chat: library (RAG) o external (ChatGPT directo)';
COMMENT ON COLUMN token_usage.cost_usd IS 'Coste estimado en dólares según tarifas de OpenAI';

