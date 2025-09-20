const express = require("express");
const router = express.Router();
const multer = require('multer');
const path = require('path');

const {
  createProject,
  updateProject,
  getprojects,
  getProjectById,
  deleteProject,
  getFeaturedProjects,
  getProjectsByCategory,
  getProjectsByStatus,
  getProjectStats,
  uploadImage,
  toggleFeatured
} = require("../controller/projectController");

// Import Cloudinary utilities instead of local upload utilities
const { 
  validateFiles, 
  isValidImageType, 
  isValidFileSize 
} = require('../utils/cloudinaryUtils');

// Configure multer for temporary storage before Cloudinary upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create temp directory for processing before Cloudinary upload
    cb(null, 'temp/uploads/');
  },
  filename: function (req, file, cb) {
    // Generate temporary filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Enhanced file filter with better validation
const fileFilter = (req, file, cb) => {
  // Check if file type is valid
  if (isValidImageType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF files are allowed'), false);
  }
};

// Configure multer with enhanced options
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit for Cloudinary
    files: 10 // Maximum 10 files per request
  },
  fileFilter: fileFilter
});

// Multer configurations for different upload scenarios
const uploadSingle = upload.single('image');
const uploadMultiple = upload.array('images', 10); // Max 10 images
const uploadFields = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'gallery', maxCount: 9 }
]);

// Enhanced error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 10MB per file.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 10 files allowed.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field.'
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Upload error: ${error.message}`
        });
    }
  } else if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  next();
};

// Validation middleware for uploaded files
const validateUploadedFiles = (req, res, next) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Validate each file
    const validationErrors = validateFiles(files);
    const hasErrors = validationErrors.some(errors => errors.length > 0);
    
    if (hasErrors) {
      // Clean up uploaded files on validation error
      files.forEach(file => {
        if (file.path) {
          require('fs').unlink(file.path, () => {});
        }
      });
      
      return res.status(400).json({
        success: false,
        message: 'File validation failed',
        errors: validationErrors
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Validation error occurred'
    });
  }
};

// === UPLOAD ROUTES ===
// Single image upload route (main upload endpoint)
router.post('/upload-image', 
  uploadSingle, 
  handleUploadError, 
  validateUploadedFiles, 
  uploadImage
);

// Multiple images upload route
router.post('/upload-multiple', 
  uploadMultiple, 
  handleUploadError, 
  validateUploadedFiles, 
  uploadImage
);

// Mixed field upload (thumbnail + gallery)
router.post('/upload-mixed', 
  uploadFields, 
  handleUploadError, 
  validateUploadedFiles, 
  uploadImage
);

// === ADMIN ROUTES ===
router.get('/admin/stats', getProjectStats);

// Create project with image upload support
router.post('/create', 
  uploadMultiple, 
  handleUploadError, 
  validateUploadedFiles, 
  createProject
);

// Update project (with optional image upload)
router.put('/:id', 
  uploadMultiple, 
  handleUploadError, 
  (req, res, next) => {
    // Skip validation if no files uploaded (update without images)
    if (!req.files || req.files.length === 0) {
      return next();
    }
    validateUploadedFiles(req, res, next);
  },
  updateProject
);

// Delete project
router.delete('/:id', deleteProject);

// Toggle featured status
router.patch('/:id/featured', toggleFeatured);

// === PUBLIC ROUTES (order matters!) ===
router.get('/featured', getFeaturedProjects);
router.get('/category/:category', getProjectsByCategory);
router.get('/status/:status', getProjectsByStatus);

// === GENERAL ROUTES (keep these last!) ===
router.get('/', getprojects);
router.get('/:id', getProjectById);

// === UTILITY ROUTES ===
// Get upload configuration (useful for frontend)
router.get('/upload-config', (req, res) => {
  res.json({
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    uploadEndpoints: {
      single: '/api/projects/upload-image',
      multiple: '/api/projects/upload-multiple',
      mixed: '/api/projects/upload-mixed'
    }
  });
});

// Health check for upload functionality
router.get('/upload-health', (req, res) => {
  res.json({
    status: 'healthy',
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'not configured',
    tempDir: 'temp/uploads/',
    timestamp: new Date().toISOString()
  });
});

// Export the router
module.exports = router;
