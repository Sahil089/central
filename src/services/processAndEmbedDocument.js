const path = require('path');
const fs = require('fs/promises');
const { downloadFromS3, deleteLocalFile } = require('../utils/bucketEmbeddingsFileOpration');
const { extractTextFromPDF, extractTextFromDocx, extractTextFromTxt } = require('../utils/parsers');
const { generateEmbedding } = require('./generateEmebddings');
const { saveToVectorDB } = require('./vectorCollection');

async function processAndEmbedDocument(fileMeta) {
  let localPath = null;
  
  try {
    const { fileUrl, type, organization, _id, name } = fileMeta;

    // Download file temporarily from S3
    localPath = await downloadFromS3(fileUrl);
    let text = '';

    switch (type) {
      case 'pdf':
        text = await extractTextFromPDF(localPath);
        break;
      case 'docx':
        text = await extractTextFromDocx(localPath);
        break;
      case 'txt':
        text = await extractTextFromTxt(localPath);
        break;
      default:
        throw new Error(`Unsupported file type for embedding: ${type}`);
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Extracted text is empty');
    }

    console.log(`📄 Processing document: ${name} (${text.length} characters)`);

    // Generate embeddings for all chunks
    const embeddingResults = await generateEmbedding(text);
    
    console.log(`🔢 Generated ${embeddingResults.length} chunk embeddings for: ${name}`);

    // Save each chunk embedding to vector DB
    const savePromises = embeddingResults.map(async (result, index) => {
      const { embedding, chunk, chunkIndex } = result;
      
      // Create unique ID for each chunk
      const chunkId = `${_id.toString()}_chunk_${chunkIndex}`;
      
      try {
        await saveToVectorDB(
          chunkId,                           // id (unique point ID for this chunk)
          organization.toString(),           // orgId (for collection)
          _id.toString(),                    // documentId (original document ID)
          embedding,                         // vector
          { 
            name, 
            fileUrl, 
            type,
            chunk,                          // Store the actual text chunk
            chunkIndex,                     // Store chunk index for reference
            totalChunks: embeddingResults.length,
            chunkLength: chunk.length
          }
        );
        
        console.log(`✅ Saved chunk ${chunkIndex + 1}/${embeddingResults.length} for: ${name}`);
        return { success: true, chunkId, chunkIndex };
        
      } catch (chunkError) {
        console.error(`❌ Failed to save chunk ${chunkIndex} for ${name}:`, chunkError.message);
        return { success: false, chunkId, chunkIndex, error: chunkError.message };
      }
    });

    // Wait for all chunks to be saved
    const saveResults = await Promise.allSettled(savePromises);
    
    const successfulSaves = saveResults.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;
    
    const failedSaves = saveResults.length - successfulSaves;
    
    if (successfulSaves > 0) {
      console.log(`🎉 Successfully embedded and saved ${successfulSaves}/${embeddingResults.length} chunks for: ${name}`);
      if (failedSaves > 0) {
        console.warn(`⚠️  ${failedSaves} chunks failed to save for: ${name}`);
      }
    } else {
      throw new Error(`Failed to save any chunks for: ${name}`);
    }

    return {
      success: true,
      documentId: _id.toString(),
      totalChunks: embeddingResults.length,
      successfulChunks: successfulSaves,
      failedChunks: failedSaves
    };

  } catch (err) {
    console.error(`❌ Failed to process file ${fileMeta.name}:`, err.message);
    throw err;
  } finally {
    // Clean up local file
    if (localPath) {
      try {
        await deleteLocalFile(fileMeta.name);
        console.log(`🧹 Cleaned up temp file: ${fileMeta.name}`);
      } catch (cleanupError) {
        console.warn(`⚠️  Failed to cleanup temp file ${fileMeta.name}:`, cleanupError.message);
      }
    }
  }
}

module.exports = processAndEmbedDocument;