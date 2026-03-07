# Local Storage Setup Guide

This document explains how image uploads have been migrated from Cloudinary to local storage on Hostinger.

## What Changed

### Backend Changes
1. **Upload Controller** (`controllers/uploadController.js`)
   - Now saves images to the local `uploads/` directory
   - Uses `sharp` for image processing and optimization
   - Returns `filename` instead of `publicId`
   - Images are automatically resized to max 1920x1080 and optimized

2. **Server Configuration** (`server.js`)
   - Added static file serving for `/uploads` directory
   - Images are now accessible at: `https://yourdomain.com/uploads/filename.jpg`

3. **Delete Controllers**
   - Property Controller: Deletes associated images when property is deleted
   - Page Controller: Deletes featured image when page is deleted
   - Admin Controller: Deletes associated images when admin deletes property

4. **Dependencies** (`package.json`)
   - Added: `sharp` (for image processing)
   - Removed: `cloudinary` (no longer needed)

### Frontend Changes
1. **Updated Components**
   - `ContentEditor.jsx`: Changed from `publicId` to `filename`
   - `PostProperty.jsx`: Changed from `publicId` to `filename`
   - `CreateProject.jsx`: Changed from `publicId` to `filename`

2. **API Response Format**
   - Old: `{ url, publicId }`
   - New: `{ url, filename }`

## Installation Steps

### 1. Install Dependencies
```bash
cd sanju-backend
npm install
```

This will install the new `sharp` dependency.

### 2. Update Environment Variables
Make sure your `.env` file has the `BASE_URL` set:

```env
BASE_URL=https://baserainfrahome.com
```

### 3. Create Uploads Directory
The uploads directory will be created automatically when the first image is uploaded, but you can create it manually:

```bash
mkdir uploads
```

### 4. Set Proper Permissions (On Hostinger)
Make sure the uploads directory has write permissions:

```bash
chmod 755 uploads
```

## Hostinger Deployment

### 1. Upload Files
Upload all files to your Hostinger server, including the updated code.

### 2. Install Dependencies on Server
```bash
cd /path/to/your/sanju-backend
npm install
```

### 3. Ensure Uploads Directory Exists
```bash
mkdir -p uploads
chmod 755 uploads
```

### 4. Restart Server
Make sure your Node.js application restarts to pick up the new code.

## Image URL Structure

Images are now served from your own domain:
- Format: `https://yourdomain.com/uploads/{timestamp}-{randomhash}.jpg`
- Example: `https://baserainfrahome.com/uploads/1709812345678-a1b2c3d4e5f6.jpg`

## Features

### Automatic Image Processing
- Maximum dimensions: 1920x1080 (maintains aspect ratio)
- Automatic JPEG conversion and optimization
- Quality: 85%
- No enlargement of smaller images

### Automatic Cleanup
- Images are automatically deleted when:
  - A property with images is deleted
  - A page with a featured image is deleted
  - Multiple pages are bulk deleted

### Security
- Only authenticated users can upload images
- File size limit: 5MB per file
- Only image MIME types are accepted

## File Storage Location

All uploaded images are stored in:
```
sanju-backend/uploads/
```

This directory is already added to `.gitignore` to prevent committing uploaded files to the repository.

## Migration from Cloudinary

If you have existing images on Cloudinary, you'll need to:
1. Download them from Cloudinary
2. Upload them to the new system using the upload endpoint
3. Update the database records to use the new URLs

Alternatively, you can leave existing Cloudinary URLs as-is and only new uploads will use local storage.

## Troubleshooting

### Images Not Displaying
- Check that the uploads directory exists and has proper permissions
- Verify BASE_URL is set correctly in .env
- Check that the static file route is working: `/uploads`

### Upload Failures
- Check server logs for detailed error messages
- Verify sharp is installed correctly: `npm list sharp`
- Check disk space on server

### Permission Errors
```bash
chmod 755 uploads
chown youruser:yourgroup uploads
```

## API Endpoints

### Upload Single Image
```
POST /api/upload/single
Headers: Authorization: Bearer {token}
Body: FormData with 'image' field
Response: { url, filename, message }
```

### Upload Multiple Images
```
POST /api/upload/multiple
Headers: Authorization: Bearer {token}
Body: FormData with 'images' field (array)
Response: { images: [{url, filename}], message }
```

### Delete Image
```
DELETE /api/upload/delete
Headers: Authorization: Bearer {token}
Body: { filename: "timestamp-hash.jpg" }
Response: { message }
```
