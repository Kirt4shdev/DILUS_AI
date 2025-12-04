import { query } from '../config/database.js';
import { generateEmbedding } from './embeddingService.js';
import { chunkText } from './documentService.js';
import { logger } from '../utils/logger.js';
import { estimateTokens, calculateEmbeddingCost, getCurrentEmbeddingModel } from '../utils/tokenCounter.js';
import { getConfigValue } from './ragConfigService.js';
import { extractDocumentMetadata, buildChunkMetadata } from './metadataService.js';

// Valores por defecto (fallback si no hay BD)
const DEFAULT_CHUNK_SIZE = parseInt(process.env.RAG_CHUNK_SIZE) || 1000;
const DEFAULT_CHUNK_OVERLAP = parseInt(process.env.RAG_CHUNK_OVERLAP) || 200;
const DEFAULT_TOP_K = parseInt(process.env.RAG_TOP_K) || 5;
const DEFAULT_MIN_SIMILARITY = parseFloat(process.env.RAG_MIN_SIMILARITY) || 0.3;
const DEFAULT_MIN_HYBRID_SCORE = parseFloat(process.env.RAG_MIN_HYBRID_SCORE) || 0.25;

// Cache de parámetros RAG en memoria (refresco cada 60 segundos)
let cachedRAGParams = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 60 segundos

/**
 * Obtener parámetros dinámicos de configuración (con caché)
 */
