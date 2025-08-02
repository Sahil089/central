const Document = require("../models/Documents");
const Folder = require("../models/Folders");
const { deleteFileFromS3 } = require("../utils/uploadToS3Service");



const extractS3KeyFromUrl = (fileUrl) => {
    try {
        const url = new URL(fileUrl);
        
        if (url.hostname.includes('.s3.') || url.hostname.includes('.s3-')) {
            return url.pathname.substring(1);
        }
        
        if (url.hostname.startsWith('s3.')) {
            const pathParts = url.pathname.split('/');
            return pathParts.slice(2).join('/');
        }
        
        return url.pathname.substring(1);
        
    } catch (error) {
        console.error(`Failed to extract S3 key from URL: ${fileUrl}`, error);
        const parts = fileUrl.split('/');
        return parts[parts.length - 1];
    }
};

// Recursive function to get all nested folder IDs
const getAllNestedFolderIds = async (folderId, orgId) => {
    const folderIds = [folderId];
    
    const subfolders = await Folder.find({
        parentFolder: folderId,
        organization: orgId,
        status: 'active'
    }).select('_id');

    for (const subfolder of subfolders) {
        const nestedIds = await getAllNestedFolderIds(subfolder._id, orgId);
        folderIds.push(...nestedIds);
    }

    return folderIds;
};

// Main deletion service function
const deleteAllDocumentsAndFiles = async (folderIds, orgId) => {
    const deletionResults = {
        documentsDeleted: 0,
        filesDeleted: 0,
        s3DeletionErrors: []
    };

    try {
        const documents = await Document.find({
            folder: { $in: folderIds },
            organization: orgId,
            status: 'active'
        }).select('fileUrl _id name');

        console.log(`Found ${documents.length} documents to delete`);

        const s3DeletionPromises = documents.map(async (doc) => {
            if (doc.fileUrl) {
                try {
                    const s3Key = extractS3KeyFromUrl(doc.fileUrl);
                    console.log(`Deleting S3 file: ${s3Key} for document: ${doc.name}`);
                    
                    const result = await deleteFileFromS3(s3Key);
                    if (result.success) {
                        deletionResults.filesDeleted++;
                    }
                } catch (error) {
                    console.error(`Failed to delete S3 file for document ${doc._id}:`, error);
                    deletionResults.s3DeletionErrors.push({
                        documentId: doc._id,
                        documentName: doc.name,
                        fileUrl: doc.fileUrl,
                        error: error.message
                    });
                }
            }
        });

        await Promise.allSettled(s3DeletionPromises);

        const documentDeletionResult = await Document.deleteMany({
            folder: { $in: folderIds },
            organization: orgId
        });

        deletionResults.documentsDeleted = documentDeletionResult.deletedCount;

        console.log(`Deleted ${deletionResults.documentsDeleted} documents from database`);
        console.log(`Deleted ${deletionResults.filesDeleted} files from S3`);
        
        if (deletionResults.s3DeletionErrors.length > 0) {
            console.log(`${deletionResults.s3DeletionErrors.length} S3 deletion errors occurred`);
        }

        return deletionResults;
    } catch (error) {
        console.error('Error in deleteAllDocumentsAndFiles:', error);
        throw error;
    }
};

// Complete folder deletion service
const deleteFolderRecursively = async (folderId, orgId) => {
    try {
        // Get all nested folder IDs
        const allFolderIds = await getAllNestedFolderIds(folderId, orgId);
        console.log(`Found ${allFolderIds.length} folders to delete:`, allFolderIds);

        // Delete all documents and files
        const deletionResults = await deleteAllDocumentsAndFiles(allFolderIds, orgId);

        // Delete all folders
        const folderDeletionResult = await Folder.deleteMany({
            _id: { $in: allFolderIds },
            organization: orgId
        });

        return {
            ...deletionResults,
            foldersDeleted: folderDeletionResult.deletedCount,
            deletedFolderIds: allFolderIds
        };
    } catch (error) {
        console.error('Error in deleteFolderRecursively:', error);
        throw error;
    }
};

module.exports = {
    getAllNestedFolderIds,
    deleteAllDocumentsAndFiles,
    deleteFolderRecursively,
    extractS3KeyFromUrl
};