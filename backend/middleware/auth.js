import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

/**
 * Generar token JWT
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Middleware: Autenticar token JWT
 */
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Obtener usuario de la BD (verificar que sigue activo)
    const result = await query(
      'SELECT id, username, email, full_name, avatar_url, is_active, is_admin FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Usuario desactivado' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Token inválido' });
    } else if (error instanceof jwt.TokenExpiredError) {
      return res.status(403).json({ error: 'Token expirado' });
    }
    logger.error('Error en autenticación', error);
    return res.status(500).json({ error: 'Error en autenticación' });
  }
}

/**
 * Middleware: Require admin role
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Acceso denegado - se requiere rol de administrador' });
  }
  next();
}

export default { generateToken, authenticateToken, requireAdmin };

