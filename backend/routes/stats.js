import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { 
  getUserTokenStats, 
  getDailyTokenUsage, 
  getModelUsageStats,
  getAnalysisVsChatComparison,
  getTopQueriesByTokens,
  getInputOutputCostsByModelAndSource
} from '../services/tokenStatsService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Todas las rutas requieren autenticación y permisos de admin
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/stats/overview
 * Obtener resumen general de estadísticas
 */
router.get('/overview', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    // Tokens por día (últimos N días)
    const dailyUsage = await getDailyTokenUsage({ days: parseInt(days) });

    // Análisis vs Chat
    const analysisVsChat = await getAnalysisVsChatComparison(null, parseInt(days));

    // Uso por modelo
    const modelStats = await getModelUsageStats();

    // Top 10 consultas más costosas
    const topQueries = await getTopQueriesByTokens({ limit: 10 });

    // Costes de input/output por modelo y fuente
    const inputOutputCosts = await getInputOutputCostsByModelAndSource(null, parseInt(days));

    // Uso de biblioteca vs externa (para chat)
    const libraryVsExternal = await query(`
      SELECT 
        source_type,
        COUNT(*) as query_count,
        SUM(tokens_used) as total_tokens,
        ROUND(AVG(tokens_used)) as avg_tokens,
        SUM(cost_usd) as total_cost
      FROM token_usage
      WHERE operation_type = 'chat'
        AND source_type IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY source_type
    `);

    // Resumen por usuario
    const userSummary = await query(`
      SELECT 
        u.username,
        COUNT(tu.id) as total_operations,
        SUM(tu.tokens_used) as total_tokens,
        SUM(tu.cost_usd) as total_cost,
        SUM(CASE WHEN tu.operation_type = 'analysis' THEN tu.cost_usd ELSE 0 END) as cost_analysis,
        SUM(CASE WHEN tu.operation_type = 'chat' THEN tu.cost_usd ELSE 0 END) as cost_chat,
        SUM(CASE WHEN tu.operation_type = 'generation' THEN tu.cost_usd ELSE 0 END) as cost_generation
      FROM users u
      LEFT JOIN token_usage tu ON u.id = tu.user_id
      WHERE tu.created_at >= NOW() - INTERVAL '${parseInt(days)} days' OR tu.created_at IS NULL
      GROUP BY u.id, u.username
      HAVING COUNT(tu.id) > 0
      ORDER BY total_cost DESC
    `);

    logger.info('Stats overview requested', { adminId: req.user.id, days });

    return res.json({
      period_days: parseInt(days),
      daily_usage: dailyUsage,
      analysis_vs_chat: analysisVsChat,
      model_stats: modelStats,
      top_queries: topQueries,
      input_output_costs: inputOutputCosts,
      library_vs_external: libraryVsExternal.rows,
      user_summary: userSummary.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stats/daily/:days
 * Obtener uso diario de tokens
 */
router.get('/daily/:days', async (req, res, next) => {
  try {
    const { days } = req.params;
    const dailyData = await getDailyTokenUsage({ days: parseInt(days) });
    
    return res.json({ data: dailyData });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stats/users
 * Obtener estadísticas por usuario
 */
router.get('/users', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    
    const userStats = await query(`
      SELECT * FROM user_token_summary
      WHERE last_usage >= NOW() - INTERVAL '${parseInt(days)} days' OR last_usage IS NULL
      ORDER BY total_cost DESC
    `);
    
    return res.json({ users: userStats.rows });
  } catch (error) {
    next(error);
  }
});

export default router;

