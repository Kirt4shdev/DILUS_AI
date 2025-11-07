import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { validateEmail, validateUsername, validatePassword } from '../utils/validators.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Registrar nuevo usuario
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, full_name } = req.body;

    // Validaciones
    if (!validateUsername(username)) {
      return res.status(400).json({ error: 'Username inválido (3-50 caracteres alfanuméricos)' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password debe tener al menos 6 caracteres' });
    }

    // Verificar si usuario ya existe
    const existing = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Usuario o email ya existe' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Crear usuario
    const result = await query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, full_name, is_admin, created_at`,
      [username, email, password_hash, full_name || username]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    logger.info('User registered', { userId: user.id, username: user.username });

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login de usuario
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password requeridos' });
    }

    // Buscar usuario
    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    // Verificar si está activo
    if (!user.is_active) {
      return res.status(403).json({ error: 'Usuario desactivado' });
    }

    // Verificar password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Actualizar last_login
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Generar token
    const token = generateToken(user);

    logger.info('User logged in', { userId: user.id, username: user.username });

    return res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Obtener info del usuario actual
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    return res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        full_name: req.user.full_name,
        avatar_url: req.user.avatar_url,
        is_admin: req.user.is_admin
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

