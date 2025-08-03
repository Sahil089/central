const Folder = require("../models/Folders");
const mongoose = require('mongoose');
const Document = require('../models/Documents');
const { deleteFolderRecursively } = require("../services/FilesHandelingService");
const { uploadFileToAdminFolder } = require("../utils/uploadToS3Service");
const processAndEmbedDocument = require("../services/processAndEmbedDocument");
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
    const { folderId, OrgId, adminId } = req.body;
    const files = req.files;

    if (!folderId || !OrgId || !adminId) {
      return res.status(400).json({ 
        message: 'folderId, organizationId, and AdminId are required' 
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        message: 'No files provided' 
      });
    }

    // Validate all files first (fail fast approach)
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ 
          message: `Unsupported file type: ${file.originalname}` 
        });
      }
    }

    // Process all uploads in parallel instead of sequentially
    const uploadPromises = files.map(async (file) => {
      const s3Upload = await uploadFileToAdminFolder(file, OrgId, adminId);
      const extension = file.originalname.split('.').pop().toLowerCase();
      const docType = ['pdf', 'txt', 'docx'].includes(extension) ? extension : 'other';

      return {
        name: s3Upload.metadata.storedFileName,
        fileUrl: s3Upload.fileUrl,
        type: docType,
        folder: folderId,
        organization: OrgId,
        uploadedBy: adminId,
        metadata: {
          size: file.size
        }
      };
    });

    // Wait for all uploads to complete
    const documentDataArray = await Promise.all(uploadPromises);

    // Bulk insert all documents at once (much faster than individual saves)
    const savedDocuments = await Document.insertMany(documentDataArray);
    savedDocuments.forEach((doc) => {
  // Fire-and-forget
  setImmediate(() => processAndEmbedDocument(doc));
});
    res.status(201).json({
      message: 'File(s) uploaded and saved successfully',
      documents: savedDocuments
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getFolderContents = async (req, res) => {
    try {
        const { folderId, OrgId } = req.params;
        const { includeArchived = false } = req.query;

        // Input validation
        if (!folderId || !OrgId) {
            return res.status(400).json({
                success: false,
                message: "Folder ID and Organization ID are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(folderId) || !mongoose.Types.ObjectId.isValid(OrgId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format provided"
            });
        }

        const statusFilter = includeArchived === 'true' 
            ? { status: { $in: ['active', 'archived'] } }
            : { status: 'active' };

        // Verify folder exists and belongs to organization
        const parentFolder = await Folder.findOne({
            _id: folderId,
            organization: OrgId,
            ...statusFilter
        }).select('name parentFolder').lean();

        if (!parentFolder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found or doesn't belong to this organization"
            });
        }

        console.log(`Fetching contents for folder: ${folderId}`);

        // Get subfolders and documents in parallel
        const [subfolders, documents] = await Promise.all([
            // Get subfolders with their child counts
            Folder.aggregate([
                { 
                    $match: { 
                        parentFolder: new mongoose.Types.ObjectId(folderId),
                        organization: new mongoose.Types.ObjectId(OrgId),
                        ...statusFilter
                    } 
                },
                {
                    $lookup: {
                        from: 'folders',
                        let: { folderId: '$_id' },
                        pipeline: [
                            { 
                                $match: { 
                                    $expr: { $eq: ['$parentFolder', '$$folderId'] },
                                    ...statusFilter
                                } 
                            },
                            { $count: 'count' }
                        ],
                        as: 'subfolderCount'
                    }
                },
                {
                    $lookup: {
                        from: 'documents',
                        let: { folderId: '$_id' },
                        pipeline: [
                            { 
                                $match: { 
                                    $expr: { $eq: ['$folder', '$$folderId'] },
                                    ...statusFilter
                                } 
                            },
                            { $count: 'count' }
                        ],
                        as: 'documentCount'
                    }
                },
                {
                    $addFields: {
                        type: 'folder',
                        hasSubfolders: { $gt: [{ $arrayElemAt: ['$subfolderCount.count', 0] }, 0] },
                        hasDocuments: { $gt: [{ $arrayElemAt: ['$documentCount.count', 0] }, 0] },
                        totalSubfolders: { $ifNull: [{ $arrayElemAt: ['$subfolderCount.count', 0] }, 0] },
                        totalDocuments: { $ifNull: [{ $arrayElemAt: ['$documentCount.count', 0] }, 0] }
                    }
                },
                {
                    $project: {
                        subfolderId: '$_id',
                        name: 1,
                        type: 1,
                        createdBy: 1,
                        status: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        hasSubfolders: 1,
                        hasDocuments: 1,
                        totalSubfolders: 1,
                        totalDocuments: 1,
                        _id: 0
                    }
                },
                { $sort: { name: 1 } }
            ]),

            // Get documents in this folder
            Document.find({
                folder: folderId,
                organization: OrgId,
                ...statusFilter
            })
            .select('name type fileUrl uploadedBy metadata status createdAt updatedAt')
            .sort({ name: 1 })
            .lean()
        ]);

        // Add type field and rename _id to fileId for documents
        const documentsWithType = documents.map(doc => ({
            fileId: doc._id,
            name: doc.name,
            type: 'document',
            fileType: doc.type,
            fileUrl: doc.fileUrl,
            uploadedBy: doc.uploadedBy,
            metadata: doc.metadata,
            status: doc.status,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        }));

        // Combine and sort by type (folders first, then documents)
        const contents = [
            ...subfolders,
            ...documentsWithType
        ];

        return res.status(200).json({
            success: true,
            message: "Folder contents retrieved successfully",
            data: {
                organizationId: OrgId,
                currentFolder: {
                    folderId: parentFolder._id,
                    name: parentFolder.name,
                    parentFolder: parentFolder.parentFolder
                },
                contents: contents,
                stats: {
                    totalSubfolders: subfolders.length,
                    totalDocuments: documents.length,
                    totalItems: contents.length
                },
                isRoot: !parentFolder.parentFolder
            }
        });

    } catch (error) {
        console.error('Error in getFolderContents:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error occurred while fetching folder contents"
        });
    }
};

