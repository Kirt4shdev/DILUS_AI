import express from 'express';
import multer from 'multer';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadFile, getFile, deleteFile } from '../services/minioService.js';
import { extractText } from '../services/documentService.js';
import { ingestDocument } from '../services/ragService.js';
import { validateFileType } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { getDocumentMetadata, updateDocumentMetadata } from '../services/metadataService.js';

const router = express.Router();

// Configurar multer para upload en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024 // 200 MB
  }
});

// Middleware para manejar errores de multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'El archivo es demasiado grande. El tamaño máximo permitido es 200 MB.' 
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Demasiados archivos. Suba un archivo a la vez.' 
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Campo de archivo inesperado.' 
      });
    }
    return res.status(400).json({ 
      error: `Error al subir archivo: ${err.message}` 
    });
  }
  next(err);
};

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * POST /api/projects/:projectId/documents
 * Subir documento a un proyecto
 */
router.post('/projects/:projectId/documents', upload.single('file'), handleMulterError, async (req, res, next) => {
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

    // Verificar si ya existe un documento con el mismo nombre en este proyecto
    const duplicateCheck = await query(
      'SELECT id, filename FROM documents WHERE filename = $1 AND project_id = $2',
      [file.originalname, projectId]
    );

    if (duplicateCheck.rows.length > 0) {
      logger.warn('Duplicate document rejected', { 
        filename: file.originalname,
        projectId,
        existingDocId: duplicateCheck.rows[0].id,
        userId: req.user.id
      });
      return res.status(409).json({ 
        error: `El documento "${file.originalname}" ya existe en este proyecto. Por favor, elimine el documento existente primero o renombre el archivo.`,
        existingDocumentId: duplicateCheck.rows[0].id
      });
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

    return res.status(201).json({
      message: 'Documento subido exitosamente. Procesando vectorización...',
      document
    });
  } catch (error) {
    logger.error('Error uploading document', {
      projectId: req.params.projectId,
      filename: req.file?.originalname,
      error: error.message,
      stack: error.stack
    });
    
    // Proporcionar mensajes de error más descriptivos
    if (error.message && error.message.includes('MinIO')) {
      return res.status(500).json({ 
        error: 'Error al guardar el archivo en el almacenamiento. Por favor, intente nuevamente.' 
      });
    }
    
    if (error.message && error.message.includes('text extraction')) {
      return res.status(422).json({ 
        error: 'No se pudo extraer el texto del documento. Verifique que el archivo no esté corrupto o protegido.' 
      });
    }
    
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

    return res.json({
      documents: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:id/metadata
 * Obtener metadata de un documento
 */
router.get('/documents/:id/metadata', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que el documento existe y el usuario tiene acceso
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

    // Obtener metadata del documento
    const metadata = await getDocumentMetadata(id);

    return res.json({ 
      documentId: id,
      metadata: metadata || {
        doc_type: 'otro',
        source: 'externo',
        creation_origin: 'humano',
        project_id: document.project_id,
        equipo: null,
        fabricante: null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/documents/:id/metadata
 * Actualizar metadata de un documento
 */
router.put('/documents/:id/metadata', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { doc_type, source, creation_origin, project_id, equipo, fabricante } = req.body;

    logger.info('Update metadata request', { 
      documentId: id, 
      userId: req.user.id,
      metadata: req.body
    });

    // Verificar que el documento existe y el usuario tiene acceso
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

    // Verificar permisos (solo el dueño o admin)
    if (document.user_id !== req.user.id && !req.user.is_admin) {
      logger.warn('Access denied for metadata update', { 
        documentId: id, 
        userId: req.user.id,
        documentOwnerId: document.user_id 
      });
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Actualizar metadata
    const updateResult = await updateDocumentMetadata(id, {
      doc_type,
      source,
      creation_origin,
      project_id,
      equipo,
      fabricante
    });

    logger.info('Document metadata updated', { 
      documentId: id, 
      userId: req.user.id,
      chunksUpdated: updateResult.chunksUpdated
    });

    return res.json({
      message: 'Metadata actualizado exitosamente',
      documentId: id,
      chunksUpdated: updateResult.chunksUpdated,
      metadata: updateResult.metadata
    });
  } catch (error) {
    logger.error('Error updating document metadata', { 
      documentId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * GET /api/documents/:id
 * Obtener información de un documento
 */
router.get('/documents/:id', async (req, res, next) => {
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

    return res.json({ document });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:id/download
 * Descargar documento
 */
router.get('/documents/:id/download', async (req, res, next) => {
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

    return res.send(fileBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/documents/:id
 * Eliminar documento
 */
router.delete('/documents/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.debug('Delete document request', { documentId: id, userId: req.user.id });

    const result = await query(
      `SELECT d.*, p.user_id 
       FROM documents d
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      logger.warn('Document not found for deletion', { documentId: id });
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const document = result.rows[0];

    // Verificar permisos
    if (document.user_id !== req.user.id && !req.user.is_admin) {
      logger.warn('Access denied for document deletion', { 
        documentId: id, 
        userId: req.user.id,
        documentOwnerId: document.user_id 
      });
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    logger.debug('Deleting file from MinIO', { 
      documentId: id, 
      filePath: document.file_path 
    });

    // Eliminar de MinIO
    try {
      await deleteFile(document.file_path);
      logger.debug('File deleted from MinIO successfully', { documentId: id });
    } catch (minioError) {
      logger.error('MinIO deletion failed but continuing with DB deletion', { 
        documentId: id, 
        error: minioError.message 
      });
      // Continuar incluso si MinIO falla (el archivo puede no existir)
    }

    // Eliminar de base de datos (CASCADE eliminará embeddings)
    await query('DELETE FROM documents WHERE id = $1', [id]);

    logger.info('Document deleted', { documentId: id, userId: req.user.id });

    return res.json({ message: 'Documento eliminado exitosamente' });
  } catch (error) {
    logger.error('Error in delete document endpoint', { 
      documentId: req.params.id,
      error: error.message,
      stack: error.stack
    });
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

