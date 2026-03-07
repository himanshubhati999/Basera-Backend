const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const ensureUploadsDir = async () => {
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
};

// Generate unique filename
const generateFilename = (originalName) => {
  const ext = path.extname(originalName);
  const randomString = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${randomString}${ext}`;
};

// Upload single image to local storage
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    await ensureUploadsDir();

    // Generate unique filename
    const filename = generateFilename(req.file.originalname);
    const filepath = path.join(uploadsDir, filename);

    // Process and save image with sharp (resize and optimize)
    await sharp(req.file.buffer)
      .resize(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    // Generate URL path
    const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
    const imageUrl = `${baseUrl}/uploads/${filename}`;

    res.status(200).json({
      message: 'Image uploaded successfully',
      url: imageUrl,
      filename: filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      message: 'Server error during image upload',
      error: error.message 
    });
  }
};

// Upload multiple images to local storage
exports.uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files provided' });
    }

    await ensureUploadsDir();

    const uploadPromises = req.files.map(async (file) => {
      const filename = generateFilename(file.originalname);
      const filepath = path.join(uploadsDir, filename);

      // Process and save image with sharp
      await sharp(file.buffer)
        .resize(1920, 1080, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toFile(filepath);

      const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
      const imageUrl = `${baseUrl}/uploads/${filename}`;

      return {
        url: imageUrl,
        filename: filename
      };
    });

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      message: 'Images uploaded successfully',
      images: results
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ 
      message: 'Server error during image upload',
      error: error.message 
    });
  }
};

// Delete image from local storage
exports.deleteImage = async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ message: 'No filename provided' });
    }

    const filepath = path.join(uploadsDir, filename);

    // Check if file exists
    try {
      await fs.access(filepath);
      await fs.unlink(filepath);
      res.status(200).json({ message: 'Image deleted successfully' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: 'Image file not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      message: 'Server error during image deletion',
      error: error.message 
    });
  }
};

// Helper function to delete multiple images (used internally)
exports.deleteMultipleImages = async (imageUrls) => {
  if (!imageUrls || imageUrls.length === 0) return;

  const deletePromises = imageUrls.map(async (url) => {
    try {
      // Extract filename from URL
      const filename = path.basename(url);
      const filepath = path.join(uploadsDir, filename);
      
      await fs.access(filepath);
      await fs.unlink(filepath);
      console.log(`Deleted image: ${filename}`);
    } catch (error) {
      console.error(`Failed to delete image ${url}:`, error.message);
    }
  });

  await Promise.allSettled(deletePromises);
};
