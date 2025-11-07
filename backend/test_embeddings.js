// Test script para verificar similitud de embeddings
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';

async function generateEmbedding(text, model = 'text-embedding-3-large') {
  const response = await axios.post(
    OPENAI_EMBEDDING_URL,
    {
      model: model,
      input: text,
      dimensions: 1536,
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
  console.log('🧪 Test de Embeddings\n');
  
  const text1 = "Un topo debe cazarse con un hilo de seda dorado que permita envolverse en sus garras y una malla hecha con vibranium para anular sus poderes de vapeo";
  const text2 = "Como se caza un topo?";
  
  console.log('Texto 1:', text1);
  console.log('Texto 2:', text2);
  console.log('\n--- Probando text-embedding-3-large ---');
  
  const emb1_large = await generateEmbedding(text1, 'text-embedding-3-large');
  const emb2_large = await generateEmbedding(text2, 'text-embedding-3-large');
  const similarity_large = cosineSimilarity(emb1_large, emb2_large);
  
  console.log(`Similitud coseno: ${similarity_large.toFixed(4)}`);
  console.log(`Dimensiones: ${emb1_large.length}`);
  
  console.log('\n--- Probando text-embedding-3-small (comparación) ---');
  
  const emb1_small = await generateEmbedding(text1, 'text-embedding-3-small');
  const emb2_small = await generateEmbedding(text2, 'text-embedding-3-small');
  const similarity_small = cosineSimilarity(emb1_small, emb2_small);
  
  console.log(`Similitud coseno: ${similarity_small.toFixed(4)}`);
  console.log(`Dimensiones: ${emb1_small.length}`);
}

test().catch(console.error);

