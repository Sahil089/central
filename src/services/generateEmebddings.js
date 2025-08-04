const { OpenAI } = require('openai');
const config = require("../config/index");

// Initialize OpenAI client with optimized configuration
const openai = new OpenAI({
  apiKey: config.openAiKey,
  timeout: 30000, // 30 second timeout
  maxRetries: 3,  // Retry failed requests
});

// Cache for storing recent embeddings to avoid duplicate API calls
const embeddingCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

/**
 * Preprocesses text to optimize embedding quality
 * @param {string} text - Raw input text
 * @returns {string} - Cleaned and optimized text
 */
function preprocessText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Input must be a non-empty string');
  }

  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive punctuation
    .replace(/[.]{3,}/g, '...')
    .replace(/[!]{2,}/g, '!')
    .replace(/[?]{2,}/g, '?')
    // Trim and ensure not empty after cleaning
    .trim();
}

/**
 * Split text into chunks with overlap for better context preservation
 * @param {string} text - The input text to chunk
 * @param {number} maxTokens - Maximum tokens per chunk (default: 500 for better semantic focus)
 * @param {number} overlapTokens - Number of tokens to overlap between chunks (default: 100)
 * @param {Object} metadata - Metadata to include with chunks
 * @returns {Object[]} - Array of chunk objects with metadata
 */
function splitTextIntoChunks(text, maxTokens = 500, overlapTokens = 100, metadata = {}) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Rough token estimation (1 token ≈ 4 characters for English)
  const charsPerToken = 4;
  const maxChars = maxTokens * charsPerToken;
  const overlapChars = overlapTokens * charsPerToken;

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + maxChars, text.length);
    
    // If not at the end, try to find a natural break point (sentence, paragraph, or word boundary)
    if (endIndex < text.length) {
      // Look for sentence endings within the last 500 characters
      const searchStart = Math.max(endIndex - 500, startIndex);
      const lastSentence = text.lastIndexOf('.', endIndex);
      const lastNewline = text.lastIndexOf('\n', endIndex);
      const lastSpace = text.lastIndexOf(' ', endIndex);

      if (lastSentence > searchStart) {
        endIndex = lastSentence + 1;
      } else if (lastNewline > searchStart) {
        endIndex = lastNewline + 1;
      } else if (lastSpace > searchStart) {
        endIndex = lastSpace + 1;
      }
    }

    const chunk = text.substring(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      // Add semantic header to chunk if metadata is provided
      const chunkWithHeader = metadata.sectionTitle 
        ? `Title: ${metadata.sectionTitle}\n\n${chunk}`
        : chunk;

      chunks.push({
        chunk: chunkWithHeader,
        originalChunk: chunk, // Keep original for reference
        chunkIndex: chunks.length,
        sectionTitle: metadata.sectionTitle || null,
        fileName: metadata.fileName || null,
        fileUrl: metadata.fileUrl || null,
        startIndex,
        endIndex
      });
    }

    // Move start index forward, accounting for overlap
    if (endIndex >= text.length) {
      break;
    }
    startIndex = Math.max(endIndex - overlapChars, startIndex + 1);
  }

  return chunks;
}

/**
 * Generates a cache key for the given text and model
 * @param {string} text - The input text
 * @param {string} model - The embedding model
 * @returns {string} - Cache key
 */
function getCacheKey(text, model) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(`${model}:${text}`).digest('hex');
}

/**
 * Manages cache size by removing oldest entries
 */
function cleanupCache() {
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = embeddingCache.keys().next().value;
    embeddingCache.delete(oldestKey);
  }
}

/**
 * Generates embedding for a single chunk of text
 * @param {string} text - The text chunk to embed
 * @param {Object} options - Configuration options
 * @returns {Promise<number[]>} - The embedding vector
 */
