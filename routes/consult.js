const express = require('express');
const router = express.Router();
const {
  getAllConsults,
  getConsultById,
  createConsult,
  updateConsultStatus,
  updateConsult,
  deleteConsult,
  getConsultStats
} = require('../controllers/consultController');
const { protect } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Public route - create consult from contact form
router.post('/', createConsult);

// Protected admin routes
router.get('/', protect, adminAuth, getAllConsults);
router.get('/stats', protect, adminAuth, getConsultStats);
router.get('/:id', protect, adminAuth, getConsultById);
router.put('/:id', protect, adminAuth, updateConsult);
router.put('/:id/status', protect, adminAuth, updateConsultStatus);
router.delete('/:id', protect, adminAuth, deleteConsult);

module.exports = router;
