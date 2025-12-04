import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateProjectName } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * GET /api/projects
 * Listar proyectos del usuario
 */
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    
    let sql = 'SELECT * FROM projects WHERE user_id = $1';
    const params = [req.user.id];

    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }

    sql += ' ORDER BY updated_at DESC';

    const result = await query(sql, params);

    return res.json({
      projects: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id
 * Obtener proyecto específico
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    return res.json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects
 * Crear nuevo proyecto
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, description, client } = req.body;

    if (!validateProjectName(name)) {
      return res.status(400).json({ 
        error: 'Nombre de proyecto inválido (3-255 caracteres)' 
      });
    }

    const result = await query(
      `INSERT INTO projects (user_id, name, description, client, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [req.user.id, name.trim(), description?.trim() || null, client?.trim() || null]
    );

    const project = result.rows[0];

    logger.info('Project created', { 
      projectId: project.id, 
      userId: req.user.id,
      name: project.name 
    });

    return res.status(201).json({
      message: 'Proyecto creado exitosamente',
      project
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/projects/:id
 * Actualizar proyecto
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, client, status } = req.body;

    // Verificar propiedad
    const existing = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Validar nombre si se proporciona
    if (name && !validateProjectName(name)) {
      return res.status(400).json({ 
        error: 'Nombre de proyecto inválido (3-255 caracteres)' 
      });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description?.trim() || null);
    }

    if (client !== undefined) {
      updates.push(`client = $${paramIndex++}`);
      params.push(client?.trim() || null);
    }

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE projects SET ${updates.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    logger.info('Project updated', { projectId: id, userId: req.user.id });

    return res.json({
      message: 'Proyecto actualizado exitosamente',
      project: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/projects/:id
 * Eliminar proyecto (y sus documentos)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar propiedad
    const existing = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Eliminar proyecto (CASCADE eliminará documentos y embeddings)
    await query('DELETE FROM projects WHERE id = $1', [id]);

    logger.info('Project deleted', { projectId: id, userId: req.user.id });

    return res.json({ message: 'Proyecto eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
});

export default router;

