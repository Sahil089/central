const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Super Admin
      required: true,
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin', // Separate Admin collection
      },
    ],
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Separate User collection
      },
    ],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Index for fast searching
organizationSchema.index({ name: 1 });

const Organization = mongoose.model('Organization', organizationSchema);
module.exports = Organization;
