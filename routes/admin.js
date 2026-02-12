const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

// All routes require authentication and admin privileges
// Apply auth middleware first, then adminAuth

// Dashboard statistics
router.get('/stats', protect, adminAuth, adminController.getDashboardStats);

// Properties management
router.get('/properties', protect, adminAuth, adminController.getAllPropertiesWithContact);
router.delete('/properties/:id', protect, adminAuth, adminController.deleteProperty);
router.put('/properties/:id/status', protect, adminAuth, adminController.updatePropertyStatus);
router.put('/properties/:id/featured', protect, adminAuth, adminController.toggleFeaturedStatus);
router.put('/properties/:id/published', protect, adminAuth, adminController.togglePublishedStatus);

// Users management
router.get('/users', protect, adminAuth, adminController.getAllUsers);
router.delete('/users/:id', protect, adminAuth, adminController.deleteUser);
router.put('/users/:id/role', protect, adminAuth, adminController.updateUserRole);

module.exports = router;
