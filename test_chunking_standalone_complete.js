// ====== FUNCIONES DE CHUNKING COPIADAS ======

function chunkByFixedSize(text, chunkSize, overlap) {
  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    chunks.push({
      text: text.substring(startIndex, endIndex),
      startIndex,
      endIndex
    });

    startIndex = endIndex - overlap;
  }

  return chunks;
}

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
    
    console.log(`   ℹ️  Párrafos detectados en texto: ${paragraphs.length}`);
    console.log(`   ℹ️  Tamaño promedio de párrafo: ${Math.round(paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length)} caracteres`);
    
    // Agrupar párrafos en chunks
    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Si un solo párrafo excede maxSize, dividirlo por tamaño fijo
      if (paragraph.length > maxSize) {
        console.log(`   ⚠️  Párrafo ${i + 1} es muy grande (${paragraph.length} > ${maxSize}), dividiendo...`);
        
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
    
  } catch (error) {
    console.log(`   ❌ Error en chunkByParagraph: ${error.message}`);
    console.log(`   📝 Fallback a fixed-size chunking`);
    return chunkByFixedSize(text, maxSize, overlap);
  }
}

function chunkText(text, chunkSize = 1000, overlap = 200, method = 'fixed') {
  if (!text || text.trim().length === 0) {
    console.log('   ⚠️  Texto vacío proporcionado');
    return [];
  }

  let chunks = [];

  switch (method) {
    case 'paragraph':
      chunks = chunkByParagraph(text, chunkSize, overlap);
      break;
    
    case 'fixed':
    default:
      chunks = chunkByFixedSize(text, chunkSize, overlap);
      break;
  }

  return chunks;
}

// ====== TEXTO DE PRUEBA ======

const testText = `
TÍTULO: MANUAL DE PROCEDIMIENTOS TÉCNICOS

1. INTRODUCCIÓN
Este documento establece los procedimientos técnicos para la gestión de proyectos de construcción. Los procedimientos aquí descritos son de obligatorio cumplimiento para todos los profesionales involucrados en el proyecto.

2. ALCANCE DEL PROYECTO
El alcance incluye todas las actividades relacionadas con la planificación, ejecución y control de obras civiles. Se establecen los límites y exclusiones del proyecto de manera clara y precisa.

3. RESPONSABILIDADES
3.1. Ingeniero Jefe
El ingeniero jefe será responsable de la coordinación general del proyecto y la supervisión de todos los trabajos. Deberá asegurar el cumplimiento de los estándares de calidad establecidos.

3.2. Ingeniero Residente
El ingeniero residente supervisará directamente las actividades en campo y reportará al ingeniero jefe. Será responsable de la correcta ejecución de los trabajos según los planos y especificaciones técnicas aprobadas.

3.3. Técnicos de Campo
Los técnicos realizarán las mediciones y controles de calidad necesarios. Mantendrán registros detallados de todas las actividades realizadas y reportarán cualquier anomalía de inmediato.

4. PROCEDIMIENTOS DE SEGURIDAD
4.1. Equipo de Protección Personal
Todo el personal debe utilizar el equipo de protección personal (EPP) correspondiente a su actividad. El EPP mínimo incluye casco, botas de seguridad, chaleco reflectante y guantes de trabajo.

4.2. Inspecciones de Seguridad
Se realizarán inspecciones diarias de seguridad antes del inicio de las labores. Cualquier condición insegura deberá ser corregida antes de comenzar los trabajos.

5. CONTROL DE CALIDAD
5.1. Ensayos de Materiales
Todos los materiales serán sometidos a ensayos de calidad según las normas aplicables. Los resultados de los ensayos deberán documentarse y archivarse adecuadamente.

5.2. Verificación de Procesos
Los procesos constructivos serán verificados en cada etapa para asegurar el cumplimiento de las especificaciones. Se llevarán registros fotográficos de cada etapa importante del proceso.

6. DOCUMENTACIÓN
Toda la documentación del proyecto será mantenida en formatos digitales y físicos. Los documentos incluyen planos, especificaciones, reportes de avance, actas de reunión y correspondencia oficial.

7. CONCLUSIONES
El cumplimiento estricto de estos procedimientos garantiza la calidad y seguridad en la ejecución del proyecto. Cualquier desviación deberá ser reportada y aprobada por escrito.
`.trim();

// ====== TEST PRINCIPAL ======

console.log('='.repeat(100));
console.log('🧪 TEST COMPLETO DE CHUNKING - VERIFICACIÓN AUTÓNOMA');
console.log('='.repeat(100));
console.log('\n📝 TEXTO DE PRUEBA:');
console.log(`   - Longitud total: ${testText.length} caracteres`);
console.log(`   - Líneas: ${testText.split('\n').length}`);
console.log('');

// Configuraciones a probar
const testConfigs = [
  {
    name: 'Paragraph - 800/100',
    method: 'paragraph',
    chunkSize: 800,
    overlap: 100
  },
  {
    name: 'Paragraph - 1000/200',
    method: 'paragraph',
    chunkSize: 1000,
    overlap: 200
  },
  {
    name: 'Paragraph - 1500/300',
    method: 'paragraph',
    chunkSize: 1500,
    overlap: 300
  },
  {
    name: 'Fixed - 1000/200 (comparación)',
    method: 'fixed',
    chunkSize: 1000,
    overlap: 200
  }
];

