const Consult = require('../models/Consult');

// Get all consults (Admin only)
exports.getAllConsults = async (req, res) => {
  try {
    const consults = await Consult.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      consults
    });
  } catch (error) {
    console.error('Error fetching consults:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching consults',
      error: error.message
    });
  }
};

// Get single consult by ID (Admin only)
exports.getConsultById = async (req, res) => {
  try {
    const consult = await Consult.findById(req.params.id);

    if (!consult) {
      return res.status(404).json({
        success: false,
        message: 'Consult not found'
      });
    }

    res.json({
      success: true,
      consult
    });
  } catch (error) {
    console.error('Error fetching consult:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching consult',
      error: error.message
    });
  }
};

// Create new consult (Public endpoint - from contact form)
exports.createConsult = async (req, res) => {
  try {
    const { name, email, phone, property, message } = req.body;

    // Get IP address from request
    const ipAddress = req.headers['x-forwarded-for'] || 
                      req.headers['x-real-ip'] || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress ||
                      '';

    const consult = new Consult({
      name,
      email,
      phone,
      property,
      message,
      ipAddress: ipAddress.split(',')[0].trim() // Get first IP if multiple
    });

    await consult.save();

    res.status(201).json({
      success: true,
      message: 'Consultation request submitted successfully',
      consult
    });
  } catch (error) {
    console.error('Error creating consult:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting consultation request',
      error: error.message
    });
  }
};

// Update consult status (Admin only)
exports.updateConsultStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const consultId = req.params.id;

    const consult = await Consult.findByIdAndUpdate(
      consultId,
      { status },
      { new: true, runValidators: true }
    );

    if (!consult) {
      return res.status(404).json({
        success: false,
        message: 'Consult not found'
      });
    }

    res.json({
      success: true,
      message: 'Consult status updated successfully',
      consult
    });
  } catch (error) {
    console.error('Error updating consult status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating consult status',
      error: error.message
    });
  }
};

// Update consult details (Admin only)
exports.updateConsult = async (req, res) => {
  try {
    const consultId = req.params.id;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.ipAddress;
    delete updates.createdAt;

    const consult = await Consult.findByIdAndUpdate(
      consultId,
      updates,
      { new: true, runValidators: true }
    );

    if (!consult) {
      return res.status(404).json({
        success: false,
        message: 'Consult not found'
      });
    }

    res.json({
      success: true,
      message: 'Consult updated successfully',
      consult
    });
  } catch (error) {
    console.error('Error updating consult:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating consult',
      error: error.message
    });
  }
};

// Delete consult (Admin only)
exports.deleteConsult = async (req, res) => {
  try {
    const consultId = req.params.id;

    const consult = await Consult.findByIdAndDelete(consultId);

    if (!consult) {
      return res.status(404).json({
        success: false,
        message: 'Consult not found'
      });
    }

    res.json({
      success: true,
      message: 'Consult deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting consult:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting consult',
      error: error.message
    });
  }
};

// Get consult stats (Admin only)
exports.getConsultStats = async (req, res) => {
  try {
    const totalConsults = await Consult.countDocuments();
    const unreadConsults = await Consult.countDocuments({ status: 'unread' });
    const readConsults = await Consult.countDocuments({ status: 'read' });
    const contactedConsults = await Consult.countDocuments({ status: 'contacted' });
    const closedConsults = await Consult.countDocuments({ status: 'closed' });

    res.json({
      success: true,
      stats: {
        total: totalConsults,
        unread: unreadConsults,
        read: readConsults,
        contacted: contactedConsults,
        closed: closedConsults
      }
    });
  } catch (error) {
    console.error('Error fetching consult stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching consult stats',
      error: error.message
    });
  }
};
