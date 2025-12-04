-- ============================================
-- DILUS_AI - Fix Embedding Costs Foreign Key
-- ============================================

-- Drop existing foreign key constraint if exists
ALTER TABLE embedding_costs 
DROP CONSTRAINT IF EXISTS embedding_costs_project_id_fkey;

-- Add foreign key constraint with ON DELETE CASCADE
ALTER TABLE embedding_costs 
ADD CONSTRAINT embedding_costs_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES projects(id) 
ON DELETE CASCADE;

-- Also fix document_id foreign key to ensure cascade
ALTER TABLE embedding_costs 
DROP CONSTRAINT IF EXISTS embedding_costs_document_id_fkey;

ALTER TABLE embedding_costs 
ADD CONSTRAINT embedding_costs_document_id_fkey 
FOREIGN KEY (document_id) 
REFERENCES documents(id) 
ON DELETE CASCADE;

-- Also fix user_id foreign key to ensure cascade
ALTER TABLE embedding_costs 
DROP CONSTRAINT IF EXISTS embedding_costs_user_id_fkey;

ALTER TABLE embedding_costs 
ADD CONSTRAINT embedding_costs_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- ============================================
-- PRINT SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Embedding costs foreign key constraints fixed with CASCADE!';
END $$;

