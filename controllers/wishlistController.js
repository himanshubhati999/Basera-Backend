const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('wishlist');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: user.wishlist || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Add property to wishlist
// @route   POST /api/wishlist/:propertyId
// @access  Private
exports.addToWishlist = async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    
    console.log('Add to wishlist - Received propertyId:', propertyId);
    console.log('PropertyId type:', typeof propertyId);
    console.log('PropertyId length:', propertyId.length);
    
    // Validate if it's a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      console.log('Invalid ObjectId format');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid property ID format' 
      });
    }
    
    // Additional check for proper ObjectId length (24 characters)
    if (propertyId.length !== 24) {
      console.log('Invalid ObjectId length');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid property ID length' 
      });
    }
    
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('Current wishlist:', user.wishlist);

    // Check if property already in wishlist (convert to string for comparison)
    const propertyExists = user.wishlist.some(id => id.toString() === propertyId);
    
    if (propertyExists) {
      console.log('Property already in wishlist');
      return res.status(400).json({
        success: false,
        message: 'Property already in wishlist'
      });
    }

    // Add to wishlist as ObjectId
    user.wishlist.push(new mongoose.Types.ObjectId(propertyId));
    await user.save();

    console.log('Updated wishlist:', user.wishlist);

    res.status(200).json({
      success: true,
      message: 'Property added to wishlist',
      data: user.wishlist
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Remove property from wishlist
// @route   DELETE /api/wishlist/:propertyId
// @access  Private
exports.removeFromWishlist = async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    
    // Validate if it's a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid property ID' 
      });
    }
    
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Remove from wishlist (convert to string for comparison)
    user.wishlist = user.wishlist.filter(id => id.toString() !== propertyId);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Property removed from wishlist',
      data: user.wishlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Toggle property in wishlist
// @route   PUT /api/wishlist/:propertyId
// @access  Private
exports.toggleWishlist = async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    
    console.log('Toggle wishlist - Received propertyId:', propertyId);
    console.log('PropertyId type:', typeof propertyId);
    
    // Validate if it's a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      console.log('Invalid ObjectId format');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid property ID format' 
      });
    }
    
    // Additional check for proper ObjectId length (24 characters)
    if (propertyId.length !== 24) {
      console.log('Invalid ObjectId length');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid property ID length' 
      });
    }
    
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('Current wishlist:', user.wishlist);

    let message;
    // Check if property already in wishlist (convert to string for comparison)
    const propertyExists = user.wishlist.some(id => id.toString() === propertyId);
    
    if (propertyExists) {
      // Remove from wishlist
      user.wishlist = user.wishlist.filter(id => id.toString() !== propertyId);
      message = 'Property removed from wishlist';
      console.log('Removing from wishlist');
    } else {
      // Add to wishlist as ObjectId
      user.wishlist.push(new mongoose.Types.ObjectId(propertyId));
      message = 'Property added to wishlist';
      console.log('Adding to wishlist');
    }

    await user.save();

    console.log('Updated wishlist:', user.wishlist);

    res.status(200).json({
      success: true,
      message,
      data: user.wishlist
    });
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