async function getRAGParams() {
  const now = Date.now();
  
  // Usar caché si está vigente
  if (cachedRAGParams && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedRAGParams;
  }
  
  try {
    const [chunkSize, chunkOverlap, topK, minSimilarity, minHybridScore, vectorWeight, bm25Weight] = await Promise.all([
      getConfigValue('chunk_size', DEFAULT_CHUNK_SIZE),
      getConfigValue('chunk_overlap', DEFAULT_CHUNK_OVERLAP),
      getConfigValue('top_k', DEFAULT_TOP_K),
      getConfigValue('min_similarity', DEFAULT_MIN_SIMILARITY),
      getConfigValue('min_hybrid_score', DEFAULT_MIN_HYBRID_SCORE),
      getConfigValue('vector_weight', 0.7), // Aumentado de 0.6 a 0.7 (vector es más rápido)
      getConfigValue('bm25_weight', 0.3)    // Reducido de 0.4 a 0.3
    ]);

    cachedRAGParams = {
      chunkSize,
      chunkOverlap,
      topK,
      minSimilarity,
      minHybridScore,
      vectorWeight,
      bm25Weight
    };
    
    cacheTimestamp = now;
    return cachedRAGParams;
  } catch (error) {
    logger.error('Error getting RAG params, using defaults', { error: error.message });
    cachedRAGParams = {
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      topK: DEFAULT_TOP_K,
      minSimilarity: DEFAULT_MIN_SIMILARITY,
      minHybridScore: DEFAULT_MIN_HYBRID_SCORE,
      vectorWeight: 0.7,
      bm25Weight: 0.3
    };
    cacheTimestamp = now;
    return cachedRAGParams;
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
    logger.info('Starting document ingestion', { 
      documentId,
      textLength: text?.length || 0,
      textPreview: text?.substring(0, 100) || 'EMPTY'
    });

    // Obtener parámetros dinámicos
    const params = await getRAGParams();
    logger.debug('RAG params loaded', { params });

    // Obtener info del documento para logging de costes
    const docResult = await query(
      'SELECT uploaded_by, project_id, filename, mime_type, is_vault_document FROM documents WHERE id = $1', 
      [documentId]
    );
    const docInfo = docResult.rows[0];
    const userId = docInfo?.uploaded_by;
    const projectId = docInfo?.project_id;
    const filename = docInfo?.filename;

    logger.info('Document info retrieved', { documentId, filename, userId, projectId });

    // EXTRACCIÓN AUTOMÁTICA DE METADATA CON IA
    logger.info('Extracting document metadata with GPT-5-mini', { documentId, filename });
    const extractedMetadata = await extractDocumentMetadata(text, filename);
    logger.info('Metadata extracted', { documentId, extractedMetadata });

    // Actualizar estado a processing
    await query(
      'UPDATE documents SET vectorization_status = $1 WHERE id = $2',
      ['processing', documentId]
    );

    // Dividir en chunks con parámetros dinámicos
    const chunkingMethod = await getConfigValue('chunking_method', 'fixed');
    logger.info('Starting chunking', { documentId, method: chunkingMethod, chunkSize: params.chunkSize, overlap: params.chunkOverlap });
    
    const chunks = chunkText(text, params.chunkSize, params.chunkOverlap, chunkingMethod);
    
    if (chunks.length === 0) {
      throw new Error('No se pudieron extraer chunks del documento');
    }

    logger.info('Document chunked successfully', { documentId, chunks: chunks.length });

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

      // Guardar en base de datos con metadata enriquecido
      for (let j = 0; j < batch.length; j++) {
        const chunkIndex = i + j;
        const embedding = embeddings[j];
        const chunk = batch[j];

        // Construir metadata completo (doc + chunk + embedding)
        const chunkMetadata = buildChunkMetadata(
          {
            filename: docInfo.filename,
            uploaded_by: docInfo.uploaded_by,
            project_id: docInfo.project_id,
            mime_type: docInfo.mime_type,
            is_vault_document: docInfo.is_vault_document,
            creation_origin: metadata.creation_origin || 'humano'
          },
          {
            chunk_index: chunkIndex,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            chunk_method: chunkingMethod,
            chunk_length: chunk.text.length,
            chunk_tokens: estimateTokens(chunk.text)
          },
          extractedMetadata
        );

        await query(
          `INSERT INTO embeddings (document_id, chunk_text, chunk_index, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            documentId,
            chunk.text,
            chunkIndex,
            JSON.stringify(embedding),
            JSON.stringify(chunkMetadata)
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
    logger.error('Error ingesting document', { 
      documentId, 
      errorMessage: error.message,
      errorStack: error.stack,
      errorType: error.constructor.name,
      errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    
    // Log completo a consola para debug
    console.error('=== FULL ERROR DETAILS ===');
    console.error('Document ID:', documentId);
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('========================');
    
    // Actualizar estado a failed
    await query(
      'UPDATE documents SET vectorization_status = $1, vectorization_error = $2 WHERE id = $3',
      ['failed', error.message, documentId]
    );

    throw error;
  }
}

/**
 * Detectar si la query menciona un equipo específico
 * Busca patrones comunes de nombres de equipos en la query de forma flexible
 * Soporta mayúsculas/minúsculas, errores tipográficos y variaciones
 * 
 * @param {string} queryText - Texto de la query
 * @returns {Array<string>} - Array de variantes del equipo detectado, o array vacío
 */
function detectEquipmentInQuery(queryText) {
  if (!queryText) return [];
  
  const detected = [];
  const normalizedQuery = queryText.toLowerCase();
  
  // Patrón 1: Código alfanumérico con símbolos (más flexible)
  // Ejemplos: WS600, ws600, RPU-3000, rpu3000, CMP6, cmp-6, RAZON+, razon+
  const alphanumericPattern = /\b([a-z]{2,}[-_\s]*[+]?[\d]*|[a-z]+\d+[a-z]*)\b/gi;
  const alphanumericMatches = queryText.match(alphanumericPattern);
  
  if (alphanumericMatches && alphanumericMatches.length > 0) {
    // Filtrar solo los que parecen códigos de equipo (tienen números o símbolos especiales)
    const equipmentCodes = alphanumericMatches.filter(match => {
      const normalized = match.toLowerCase().trim();
      // Debe tener al menos 3 caracteres
      if (normalized.length < 3) return false;
      // Debe tener números O el símbolo + (para RAZON+)
      return /\d/.test(normalized) || /[+]/.test(normalized);
    });
    
    equipmentCodes.forEach(code => {
      const normalized = code.trim();
      detected.push(normalized);
      
      // Generar variantes del código
      const variants = generateEquipmentVariants(normalized);
      detected.push(...variants);
    });
  }
  
  // Patrón 2: Palabras que parezcan nombres de equipos/modelos
  // Buscar palabras específicas conocidas
  const knownEquipmentNames = [
    'razon', 'rason', 'razon+', 'rason+',
    'ws600', 'ws-600', 'ws 600',
    'rpu3000', 'rpu-3000', 'rpu 3000',
    'cmp6', 'cmp-6', 'cmp 6',
    'chp1', 'chp-1', 'chp 1',
    'abc123', 'abc-123'
  ];
  
  knownEquipmentNames.forEach(name => {
    if (normalizedQuery.includes(name)) {
      detected.push(name);
      const variants = generateEquipmentVariants(name);
      detected.push(...variants);
    }
  });
  
  // Eliminar duplicados y retornar
  const uniqueDetected = [...new Set(detected)].filter(d => d && d.length >= 3);
  
  if (uniqueDetected.length > 0) {
    logger.info('Equipment detected in query (fuzzy)', { 
      query: queryText, 
      detected: uniqueDetected.slice(0, 5) // Log solo primeras 5
    });
  }
  
  return uniqueDetected;
}

/**
 * Generar variantes de un código de equipo para búsqueda fuzzy
 * Ej: "razon+" → ["razon+", "razon", "rason+", "rason", "razon +"]
 * 
 * @param {string} equipment - Código del equipo
 * @returns {Array<string>} - Array de variantes
 */
function generateEquipmentVariants(equipment) {
  const variants = [];
  const normalized = equipment.toLowerCase().trim();
  
  // Variante sin espacios ni guiones
  const withoutSeparators = normalized.replace(/[-_\s]/g, '');
  variants.push(withoutSeparators);
  
  // Variante con espacios antes de números
  const withSpaces = normalized.replace(/(\d)/g, ' $1').trim();
  variants.push(withSpaces);
  
  // Variante con guiones antes de números
  const withDashes = normalized.replace(/(\d)/g, '-$1').replace(/^-/, '');
  variants.push(withDashes);
  
  // Si tiene +, agregar variante sin +
  if (normalized.includes('+')) {
    variants.push(normalized.replace(/\+/g, ''));
    variants.push(normalized.replace(/\+/g, ' plus'));
  }
  
  // Variantes con errores tipográficos comunes
  // z <-> s (razon <-> rason)
  if (normalized.includes('z')) {
    variants.push(normalized.replace(/z/g, 's'));
  }
  if (normalized.includes('s')) {
    variants.push(normalized.replace(/s/g, 'z'));
  }
  
  // Eliminar duplicados
  return [...new Set(variants)].filter(v => v && v !== normalized);
}

/**
 * Buscar chunks similares usando búsqueda híbrida
 */
export async function searchSimilar(queryText, options = {}) {
  try {
    const searchStartTime = Date.now();
    const timings = {};
    
    // PASO 1: Obtener parámetros dinámicos
    const step1Start = Date.now();
    const params = await getRAGParams();
    timings.step1_getParams = Date.now() - step1Start;
    
    const {
      documentId = null,
      topK = options.topK || params.topK,
      isVaultOnly = false,
      userId = null,
      projectId = null,
      filterByEquipment = true // Nuevo parámetro para habilitar/deshabilitar filtro
    } = options;

    logger.debug('Searching similar chunks', { queryText: queryText.substring(0, 50), options, params, timing: timings.step1_getParams });

    // PASO 2: DETECCIÓN DE EQUIPO EN LA QUERY (mejorada con fuzzy matching)
    const step2Start = Date.now();
    let detectedEquipments = [];
    if (filterByEquipment && !documentId) {
      detectedEquipments = detectEquipmentInQuery(queryText);
      if (detectedEquipments.length > 0) {
        logger.info('Equipment detected in query, will filter by metadata (fuzzy)', { 
          equipments: detectedEquipments.slice(0, 5),
          totalVariants: detectedEquipments.length
        });
      }
    }
    timings.step2_fuzzyDetection = Date.now() - step2Start;
    logger.debug('Fuzzy detection completed', { duration: timings.step2_fuzzyDetection });

    // PASO 3: Calcular tokens
    const step3Start = Date.now();
    const queryTokens = estimateTokens(queryText);
    timings.step3_tokenEstimate = Date.now() - step3Start;

    // PASO 4: Generar embedding de la query
    const step4Start = Date.now();
    const queryEmbedding = await generateEmbedding(queryText);
    timings.step4_generateEmbedding = Date.now() - step4Start;
    logger.debug('Query embedding generated', { duration: timings.step4_generateEmbedding });
    
    // PASO 5: Registrar coste de la búsqueda
    const step5Start = Date.now();
    const operationType = isVaultOnly ? 'vault_query' : documentId ? 'document_query' : 'general_query';
    await logEmbeddingCost(operationType, queryTokens, {
      userId,
      documentId,
      projectId,
      metadata: {
        queryLength: queryText.length,
        topK,
        detectedEquipments: detectedEquipments.slice(0, 3)
      }
    });
    timings.step5_logCost = Date.now() - step5Start;

    let sql;
    let sqlParams;

    // PASO 6: Construir condición de filtrado fuzzy si se detectaron equipos
    const step6Start = Date.now();
    const buildEquipmentFilter = (paramOffset) => {
      if (detectedEquipments.length === 0) return { condition: '', params: [] };
      
      const conditions = [];
      const params = [];
      
      detectedEquipments.forEach((variant, idx) => {
        const paramIdx = paramOffset + (idx * 2);
        conditions.push(`(
          e.metadata->'doc'->>'equipo' ILIKE $${paramIdx} OR 
          e.metadata->'doc'->>'fabricante' ILIKE $${paramIdx + 1}
        )`);
        params.push(`%${variant}%`, `%${variant}%`);
      });
      
      return {
        condition: `AND (${conditions.join(' OR ')})`,
        params
      };
    };

    if (isVaultOnly) {
      // Buscar solo en documentos de la bóveda
      const equipmentFilter = buildEquipmentFilter(4);
      
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
          ${equipmentFilter.condition}
        ORDER BY hybrid_score DESC
        LIMIT $3
      `;
      sqlParams = [JSON.stringify(queryEmbedding), queryText, topK, ...equipmentFilter.params];
        
    } else if (documentId) {
      // Buscar en documento específico (sin filtro de equipo)
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
      // Buscar en todos los documentos con filtro fuzzy
      const equipmentFilter = buildEquipmentFilter(4);
      
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
        ${equipmentFilter.condition ? 'WHERE 1=1 ' + equipmentFilter.condition : ''}
        ORDER BY hybrid_score DESC
        LIMIT $3
      `;
      sqlParams = [JSON.stringify(queryEmbedding), queryText, topK, ...equipmentFilter.params];
    }
    timings.step6_buildQuery = Date.now() - step6Start;
    logger.debug('SQL query built', { duration: timings.step6_buildQuery });

    // PASO 7: Ejecutar query SQL
    const step7Start = Date.now();
    const result = await query(sql, sqlParams);
    timings.step7_sqlExecution = Date.now() - step7Start;
    logger.debug('SQL query executed', { duration: timings.step7_sqlExecution, rowsReturned: result.rows.length });

    logger.info('RAG query executed', {
      requestedTopK: topK,
      sqlResultCount: result.rows.length,
      detectedEquipments: detectedEquipments.slice(0, 3),
      filteredByEquipment: detectedEquipments.length > 0,
      variantsUsed: detectedEquipments.length,
      firstResult: result.rows[0] ? {
        vector_similarity: result.rows[0].vector_similarity,
        hybrid_score: result.rows[0].hybrid_score,
        document: result.rows[0].filename
      } : null,
      thresholds: { 
        minSimilarity: params.minSimilarity, 
        minHybridScore: params.minHybridScore 
      }
    });

    // PASO 8: Filtrar resultados por threshold
    const step8Start = Date.now();
    const filteredResults = result.rows.filter(row => 
      row.vector_similarity >= params.minSimilarity || row.hybrid_score >= params.minHybridScore
    );
    timings.step8_filtering = Date.now() - step8Start;

    // Tiempo total
    timings.total = Date.now() - searchStartTime;

    logger.info('Search completed with detailed timings', { 
      requestedTopK: topK,
      sqlResults: result.rows.length,
      afterFilterResults: filteredResults.length,
      rejectedByFilter: result.rows.length - filteredResults.length,
      topScore: result.rows[0]?.hybrid_score || 0,
      topSimilarity: result.rows[0]?.vector_similarity || 0,
      thresholds: { minSimilarity: params.minSimilarity, minHybridScore: params.minHybridScore },
      detectedEquipments: detectedEquipments.slice(0, 3),
      fuzzyMatchingActive: detectedEquipments.length > 0,
      timings: {
        ...timings,
        breakdown: {
          step1_getParams: `${((timings.step1_getParams / timings.total) * 100).toFixed(1)}%`,
          step2_fuzzyDetection: `${((timings.step2_fuzzyDetection / timings.total) * 100).toFixed(1)}%`,
          step3_tokenEstimate: `${((timings.step3_tokenEstimate / timings.total) * 100).toFixed(1)}%`,
          step4_generateEmbedding: `${((timings.step4_generateEmbedding / timings.total) * 100).toFixed(1)}%`,
          step5_logCost: `${((timings.step5_logCost / timings.total) * 100).toFixed(1)}%`,
          step6_buildQuery: `${((timings.step6_buildQuery / timings.total) * 100).toFixed(1)}%`,
          step7_sqlExecution: `${((timings.step7_sqlExecution / timings.total) * 100).toFixed(1)}%`,
          step8_filtering: `${((timings.step8_filtering / timings.total) * 100).toFixed(1)}%`
        }
      },
      allScores: result.rows.slice(0, 5).map(r => ({
        vectorSim: r.vector_similarity?.toFixed(3),
        hybridScore: r.hybrid_score?.toFixed(3),
        document: r.filename?.substring(0, 30),
        passedFilter: (r.vector_similarity >= params.minSimilarity || r.hybrid_score >= params.minHybridScore)
      }))
    });

    // Retornar resultados con metadata de filtrado para logging posterior
    return {
      chunks: filteredResults,
      metadata: {
        totalCandidates: result.rows.length,
        selectedCount: filteredResults.length,
        rejectedCount: result.rows.length - filteredResults.length,
        minSimilarityThreshold: params.minSimilarity,
        minHybridThreshold: params.minHybridScore,
        detectedEquipments: detectedEquipments.slice(0, 5),
        filteredByEquipment: detectedEquipments.length > 0,
        variantsCount: detectedEquipments.length
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

