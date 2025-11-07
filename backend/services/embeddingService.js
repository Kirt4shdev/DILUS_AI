import axios from 'axios';
import { logger } from '../utils/logger.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';

/**
 * Generar embedding de un texto usando text-embedding-ada-002
 * Ada-002 ofrece mejor calidad semántica para español con excelente balance precio/rendimiento
 */
export async function generateEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Texto vacío para generar embedding');
    }

    logger.debug('Generating embedding', { textLength: text.length });

    const response = await axios.post(
      OPENAI_EMBEDDING_URL,
      {
        model: 'text-embedding-ada-002',
        input: text,
        encoding_format: 'float'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const embedding = response.data.data[0].embedding;
    
    if (!Array.isArray(embedding) || embedding.length !== 1536) {
      throw new Error('Embedding inválido recibido de OpenAI');
    }

    logger.debug('Embedding generated successfully', { dimensions: embedding.length });

    return embedding;
  } catch (error) {
    logger.error('Error generating embedding', { 
      error: error.message,
      response: error.response?.data 
    });
    throw new Error(`Error al generar embedding: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Generar embeddings para múltiples textos (batch)
 */
export async function generateEmbeddings(texts) {
  try {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Array de textos vacío');
    }

    logger.debug('Generating embeddings batch', { count: texts.length });

    const response = await axios.post(
      OPENAI_EMBEDDING_URL,
      {
        model: 'text-embedding-ada-002',
        input: texts,
        encoding_format: 'float'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const embeddings = response.data.data.map(item => item.embedding);
    
    logger.debug('Embeddings generated successfully', { count: embeddings.length });

    return embeddings;
  } catch (error) {
    logger.error('Error generating embeddings batch', { 
      error: error.message,
      response: error.response?.data 
    });
    throw new Error(`Error al generar embeddings: ${error.response?.data?.error?.message || error.message}`);
  }
}

export default {
  generateEmbedding,
  generateEmbeddings
};

