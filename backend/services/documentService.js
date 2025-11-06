import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { logger } from '../utils/logger.js';

/**
 * Extraer texto de PDF
 */
export async function extractTextFromPDF(buffer) {
  try {
    logger.debug('Extracting text from PDF');
    const data = await pdfParse(buffer);
    logger.info('PDF text extracted', { 
      pages: data.numpages, 
      textLength: data.text.length 
    });
    return data.text;
  } catch (error) {
    logger.error('Error extracting text from PDF', error);
    throw new Error(`Error al extraer texto del PDF: ${error.message}`);
  }
}

/**
 * Extraer texto de DOCX
 */
export async function extractTextFromDOCX(buffer) {
  try {
    logger.debug('Extracting text from DOCX');
    const result = await mammoth.extractRawText({ buffer });
    logger.info('DOCX text extracted', { 
      textLength: result.value.length 
    });
    return result.value;
  } catch (error) {
    logger.error('Error extracting text from DOCX', error);
    throw new Error(`Error al extraer texto del DOCX: ${error.message}`);
  }
}

/**
 * Extraer texto de TXT
 */
export function extractTextFromTXT(buffer) {
  try {
    logger.debug('Extracting text from TXT');
    const text = buffer.toString('utf-8');
    logger.info('TXT text extracted', { textLength: text.length });
    return text;
  } catch (error) {
    logger.error('Error extracting text from TXT', error);
    throw new Error(`Error al extraer texto del TXT: ${error.message}`);
  }
}

/**
 * Extraer texto según el tipo de archivo
 */
export async function extractText(buffer, mimetype) {
  switch (mimetype) {
    case 'application/pdf':
      return await extractTextFromPDF(buffer);
    
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await extractTextFromDOCX(buffer);
    
    case 'text/plain':
      return extractTextFromTXT(buffer);
    
    default:
      throw new Error(`Tipo de archivo no soportado: ${mimetype}`);
  }
}

/**
 * Dividir texto en chunks para RAG
 */
export function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = startIndex + chunkSize;
    const chunk = text.slice(startIndex, endIndex);
    
    if (chunk.trim().length > 0) {
      chunks.push({
        text: chunk.trim(),
        startIndex,
        endIndex: Math.min(endIndex, text.length)
      });
    }

    startIndex = endIndex - overlap;
  }

  logger.debug('Text chunked', { 
    totalChunks: chunks.length, 
    chunkSize, 
    overlap 
  });

  return chunks;
}

export default {
  extractTextFromPDF,
  extractTextFromDOCX,
  extractTextFromTXT,
  extractText,
  chunkText
};

