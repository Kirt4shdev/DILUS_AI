import { logger } from '../utils/logger.js';

/**
 * Middleware global de manejo de errores
 */
export function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Error de validación
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Error de validación',
      details: err.message
    });
  }

  // Error de base de datos
  if (err.code && err.code.startsWith('23')) {
    return res.status(400).json({
      error: 'Error de base de datos',
      details: 'Violación de restricción de integridad'
    });
  }

  // Error genérico
  return res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

export default errorHandler;

