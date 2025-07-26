const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema(
  {
    userType: {
      type: String,
      enum: ['ADMIN', 'USER'],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userTypeRef', // Dynamic reference based on userType
    },
    userTypeRef: {
      type: String,
      enum: ['Admin', 'User'],
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
    },
    referencedDocs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document', // Which documents were used in the answer
      },
    ],
    sessionId: {
      type: String, // Unique chat session ID
      required: true,
    },
  },
  { timestamps: true }
);

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);
module.exports = ChatHistory;
