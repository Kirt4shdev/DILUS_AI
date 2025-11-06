import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// Configuración del pool de PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'dilus_ai',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Event handlers
pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

/**
 * Ejecutar una query
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error', { text, error: error.message });
    throw error;
  }
}

/**
 * Obtener un cliente del pool para transacciones
 */
export async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query;
  const originalRelease = client.release;
  
  // Timeout para transacciones
  const timeout = setTimeout(() => {
    logger.error('Client has been checked out for more than 5 seconds!');
  }, 5000);
  
  // Override release
  client.release = () => {
    clearTimeout(timeout);
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease.apply(client);
  };
  
  return client;
}

/**
 * Inicializar conexión a la base de datos
 */
export async function initDatabase() {
  try {
    await pool.query('SELECT NOW()');
    logger.info('✅ PostgreSQL connected successfully');
    
    // Verificar extensión pgvector
    const vectorCheck = await pool.query(
      "SELECT * FROM pg_extension WHERE extname = 'vector'"
    );
    if (vectorCheck.rows.length > 0) {
      logger.info('✅ pgvector extension is installed');
    } else {
      logger.warn('⚠️  pgvector extension not found');
    }
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL', error);
    throw error;
  }
}

/**
 * Cerrar el pool
 */
export async function closeDatabase() {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}

export default { query, getClient, initDatabase, closeDatabase };

