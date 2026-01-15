const Property = require('../models/Property');

// Create a new property
exports.createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      propertyType,
      price,
      location,
      area,
      bedrooms,
      bathrooms,
      images,
      amenities,
      ownerPhone,
      ownerEmail
    } = req.body;

    // Validate required fields
    if (!title || !description || !propertyType || !price || !ownerPhone || !ownerEmail) {
      return res.status(400).json({ 
        message: 'Please provide all required fields' 
      });
    }

    const property = new Property({
      title,
      description,
      propertyType,
      price,
      location,
      area,
      bedrooms,
      bathrooms,
      images,
      amenities,
      ownerPhone,
      ownerEmail,
      postedBy: req.userId // From auth middleware
    });

    await property.save();

    res.status(201).json({
      message: 'Property posted successfully',
      property
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all properties (without private contact info)
exports.getAllProperties = async (req, res) => {
  try {
    const { propertyType, minPrice, maxPrice, city, status } = req.query;
    
    let query = {};
    
    if (propertyType) query.propertyType = propertyType;
    if (status) query.status = status;
    if (city) query['location.city'] = new RegExp(city, 'i');
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const properties = await Property.find(query)
      .select('-ownerPhone -ownerEmail') // Exclude private contact info
      .populate('postedBy', 'username email')
      .sort({ createdAt: -1 });

    res.json({ properties });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
};

// Get single property by ID (without private contact info for non-owners)
exports.getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('postedBy', 'username email');

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // If the requester is the owner, include contact info
    const propertyObj = property.toObject();
    if (!req.userId || property.postedBy._id.toString() !== req.userId) {
      delete propertyObj.ownerPhone;
      delete propertyObj.ownerEmail;
    }

    res.json({ property: propertyObj });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get properties posted by logged-in user
exports.getMyProperties = async (req, res) => {
  try {
    const properties = await Property.find({ postedBy: req.userId })
      .sort({ createdAt: -1 });

    res.json({ properties });
  } catch (error) {
    console.error('Get my properties error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update property (only by owner)
exports.updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check if the user is the owner
    if (property.postedBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to update this property' });
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Property updated successfully',
      property: updatedProperty
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete property (only by owner)
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check if the user is the owner
    if (property.postedBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this property' });
    }

    await Property.findByIdAndDelete(req.params.id);

    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get owner contact info (for enquiries - only for authenticated users)
exports.getOwnerContact = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Please login to view contact information' });
    }

    const property = await Property.findById(req.params.id)
      .select('ownerPhone ownerEmail title')
      .populate('postedBy', 'username');

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({
      propertyTitle: property.title,
      ownerName: property.postedBy.username,
      ownerPhone: property.ownerPhone,
      ownerEmail: property.ownerEmail
    });
  } catch (error) {
    console.error('Get owner contact error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
