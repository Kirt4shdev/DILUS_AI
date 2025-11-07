// Comparativa final: Small vs Large vs Ada-002
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';

async function generateEmbedding(text, config) {
  const payload = {
    model: config.model,
    input: text,
    encoding_format: 'float'
  };
  
  if (config.dimensions) {
    payload.dimensions = config.dimensions;
  }
  
  const response = await axios.post(
    OPENAI_EMBEDDING_URL,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data.data[0].embedding;
}

function cosineSimilarity(vec1, vec2) {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

async function testModel(name, config, documento, preguntas, costos) {
  console.log(`\n[${'='.repeat(name.length + 2)}]`);
  console.log(`[${name}]`);
  console.log(`[${'='.repeat(name.length + 2)}]`);
  console.log(`Modelo: ${config.model}`);
  console.log(`Dimensiones: ${config.dimensions || 'nativo'}`);
  console.log(`Costo: $${costos.costo}/1M tokens`);
  console.log(`Compatible pgvector: ${config.pgvectorCompatible ? '✓' : '✗'}`);
  
  // Generar embedding del documento
  const docEmb = await generateEmbedding(documento, config);
  console.log(`Vector generado: ${docEmb.length} dimensiones`);
  
  const scores = [];
  
  for (const pregunta of preguntas) {
    const queryEmb = await generateEmbedding(pregunta, config);
    const score = cosineSimilarity(docEmb, queryEmb);
    scores.push(score);
    console.log(`  "${pregunta}" → ${score.toFixed(4)} (${(score * 100).toFixed(2)}%)`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  
  console.log(`\n📊 Estadísticas:`);
  console.log(`   Promedio: ${avgScore.toFixed(4)} (${(avgScore * 100).toFixed(2)}%)`);
  console.log(`   Máximo:   ${maxScore.toFixed(4)} (${(maxScore * 100).toFixed(2)}%)`);
  console.log(`   Mínimo:   ${minScore.toFixed(4)} (${(minScore * 100).toFixed(2)}%)`);
  
  return {
    name,
    model: config.model,
    dimensions: docEmb.length,
    avgScore,
    maxScore,
    minScore,
    scores,
    costo: costos.costo,
    pgvectorCompatible: config.pgvectorCompatible
  };
}

async function test() {
  console.log('🧪 COMPARATIVA FINAL DE MODELOS\n');
  console.log('='.repeat(80));
  
  const documento = "Un topo debe cazarse con un hilo de seda dorado que permita envolverse en sus garras y una malla hecha con vibranium para anular sus poderes de vapeo";
  
  const preguntas = [
    "como se caza un topo?",
    "¿Cómo se caza un topo?",
    "método para cazar topos",
    "Un topo debe cazarse"
  ];
  
  console.log('📄 Documento de prueba:');
  console.log(`"${documento}"\n`);
  console.log('❓ Preguntas de prueba:');
  preguntas.forEach((p, i) => console.log(`   ${i + 1}. "${p}"`));
  console.log('\n' + '='.repeat(80));
  
  const results = [];
  
  // Test 1: text-embedding-3-small (actual)
  results.push(await testModel(
    'text-embedding-3-small',
    { model: 'text-embedding-3-small', pgvectorCompatible: true },
    documento,
    preguntas,
    { costo: 0.02 }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 2: text-embedding-3-large con 1536 dimensiones
  results.push(await testModel(
    'text-embedding-3-large (1536 dim)',
    { model: 'text-embedding-3-large', dimensions: 1536, pgvectorCompatible: true },
    documento,
    preguntas,
    { costo: 0.13 }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 3: text-embedding-3-large nativo (3072 dim)
  results.push(await testModel(
    'text-embedding-3-large (3072 dim)',
    { model: 'text-embedding-3-large', pgvectorCompatible: false },
    documento,
    preguntas,
    { costo: 0.13 }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 4: text-embedding-ada-002 (legacy)
  results.push(await testModel(
    'text-embedding-ada-002 (legacy)',
    { model: 'text-embedding-ada-002', pgvectorCompatible: true },
    documento,
    preguntas,
    { costo: 0.10 }
  ));
  
  // TABLA COMPARATIVA
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TABLA COMPARATIVA DE RESULTADOS');
  console.log('='.repeat(80));
  console.log('');
  
  // Ordenar por score promedio
  results.sort((a, b) => b.avgScore - a.avgScore);
  
  // Tabla
  console.log('┌─────┬────────────────────────────────┬──────────┬──────────┬─────────┬──────────┬─────────────┐');
  console.log('│ Pos │ Modelo                         │ Promedio │ Max      │ Min     │ Costo    │ pgvector    │');
  console.log('├─────┼────────────────────────────────┼──────────┼──────────┼─────────┼──────────┼─────────────┤');
  
  results.forEach((r, i) => {
    const pos = `${i + 1}`;
    const modelo = r.name.padEnd(30);
    const avg = `${(r.avgScore * 100).toFixed(1)}%`.padStart(8);
    const max = `${(r.maxScore * 100).toFixed(1)}%`.padStart(8);
    const min = `${(r.minScore * 100).toFixed(1)}%`.padStart(7);
    const costo = `$${r.costo}`.padEnd(8);
    const pgvector = r.pgvectorCompatible ? '✓ Sí'.padEnd(11) : '✗ No'.padEnd(11);
    
    console.log(`│  ${pos}  │ ${modelo} │ ${avg} │ ${max} │ ${min} │ ${costo} │ ${pgvector} │`);
  });
  
  console.log('└─────┴────────────────────────────────┴──────────┴──────────┴─────────┴──────────┴─────────────┘');
  
  // ANÁLISIS CALIDAD/PRECIO
  console.log('\n' + '='.repeat(80));
  console.log('💰 ANÁLISIS CALIDAD/PRECIO\n');
  
  results.forEach((r, i) => {
    const calidadPrecio = (r.avgScore / r.costo) * 100;
    const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`${emoji} ${r.name.padEnd(32)} | Score: ${(r.avgScore * 100).toFixed(1)}% | Costo: $${r.costo} | Ratio: ${calidadPrecio.toFixed(1)}`);
  });
  
  // RECOMENDACIONES
  console.log('\n' + '='.repeat(80));
  console.log('🎯 RECOMENDACIONES\n');
  
  const best = results[0];
  const cheapest = results.reduce((a, b) => a.costo < b.costo ? a : b);
  const bestRatio = results
    .filter(r => r.pgvectorCompatible)
    .sort((a, b) => (b.avgScore / b.costo) - (a.avgScore / a.costo))[0];
  
  console.log(`🏆 MEJOR CALIDAD ABSOLUTA:`);
  console.log(`   ${best.name}`);
  console.log(`   Score promedio: ${(best.avgScore * 100).toFixed(1)}%`);
  console.log(`   Costo: $${best.costo}/1M tokens`);
  if (!best.pgvectorCompatible) {
    console.log(`   ⚠️  NO compatible con pgvector actual (requiere actualización)`);
  }
  
  console.log(`\n💵 MÁS ECONÓMICO:`);
  console.log(`   ${cheapest.name}`);
  console.log(`   Score promedio: ${(cheapest.avgScore * 100).toFixed(1)}%`);
  console.log(`   Costo: $${cheapest.costo}/1M tokens`);
  
  console.log(`\n⚖️  MEJOR CALIDAD/PRECIO (compatible):`);
  console.log(`   ${bestRatio.name}`);
  console.log(`   Score promedio: ${(bestRatio.avgScore * 100).toFixed(1)}%`);
  console.log(`   Costo: $${bestRatio.costo}/1M tokens`);
  console.log(`   Ratio C/P: ${((bestRatio.avgScore / bestRatio.costo) * 100).toFixed(1)}`);
  
  // DECISIÓN FINAL
  console.log('\n' + '='.repeat(80));
  console.log('✨ DECISIÓN RECOMENDADA\n');
  
  const current = results.find(r => r.model === 'text-embedding-3-small');
  const improvement = ((best.avgScore - current.avgScore) / current.avgScore * 100).toFixed(1);
  
  if (best.pgvectorCompatible && parseFloat(improvement) > 15) {
    console.log(`🔄 CAMBIAR A: ${best.name}`);
    console.log(`   Razón: Mejora significativa del ${improvement}% en calidad`);
    console.log(`   Trade-off: +$${(best.costo - current.costo).toFixed(2)}/1M tokens más caro`);
  } else if (!best.pgvectorCompatible && parseFloat(improvement) > 30) {
    console.log(`🔄 CONSIDERAR CAMBIAR A: ${best.name}`);
    console.log(`   Razón: Mejora MUY significativa del ${improvement}% en calidad`);
    console.log(`   ⚠️  Requiere: Actualizar pgvector o usar otro vector DB`);
    console.log(`   Trade-off: +$${(best.costo - current.costo).toFixed(2)}/1M tokens más caro`);
  } else {
    console.log(`✅ MANTENER: ${current.name}`);
    console.log(`   Razón: Mejor balance calidad/precio/compatibilidad`);
    console.log(`   La mejora de otros modelos (${improvement}%) no justifica el costo/complejidad extra`);
  }
  
  console.log('\n' + '='.repeat(80));
}

test().catch(console.error);

