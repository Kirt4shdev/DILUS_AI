import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { searchInVault, getContextFromChunks, logChunkSelection } from '../services/ragService.js';
import { generateWithGPT5Mini } from '../services/aiService.js';
import { fillPrompt, PROMPT_CHAT_VAULT } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { logTokenUsage } from '../services/tokenStatsService.js';
import { getConfigValue } from '../services/ragConfigService.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * POST /api/vault/query
 * Consultar la bóveda con soporte para contexto conversacional
 */
router.post('/query', async (req, res, next) => {
  const startTime = Date.now();
  const timings = {};
  
  try {
    const { query: userQuery, conversation_history } = req.body;

    if (!userQuery || userQuery.trim().length === 0) {
      return res.status(400).json({ error: 'Se requiere una pregunta' });
    }

    const queryText = userQuery.trim();
    const hasHistory = Array.isArray(conversation_history) && conversation_history.length > 0;

    logger.info('Vault query received', { 
      userId: req.user.id,
      queryLength: queryText.length,
      historyLength: hasHistory ? conversation_history.length : 0
    });

    // PASO 1: Obtener configuración
    const step1Start = Date.now();
    const topK = await getConfigValue('top_k', 5);
    timings.config = Date.now() - step1Start;
    logger.debug('Step 1 - Config loaded', { duration: timings.config });

    // PASO 2: Búsqueda en RAG (Vector + BM25 + Fuzzy)
    const step2Start = Date.now();
    const searchResult = await searchInVault(queryText, { topK, userId: req.user.id });
    const chunks = searchResult.chunks || [];
    const searchMetadata = searchResult.metadata || {};
    timings.ragSearch = Date.now() - step2Start;
    logger.debug('Step 2 - RAG search completed', { 
      duration: timings.ragSearch,
      chunksFound: chunks.length,
      detectedEquipments: searchMetadata.detectedEquipments
    });
    
    let aiResponse;
    let sources = [];
    let sourceType = 'none';

    if (chunks.length > 0) {
      // PASO 3: Preparar contexto
      const step3Start = Date.now();
      sourceType = 'library';
      const context = await getContextFromChunks(chunks);
      timings.contextPrep = Date.now() - step3Start;
      logger.debug('Step 3 - Context prepared', { duration: timings.contextPrep });

      // Log chunks para análisis
      logChunkSelection({
        chunks,
        queryText,
        operationType: 'chat',
        operationSubtype: 'vault_query',
        userId: req.user.id,
        metadata: searchMetadata
      }).catch(err => logger.error('Error logging chunks', err));

      // PASO 4: Construir mensajes con historial
      const step4Start = Date.now();
      const messages = [];
      
      const systemPrompt = `Eres un asistente técnico experto en ingeniería y documentación técnica.

CONTEXTO DE LA BIBLIOTECA:
${context}

Usa SIEMPRE el contexto proporcionado de la biblioteca para responder. Si la información no está en el contexto, indícalo claramente.`;

      if (hasHistory) {
        messages.push(...conversation_history);
      }
      
      messages.push({
        role: 'user',
        content: queryText
      });
      timings.messageConstruction = Date.now() - step4Start;
      logger.debug('Step 4 - Messages constructed', { duration: timings.messageConstruction });

      // PASO 5: Generar respuesta con IA
      const step5Start = Date.now();
      aiResponse = await generateWithGPT5Mini(messages, { systemPrompt });
      timings.aiGeneration = Date.now() - step5Start;
      logger.debug('Step 5 - AI response generated', { 
        duration: timings.aiGeneration,
        tokens: aiResponse.tokensUsed
      });

      sources = [...new Set(chunks.map(c => c.filename))].filter(Boolean);
      
      logger.info('Vault query completed from library', { 
        userId: req.user.id,
        chunks: chunks.length,
        tokens: aiResponse.tokensUsed,
        withHistory: hasHistory,
        totalDuration: Date.now() - startTime
      });
    } else {
      // No hay contexto - búsqueda externa
      sourceType = 'external';
      
      const step3Start = Date.now();
      const messages = [];
      
      const systemPrompt = `Eres un asistente técnico experto en ingeniería y documentación técnica.

Responde de forma clara, técnica y precisa. Proporciona información útil y fundamentada.`;

      if (hasHistory) {
        messages.push(...conversation_history);
      }
      
      messages.push({
        role: 'user',
        content: queryText
      });
      timings.messageConstruction = Date.now() - step3Start;

      const step4Start = Date.now();
      aiResponse = await generateWithGPT5Mini(messages, { systemPrompt });
      timings.aiGeneration = Date.now() - step4Start;
      
      sources = ['GPT-5-mini (Conocimiento externo)'];
      
      logger.info('Vault query completed from external source', { 
        userId: req.user.id,
        tokens: aiResponse.tokensUsed,
        withHistory: hasHistory,
        totalDuration: Date.now() - startTime
      });
    }

    // PASO 6: Guardar en base de datos
    const step6Start = Date.now();
    const vaultQueryResult = await query(
      `INSERT INTO vault_queries (user_id, query_text, response_text, chunks_used, ai_model, tokens_used)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.user.id, queryText, aiResponse.result, chunks.length, aiResponse.model, aiResponse.tokensUsed]
    );
    timings.dbSave = Date.now() - step6Start;
    logger.debug('Step 6 - DB save completed', { duration: timings.dbSave });

    // PASO 7: Registrar estadísticas de tokens
    const step7Start = Date.now();
    await logTokenUsage({
      userId: req.user.id,
      operationType: 'chat',
      operationSubtype: 'vault_query',
      aiModel: aiResponse.model,
      tokensUsed: aiResponse.tokensUsed,
      tokensInput: aiResponse.tokensInput || 0,
      tokensOutput: aiResponse.tokensOutput || 0,
      sourceType: sourceType,
      vaultQueryId: vaultQueryResult.rows[0].id,
      queryObject: queryText.substring(0, 100),
      durationMs: aiResponse.duration
    });
    timings.tokenStats = Date.now() - step7Start;
    logger.debug('Step 7 - Token stats logged', { duration: timings.tokenStats });

    timings.total = Date.now() - startTime;

    // Log resumen de tiempos
    logger.info('Query timing breakdown', {
      ...timings,
      percentages: {
        ragSearch: ((timings.ragSearch / timings.total) * 100).toFixed(1) + '%',
        aiGeneration: ((timings.aiGeneration / timings.total) * 100).toFixed(1) + '%',
        other: (((timings.total - timings.ragSearch - timings.aiGeneration) / timings.total) * 100).toFixed(1) + '%'
      }
    });

    return res.json({
      response: aiResponse.result,
      chunks_used: chunks.length,
      sources,
      source_type: sourceType,
      metadata: {
        model: aiResponse.model,
        tokens_used: aiResponse.tokensUsed,
        duration: aiResponse.duration,
        timings: timings // Incluir timings detallados
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

