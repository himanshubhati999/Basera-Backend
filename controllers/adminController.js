const Property = require('../models/Property');
const User = require('../models/User');
const { deleteMultipleImages } = require('./uploadController');

// Get all properties with owner contact information
exports.getAllPropertiesWithContact = async (req, res) => {
  try {
    const properties = await Property.find()
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: properties.length,
      properties
    });
  } catch (error) {
    console.error('Get all properties error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalProperties = await Property.countDocuments();
    const totalUsers = await User.countDocuments();
    const availableProperties = await Property.countDocuments({ status: 'available' });
    const soldProperties = await Property.countDocuments({ status: 'sold' });
    
    // Properties by type
    const propertiesByType = await Property.aggregate([
      {
        $group: {
          _id: '$propertyType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent properties
    const recentProperties = await Property.find()
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Recent users
    const recentUsers = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        totalProperties,
        totalUsers,
        availableProperties,
        soldProperties,
        propertiesByType,
        recentProperties,
        recentUsers
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete property by admin
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Delete associated images before deleting property
    const imagesToDelete = [...(property.images || [])];
    if (property.seo?.image) {
      imagesToDelete.push(property.seo.image);
    }
    if (imagesToDelete.length > 0) {
      await deleteMultipleImages(imagesToDelete);
    }

    await Property.findByIdAndDelete(req.params.id);

    res.json({ 
      success: true,
      message: 'Property deleted successfully' 
    });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update property status
exports.updatePropertyStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('postedBy', 'name email');

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({
      success: true,
      message: 'Property status updated successfully',
      property
    });
  } catch (error) {
    console.error('Update property status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Toggle property featured status
exports.toggleFeaturedStatus = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    property.isFeatured = !property.isFeatured;
    property.updatedAt = Date.now();
    await property.save();

    const updatedProperty = await Property.findById(req.params.id)
      .populate('postedBy', 'name email');

    res.json({
      success: true,
      message: `Property ${property.isFeatured ? 'featured' : 'unfeatured'} successfully`,
      property: updatedProperty
    });
  } catch (error) {
    console.error('Toggle featured status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Toggle project published status
exports.togglePublishedStatus = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    
    if (!property) {
      return res.status(404).json({ message: 'Property/Project not found' });
    }

    property.isPublished = !property.isPublished;
    property.updatedAt = Date.now();
    await property.save();

    const updatedProperty = await Property.findById(req.params.id)
      .populate('postedBy', 'name email');

    res.json({
      success: true,
      message: `Project ${property.isPublished ? 'published' : 'saved as draft'} successfully`,
      property: updatedProperty
    });
  } catch (error) {
    console.error('Toggle published status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete user by admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow admin to delete themselves
    if (user._id.toString() === req.userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ 
      success: true,
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
