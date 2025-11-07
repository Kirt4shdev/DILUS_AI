// Test de estrategias de optimización
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

async function generateEmbedding(text, model = 'text-embedding-3-small') {
  const response = await axios.post(
    OPENAI_EMBEDDING_URL,
    {
      model: model,
      input: text,
      encoding_format: 'float'
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.data[0].embedding;
}

async function expandQuery(query) {
  const response = await axios.post(
    OPENAI_CHAT_URL,
    {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en expandir consultas de búsqueda. Dada una pregunta, genera 2-3 variaciones semánticas de la misma pregunta para mejorar la búsqueda. Devuelve solo las variaciones, una por línea, sin numeración.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.3,
      max_tokens: 150
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const variations = response.data.choices[0].message.content.trim().split('\n').filter(v => v.trim());
  return [query, ...variations];
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

function chunkText(text, chunkSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

async function test() {
  console.log('🧪 Test de Estrategias de Optimización\n');
  console.log('='.repeat(80));
  
  const documento = "Un topo debe cazarse con un hilo de seda dorado que permita envolverse en sus garras y una malla hecha con vibranium para anular sus poderes de vapeo";
  const pregunta = "como se caza un topo?";
  
  console.log('📄 Documento:', documento);
  console.log('❓ Pregunta:', pregunta);
  console.log('\n' + '='.repeat(80));
  
  // ESTRATEGIA 1: Baseline (actual)
  console.log('\n[ESTRATEGIA 1] 🔵 BASELINE (actual)');
  const docEmb1 = await generateEmbedding(documento);
  const queryEmb1 = await generateEmbedding(pregunta);
  const score1 = cosineSimilarity(docEmb1, queryEmb1);
  console.log(`Score: ${score1.toFixed(4)} (${(score1 * 100).toFixed(2)}%)`);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // ESTRATEGIA 2: Query Expansion
  console.log('\n[ESTRATEGIA 2] 🟢 QUERY EXPANSION');
  console.log('Expandiendo query con GPT-3.5...');
  const expandedQueries = await expandQuery(pregunta);
  console.log('Variaciones generadas:');
  expandedQueries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  
  let maxScore2 = 0;
  let bestVariation = '';
  for (const variation of expandedQueries) {
    const varEmb = await generateEmbedding(variation);
    const varScore = cosineSimilarity(docEmb1, varEmb);
    if (varScore > maxScore2) {
      maxScore2 = varScore;
      bestVariation = variation;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  console.log(`Mejor variación: "${bestVariation}"`);
  console.log(`Score máximo: ${maxScore2.toFixed(4)} (${(maxScore2 * 100).toFixed(2)}%)`);
  console.log(`Mejora: ${((maxScore2 - score1) * 100).toFixed(2)}% ${maxScore2 > score1 ? '✓' : '✗'}`);
  
  // ESTRATEGIA 3: Chunking más pequeño
  console.log('\n[ESTRATEGIA 3] 🟡 CHUNKS MÁS PEQUEÑOS (500 chars)');
  const chunks500 = chunkText(documento, 500);
  console.log(`Chunks generados: ${chunks500.length}`);
  let maxScore3 = 0;
  for (let i = 0; i < chunks500.length; i++) {
    if (chunks500[i].trim().length < 20) continue;
    const chunkEmb = await generateEmbedding(chunks500[i]);
    const chunkScore = cosineSimilarity(chunkEmb, queryEmb1);
    console.log(`  Chunk ${i + 1}: ${chunkScore.toFixed(4)}`);
    if (chunkScore > maxScore3) maxScore3 = chunkScore;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  console.log(`Score máximo: ${maxScore3.toFixed(4)} (${(maxScore3 * 100).toFixed(2)}%)`);
  console.log(`Mejora: ${((maxScore3 - score1) * 100).toFixed(2)}% ${maxScore3 > score1 ? '✓' : '✗'}`);
  
  // ESTRATEGIA 4: Prompt-enhanced query
  console.log('\n[ESTRATEGIA 4] 🟣 QUERY CON CONTEXTO');
  const enhancedQuery = `Busco información sobre: ${pregunta}. Específicamente sobre métodos, herramientas o técnicas.`;
  console.log(`Query mejorada: "${enhancedQuery}"`);
  const enhancedEmb = await generateEmbedding(enhancedQuery);
  const score4 = cosineSimilarity(docEmb1, enhancedEmb);
  console.log(`Score: ${score4.toFixed(4)} (${(score4 * 100).toFixed(2)}%)`);
  console.log(`Mejora: ${((score4 - score1) * 100).toFixed(2)}% ${score4 > score1 ? '✓' : '✗'}`);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // ESTRATEGIA 5: Embeddings combinados (promedio)
  console.log('\n[ESTRATEGIA 5] 🔴 EMBEDDING COMBINADO (query + variación)');
  const variation1 = "métodos para capturar topos";
  const emb1 = await generateEmbedding(pregunta);
  const emb2 = await generateEmbedding(variation1);
  
  // Promedio de embeddings
  const combinedEmb = emb1.map((val, idx) => (val + emb2[idx]) / 2);
  const score5 = cosineSimilarity(docEmb1, combinedEmb);
  console.log(`Score: ${score5.toFixed(4)} (${(score5 * 100).toFixed(2)}%)`);
  console.log(`Mejora: ${((score5 - score1) * 100).toFixed(2)}% ${score5 > score1 ? '✓' : '✗'}`);
  
  // RESUMEN
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESUMEN DE RESULTADOS:\n');
  const results = [
    { name: 'Baseline (actual)', score: score1, symbol: '🔵' },
    { name: 'Query Expansion', score: maxScore2, symbol: '🟢' },
    { name: 'Chunks pequeños', score: maxScore3, symbol: '🟡' },
    { name: 'Query con contexto', score: score4, symbol: '🟣' },
    { name: 'Embedding combinado', score: score5, symbol: '🔴' }
  ];
  
  results.sort((a, b) => b.score - a.score);
  
  results.forEach((r, i) => {
    const improvement = ((r.score - score1) / score1 * 100).toFixed(1);
    const improvementStr = r.score > score1 ? `+${improvement}%` : improvement === '0.0' ? 'baseline' : `${improvement}%`;
    console.log(`${i + 1}. ${r.symbol} ${r.name.padEnd(25)} | Score: ${r.score.toFixed(4)} | ${improvementStr}`);
  });
  
  console.log('\n' + '='.repeat(80));
  const winner = results[0];
  console.log(`\n🏆 GANADOR: ${winner.name}`);
  console.log(`   Score: ${winner.score.toFixed(4)} (mejora del ${((winner.score - score1) / score1 * 100).toFixed(1)}%)`);
}

test().catch(console.error);

