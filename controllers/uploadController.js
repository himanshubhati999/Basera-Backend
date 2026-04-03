const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');
const ftp = require('basic-ftp');
const { Readable } = require('stream');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const ensureUploadsDir = async () => {
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
};

const isFtpConfigured = () => {
  return Boolean(
    process.env.HOSTINGER_FTP_HOST &&
    process.env.HOSTINGER_FTP_USERNAME &&
    process.env.HOSTINGER_FTP_PASSWORD
  );
};

const getFtpRemotePath = () => {
  const remotePath = process.env.HOSTINGER_FTP_REMOTE_PATH || '/nodejs/uploads';
  return remotePath.replace(/\\/g, '/').replace(/\/$/, '');
};

const getFtpMirrorPath = () => {
  const mirrorPath = (process.env.HOSTINGER_FTP_MIRROR_PATH || '').trim();
  if (!mirrorPath) return null;
  return mirrorPath.replace(/\\/g, '/').replace(/\/$/, '');
};

const getPublicUploadBaseUrl = (req) => {
  const ftpPublicUrl = (process.env.HOSTINGER_PUBLIC_URL || '').replace(/\/$/, '');
  if (isFtpConfigured() && ftpPublicUrl) {
    return ftpPublicUrl;
  }

  return `${getPublicBaseUrl(req)}/uploads`;
};

const withFtpClient = async (callback) => {
  const client = new ftp.Client(15000);
  client.ftp.verbose = false;

  try {
    await client.access({
      host: process.env.HOSTINGER_FTP_HOST,
      port: Number(process.env.HOSTINGER_FTP_PORT || 21),
      user: process.env.HOSTINGER_FTP_USERNAME,
      password: process.env.HOSTINGER_FTP_PASSWORD,
      secure: process.env.HOSTINGER_FTP_SECURE === 'true'
    });

    return await callback(client);
  } finally {
    client.close();
  }
};

const uploadBufferToFtp = async (buffer, filename) => {
  const remoteDirectory = getFtpRemotePath();
  const mirrorDirectory = getFtpMirrorPath();

  await withFtpClient(async (client) => {
    await client.ensureDir(remoteDirectory);
    await client.uploadFrom(Readable.from(buffer), filename);

    if (mirrorDirectory && mirrorDirectory !== remoteDirectory) {
      await client.ensureDir(mirrorDirectory);
      await client.uploadFrom(Readable.from(buffer), filename);
    }
  });
};

const deleteFileFromFtp = async (filename) => {
  const remoteFilePath = path.posix.join(getFtpRemotePath(), filename);
  const mirrorDirectory = getFtpMirrorPath();
  const mirrorFilePath = mirrorDirectory ? path.posix.join(mirrorDirectory, filename) : null;

  try {
    await withFtpClient(async (client) => {
      await client.remove(remoteFilePath);

      if (mirrorFilePath) {
        try {
          await client.remove(mirrorFilePath);
        } catch (error) {
          const msg = String(error?.message || '').toLowerCase();
          if (!msg.includes('no such file') && !msg.includes('550')) {
            throw error;
          }
        }
      }
    });
    return true;
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('no such file') || msg.includes('550')) {
      return false;
    }
    throw error;
  }
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

const getPublicBaseUrl = (req) => {
  const requestBaseUrl = `${req.protocol}://${req.get('host')}`;
  const configuredBaseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
  const host = (req.get('host') || '').toLowerCase();
  const isLocalRequest = host.includes('localhost') || host.startsWith('127.0.0.1');

  // Local development should always return localhost URLs.
  if (isLocalRequest || !configuredBaseUrl) {
    return requestBaseUrl;
  }

  return configuredBaseUrl;
};

// Generate unique filename
const generateFilename = (originalName) => {
  const randomString = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  // Sharp outputs JPEG in this controller, so keep extension consistent.
  return `${timestamp}-${randomString}.jpg`;
};

// Upload single image to local storage
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Generate unique filename
    const filename = generateFilename(req.file.originalname);
    const optimizedBuffer = await optimizeImageToBuffer(req.file.buffer);

    if (isFtpConfigured()) {
      await uploadBufferToFtp(optimizedBuffer, filename);
    } else {
      await ensureUploadsDir();
      const filepath = path.join(uploadsDir, filename);
      await fs.writeFile(filepath, optimizedBuffer);
    }

    // Generate URL path
    const imageUrl = `${getPublicUploadBaseUrl(req)}/${filename}`;

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

    const uploadPromises = req.files.map(async (file) => {
      const filename = generateFilename(file.originalname);
      const optimizedBuffer = await optimizeImageToBuffer(file.buffer);

      if (isFtpConfigured()) {
        await uploadBufferToFtp(optimizedBuffer, filename);
      } else {
        await ensureUploadsDir();
        const filepath = path.join(uploadsDir, filename);
        await fs.writeFile(filepath, optimizedBuffer);
      }

      const imageUrl = `${getPublicUploadBaseUrl(req)}/${filename}`;

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

    if (isFtpConfigured()) {
      const deleted = await deleteFileFromFtp(filename);
      if (!deleted) {
        return res.status(404).json({ message: 'Image file not found' });
      }
      return res.status(200).json({ message: 'Image deleted successfully' });
    }

    const filepath = path.join(uploadsDir, filename);

    try {
      await fs.access(filepath);
      await fs.unlink(filepath);
      return res.status(200).json({ message: 'Image deleted successfully' });
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

      if (isFtpConfigured()) {
        await deleteFileFromFtp(filename);
      } else {
        const filepath = path.join(uploadsDir, filename);
        await fs.access(filepath);
        await fs.unlink(filepath);
      }

      console.log(`Deleted image: ${filename}`);
    } catch (error) {
      console.error(`Failed to delete image ${url}:`, error.message);
    }
  });

  await Promise.allSettled(deletePromises);
};
