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
 * GPT-5 y GPT-5-mini: AMBOS tienen 400k tokens de contexto
 * Límite conservador de 350k para input, dejando 50k para respuesta
 */
export function canFitInContext(text, maxTokens = 350000) {
  const tokens = estimateTokens(text);
  return tokens <= maxTokens;
}

/**
 * Verificar si un texto cabe para GPT-5 Standard
 * MISMO LÍMITE: GPT-5 y GPT-5-mini tienen idéntica capacidad de contexto (400k tokens)
 */
export function canFitInStandardContext(text) {
  // Ambos modelos tienen 400k tokens, usar el mismo límite
  return canFitInContext(text);
}

/**
 * Truncar historial de conversación para que quepa en el contexto
 * Mantiene los mensajes más recientes hasta el 75% del límite (262.5k tokens)
 */
export function truncateConversationHistory(messages, systemPrompt = '', maxTokens = 262500) {
  // Calcular tokens del system prompt
  const systemTokens = estimateTokens(systemPrompt);
  let availableTokens = maxTokens - systemTokens;
  
  const truncatedMessages = [];
  
  // Recorrer mensajes desde el más reciente al más antiguo
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageTokens = estimateTokens(message.content);
    
    if (messageTokens <= availableTokens) {
      truncatedMessages.unshift(message); // Agregar al inicio
      availableTokens -= messageTokens;
    } else {
      // Si el mensaje no cabe, detener (mantenemos solo los más recientes)
      logger.info('Truncating conversation history', { 
        originalMessages: messages.length, 
        keptMessages: truncatedMessages.length,
        remainingTokens: availableTokens
      });
      break;
    }
  }
  
  return truncatedMessages;
}

/**
 * Generar respuesta con GPT-5 Mini
 * Soporta tanto un prompt simple (string) como historial de conversación (array)
 */
export async function generateWithGPT5Mini(prompt, options = {}) {
  const startTime = Date.now();
  
  try {
    // Si prompt es un string, convertir a formato de mensajes
    let messages = [];
    
    if (typeof prompt === 'string') {
      // Modo simple: un solo mensaje de usuario
      messages = [{ role: 'user', content: prompt }];
    } else if (Array.isArray(prompt)) {
      // Modo conversacional: array de mensajes
      messages = prompt;
    } else {
      throw new Error('Prompt debe ser string o array de mensajes');
    }
    
    // Truncar si excede el 75% del contexto (262.5k tokens)
    const systemPrompt = options.systemPrompt || '';
    if (systemPrompt) {
      messages = [{ role: 'system', content: systemPrompt }, ...messages];
    }
    
    // Estimar tokens totales
    const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    
    if (totalTokens > 262500) {
      logger.warn('Conversation exceeds 75% context limit, truncating', { 
        totalTokens, 
        messagesCount: messages.length 
      });
      messages = truncateConversationHistory(
        messages.filter(m => m.role !== 'system'), 
        systemPrompt
      );
      if (systemPrompt) {
        messages = [{ role: 'system', content: systemPrompt }, ...messages];
      }
    }
    
    logger.debug('Calling GPT-5 Mini', { 
      messagesCount: messages.length,
      estimatedTokens: totalTokens
    });
    
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-5-mini',
        messages: messages
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
    const tokensInput = response.data.usage?.prompt_tokens || 0;
    const tokensOutput = response.data.usage?.completion_tokens || 0;

    logger.info('GPT-5 Mini response received', { 
      duration: `${duration}ms`, 
      tokens: tokensUsed,
      input: tokensInput,
      output: tokensOutput
    });

    return {
      result,
      tokensUsed,
      tokensInput,
      tokensOutput,
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
    const tokensInput = response.data.usage?.prompt_tokens || 0;
    const tokensOutput = response.data.usage?.completion_tokens || 0;

    logger.info('GPT-5 Standard response received', { 
      duration: `${duration}ms`, 
      tokens: tokensUsed,
      input: tokensInput,
      output: tokensOutput
    });

    return {
      result,
      tokensUsed,
      tokensInput,
      tokensOutput,
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
  parseAIResponse,
  truncateConversationHistory
};

