import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger.js';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://ocrservice:8092';

/**
 * Extraer texto de PDF
 */
export async function extractTextFromPDF(buffer) {
  try {
    logger.debug('Extracting text from PDF', { bufferSize: buffer.length });
    const data = await pdfParse(buffer);
    
    const textLength = data.text?.length || 0;
    const textPreview = data.text?.substring(0, 200) || '(EMPTY)';
    const hasText = data.text && data.text.trim().length > 0;
    
    logger.info('PDF text extracted', { 
      pages: data.numpages, 
      textLength,
      textPreview,
      hasText,
      isLikelyScanned: !hasText && data.numpages > 0
    });
    
    // Si el PDF parece ser solo imágenes, aplicar OCR automáticamente
    if (!hasText && data.numpages > 0) {
      logger.warn('PDF appears to be scanned images, applying OCR...', {
        pages: data.numpages,
        bufferSize: buffer.length
      });
      
      try {
        const ocrText = await applyOCR(buffer, 'spa'); // español por defecto
        logger.info('OCR completed successfully', {
          pages: data.numpages,
          ocrTextLength: ocrText.length,
          ocrPreview: ocrText.substring(0, 200)
        });
        return ocrText;
      } catch (ocrError) {
        logger.error('OCR failed', { error: ocrError.message });
        throw new Error(`El PDF es un documento escaneado sin texto. Se intentó aplicar OCR pero falló: ${ocrError.message}`);
      }
    }
    
    return data.text;
  } catch (error) {
    logger.error('Error extracting text from PDF', { 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
}

/**
 * Aplicar OCR a un PDF escaneado
 */
async function applyOCR(buffer, language = 'spa') {
  try {
    logger.info('Calling OCR service', { 
      ocrServiceUrl: OCR_SERVICE_URL,
      bufferSize: buffer.length,
      language 
    });
    
    // Crear FormData para enviar el archivo
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: 'document.pdf',
      contentType: 'application/pdf'
    });
    formData.append('language', language);
    formData.append('dpi', '300');
    
    // Llamar al servicio OCR
    const response = await axios.post(
      `${OCR_SERVICE_URL}/ocr/pdf`,
      formData,
      {
        headers: {
          ...formData.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 300000 // 5 minutos timeout para documentos grandes
      }
    );
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'OCR failed');
    }
    
    logger.info('OCR service response', {
      pages: response.data.pages,
      pagesWithText: response.data.pages_with_text,
      totalCharacters: response.data.total_characters,
      avgConfidence: response.data.avg_confidence
    });
    
    return response.data.text;
    
  } catch (error) {
    logger.error('Error calling OCR service', {
      error: error.message,
      ocrServiceUrl: OCR_SERVICE_URL,
      responseData: error.response?.data
    });
    throw new Error(`OCR service error: ${error.message}`);
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
  try {
    if (!text || text.trim().length === 0) {
      logger.warn('Empty text provided for chunking');
      return [];
    }

    // Protección contra textos extremadamente grandes
    const MAX_TEXT_LENGTH = 10_000_000; // 10 millones de caracteres (~5000 páginas)
    if (text.length > MAX_TEXT_LENGTH) {
      logger.warn('Text too large, truncating', { 
        originalLength: text.length, 
        maxLength: MAX_TEXT_LENGTH 
      });
      text = text.substring(0, MAX_TEXT_LENGTH);
    }

    let chunks = [];

    logger.info('Starting chunking process', { 
      method, 
      textLength: text.length, 
      chunkSize, 
      overlap 
    });

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

    logger.info('Text chunked successfully', { 
      method,
      totalChunks: chunks.length, 
      chunkSize, 
      overlap 
    });

    return chunks;
  } catch (error) {
    logger.error('Error during chunking', {
      error: error.message,
      stack: error.stack,
      method,
      textLength: text?.length || 0
    });
    console.error('=== CHUNKING ERROR ===');
    console.error('Method:', method);
    console.error('Text length:', text?.length);
    console.error('Error:', error);
    console.error('======================');
    throw error;
  }
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
 * Detecta párrafos por:
 * 1. Doble salto de línea (\n\n)
 * 2. Punto seguido de salto de línea y mayúscula
 * 3. Salto de línea cuando la siguiente línea empieza con mayúscula/número
 */
function chunkByParagraph(text, maxSize, overlap) {
  try {
    // Normalizar saltos de línea
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Dividir por párrafos usando múltiples criterios
    const lines = text.split('\n');
    const paragraphs = [];
    let currentParagraph = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Línea vacía = fin de párrafo
      if (line.length === 0) {
        if (currentParagraph.trim().length > 0) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        continue;
      }
      
      // Si la línea anterior terminaba en punto y esta empieza con mayúscula/número = nuevo párrafo
      if (currentParagraph.length > 0) {
        const lastChar = currentParagraph.trim().slice(-1);
        const firstChar = line.charAt(0);
        
        // Detectar inicio de nuevo párrafo
        const endsWithPunctuation = /[.!?:]$/.test(currentParagraph.trim());
        const startsWithCapitalOrNumber = /^[A-ZÁÉÍÓÚÑ0-9\-•\*]/.test(firstChar);
        
        if (endsWithPunctuation && startsWithCapitalOrNumber) {
          // Nuevo párrafo
          paragraphs.push(currentParagraph.trim());
          currentParagraph = line;
        } else {
          // Continuar párrafo actual
          currentParagraph += ' ' + line;
        }
      } else {
        // Primer línea del párrafo
        currentParagraph = line;
      }
    }
    
    // Agregar último párrafo
    if (currentParagraph.trim().length > 0) {
      paragraphs.push(currentParagraph.trim());
    }
    
    logger.debug('Paragraphs split', { 
      count: paragraphs.length,
      avgLength: Math.round(paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length)
    });
    
    // Agrupar párrafos en chunks
    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Si un solo párrafo excede maxSize, dividirlo por tamaño fijo
      if (paragraph.length > maxSize) {
        // Guardar chunk actual si existe
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.join('\n\n'),
            startIndex: 0,
            endIndex: 0
          });
          currentChunk = [];
          currentLength = 0;
        }
        
        // Dividir párrafo largo
        const subChunks = chunkByFixedSize(paragraph, maxSize, overlap);
        chunks.push(...subChunks);
        continue;
      }
      
      // Calcular tamaño con separadores
      const paragraphWithSeparator = paragraph.length + (currentChunk.length > 0 ? 2 : 0); // +2 for \n\n
      
      // Si agregar este párrafo excede el tamaño, cerrar chunk actual
      if (currentLength + paragraphWithSeparator > maxSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.join('\n\n'),
          startIndex: 0,
          endIndex: 0
        });
        
        // Aplicar overlap: incluir último(s) párrafo(s) del chunk anterior
        currentChunk = [];
        currentLength = 0;
        
        if (overlap > 0 && chunks.length > 0) {
          // Tomar párrafos del final del chunk anterior para overlap
          const prevChunkParagraphs = chunks[chunks.length - 1].text.split('\n\n');
          let overlapText = '';
          
          for (let j = prevChunkParagraphs.length - 1; j >= 0 && overlapText.length < overlap; j--) {
            overlapText = prevChunkParagraphs[j] + (overlapText ? '\n\n' + overlapText : '');
          }
          
          if (overlapText.length > 0) {
            currentChunk.push(overlapText);
            currentLength = overlapText.length + 2; // +2 for separator with next paragraph
          }
        }
        
        currentChunk.push(paragraph);
        currentLength += paragraph.length;
      } else {
        // Agregar párrafo al chunk actual
        currentChunk.push(paragraph);
        currentLength += paragraphWithSeparator;
      }
    }
    
    // Agregar último chunk
    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join('\n\n'),
        startIndex: 0,
        endIndex: 0
      });
    }
    
    logger.info('Paragraph chunking completed', {
      paragraphsFound: paragraphs.length,
      chunksCreated: chunks.length,
      avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length)
    });
    
    return chunks;
    
  } catch (error) {
    logger.error('Error in chunkByParagraph', { 
      error: error.message, 
      stack: error.stack 
    });
    logger.warn('Falling back to fixed-size chunking');
    return chunkByFixedSize(text, maxSize, overlap);
  }
}

/**
 * Chunking por sentencias
 * Divide el texto por sentencias y las agrupa
 */
function chunkBySentence(text, maxSize, overlap) {
  try {
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
  } catch (error) {
    logger.error('Error in chunkBySentence', { error: error.message, stack: error.stack });
    // Fallback a chunking fijo si falla
    logger.warn('Falling back to fixed-size chunking');
    return chunkByFixedSize(text, maxSize, overlap);
  }
}

export default {
  extractTextFromPDF,
  extractTextFromDOCX,
  extractTextFromTXT,
  extractText,
  chunkText
};

