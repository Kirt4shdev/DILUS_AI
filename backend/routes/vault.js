import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { searchInVault, getContextFromChunks, logChunkSelection } from '../services/ragService.js';
import { generateWithGPT5Mini } from '../services/aiService.js';
import { fillPrompt, PROMPT_CHAT_VAULT } from '../utils/prompts.js';
import { logger } from '../utils/logger.js';
import { logTokenUsage } from '../services/tokenStatsService.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * POST /api/vault/query
 * Consultar la bóveda con soporte para contexto conversacional
 */
router.post('/query', async (req, res, next) => {
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

    // Buscar en la biblioteca (RAG)
    const searchResult = await searchInVault(queryText, { topK: 10 });
    const chunks = searchResult.chunks || [];
    const searchMetadata = searchResult.metadata || {};
    
    let aiResponse;
    let sources = [];
    let sourceType = 'none';

    if (chunks.length > 0) {
      // Guardar historial de chunks para análisis
      logChunkSelection({
        chunks,
        queryText,
        operationType: 'chat',
        operationSubtype: 'vault_query',
        userId: req.user.id,
        metadata: searchMetadata
      }).catch(err => logger.error('Error logging chunks', err));
      // Se encontraron documentos en la biblioteca
      sourceType = 'library';
      
      // Preparar contexto
      const context = await getContextFromChunks(chunks);

      // Construir mensajes con historial
      const messages = [];
      
      // System prompt con contexto de la biblioteca
      const systemPrompt = `Eres un asistente técnico experto en ingeniería y documentación técnica.

CONTEXTO DE LA BIBLIOTECA:
${context}

Usa SIEMPRE el contexto proporcionado de la biblioteca para responder. Si la información no está en el contexto, indícalo claramente.`;

      // Si hay historial, agregarlo (excepto el último mensaje que es la nueva consulta)
      if (hasHistory) {
        messages.push(...conversation_history);
      }
      
      // Agregar la nueva consulta del usuario
      messages.push({
        role: 'user',
        content: queryText
      });

      // Generar respuesta con IA usando la biblioteca y el historial
      aiResponse = await generateWithGPT5Mini(messages, { systemPrompt });

      // Extraer fuentes únicas
      sources = [...new Set(chunks.map(c => c.filename))].filter(Boolean);
      
      logger.info('Vault query completed from library', { 
        userId: req.user.id,
        chunks: chunks.length,
        tokens: aiResponse.tokensUsed,
        withHistory: hasHistory
      });
    } else {
      // No se encontró información en la biblioteca, buscar externamente
      sourceType = 'external';
      
      // Construir mensajes con historial
      const messages = [];
      
      const systemPrompt = `Eres un asistente técnico experto en ingeniería y documentación técnica.

Responde de forma clara, técnica y precisa. Proporciona información útil y fundamentada.`;

      // Si hay historial, agregarlo
      if (hasHistory) {
        messages.push(...conversation_history);
      }
      
      // Agregar la nueva consulta del usuario
      messages.push({
        role: 'user',
        content: queryText
      });

      // Generar respuesta con IA sin contexto (búsqueda externa con GPT-5-mini)
      aiResponse = await generateWithGPT5Mini(messages, { systemPrompt });
      
      sources = ['GPT-5-mini (Conocimiento externo)'];
      
      logger.info('Vault query completed from external source', { 
        userId: req.user.id,
        tokens: aiResponse.tokensUsed,
        withHistory: hasHistory
      });
    }

    // Guardar en estadísticas (NO como historial de chat)
    const vaultQueryResult = await query(
      `INSERT INTO vault_queries (user_id, query_text, response_text, chunks_used, ai_model, tokens_used)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.user.id, queryText, aiResponse.result, chunks.length, aiResponse.model, aiResponse.tokensUsed]
    );

    // Registrar uso de tokens
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
      queryObject: queryText.substring(0, 100), // Primeros 100 caracteres de la pregunta
      durationMs: aiResponse.duration
    });

    return res.json({
      response: aiResponse.result,
      chunks_used: chunks.length,
      sources,
      source_type: sourceType, // 'library' o 'external'
      metadata: {
        model: aiResponse.model,
        tokens_used: aiResponse.tokensUsed,
        duration: aiResponse.duration
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

