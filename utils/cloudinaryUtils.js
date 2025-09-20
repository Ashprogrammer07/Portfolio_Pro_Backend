const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const path = require('path');

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Import existing validation functions to maintain compatibility
const { 
  isValidImageType: existingImageTypeValidation,
  isValidFileSize: existingFileSizeValidation,
  generateUniqueFilename: existingFilenameGenerator
} = require('./uploadImage');

// Re-export existing functions for compatibility
const isValidImageType = existingImageTypeValidation;
const isValidFileSize = existingFileSizeValidation;
const generateUniqueFilename = existingFilenameGenerator;

// Validate multiple files
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

// Upload single image to Cloudinary
const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    const {
      folder = 'projects/images',
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

module.exports = {
  // Validation functions (compatible with existing code)
  isValidImageType,
  isValidFileSize,
  validateFiles,
  validateUploadedFile,
  generateUniqueFilename,
  
  // Cloudinary functions
  uploadToCloudinary,
  processUploadedFile,
  batchProcessImages,
  generateThumbnailUrl,
  deleteImageFromCloudinary
};
