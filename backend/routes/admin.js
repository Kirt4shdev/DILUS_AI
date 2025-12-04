import express from 'express';
import multer from 'multer';
import { query } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { uploadFile, deleteFile, getFile } from '../services/minioService.js';
import { extractText } from '../services/documentService.js';
import { ingestDocument } from '../services/ragService.js';
import { validateFileType } from '../utils/validators.js';
import { logger } from '../utils/logger.js';
import { getRagConfig, updateRagConfig, getConfigHistory, resetToDefaults } from '../services/ragConfigService.js';

const router = express.Router();

// Configurar multer
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

// Todas las rutas requieren autenticación y rol admin
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * POST /api/admin/vault/documents
 * Subir documento a la bóveda
 */
router.post('/vault/documents', upload.single('file'), handleMulterError, async (req, res, next) => {
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

    // Verificar si ya existe un documento con el mismo nombre en la bóveda
    const duplicateCheck = await query(
      'SELECT id, filename FROM documents WHERE filename = $1 AND is_vault_document = TRUE',
      [file.originalname]
    );

    if (duplicateCheck.rows.length > 0) {
      logger.warn('Duplicate vault document rejected', { 
        filename: file.originalname,
        existingDocId: duplicateCheck.rows[0].id,
        adminId: req.user.id
      });
      return res.status(409).json({ 
        error: `El documento "${file.originalname}" ya existe en el Codex Dilus. Por favor, elimine el documento existente primero o renombre el archivo.`,
        existingDocumentId: duplicateCheck.rows[0].id
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
    logger.error('Error uploading vault document', {
      filename: req.file?.originalname,
      error: error.message,
      stack: error.stack
    });
    
    // Proporcionar mensajes de error más descriptivos
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'El archivo es demasiado grande. El tamaño máximo es 200 MB.' 
      });
    }
    
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
 * POST /api/admin/vault/documents/:id/retry
 * Reintentar vectorización de un documento fallido o pendiente
 */
router.post('/vault/documents/:id/retry', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que el documento existe y es de la bóveda
    const result = await query(
      'SELECT * FROM documents WHERE id = $1 AND is_vault_document = TRUE',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento de bóveda no encontrado' });
    }

    const document = result.rows[0];

    // Solo permitir reintentar si está en failed o pending
    if (!['failed', 'pending'].includes(document.vectorization_status)) {
      return res.status(400).json({ 
        error: `No se puede reintentar un documento en estado "${document.vectorization_status}". Solo se pueden reintentar documentos fallidos o pendientes.`
      });
    }

    // Descargar el archivo de MinIO
    const fileBuffer = await getFile(document.file_path);

    // Marcar como processing
    await query(
      'UPDATE documents SET vectorization_status = $1, vectorization_error = NULL WHERE id = $2',
      ['processing', id]
    );

    logger.info('Retrying vault document vectorization', { 
      documentId: id,
      filename: document.filename,
      previousStatus: document.vectorization_status,
      adminId: req.user.id
    });

    // Iniciar vectorización en background
    processVaultDocumentVectorization(id, fileBuffer, document.mime_type).catch(error => {
      logger.error('Retry vectorization failed', { 
        documentId: id, 
        error: error.message 
      });
    });

    return res.json({
      message: 'Reintentando vectorización del documento...',
      documentId: id,
      filename: document.filename
    });
  } catch (error) {
    logger.error('Error retrying document vectorization', {
      documentId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

/**
 * PUT /api/admin/vault/documents/:id/metadata
 * Actualizar metadata de un documento de la bóveda
 */
router.put('/vault/documents/:id/metadata', async (req, res, next) => {
  try {
    const { id } = req.params;
    const metadata = req.body;

    logger.info('Update vault document metadata request', { 
      documentId: id, 
      adminId: req.user.id,
      metadata
    });

    // Verificar que el documento existe y es de la bóveda
    const result = await query(
      'SELECT * FROM documents WHERE id = $1 AND is_vault_document = TRUE',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento de bóveda no encontrado' });
    }

    // Construir la actualización de metadata para los chunks
    const metadataUpdates = {};
    const allowedFields = [
      'equipment_type', 'manufacturer', 'model', 'protocol', 
      'document_type', 'tags', 'equipo', 'fabricante'
    ];

    allowedFields.forEach(field => {
      if (metadata[field] !== undefined && metadata[field] !== null && metadata[field] !== '') {
        metadataUpdates[field] = metadata[field];
      }
    });

    if (Object.keys(metadataUpdates).length === 0) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    // Actualizar los chunks del documento
    const chunks = await query(
      'SELECT id, metadata FROM embeddings WHERE document_id = $1',
      [id]
    );

    let updatedCount = 0;
    for (const chunk of chunks.rows) {
      const currentMetadata = chunk.metadata || {};
      const newMetadata = { ...currentMetadata, ...metadataUpdates };
      
      await query(
        'UPDATE embeddings SET metadata = $1 WHERE id = $2',
        [JSON.stringify(newMetadata), chunk.id]
      );
      updatedCount++;
    }

    logger.info('Vault document metadata updated', { 
      documentId: id, 
      adminId: req.user.id,
      chunksUpdated: updatedCount
    });

    return res.json({
      message: 'Metadata actualizado exitosamente',
      documentId: id,
      chunksUpdated: updatedCount,
      metadata: metadataUpdates
    });
  } catch (error) {
    logger.error('Error updating vault document metadata', { 
      documentId: req.params.id,
      error: error.message,
      stack: error.stack
    });
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

    // Eliminar todos los registros relacionados en orden (por foreign keys)
    // 1. Chunk selection history
    await query('DELETE FROM chunk_selection_history WHERE document_id = $1', [id]);
    
    // 2. Embedding costs
    await query('DELETE FROM embedding_costs WHERE document_id = $1', [id]);
    
    // 3. Embeddings
    await query('DELETE FROM embeddings WHERE document_id = $1', [id]);
    
    // 4. Finalmente, el documento
    await query('DELETE FROM documents WHERE id = $1', [id]);

    logger.info('Vault document deleted with all related data', { documentId: id, adminId: req.user.id });

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
 * GET /api/admin/chunks/history
 * Obtener historial de chunks seleccionados
 */
router.get('/chunks/history', async (req, res, next) => {
  try {
    const { 
      limit = 100, 
      offset = 0,
      operation_type,
      operation_subtype,
      was_selected,
      min_similarity,
      document_id 
    } = req.query;

    let sql = `
      SELECT 
        csh.*,
        u.username,
        p.name as project_name
      FROM chunk_selection_history csh
      LEFT JOIN users u ON csh.user_id = u.id
      LEFT JOIN projects p ON csh.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (operation_type) {
      sql += ` AND csh.operation_type = $${paramIndex++}`;
      params.push(operation_type);
    }

    if (operation_subtype) {
      sql += ` AND csh.operation_subtype = $${paramIndex++}`;
      params.push(operation_subtype);
    }

    if (was_selected !== undefined) {
      sql += ` AND csh.was_selected = $${paramIndex++}`;
      params.push(was_selected === 'true');
    }

    if (min_similarity) {
      sql += ` AND csh.vector_similarity >= $${paramIndex++}`;
      params.push(parseFloat(min_similarity));
    }

    if (document_id) {
      sql += ` AND csh.document_id = $${paramIndex++}`;
      params.push(parseInt(document_id));
    }

    sql += ` ORDER BY csh.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    // Obtener total count
    let countSql = 'SELECT COUNT(*) as total FROM chunk_selection_history WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (operation_type) {
      countSql += ` AND operation_type = $${countParamIndex++}`;
      countParams.push(operation_type);
    }

    if (operation_subtype) {
      countSql += ` AND operation_subtype = $${countParamIndex++}`;
      countParams.push(operation_subtype);
    }

    if (was_selected !== undefined) {
      countSql += ` AND was_selected = $${countParamIndex++}`;
      countParams.push(was_selected === 'true');
    }

    if (min_similarity) {
      countSql += ` AND vector_similarity >= $${countParamIndex++}`;
      countParams.push(parseFloat(min_similarity));
    }

    if (document_id) {
      countSql += ` AND document_id = $${countParamIndex++}`;
      countParams.push(parseInt(document_id));
    }

    const countResult = await query(countSql, countParams);

    logger.info('Chunk history retrieved', { 
      adminId: req.user.id, 
      results: result.rows.length,
      total: countResult.rows[0].total 
    });

    return res.json({
      chunks: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/chunks/stats
 * Obtener estadísticas de chunks seleccionados
 */
router.get('/chunks/stats', async (req, res, next) => {
  try {
    // Estadísticas generales
    const statsResult = await query('SELECT * FROM chunk_selection_stats');
    
    // Uso por documento
    const docUsageResult = await query('SELECT * FROM chunk_usage_by_document LIMIT 20');
    
    // Distribución de scores
    const scoresResult = await query(`
      SELECT 
        ROUND(vector_similarity::numeric, 1) as similarity_bucket,
        ROUND(hybrid_score::numeric, 1) as hybrid_bucket,
        COUNT(*) as count
      FROM chunk_selection_history
      WHERE was_selected = TRUE
      GROUP BY similarity_bucket, hybrid_bucket
      ORDER BY similarity_bucket DESC, hybrid_bucket DESC
      LIMIT 50
    `);

    // Thresholds actuales vs histórico
    const thresholdsResult = await query(`
      SELECT 
        min_similarity_threshold,
        min_hybrid_threshold,
        COUNT(*) as uses,
        COUNT(*) FILTER (WHERE was_selected = TRUE) as selected,
        COUNT(*) FILTER (WHERE was_selected = FALSE) as rejected,
        MIN(created_at) as first_used,
        MAX(created_at) as last_used
      FROM chunk_selection_history
      GROUP BY min_similarity_threshold, min_hybrid_threshold
      ORDER BY last_used DESC
    `);

    logger.info('Chunk stats retrieved', { adminId: req.user.id });

    return res.json({
      overview: statsResult.rows,
      document_usage: docUsageResult.rows,
      score_distribution: scoresResult.rows,
      threshold_history: thresholdsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Procesar vectorización de documento de bóveda en background
 */
async function processVaultDocumentVectorization(documentId, buffer, mimetype) {
  const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos timeout
  
  // Crear promesa con timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Timeout: El procesamiento del documento ${documentId} excedió los 15 minutos`));
    }, TIMEOUT_MS);
  });

  const processingPromise = (async () => {
    try {
      logger.info('Starting vault document vectorization', { 
        documentId, 
        bufferSize: buffer?.length || 0,
        mimetype 
      });

      // Extraer texto
      logger.info('Extracting text from buffer', { documentId, mimetype });
      const text = await extractText(buffer, mimetype);
      
      logger.info('Text extracted successfully', { 
        documentId, 
        textLength: text?.length || 0,
        textPreview: text?.substring(0, 200) || 'EMPTY'
      });

      // Ingerir en RAG
      logger.info('Starting RAG ingestion', { documentId });
      await ingestDocument(documentId, text, {
        mimetype,
        source: 'vault',
        uploaded_by_admin: true
      });

      logger.info('Vault document vectorized successfully', { documentId });
    } catch (error) {
      logger.error('Vault document vectorization failed', { 
        documentId, 
        error: error.message,
        errorStack: error.stack,
        errorType: error.constructor.name
      });
      
      // Actualizar estado a failed
      try {
        await query(
          'UPDATE documents SET vectorization_status = $1, vectorization_error = $2 WHERE id = $3',
          ['failed', error.message, documentId]
        );
      } catch (updateError) {
        logger.error('Failed to update document status', { documentId, updateError: updateError.message });
      }
      
      throw error;
    }
  })();

  try {
    // Esperar la primera que complete (procesamiento o timeout)
    await Promise.race([processingPromise, timeoutPromise]);
  } catch (error) {
    // Si es timeout, marcar como failed
    if (error.message.includes('Timeout')) {
      logger.error('Document vectorization timed out', { documentId, timeout: TIMEOUT_MS });
      try {
        await query(
          'UPDATE documents SET vectorization_status = $1, vectorization_error = $2 WHERE id = $3',
          ['failed', error.message, documentId]
        );
      } catch (updateError) {
        logger.error('Failed to update document status after timeout', { documentId, updateError: updateError.message });
      }
    }
    throw error;
  }
}

// ============================================
// EMBEDDING COSTS
// ============================================

/**
 * GET /api/admin/embedding-costs/overview
 * Obtener resumen de costes de embeddings
 */
router.get('/embedding-costs/overview', async (req, res, next) => {
  try {
    logger.info('Fetching embedding costs overview');

    // Costes totales
    const totalResult = await query(`
      SELECT * FROM get_total_embedding_costs()
    `);

    // Costes por tipo de operación
    const byOperationResult = await query(`
      SELECT * FROM embedding_cost_stats ORDER BY total_cost_usd DESC
    `);

    // Costes por usuario (top 10)
    const byUserResult = await query(`
      SELECT * FROM embedding_cost_by_user 
      WHERE total_operations > 0
      ORDER BY total_cost_usd DESC 
      LIMIT 10
    `);

    // Costes por documento (top 10)
    const byDocumentResult = await query(`
      SELECT * FROM embedding_cost_by_document 
      WHERE total_operations > 0
      ORDER BY total_cost_usd DESC 
      LIMIT 10
    `);

    // Tendencia últimos 7 días
    const trendResult = await query(`
      SELECT 
        DATE(created_at) as date,
        operation_type,
        SUM(tokens_used) as tokens,
        SUM(cost_usd) as cost
      FROM embedding_costs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at), operation_type
      ORDER BY date DESC, operation_type
    `);

    return res.json({
      total: totalResult.rows[0] || { total_operations: 0, total_tokens: 0, total_cost_usd: 0 },
      byOperation: byOperationResult.rows,
      byUser: byUserResult.rows,
      byDocument: byDocumentResult.rows,
      trend: trendResult.rows
    });
  } catch (error) {
    logger.error('Error fetching embedding costs', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/admin/embedding-costs/details
 * Obtener historial detallado de costes de embeddings
 */
router.get('/embedding-costs/details', async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      operation_type, 
      user_id,
      start_date,
      end_date
    } = req.query;

    const offset = (page - 1) * limit;
    const filters = [];
    const params = [];
    let paramIndex = 1;

    if (operation_type) {
      filters.push(`operation_type = $${paramIndex++}`);
      params.push(operation_type);
    }

    if (user_id) {
      filters.push(`user_id = $${paramIndex++}`);
      params.push(user_id);
    }

    if (start_date) {
      filters.push(`created_at >= $${paramIndex++}`);
      params.push(start_date);
    }

    if (end_date) {
      filters.push(`created_at <= $${paramIndex++}`);
      params.push(end_date);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM embedding_costs ${whereClause}`,
      params
    );

    // Get paginated results
    const results = await query(
      `SELECT 
        ec.*,
        u.username,
        d.filename
      FROM embedding_costs ec
      LEFT JOIN users u ON ec.user_id = u.id
      LEFT JOIN documents d ON ec.document_id = d.id
      ${whereClause}
      ORDER BY ec.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return res.json({
      costs: results.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    logger.error('Error fetching embedding costs details', { error: error.message });
    next(error);
  }
});

// ============================================
// RAG CONFIGURATION
// ============================================

/**
 * GET /api/admin/rag-config
 * Obtener configuración actual del RAG
 */
router.get('/rag-config', async (req, res, next) => {
  try {
    logger.info('Fetching RAG configuration');
    
    const config = await getRagConfig();
    
    return res.json({ config });
  } catch (error) {
    logger.error('Error fetching RAG config', { error: error.message });
    next(error);
  }
});

/**
 * PUT /api/admin/rag-config
 * Actualizar configuración del RAG
 */
router.put('/rag-config', async (req, res, next) => {
  try {
    const { updates } = req.body;
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Updates object required' });
    }

    logger.info('Updating RAG configuration', { updates, userId: req.user.id });
    
    const results = await updateRagConfig(updates, req.user.id);
    
    return res.json({ 
      message: 'Configuration updated',
      results 
    });
  } catch (error) {
    logger.error('Error updating RAG config', { error: error.message });
    next(error);
  }
});

/**
 * GET /api/admin/rag-config/history
 * Obtener historial de cambios de configuración
 */
router.get('/rag-config/history', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    
    logger.info('Fetching RAG config history');
    
    const history = await getConfigHistory(parseInt(limit));
    
    return res.json({ history });
  } catch (error) {
    logger.error('Error fetching RAG config history', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/admin/rag-config/reset
 * Resetear configuración a valores por defecto
 */
router.post('/rag-config/reset', async (req, res, next) => {
  try {
    logger.info('Resetting RAG configuration to defaults', { userId: req.user.id });
    
    const results = await resetToDefaults(req.user.id);
    
    return res.json({ 
      message: 'Configuration reset to defaults',
      results 
    });
  } catch (error) {
    logger.error('Error resetting RAG config', { error: error.message });
    next(error);
  }
});

export default router;

