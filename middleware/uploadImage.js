const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp'); // Optional: for image optimization

// Configuration constants
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const UPLOAD_DIR = path.join(__dirname, '../uploads/images');

// Allowed file types (added GIF support)
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// Maximum file size (5MB)
const maxSize = 5 * 1024 * 1024;

// Validate file type
const isValidImageType = (mimetype) => {
  return allowedTypes.includes(mimetype.toLowerCase());
};

// Validate file size
const isValidFileSize = (size) => {
  return size <= maxSize;
};

// Validate multiple files (returns array of errors for each file)
const validateFiles = (files) => {
  if (!Array.isArray(files)) {
    return [['No files provided']];
  }
  
  return files.map(file => {
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
  });
};

// Generate unique filename
const generateUniqueFilename = (originalname) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(originalname).toLowerCase();
  return `${timestamp}_${randomString}${extension}`;
};

// Get image URL
const getImageUrl = (filename) => {
  return `${SERVER_URL}/uploads/images/${filename}`;
};

// Ensure upload directory exists
const ensureUploadDir = async () => {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(path.join(UPLOAD_DIR, 'thumbnails'), { recursive: true });
  } catch (error) {
    console.error('Error creating upload directories:', error.message);
  }
};

// Delete image file
const deleteImageFile = async (filename) => {
  try {
    if (!filename) return;
    
    const filePath = path.join(UPLOAD_DIR, filename);
    const thumbnailPath = path.join(UPLOAD_DIR, 'thumbnails', filename);
    
    // Delete main image
    try {
      await fs.unlink(filePath);
      console.log(`Deleted image file: ${filename}`);
    } catch (e) {
      console.warn(`Main image not found: ${filename}`);
    }
    
    // Delete thumbnail if exists
    try {
      await fs.unlink(thumbnailPath);
      console.log(`Deleted thumbnail: ${filename}`);
    } catch (e) {
      // Thumbnail may not exist, ignore
    }
  } catch (error) {
    console.error(`Error deleting image ${filename}:`, error.message);
  }
};

// Optimize image with format-specific handling
const optimizeImage = async (inputPath, outputPath, options = {}) => {
  try {
    const {
      width = 1200,
      height = 800,
      quality = 85,
      format = 'jpeg'
    } = options;

    const image = sharp(inputPath);
    
    // Apply resize
    image.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    });

    // Apply format-specific compression
    switch (format.toLowerCase()) {
      case 'png':
        image.png({ compressionLevel: 9, quality });
        break;
      case 'webp':
        image.webp({ quality });
        break;
      case 'gif':
        // Sharp doesn't optimize GIFs well, just resize
        image.gif();
        break;
      default:
        image.jpeg({ quality, progressive: true });
    }

    await image.toFile(outputPath);

    // Delete original file if different path
    if (inputPath !== outputPath) {
      await fs.unlink(inputPath);
    }
    
    return true;
  } catch (error) {
    console.error('Image optimization error:', error.message);
    return false;
  }
};

// Batch process multiple images
const batchProcessImages = async (files, options = {}) => {
  await ensureUploadDir();
  
  const results = [];
  
  for (const file of files) {
    try {
      const optimizedFilename = generateUniqueFilename(file.originalname);
      const outputPath = path.join(UPLOAD_DIR, optimizedFilename);
      
      // Detect format from mimetype
      const format = file.mimetype.split('/')[1] === 'jpeg' ? 'jpeg' : file.mimetype.split('/')[1];
      
      const optimized = await optimizeImage(file.path, outputPath, {
        ...options,
        format
      });
      
      if (optimized) {
        // Create thumbnail
        const thumbnailPath = path.join(UPLOAD_DIR, 'thumbnails', optimizedFilename);
        await createThumbnail(outputPath, thumbnailPath);
        
        results.push({
          success: true,
          filename: optimizedFilename,
          url: getImageUrl(optimizedFilename),
          thumbnailUrl: `${SERVER_URL}/uploads/images/thumbnails/${optimizedFilename}`,
          size: (await fs.stat(outputPath)).size
        });
      } else {
        results.push({
          success: false,
          error: 'Optimization failed',
          filename: file.originalname
        });
      }
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        filename: file.originalname
      });
    }
  }
  
  return results;
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

// Create thumbnail (improved error handling)
const createThumbnail = async (inputPath, thumbnailPath, size = 200) => {
  try {
    await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
    
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);
    
    return true;
  } catch (error) {
    console.error('Thumbnail creation error:', error.message);
    return false;
  }
};

// Enhanced cleanup with better error handling
const cleanupOldImages = async (daysOld = 30) => {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deletedCount = 0;
    const errors = [];

    for (const file of files) {
      try {
        // Skip directories
        if (file === 'thumbnails') continue;
        
        const filePath = path.join(UPLOAD_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          
          // Also try to delete corresponding thumbnail
          try {
            await fs.unlink(path.join(UPLOAD_DIR, 'thumbnails', file));
          } catch (e) {
            // Thumbnail might not exist
          }
          
          deletedCount++;
          console.log(`Deleted old image: ${file}`);
        }
      } catch (error) {
        errors.push(`Failed to process ${file}: ${error.message}`);
      }
    }

    console.log(`Image cleanup completed. Deleted ${deletedCount} old images.`);
    
    if (errors.length > 0) {
      console.warn('Cleanup errors:', errors);
    }
    
    return { deletedCount, errors };
  } catch (error) {
    console.error('Image cleanup error:', error.message);
    return { deletedCount: 0, errors: [error.message] };
  }
};

// Get file info (useful for debugging)
const getFileInfo = async (filename) => {
  try {
    const filePath = path.join(UPLOAD_DIR, filename);
    const stats = await fs.stat(filePath);
    return {
      exists: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      url: getImageUrl(filename)
    };
  } catch (error) {
    return { exists: false, error: error.message };
  }
};

module.exports = {
  isValidImageType,
  isValidFileSize,
  validateFiles,
  generateUniqueFilename,
  getImageUrl,
  ensureUploadDir,
  deleteImageFile,
  optimizeImage,
  batchProcessImages,
  processUploadedFile,
  validateUploadedFile,
  createThumbnail,
  cleanupOldImages,
  getFileInfo
};
