-- ============================================
-- DILUS_AI - RAG Configuration Management
-- ============================================

-- Tabla para almacenar configuración del RAG
CREATE TABLE IF NOT EXISTS rag_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  data_type VARCHAR(20) NOT NULL, -- 'integer', 'float', 'string'
  description TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

-- Insertar valores por defecto
INSERT INTO rag_config (config_key, config_value, data_type, description, min_value, max_value) VALUES
  ('chunk_size', '1000', 'integer', 'Tamaño del chunk en caracteres', 100, 5000),
  ('chunk_overlap', '200', 'integer', 'Overlap entre chunks en caracteres', 0, 1000),
  ('top_k', '5', 'integer', 'Número de chunks a recuperar', 1, 20),
  ('min_similarity', '0.3', 'float', 'Threshold mínimo de similitud vectorial', 0.0, 1.0),
  ('min_hybrid_score', '0.25', 'float', 'Threshold mínimo de score híbrido', 0.0, 1.0),
  ('chunking_method', 'fixed', 'string', 'Método de chunking: fixed, sentence, paragraph', NULL, NULL),
  ('vector_weight', '0.6', 'float', 'Peso del vector en score híbrido', 0.0, 1.0),
  ('bm25_weight', '0.4', 'float', 'Peso del BM25 en score híbrido', 0.0, 1.0)
ON CONFLICT (config_key) DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_rag_config_key ON rag_config(config_key);

-- Vista para configuración actual
CREATE OR REPLACE VIEW current_rag_config AS
SELECT 
  rc.config_key,
  rc.config_value,
  rc.data_type,
  rc.description,
  rc.min_value,
  rc.max_value,
  rc.updated_at,
  u.username as updated_by_username
FROM rag_config rc
LEFT JOIN users u ON rc.updated_by = u.id;

-- Función para obtener valor de configuración
CREATE OR REPLACE FUNCTION get_rag_config(key_name VARCHAR)
RETURNS TEXT AS $$
DECLARE
  config_val TEXT;
BEGIN
  SELECT config_value INTO config_val
  FROM rag_config
  WHERE config_key = key_name;
  
  RETURN config_val;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar valor de configuración
CREATE OR REPLACE FUNCTION update_rag_config(
  key_name VARCHAR,
  new_value TEXT,
  user_id INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE rag_config
  SET config_value = new_value,
      updated_at = NOW(),
      updated_by = user_id
  WHERE config_key = key_name;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Tabla de historial de cambios
CREATE TABLE IF NOT EXISTS rag_config_history (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  change_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_rag_config_history_key ON rag_config_history(config_key);
CREATE INDEX IF NOT EXISTS idx_rag_config_history_date ON rag_config_history(changed_at DESC);

-- Trigger para registrar cambios
CREATE OR REPLACE FUNCTION log_rag_config_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO rag_config_history (config_key, old_value, new_value, changed_by)
  VALUES (NEW.config_key, OLD.config_value, NEW.config_value, NEW.updated_by);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rag_config_change_trigger ON rag_config;
CREATE TRIGGER rag_config_change_trigger
  AFTER UPDATE ON rag_config
  FOR EACH ROW
  WHEN (OLD.config_value IS DISTINCT FROM NEW.config_value)
  EXECUTE FUNCTION log_rag_config_change();

-- ============================================
-- PRINT SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ RAG configuration tables and functions created successfully!';
END $$;

