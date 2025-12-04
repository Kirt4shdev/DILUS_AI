import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { getFile, uploadFile } from '../services/minioService.js';
import { extractText } from '../services/documentService.js';
import { searchInDocument, logChunkSelection } from '../services/ragService.js';
import { generateWithGPT5Mini, generateWithGPT5Standard, canFitInContext, canFitInStandardContext, parseAIResponse, estimateTokens } from '../services/aiService.js';
import { getSinglePromptForCategory, fillPrompt } from '../services/promptService.js';
import { generateOferta, generateDocumentacion } from '../services/docgenService.js';
import { logger } from '../utils/logger.js';
import { logTokenUsage } from '../services/tokenStatsService.js';
import { executeParallelAnalysis, executeParallelAnalysisSimple } from '../services/parallelAnalysisService.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * Helper: Obtener texto completo o contexto RAG de documentos
 */
async function getDocumentsContext(documentIds, userId, useStandard = false, operationContext = {}) {
  const contexts = [];
  
  for (const docId of documentIds) {
    // Verificar propiedad
    const docCheck = await query(
      `SELECT d.*, p.user_id 
       FROM documents d
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.id = $1`,
      [docId]
    );

    if (docCheck.rows.length === 0) {
      throw new Error(`Documento ${docId} no encontrado`);
    }

    const doc = docCheck.rows[0];
    
    if (doc.user_id !== userId && !doc.is_vault_document) {
      throw new Error(`Sin permisos para acceder al documento ${docId}`);
    }

    // Obtener archivo y extraer texto
    const buffer = await getFile(doc.file_path);
    const fullText = await extractText(buffer, doc.mime_type);

    // Decidir: texto completo o RAG según el modelo a usar
    const canFitFull = useStandard ? canFitInStandardContext(fullText) : canFitInContext(fullText);
    
    if (canFitFull) {
      contexts.push({
        filename: doc.filename,
        text: fullText,
        method: 'full_text'
      });
      logger.info(`Document ${docId} fits in context, using full text`, { 
        tokens: estimateTokens(fullText),
        model: useStandard ? 'gpt-5' : 'gpt-5-mini'
      });
    } else {
      // Usar RAG para obtener chunks relevantes
      logger.info(`Document ${docId} too large, using RAG`, { 
        tokens: estimateTokens(fullText),
        model: useStandard ? 'gpt-5' : 'gpt-5-mini'
      });
      const searchResult = await searchInDocument(docId, fullText.substring(0, 500), { 
        userId: req.user.id, 
        projectId: doc.project_id 
      });
      const chunks = searchResult.chunks || [];
      const searchMetadata = searchResult.metadata || {};
      
      // Guardar historial de chunks para análisis
      logChunkSelection({
        chunks,
        queryText: fullText.substring(0, 500),
        operationType: 'analysis',
        operationSubtype: operationContext.analysisType || 'document_analysis',
        userId: userId,
        projectId: operationContext.projectId,
        metadata: searchMetadata
      }).catch(err => logger.error('Error logging chunks', err));
      
      const ragText = chunks.map(c => c.chunk_text).join('\n\n');
      contexts.push({
        filename: doc.filename,
        text: ragText,
        method: 'rag'
      });
    }
  }

  return contexts;
}

/**
 * POST /api/projects/:projectId/analyze/pliego
 * Analizar pliego técnico
 */
