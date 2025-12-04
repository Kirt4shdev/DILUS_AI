/**
 * Servicio para gestión de prompts configurables
 */

import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Cache para prompts (se refresca cada 5 minutos)
let promptsCache = null;
let lastCacheUpdate = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtener todos los prompts (con cache)
 */
export async function getAllPrompts(forceRefresh = false) {
  try {
    const now = Date.now();
    
    // Usar cache si es válido
    if (!forceRefresh && promptsCache && lastCacheUpdate && (now - lastCacheUpdate < CACHE_DURATION)) {
      logger.debug('Using cached prompts');
      return promptsCache;
    }

    logger.info('Fetching prompts from database');
    
    const result = await query(`
      SELECT 
        id,
        key,
        name,
        description,
        category,
        prompt_type,
        prompt_text,
        variables,
        is_active,
        display_order,
        created_at,
        updated_at
      FROM prompts
      WHERE is_active = TRUE
      ORDER BY category, prompt_type, display_order
    `);

    promptsCache = result.rows;
    lastCacheUpdate = now;
    
    return result.rows;
  } catch (error) {
    logger.error('Error fetching prompts', { error: error.message });
    throw error;
  }
}

/**
 * Obtener prompts por categoría
 */
export async function getPromptsByCategory(category) {
  try {
    const allPrompts = await getAllPrompts();
    return allPrompts.filter(p => p.category === category);
  } catch (error) {
    logger.error('Error fetching prompts by category', { category, error: error.message });
    throw error;
  }
}

/**
 * Obtener un prompt específico por su key
 */
export async function getPromptByKey(key) {
  try {
    const result = await query(
      'SELECT * FROM prompts WHERE key = $1 AND is_active = TRUE',
      [key]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Prompt not found: ${key}`);
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error fetching prompt by key', { key, error: error.message });
    throw error;
  }
}

/**
 * Obtener prompt único para una categoría
 */
export async function getSinglePromptForCategory(category) {
  try {
    const prompts = await getPromptsByCategory(category);
    const singlePrompt = prompts.find(p => p.prompt_type === 'single');
    
    if (!singlePrompt) {
      throw new Error(`No single prompt found for category: ${category}`);
    }
    
    return singlePrompt;
  } catch (error) {
    logger.error('Error fetching single prompt for category', { category, error: error.message });
    throw error;
  }
}

/**
 * Obtener prompts paralelos para una categoría
 */
export async function getParallelPromptsForCategory(category) {
  try {
    const prompts = await getPromptsByCategory(category);
    const parallelPrompts = prompts.filter(p => p.prompt_type === 'parallel');
    
    // Ordenar por display_order
    parallelPrompts.sort((a, b) => a.display_order - b.display_order);
    
    return parallelPrompts;
  } catch (error) {
    logger.error('Error fetching parallel prompts for category', { category, error: error.message });
    throw error;
  }
}

/**
 * Actualizar un prompt
 */
export async function updatePrompt(promptId, updates, userId) {
  try {
    const allowedFields = ['name', 'description', 'prompt_text', 'variables', 'is_active', 'display_order'];
    const updateFields = [];
    const updateValues = [];
    let paramCounter = 1;

    // Construir query dinámicamente
    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        updateFields.push(`${field} = $${paramCounter}`);
        updateValues.push(value);
        paramCounter++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Obtener el prompt anterior para el historial
    const oldPromptResult = await query('SELECT prompt_text FROM prompts WHERE id = $1', [promptId]);
    
    if (oldPromptResult.rows.length === 0) {
      throw new Error('Prompt not found');
    }

    const oldPromptText = oldPromptResult.rows[0].prompt_text;

    // Actualizar el prompt
    updateValues.push(promptId);
    const updateQuery = `
      UPDATE prompts 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCounter}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);

    // Guardar en historial si cambió el texto del prompt
    if (updates.prompt_text && updates.prompt_text !== oldPromptText) {
      await query(`
        INSERT INTO prompt_history (prompt_id, prompt_text_old, prompt_text_new, changed_by)
        VALUES ($1, $2, $3, $4)
      `, [promptId, oldPromptText, updates.prompt_text, userId]);
    }

    // Invalidar cache
    promptsCache = null;
    lastCacheUpdate = null;

    logger.info('Prompt updated', { promptId, userId, fieldsUpdated: Object.keys(updates) });

    return result.rows[0];
  } catch (error) {
    logger.error('Error updating prompt', { promptId, error: error.message });
    throw error;
  }
}

