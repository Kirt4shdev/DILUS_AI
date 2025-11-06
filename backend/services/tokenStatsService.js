import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Registrar uso de tokens en la base de datos
 * @param {Object} params - Parámetros del registro
 * @returns {Promise<number>} ID del registro creado
 */
export async function logTokenUsage({
  userId,
  operationType,        // 'analysis', 'chat', 'generation'
  operationSubtype,     // 'pliego', 'contrato', 'oferta', 'vault_query', etc.
  aiModel,              // 'gpt-5', 'gpt-5-mini', 'text-embedding-3-small'
  tokensUsed,
  tokensInput = null,
  tokensOutput = null,
  sourceType = null,    // 'library', 'external' (para chat)
  projectId = null,
  analysisId = null,
  vaultQueryId = null,
  queryObject = null,   // Descripción del objeto de consulta
  durationMs = null
}) {
  try {
    const result = await query(
      `SELECT log_token_usage($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) as id`,
      [
        userId,
        operationType,
        operationSubtype,
        aiModel,
        tokensUsed,
        tokensInput,
        tokensOutput,
        sourceType,
        projectId,
        analysisId,
        vaultQueryId,
        queryObject,
        durationMs
      ]
    );

    const recordId = result.rows[0].id;

    logger.info('Token usage logged', {
      recordId,
      userId,
      operationType,
      aiModel,
      tokensUsed
    });

    return recordId;
  } catch (error) {
    logger.error('Error logging token usage', { error: error.message, userId, operationType });
    // No lanzar error para no interrumpir el flujo principal
    return null;
  }
}

/**
 * Obtener estadísticas de uso de tokens por usuario
 * @param {number} userId - ID del usuario
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Object>} Estadísticas
 */
