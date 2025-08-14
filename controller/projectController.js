const Project = require("../models/Project");
const { 
  validateUploadedFile, 
  processUploadedFile, 
  generateUniqueFilename,
  getImageUrl 
} = require('../utils/uploadImage');

// Helper function to generate file URLs
const getFileUrl = (filename) => {
  return `${process.env.SERVER_URL || 'http://localhost:8000'}/uploads/${filename}`;
};

// Get all projects
const getprojects = async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};

// Get single project by ID
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Get project by ID error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch project",
      error: error.message
    });
  }
};

// SEPARATED SINGLE IMAGE UPLOAD (for your separated upload functionality)
const uploadImage = async (req, res) => {
  try {
    // Validate uploaded file using your utilities
    const errors = validateUploadedFile(req.file);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', ')
      });
    }

    // Process the uploaded file
    const fileInfo = processUploadedFile(req.file);
    
    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: fileInfo.url,
        filename: fileInfo.filename,
        originalName: fileInfo.originalname,
        size: fileInfo.size
      }
    });
  } catch (error) {
    console.error('Single image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

// Create new project (updated for your separated approach)
const createProject = async (req, res) => {
  try {
    // Validate required fields first
    const { title, description, startDate, endDate, githubUrl, liveUrl, technologies } = req.body;
    
    if (!title || !description || !startDate || !endDate || !githubUrl || !liveUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, startDate, endDate, githubUrl, liveUrl'
      });
    }

    // Parse technologies array
    let parsedTechnologies = [];
    if (technologies) {
      if (Array.isArray(technologies)) {
        parsedTechnologies = technologies;
      } else if (typeof technologies === 'string') {
        try {
          parsedTechnologies = JSON.parse(technologies);
        } catch (e) {
          parsedTechnologies = technologies.split(',').map(tech => tech.trim()).filter(tech => tech);
        }
      }
    }

    if (parsedTechnologies.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one technology is required'
      });
    }

    // Parse challenges array if provided
    let parsedChallenges = [];
    if (req.body.challenges) {
      if (Array.isArray(req.body.challenges)) {
        parsedChallenges = req.body.challenges;
      } else if (typeof req.body.challenges === 'string') {
        try {
          parsedChallenges = JSON.parse(req.body.challenges);
        } catch (e) {
          parsedChallenges = req.body.challenges.split('\n').map(challenge => challenge.trim()).filter(challenge => challenge);
        }
      }
    }

    // Parse images array (comes from separated upload)
    let images = [];
    if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        images = req.body.images;
      } else if (typeof req.body.images === 'string') {
        try {
          images = JSON.parse(req.body.images);
        } catch (e) {
          images = [req.body.images];
        }
      }
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const projectData = {
      title: title.trim(),
      description: description.trim(),
      shortDescription: req.body.shortDescription?.trim() || '',
      category: req.body.category || 'Web Development',
      technologies: parsedTechnologies,
      githubUrl: githubUrl.trim(),
      liveUrl: liveUrl.trim(),
      startDate: start,
      endDate: end,
      status: req.body.status || 'Not Started',
      featured: req.body.featured === 'true' || req.body.featured === true,
      challenges: parsedChallenges,
      image: req.body.image || images[0] || '', // Main image
      images: images, // All images array
      images_url: images, // For backward compatibility
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const project = await Project.create(projectData);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create project',
      error: error.message
    });
  }
};

// Update project (enhanced validation)
const updateProject = async (req, res) => {
  try {
    const existingProject = await Project.findById(req.params.id);
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Parse technologies array
    let parsedTechnologies = existingProject.technologies;
    if (req.body.technologies) {
      if (Array.isArray(req.body.technologies)) {
        parsedTechnologies = req.body.technologies;
      } else if (typeof req.body.technologies === 'string') {
        try {
          parsedTechnologies = JSON.parse(req.body.technologies);
        } catch (e) {
          parsedTechnologies = req.body.technologies.split(',').map(tech => tech.trim()).filter(tech => tech);
        }
      }
    }

    // Parse challenges array
    let parsedChallenges = existingProject.challenges || [];
    if (req.body.challenges) {
      if (Array.isArray(req.body.challenges)) {
        parsedChallenges = req.body.challenges;
      } else if (typeof req.body.challenges === 'string') {
        try {
          parsedChallenges = JSON.parse(req.body.challenges);
        } catch (e) {
          parsedChallenges = req.body.challenges.split('\n').map(challenge => challenge.trim()).filter(challenge => challenge);
        }
      }
    }

    // Parse images array
    let images = existingProject.images || [];
    if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        images = req.body.images;
      } else if (typeof req.body.images === 'string') {
        try {
          images = JSON.parse(req.body.images);
        } catch (e) {
          images = [req.body.images];
        }
      }
    }

    // Validate dates if provided
    if (req.body.startDate && req.body.endDate) {
      const start = new Date(req.body.startDate);
      const end = new Date(req.body.endDate);
      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }
    }

    const updateData = {
      ...req.body,
      technologies: parsedTechnologies,
      challenges: parsedChallenges,
      images: images,
      images_url: images, // For backward compatibility
      featured: req.body.featured === 'true' || req.body.featured === true,
      updatedAt: new Date()
    };

    // Clean undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update project',
      error: error.message
    });
  }
};

