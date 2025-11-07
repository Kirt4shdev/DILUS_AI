import { query } from '../config/database.js';
import { generateEmbedding } from './embeddingService.js';
import { chunkText } from './documentService.js';
import { logger } from '../utils/logger.js';

const CHUNK_SIZE = parseInt(process.env.RAG_CHUNK_SIZE) || 1000;
const CHUNK_OVERLAP = parseInt(process.env.RAG_CHUNK_OVERLAP) || 200;
const TOP_K = parseInt(process.env.RAG_TOP_K) || 5;
const MIN_SIMILARITY = parseFloat(process.env.RAG_MIN_SIMILARITY) || 0.3; // Filtro mínimo muy bajo
const MIN_HYBRID_SCORE = parseFloat(process.env.RAG_MIN_HYBRID_SCORE) || 0.25; // Filtro mínimo muy bajo

/**
 * Ingerir documento: chunking + embeddings + guardar
 */
export async function ingestDocument(documentId, text, metadata = {}) {
  const startTime = Date.now();
  
  try {
    logger.info('Starting document ingestion', { documentId });

    // Actualizar estado a processing
    await query(
      'UPDATE documents SET vectorization_status = $1 WHERE id = $2',
      ['processing', documentId]
    );

    // Dividir en chunks
    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
    
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

    // Actualizar estado a completed
    await query(
      'UPDATE documents SET vectorization_status = $1, vectorization_error = NULL WHERE id = $2',
      ['completed', documentId]
    );

    const duration = Date.now() - startTime;
    logger.info('Document ingestion completed', { 
      documentId, 
      chunks: chunks.length,
      duration: `${duration}ms`
    });

    return {
      documentId,
      chunksCount: chunks.length,
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
    const {
      documentId = null,
      topK = TOP_K,
      isVaultOnly = false
    } = options;

    logger.debug('Searching similar chunks', { queryText: queryText.substring(0, 50), options });

    // Generar embedding de la query
    const queryEmbedding = await generateEmbedding(queryText);

    let sql;
    let params;

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
      params = [JSON.stringify(queryEmbedding), queryText, topK];
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
      params = [JSON.stringify(queryEmbedding), queryText, documentId, topK];
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
      params = [JSON.stringify(queryEmbedding), queryText, topK];
    }

    const result = await query(sql, params);

    // Filtro muy suave solo para eliminar chunks extremadamente irrelevantes
    const filteredResults = result.rows.filter(row => 
      row.vector_similarity >= MIN_SIMILARITY || row.hybrid_score >= MIN_HYBRID_SCORE
    );

    logger.info('Search completed', { 
      totalResults: result.rows.length,
      filteredResults: filteredResults.length,
      topScore: result.rows[0]?.hybrid_score || 0,
      topSimilarity: result.rows[0]?.vector_similarity || 0
    });

    // Retornar resultados con metadata de filtrado para logging posterior
    return {
      chunks: filteredResults,
      metadata: {
        totalCandidates: result.rows.length,
        selectedCount: filteredResults.length,
        rejectedCount: result.rows.length - filteredResults.length,
        minSimilarityThreshold: MIN_SIMILARITY,
        minHybridThreshold: MIN_HYBRID_SCORE
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

