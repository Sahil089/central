const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
const config = require('../config/index');

const s3 = new S3Client({
  region: config.awsRegion,
  credentials: {
    accessKeyId: config.awsaccesskeyid,
    secretAccessKey: config.awsaccesskey,
  },
});

const bucketName = config.awsBucketName;

/**
 * Creates organization and admin folders when organization is created
 * @param {string} orgId - Organization ID
 * @param {string} adminId - Admin ID
 */
const createOrgAndAdminFolders = async (orgId, adminId) => {
  try {
    const foldersToCreate = [
      `${orgId}/`,                    // Organization root folder
      `${orgId}/${adminId}/`,         // Admin folder inside organization
    ];

    const uploadPromises = foldersToCreate.map((folderPath) => {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: folderPath,
        Body: ""
      });
      return s3.send(command);
    });

    await Promise.all(uploadPromises);
    console.log(`Organization and admin folders created: ${orgId}/${adminId}/`);
    
    return {
      success: true,
      message: "Organization and admin folders created successfully",
      orgPath: `${orgId}/`,
      adminPath: `${orgId}/${adminId}/`
    };
  } catch (error) {
    console.error("Failed to create organization folders:", error);
    throw new Error(`Failed to create folders: ${error.message}`);
  }
};

/**
 * Optimized S3 upload function - same interface, better performance
 * @param {object} file - File object (from multer)
 * @param {string} orgId - Organization ID
 * @param {string} adminId - Admin ID
 */
const uploadFileToAdminFolder = async (file, orgId, adminId) => {
  try {
    const timestamp = Date.now();
    const originalName = path.basename(file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_'));
    const fileName = `${timestamp}-${originalName}`;
    const uploadKey = `${orgId}/${adminId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uploadKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
      // Reduced metadata for faster uploads
      Metadata: {
        'uploaded-by': String(adminId),
        'organization': String(orgId)
      }
    });

    await s3.send(command);
    console.log(`✅ File uploaded: ${uploadKey}`);

    return {
      success: true,
      message: "File uploaded successfully",
      s3Key: uploadKey,
      fileUrl: `https://${bucketName}.s3.${config.awsRegion}.amazonaws.com/${uploadKey}`,
      metadata: {
        uploadedBy: adminId,
        uploadDate: new Date().toISOString(),
        originalName,
        storedFileName: fileName,
        size: file.size,
        mimeType: file.mimetype,
        organization: orgId
      }
    };

  } catch (error) {
    console.error("❌ Upload failed:", error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};


/**
 * Delete file from S3
 * @param {string} s3Key - Full S3 key path
 */
const deleteFileFromS3 = async (s3Key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });

    await s3.send(command);
    console.log(`File deleted from S3: ${s3Key}`);
    
    return {
      success: true,
      message: "File deleted successfully",
      deletedKey: s3Key
    };
  } catch (error) {
    console.error("Failed to delete file from S3:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Delete folder and all its contents from S3
 * @param {string} orgId - Organization ID (required)
 * @param {string} adminId - Admin ID (optional - if not provided, deletes entire organization)
 * @param {string} folderPath - Folder path to delete (optional - if not provided, deletes admin folder)
 */
const deleteFolderFromS3 = async (orgId, adminId = null, folderPath = null) => {
  try {
    let s3FolderPrefix;
    let deleteType;

    // Determine what to delete based on provided parameters
    if (!adminId && !folderPath) {
      // Delete entire organization
      s3FolderPrefix = `${orgId}/`;
      deleteType = 'organization';
    } else if (adminId && !folderPath) {
      // Delete specific admin folder
      s3FolderPrefix = `${orgId}/${adminId}/`;
      deleteType = 'admin';
    } else if (adminId && folderPath) {
      // Delete specific subfolder within admin folder
      const cleanFolderPath = folderPath.replace(/^\/+/, '').replace(/\/+$/, '') + '/';
      s3FolderPrefix = `${orgId}/${adminId}/${cleanFolderPath}`;
      deleteType = 'subfolder';
    } else {
      throw new Error('Invalid parameters: adminId is required when folderPath is provided');
    }

    console.log(`Attempting to delete ${deleteType}: ${s3FolderPrefix}`);

    // List all objects with this prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: s3FolderPrefix
    });

    const result = await s3.send(listCommand);

    if (result.Contents && result.Contents.length > 0) {
      // AWS S3 has a limit of 1000 objects per delete request
      // So we'll process in batches if there are many objects
      const batchSize = 1000;
      const batches = [];
      
      for (let i = 0; i < result.Contents.length; i += batchSize) {
        batches.push(result.Contents.slice(i, i + batchSize));
      }

      // Delete objects in batches
      for (const batch of batches) {
        const deletePromises = batch.map(obj => {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: obj.Key
          });
          return s3.send(deleteCommand);
        });

        await Promise.all(deletePromises);
      }

      console.log(`${deleteType} and contents deleted from S3: ${s3FolderPrefix} (${result.Contents.length} items)`);
    } else {
      console.log(`No objects found with prefix: ${s3FolderPrefix}`);
    }

    return {
      success: true,
      message: `${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} deleted successfully`,
      deleteType,
      deletedPrefix: s3FolderPrefix,
      deletedItems: result.Contents ? result.Contents.length : 0
    };
  } catch (error) {
    console.error("Failed to delete from S3:", error);
    throw new Error(`Failed to delete: ${error.message}`);
  }
};



module.exports = {
  createOrgAndAdminFolders,
  uploadFileToAdminFolder,
  deleteFileFromS3,
  deleteFolderFromS3,

};