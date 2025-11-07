/**
 * Análisis detallado de chunks con cálculo de overlap
 * Ejecutar desde el directorio backend: node ../analyze_chunks_detailed.js
 */

import { query } from './backend/config/database.js';

function findOverlap(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const maxOverlap = Math.min(text1.length, text2.length, 1000);
  
  for (let i = maxOverlap; i >= 20; i--) {
    const suffix = text1.substring(text1.length - i);
    const prefix = text2.substring(0, i);
    
    if (suffix === prefix) {
      return i;
    }
  }
  
  return 0;
}

async function analyzeChunks() {
  try {
    console.log('='.repeat(100));
    console.log('🔍 ANÁLISIS DETALLADO DE CHUNKS GENERADOS');
    console.log('='.repeat(100));
    console.log('');

    // 1. Configuración actual
    console.log('1️⃣  CONFIGURACIÓN ACTUAL:');
    console.log('-'.repeat(100));
    const configResult = await query(`
      SELECT config_key, config_value, data_type, updated_at
      FROM rag_config
      WHERE config_key IN ('chunk_size', 'chunk_overlap', 'chunking_method')
      ORDER BY config_key
    `);
    
    for (const row of configResult.rows) {
      console.log(`   ${row.config_key}: ${row.config_value} (${row.data_type})`);
    }
    console.log('');

    // 2. Documentos vectorizados
    console.log('2️⃣  DOCUMENTOS VECTORIZADOS:');
    console.log('-'.repeat(100));
    const docsResult = await query(`
      SELECT 
        d.id,
        d.filename,
        d.vectorization_status,
        d.created_at,
        COUNT(dc.id) as total_chunks
      FROM documents d
      LEFT JOIN document_chunks dc ON d.id = dc.document_id
      WHERE d.vectorization_status = 'completed'
      GROUP BY d.id, d.filename, d.vectorization_status, d.created_at
      ORDER BY d.created_at DESC
    `);
    
    if (docsResult.rows.length === 0) {
      console.log('   ⚠️  No hay documentos vectorizados');
      process.exit(0);
    }
    
    for (const doc of docsResult.rows) {
      console.log(`   [${doc.id}] ${doc.filename}`);
      console.log(`       Chunks: ${doc.total_chunks} | Fecha: ${new Date(doc.created_at).toLocaleString()}`);
    }
    console.log('');

    // 3. Estadísticas de tamaños
    console.log('3️⃣  ESTADÍSTICAS DE TAMAÑOS:');
    console.log('-'.repeat(100));
    const statsResult = await query(`
      SELECT 
        d.id as doc_id,
        d.filename,
        COUNT(dc.id) as total_chunks,
        MIN(LENGTH(dc.chunk_text)) as min_size,
        MAX(LENGTH(dc.chunk_text)) as max_size,
        ROUND(AVG(LENGTH(dc.chunk_text))) as avg_size,
        ROUND(STDDEV(LENGTH(dc.chunk_text))) as stddev_size
      FROM documents d
      JOIN document_chunks dc ON d.id = dc.document_id
      WHERE d.vectorization_status = 'completed'
      GROUP BY d.id, d.filename
      ORDER BY d.created_at DESC
    `);
    
    for (const stat of statsResult.rows) {
      console.log(`   ${stat.filename}:`);
      console.log(`       Total Chunks: ${stat.total_chunks}`);
      console.log(`       Tamaños: ${stat.min_size} - ${stat.max_size} (avg: ${stat.avg_size}, σ: ${stat.stddev_size})`);
      
      if (stat.max_size > 3000) {
        console.log(`       ⚠️  ADVERTENCIA: Chunks exceden 3000 caracteres (max: ${stat.max_size})`);
      } else {
        console.log(`       ✅ Todos los chunks ≤ 3000 caracteres`);
      }
    }
    console.log('');

    // 4. Distribución de tamaños
    console.log('4️⃣  DISTRIBUCIÓN DE TAMAÑOS (HISTOGRAMA):');
    console.log('-'.repeat(100));
    const distResult = await query(`
      SELECT 
        CASE 
          WHEN LENGTH(chunk_text) <= 500 THEN '0-500'
          WHEN LENGTH(chunk_text) <= 1000 THEN '501-1000'
          WHEN LENGTH(chunk_text) <= 1500 THEN '1001-1500'
          WHEN LENGTH(chunk_text) <= 2000 THEN '1501-2000'
          WHEN LENGTH(chunk_text) <= 2500 THEN '2001-2500'
          WHEN LENGTH(chunk_text) <= 3000 THEN '2501-3000'
          WHEN LENGTH(chunk_text) <= 3500 THEN '3001-3500'
          ELSE '>3500'
        END as rango,
        COUNT(*) as cantidad,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.vectorization_status = 'completed'
      GROUP BY rango
      ORDER BY rango
    `);
    
    for (const dist of distResult.rows) {
      const bar = '█'.repeat(Math.floor(dist.porcentaje / 2));
      console.log(`   ${dist.rango.padEnd(15)} ${String(dist.cantidad).padStart(6)} chunks (${String(dist.porcentaje).padStart(5)}%) ${bar}`);
    }
    console.log('');

    // 5. Análisis de overlap
    console.log('5️⃣  ANÁLISIS DE OVERLAP ENTRE CHUNKS CONSECUTIVOS:');
    console.log('-'.repeat(100));
    
    const chunksResult = await query(`
      SELECT 
        d.id as doc_id,
        d.filename,
        dc.chunk_index,
        dc.chunk_text
      FROM documents d
      JOIN document_chunks dc ON d.id = dc.document_id
      WHERE d.vectorization_status = 'completed'
      ORDER BY d.id, dc.chunk_index
    `);
    
    const chunksByDoc = {};
    for (const chunk of chunksResult.rows) {
      if (!chunksByDoc[chunk.doc_id]) {
        chunksByDoc[chunk.doc_id] = {
          filename: chunk.filename,
          chunks: []
        };
      }
      chunksByDoc[chunk.doc_id].chunks.push(chunk);
    }
    
    const overlapStats = [];
    
    for (const [docId, docData] of Object.entries(chunksByDoc)) {
      console.log(`   📄 ${docData.filename}:`);
      
      if (docData.chunks.length <= 1) {
        console.log(`       Solo tiene 1 chunk, no hay overlap`);
        continue;
      }
      
      const overlaps = [];
      
      for (let i = 0; i < docData.chunks.length - 1; i++) {
        const chunk1 = docData.chunks[i];
        const chunk2 = docData.chunks[i + 1];
        
        const overlapSize = findOverlap(chunk1.chunk_text, chunk2.chunk_text);
        overlaps.push(overlapSize);
        
        console.log(`       Chunk ${chunk1.chunk_index} → ${chunk2.chunk_index}: Overlap = ${overlapSize} caracteres`);
        
        if (i < 3) { // Mostrar preview solo de los primeros 3
          if (overlapSize > 0) {
            const overlapText = chunk1.chunk_text.substring(chunk1.chunk_text.length - overlapSize, chunk1.chunk_text.length - overlapSize + 50);
            console.log(`           Preview: "${overlapText}..."`);
          } else {
            console.log(`           ⚠️  Sin overlap detectado`);
          }
        }
      }
      
      if (overlaps.length > 0) {
        const avgOverlap = Math.round(overlaps.reduce((a, b) => a + b, 0) / overlaps.length);
        const minOverlap = Math.min(...overlaps);
        const maxOverlap = Math.max(...overlaps);
        
        console.log(`       📊 Estadísticas overlap: min=${minOverlap}, max=${maxOverlap}, avg=${avgOverlap}`);
        
        if (avgOverlap < 300) {
          console.log(`       ⚠️  Overlap promedio (${avgOverlap}) es menor al configurado (350)`);
        } else if (avgOverlap > 500) {
          console.log(`       ℹ️  Overlap promedio (${avgOverlap}) es mayor al configurado (350) - normal en chunking por párrafos`);
        } else {
          console.log(`       ✅ Overlap promedio (${avgOverlap}) cercano al configurado (350)`);
        }
        
        overlapStats.push({ filename: docData.filename, avgOverlap, minOverlap, maxOverlap });
      }
      
      console.log('');
    }

    // 6. Verificar límites de párrafos
    console.log('6️⃣  VERIFICACIÓN DE LÍMITES DE PÁRRAFOS:');
    console.log('-'.repeat(100));
    
    const limitsResult = await query(`
      SELECT 
        d.filename,
        dc.chunk_index,
        LENGTH(dc.chunk_text) as tamaño,
        CASE 
          WHEN TRIM(dc.chunk_text) ~ '\.$' THEN 'punto'
          WHEN TRIM(dc.chunk_text) ~ '[.!?]$' THEN 'puntuacion'
          WHEN TRIM(dc.chunk_text) ~ '[a-zA-Z0-9]$' THEN 'corte'
          ELSE 'otro'
        END as tipo_final
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.vectorization_status = 'completed'
      ORDER BY d.id, dc.chunk_index
      LIMIT 50
    `);
    
    const finalesStats = { punto: 0, puntuacion: 0, corte: 0, otro: 0 };
    
    for (const limit of limitsResult.rows) {
      finalesStats[limit.tipo_final]++;
    }
    
    const total = Object.values(finalesStats).reduce((a, b) => a + b, 0);
    
    console.log(`   Total chunks analizados: ${total}`);
    console.log(`   ✅ Terminan en punto (.): ${finalesStats.punto} (${Math.round(finalesStats.punto * 100 / total)}%)`);
    console.log(`   ✅ Terminan en puntuación (.!?): ${finalesStats.puntuacion} (${Math.round(finalesStats.puntuacion * 100 / total)}%)`);
    console.log(`   ⚠️  Cortes no naturales: ${finalesStats.corte} (${Math.round(finalesStats.corte * 100 / total)}%)`);
    console.log(`   ? Otros: ${finalesStats.otro} (${Math.round(finalesStats.otro * 100 / total)}%)`);
    console.log('');
    
    const naturalEndings = finalesStats.punto + finalesStats.puntuacion;
    const naturalPercent = Math.round(naturalEndings * 100 / total);
    
    if (naturalPercent >= 80) {
      console.log(`   ✅ ${naturalPercent}% de los chunks terminan en límites naturales (párrafos)`);
    } else if (naturalPercent >= 50) {
      console.log(`   ⚠️  Solo ${naturalPercent}% de los chunks terminan en límites naturales`);
    } else {
      console.log(`   ❌ Solo ${naturalPercent}% de los chunks terminan en límites naturales - Posiblemente no está usando chunking por párrafos`);
    }

    // 7. Resumen final
    console.log('');
    console.log('7️⃣  RESUMEN EJECUTIVO:');
    console.log('-'.repeat(100));
    
    const summaryResult = await query(`
      SELECT 
        COUNT(DISTINCT d.id) as total_documentos,
        COUNT(dc.id) as total_chunks,
        MIN(LENGTH(dc.chunk_text)) as min_chunk_size,
        MAX(LENGTH(dc.chunk_text)) as max_chunk_size,
        ROUND(AVG(LENGTH(dc.chunk_text))) as avg_chunk_size,
        COUNT(CASE WHEN LENGTH(dc.chunk_text) > 3000 THEN 1 END) as chunks_exceden_3000,
        COUNT(CASE WHEN LENGTH(dc.chunk_text) > 3300 THEN 1 END) as chunks_exceden_3300,
        ROUND(COUNT(CASE WHEN LENGTH(dc.chunk_text) > 3000 THEN 1 END) * 100.0 / COUNT(*), 2) as pct_exceden_3000
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.vectorization_status = 'completed'
    `);
    
    const summary = summaryResult.rows[0];
    
    console.log(`   📊 Documentos vectorizados: ${summary.total_documentos}`);
    console.log(`   📊 Total de chunks: ${summary.total_chunks}`);
    console.log(`   📊 Tamaño de chunks: ${summary.min_chunk_size} - ${summary.max_chunk_size} caracteres`);
    console.log(`   📊 Tamaño promedio: ${summary.avg_chunk_size} caracteres`);
    console.log(`   📊 Chunks que exceden 3000: ${summary.chunks_exceden_3000} (${summary.pct_exceden_3000}%)`);
    console.log(`   📊 Chunks que exceden 3300: ${summary.chunks_exceden_3300}`);
    console.log('');
    
    // Evaluación final
    console.log('='.repeat(100));
    console.log('📝 EVALUACIÓN FINAL:');
    console.log('='.repeat(100));
    
    const evaluation = [];
    
    // Verificar tamaño máximo
    if (summary.pct_exceden_3000 <= 10) {
      evaluation.push('✅ Tamaño máximo respetado (≤ 10% exceden 3000)');
    } else {
      evaluation.push(`⚠️  ${summary.pct_exceden_3000}% de chunks exceden 3000 caracteres`);
    }
    
    // Verificar overlap
    if (overlapStats.length > 0) {
      const avgOverlapAll = Math.round(
        overlapStats.reduce((sum, s) => sum + s.avgOverlap, 0) / overlapStats.length
      );
      
      if (avgOverlapAll >= 300 && avgOverlapAll <= 500) {
        evaluation.push(`✅ Overlap promedio ${avgOverlapAll} caracteres (objetivo 350)`);
      } else if (avgOverlapAll > 500) {
        evaluation.push(`ℹ️  Overlap promedio ${avgOverlapAll} caracteres - Mayor por preservar párrafos`);
      } else {
        evaluation.push(`⚠️  Overlap promedio ${avgOverlapAll} caracteres - Menor al objetivo (350)`);
      }
    }
    
    // Verificar límites de párrafos
    if (naturalPercent >= 80) {
      evaluation.push(`✅ ${naturalPercent}% de chunks terminan en límites naturales (párrafos)`);
    } else {
      evaluation.push(`⚠️  Solo ${naturalPercent}% de chunks terminan en límites naturales`);
    }
    
    console.log('');
    for (const eval of evaluation) {
      console.log(`   ${eval}`);
    }
    
    console.log('');
    console.log('='.repeat(100));
    console.log('✅ ANÁLISIS COMPLETADO');
    console.log('='.repeat(100));
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeChunks();

