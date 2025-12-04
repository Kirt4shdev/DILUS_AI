import { generateWithGPT5Mini, parseAIResponse, estimateTokens } from './aiService.js';
import { logger } from '../utils/logger.js';
import { query } from '../config/database.js';
import { randomUUID } from 'crypto';

/**
 * Extraer metadata automático de un documento usando GPT-5-mini
 * Analiza solo el inicio del documento (primera página o primeros 3000 caracteres)
 * 
 * @param {string} text - Texto completo del documento
 * @param {string} filename - Nombre del archivo
 * @returns {Object} - Metadata extraído: { equipo, fabricante, doc_type, source }
 */
export async function extractDocumentMetadata(text, filename) {
  try {
    logger.info('Starting automatic metadata extraction', { 
      filename,
      textLength: text?.length || 0
    });

    // Tomar solo el inicio del documento (primeros 3000 caracteres)
    const textSample = text.substring(0, 3000);
    
    const prompt = `Analiza este texto del inicio de un documento técnico y devuelve SOLO un JSON con:

- equipo: nombre del equipo/producto mencionado (string o null)
- fabricante: nombre del fabricante/marca mencionado (string o null)
- doc_type: tipo de documento, uno de estos valores: "manual", "datasheet", "oferta", "interno", "pliego", "informe", "otro"
- source: origen del documento: "interno" o "externo"

Documento: "${filename}"
---
${textSample}
---

Devuelve ÚNICAMENTE un JSON válido, sin explicaciones adicionales.`;

    logger.debug('Calling GPT-5-mini for metadata extraction', { 
      promptLength: prompt.length,
      tokens: estimateTokens(prompt)
    });

    // Llamar a GPT-5-mini
    const aiResponse = await generateWithGPT5Mini(prompt);
    
    // Parsear respuesta
    const metadata = parseAIResponse(aiResponse.result);
    
    logger.info('Metadata extracted successfully', { 
      metadata,
      tokensUsed: aiResponse.tokensUsed 
    });

    // Validar y normalizar
    const normalized = {
      equipo: metadata.equipo || null,
      fabricante: metadata.fabricante || null,
      doc_type: validateDocType(metadata.doc_type),
      source: validateSource(metadata.source)
    };

    logger.debug('Metadata normalized', { normalized });

    return normalized;
    
  } catch (error) {
    logger.error('Error extracting metadata', { 
      error: error.message,
      filename 
    });
    
    // Retornar metadata por defecto en caso de error
    return {
      equipo: null,
      fabricante: null,
      doc_type: 'otro',
      source: 'externo'
    };
  }
}

/**
 * Validar y normalizar doc_type
 */
function validateDocType(docType) {
  const validTypes = ['manual', 'datasheet', 'pliego', 'interno', 'oferta', 'informe', 'otro'];
  
  if (!docType || typeof docType !== 'string') {
    return 'otro';
  }
  
  const normalized = docType.toLowerCase().trim();
  return validTypes.includes(normalized) ? normalized : 'otro';
}

/**
 * Validar y normalizar source
 */
function validateSource(source) {
  if (!source || typeof source !== 'string') {
    return 'externo';
  }
  
  const normalized = source.toLowerCase().trim();
  return ['interno', 'externo'].includes(normalized) ? normalized : 'externo';
}

/**
 * Construir metadata completo para un chunk
 * 
 * @param {Object} documentInfo - Información del documento desde la BD
 * @param {Object} chunkInfo - Información del chunk
 * @param {Object} extractedMetadata - Metadata extraído con IA
 * @returns {Object} - Metadata completo en formato {doc, chunk, embedding}
 */
export function buildChunkMetadata(documentInfo, chunkInfo, extractedMetadata = {}) {
  const now = new Date().toISOString();
  
  // Generar doc_id único si no existe
  const docId = documentInfo.doc_id || randomUUID();
  
  return {
    // Metadata de documento
    doc: {
      doc_id: docId,
      filename: documentInfo.filename || 'unknown',
      doc_type: extractedMetadata.doc_type || 'otro',
      source: extractedMetadata.source || 'externo',
      creation_origin: documentInfo.creation_origin || 'humano',
      uploaded_by: documentInfo.uploaded_by,
      mime_type: documentInfo.mime_type || null,
      project_id: documentInfo.project_id ? String(documentInfo.project_id) : null,
      equipo: extractedMetadata.equipo || null,
      fabricante: extractedMetadata.fabricante || null,
      is_vault_document: documentInfo.is_vault_document || false
    },
    
    // Metadata de chunk
    chunk: {
      chunk_index: chunkInfo.chunk_index,
      start: chunkInfo.startIndex || 0,
      end: chunkInfo.endIndex || 0,
      page: estimatePage(chunkInfo.startIndex || 0),
      chunk_method: chunkInfo.chunk_method || 'fixed',
      chunk_length: chunkInfo.chunk_length || 0,
      chunk_tokens: chunkInfo.chunk_tokens || 0
    },
    
    // Metadata de embedding
    embedding: {
      embedding_model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      vectorization_timestamp: now
    }
  };
}

