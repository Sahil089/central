const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
    },
    fileUrl: {
      type: String,
      required: [true, 'Document file URL is required'],
    },
    type: {
      type: String,
      enum: ['pdf', 'docx', 'txt', 'other'],
      default: 'other',
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    metadata: {
      size: Number,
      pages: Number,
      tags: [String],
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// **This ensures document names are unique inside the same folder**
documentSchema.index(
  { name: 1, folder: 1, organization: 1 },
  { unique: true }
);


const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
