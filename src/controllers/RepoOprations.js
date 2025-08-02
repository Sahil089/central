const Folder = require("../models/Folders");
const mongoose = require('mongoose');
const Document = require('../models/Documents');
const { deleteFolderRecursively } = require("../services/FilesHandelingService");
const { uploadFileToAdminFolder } = require("../utils/uploadToS3Service");
const allowedMimeTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
exports.createFolder = async (req, res) => {
    try {
        const { folderName, OrgId, adminId, parentFolderId } = req.body;

        // Input validation
        if (!folderName || !OrgId || !adminId) {
            return res.status(400).json({
                success: false,
                message: "Folder name, organization ID, and admin ID are required"
            });
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(OrgId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid organization ID format"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(adminId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin ID format"
            });
        }

        if (parentFolderId && !mongoose.Types.ObjectId.isValid(parentFolderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid parent folder ID format"
            });
        }

        // Validate folder name (additional checks)
        if (folderName.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Folder name cannot be empty or only whitespace"
            });
        }

        if (folderName.length > 255) {
            return res.status(400).json({
                success: false,
                message: "Folder name cannot exceed 255 characters"
            });
        }

        // If parentFolderId is provided, validate parent folder exists and belongs to same organization
        if (parentFolderId) {
            const parentFolder = await Folder.findOne({
                _id: parentFolderId,
                organization: OrgId,
                status: 'active'
            });

            if (!parentFolder) {
                return res.status(404).json({
                    success: false,
                    message: "Parent folder not found or doesn't belong to this organization"
                });
            }

            // Check for circular dependency (prevent folder being its own parent)
            if (parentFolderId === folderName) {
                return res.status(400).json({
                    success: false,
                    message: "Folder cannot be its own parent"
                });
            }
        }

        // Check for duplicate folder names at the SAME LEVEL only
        // This means: same parent folder AND same organization
        const existingFolder = await Folder.findOne({
            name: folderName.trim(),
            organization: OrgId,
            parentFolder: parentFolderId || null, // null for root level, specific ID for sub-folders
            status: 'active'
        });

        if (existingFolder) {
            return res.status(409).json({
                success: false,
                message: parentFolderId 
                    ? "A folder with this name already exists at the same level in this parent folder"
                    : "A root folder with this name already exists in this organization"
            });
        }

        // Create the folder object
        const folderData = {
            name: folderName.trim(),
            organization: OrgId,
            createdBy: adminId,
            ...(parentFolderId && { parentFolder: parentFolderId })
        };

        const newFolder = new Folder(folderData);
        const savedFolder = await newFolder.save();

        // Populate the response with referenced data
        const populatedFolder = await Folder.findById(savedFolder._id)
            .populate('organization', 'name')
            .populate('createdBy', 'name email')
            .populate('parentFolder', 'name');

        return res.status(201).json({
            success: true,
            message: "Folder created successfully",
            data: {
                folder: populatedFolder,
                isRootFolder: !parentFolderId
            }
        });

    } catch (error) {
        console.error('Error creating folder:', error);

        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A folder with this name already exists in the specified location"
            });
        }

        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: validationErrors
            });
        }

        // Handle cast errors (invalid ObjectId)
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format provided"
            });
        }

        // Generic server error
        return res.status(500).json({
            success: false,
            message: "Internal server error occurred while creating folder"
        });
    }
};

exports.deleteFolders = async (req, res) => {
    try {
        const { folderId, OrgId, AdminId } = req.params;

        // Input validation
        if (!folderId || !OrgId || !AdminId) {
            return res.status(400).json({
                success: false,
                message: "Folder ID, Organization ID, and Admin ID are required"
            });
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(folderId) || 
            !mongoose.Types.ObjectId.isValid(OrgId) || 
            !mongoose.Types.ObjectId.isValid(AdminId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format provided"
            });
        }

        // Check if folder exists and belongs to the organization
        const targetFolder = await Folder.findOne({
            _id: folderId,
            organization: OrgId,
            status: 'active'
        });

        if (!targetFolder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found or doesn't belong to this organization"
            });
        }

        console.log(`Starting deletion process for folder: ${folderId}`);

        // Use service to handle the complex deletion logic
        const deletionResults = await deleteFolderRecursively(folderId, OrgId);

        console.log('Deletion completed successfully:', {
            targetFolderId: folderId,
            ...deletionResults
        });

        // Prepare response
        const response = {
            success: true,
            message: "Folder and all contents deleted successfully",
            data: {
                targetFolderId: folderId,
                foldersDeleted: deletionResults.foldersDeleted,
                documentsDeleted: deletionResults.documentsDeleted,
                filesDeletedFromS3: deletionResults.filesDeleted,
                deletedFolderIds: deletionResults.deletedFolderIds
            }
        };

        // Include S3 errors in response if any
        if (deletionResults.s3DeletionErrors.length > 0) {
            response.warnings = {
                message: "Some files could not be deleted from S3",
                errors: deletionResults.s3DeletionErrors
            };
        }

        return res.status(200).json(response);

    } catch (error) {
        console.error('Error in deleteFolders controller:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format provided"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error occurred while deleting folder",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};



exports.uploadFile = async (req, res) => {
  try {
    const {  folderId, OrgId, adminId } = req.body;
    const files = req.files;

    if (!folderId || !OrgId || !adminId) {
      return res.status(400).json({ message: 'folderId, organizationId, and AdminId are required' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    const uploadResults = [];

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ message: `Unsupported file type: ${file.originalname}` });
      }

      const s3Upload = await uploadFileToAdminFolder(file, OrgId, adminId);

      const extension = file.originalname.split('.').pop().toLowerCase();
      const docType = ['pdf', 'txt', 'docx'].includes(extension) ? extension : 'other';

      const newDocument = new Document({
        name: s3Upload.metadata.storedFileName,
        fileUrl: s3Upload.fileUrl,
        type: docType,
        folder: folderId,
        organization: OrgId,
        uploadedBy: adminId,
        metadata: {
          size: file.size
        }
      });

      await newDocument.save();
      uploadResults.push(newDocument);
    }

    res.status(201).json({
      message: 'File(s) uploaded and saved successfully',
      documents: uploadResults
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};