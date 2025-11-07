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
 * @param {string} text - Texto a dividir
 * @param {number} chunkSize - Tamaño máximo del chunk
 * @param {number} overlap - Solapamiento entre chunks
 * @param {string} method - Método: 'fixed', 'sentence', 'paragraph'
 */
export function chunkText(text, chunkSize = 1000, overlap = 200, method = 'fixed') {
  if (!text || text.trim().length === 0) {
    return [];
  }

  let chunks = [];

  switch (method) {
    case 'paragraph':
      chunks = chunkByParagraph(text, chunkSize, overlap);
      break;
    
    case 'sentence':
      chunks = chunkBySentence(text, chunkSize, overlap);
      break;
    
    case 'fixed':
    default:
      chunks = chunkByFixedSize(text, chunkSize, overlap);
      break;
  }

  logger.debug('Text chunked', { 
    method,
    totalChunks: chunks.length, 
    chunkSize, 
    overlap 
  });

  return chunks;
}

/**
 * Chunking por tamaño fijo (método original)
 */
function chunkByFixedSize(text, chunkSize, overlap) {
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

  return chunks;
}

/**
 * Chunking por párrafos
 * Divide el texto por párrafos y los agrupa si son pequeños
 */
function chunkByParagraph(text, maxSize, overlap) {
  // Dividir por párrafos (dos o más saltos de línea)
  const paragraphs = text.split(/\n\s*\n+/).filter(p => p.trim().length > 0);
  
  const chunks = [];
  let currentChunk = '';
  let startIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    
    // Si el párrafo solo ya excede el tamaño, dividirlo
    if (paragraph.length > maxSize) {
      // Guardar chunk actual si existe
      if (currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          startIndex,
          endIndex: text.indexOf(currentChunk) + currentChunk.length
        });
      }
      
      // Dividir el párrafo largo por tamaño fijo
      const largeParagraphChunks = chunkByFixedSize(paragraph, maxSize, overlap);
      chunks.push(...largeParagraphChunks);
      
      currentChunk = '';
      startIndex = text.indexOf(paragraph) + paragraph.length;
      continue;
    }
    
    // Si agregar este párrafo excede el tamaño, guardar el chunk actual
    if (currentChunk.length + paragraph.length + 2 > maxSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        startIndex,
        endIndex: text.indexOf(currentChunk) + currentChunk.length
      });
      
      // Empezar nuevo chunk con overlap (último párrafo del chunk anterior)
      const lastParagraphIndex = currentChunk.lastIndexOf('\n\n');
      if (lastParagraphIndex > 0 && overlap > 0) {
        currentChunk = currentChunk.slice(lastParagraphIndex + 2) + '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
      startIndex = text.indexOf(paragraph);
    } else {
      // Agregar párrafo al chunk actual
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
        startIndex = text.indexOf(paragraph);
      }
    }
  }

  // Agregar el último chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      startIndex,
      endIndex: text.length
    });
  }

  return chunks;
}

/**
 * Chunking por sentencias
 * Divide el texto por sentencias y las agrupa
 */
function chunkBySentence(text, maxSize, overlap) {
  // Dividir por sentencias (punto seguido de espacio y mayúscula, o punto final)
  const sentenceRegex = /[.!?]+[\s]+(?=[A-Z])|[.!?]+$/g;
  const sentences = [];
  let lastIndex = 0;
  let match;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const sentence = text.slice(lastIndex, match.index + match[0].length).trim();
    if (sentence.length > 0) {
      sentences.push(sentence);
    }
    lastIndex = match.index + match[0].length;
  }

  // Agregar el resto si existe
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }
  }

  const chunks = [];
  let currentChunk = '';
  let startIndex = 0;
  let overlapSentences = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // Si la sentencia sola excede el tamaño, dividirla
    if (sentence.length > maxSize) {
      // Guardar chunk actual si existe
      if (currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          startIndex,
          endIndex: text.indexOf(currentChunk) + currentChunk.length
        });
      }
      
      // Dividir la sentencia larga
      const largeSentenceChunks = chunkByFixedSize(sentence, maxSize, overlap);
      chunks.push(...largeSentenceChunks);
      
      currentChunk = '';
      overlapSentences = [];
      startIndex = text.indexOf(sentence) + sentence.length;
      continue;
    }
    
    // Si agregar esta sentencia excede el tamaño
    if (currentChunk.length + sentence.length + 1 > maxSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        startIndex,
        endIndex: text.indexOf(currentChunk) + currentChunk.length
      });
      
      // Aplicar overlap con las últimas sentencias
      if (overlap > 0 && overlapSentences.length > 0) {
        let overlapText = '';
        for (let j = overlapSentences.length - 1; j >= 0; j--) {
          if (overlapText.length + overlapSentences[j].length < overlap) {
            overlapText = overlapSentences[j] + ' ' + overlapText;
          } else {
            break;
          }
        }
        currentChunk = overlapText.trim() + ' ' + sentence;
        overlapSentences = [sentence];
      } else {
        currentChunk = sentence;
        overlapSentences = [sentence];
      }
      startIndex = text.indexOf(currentChunk);
    } else {
      // Agregar sentencia al chunk actual
      if (currentChunk.length > 0) {
        currentChunk += ' ' + sentence;
      } else {
        currentChunk = sentence;
        startIndex = text.indexOf(sentence);
      }
      overlapSentences.push(sentence);
    }
  }

  // Agregar el último chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      startIndex,
      endIndex: text.length
    });
  }

  return chunks;
}

export default {
  extractTextFromPDF,
  extractTextFromDOCX,
  extractTextFromTXT,
  extractText,
  chunkText
};

