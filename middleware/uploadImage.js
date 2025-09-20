const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const path = require('path');

// Configuration constants
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Allowed file types (added GIF support)
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// Maximum file size (10MB for Cloudinary)
const maxSize = 10 * 1024 * 1024;

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
      errors.push('File size too large. Maximum size is 10MB');
    }
    return errors;
  });
};

// Generate unique filename for Cloudinary public_id
const generateUniqueFilename = (originalname) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = path.extname(originalname).toLowerCase();
  const basename = path.basename(originalname, extension);
  return `${basename}_${timestamp}_${randomString}`;
};

// Upload single image to Cloudinary
const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    const {
      folder = 'uploads/images',
      transformation = [],
      format = 'auto',
      quality = 'auto',
      publicId = null
    } = options;

    const uploadOptions = {
      folder: folder,
      resource_type: 'image',
      format: format,
      quality: quality,
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { fetch_format: 'auto', quality: 'auto' },
        ...transformation
      ]
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    // Clean up local file after successful upload
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.warn('Could not delete local file:', unlinkError.message);
    }

    return {
      success: true,
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
      version: result.version,
      thumbnailUrl: generateThumbnailUrl(result.public_id)
    };
  } catch (error) {
    // Clean up local file on error
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.warn('Could not delete local file after error:', unlinkError.message);
    }
    
    return {
      success: false,
      error: error.message || 'Upload failed'
    };
  }
};

// Upload using stream (for memory efficiency)
const uploadStreamToCloudinary = (options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      folder = 'uploads/images',
      transformation = [],
      format = 'auto',
      quality = 'auto',
      publicId = null
    } = options;

    const uploadOptions = {
      folder: folder,
      resource_type: 'image',
      format: format,
      quality: quality,
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { fetch_format: 'auto', quality: 'auto' },
        ...transformation
      ]
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject({
            success: false,
            error: error.message || 'Stream upload failed'
          });
        } else {
          resolve({
            success: true,
            publicId: result.public_id,
            url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.bytes,
            version: result.version,
            thumbnailUrl: generateThumbnailUrl(result.public_id)
          });
        }
      }
    );

    return uploadStream;
  });
};

// Generate thumbnail URL using Cloudinary transformations
const generateThumbnailUrl = (publicId, size = 200) => {
  return cloudinary.url(publicId, {
    width: size,
    height: size,
    crop: 'fill',
    gravity: 'face',
    format: 'auto',
    quality: 'auto',
    secure: true
  });
};

// Batch process multiple images
const batchProcessImages = async (files, options = {}) => {
  const results = [];
  
  for (const file of files) {
    try {
      if (!file || !file.path) {
        results.push({
          success: false,
          error: 'Invalid file object',
          filename: file?.originalname || 'unknown'
        });
        continue;
      }

      // Validate file before upload
      const errors = validateUploadedFile(file);
      if (errors.length > 0) {
        results.push({
          success: false,
          error: errors.join(', '),
          filename: file.originalname
        });
        continue;
      }

      // Generate unique public ID
      const publicId = generateUniqueFilename(file.originalname);
      
      const uploadResult = await uploadToCloudinary(file.path, {
        publicId,
        ...options
      });
      
      results.push({
        ...uploadResult,
        filename: file.originalname
      });
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        filename: file?.originalname || 'unknown'
      });
    }
  }
  
  return results;
};

// Process uploaded file from multer
const processUploadedFile = async (file, options = {}) => {
  if (!file) return null;

  // Validate file first
  const errors = validateUploadedFile(file);
  if (errors.length > 0) {
    return {
      success: false,
      errors: errors,
      filename: file.originalname
    };
  }

  // Generate unique public ID
  const publicId = generateUniqueFilename(file.originalname);
  
  // Upload to Cloudinary
  const result = await uploadToCloudinary(file.path, {
    publicId,
    ...options
  });

  return {
    ...result,
    filename: file.originalname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    originalSize: file.size
  };
};

