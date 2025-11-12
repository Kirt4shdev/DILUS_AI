import fs from 'fs';

// Copiar solo las funciones de chunking sin dependencias
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

function chunkByParagraph(text, maxSize, overlap) {
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
  
  console.log(`📊 Párrafos detectados: ${paragraphs.length}`);
  console.log(`📏 Tamaño promedio de párrafo: ${Math.round(paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length)} caracteres\n`);
  
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
    const paragraphWithSeparator = paragraph.length + (currentChunk.length > 0 ? 2 : 0);
    
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
          currentLength = overlapText.length + 2;
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
  
  return chunks;
}

// === PRUEBA ===
const text = fs.readFileSync('./test_chunking.txt', 'utf-8');

console.log('='.repeat(80));
console.log('🧪 PRUEBA DE CHUNKING POR PÁRRAFOS');
console.log('='.repeat(80));
console.log(`\n📄 Texto original: ${text.length} caracteres`);
console.log(`📝 Líneas: ${text.split('\n').length}\n`);

const chunkSize = 600;
const overlap = 100;

console.log(`⚙️  Configuración: maxSize=${chunkSize}, overlap=${overlap}\n`);

const chunks = chunkByParagraph(text, chunkSize, overlap);

console.log('='.repeat(80));
console.log(`✅ RESULTADO: ${chunks.length} chunks generados`);
console.log(`📊 Tamaño promedio: ${Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length)} caracteres`);
console.log('='.repeat(80));

chunks.forEach((chunk, index) => {
  const paragraphsInChunk = chunk.text.split('\n\n').length;
  console.log(`\n📦 CHUNK ${index + 1} | ${chunk.text.length} chars | ${paragraphsInChunk} párrafos`);
  console.log('─'.repeat(80));
  
  // Mostrar inicio
  const lines = chunk.text.split('\n');
  console.log(`🔹 Inicio: "${lines[0].substring(0, 70)}${lines[0].length > 70 ? '...' : ''}"`);
  
  // Mostrar final
  const lastLine = lines[lines.length - 1];
  console.log(`🔸 Final:  "...${lastLine.substring(Math.max(0, lastLine.length - 70))}"`);
  
  // Verificar cortes
  const endsWithPunctuation = /[.!?]$/.test(chunk.text.trim());
  const startsWithCapital = /^[A-ZÁÉÍÓÚÑ0-9]/.test(chunk.text.trim());
  
  console.log(`✓ Empieza con ${startsWithCapital ? '✅ Mayúscula/Número' : '❌ Minúscula'}`);
  console.log(`✓ Termina con ${endsWithPunctuation ? '✅ Puntuación' : '⚠️  Sin puntuación'}`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ PRUEBA COMPLETADA');
console.log('='.repeat(80));





