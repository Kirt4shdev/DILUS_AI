import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDatabase } from './config/database.js';
import { initMinIO } from './services/minioService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { logger } from './utils/logger.js';

// Routes
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import documentRoutes from './routes/documents.js';
import analysisRoutes from './routes/analysis.js';
import vaultRoutes from './routes/vault.js';
import adminRoutes from './routes/admin.js';
import statsRoutes from './routes/stats.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: NODE_ENV === 'production' ? 100 : 1000, // Límite de requests
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.'
});

app.use('/api/', limiter);

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use(requestLogger);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  return res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '2.0.0'
  });
});

app.get('/', (req, res) => {
  return res.json({
    message: '🚀 DILUS_AI Backend API',
    version: '2.0.0',
    documentation: '/api/docs',
    health: '/health'
  });
});

// ============================================
// API ROUTES
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', documentRoutes); // Mounted on /api to support /api/projects/:id/documents
app.use('/api', analysisRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);

// ============================================
// ERROR HANDLER (debe ir al final)
// ============================================

app.use(errorHandler);

// ============================================
// 404 Handler
// ============================================

app.use((req, res) => {
  return res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.path 
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

async function start() {
  try {
    logger.info('🚀 Starting DILUS_AI Backend...');
    logger.info(`Environment: ${NODE_ENV}`);
    logger.info(`Port: ${PORT}`);

    // Inicializar base de datos
    await initDatabase();

    // Inicializar MinIO
    await initMinIO();

    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ DILUS_AI Backend running on port ${PORT}`);
      logger.info(`📡 API available at: http://localhost:${PORT}`);
      logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server', error);
    process.exit(1);
  }
}

// Manejo de señales para shutdown graceful
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing server gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Iniciar aplicación
start();

export default app;