// Ejecutar tests
for (const config of testConfigs) {
  console.log('\n' + '='.repeat(100));
  console.log(`📊 TEST: ${config.name}`);
  console.log('='.repeat(100));
  console.log(`   Método: ${config.method}`);
  console.log(`   Chunk Size: ${config.chunkSize} caracteres`);
  console.log(`   Overlap: ${config.overlap} caracteres`);
  console.log('');

  try {
    const chunks = chunkText(testText, config.chunkSize, config.overlap, config.method);
    
    console.log(`\n✅ Chunks generados: ${chunks.length}\n`);
    
    // Analizar cada chunk
    let totalChars = 0;
    const chunkSizes = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkText = chunk.text || chunk;
      const size = chunkText.length;
      chunkSizes.push(size);
      totalChars += size;
      
      console.log(`   📄 Chunk ${i + 1}:`);
      console.log(`      - Tamaño: ${size} caracteres`);
      
      // Verificar si respeta el maxSize
      if (size > config.chunkSize * 1.1) { // Permitir 10% de margen
        console.log(`      ❌ ADVERTENCIA: Chunk excede el tamaño máximo permitido (${size} > ${config.chunkSize * 1.1})`);
      } else {
        console.log(`      ✅ Tamaño dentro del límite`);
      }
      
      // Verificar overlap con el chunk anterior
      if (i > 0) {
        const prevChunk = chunks[i - 1].text || chunks[i - 1];
        const overlapText = findOverlap(prevChunk, chunkText);
        const overlapSize = overlapText.length;
        console.log(`      - Overlap real con chunk anterior: ${overlapSize} caracteres`);
        
        if (config.overlap > 0) {
          if (overlapSize === 0) {
            console.log(`      ⚠️  ADVERTENCIA: No hay overlap cuando debería haber ~${config.overlap} caracteres`);
          } else if (overlapSize < config.overlap * 0.5) {
            console.log(`      ⚠️  ADVERTENCIA: Overlap muy pequeño (esperado ~${config.overlap})`);
          } else {
            console.log(`      ✅ Overlap presente (objetivo: ${config.overlap})`);
          }
        }
      }
      
      // Mostrar preview del chunk
      const preview = chunkText.substring(0, 120).replace(/\n/g, ' ').trim();
      console.log(`      - Preview: "${preview}..."`);
      
      // Para párrafos, mostrar cuántos hay en este chunk
      if (config.method === 'paragraph') {
        const paragraphsInChunk = chunkText.split('\n\n').filter(p => p.trim().length > 0).length;
        console.log(`      - Párrafos en chunk: ${paragraphsInChunk}`);
      }
      
      console.log('');
    }
    
    // Estadísticas generales
    console.log('📊 ESTADÍSTICAS FINALES:');
    console.log(`   - Total de chunks: ${chunks.length}`);
    console.log(`   - Tamaño mínimo: ${Math.min(...chunkSizes)} caracteres`);
    console.log(`   - Tamaño máximo: ${Math.max(...chunkSizes)} caracteres`);
    console.log(`   - Tamaño promedio: ${Math.round(totalChars / chunks.length)} caracteres`);
    console.log(`   - Tamaño objetivo: ${config.chunkSize} caracteres`);
    console.log(`   - Overlap objetivo: ${config.overlap} caracteres`);
    
    // Verificar coherencia
    const maxChunkSize = Math.max(...chunkSizes);
    if (maxChunkSize > config.chunkSize * 1.1) {
      console.log(`   ❌ ERROR: Hay chunks que exceden significativamente el tamaño máximo`);
    } else {
      console.log(`   ✅ Todos los chunks respetan el tamaño máximo (±10%)`);
    }
    
    // Para método paragraph, verificar que se respetan párrafos
    if (config.method === 'paragraph') {
      console.log('\n📋 ANÁLISIS DE PRESERVACIÓN DE PÁRRAFOS:');
      let totalParseados = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i].text || chunks[i];
        const paragraphsInChunk = chunkText.split('\n\n').filter(p => p.trim().length > 0).length;
        totalParseados += paragraphsInChunk;
        console.log(`   - Chunk ${i + 1}: ${paragraphsInChunk} párrafos`);
      }
      console.log(`   - Total párrafos procesados: ${totalParseados}`);
      
      // Contar párrafos originales
      const originalParagraphs = testText.split(/\n\n+/).filter(p => p.trim().length > 0).length;
      console.log(`   - Párrafos en texto original: ${originalParagraphs}`);
      
      // Verificar integridad de párrafos
      if (totalParseados >= originalParagraphs * 0.9) { // Permitir 10% de diferencia
        console.log(`   ✅ Párrafos preservados correctamente`);
      } else {
        console.log(`   ⚠️  ADVERTENCIA: Puede haber pérdida de párrafos`);
      }
    }
    
  } catch (error) {
    console.log(`❌ ERROR al ejecutar chunking: ${error.message}`);
    console.log(error.stack);
  }
}

// ====== FUNCIÓN AUXILIAR ======

function findOverlap(text1, text2) {
  const minOverlapSize = 20; // Buscar overlaps de al menos 20 caracteres
  
  // Buscar desde el final del primer texto
  for (let i = Math.min(text1.length, 500); i >= minOverlapSize; i--) {
    const suffix = text1.substring(text1.length - i);
    if (text2.startsWith(suffix)) {
      return suffix;
    }
  }
  
  return '';
}

console.log('\n' + '='.repeat(100));
console.log('🎉 TEST COMPLETADO');
console.log('='.repeat(100));
console.log('\n📝 CONCLUSIONES:');
console.log('   1. Verifica que el chunking por párrafos respeta los tamaños máximos');
console.log('   2. Verifica que el overlap se aplica correctamente');
console.log('   3. Compara con el método fixed para ver las diferencias');
console.log('   4. Verifica que los párrafos se preservan correctamente');
console.log('');

