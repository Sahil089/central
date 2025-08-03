// services/createCollection.js
const client = require('../utils/qdrantclient');


async function createVectorCollection(orgId) {
    const collectionName = `org_${orgId}`;

    await client.createCollection(collectionName, {
        vectors: {
            size: 1536, // OpenAI or model-specific
            distance: 'Cosine', // or 'Dot' / 'Euclidean'
        },
    });

    console.log(`✅ Created collection: ${collectionName}`);
}

async function deleteVectorCollection(orgId) {
    const collectionName = `org_${orgId}`;

    try {
        await client.deleteCollection(collectionName);
        console.log(`🗑️ Deleted collection: ${collectionName}`);
    } catch (error) {
        console.error(`❌ Failed to delete collection ${collectionName}:`, error.message);
        throw error;
    }
}



/**
 * Save embedding and metadata to Qdrant (optimized for chunk-based storage)
 * @param {string} id - Unique identifier for the vector point (includes chunk info)
 * @param {string} orgId - The organization ID (used to resolve collection)
 * @param {string} documentId - MongoDB document ID (original document identifier)
 * @param {number[]} embedding - Embedding vector
 * @param {object} payload - Additional metadata including chunk data
 * @param {string} payload.chunk - The actual text chunk
 * @param {number} payload.chunkIndex - Index of this chunk
 * @param {number} payload.totalChunks - Total number of chunks for this document
 * @param {number} payload.chunkLength - Length of this chunk in characters
 * @param {string} payload.name - Original file name
 * @param {string} payload.fileUrl - S3 URL of the original file
 * @param {string} payload.type - File type (pdf, docx, txt)
 */
async function saveToVectorDB(id, orgId, documentId, embedding, payload = {}) {
  try {
    const collectionName = `org_${orgId}`;

    // Validate embedding (dynamic size validation for different models)
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error(`Invalid embedding: expected non-empty array, got ${typeof embedding}`);
    }

    // Common embedding sizes: 1536 (text-embedding-3-small), 3072 (text-embedding-3-large), 1536 (ada-002)
    const validEmbeddingSizes = [1536, 3072];
    if (!validEmbeddingSizes.includes(embedding.length)) {
      console.warn(`⚠️  Unusual embedding size: ${embedding.length}. Expected: ${validEmbeddingSizes.join(' or ')}`);
    }

    // Validate embedding values
    if (embedding.some(val => typeof val !== 'number' || !isFinite(val))) {
      throw new Error('Embedding contains invalid values (NaN, Infinity, or non-numbers)');
    }

    // ✅ Check if collection exists
    const collectionsRes = await client.getCollections();
    const collectionExists = collectionsRes.collections.some(col => col.name === collectionName);

    if (!collectionExists) {
      console.log(`Creating new collection: ${collectionName}`);
      await client.createCollection(collectionName, {
        vectors: {
          size: embedding.length, // Dynamic size based on actual embedding
          distance: 'Cosine',
        },
      });
      console.log(`🆕 Created collection: ${collectionName} with vector size: ${embedding.length}`);
    }

    // ✅ Generate proper point ID for chunk
    const pointId = generatePointId(id);

    // ✅ Validate required chunk payload
    const { chunk, chunkIndex, totalChunks, chunkLength } = payload;
    
    if (typeof chunk !== 'string' || chunk.trim().length === 0) {
      throw new Error('Chunk text is required and must be a non-empty string');
    }
    
    if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
      throw new Error('chunkIndex must be a non-negative number');
    }

    // ✅ Prepare point with enhanced chunk metadata
    const point = {
      id: pointId,
      vector: embedding,
      payload: {
        // Document identification
        documentId,
        originalId: id,
        orgId,
        
        // Chunk-specific data
        chunk: chunk.trim(), // Store the actual text chunk
        chunkIndex,
        totalChunks: totalChunks || 1,
        chunkLength: chunkLength || chunk.length,
        
        // Document metadata
        fileName: payload.name || 'unknown',
        fileUrl: payload.fileUrl || '',
        fileType: payload.type || 'unknown',
        
        // Timestamps and versioning
        createdAt: new Date().toISOString(),
        embeddingModel: payload.embeddingModel || 'text-embedding-3-small',
        embeddingSize: embedding.length,
        
        // Search optimization fields
        isChunked: true,
        chunkId: id, // For easy chunk identification
        
        // Additional metadata
        ...payload
      },
    };
    // ✅ Log chunk information for debugging
    console.log(`📄 Saving chunk ${chunkIndex + 1}/${totalChunks} for document: ${documentId}`);
    console.log(`📝 Chunk preview: "${chunk.substring(0, 100)}${chunk.length > 100 ? '...' : ''}"`);
    console.log(`🔢 Embedding size: ${embedding.length}D, Point ID: ${pointId}`);

    // ✅ Upsert into Qdrant with proper options
    const response = await client.upsert(collectionName, {
      wait: true, // Wait for operation to complete
      points: [point],
    });

    console.log(`📥 Vector saved to Qdrant - Doc: ${documentId}, Chunk: ${chunkIndex}`, {
      operation_id: response.operation_id,
      status: response.status
    });

    return { 
      success: true, 
      pointId, 
      chunkIndex,
      chunkId: id,
      response 
    };

  } catch (error) {
    console.error('❌ Failed to save vector to Qdrant:', {
      message: error.message,
      stack: error.stack,
      chunkId: id,
      orgId,
      documentId,
      chunkIndex: payload.chunkIndex
    });
    throw error;
  }
}

