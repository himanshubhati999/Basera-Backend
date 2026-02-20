const Testimonial = require('../models/Testimonial');

// Get all approved testimonials (public)
exports.getApprovedTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isApproved: true })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      testimonials
    });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch testimonials',
      error: error.message
    });
  }
};

// Get all testimonials (admin only)
exports.getAllTestimonials = async (req, res) => {
  try {
    const { approved } = req.query;
    
    let query = {};
    if (approved === 'true') {
      query.isApproved = true;
    } else if (approved === 'false') {
      query.isApproved = false;
    }

    const testimonials = await Testimonial.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      testimonials,
      count: testimonials.length
    });
  } catch (error) {
    console.error('Error fetching all testimonials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch testimonials',
      error: error.message
    });
  }
};

// Create a new testimonial
exports.createTestimonial = async (req, res) => {
  try {
    const { name, email, rating, comment, location, propertyType } = req.body;
    const userId = req.user ? req.user._id : null;

    // Validate input
    if (!name || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Name, rating, and comment are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Create testimonial
    const testimonial = await Testimonial.create({
      user: userId,
      name,
      email,
      rating,
      comment,
      location,
      propertyType,
      isApproved: true // Auto-approved
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your testimonial has been posted successfully.',
      testimonial
    });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit testimonial',
      error: error.message
    });
  }
};

// Approve/reject testimonial (admin only)
exports.updateTestimonialStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const testimonial = await Testimonial.findByIdAndUpdate(
      id,
      { isApproved },
      { new: true }
    ).populate('user', 'name email');

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    res.json({
      success: true,
      message: `Testimonial ${isApproved ? 'approved' : 'rejected'} successfully`,
      testimonial
    });
  } catch (error) {
    console.error('Error updating testimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update testimonial',
      error: error.message
    });
  }
};

// Delete testimonial (admin only)
exports.deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;

    const testimonial = await Testimonial.findByIdAndDelete(id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    res.json({
      success: true,
      message: 'Testimonial deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete testimonial',
      error: error.message
    });
  }
};

// Get testimonial statistics (admin only)
exports.getTestimonialStats = async (req, res) => {
  try {
    const total = await Testimonial.countDocuments();
    const approved = await Testimonial.countDocuments({ isApproved: true });
    const pending = await Testimonial.countDocuments({ isApproved: false });

    const testimonials = await Testimonial.find({ isApproved: true });
    const averageRating = testimonials.length > 0
      ? testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length
      : 0;

    res.json({
      success: true,
      stats: {
        total,
        approved,
        pending,
        averageRating: averageRating.toFixed(1)
      }
    });
  } catch (error) {
    console.error('Error fetching testimonial stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};