export async function getUserTokenStats(userId, filters = {}) {
  const { startDate, endDate, operationType } = filters;
  
  let whereClause = 'WHERE user_id = $1';
  const params = [userId];
  let paramIndex = 2;

  if (startDate) {
    whereClause += ` AND created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    whereClause += ` AND created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  if (operationType) {
    whereClause += ` AND operation_type = $${paramIndex}`;
    params.push(operationType);
    paramIndex++;
  }

  const result = await query(`
    SELECT 
      operation_type,
      ai_model,
      COUNT(*) as operation_count,
      SUM(tokens_used) as total_tokens,
      SUM(cost_usd) as total_cost_usd,
      AVG(tokens_used) as avg_tokens,
      AVG(duration_ms) as avg_duration_ms
    FROM token_usage
    ${whereClause}
    GROUP BY operation_type, ai_model
    ORDER BY total_tokens DESC
  `, params);

  return result.rows;
}

/**
 * Obtener uso diario de tokens
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Datos diarios
 */
export async function getDailyTokenUsage(filters = {}) {
  const { userId, days = 30 } = filters;
  
  let whereClause = `WHERE usage_date >= CURRENT_DATE - INTERVAL '${days} days'`;
  const params = [];
  
  if (userId) {
    whereClause += ' AND user_id = $1';
    params.push(userId);
  }

  const result = await query(`
    SELECT * FROM daily_token_usage
    ${whereClause}
    ORDER BY usage_date DESC
    LIMIT 100
  `, params);

  return result.rows;
}

/**
 * Obtener resumen de uso por modelo
 * @returns {Promise<Array>} Estadísticas por modelo
 */
export async function getModelUsageStats() {
  const result = await query('SELECT * FROM model_usage_stats ORDER BY total_tokens DESC');
  return result.rows;
}

/**
 * Obtener resumen de uso por usuario
 * @param {number} days - Días a analizar
 * @returns {Promise<Array>} Resumen por usuario
 */
export async function getUserTokenSummary(days = 30) {
  const result = await query(`
    SELECT * FROM user_token_summary
    WHERE last_usage >= NOW() - INTERVAL '${parseInt(days)} days'
    ORDER BY total_tokens DESC
  `);
  return result.rows;
}

/**
 * Obtener estadísticas generales
 * @param {number} userId - ID del usuario (opcional)
 * @param {number} days - Días a analizar
 * @returns {Promise<Object>} Estadísticas generales
 */
export async function getOverallStats(userId = null, days = 30) {
  const params = [];
  let userFilter = '';
  
  if (userId) {
    userFilter = 'AND user_id = $1';
    params.push(userId);
  }

  const result = await query(`
    SELECT 
      COUNT(*) as total_operations,
      SUM(tokens_used) as total_tokens,
      SUM(cost_usd) as total_cost_usd,
      AVG(tokens_used) as avg_tokens_per_operation,
      AVG(duration_ms) as avg_duration_ms
    FROM token_usage
    WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days' ${userFilter}
  `, params);

  return result.rows[0] || {
    total_operations: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    avg_tokens_per_operation: 0,
    avg_duration_ms: 0
  };
}

/**
 * Obtener comparación análisis vs chat
 * @param {number} userId - ID del usuario (opcional)
 * @param {number} days - Días a analizar
 * @returns {Promise<Object>} Comparación
 */
export async function getAnalysisVsChatComparison(userId = null, days = 30) {
  const params = [];
  let userFilter = '';
  let paramIndex = 1;
  
  if (userId) {
    userFilter = `AND user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  const result = await query(`
    SELECT 
      operation_type,
      COUNT(*) as operation_count,
      SUM(tokens_used) as total_tokens,
      SUM(cost_usd) as total_cost_usd,
      AVG(tokens_used) as avg_tokens_per_operation
    FROM token_usage
    WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days' ${userFilter}
    GROUP BY operation_type
    ORDER BY total_tokens DESC
  `, params);

  return result.rows;
}

/**
 * Obtener top consultas por tokens
 * @param {Object} filters - Filtros
 * @returns {Promise<Array>} Top consultas
 */
export async function getTopQueriesByTokens(filters = {}) {
  const { limit = 10, userId, operationType } = filters;
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (userId) {
    whereClause += ` AND user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  if (operationType) {
    whereClause += ` AND operation_type = $${paramIndex}`;
    params.push(operationType);
    paramIndex++;
  }

  params.push(limit);

  const result = await query(`
    SELECT 
      id,
      operation_type,
      operation_subtype,
      ai_model,
      tokens_used,
      cost_usd,
      query_object,
      source_type,
      created_at
    FROM token_usage
    ${whereClause}
    ORDER BY tokens_used DESC
    LIMIT $${paramIndex}
  `, params);

  return result.rows;
}

/**
 * Obtener costes de input/output por modelo y fuente
 * @param {number} userId - ID del usuario (opcional)
 * @param {number} days - Días a analizar
 * @returns {Promise<Array>} Costes desglosados
 */
export async function getInputOutputCostsByModelAndSource(userId = null, days = 30) {
  const params = [];
  let userFilter = '';
  let paramIndex = 1;
  
  if (userId) {
    userFilter = `AND user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  // Precios de OpenAI por 1K tokens
  const PRICES = {
    'gpt-5': { input: 0.00125, output: 0.01 },
    'gpt-5-mini': { input: 0.00025, output: 0.002 },
    'text-embedding-3-small': { input: 0.00002, output: 0 }
  };

  const result = await query(`
    SELECT 
      ai_model,
      COALESCE(source_type, 'analysis') as source_type,
      SUM(tokens_input) as total_tokens_input,
      SUM(tokens_output) as total_tokens_output,
      COUNT(*) as operation_count
    FROM token_usage
    WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days' ${userFilter}
    GROUP BY ai_model, source_type
    ORDER BY ai_model, source_type
  `, params);

  // Calcular costes en el backend basándose en tokens
  const enrichedResults = result.rows.map(row => {
    const modelPrices = PRICES[row.ai_model] || PRICES['gpt-5-mini'];
    const inputCost = (row.total_tokens_input || 0) / 1000 * modelPrices.input;
    const outputCost = (row.total_tokens_output || 0) / 1000 * modelPrices.output;
    
    return {
      ai_model: row.ai_model,
      source_type: row.source_type,
      total_tokens_input: parseInt(row.total_tokens_input) || 0,
      total_tokens_output: parseInt(row.total_tokens_output) || 0,
      input_cost_usd: inputCost,
      output_cost_usd: outputCost,
      total_cost_usd: inputCost + outputCost,
      operation_count: parseInt(row.operation_count)
    };
  });

  return enrichedResults;
}

export default {
  logTokenUsage,
  getUserTokenStats,
  getDailyTokenUsage,
  getModelUsageStats,
  getUserTokenSummary,
  getOverallStats,
  getAnalysisVsChatComparison,
  getTopQueriesByTokens,
  getInputOutputCostsByModelAndSource
};

