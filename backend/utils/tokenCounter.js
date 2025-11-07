/**
 * Token counter utilities for embeddings cost calculation
 * Uses cl100k_base encoding approximation (GPT-4/text-embedding models)
 */

/**
 * Approximate token count for text
 * Uses a simple heuristic: ~4 characters per token (average for English/Spanish)
 * For more accuracy, could integrate tiktoken library
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  // Remove extra whitespace
  const cleanText = text.trim().replace(/\s+/g, ' ');
  
  // Heuristic: ~4 chars per token for mixed English/Spanish
  // This is slightly conservative (underestimates) which is safer
  const estimatedTokens = Math.ceil(cleanText.length / 4);
  
  return estimatedTokens;
}

/**
 * Calculate cost for embedding tokens
 * @param {number} tokens - Number of tokens
 * @param {string} model - Model name
 * @returns {number} Cost in USD
 */
export function calculateEmbeddingCost(tokens, model = 'text-embedding-ada-002') {
  const costs = {
    'text-embedding-ada-002': 0.0001 / 1000,      // $0.10 per 1M tokens
    'text-embedding-3-small': 0.00002 / 1000,     // $0.02 per 1M tokens
    'text-embedding-3-large': 0.00013 / 1000      // $0.13 per 1M tokens
  };
  
  const costPerToken = costs[model] || costs['text-embedding-ada-002'];
  return tokens * costPerToken;
}

/**
 * Get current embedding model from environment
 */
export function getCurrentEmbeddingModel() {
  return process.env.EMBEDDING_MODEL || 'text-embedding-ada-002';
}

export default {
  estimateTokens,
  calculateEmbeddingCost,
  getCurrentEmbeddingModel
};

