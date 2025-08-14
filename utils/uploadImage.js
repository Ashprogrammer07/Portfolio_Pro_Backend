const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp'); // Optional: for image optimization

// Allowed file types
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// Maximum file size (5MB)
const maxSize = 5 * 1024 * 1024;

// Validate file type
const isValidImageType = (mimetype) => {
  return allowedTypes.includes(mimetype);
};

// Validate file size
const isValidFileSize = (size) => {
  return size <= maxSize;
};

// Generate unique filename
const generateUniqueFilename = (originalname) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(originalname).toLowerCase();
  return `project_${timestamp}_${randomString}${extension}`;
};

// Get file URL
const getImageUrl = (filename) => {
  return `${process.env.SERVER_URL || 'http://localhost:8000'}/uploads/${filename}`;
};

// Delete image file
const deleteImageFile = async (filename) => {
  try {
    if (!filename) return;
    const filePath = path.join(__dirname, '../uploads/', filename);
    await fs.unlink(filePath);
    console.log(`Image deleted: ${filename}`);
  } catch (error) {
    console.error(`Error deleting image ${filename}:`, error);
  }
};

// Optimize image (optional - requires sharp package)
const optimizeImage = async (inputPath, outputPath, options = {}) => {
  try {
    const {
      width = 1200,
      height = 800,
      quality = 85,
      format = 'jpeg'
    } = options;

    await sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toFile(outputPath);

    // Delete original file if optimization successful
    await fs.unlink(inputPath);
    return true;
  } catch (error) {
    console.error('Image optimization error:', error);
    return false;
  }
};

// Process uploaded file
const processUploadedFile = (file) => {
  if (!file) return null;

  return {
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: getImageUrl(file.filename),
    path: file.path
  };
};

// Validate uploaded file
const validateUploadedFile = (file) => {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return errors;
  }

  if (!isValidImageType(file.mimetype)) {
    errors.push('Invalid file type. Only JPEG, JPG, PNG, WEBP, and GIF files are allowed');
  }

  if (!isValidFileSize(file.size)) {
    errors.push('File size too large. Maximum size is 5MB');
  }

  return errors;
};

// Create thumbnail (optional)
const createThumbnail = async (originalPath, thumbnailPath, size = 200) => {
  try {
    await sharp(originalPath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);
    return true;
  } catch (error) {
    console.error('Thumbnail creation error:', error);
    return false;
  }
};

// Cleanup old images (utility function)
const cleanupOldImages = async (daysOld = 30) => {
  try {
    const uploadsDir = path.join(__dirname, '../uploads/');
    const files = await fs.readdir(uploadsDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deletedCount++;
        console.log(`Deleted old image: ${file}`);
      }
    }

    console.log(`Cleanup completed. Deleted ${deletedCount} old images.`);
    return deletedCount;
  } catch (error) {
    console.error('Image cleanup error:', error);
    return 0;
  }
};

// Batch process images
const batchProcessImages = async (files, options = {}) => {
  const results = [];
  
  for (const file of files) {
    try {
      const validation = validateUploadedFile(file);
      if (validation.length > 0) {
        results.push({
          filename: file.originalname,
          success: false,
          errors: validation
        });
        continue;
      }

      const processed = processUploadedFile(file);
      results.push({
        filename: file.originalname,
        success: true,
        data: processed
      });
    } catch (error) {
      results.push({
        filename: file.originalname,
        success: false,
        errors: [error.message]
      });
    }
  }

  return results;
};

module.exports = {
  isValidImageType,
  isValidFileSize,
  generateUniqueFilename,
  getImageUrl,
  deleteImageFile,
  optimizeImage,
  processUploadedFile,
  validateUploadedFile,
  createThumbnail,
  cleanupOldImages,
  batchProcessImages // NEW EXPORT
};
