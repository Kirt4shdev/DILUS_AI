import express from 'express';
import multer from 'multer';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadFile, getFile, deleteFile } from '../services/minioService.js';
import { extractText } from '../services/documentService.js';
import { ingestDocument } from '../services/ragService.js';
import { validateFileType } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Configurar multer para upload en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB
  }
});

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * POST /api/projects/:projectId/documents
 * Subir documento a un proyecto
 */
router.post('/projects/:projectId/documents', upload.single('file'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
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

    // Verificar que el proyecto existe y pertenece al usuario
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Subir a MinIO
    const filePath = await uploadFile(
      file.originalname,
      file.buffer,
      file.mimetype,
      { userId: req.user.id.toString(), projectId: projectId.toString() }
    );

    // Guardar en base de datos
    const docResult = await query(
      `INSERT INTO documents (project_id, uploaded_by, filename, file_path, file_size, mime_type, is_vault_document, vectorization_status)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, 'pending')
       RETURNING *`,
      [projectId, req.user.id, file.originalname, filePath, file.size, file.mimetype]
    );

    const document = docResult.rows[0];

    logger.info('Document uploaded', { 
      documentId: document.id,
      projectId,
      filename: file.originalname 
    });

    // Iniciar vectorización en background
    processDocumentVectorization(document.id, file.buffer, file.mimetype).catch(error => {
      logger.error('Background vectorization failed', { 
        documentId: document.id, 
        error: error.message 
      });
    });

    res.status(201).json({
      message: 'Documento subido exitosamente. Procesando vectorización...',
      document
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/documents
 * Listar documentos de un proyecto
 */
router.get('/projects/:projectId/documents', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Verificar propiedad del proyecto
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Obtener documentos
    const result = await query(
      'SELECT * FROM documents WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );

    res.json({
      documents: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:id
 * Obtener información de un documento
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT d.*, p.user_id 
       FROM documents d
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const document = result.rows[0];

    // Verificar permisos
    if (document.user_id !== req.user.id && !document.is_vault_document) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    res.json({ document });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:id/download
 * Descargar documento
 */
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT d.*, p.user_id 
       FROM documents d
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const document = result.rows[0];

    // Verificar permisos
    if (document.user_id !== req.user.id && !document.is_vault_document && !req.user.is_admin) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Obtener archivo de MinIO
    const fileBuffer = await getFile(document.file_path);

    res.set({
      'Content-Type': document.mime_type,
      'Content-Disposition': `attachment; filename="${document.filename}"`,
      'Content-Length': fileBuffer.length
    });

    res.send(fileBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/documents/:id
 * Eliminar documento
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT d.*, p.user_id 
       FROM documents d
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const document = result.rows[0];

    // Verificar permisos
    if (document.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Eliminar de MinIO
    await deleteFile(document.file_path);

    // Eliminar de base de datos (CASCADE eliminará embeddings)
    await query('DELETE FROM documents WHERE id = $1', [id]);

    logger.info('Document deleted', { documentId: id, userId: req.user.id });

    res.json({ message: 'Documento eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
});

/**
 * Procesar vectorización de documento en background
 */
async function processDocumentVectorization(documentId, buffer, mimetype) {
  try {
    // Extraer texto
    const text = await extractText(buffer, mimetype);

    // Ingerir en RAG
    await ingestDocument(documentId, text, {
      mimetype,
      source: 'user_upload'
    });

    logger.info('Document vectorized successfully', { documentId });
  } catch (error) {
    logger.error('Document vectorization failed', { 
      documentId, 
      error: error.message 
    });
    throw error;
  }
}

export default router;