exports.getRootFolders = async (req, res) => {
    try {
        const { OrgId } = req.params;
        const { includeArchived = false } = req.query;

        // Input validation
        if (!OrgId || !mongoose.Types.ObjectId.isValid(OrgId)) {
            return res.status(400).json({
                success: false,
                message: "Valid Organization ID is required"
            });
        }

        const statusFilter = includeArchived === 'true' 
            ? { status: { $in: ['active', 'archived'] } }
            : { status: 'active' };

        console.log(`Fetching root folders for organization: ${OrgId}`);

        // Get root folders (parentFolder: null) with child counts
        const rootFolders = await Folder.aggregate([
            { 
                $match: { 
                    organization: new mongoose.Types.ObjectId(OrgId),
                    parentFolder: null,
                    ...statusFilter
                } 
            },
            {
                $lookup: {
                    from: 'folders',
                    let: { folderId: '$_id' },
                    pipeline: [
                        { 
                            $match: { 
                                $expr: { $eq: ['$parentFolder', '$$folderId'] },
                                ...statusFilter
                            } 
                        },
                        { $count: 'count' }
                    ],
                    as: 'subfolderCount'
                }
            },
            {
                $lookup: {
                    from: 'documents',
                    let: { folderId: '$_id' },
                    pipeline: [
                        { 
                            $match: { 
                                $expr: { $eq: ['$folder', '$$folderId'] },
                                ...statusFilter
                            } 
                        },
                        { $count: 'count' }
                    ],
                    as: 'documentCount'
                }
            },
            {
                $addFields: {
                    hasSubfolders: { $gt: [{ $arrayElemAt: ['$subfolderCount.count', 0] }, 0] },
                    hasDocuments: { $gt: [{ $arrayElemAt: ['$documentCount.count', 0] }, 0] },
                    totalSubfolders: { $ifNull: [{ $arrayElemAt: ['$subfolderCount.count', 0] }, 0] },
                    totalDocuments: { $ifNull: [{ $arrayElemAt: ['$documentCount.count', 0] }, 0] }
                }
            },
            {
                $project: {
                    name: 1,
                    createdBy: 1,
                    status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    hasSubfolders: 1,
                    hasDocuments: 1,
                    totalSubfolders: 1,
                    totalDocuments: 1
                    // Removed the exclusion fields - they won't be included anyway
                }
            },
            { $sort: { name: 1 } }
        ]);

        return res.status(200).json({
            success: true,
            message: "Root folders retrieved successfully",
            data: {
                organizationId: OrgId,
                folders: rootFolders,
                totalRootFolders: rootFolders.length,
                isRoot: true
            }
        });

    } catch (error) {
        console.error('Error in getRootFolders:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error occurred while fetching root folders"
        });
    }
};