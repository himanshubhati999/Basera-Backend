const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true
  },
  template: {
    type: String,
    enum: ['Default', 'Homepage', 'Blog Page', 'Properties List', 'Projects List', 'Contact Page', 'About Page'],
    default: 'Default'
  },
  status: {
    type: String,
    enum: ['Published', 'Draft', 'Pending'],
    default: 'Draft'
  },
  content: {
    type: String,
    default: ''
  },
  metaTitle: {
    type: String,
    trim: true
  },
  metaDescription: {
    type: String,
    trim: true
  },
  metaKeywords: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  featuredImage: {
    type: String,
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  isHomePage: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
pageSchema.index({ slug: 1 });
pageSchema.index({ status: 1 });
pageSchema.index({ createdAt: -1 });

// Pre-save middleware to generate slug from name if not provided
pageSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model('Page', pageSchema);