/**
 * Generate a proper point ID for Qdrant from chunk ID
 * @param {string} originalId - Original chunk ID (e.g., "documentId_chunk_0")
 * @returns {number} - Integer ID for Qdrant
 */
function generatePointId(originalId) {
  try {
    // Method 1: For chunk IDs, create a more robust hash
    if (typeof originalId === 'string') {
      // Use a better hashing algorithm for chunk IDs
      let hash = 0;
      const str = originalId.toString();
      
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      // Ensure positive number and within safe integer range
      const positiveHash = Math.abs(hash);
      return positiveHash > Number.MAX_SAFE_INTEGER ? positiveHash % 1000000000 : positiveHash;
    }
    
    // Method 2: Fallback for non-string IDs
    return Math.abs(originalId.toString().split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0));
    
  } catch (error) {
    console.warn(`⚠️  Error generating point ID for ${originalId}, using fallback`);
    // Ultimate fallback: use timestamp + random
    return Math.abs(Date.now() + Math.floor(Math.random() * 1000000));
  }
}

/**
 * Batch save multiple chunk embeddings (for better performance)
 * @param {Array} chunkData - Array of chunk objects with {id, orgId, documentId, embedding, payload}
 * @returns {Promise<{success: boolean, results: Array, errors: Array}>}
 */
async function batchSaveToVectorDB(chunkData) {
  if (!Array.isArray(chunkData) || chunkData.length === 0) {
    throw new Error('chunkData must be a non-empty array');
  }

  const results = [];
  const errors = [];
  
  // Group by organization for batch processing
  const groupedByOrg = chunkData.reduce((acc, chunk) => {
    const orgId = chunk.orgId;
    if (!acc[orgId]) acc[orgId] = [];
    acc[orgId].push(chunk);
    return acc;
  }, {});

  for (const [orgId, chunks] of Object.entries(groupedByOrg)) {
    try {
      const collectionName = `org_${orgId}`;
      
      // Prepare all points for this organization
      const points = chunks.map(({ id, documentId, embedding, payload }) => ({
        id: generatePointId(id),
        vector: embedding,
        payload: {
          documentId,
          originalId: id,
          orgId,
          chunk: payload.chunk?.trim() || '',
          chunkIndex: payload.chunkIndex || 0,
          totalChunks: payload.totalChunks || 1,
          chunkLength: payload.chunkLength || payload.chunk?.length || 0,
          fileName: payload.name || 'unknown',
          fileUrl: payload.fileUrl || '',
          fileType: payload.type || 'unknown',
          createdAt: new Date().toISOString(),
          embeddingModel: payload.embeddingModel || 'text-embedding-3-small',
          embeddingSize: embedding.length,
          isChunked: true,
          chunkId: id,
          ...payload
        }
      }));

      // Batch upsert
      const response = await client.upsert(collectionName, {
        wait: true,
        points: points,
      });

      results.push({
        orgId,
        chunksProcessed: points.length,
        response
      });

      console.log(`📦 Batch saved ${points.length} chunks for org: ${orgId}`);

    } catch (orgError) {
      console.error(`❌ Failed to batch save chunks for org ${orgId}:`, orgError.message);
      errors.push({
        orgId,
        error: orgError.message,
        chunksAffected: chunks.length
      });
    }
  }

  return {
    success: results.length > 0,
    results,
    errors,
    totalProcessed: results.reduce((sum, r) => sum + r.chunksProcessed, 0),
    totalErrors: errors.reduce((sum, e) => sum + e.chunksAffected, 0)
  };
}



module.exports = {deleteVectorCollection,createVectorCollection,saveToVectorDB,batchSaveToVectorDB};


