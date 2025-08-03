const fs = require('fs');
const path = require('path');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { pipeline } = require('stream');
const { promisify } = require('util');
const config = require("../config/index")
const s3 = new S3Client({
  region: config.awsRegion,
  credentials: {
    accessKeyId: config.awsaccesskeyid,
    secretAccessKey: config.awsaccesskey,
  },
});

const streamPipeline = promisify(pipeline);

/**
 * Downloads a file from S3 and saves it to the /tmp directory.
 * @param {string} fileUrl - The full S3 file URL.
 * @returns {string} - The local file path.
 */
async function downloadFromS3(fileUrl) {
  try {
    
    const url = new URL(fileUrl);
    const bucketName = url.hostname.split('.')[0];
    const key = decodeURIComponent(url.pathname.substring(1));
    const fileName = path.basename(key);
    const localPath = path.join(__dirname, '..', 'tmp', fileName);

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const { Body } = await s3.send(command);

    await streamPipeline(Body, fs.createWriteStream(localPath));
    return localPath;
  } catch (err) {
    console.error('❌ Error downloading from S3:', err.message);
    throw err;
  }
}

/**
 * Deletes a local file
 * @param {string} filePath - Full path to the local file
 */
async function deleteLocalFile(fileName) {
  try {
    const localPath = path.join(__dirname, '..', 'tmp', fileName);
    await fs.promises.unlink(localPath);
    console.log(`🧹 Deleted temp file: ${localPath}`);
  } catch (err) {
    console.error(`❌ Failed to delete temp file ${fileName}:`, err.message);
  }
}

module.exports = { downloadFromS3, deleteLocalFile };