/**
 * Estimar número de página basado en el índice de inicio del chunk
 * Asume ~2000 caracteres por página en promedio
 */
function estimatePage(startIndex) {
  const CHARS_PER_PAGE = 2000;
  return Math.floor(startIndex / CHARS_PER_PAGE) + 1;
}

/**
 * Actualizar metadata de un documento existente
 * Actualiza tanto la tabla documents como todos los chunks en embeddings
 * 
 * @param {number} documentId - ID del documento
 * @param {Object} metadata - Metadata a actualizar: { doc_type, source, creation_origin, project_id, equipo, fabricante }
 */
export async function updateDocumentMetadata(documentId, metadata) {
  try {
    logger.info('Updating document metadata', { documentId, metadata });

    // 1. Obtener información actual del documento
    const docResult = await query(
      'SELECT filename, uploaded_by, mime_type, project_id, is_vault_document FROM documents WHERE id = $1',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      throw new Error(`Documento con ID ${documentId} no encontrado`);
    }

    const docInfo = docResult.rows[0];

    // 2. Actualizar todos los chunks en embeddings
    // Obtener todos los chunks de este documento
    const chunksResult = await query(
      'SELECT id, metadata FROM embeddings WHERE document_id = $1',
      [documentId]
    );

    logger.info('Found chunks to update', { 
      documentId, 
      chunksCount: chunksResult.rows.length 
    });

    // 3. Actualizar cada chunk
    for (const chunk of chunksResult.rows) {
      const currentMetadata = chunk.metadata || {};
      
      // Actualizar solo la sección 'doc' del metadata
      const updatedMetadata = {
        ...currentMetadata,
        doc: {
          ...currentMetadata.doc,
          doc_type: metadata.doc_type || currentMetadata.doc?.doc_type || 'otro',
          source: metadata.source || currentMetadata.doc?.source || 'externo',
          creation_origin: metadata.creation_origin || currentMetadata.doc?.creation_origin || 'humano',
          project_id: metadata.project_id !== undefined ? String(metadata.project_id) : currentMetadata.doc?.project_id || null,
          equipo: metadata.equipo !== undefined ? metadata.equipo : currentMetadata.doc?.equipo || null,
          fabricante: metadata.fabricante !== undefined ? metadata.fabricante : currentMetadata.doc?.fabricante || null,
          // Preservar campos originales
          doc_id: currentMetadata.doc?.doc_id,
          filename: currentMetadata.doc?.filename || docInfo.filename,
          uploaded_by: currentMetadata.doc?.uploaded_by || docInfo.uploaded_by,
          mime_type: currentMetadata.doc?.mime_type || docInfo.mime_type,
          is_vault_document: currentMetadata.doc?.is_vault_document || docInfo.is_vault_document
        }
      };

      await query(
        'UPDATE embeddings SET metadata = $1 WHERE id = $2',
        [JSON.stringify(updatedMetadata), chunk.id]
      );
    }

    logger.info('Document metadata updated successfully', { 
      documentId, 
      chunksUpdated: chunksResult.rows.length 
    });

    return {
      documentId,
      chunksUpdated: chunksResult.rows.length,
      metadata: metadata
    };

  } catch (error) {
    logger.error('Error updating document metadata', { 
      documentId, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Obtener metadata de un documento desde cualquier chunk
 * Útil para mostrar en la UI
 */
export async function getDocumentMetadata(documentId) {
  try {
    // Obtener el primer chunk del documento para extraer metadata
    const result = await query(
      'SELECT metadata FROM embeddings WHERE document_id = $1 LIMIT 1',
      [documentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const metadata = result.rows[0].metadata || {};
    return metadata.doc || null;

  } catch (error) {
    logger.error('Error getting document metadata', { 
      documentId, 
      error: error.message 
    });
    return null;
  }
}

export default {
  extractDocumentMetadata,
  buildChunkMetadata,
  updateDocumentMetadata,
  getDocumentMetadata,
  estimatePage
};

