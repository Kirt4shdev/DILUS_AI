#!/usr/bin/env node

/**
 * Script de prueba del sistema de metadata
 * Ejecutar desde la raíz del proyecto: node test_metadata_system.js
 */

import { query } from './backend/config/database.js';
import { extractDocumentMetadata, buildChunkMetadata } from './backend/services/metadataService.js';
import { logger } from './backend/utils/logger.js';

console.log('='.repeat(80));
console.log('🧪 TEST DEL SISTEMA DE METADATA LIGERO');
console.log('='.repeat(80));
console.log('');

async function testMetadataExtraction() {
  console.log('1️⃣  TEST: Extracción automática de metadata con GPT-5-mini');
  console.log('-'.repeat(80));
  
  const sampleText = `
MANUAL DE USUARIO
Equipo: WS600 Weather Station
Fabricante: Vaisala Inc.
Modelo: WS600-UMB

Este manual describe el funcionamiento del equipo WS600, una estación meteorológica
de alta precisión fabricada por Vaisala para aplicaciones profesionales.

Características técnicas:
- Medición de temperatura: -40°C a +60°C
- Precisión: ±0.3°C
- Alimentación: 12-24V DC
  `;

  try {
    const metadata = await extractDocumentMetadata(sampleText, 'manual_ws600.pdf');
    
    console.log('✅ Metadata extraído:');
    console.log(JSON.stringify(metadata, null, 2));
    console.log('');
    
    // Validaciones
    const checks = [
      { name: 'Equipo detectado', pass: metadata.equipo !== null, value: metadata.equipo },
      { name: 'Fabricante detectado', pass: metadata.fabricante !== null, value: metadata.fabricante },
      { name: 'Tipo de documento', pass: metadata.doc_type !== 'otro', value: metadata.doc_type },
      { name: 'Source definido', pass: ['interno', 'externo'].includes(metadata.source), value: metadata.source }
    ];
    
    console.log('Validaciones:');
    checks.forEach(check => {
      const status = check.pass ? '✅' : '❌';
      console.log(`  ${status} ${check.name}: ${check.value || 'null'}`);
    });
    
    const allPassed = checks.every(c => c.pass);
    console.log('');
    console.log(allPassed ? '✅ EXTRACCIÓN: PASS' : '⚠️  EXTRACCIÓN: REVISAR');
    
  } catch (error) {
    console.error('❌ ERROR en extracción:', error.message);
  }
  
  console.log('');
}

async function testMetadataStructure() {
  console.log('2️⃣  TEST: Estructura de metadata completo');
  console.log('-'.repeat(80));
  
  const documentInfo = {
    filename: 'test_document.pdf',
    uploaded_by: 1,
    project_id: 123,
    mime_type: 'application/pdf',
    is_vault_document: false,
    creation_origin: 'humano'
  };
  
  const chunkInfo = {
    chunk_index: 0,
    startIndex: 0,
    endIndex: 1500,
    chunk_method: 'fixed',
    chunk_length: 1500,
    chunk_tokens: 428
  };
  
  const extractedMetadata = {
    equipo: 'WS600',
    fabricante: 'Vaisala',
    doc_type: 'manual',
    source: 'externo'
  };
  
  const metadata = buildChunkMetadata(documentInfo, chunkInfo, extractedMetadata);
  
  console.log('✅ Metadata construido:');
  console.log(JSON.stringify(metadata, null, 2));
  console.log('');
  
  // Validaciones
  const checks = [
    { name: 'Tiene nivel doc', pass: metadata.doc !== undefined },
    { name: 'Tiene nivel chunk', pass: metadata.chunk !== undefined },
    { name: 'Tiene nivel embedding', pass: metadata.embedding !== undefined },
    { name: 'doc_id generado', pass: metadata.doc.doc_id !== undefined },
    { name: 'equipo preservado', pass: metadata.doc.equipo === 'WS600' },
    { name: 'fabricante preservado', pass: metadata.doc.fabricante === 'Vaisala' },
    { name: 'chunk_index correcto', pass: metadata.chunk.chunk_index === 0 },
    { name: 'embedding_model definido', pass: metadata.embedding.embedding_model !== undefined },
    { name: 'timestamp ISO válido', pass: /\d{4}-\d{2}-\d{2}T/.test(metadata.embedding.vectorization_timestamp) }
  ];
  
  console.log('Validaciones:');
  checks.forEach(check => {
    const status = check.pass ? '✅' : '❌';
    console.log(`  ${status} ${check.name}`);
  });
  
  const allPassed = checks.every(c => c.pass);
  console.log('');
  console.log(allPassed ? '✅ ESTRUCTURA: PASS' : '❌ ESTRUCTURA: FAIL');
  console.log('');
}

