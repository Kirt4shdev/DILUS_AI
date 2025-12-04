-- ============================================
-- DILUS_AI - Add client field to projects
-- ============================================

-- Añadir columna 'client' a la tabla projects
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS client VARCHAR(255);

-- Crear índice para búsquedas por cliente
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client);

-- Mensaje de éxito
DO $$
BEGIN
  RAISE NOTICE '✅ Client field added to projects table successfully!';
END $$;

