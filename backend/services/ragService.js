import { query } from '../config/database.js';
import { generateEmbedding } from './embeddingService.js';
import { chunkText } from './documentService.js';
import { logger } from '../utils/logger.js';
import { estimateTokens, calculateEmbeddingCost, getCurrentEmbeddingModel } from '../utils/tokenCounter.js';
import { getConfigValue } from './ragConfigService.js';

// Valores por defecto (fallback si no hay BD)
const DEFAULT_CHUNK_SIZE = parseInt(process.env.RAG_CHUNK_SIZE) || 1000;
const DEFAULT_CHUNK_OVERLAP = parseInt(process.env.RAG_CHUNK_OVERLAP) || 200;
const DEFAULT_TOP_K = parseInt(process.env.RAG_TOP_K) || 5;
const DEFAULT_MIN_SIMILARITY = parseFloat(process.env.RAG_MIN_SIMILARITY) || 0.3;
const DEFAULT_MIN_HYBRID_SCORE = parseFloat(process.env.RAG_MIN_HYBRID_SCORE) || 0.25;

/**
 * Obtener parámetros dinámicos de configuración
 */
async function getRAGParams() {
  try {
    const [chunkSize, chunkOverlap, topK, minSimilarity, minHybridScore, vectorWeight, bm25Weight] = await Promise.all([
      getConfigValue('chunk_size', DEFAULT_CHUNK_SIZE),
      getConfigValue('chunk_overlap', DEFAULT_CHUNK_OVERLAP),
      getConfigValue('top_k', DEFAULT_TOP_K),
      getConfigValue('min_similarity', DEFAULT_MIN_SIMILARITY),
      getConfigValue('min_hybrid_score', DEFAULT_MIN_HYBRID_SCORE),
      getConfigValue('vector_weight', 0.6),
      getConfigValue('bm25_weight', 0.4)
    ]);

    return {
      chunkSize,
      chunkOverlap,
      topK,
      minSimilarity,
      minHybridScore,
      vectorWeight,
      bm25Weight
    };
  } catch (error) {
    logger.error('Error getting RAG params, using defaults', { error: error.message });
    return {
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      topK: DEFAULT_TOP_K,
      minSimilarity: DEFAULT_MIN_SIMILARITY,
      minHybridScore: DEFAULT_MIN_HYBRID_SCORE,
      vectorWeight: 0.6,
      bm25Weight: 0.4
    };
  }
}

/**
 * Registrar coste de operación de embedding
 */
async function logEmbeddingCost(operationType, tokens, options = {}) {
  const model = getCurrentEmbeddingModel();
  const cost = calculateEmbeddingCost(tokens, model);
  
  try {
    await query(
      `INSERT INTO embedding_costs 
       (operation_type, user_id, document_id, project_id, tokens_used, cost_usd, model_used, operation_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        operationType,
        options.userId || null,
        options.documentId || null,
        options.projectId || null,
        tokens,
        cost,
        model,
        JSON.stringify(options.metadata || {})
      ]
    );
    
    logger.debug('Embedding cost logged', { operationType, tokens, cost: `$${cost.toFixed(6)}` });
  } catch (error) {
    logger.error('Error logging embedding cost', { error: error.message });
    // No lanzar error, solo log - no queremos que falle la operación principal
  }
}

/**
 * Ingerir documento: chunking + embeddings + guardar
 */
export async function ingestDocument(documentId, text, metadata = {}) {
  const startTime = Date.now();
  let totalTokens = 0;
  
  try {
    logger.info('Starting document ingestion', { documentId });

    // Obtener parámetros dinámicos
    const params = await getRAGParams();

    // Obtener info del documento para logging de costes
    const docResult = await query('SELECT uploaded_by, project_id FROM documents WHERE id = $1', [documentId]);
    const userId = docResult.rows[0]?.uploaded_by;
    const projectId = docResult.rows[0]?.project_id;

    // Actualizar estado a processing
    await query(
      'UPDATE documents SET vectorization_status = $1 WHERE id = $2',
      ['processing', documentId]
    );

    // Dividir en chunks con parámetros dinámicos
    const chunks = chunkText(text, params.chunkSize, params.chunkOverlap);
    
    if (chunks.length === 0) {
      throw new Error('No se pudieron extraer chunks del documento');
    }

    logger.info('Document chunked', { documentId, chunks: chunks.length });

    // Generar embeddings para cada chunk (en batches de 10)
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => c.text);
      
      logger.debug('Processing embedding batch', { 
        batch: Math.floor(i / batchSize) + 1,
        chunks: batch.length 
      });

      // Calcular tokens del batch
      const batchTokens = texts.reduce((sum, text) => sum + estimateTokens(text), 0);
      totalTokens += batchTokens;

      const embeddings = await generateEmbeddings(texts);

      // Guardar en base de datos
      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = i + j;
        const embedding = embeddings[j];
        const chunk = batch[j];

        await query(
          `INSERT INTO embeddings (document_id, chunk_text, chunk_index, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            documentId,
            chunk.text,
            chunkIndex,
            JSON.stringify(embedding),
            JSON.stringify({ ...metadata, start: chunk.startIndex, end: chunk.endIndex })
          ]
        );
      }
    }

    // Registrar coste total de embeddings del documento
    await logEmbeddingCost('document_ingestion', totalTokens, {
      userId,
      documentId,
      projectId,
      metadata: {
        chunksCount: chunks.length,
        textLength: text.length
      }
    });

    // Actualizar estado a completed
    await query(
      'UPDATE documents SET vectorization_status = $1, vectorization_error = NULL WHERE id = $2',
      ['completed', documentId]
    );

    const duration = Date.now() - startTime;
    logger.info('Document ingestion completed', { 
      documentId, 
      chunks: chunks.length,
      tokensUsed: totalTokens,
      duration: `${duration}ms`
    });

    return {
      documentId,
      chunksCount: chunks.length,
      tokensUsed: totalTokens,
      duration
    };
  } catch (error) {
    logger.error('Error ingesting document', { documentId, error: error.message });
    
    // Actualizar estado a failed
    await query(
      'UPDATE documents SET vectorization_status = $1, vectorization_error = $2 WHERE id = $3',
      ['failed', error.message, documentId]
    );

    throw error;
  }
}