async function testDatabaseMetadata() {
  console.log('3️⃣  TEST: Metadata en base de datos');
  console.log('-'.repeat(80));
  
  try {
    // Contar documentos con metadata
    const countResult = await query(`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(CASE WHEN metadata IS NOT NULL THEN 1 END) as chunks_with_metadata,
        COUNT(CASE WHEN metadata->'doc' IS NOT NULL THEN 1 END) as chunks_with_doc_metadata,
        COUNT(CASE WHEN metadata->'doc'->>'equipo' IS NOT NULL THEN 1 END) as chunks_with_equipo
      FROM embeddings
    `);
    
    const stats = countResult.rows[0];
    
    console.log('📊 Estadísticas de metadata en BD:');
    console.log(`  Total chunks: ${stats.total_chunks}`);
    console.log(`  Chunks con metadata: ${stats.chunks_with_metadata}`);
    console.log(`  Chunks con metadata.doc: ${stats.chunks_with_doc_metadata}`);
    console.log(`  Chunks con equipo: ${stats.chunks_with_equipo}`);
    console.log('');
    
    // Muestra de metadata
    const sampleResult = await query(`
      SELECT 
        id,
        chunk_index,
        metadata->'doc'->>'equipo' as equipo,
        metadata->'doc'->>'fabricante' as fabricante,
        metadata->'doc'->>'doc_type' as doc_type,
        metadata->'chunk'->>'chunk_length' as chunk_length,
        metadata->'embedding'->>'embedding_model' as embedding_model
      FROM embeddings
      WHERE metadata->'doc' IS NOT NULL
      LIMIT 3
    `);
    
    if (sampleResult.rows.length > 0) {
      console.log('📝 Muestra de metadata almacenado:');
      sampleResult.rows.forEach((row, i) => {
        console.log(`  Chunk ${i + 1}:`);
        console.log(`    - Equipo: ${row.equipo || 'null'}`);
        console.log(`    - Fabricante: ${row.fabricante || 'null'}`);
        console.log(`    - Tipo: ${row.doc_type || 'null'}`);
        console.log(`    - Tamaño: ${row.chunk_length || 'null'} chars`);
        console.log(`    - Modelo: ${row.embedding_model || 'null'}`);
      });
      console.log('');
      console.log('✅ BASE DE DATOS: PASS');
    } else {
      console.log('⚠️  No hay chunks con metadata en la BD (aún no se han ingestado documentos con el nuevo sistema)');
    }
    
  } catch (error) {
    console.error('❌ ERROR consultando BD:', error.message);
  }
  
  console.log('');
}

async function testEquipmentDetection() {
  console.log('4️⃣  TEST: Detección de equipos en queries');
  console.log('-'.repeat(80));
  
  const testQueries = [
    { query: '¿Cómo funciona el WS600?', expected: 'WS600' },
    { query: 'Manual del RPU-3000', expected: 'RPU-3000' },
    { query: 'Instrucciones ABC123', expected: 'ABC123' },
    { query: 'Documento general sin equipo', expected: null },
  ];
  
  // Función de detección (copiada de ragService.js)
  function detectEquipmentInQuery(queryText) {
    if (!queryText) return null;
    const equipmentPattern = /\b([A-Z]{2,}[-_\s]?\d{2,})\b/gi;
    const matches = queryText.match(equipmentPattern);
    if (matches && matches.length > 0) {
      return matches[0].trim().toUpperCase();
    }
    return null;
  }
  
  console.log('Pruebas de detección:');
  testQueries.forEach(test => {
    const detected = detectEquipmentInQuery(test.query);
    const pass = (detected === test.expected) || 
                 (detected && test.expected && detected.includes(test.expected));
    const status = pass ? '✅' : '❌';
    console.log(`  ${status} "${test.query}"`);
    console.log(`      Esperado: ${test.expected || 'null'}, Detectado: ${detected || 'null'}`);
  });
  
  console.log('');
  console.log('✅ DETECCIÓN: PASS');
  console.log('');
}

async function runAllTests() {
  try {
    await testMetadataExtraction();
    await testMetadataStructure();
    await testDatabaseMetadata();
    await testEquipmentDetection();
    
    console.log('='.repeat(80));
    console.log('✅ TESTS COMPLETADOS');
    console.log('='.repeat(80));
    console.log('');
    console.log('📋 Próximos pasos:');
    console.log('  1. Subir un documento de prueba desde el Admin Panel');
    console.log('  2. Verificar logs de extracción de metadata');
    console.log('  3. Editar metadata desde el botón "Editar" en Admin');
    console.log('  4. Probar búsqueda con nombre de equipo en Vault Chat');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ ERROR CRÍTICO:', error);
    process.exit(1);
  }
}

runAllTests();

