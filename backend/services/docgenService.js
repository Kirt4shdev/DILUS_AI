import axios from 'axios';
import { logger } from '../utils/logger.js';

const DOCGEN_URL = process.env.DOCGEN_URL || 'http://docgen:8090';

/**
 * Generar documento de oferta
 */
export async function generateOferta(data) {
  try {
    logger.debug('Generating oferta document', { cliente: data.cliente });

    const response = await axios.post(`${DOCGEN_URL}/generate/oferta`, data, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    logger.info('Oferta document generated', { cliente: data.cliente });

    return response.data;
  } catch (error) {
    logger.error('Error generating oferta document', { 
      error: error.message,
      response: error.response?.data 
    });
    throw new Error(`Error al generar oferta: ${error.message}`);
  }
}

/**
 * Generar documentación técnica
 */
export async function generateDocumentacion(data) {
  try {
    logger.debug('Generating technical documentation', { tipo: data.tipo_documento });

    const response = await axios.post(`${DOCGEN_URL}/generate/documentacion`, data, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    logger.info('Technical documentation generated', { tipo: data.tipo_documento });

    return response.data;
  } catch (error) {
    logger.error('Error generating documentation', { 
      error: error.message,
      response: error.response?.data 
    });
    throw new Error(`Error al generar documentación: ${error.message}`);
  }
}

/**
 * Verificar estado del servicio DocGen
 */
export async function checkHealth() {
  try {
    const response = await axios.get(`${DOCGEN_URL}/health`, { timeout: 5000 });
    return response.data;
  } catch (error) {
    logger.error('DocGen service health check failed', error);
    throw new Error('DocGen service is not available');
  }
}

export default {
  generateOferta,
  generateDocumentacion,
  checkHealth
};