async function generateSingleEmbedding(text, options = {}) {
  const {
    model = 'text-embedding-3-small',
    dimensions = null,
    useCache = true
  } = options;

  try {
    const cleanedText = preprocessText(text);
    
    if (cleanedText.length === 0) {
      throw new Error('Cannot generate embedding for empty text after preprocessing');
    }

    // Check cache first
    const cacheKey = getCacheKey(cleanedText, model);
    if (useCache && embeddingCache.has(cacheKey)) {
      const cached = embeddingCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.embedding;
      } else {
        embeddingCache.delete(cacheKey);
      }
    }

    // Prepare request parameters
    const requestParams = {
      model,
      input: cleanedText,
      encoding_format: 'float'
    };

    // Add dimensions parameter only for v3 models
    if (dimensions && (model.includes('text-embedding-3') || model.includes('text-embedding-ada-002'))) {
      if (model.includes('text-embedding-3-small') && (dimensions < 1 || dimensions > 1536)) {
        throw new Error('Dimensions for text-embedding-3-small must be between 1 and 1536');
      }
      if (model.includes('text-embedding-3-large') && (dimensions < 1 || dimensions > 3072)) {
        throw new Error('Dimensions for text-embedding-3-large must be between 1 and 3072');
      }
      requestParams.dimensions = dimensions;
    }

    const response = await openai.embeddings.create(requestParams);

    if (!response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error('Invalid response from OpenAI API');
    }

    const embedding = response.data[0].embedding;

    // Validate embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Received invalid embedding vector');
    }

    // Cache the result
    if (useCache) {
      cleanupCache();
      embeddingCache.set(cacheKey, {
        embedding,
        timestamp: Date.now()
      });
    }

    return embedding;

  } catch (error) {
    // Enhanced error handling
    if (error.code === 'insufficient_quota') {
      console.error('💳 OpenAI API quota exceeded');
    } else if (error.code === 'invalid_api_key') {
      console.error('🔑 Invalid OpenAI API key');
    } else if (error.code === 'model_not_found') {
      console.error(`🤖 Model '${model}' not found or not available`);
    } else if (error.message.includes('timeout')) {
      console.error('⏱️  Request timeout - consider using shorter text');
    } else {
      console.error('❌ Error generating embedding:', error.message);
    }
    
    throw error;
  }
}

/**
 * Generates embeddings for text chunks with their corresponding text and metadata
 * @param {string} text - The input text to embed
 * @param {Object} options - Configuration options
 * @param {string} options.model - Embedding model to use (default: 'text-embedding-3-small')
 * @param {number} options.dimensions - Desired embedding dimensions
 * @param {boolean} options.useCache - Whether to use caching (default: true)
 * @param {number} options.maxTokensPerChunk - Maximum tokens per chunk (default: 500)
 * @param {number} options.overlapTokens - Overlap between chunks (default: 100)
 * @param {Object} options.metadata - Metadata to include with chunks
 * @param {string} options.metadata.sectionTitle - Section title for semantic context
 * @param {string} options.metadata.fileName - Source file name
 * @param {string} options.metadata.fileUrl - Source file URL
 * @returns {Promise<{embedding: number[], chunk: string, chunkIndex: number, sectionTitle: string, fileName: string, fileUrl: string}[]>} - Array of embeddings with their chunks and metadata
 */
async function generateEmbedding(text, options = {}) {
  const {
    model = 'text-embedding-3-small',
    dimensions = null,
    useCache = true,
    maxTokensPerChunk = 500, // Reduced from 6000 for better semantic focus
    overlapTokens = 100,     // Reduced from 200
    metadata = {}
  } = options;

  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Input must be a non-empty string');
    }

    // Split text into chunks with metadata
    const chunkObjects = splitTextIntoChunks(text, maxTokensPerChunk, overlapTokens, metadata);
    
    if (chunkObjects.length === 0) {
      throw new Error('No valid chunks created from input text');
    }

    console.log(`🔄 Processing ${chunkObjects.length} chunks with model: ${model}${dimensions ? ` (${dimensions}D)` : ''}`);
    if (metadata.fileName) {
      console.log(`📁 Source: ${metadata.fileName}${metadata.sectionTitle ? ` > ${metadata.sectionTitle}` : ''}`);
    }

    const results = [];

    // Process chunks sequentially to avoid rate limiting
    for (let i = 0; i < chunkObjects.length; i++) {
      const chunkObj = chunkObjects[i];
      console.log(`📝 Processing chunk ${i + 1}/${chunkObjects.length} (${chunkObj.originalChunk.length} chars)`);

      try {
        const embedding = await generateSingleEmbedding(chunkObj.chunk, {
          model,
          dimensions,
          useCache
        });

        results.push({
          embedding,
          chunk: chunkObj.chunk,
          originalChunk: chunkObj.originalChunk,
          chunkIndex: chunkObj.chunkIndex,
          sectionTitle: chunkObj.sectionTitle,
          fileName: chunkObj.fileName,
          fileUrl: chunkObj.fileUrl,
          startIndex: chunkObj.startIndex,
          endIndex: chunkObj.endIndex
        });

        console.log(`✅ Generated ${embedding.length}D embedding for chunk ${i + 1}`);

        // Add small delay to avoid rate limiting (adjust as needed)
        if (i < chunkObjects.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (chunkError) {
        console.error(`❌ Failed to process chunk ${i + 1}:`, chunkError.message);
        // Continue with other chunks instead of failing completely
        continue;
      }
    }

    if (results.length === 0) {
      throw new Error('Failed to generate embeddings for any chunks');
    }

    console.log(`🎉 Successfully generated embeddings for ${results.length}/${chunkObjects.length} chunks`);
    return results;

  } catch (error) {
    console.error('❌ Error in generateEmbedding:', error.message);
    throw error;
  }
}

module.exports = { 
  generateEmbedding,
  splitTextIntoChunks  // Export for testing if needed
};