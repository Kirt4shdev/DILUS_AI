// Test de estrategias avanzadas
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

async function generateHyDE(query) {
  const response = await axios.post(
    OPENAI_CHAT_URL,
    {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente que genera respuestas hipotéticas concisas. Dada una pregunta, genera una respuesta breve y directa de 1-2 frases como si fuera el contenido de un documento que respondería esa pregunta.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.5,
      max_tokens: 100
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data.choices[0].message.content.trim();
}

async function semanticReranking(documento, query) {
  const response = await axios.post(
    OPENAI_CHAT_URL,
    {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto evaluador de relevancia. Dada una pregunta y un documento, evalúa del 0 al 100 qué tan relevante es el documento para responder la pregunta. Responde SOLO con el número.'
        },
        {
          role: 'user',
          content: `Pregunta: ${query}\n\nDocumento: ${documento}\n\nRelevancia (0-100):`
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const score = parseInt(response.data.choices[0].message.content.trim());
  return score / 100;
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

async function test() {
  console.log('🧪 Test de Estrategias Avanzadas\n');
  console.log('='.repeat(80));
  
  const documento = "Un topo debe cazarse con un hilo de seda dorado que permita envolverse en sus garras y una malla hecha con vibranium para anular sus poderes de vapeo";
  const pregunta = "como se caza un topo?";
  
  console.log('📄 Documento:', documento);
  console.log('❓ Pregunta:', pregunta);
  console.log('\n' + '='.repeat(80));
  
  // BASELINE
  console.log('\n[BASELINE] 🔵 text-embedding-3-small');
  const docEmb = await generateEmbedding(documento);
  const queryEmb = await generateEmbedding(pregunta);
  const scoreBaseline = cosineSimilarity(docEmb, queryEmb);
  console.log(`Score: ${scoreBaseline.toFixed(4)} (${(scoreBaseline * 100).toFixed(2)}%)`);
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // ESTRATEGIA 1: HyDE (Hypothetical Document Embeddings)
  console.log('\n[ESTRATEGIA 1] 🟢 HyDE - Respuesta Hipotética');
  console.log('Generando respuesta hipotética con GPT-3.5...');
  const hydeResponse = await generateHyDE(pregunta);
  console.log(`Respuesta hipotética: "${hydeResponse}"`);
  const hydeEmb = await generateEmbedding(hydeResponse);
  const scoreHyDE = cosineSimilarity(docEmb, hydeEmb);
  console.log(`Score HyDE: ${scoreHyDE.toFixed(4)} (${(scoreHyDE * 100).toFixed(2)}%)`);
  console.log(`Mejora: ${((scoreHyDE - scoreBaseline) * 100).toFixed(2)}% ${scoreHyDE > scoreBaseline ? '✓' : '✗'}`);
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // ESTRATEGIA 2: text-embedding-ada-002 (modelo anterior)
  console.log('\n[ESTRATEGIA 2] 🟡 text-embedding-ada-002 (legacy)');
  try {
    const docEmbAda = await generateEmbedding(documento, 'text-embedding-ada-002');
    const queryEmbAda = await generateEmbedding(pregunta, 'text-embedding-ada-002');
    const scoreAda = cosineSimilarity(docEmbAda, queryEmbAda);
    console.log(`Score Ada-002: ${scoreAda.toFixed(4)} (${(scoreAda * 100).toFixed(2)}%)`);
    console.log(`Mejora: ${((scoreAda - scoreBaseline) * 100).toFixed(2)}% ${scoreAda > scoreBaseline ? '✓' : '✗'}`);
  } catch (error) {
    console.log(`Error con ada-002: ${error.message}`);
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // ESTRATEGIA 3: Semantic Reranking con LLM
  console.log('\n[ESTRATEGIA 3] 🟣 Semantic Reranking con GPT-3.5');
  console.log('Evaluando relevancia con LLM...');
  const rerankedScore = await semanticReranking(documento, pregunta);
  console.log(`Score Reranking: ${rerankedScore.toFixed(4)} (${(rerankedScore * 100).toFixed(2)}%)`);
  console.log(`Mejora: ${((rerankedScore - scoreBaseline) * 100).toFixed(2)}% ${rerankedScore > scoreBaseline ? '✓' : '✗'}`);
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // ESTRATEGIA 4: Híbrido HyDE + Original
  console.log('\n[ESTRATEGIA 4] 🔴 HyDE + Query Original (promedio)');
  const hybridEmb = hydeEmb.map((val, idx) => (val + queryEmb[idx]) / 2);
  const scoreHybrid = cosineSimilarity(docEmb, hybridEmb);
  console.log(`Score Híbrido: ${scoreHybrid.toFixed(4)} (${(scoreHybrid * 100).toFixed(2)}%)`);
  console.log(`Mejora: ${((scoreHybrid - scoreBaseline) * 100).toFixed(2)}% ${scoreHybrid > scoreBaseline ? '✓' : '✗'}`);
  
  // RESUMEN
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESUMEN DE RESULTADOS:\n');
  const results = [
    { name: 'Baseline (3-small)', score: scoreBaseline, symbol: '🔵', viable: true },
    { name: 'HyDE', score: scoreHyDE, symbol: '🟢', viable: true },
    { name: 'Semantic Reranking', score: rerankedScore, symbol: '🟣', viable: true },
    { name: 'HyDE + Original', score: scoreHybrid, symbol: '🔴', viable: true }
  ];
  
  results.sort((a, b) => b.score - a.score);
  
  results.forEach((r, i) => {
    const improvement = ((r.score - scoreBaseline) / scoreBaseline * 100).toFixed(1);
    const improvementStr = r.score > scoreBaseline ? `+${improvement}%` : improvement === '0.0' ? 'baseline' : `${improvement}%`;
    console.log(`${i + 1}. ${r.symbol} ${r.name.padEnd(25)} | Score: ${r.score.toFixed(4)} | ${improvementStr}`);
  });
  
  console.log('\n' + '='.repeat(80));
  const winner = results[0];
  console.log(`\n🏆 MEJOR ESTRATEGIA: ${winner.name}`);
  console.log(`   Score: ${winner.score.toFixed(4)}`);
  
  if (winner.score > scoreBaseline * 1.1) {
    console.log(`   ✅ MEJORA SIGNIFICATIVA (+${((winner.score - scoreBaseline) / scoreBaseline * 100).toFixed(1)}%)`);
    console.log(`   👉 RECOMENDACIÓN: Implementar ${winner.name}`);
  } else if (winner.score > scoreBaseline) {
    console.log(`   🟡 MEJORA MODERADA (+${((winner.score - scoreBaseline) / scoreBaseline * 100).toFixed(1)}%)`);
    console.log(`   👉 RECOMENDACIÓN: Considerar implementar ${winner.name}`);
  } else {
    console.log(`   ❌ Sin mejora significativa`);
    console.log(`   👉 RECOMENDACIÓN: El sistema actual ya está optimizado para este caso`);
  }
}

test().catch(console.error);