/**
 * Buscar chunks similares usando búsqueda híbrida
 */
export async function searchSimilar(queryText, options = {}) {
  try {
    // Obtener parámetros dinámicos
    const params = await getRAGParams();
    
    const {
      documentId = null,
      topK = options.topK || params.topK,
      isVaultOnly = false,
      userId = null,
      projectId = null
    } = options;

    logger.debug('Searching similar chunks', { queryText: queryText.substring(0, 50), options, params });

    // Calcular tokens y registrar coste
    const queryTokens = estimateTokens(queryText);

    // Generar embedding de la query
    const queryEmbedding = await generateEmbedding(queryText);
    
    // Registrar coste de la búsqueda
    const operationType = isVaultOnly ? 'vault_query' : documentId ? 'document_query' : 'general_query';
    await logEmbeddingCost(operationType, queryTokens, {
      userId,
      documentId,
      projectId,
      metadata: {
        queryLength: queryText.length,
        topK
      }
    });

    let sql;
    let sqlParams;

    if (isVaultOnly) {
      // Buscar solo en documentos de la bóveda
      sql = `
        SELECT 
          e.id,
          e.document_id,
          e.chunk_text,
          e.chunk_index,
          (1 - (e.embedding <=> $1::vector))::FLOAT AS vector_similarity,
          ts_rank(e.tsv, plainto_tsquery('spanish', $2))::FLOAT AS bm25_score,
          (
            (1 - (e.embedding <=> $1::vector)) * 0.6 +
            ts_rank(e.tsv, plainto_tsquery('spanish', $2)) * 0.4
          )::FLOAT AS hybrid_score,
          e.metadata,
          d.filename,
          d.is_vault_document
        FROM embeddings e
        JOIN documents d ON e.document_id = d.id
        WHERE 
          d.is_vault_document = TRUE
        ORDER BY hybrid_score DESC
        LIMIT $3
      `;
      sqlParams = [JSON.stringify(queryEmbedding), queryText, topK];
    } else if (documentId) {
      // Buscar en documento específico
      sql = `
        SELECT 
          e.id,
          e.document_id,
          e.chunk_text,
          e.chunk_index,
          (1 - (e.embedding <=> $1::vector))::FLOAT AS vector_similarity,
          ts_rank(e.tsv, plainto_tsquery('spanish', $2))::FLOAT AS bm25_score,
          (
            (1 - (e.embedding <=> $1::vector)) * 0.6 +
            ts_rank(e.tsv, plainto_tsquery('spanish', $2)) * 0.4
          )::FLOAT AS hybrid_score,
          e.metadata
        FROM embeddings e
        WHERE 
          e.document_id = $3
        ORDER BY hybrid_score DESC
        LIMIT $4
      `;
      sqlParams = [JSON.stringify(queryEmbedding), queryText, documentId, topK];
    } else {
      // Buscar en todos los documentos
      sql = `
        SELECT 
          e.id,
          e.document_id,
          e.chunk_text,
          e.chunk_index,
          (1 - (e.embedding <=> $1::vector))::FLOAT AS vector_similarity,
          ts_rank(e.tsv, plainto_tsquery('spanish', $2))::FLOAT AS bm25_score,
          (
            (1 - (e.embedding <=> $1::vector)) * 0.6 +
            ts_rank(e.tsv, plainto_tsquery('spanish', $2)) * 0.4
          )::FLOAT AS hybrid_score,
          e.metadata,
          d.filename
        FROM embeddings e
        JOIN documents d ON e.document_id = d.id
        ORDER BY hybrid_score DESC
        LIMIT $3
      `;
      sqlParams = [JSON.stringify(queryEmbedding), queryText, topK];
    }

    const result = await query(sql, sqlParams);

    // Filtro con parámetros dinámicos
    const filteredResults = result.rows.filter(row => 
      row.vector_similarity >= params.minSimilarity || row.hybrid_score >= params.minHybridScore
    );

    logger.info('Search completed', { 
      totalResults: result.rows.length,
      filteredResults: filteredResults.length,
      topScore: result.rows[0]?.hybrid_score || 0,
      topSimilarity: result.rows[0]?.vector_similarity || 0,
      thresholds: { minSimilarity: params.minSimilarity, minHybridScore: params.minHybridScore }
    });

    // Retornar resultados con metadata de filtrado para logging posterior
    return {
      chunks: filteredResults,
      metadata: {
        totalCandidates: result.rows.length,
        selectedCount: filteredResults.length,
        rejectedCount: result.rows.length - filteredResults.length,
        minSimilarityThreshold: params.minSimilarity,
        minHybridThreshold: params.minHybridScore
      }
    };
  } catch (error) {
    logger.error('Error searching similar chunks', error);
    throw error;
  }
}