// Process file from buffer (useful for direct uploads)
const processFileBuffer = async (buffer, originalname, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      folder = 'uploads/images',
      transformation = [],
      format = 'auto',
      quality = 'auto'
    } = options;

    const publicId = generateUniqueFilename(originalname);
    
    const uploadOptions = {
      folder: folder,
      resource_type: 'image',
      format: format,
      quality: quality,
      public_id: publicId,
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { fetch_format: 'auto', quality: 'auto' },
        ...transformation
      ]
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          resolve({
            success: false,
            error: error.message || 'Buffer upload failed',
            filename: originalname
          });
        } else {
          resolve({
            success: true,
            publicId: result.public_id,
            url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.bytes,
            version: result.version,
            thumbnailUrl: generateThumbnailUrl(result.public_id),
            filename: originalname
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
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
    errors.push('File size too large. Maximum size is 10MB');
  }

  return errors;
};

// Delete image from Cloudinary
const deleteImageFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return { success: false, error: 'No public ID provided' };
    
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      console.log(`Successfully deleted image: ${publicId}`);
      return { success: true, publicId };
    } else {
      console.warn(`Failed to delete image: ${publicId}, result: ${result.result}`);
      return { success: false, error: `Delete failed: ${result.result}`, publicId };
    }
  } catch (error) {
    console.error(`Error deleting image ${publicId}:`, error.message);
    return { success: false, error: error.message, publicId };
  }
};

// Batch delete multiple images
const batchDeleteImages = async (publicIds) => {
  const results = [];
  
  for (const publicId of publicIds) {
    const result = await deleteImageFromCloudinary(publicId);
    results.push(result);
  }
  
  return results;
};

// Get image details from Cloudinary
const getImageDetails = async (publicId) => {
  try {
    if (!publicId) return { success: false, error: 'No public ID provided' };
    
    const result = await cloudinary.api.resource(publicId);
    
    return {
      success: true,
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
      created: result.created_at,
      version: result.version,
      thumbnailUrl: generateThumbnailUrl(result.public_id)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      publicId
    };
  }
};

// Generate different sized images
const generateImageVariants = (publicId, variants = {}) => {
  const defaultVariants = {
    thumbnail: { width: 200, height: 200, crop: 'fill' },
    small: { width: 400, height: 300, crop: 'fit' },
    medium: { width: 800, height: 600, crop: 'fit' },
    large: { width: 1200, height: 900, crop: 'fit' }
  };
  
  const mergedVariants = { ...defaultVariants, ...variants };
  const urls = {};
  
  Object.keys(mergedVariants).forEach(variant => {
    urls[variant] = cloudinary.url(publicId, {
      ...mergedVariants[variant],
      format: 'auto',
      quality: 'auto',
      secure: true
    });
  });
  
  return urls;
};

// Clean up old images (requires Admin API)
const cleanupOldImages = async (daysOld = 30, folder = 'uploads/images') => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Get all images in folder
    const results = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: 500 // Cloudinary's max per request
    });
    
    const oldImages = results.resources.filter(resource => {
      const createdDate = new Date(resource.created_at);
      return createdDate < cutoffDate;
    });
    
    if (oldImages.length === 0) {
      return { deletedCount: 0, errors: [] };
    }
    
    // Delete old images in batches
    const publicIds = oldImages.map(img => img.public_id);
    const deleteResult = await cloudinary.api.delete_resources(publicIds);
    
    const deletedCount = Object.keys(deleteResult.deleted).length;
    const errors = Object.entries(deleteResult.partial || {}).map(
      ([id, error]) => `${id}: ${error}`
    );
    
    console.log(`Cloudinary cleanup completed. Deleted ${deletedCount} old images.`);
    
    if (errors.length > 0) {
      console.warn('Cleanup errors:', errors);
    }
    
    return { deletedCount, errors };
  } catch (error) {
    console.error('Cloudinary cleanup error:', error.message);
    return { deletedCount: 0, errors: [error.message] };
  }
};

module.exports = {
  // Validation functions
  isValidImageType,
  isValidFileSize,
  validateFiles,
  validateUploadedFile,
  
  // Upload functions
  uploadToCloudinary,
  uploadStreamToCloudinary,
  processUploadedFile,
  processFileBuffer,
  batchProcessImages,
  
  // Utility functions
  generateUniqueFilename,
  generateThumbnailUrl,
  generateImageVariants,
  
  // Image management
  deleteImageFromCloudinary,
  batchDeleteImages,
  getImageDetails,
  cleanupOldImages
};
