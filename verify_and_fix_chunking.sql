-- ============================================
-- VERIFICAR Y CONFIGURAR CHUNKING POR PÁRRAFOS
-- ============================================

-- 1. Ver configuración actual
SELECT 
  config_key,
  config_value,
  data_type,
  description,
  updated_at
FROM rag_config
WHERE config_key IN ('chunk_size', 'chunk_overlap', 'chunking_method')
ORDER BY config_key;

-- 2. Verificar si chunking_method existe
SELECT COUNT(*) as existe_chunking_method
FROM rag_config
WHERE config_key = 'chunking_method';

-- 3. Si no existe, insertarlo
INSERT INTO rag_config (config_key, config_value, data_type, description, min_value, max_value)
VALUES ('chunking_method', 'paragraph', 'string', 'Método de chunking: fixed, sentence, paragraph', NULL, NULL)
ON CONFLICT (config_key) DO NOTHING;

-- 4. Actualizar a paragraph si quieres usar chunking por párrafos
UPDATE rag_config
SET config_value = 'paragraph'
WHERE config_key = 'chunking_method';

-- 5. Actualizar chunk_size y overlap (opcional, ajusta según necesites)
UPDATE rag_config
SET config_value = '1000'
WHERE config_key = 'chunk_size';

UPDATE rag_config
SET config_value = '200'
WHERE config_key = 'chunk_overlap';

-- 6. Verificar configuración final
SELECT 
  config_key,
  config_value,
  data_type,
  description,
  updated_at
FROM rag_config
WHERE config_key IN ('chunk_size', 'chunk_overlap', 'chunking_method')
ORDER BY config_key;

-- 7. Ver historial de cambios
SELECT 
  config_key,
  old_value,
  new_value,
  changed_at
FROM rag_config_history
ORDER BY changed_at DESC
LIMIT 5;