/**
 * Obtener contexto de chunks para análisis
 */
export async function getContextFromChunks(chunks) {
  if (!chunks || chunks.length === 0) {
    return '';
  }

  return chunks
    .map((chunk, index) => `[Fragmento ${index + 1}]:\n${chunk.chunk_text}`)
    .join('\n\n---\n\n');
}

/**
 * Buscar en documento específico
 */
export async function searchInDocument(documentId, queryText, options = {}) {
  return searchSimilar(queryText, { ...options, documentId });
}

/**
 * Buscar en la bóveda (documentos de admin)
 */
export async function searchInVault(queryText, options = {}) {
  return searchSimilar(queryText, { ...options, isVaultOnly: true });
}

/**
 * Exportar funciones de utilidad para costes
 */
export { estimateTokens, calculateEmbeddingCost };

/**
 * Guardar historial de chunks seleccionados/rechazados para análisis
 */
export async function logChunkSelection(params) {
  try {
    const {
      chunks = [],
      queryText,
      queryEmbedding,
      operationType,
      operationSubtype,
      userId,
      projectId,
      metadata
    } = params;

    if (!chunks || chunks.length === 0) {
      return;
    }

    const { minSimilarityThreshold, minHybridThreshold } = metadata || {};

    // Guardar cada chunk en el historial
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const wasSelected = (chunk.vector_similarity >= minSimilarityThreshold) || 
                         (chunk.hybrid_score >= minHybridThreshold);
      
      let rejectionReason = null;
      if (!wasSelected) {
        if (chunk.vector_similarity < minSimilarityThreshold && chunk.hybrid_score < minHybridThreshold) {
          rejectionReason = 'Below both thresholds';
        }
      }

      await query(
        `INSERT INTO chunk_selection_history (
          chunk_id, chunk_text, chunk_index, document_id, document_name,
          vector_similarity, bm25_score, hybrid_score,
          min_similarity_threshold, min_hybrid_threshold,
          operation_type, operation_subtype, user_id, project_id,
          query_text, query_embedding_preview,
          was_selected, rejection_reason, rank_position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          chunk.id,
          chunk.chunk_text?.substring(0, 500) || '',
          chunk.chunk_index,
          chunk.document_id,
          chunk.filename || null,
          chunk.vector_similarity,
          chunk.bm25_score || 0,
          chunk.hybrid_score,
          minSimilarityThreshold,
          minHybridThreshold,
          operationType,
          operationSubtype || null,
          userId || null,
          projectId || null,
          queryText?.substring(0, 200) || '',
          queryEmbedding ? JSON.stringify(queryEmbedding).substring(0, 100) : null,
          wasSelected,
          rejectionReason,
          i + 1
        ]
      );
    }

    logger.debug('Chunk selection history logged', { 
      chunks: chunks.length, 
      operationType,
      operationSubtype 
    });
  } catch (error) {
    // No fallar la operación principal si el logging falla
    logger.error('Error logging chunk selection', { error: error.message });
  }
}

// Importar generateEmbeddings desde embeddingService
import { generateEmbeddings } from './embeddingService.js';

export default {
  ingestDocument,
  searchSimilar,
  searchInDocument,
  searchInVault,
  getContextFromChunks,
  logChunkSelection
};

