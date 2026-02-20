const express = require('express');
const router = express.Router();
const {
  getApprovedTestimonials,
  getAllTestimonials,
  createTestimonial,
  updateTestimonialStatus,
  deleteTestimonial,
  getTestimonialStats
} = require('../controllers/testimonialController');
const { protect, optionalAuth } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Public routes
router.get('/approved', getApprovedTestimonials);

// Protected routes (optional auth - works for both logged in and guest users)
router.post('/', optionalAuth, createTestimonial);

// Admin routes
router.get('/', protect, adminAuth, getAllTestimonials);
router.get('/stats', protect, adminAuth, getTestimonialStats);
router.put('/:id/status', protect, adminAuth, updateTestimonialStatus);
router.delete('/:id', protect, adminAuth, deleteTestimonial);

module.exports = router;
