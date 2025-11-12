import fs from 'fs';
import { chunkText } from './backend/services/documentService.js';

const text = fs.readFileSync('./test_chunking.txt', 'utf-8');

console.log('='.repeat(80));
console.log('🧪 PRUEBA DE CHUNKING POR PÁRRAFOS');
console.log('='.repeat(80));
console.log(`\n📄 Texto original: ${text.length} caracteres`);
console.log(`📝 Líneas: ${text.split('\n').length}`);

// Configuración del chunking
const chunkSize = 500;
const overlap = 100;
const method = 'paragraph';

console.log(`\n⚙️  Configuración:`);
console.log(`   - Método: ${method}`);
console.log(`   - Tamaño máximo: ${chunkSize} caracteres`);
console.log(`   - Overlap: ${overlap} caracteres`);

// Ejecutar chunking
const chunks = chunkText(text, chunkSize, overlap, method);

console.log(`\n✅ Chunks generados: ${chunks.length}`);
console.log(`📊 Tamaño promedio: ${Math.round(chunks.reduce((sum, c) => sum + c.text.length, 0) / chunks.length)} caracteres`);

// Mostrar cada chunk
console.log('\n' + '='.repeat(80));
console.log('📑 CHUNKS GENERADOS:');
console.log('='.repeat(80));

chunks.forEach((chunk, index) => {
  console.log(`\n--- CHUNK ${index + 1} (${chunk.text.length} caracteres) ---`);
  console.log(`Inicio: "${chunk.text.substring(0, 80)}..."`);
  console.log(`Final: "...${chunk.text.substring(chunk.text.length - 80)}"`);
  
  // Verificar que termina bien
  const lastChar = chunk.text.trim().slice(-1);
  const firstChar = chunk.text.trim().charAt(0);
  console.log(`✓ Empieza con: "${firstChar}" | Termina con: "${lastChar}"`);
  
  // Contar párrafos
  const paragraphs = chunk.text.split('\n\n').filter(p => p.trim().length > 0);
  console.log(`✓ Párrafos incluidos: ${paragraphs.length}`);
});

console.log('\n' + '='.repeat(80));
console.log('📋 RESUMEN:');
console.log('='.repeat(80));

// Verificar overlap
for (let i = 1; i < chunks.length; i++) {
  const prevEnd = chunks[i-1].text.substring(chunks[i-1].text.length - 50);
  const currStart = chunks[i].text.substring(0, 50);
  
  console.log(`\nOverlap entre chunk ${i} y ${i+1}:`);
  console.log(`  Anterior termina: "...${prevEnd}"`);
  console.log(`  Siguiente empieza: "${currStart}..."`);
}

console.log('\n' + '='.repeat(80));
console.log('✅ PRUEBA COMPLETADA');
console.log('='.repeat(80));





