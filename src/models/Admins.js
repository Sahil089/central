const mongoose = require('mongoose');
const { hashPassword, comparePassword } = require('../utils/hashPassword');

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Admin name is required'], trim: true },
    email: { type: String, required: [true, 'Admin email is required'], unique: true, lowercase: true },
    password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: { type: String, enum: ['ORG_ADMIN'], default: 'ORG_ADMIN' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

// Pre-save hook for hashing password
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await hashPassword(this.password);
  next();
});

// Method for comparing passwords
adminSchema.methods.comparePassword = async function (enteredPassword) {
  return await comparePassword(enteredPassword, this.password);
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
