-- ============================================
-- DILUS_AI - Seed Admin and Demo Users
-- ============================================

-- Usuario admin (password: admin123)
-- Hash generado con: bcrypt.hash('admin123', 10)
INSERT INTO users (username, email, password_hash, full_name, is_admin)
VALUES (
  'admin',
  'admin@dilusai.com',
  '$2b$10$llN5u160s5JvbNCn.QpP7.BWTjLawcxQSQMBDX6YXv3T8cYBVVA5u',
  'Administrador',
  TRUE
)
ON CONFLICT (username) DO NOTHING;

-- Usuario demo (password: demo123)
-- Hash generado con: bcrypt.hash('demo123', 10)
INSERT INTO users (username, email, password_hash, full_name, is_admin)
VALUES (
  'demo',
  'demo@dilusai.com',
  '$2b$10$poiLeBEFsLBxu67ByRDykeZKkaTAnUwDHqVTgugCbn4n5kQABxvuW',
  'Usuario Demo',
  FALSE
)
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- PRINT SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Admin and demo users created successfully!';
  RAISE NOTICE '   Admin: admin / admin123';
  RAISE NOTICE '   Demo: demo / demo123';
END $$;