router.post('/projects/:projectId/analyze/pliego', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { document_ids, use_standard } = req.body;

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un documento' });
    }

    // Verificar proyecto
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Obtener contexto (pasando use_standard para aplicar límites correctos)
    const contexts = await getDocumentsContext(document_ids, req.user.id, use_standard, {
      analysisType: 'pliego_tecnico',
      projectId
    });
    const fullContext = contexts.map(c => `[${c.filename}]:\n${c.text}`).join('\n\n---\n\n');

    // Verificar tamaño final del contexto
    const contextTokens = estimateTokens(fullContext);
    logger.info(`Final context size for analysis`, { 
      tokens: contextTokens,
      model: use_standard ? 'gpt-5' : 'gpt-5-mini',
      documents: document_ids.length
    });

    // Obtener prompt desde la BD
    const promptConfig = await getSinglePromptForCategory('pliego_tecnico');
    const prompt = fillPrompt(promptConfig.prompt_text, { texto: fullContext });

    // Generar análisis
    const aiResponse = use_standard 
      ? await generateWithGPT5Standard(prompt)
      : await generateWithGPT5Mini(prompt);

    const resultData = parseAIResponse(aiResponse.result);

    // Guardar resultado
    const saveResult = await query(
      `INSERT INTO analysis_results (project_id, user_id, analysis_type, input_document_ids, result_data, ai_model_used, tokens_used, duration_ms)
       VALUES ($1, $2, 'pliego_tecnico', $3, $4, $5, $6, $7)
       RETURNING *`,
      [projectId, req.user.id, document_ids, JSON.stringify(resultData), aiResponse.model, aiResponse.tokensUsed, aiResponse.duration]
    );

    // Registrar uso de tokens
    await logTokenUsage({
      userId: req.user.id,
      operationType: 'analysis',
      operationSubtype: 'pliego_tecnico',
      aiModel: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      tokensInput: aiResponse.tokensInput,
      tokensOutput: aiResponse.tokensOutput,
      projectId: projectId,
      analysisId: saveResult.rows[0].id,
      queryObject: `Análisis de pliego técnico - ${document_ids.length} documentos`,
      durationMs: aiResponse.duration
    });

    logger.info('Pliego analysis completed', { 
      projectId, 
      model: aiResponse.model,
      tokens: aiResponse.tokensUsed 
    });

    return res.json({
      message: 'Análisis completado exitosamente',
      result: resultData,
      metadata: {
        model: aiResponse.model,
        tokens_used: aiResponse.tokensUsed,
        duration: aiResponse.duration,
        analysis_id: saveResult.rows[0].id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/analyze/contrato
 * Analizar contrato
 */
router.post('/projects/:projectId/analyze/contrato', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { document_ids, use_standard } = req.body;

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un documento' });
    }

    // Verificar proyecto
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Obtener contexto (pasando use_standard para aplicar límites correctos)
    const contexts = await getDocumentsContext(document_ids, req.user.id, use_standard, {
      analysisType: 'contrato',
      projectId
    });
    const fullContext = contexts.map(c => `[${c.filename}]:\n${c.text}`).join('\n\n---\n\n');

    // Verificar tamaño final del contexto
    const contextTokens = estimateTokens(fullContext);
    logger.info(`Final context size for contract analysis`, { 
      tokens: contextTokens,
      model: use_standard ? 'gpt-5' : 'gpt-5-mini',
      documents: document_ids.length
    });

    // Obtener prompt desde la BD
    const promptConfig = await getSinglePromptForCategory('contrato');
    const prompt = fillPrompt(promptConfig.prompt_text, { texto: fullContext });

    // Generar análisis
    const aiResponse = use_standard 
      ? await generateWithGPT5Standard(prompt)
      : await generateWithGPT5Mini(prompt);

    const resultData = parseAIResponse(aiResponse.result);

    // Guardar resultado
    const saveResult = await query(
      `INSERT INTO analysis_results (project_id, user_id, analysis_type, input_document_ids, result_data, ai_model_used, tokens_used, duration_ms)
       VALUES ($1, $2, 'contrato', $3, $4, $5, $6, $7)
       RETURNING *`,
      [projectId, req.user.id, document_ids, JSON.stringify(resultData), aiResponse.model, aiResponse.tokensUsed, aiResponse.duration]
    );

    // Registrar uso de tokens
    await logTokenUsage({
      userId: req.user.id,
      operationType: 'analysis',
      operationSubtype: 'contrato',
      aiModel: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      tokensInput: aiResponse.tokensInput,
      tokensOutput: aiResponse.tokensOutput,
      projectId: projectId,
      analysisId: saveResult.rows[0].id,
      queryObject: `Análisis de contrato - ${document_ids.length} documentos`,
      durationMs: aiResponse.duration
    });

    logger.info('Contract analysis completed', { 
      projectId, 
      model: aiResponse.model,
      tokens: aiResponse.tokensUsed 
    });

    return res.json({
      message: 'Análisis completado exitosamente',
      result: resultData,
      metadata: {
        model: aiResponse.model,
        tokens_used: aiResponse.tokensUsed,
        duration: aiResponse.duration,
        analysis_id: saveResult.rows[0].id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/generate/oferta
 * Generar oferta comercial
 */
router.post('/projects/:projectId/generate/oferta', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { document_ids, cliente, observaciones } = req.body;

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un documento' });
    }

    if (!cliente) {
      return res.status(400).json({ error: 'Se requiere nombre del cliente' });
    }

    // Verificar proyecto
    const projectCheck = await query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const project = projectCheck.rows[0];

    // Obtener contexto
    const contexts = await getDocumentsContext(document_ids, req.user.id, false, {
      analysisType: 'oferta',
      projectId
    });
    const fullContext = contexts.map(c => `[${c.filename}]:\n${c.text}`).join('\n\n---\n\n');

    // Obtener prompt desde la BD
    const promptConfig = await getSinglePromptForCategory('oferta');
    const prompt = fillPrompt(promptConfig.prompt_text, { 
      contexto: fullContext,
      cliente,
      observaciones: observaciones || ''
    });

    // Generar con IA
    const aiResponse = await generateWithGPT5Mini(prompt);
    const resultData = parseAIResponse(aiResponse.result);

    // Generar documento DOCX
    const docxBuffer = await generateOferta({
      cliente,
      proyecto: project.name,
      propuesta_tecnica: resultData.propuesta_tecnica || '',
      alcance: resultData.alcance || '',
      plazos: resultData.plazos || '',
      conceptos_precio: resultData.conceptos_precio || []
    });

    // Guardar resultado
    const saveOferta = await query(
      `INSERT INTO analysis_results (project_id, user_id, analysis_type, input_document_ids, result_data, ai_model_used, tokens_used, duration_ms)
       VALUES ($1, $2, 'oferta', $3, $4, $5, $6, $7)
       RETURNING *`,
      [projectId, req.user.id, document_ids, JSON.stringify(resultData), aiResponse.model, aiResponse.tokensUsed, aiResponse.duration]
    );

    // Registrar uso de tokens
    await logTokenUsage({
      userId: req.user.id,
      operationType: 'generation',
      operationSubtype: 'oferta',
      aiModel: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      tokensInput: aiResponse.tokensInput,
      tokensOutput: aiResponse.tokensOutput,
      projectId: projectId,
      analysisId: saveOferta.rows[0].id,
      queryObject: `Generación de oferta para ${cliente} - ${document_ids.length} documentos`,
      durationMs: aiResponse.duration
    });

    logger.info('Oferta generated', { projectId, cliente });

    // Enviar archivo
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="oferta_${cliente.replace(/\s+/g, '_')}.docx"`
    });

    return res.send(docxBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/generate/documentacion
 * Generar documentación técnica
 */
router.post('/projects/:projectId/generate/documentacion', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { document_ids, tipo_documento, titulo } = req.body;

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un documento' });
    }

    if (!tipo_documento || !titulo) {
      return res.status(400).json({ error: 'Se requiere tipo de documento y título' });
    }

    // Verificar proyecto
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Obtener contexto
    const contexts = await getDocumentsContext(document_ids, req.user.id, false, {
      analysisType: 'documentacion',
      projectId
    });
    const fullContext = contexts.map(c => `[${c.filename}]:\n${c.text}`).join('\n\n---\n\n');

    // Obtener prompt desde la BD
    const promptConfig = await getSinglePromptForCategory('documentacion');
    const prompt = fillPrompt(promptConfig.prompt_text, { 
      contexto: fullContext,
      tipo_documento,
      titulo
    });

    // Generar con IA
    const aiResponse = await generateWithGPT5Mini(prompt);
    const resultData = parseAIResponse(aiResponse.result);

    // Generar documento DOCX
    const docxBuffer = await generateDocumentacion({
      titulo,
      tipo_documento,
      contenido: resultData.contenido_principal || '',
      secciones: resultData.secciones || []
    });

    // Guardar resultado
    const saveDoc = await query(
      `INSERT INTO analysis_results (project_id, user_id, analysis_type, input_document_ids, result_data, ai_model_used, tokens_used, duration_ms)
       VALUES ($1, $2, 'documentacion', $3, $4, $5, $6, $7)
       RETURNING *`,
      [projectId, req.user.id, document_ids, JSON.stringify(resultData), aiResponse.model, aiResponse.tokensUsed, aiResponse.duration]
    );

    // Registrar uso de tokens
    await logTokenUsage({
      userId: req.user.id,
      operationType: 'generation',
      operationSubtype: 'documentacion',
      aiModel: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      tokensInput: aiResponse.tokensInput,
      tokensOutput: aiResponse.tokensOutput,
      projectId: projectId,
      analysisId: saveDoc.rows[0].id,
      queryObject: `Generación de ${tipo_documento} - ${document_ids.length} documentos`,
      durationMs: aiResponse.duration
    });

    logger.info('Documentation generated', { projectId, tipo_documento });

    // Enviar archivo
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${tipo_documento.replace(/\s+/g, '_')}.docx"`
    });

    return res.send(docxBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/analysis
 * Obtener historial de análisis del proyecto
 */
router.get('/projects/:projectId/analysis', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Verificar proyecto
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Obtener análisis ordenados por fecha (más reciente primero)
    const result = await query(
      `SELECT id, analysis_type, result_data, ai_model_used, tokens_used, duration_ms, created_at
       FROM analysis_results
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );

    logger.info('Analysis history retrieved', { projectId, count: result.rows.length });

    return res.json({
      analysis: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/projects/:projectId/analysis/:analysisId
 * Eliminar un análisis específico
 */
router.delete('/projects/:projectId/analysis/:analysisId', async (req, res, next) => {
  try {
    const { projectId, analysisId } = req.params;

    // Verificar proyecto
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Verificar que el análisis existe y pertenece al proyecto
    const analysisCheck = await query(
      'SELECT id FROM analysis_results WHERE id = $1 AND project_id = $2',
      [analysisId, projectId]
    );

    if (analysisCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Análisis no encontrado' });
    }

    // Eliminar análisis
    await query('DELETE FROM analysis_results WHERE id = $1', [analysisId]);

    logger.info('Analysis deleted', { projectId, analysisId, userId: req.user.id });

    return res.json({ message: 'Análisis eliminado correctamente' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/analysis/:analysisId/add-as-document
 * Añadir análisis como documento JSON al proyecto
 */
router.post('/projects/:projectId/analysis/:analysisId/add-as-document', async (req, res, next) => {
  try {
    const { projectId, analysisId } = req.params;
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Se requiere un nombre de archivo' });
    }

    // Verificar proyecto
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Obtener análisis
    const analysisResult = await query(
      'SELECT result_data, analysis_type FROM analysis_results WHERE id = $1 AND project_id = $2',
      [analysisId, projectId]
    );

    if (analysisResult.rows.length === 0) {
      return res.status(404).json({ error: 'Análisis no encontrado' });
    }

    const analysis = analysisResult.rows[0];

    // Crear archivo JSON en MinIO
    const jsonContent = JSON.stringify(analysis.result_data, null, 2);
    const buffer = Buffer.from(jsonContent, 'utf-8');
    const filepath = `projects/${projectId}/${filename}.json`;

    await uploadFile(filepath, buffer, 'application/json');

    // Guardar en tabla documents con metadata del tipo de análisis
    const metadata = {
      source: 'analysis',
      analysis_id: analysisId,
      analysis_type: analysis.analysis_type
    };
    
    const docResult = await query(
      `INSERT INTO documents (project_id, filename, file_path, mime_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, 'application/json', $4, $5)
       RETURNING *`,
      [projectId, `${filename}.json`, filepath, buffer.length, req.user.id]
    );

    logger.info('Analysis added as document', { 
      projectId, 
      analysisId, 
      documentId: docResult.rows[0].id, 
      analysisType: analysis.analysis_type 
    });

    return res.json({
      message: 'Análisis añadido como documento',
      document: {
        ...docResult.rows[0],
        is_analysis_document: true,
        analysis_type: analysis.analysis_type
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/analyze/pliego-parallel
 * Analizar pliego técnico con prompts paralelos
 */
router.post('/projects/:projectId/analyze/pliego-parallel', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { document_ids, use_standard } = req.body;

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un documento' });
    }

    // Verificar proyecto
    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Preparar contextos de documentos para análisis paralelo
    const documentContexts = [];
    
    for (const docId of document_ids) {
      const docCheck = await query(
        `SELECT d.*, p.user_id 
         FROM documents d
         LEFT JOIN projects p ON d.project_id = p.id
         WHERE d.id = $1`,
        [docId]
      );

      if (docCheck.rows.length === 0) {
        return res.status(400).json({ error: `Documento ${docId} no encontrado` });
      }

      const doc = docCheck.rows[0];
      
      if (doc.user_id !== req.user.id && !doc.is_vault_document) {
        return res.status(403).json({ error: `Sin permisos para acceder al documento ${docId}` });
      }

      // Obtener archivo y extraer texto
      const buffer = await getFile(doc.file_path);
      const fullText = await extractText(buffer, doc.mime_type);

      documentContexts.push({
        documentId: docId,
        fullText: fullText,
        filename: doc.filename
      });
    }

    // Ejecutar análisis paralelo
    const analysisResult = await executeParallelAnalysis(
      documentContexts,
      'pliego_tecnico',
      use_standard,
      {
        userId: req.user.id,
        projectId: projectId
      }
    );

    // Guardar resultado
    const saveResult = await query(
      `INSERT INTO analysis_results (project_id, user_id, analysis_type, input_document_ids, result_data, ai_model_used, tokens_used, duration_ms)
       VALUES ($1, $2, 'pliego_tecnico_parallel', $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId, 
        req.user.id, 
        document_ids, 
        JSON.stringify(analysisResult), 
        analysisResult.metadata_global.modelo_utilizado, 
        analysisResult.metadata_global.tokens_totales, 
        analysisResult.metadata_global.duracion_total_ms
      ]
    );

    // Registrar uso de tokens
    await logTokenUsage({
      userId: req.user.id,
      operationType: 'analysis',
      operationSubtype: 'pliego_tecnico_parallel',
      aiModel: analysisResult.metadata_global.modelo_utilizado,
      tokensUsed: analysisResult.metadata_global.tokens_totales,
      tokensInput: analysisResult.metadata_global.tokens_input_totales,
      tokensOutput: analysisResult.metadata_global.tokens_output_totales,
      projectId: projectId,
      analysisId: saveResult.rows[0].id,
      queryObject: `Análisis paralelo de pliego técnico - ${analysisResult.prompts_ejecutados} prompts`,
      durationMs: analysisResult.metadata_global.duracion_total_ms
    });

    logger.info('Parallel pliego analysis completed', { 
      projectId, 
      model: analysisResult.metadata_global.modelo_utilizado,
      tokens: analysisResult.metadata_global.tokens_totales,
      prompts: analysisResult.prompts_ejecutados
    });

    return res.json({
      message: 'Análisis paralelo completado exitosamente',
      result: analysisResult,
      metadata: {
        model: analysisResult.metadata_global.modelo_utilizado,
        tokens_used: analysisResult.metadata_global.tokens_totales,
        duration: analysisResult.metadata_global.duracion_total_ms,
        analysis_id: saveResult.rows[0].id,
        prompts_executed: analysisResult.prompts_ejecutados
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/analyze/contrato-parallel
 * Analizar contrato con prompts paralelos
 */
router.post('/projects/:projectId/analyze/contrato-parallel', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { document_ids, use_standard } = req.body;

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un documento' });
    }

    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const documentContexts = [];
    
    for (const docId of document_ids) {
      const docCheck = await query(
        `SELECT d.*, p.user_id 
         FROM documents d
         LEFT JOIN projects p ON d.project_id = p.id
         WHERE d.id = $1`,
        [docId]
      );

      if (docCheck.rows.length === 0) {
        return res.status(400).json({ error: `Documento ${docId} no encontrado` });
      }

      const doc = docCheck.rows[0];
      
      if (doc.user_id !== req.user.id && !doc.is_vault_document) {
        return res.status(403).json({ error: `Sin permisos para acceder al documento ${docId}` });
      }

      const buffer = await getFile(doc.file_path);
      const fullText = await extractText(buffer, doc.mime_type);

      documentContexts.push({
        documentId: docId,
        fullText: fullText,
        filename: doc.filename
      });
    }

    const analysisResult = await executeParallelAnalysis(
      documentContexts,
      'contrato',
      use_standard,
      {
        userId: req.user.id,
        projectId: projectId
      }
    );

    const saveResult = await query(
      `INSERT INTO analysis_results (project_id, user_id, analysis_type, input_document_ids, result_data, ai_model_used, tokens_used, duration_ms)
       VALUES ($1, $2, 'contrato_parallel', $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId, 
        req.user.id, 
        document_ids, 
        JSON.stringify(analysisResult), 
        analysisResult.metadata_global.modelo_utilizado, 
        analysisResult.metadata_global.tokens_totales, 
        analysisResult.metadata_global.duracion_total_ms
      ]
    );

    await logTokenUsage({
      userId: req.user.id,
      operationType: 'analysis',
      operationSubtype: 'contrato_parallel',
      aiModel: analysisResult.metadata_global.modelo_utilizado,
      tokensUsed: analysisResult.metadata_global.tokens_totales,
      tokensInput: analysisResult.metadata_global.tokens_input_totales,
      tokensOutput: analysisResult.metadata_global.tokens_output_totales,
      projectId: projectId,
      analysisId: saveResult.rows[0].id,
      queryObject: `Análisis paralelo de contrato - ${analysisResult.prompts_ejecutados} prompts`,
      durationMs: analysisResult.metadata_global.duracion_total_ms
    });

    logger.info('Parallel contract analysis completed', { 
      projectId, 
      model: analysisResult.metadata_global.modelo_utilizado,
      tokens: analysisResult.metadata_global.tokens_totales,
      prompts: analysisResult.prompts_ejecutados
    });

    return res.json({
      message: 'Análisis paralelo completado exitosamente',
      result: analysisResult,
      metadata: {
        model: analysisResult.metadata_global.modelo_utilizado,
        tokens_used: analysisResult.metadata_global.tokens_totales,
        duration: analysisResult.metadata_global.duracion_total_ms,
        analysis_id: saveResult.rows[0].id,
        prompts_executed: analysisResult.prompts_ejecutados
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/generate/oferta-parallel
 * Generar oferta con prompts paralelos
 */
router.post('/projects/:projectId/generate/oferta-parallel', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { document_ids, cliente, observaciones, use_standard } = req.body;

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un documento' });
    }

    if (!cliente) {
      return res.status(400).json({ error: 'Se requiere nombre del cliente' });
    }

    const projectCheck = await query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const project = projectCheck.rows[0];
    const documentContexts = [];
    
    for (const docId of document_ids) {
      const docCheck = await query(
        `SELECT d.*, p.user_id 
         FROM documents d
         LEFT JOIN projects p ON d.project_id = p.id
         WHERE d.id = $1`,
        [docId]
      );

      if (docCheck.rows.length === 0) {
        return res.status(400).json({ error: `Documento ${docId} no encontrado` });
      }

      const doc = docCheck.rows[0];
      
      if (doc.user_id !== req.user.id && !doc.is_vault_document) {
        return res.status(403).json({ error: `Sin permisos para acceder al documento ${docId}` });
      }

      const buffer = await getFile(doc.file_path);
      const fullText = await extractText(buffer, doc.mime_type);

      documentContexts.push({
        documentId: docId,
        fullText: fullText,
        filename: doc.filename
      });
    }

    const analysisResult = await executeParallelAnalysis(
      documentContexts,
      'oferta',
      use_standard || false,
      {
        userId: req.user.id,
        projectId: projectId
      }
    );

    // Generar documento DOCX con resultado consolidado
    const resultadoConsolidado = analysisResult.resultado_final_consolidado;
    const docxBuffer = await generateOferta({
      cliente,
      proyecto: project.name,
      propuesta_tecnica: resultadoConsolidado.propuesta_tecnica || '',
      alcance: resultadoConsolidado.alcance || '',
      plazos: resultadoConsolidado.plazos || '',
      conceptos_precio: resultadoConsolidado.conceptos_precio || []
    });

    const saveResult = await query(
      `INSERT INTO analysis_results (project_id, user_id, analysis_type, input_document_ids, result_data, ai_model_used, tokens_used, duration_ms)
       VALUES ($1, $2, 'oferta_parallel', $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId, 
        req.user.id, 
        document_ids, 
        JSON.stringify(analysisResult), 
        analysisResult.metadata_global.modelo_utilizado, 
        analysisResult.metadata_global.tokens_totales, 
        analysisResult.metadata_global.duracion_total_ms
      ]
    );

    await logTokenUsage({
      userId: req.user.id,
      operationType: 'generation',
      operationSubtype: 'oferta_parallel',
      aiModel: analysisResult.metadata_global.modelo_utilizado,
      tokensUsed: analysisResult.metadata_global.tokens_totales,
      tokensInput: analysisResult.metadata_global.tokens_input_totales,
      tokensOutput: analysisResult.metadata_global.tokens_output_totales,
      projectId: projectId,
      analysisId: saveResult.rows[0].id,
      queryObject: `Generación paralela de oferta para ${cliente} - ${analysisResult.prompts_ejecutados} prompts`,
      durationMs: analysisResult.metadata_global.duracion_total_ms
    });

    logger.info('Parallel oferta generated', { projectId, cliente });

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="oferta_${cliente.replace(/\s+/g, '_')}.docx"`
    });

    return res.send(docxBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/generate/documentacion-parallel
 * Generar documentación con prompts paralelos
 */
router.post('/projects/:projectId/generate/documentacion-parallel', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { document_ids, tipo_documento, titulo, use_standard } = req.body;

    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un documento' });
    }

    if (!tipo_documento || !titulo) {
      return res.status(400).json({ error: 'Se requiere tipo de documento y título' });
    }

    const projectCheck = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const documentContexts = [];
    
    for (const docId of document_ids) {
      const docCheck = await query(
        `SELECT d.*, p.user_id 
         FROM documents d
         LEFT JOIN projects p ON d.project_id = p.id
         WHERE d.id = $1`,
        [docId]
      );

      if (docCheck.rows.length === 0) {
        return res.status(400).json({ error: `Documento ${docId} no encontrado` });
      }

      const doc = docCheck.rows[0];
      
      if (doc.user_id !== req.user.id && !doc.is_vault_document) {
        return res.status(403).json({ error: `Sin permisos para acceder al documento ${docId}` });
      }

      const buffer = await getFile(doc.file_path);
      const fullText = await extractText(buffer, doc.mime_type);

      documentContexts.push({
        documentId: docId,
        fullText: fullText,
        filename: doc.filename
      });
    }

    const analysisResult = await executeParallelAnalysis(
      documentContexts,
      'documentacion',
      use_standard || false,
      {
        userId: req.user.id,
        projectId: projectId
      }
    );

    // Generar documento DOCX
    const resultadoConsolidado = analysisResult.resultado_final_consolidado;
    const docxBuffer = await generateDocumentacion({
      titulo,
      tipo_documento,
      contenido: resultadoConsolidado.introduccion || '',
      secciones: resultadoConsolidado.secciones || []
    });

    const saveResult = await query(
      `INSERT INTO analysis_results (project_id, user_id, analysis_type, input_document_ids, result_data, ai_model_used, tokens_used, duration_ms)
       VALUES ($1, $2, 'documentacion_parallel', $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId, 
        req.user.id, 
        document_ids, 
        JSON.stringify(analysisResult), 
        analysisResult.metadata_global.modelo_utilizado, 
        analysisResult.metadata_global.tokens_totales, 
        analysisResult.metadata_global.duracion_total_ms
      ]
    );

    await logTokenUsage({
      userId: req.user.id,
      operationType: 'generation',
      operationSubtype: 'documentacion_parallel',
      aiModel: analysisResult.metadata_global.modelo_utilizado,
      tokensUsed: analysisResult.metadata_global.tokens_totales,
      tokensInput: analysisResult.metadata_global.tokens_input_totales,
      tokensOutput: analysisResult.metadata_global.tokens_output_totales,
      projectId: projectId,
      analysisId: saveResult.rows[0].id,
      queryObject: `Generación paralela de ${tipo_documento} - ${analysisResult.prompts_ejecutados} prompts`,
      durationMs: analysisResult.metadata_global.duracion_total_ms
    });

    logger.info('Parallel documentation generated', { projectId, tipo_documento });

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${tipo_documento.replace(/\s+/g, '_')}.docx"`
    });

    return res.send(docxBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;

