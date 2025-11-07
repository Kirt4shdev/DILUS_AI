/**
 * RAG Configuration Service
 * Manages dynamic RAG parameters
 */

import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Cache para configuración (se actualiza cada request o bajo demanda)
let configCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60000; // 1 minuto

/**
 * Obtener toda la configuración del RAG
 */
export async function getRagConfig(forceRefresh = false) {
  try {
    // Usar cache si está vigente
    if (!forceRefresh && configCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
      return configCache;
    }

    const result = await query('SELECT * FROM current_rag_config ORDER BY config_key');
    
    // Convertir a objeto key-value
    const config = {};
    result.rows.forEach(row => {
      let value = row.config_value;
      
      // Convertir según tipo
      if (row.data_type === 'integer') {
        value = parseInt(value);
      } else if (row.data_type === 'float') {
        value = parseFloat(value);
      }
      
      config[row.config_key] = {
        value,
        dataType: row.data_type,
        description: row.description,
        minValue: row.min_value,
        maxValue: row.max_value,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by_username
      };
    });

    // Actualizar cache
    configCache = config;
    cacheTimestamp = Date.now();

    return config;
  } catch (error) {
    logger.error('Error getting RAG config', { error: error.message });
    throw error;
  }
}

/**
 * Obtener valor específico de configuración
 */
export async function getConfigValue(key, defaultValue = null) {
  try {
    const config = await getRagConfig();
    return config[key]?.value ?? defaultValue;
  } catch (error) {
    logger.error(`Error getting config value for ${key}`, { error: error.message });
    return defaultValue;
  }
}

/**
 * Actualizar configuración del RAG
 */
export async function updateRagConfig(updates, userId) {
  try {
    const results = [];
    
    for (const [key, value] of Object.entries(updates)) {
      // Validar que la key existe
      const existing = await query(
        'SELECT * FROM rag_config WHERE config_key = $1',
        [key]
      );
      
      if (existing.rows.length === 0) {
        results.push({ key, success: false, error: 'Config key not found' });
        continue;
      }

      const configRow = existing.rows[0];
      
      // Validar rango si aplica
      if (configRow.data_type === 'integer' || configRow.data_type === 'float') {
        const numValue = parseFloat(value);
        
        if (configRow.min_value !== null && numValue < configRow.min_value) {
          results.push({ 
            key, 
            success: false, 
            error: `Value must be >= ${configRow.min_value}` 
          });
          continue;
        }
        
        if (configRow.max_value !== null && numValue > configRow.max_value) {
          results.push({ 
            key, 
            success: false, 
            error: `Value must be <= ${configRow.max_value}` 
          });
          continue;
        }
      }

      // Actualizar
      await query(
        'UPDATE rag_config SET config_value = $1, updated_at = NOW(), updated_by = $2 WHERE config_key = $3',
        [String(value), userId, key]
      );

      results.push({ key, success: true, newValue: value });
      logger.info(`RAG config updated: ${key} = ${value}`, { userId });
    }

    // Invalidar cache
    configCache = null;
    cacheTimestamp = null;

    return results;
  } catch (error) {
    logger.error('Error updating RAG config', { error: error.message });
    throw error;
  }
}

/**
 * Obtener historial de cambios
 */
export async function getConfigHistory(limit = 50) {
  try {
    const result = await query(`
      SELECT 
        h.*,
        u.username as changed_by_username
      FROM rag_config_history h
      LEFT JOIN users u ON h.changed_by = u.id
      ORDER BY h.changed_at DESC
      LIMIT $1
    `, [limit]);

    return result.rows;
  } catch (error) {
    logger.error('Error getting config history', { error: error.message });
    throw error;
  }
}

/**
 * Resetear configuración a valores por defecto
 */
export async function resetToDefaults(userId) {
  try {
    const defaults = {
      chunk_size: '1000',
      chunk_overlap: '200',
      top_k: '5',
      min_similarity: '0.3',
      min_hybrid_score: '0.25',
      chunking_method: 'fixed',
      vector_weight: '0.6',
      bm25_weight: '0.4'
    };

    const results = await updateRagConfig(defaults, userId);
    
    logger.info('RAG config reset to defaults', { userId });
    
    return results;
  } catch (error) {
    logger.error('Error resetting RAG config', { error: error.message });
    throw error;
  }
}

export default {
  getRagConfig,
  getConfigValue,
  updateRagConfig,
  getConfigHistory,
  resetToDefaults
};