// Toggle featured status (for your separated featured toggle)
const toggleFeatured = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      { 
        featured: req.body.featured,
        updatedAt: new Date()
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Project ${req.body.featured ? 'added to' : 'removed from'} featured`,
      data: updatedProject
    });

  } catch (error) {
    console.error('Toggle featured error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update featured status',
      error: error.message
    });
  }
};

// Delete project (enhanced with image cleanup)
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // TODO: Add image cleanup here if needed
    // You can use your deleteImageFile function from uploadImage.js
    
    await Project.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete project',
      error: error.message
    });
  }
};

// BATCH UPLOAD IMAGES (for multiple image upload)
const uploadProjectImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided'
      });
    }

    const uploadResults = [];
    const errors = [];

    for (const file of req.files) {
      const validationErrors = validateUploadedFile(file);
      if (validationErrors.length > 0) {
        errors.push({
          filename: file.originalname,
          errors: validationErrors
        });
        continue;
      }

      const fileInfo = processUploadedFile(file);
      uploadResults.push({
        url: fileInfo.url,
        filename: fileInfo.filename,
        originalName: fileInfo.originalname,
        size: fileInfo.size
      });
    }

    if (uploadResults.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid images were uploaded',
        errors
      });
    }

    res.status(200).json({
      success: true,
      message: `${uploadResults.length} image(s) uploaded successfully`,
      data: uploadResults,
      count: uploadResults.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Batch upload images error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: error.message
    });
  }
};

// Get featured projects
const getFeaturedProjects = async (req, res) => {
  try {
    const projects = await Project.find({ featured: true }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Get featured projects error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured projects",
      error: error.message
    });
  }
};

// Get projects by category
const getProjectsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const projects = await Project.find({
      category: new RegExp(category, 'i')
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Get projects by category error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects by category",
      error: error.message
    });
  }
};

// Get projects by status
const getProjectsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const projects = await Project.find({
      status: new RegExp(status, 'i')
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Get projects by status error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects by status",
      error: error.message
    });
  }
};

// Get project statistics (Admin only)
const getProjectStats = async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const completedProjects = await Project.countDocuments({ status: 'Completed' });
    const inProgressProjects = await Project.countDocuments({ status: 'In Progress' });
    const notStartedProjects = await Project.countDocuments({ status: 'Not Started' });
    const featuredProjects = await Project.countDocuments({ featured: true });

    // Calculate completion rate
    const completionRate = totalProjects > 0 ? ((completedProjects / totalProjects) * 100).toFixed(1) : 0;

    // Get projects by category
    const categoryCounts = await Project.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get most used technologies
    const techCounts = await Project.aggregate([
      { $unwind: '$technologies' },
      {
        $group: {
          _id: '$technologies',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get recent projects
    const recentProjects = await Project.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title category status createdAt featured');

    res.status(200).json({
      success: true,
      data: {
        totalProjects,
        completedProjects,
        inProgressProjects,
        notStartedProjects,
        featuredProjects,
        completionRate,
        categoryCounts,
        techCounts,
        recentProjects
      }
    });

  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch project statistics",
      error: error.message
    });
  }
};

module.exports = {
  getprojects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getFeaturedProjects,
  getProjectsByCategory,
  getProjectsByStatus,
  getProjectStats,
  uploadProjectImages,
  uploadImage, // NEW: Single image upload for separated functionality
  toggleFeatured // NEW: Toggle featured status
};
