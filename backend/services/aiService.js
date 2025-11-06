import axios from 'axios';
import { logger } from '../utils/logger.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_KEY_STANDARD = process.env.OPENAI_API_KEY_STANDARD || OPENAI_API_KEY;

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Estimar tokens de un texto (aproximado)
 * 1 token ≈ 4 caracteres para inglés, ~3 para español
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

/**
 * Verificar si un texto cabe en el contexto según el modelo
 * GPT-5 Mini: Límite conservador 100k tokens (dejando espacio para respuesta)
 * Para análisis general
 */
export function canFitInContext(text, maxTokens = 100000) {
  const tokens = estimateTokens(text);
  return tokens <= maxTokens;
}

/**
 * Verificar si un texto cabe para GPT-5 Standard (límites más estrictos)
 * GPT-5: Límite conservador de 20k tokens para evitar límites de TPM
 */
export function canFitInStandardContext(text) {
  const tokens = estimateTokens(text);
  // Límite de 20k tokens para input, dejando espacio para la respuesta
  return tokens <= 20000;
}

/**
 * Generar respuesta con GPT-5 Mini
 */
export async function generateWithGPT5Mini(prompt, options = {}) {
  const startTime = Date.now();
  
  try {
    logger.debug('Calling GPT-5 Mini', { promptLength: prompt.length });
    
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const duration = Date.now() - startTime;
    const result = response.data.choices[0].message.content;
    const tokensUsed = response.data.usage?.total_tokens || 0;

    logger.info('GPT-5 Mini response received', { 
      duration: `${duration}ms`, 
      tokens: tokensUsed 
    });

    return {
      result,
      tokensUsed,
      duration,
      model: 'gpt-5-mini'
    };
  } catch (error) {
    logger.error('Error calling GPT-5 Mini', { 
      error: error.message,
      response: error.response?.data 
    });
    throw new Error(`Error en GPT-5 Mini: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Generar respuesta con GPT-5 Standard (análisis profundo)
 */
export async function generateWithGPT5Standard(prompt, options = {}) {
  const startTime = Date.now();
  
  try {
    logger.debug('Calling GPT-5 Standard', { promptLength: prompt.length });
    
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-5',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY_STANDARD}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const duration = Date.now() - startTime;
    const result = response.data.choices[0].message.content;
    const tokensUsed = response.data.usage?.total_tokens || 0;

    logger.info('GPT-5 Standard response received', { 
      duration: `${duration}ms`, 
      tokens: tokensUsed 
    });

    return {
      result,
      tokensUsed,
      duration,
      model: 'gpt-5'
    };
  } catch (error) {
    logger.error('Error calling GPT-5 Standard', { 
      error: error.message,
      response: error.response?.data 
    });
    throw new Error(`Error en GPT-5 Standard: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Parsear respuesta JSON de la IA
 */
export function parseAIResponse(text) {
  try {
    // Remover markdown code blocks si existen
    let cleaned = text.trim();
    cleaned = cleaned.replace(/```json\n?/g, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    cleaned = cleaned.trim();
    
    return JSON.parse(cleaned);
  } catch (error) {
    logger.warn('Failed to parse AI response as JSON', { text: text.substring(0, 200) });
    // Retornar el texto tal cual si no es JSON válido
    return { raw_response: text };
  }
}

export default {
  generateWithGPT5Mini,
  generateWithGPT5Standard,
  estimateTokens,
  canFitInContext,
  canFitInStandardContext,
  parseAIResponse
};

