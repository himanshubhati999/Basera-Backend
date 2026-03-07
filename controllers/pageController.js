const Page = require('../models/Page');
const { deleteMultipleImages } = require('./uploadController');

// Get all pages
exports.getAllPages = async (req, res) => {
  try {
    const pages = await Page.find()
      .populate('author', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      pages,
      count: pages.length
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pages',
      error: error.message
    });
  }
};

// Get published pages only (for public frontend)
exports.getPublishedPages = async (req, res) => {
  try {
    const pages = await Page.find({ status: 'Published' })
      .populate('author', 'name email')
      .sort({ order: 1, createdAt: -1 });
    
    res.json({
      success: true,
      pages,
      count: pages.length
    });
  } catch (error) {
    console.error('Error fetching published pages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching published pages',
      error: error.message
    });
  }
};

// Get single page by ID
exports.getPageById = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id)
      .populate('author', 'name email');
    
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }
    
    res.json({
      success: true,
      page
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching page',
      error: error.message
    });
  }
};

// Get single page by slug
exports.getPageBySlug = async (req, res) => {
  try {
    const page = await Page.findOne({ 
      slug: req.params.slug,
      status: 'Published' // Only return published pages for public access
    }).populate('author', 'name email');
    
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }
    
    res.json({
      success: true,
      page
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching page',
      error: error.message
    });
  }
};

// Create new page
exports.createPage = async (req, res) => {
  try {
    const pageData = {
      ...req.body,
      author: req.user.id
    };

    // If setting as homepage, unset any existing homepage
    if (pageData.isHomePage) {
      await Page.updateMany(
        { isHomePage: true },
        { isHomePage: false }
      );
    }
    
    const page = new Page(pageData);
    await page.save();
    
    await page.populate('author', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Page created successfully',
      page
    });
  } catch (error) {
    console.error('Error creating page:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A page with this slug already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating page',
      error: error.message
    });
  }
};

// Update page
exports.updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    
    // If setting as homepage, unset any existing homepage
    if (req.body.isHomePage) {
      await Page.updateMany(
        { isHomePage: true, _id: { $ne: id } },
        { isHomePage: false }
      );
    }
    
    const page = await Page.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('author', 'name email');
    
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Page updated successfully',
      page
    });
  } catch (error) {
    console.error('Error updating page:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A page with this slug already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating page',
      error: error.message
    });
  }
};

// Update page status
exports.updatePageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['Published', 'Draft', 'Pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    
    const page = await Page.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('author', 'name email');
    
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }
    
    res.json({
      success: true,
      message: `Page ${status.toLowerCase()} successfully`,
      page
    });
  } catch (error) {
    console.error('Error updating page status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating page status',
      error: error.message
    });
  }
};

// Delete page
exports.deletePage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }
    
    // Delete associated featured image if exists
    if (page.featuredImage) {
      await deleteMultipleImages([page.featuredImage]);
    }
    
    await Page.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Page deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting page',
      error: error.message
    });
  }
};

// Bulk delete pages
exports.bulkDeletePages = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of page IDs'
      });
    }
    
    // Get all pages to delete their images
    const pages = await Page.find({ _id: { $in: ids } });
    const imagesToDelete = pages
      .filter(page => page.featuredImage)
      .map(page => page.featuredImage);
    
    if (imagesToDelete.length > 0) {
      await deleteMultipleImages(imagesToDelete);
    }
    
    const result = await Page.deleteMany({ _id: { $in: ids } });
    
    res.json({
      success: true,
      message: `${result.deletedCount} page(s) deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting pages:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting pages',
      error: error.message
    });
  }
};
