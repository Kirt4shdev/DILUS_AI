import express from 'express';
import multer from 'multer';
import { query } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { uploadFile, deleteFile } from '../services/minioService.js';
import { extractText } from '../services/documentService.js';
import { ingestDocument } from '../services/ragService.js';
import { validateFileType } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Configurar multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB
  }
});

// Todas las rutas requieren autenticación y rol admin
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/vault/documents
 * Subir documento a la bóveda
 */
router.post('/vault/documents', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó archivo' });
    }

    // Validar tipo de archivo
    if (!validateFileType(file.mimetype)) {
      return res.status(400).json({ 
        error: 'Tipo de archivo no soportado. Use PDF, DOCX o TXT' 
      });
    }

    // Subir a MinIO
    const filePath = await uploadFile(
      file.originalname,
      file.buffer,
      file.mimetype,
      { 
        userId: req.user.id.toString(), 
        isVault: 'true',
        uploadedByAdmin: 'true'
      }
    );

    // Guardar en base de datos
    const docResult = await query(
      `INSERT INTO documents (project_id, uploaded_by, filename, file_path, file_size, mime_type, is_vault_document, vectorization_status)
       VALUES (NULL, $1, $2, $3, $4, $5, TRUE, 'pending')
       RETURNING *`,
      [req.user.id, file.originalname, filePath, file.size, file.mimetype]
    );

    const document = docResult.rows[0];

    logger.info('Vault document uploaded', { 
      documentId: document.id,
      filename: file.originalname,
      adminId: req.user.id
    });

    // Iniciar vectorización en background
    processVaultDocumentVectorization(document.id, file.buffer, file.mimetype).catch(error => {
      logger.error('Background vectorization failed', { 
        documentId: document.id, 
        error: error.message 
      });
    });

    return res.status(201).json({
      message: 'Documento subido a la bóveda exitosamente. Procesando vectorización...',
      document
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/vault/documents
 * Listar documentos de la bóveda
 */
router.get('/vault/documents', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM documents WHERE is_vault_document = TRUE ORDER BY created_at DESC'
    );

    return res.json({
      documents: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/vault/documents/:id
 * Eliminar documento de la bóveda
 */
router.delete('/vault/documents/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM documents WHERE id = $1 AND is_vault_document = TRUE',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento de bóveda no encontrado' });
    }

    const document = result.rows[0];

    // Eliminar de MinIO
    await deleteFile(document.file_path);

    // Eliminar de base de datos
    await query('DELETE FROM documents WHERE id = $1', [id]);

    logger.info('Vault document deleted', { documentId: id, adminId: req.user.id });

    return res.json({ message: 'Documento de bóveda eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/users
 * Listar usuarios
 */
router.get('/users', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, username, email, full_name, avatar_url, is_active, is_admin, created_at, last_login_at
       FROM users
       ORDER BY created_at DESC`
    );

    return res.json({
      users: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/users/:id
 * Actualizar usuario
 */
router.put('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active, is_admin } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (typeof is_active === 'boolean') {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (typeof is_admin === 'boolean') {
      updates.push(`is_admin = $${paramIndex++}`);
      params.push(is_admin);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, username, email, full_name, is_active, is_admin`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    logger.info('User updated', { userId: id, adminId: req.user.id });

    return res.json({
      message: 'Usuario actualizado exitosamente',
      user: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/stats
 * Estadísticas del sistema
 */
router.get('/stats', async (req, res, next) => {
  try {
    // Total usuarios
    const usersResult = await query('SELECT COUNT(*) as total FROM users');
    
    // Total proyectos
    const projectsResult = await query('SELECT COUNT(*) as total FROM projects');
    
    // Total documentos
    const docsResult = await query('SELECT COUNT(*) as total FROM documents');
    
    // Documentos de bóveda
    const vaultDocsResult = await query('SELECT COUNT(*) as total FROM documents WHERE is_vault_document = TRUE');
    
    // Total embeddings
    const embeddingsResult = await query('SELECT COUNT(*) as total FROM embeddings');
    
    // Total análisis
    const analysisResult = await query('SELECT COUNT(*) as total FROM analysis_results');
    
    // Consultas a bóveda (últimos 30 días)
    const vaultQueriesResult = await query(
      `SELECT COUNT(*) as total FROM vault_queries WHERE created_at > NOW() - INTERVAL '30 days'`
    );

    // Tokens usados en análisis (últimos 30 días)
    const tokensResult = await query(
      `SELECT SUM(tokens_used) as total FROM analysis_results WHERE created_at > NOW() - INTERVAL '30 days'`
    );

    // Uso por modelo de IA
    const modelUsageResult = await query(
      `SELECT ai_model_used, COUNT(*) as count, SUM(tokens_used) as tokens
       FROM analysis_results
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY ai_model_used`
    );

    return res.json({
      users: {
        total: parseInt(usersResult.rows[0].total)
      },
      projects: {
        total: parseInt(projectsResult.rows[0].total)
      },
      documents: {
        total: parseInt(docsResult.rows[0].total),
        vault: parseInt(vaultDocsResult.rows[0].total)
      },
      embeddings: {
        total: parseInt(embeddingsResult.rows[0].total)
      },
      analysis: {
        total: parseInt(analysisResult.rows[0].total),
        last_30_days: parseInt(analysisResult.rows[0].total) // Simplificado
      },
      vault_queries: {
        last_30_days: parseInt(vaultQueriesResult.rows[0].total)
      },
      ai_usage: {
        tokens_last_30_days: parseInt(tokensResult.rows[0].total) || 0,
        by_model: modelUsageResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Procesar vectorización de documento de bóveda en background
 */
async function processVaultDocumentVectorization(documentId, buffer, mimetype) {
  try {
    // Extraer texto
    const text = await extractText(buffer, mimetype);

    // Ingerir en RAG
    await ingestDocument(documentId, text, {
      mimetype,
      source: 'vault',
      uploaded_by_admin: true
    });

    logger.info('Vault document vectorized successfully', { documentId });
  } catch (error) {
    logger.error('Vault document vectorization failed', { 
      documentId, 
      error: error.message 
    });
    throw error;
  }
}

export default router;

