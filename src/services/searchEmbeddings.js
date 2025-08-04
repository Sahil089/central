// services/searchSimilarChunks.js

const client = require("../utils/qdrantclient");
const { generateEmbedding } = require("./generateEmebddings");

async function searchSimilarChunks({ orgId, query, topK = 5 }) {
  if (!query || !orgId) throw new Error('Query and orgId are required');

  const collectionName = `org_${orgId}`;
  const queryEmbedding = await generateEmbedding(query);

  console.log('🔍 Searching for similar chunks...');

  const result = await client.search(collectionName, {
    vector: queryEmbedding[0].embedding, // Use the actual embedding vector
    limit: topK,
    with_payload: true, // include original chunk text + metadata
    score_threshold: 0.50, // optional: minimum similarity threshold
  });
 

  // Format results
  const topChunks = result.map((item, index) => ({
    score: item.score,
    chunk: item.payload.chunk,
    fileName: item.payload.fileName,
    fileUrl: item.payload.fileUrl,
    documentId: item.payload.documentId,
    chunkIndex: item.payload.chunkIndex,
    metadata: item.payload,
  }));

  console.log(`✅ Found ${topChunks.length} similar chunks`);

  return topChunks;
}

module.exports = { searchSimilarChunks };
