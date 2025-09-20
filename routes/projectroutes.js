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

// For now, use your existing uploadImage utils until cloudinaryUtils is created
const { 
  generateUniqueFilename,
  isValidImageType,
  isValidFileSize
} = require('../utils/uploadImage');

// Configure multer for temporary storage before Cloudinary upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use uploads directory that already exists
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, generateUniqueFilename(file.originalname));
  }
});

// Enhanced file filter with better validation
const fileFilter = (req, file, cb) => {
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
const uploadMultiple = upload.array('images', 10);

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

// === UPLOAD ROUTES ===
// Main image upload route (CRITICAL: must match frontend calls)
router.post('/upload-image', uploadSingle, handleUploadError, uploadImage);

// Multiple images upload route
router.post('/upload-multiple', uploadMultiple, handleUploadError, uploadImage);

// === ADMIN ROUTES ===
router.get('/admin/stats', getProjectStats);

// Create project with image upload support
router.post('/create', uploadMultiple, handleUploadError, createProject);

// Update project (with optional image upload)
router.put('/:id', uploadMultiple, handleUploadError, updateProject);

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

// Export the router
module.exports = router;
