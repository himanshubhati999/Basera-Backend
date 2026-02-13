const mongoose = require('mongoose');

const consultSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  property: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'contacted', 'closed'],
    default: 'unread'
  }
}, {
  timestamps: true
});

// Index for faster queries
consultSchema.index({ createdAt: -1 });
consultSchema.index({ status: 1 });

const Consult = mongoose.model('Consult', consultSchema);

module.exports = Consult;
