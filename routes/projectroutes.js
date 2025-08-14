const express = require("express");
const router = express.Router();

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

const { uploadSingle, uploadMultiple, handleUploadError } = require('../middleware/upload');

const multer = require('multer');
const path = require('path');





// Configure multer for single image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const { generateUniqueFilename } = require('../utils/uploadImage');
    cb(null, generateUniqueFilename(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// CRITICAL: This route must exist and match your frontend call
router.post('/upload-image',  upload.single('image'), uploadImage);
















// === ADMIN ROUTES ===
router.get('/admin/stats', getProjectStats);

// Create project with multiple images
router.post('/create', uploadMultiple, handleUploadError, createProject);

// Update & Delete
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Toggle featured status
router.patch('/:id/featured', toggleFeatured);

// === PUBLIC ROUTES (order matters!) ===
router.get('/featured', getFeaturedProjects);
router.get('/category/:category', getProjectsByCategory);
router.get('/status/:status', getProjectsByStatus);

// Upload single image
router.post('/upload-image', uploadSingle, uploadImage);

// === GENERAL ROUTES (keep these last!) ===
router.get('/', getprojects);
router.get('/:id', getProjectById);

// Export the router
module.exports = router;
