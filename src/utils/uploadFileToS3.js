const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
const config = require('../config/index')

const s3 = new S3Client({
  region: config.awsRegion,
  credentials: {
    accessKeyId: config.awsaccesskeyid,
    secretAccessKey: config.awsaccesskey,
  },
});

const bucketName = config.awsBucketName;

/**
 * Upload a file to S3 under the admin's folder
 * @param {object} file - File object (e.g., from multer)
 * @param {string} orgId - Organization ID or name
 * @param {string} adminId - Admin ID
 */
const uploadFileToS3 = async (file, orgId, adminId) => {
  const fileStream = fs.createReadStream(file.path);
  const uploadKey = `${orgId}/${adminId}/${file.originalname}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: uploadKey,
    Body: fileStream,
    ContentType: file.mimetype,
  });

  try {
    await s3.send(command);
    console.log("File uploaded to S3:", uploadKey);
    return uploadKey;
  } catch (error) {
    console.error("File upload failed:", error);
    throw new Error("Upload failed");
  }
};

module.exports = { uploadFileToS3 };