/**
 * Obtener historial de cambios de un prompt
 */
export async function getPromptHistory(promptId, limit = 50) {
  try {
    const result = await query(`
      SELECT 
        ph.id,
        ph.prompt_id,
        ph.prompt_text_old,
        ph.prompt_text_new,
        ph.changed_at,
        ph.change_reason,
        u.username as changed_by_username,
        u.email as changed_by_email
      FROM prompt_history ph
      LEFT JOIN users u ON ph.changed_by = u.id
      WHERE ph.prompt_id = $1
      ORDER BY ph.changed_at DESC
      LIMIT $2
    `, [promptId, limit]);

    return result.rows;
  } catch (error) {
    logger.error('Error fetching prompt history', { promptId, error: error.message });
    throw error;
  }
}

/**
 * Reemplazar variables en un prompt
 */
export function fillPrompt(promptText, replacements) {
  let result = promptText;
  
  for (const [key, value] of Object.entries(replacements)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }
  
  return result;
}

/**
 * Obtener categorías disponibles
 */
export async function getPromptCategories() {
  try {
    const result = await query(`
      SELECT DISTINCT category, COUNT(*) as prompt_count
      FROM prompts
      WHERE is_active = TRUE
      GROUP BY category
      ORDER BY category
    `);

    const categories = {
      pliego_tecnico: {
        name: 'Pliego Técnico',
        description: 'Análisis de pliegos técnicos de licitaciones',
        icon: '📋',
        count: 0
      },
      contrato: {
        name: 'Contrato',
        description: 'Análisis de contratos y cláusulas legales',
        icon: '📝',
        count: 0
      },
      oferta: {
        name: 'Oferta',
        description: 'Generación de propuestas comerciales',
        icon: '💼',
        count: 0
      },
      documentacion: {
        name: 'Documentación',
        description: 'Generación de documentación técnica',
        icon: '📄',
        count: 0
      },
      vault: {
        name: 'Codex Dilus',
        description: 'Chat con la bóveda de conocimiento',
        icon: '🔮',
        count: 0
      }
    };

    // Actualizar contadores
    result.rows.forEach(row => {
      if (categories[row.category]) {
        categories[row.category].count = parseInt(row.prompt_count);
      }
    });

    return categories;
  } catch (error) {
    logger.error('Error fetching prompt categories', { error: error.message });
    throw error;
  }
}

/**
 * Crear un nuevo prompt
 */
export async function createPrompt(promptData, userId) {
  try {
    const {
      key,
      name,
      description,
      category,
      prompt_type,
      prompt_text,
      variables = [],
      display_order = 0
    } = promptData;

    // Validar campos requeridos
    if (!key || !name || !category || !prompt_type || !prompt_text) {
      throw new Error('Missing required fields');
    }

    const result = await query(`
      INSERT INTO prompts (
        key, name, description, category, prompt_type, 
        prompt_text, variables, display_order, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING *
    `, [key, name, description, category, prompt_type, prompt_text, JSON.stringify(variables), display_order]);

    // Invalidar cache
    promptsCache = null;
    lastCacheUpdate = null;

    logger.info('Prompt created', { key, category, userId });

    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error('A prompt with this key already exists');
    }
    logger.error('Error creating prompt', { error: error.message });
    throw error;
  }
}

/**
 * Eliminar un prompt (soft delete)
 */
export async function deletePrompt(promptId, userId) {
  try {
    const result = await query(`
      UPDATE prompts 
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [promptId]);

    if (result.rows.length === 0) {
      throw new Error('Prompt not found');
    }

    // Invalidar cache
    promptsCache = null;
    lastCacheUpdate = null;

    logger.info('Prompt deleted (soft)', { promptId, userId });

    return result.rows[0];
  } catch (error) {
    logger.error('Error deleting prompt', { promptId, error: error.message });
    throw error;
  }
}

/**
 * Restaurar un prompt eliminado
 */
export async function restorePrompt(promptId, userId) {
  try {
    const result = await query(`
      UPDATE prompts 
      SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [promptId]);

    if (result.rows.length === 0) {
      throw new Error('Prompt not found');
    }

    // Invalidar cache
    promptsCache = null;
    lastCacheUpdate = null;

    logger.info('Prompt restored', { promptId, userId });

    return result.rows[0];
  } catch (error) {
    logger.error('Error restoring prompt', { promptId, error: error.message });
    throw error;
  }
}

