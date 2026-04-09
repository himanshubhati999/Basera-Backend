const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');

const uploadsDir = path.join(__dirname, '../uploads');

const stripImageExtension = (value = '') =>
  value.replace(/\.(jpg|jpeg|png|webp|gif|avif|bmp|tiff)$/i, '');

const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

const getCloudinaryFolder = () => {
  const folder = (process.env.CLOUDINARY_FOLDER || 'basera').trim();
  return folder.replace(/^\/+|\/+$/g, '');
};

const optimizeImageToBuffer = async (buffer) => {
  return sharp(buffer)
    .resize(1920, 1080, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 85 })
    .toBuffer();
};

const generatePublicId = () => {
  const randomString = crypto.randomBytes(16).toString('hex');
  return `${Date.now()}-${randomString}`;
};

const uploadBufferToCloudinary = async (buffer) => {
  const folder = getCloudinaryFolder();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder,
        public_id: generatePublicId(),
        format: 'jpg',
        overwrite: false
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

const extractCloudinaryPublicIdFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('res.cloudinary.com')) {
      return null;
    }

    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const uploadIndex = pathSegments.indexOf('upload');

    if (uploadIndex === -1 || uploadIndex >= pathSegments.length - 1) {
      return null;
    }

    let publicIdSegments = pathSegments.slice(uploadIndex + 1);
    const versionIndex = publicIdSegments.findIndex((segment) => /^v\d+$/.test(segment));

    if (versionIndex !== -1) {
      publicIdSegments = publicIdSegments.slice(versionIndex + 1);
    }

    if (publicIdSegments.length === 0) {
      return null;
    }

    const lastIndex = publicIdSegments.length - 1;
    publicIdSegments[lastIndex] = stripImageExtension(publicIdSegments[lastIndex]);

    return publicIdSegments.join('/');
  } catch {
    return null;
  }
};

const resolveCloudinaryPublicId = (value, allowSimplePublicId = false) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return extractCloudinaryPublicIdFromUrl(trimmed);
  }

  if (trimmed.includes('/')) {
    return stripImageExtension(trimmed.replace(/^\/+|\/+$/g, ''));
  }

  if (allowSimplePublicId) {
    return stripImageExtension(trimmed);
  }

  return null;
};

const extractLegacyFilename = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.pathname.includes('/uploads/')) {
        return null;
      }
      return path.basename(parsed.pathname);
    } catch {
      return null;
    }
  }

  if (trimmed.includes('/')) {
    if (!trimmed.includes('/uploads/')) {
      return null;
    }
    return path.basename(trimmed);
  }

  return trimmed;
};

const deleteLegacyLocalImageByFilename = async (filename) => {
  const filepath = path.join(uploadsDir, filename);
  try {
    await fs.access(filepath);
    await fs.unlink(filepath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
};

const deleteCloudinaryImageByPublicId = async (publicId) => {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true
  });
  return result?.result;
};

const toImageResponse = (uploadResult) => ({
  url: uploadResult.secure_url,
  filename: uploadResult.public_id,
  publicId: uploadResult.public_id
});

// Upload single image to Cloudinary
exports.uploadImage = async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(500).json({ message: 'Cloudinary is not configured on server' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const optimizedBuffer = await optimizeImageToBuffer(req.file.buffer);
    const uploadResult = await uploadBufferToCloudinary(optimizedBuffer);

    return res.status(200).json({
      message: 'Image uploaded successfully',
      ...toImageResponse(uploadResult)
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      message: 'Server error during image upload',
      error: error.message
    });
  }
};

// Upload multiple images to Cloudinary
exports.uploadMultipleImages = async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(500).json({ message: 'Cloudinary is not configured on server' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files provided' });
    }

    const uploadPromises = req.files.map(async (file) => {
      const optimizedBuffer = await optimizeImageToBuffer(file.buffer);
      const uploadResult = await uploadBufferToCloudinary(optimizedBuffer);
      return toImageResponse(uploadResult);
    });

    const images = await Promise.all(uploadPromises);

    return res.status(200).json({
      message: 'Images uploaded successfully',
      images
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    return res.status(500).json({
      message: 'Server error during image upload',
      error: error.message
    });
  }
};

// Delete image from Cloudinary, with legacy local cleanup fallback
exports.deleteImage = async (req, res) => {
  try {
    const { filename, publicId, url } = req.body;
    const imageRef = publicId || filename || url;

    if (!imageRef) {
      return res.status(400).json({ message: 'No image identifier provided' });
    }

    const cloudinaryPublicId =
      resolveCloudinaryPublicId(publicId, true) ||
      resolveCloudinaryPublicId(filename) ||
      resolveCloudinaryPublicId(url);

    if (cloudinaryPublicId) {
      if (!isCloudinaryConfigured()) {
        return res.status(500).json({ message: 'Cloudinary is not configured on server' });
      }

      const destroyResult = await deleteCloudinaryImageByPublicId(cloudinaryPublicId);

      if (destroyResult === 'ok') {
        return res.status(200).json({ message: 'Image deleted successfully' });
      }

      if (destroyResult === 'not found') {
        return res.status(404).json({ message: 'Image file not found' });
      }

      return res.status(500).json({
        message: 'Failed to delete image from Cloudinary',
        result: destroyResult
      });
    }

    const legacyFilename = extractLegacyFilename(imageRef);
    if (!legacyFilename) {
      return res.status(400).json({ message: 'Invalid image identifier' });
    }

    const deleted = await deleteLegacyLocalImageByFilename(legacyFilename);
    if (!deleted) {
      return res.status(404).json({ message: 'Image file not found' });
    }

    return res.status(200).json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({
      message: 'Server error during image deletion',
      error: error.message
    });
  }
};

// Helper function to delete multiple images (used internally)
exports.deleteMultipleImages = async (imageRefs) => {
  if (!Array.isArray(imageRefs) || imageRefs.length === 0) {
    return;
  }

  const deletePromises = imageRefs.map(async (imageRef) => {
    try {
      const cloudinaryPublicId = resolveCloudinaryPublicId(imageRef);

      if (cloudinaryPublicId && isCloudinaryConfigured()) {
        await deleteCloudinaryImageByPublicId(cloudinaryPublicId);
        return;
      }

      const legacyFilename = extractLegacyFilename(imageRef);
      if (legacyFilename) {
        await deleteLegacyLocalImageByFilename(legacyFilename);
      }
    } catch (error) {
      console.error(`Failed to delete image ${imageRef}:`, error.message);
    }
  });

  await Promise.allSettled(deletePromises);
};
