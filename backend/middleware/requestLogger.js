import { logger } from '../utils/logger.js';

/**
 * Middleware para logging de requests
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Capturar cuando termine la response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      user: req.user?.username || 'anonymous'
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP request', logData);
    } else {
      logger.info('HTTP request', logData);
    }
  });
  
  next();
}

export default requestLogger;

