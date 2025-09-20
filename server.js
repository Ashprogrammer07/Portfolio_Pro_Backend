const connectDB = require("./config/db");
const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");
const multer = require("multer");

// Import Cloudinary v2
const cloudinary = require("cloudinary").v2;

const contactroute = require("./routes/Contactroute");
const projectroute = require("./routes/projectroutes");
const skillroute = require("./routes/skillsRoutes");
const adminRoute = require("./routes/adminroute");

// Load environment variables first
dotenv.config({ path: "./config/config.env" });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Import existing utility functions
const { 
  generateUniqueFilename,
  isValidImageType,
  isValidFileSize
} = require('./utils/uploadImage');

// Configure multer for temporary storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(__dirname, "temp", "uploads");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    cb(null, generateUniqueFilename(file.originalname));
  }
});

// Enhanced file filter
const fileFilter = (req, file, cb) => {
  if (isValidImageType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF files are allowed'), false);
  }
};

// Configure multer
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: fileFilter
});

// Cloudinary upload function
const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: options.folder || "portfolio/projects",
      resource_type: "image",
      format: "auto",
      quality: "auto",
      transformation: [
        { width: 1200, height: 800, crop: "limit" },
        { fetch_format: "auto", quality: "auto" }
      ],
      ...options
    });
    
    // Clean up temporary file
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkError) {
      console.warn('Could not delete temp file:', unlinkError.message);
    }
    
    return {
      success: true,
      publicId: result.public_id,
      url: result.secure_url,
      thumbnailUrl: cloudinary.url(result.public_id, {
        width: 200,
        height: 200,
        crop: "fill",
        gravity: "face",
        format: "auto",
        quality: "auto",
        secure: true
      }),
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes
    };
  } catch (error) {
    // Clean up temporary file on error
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkError) {
      console.warn('Could not delete temp file after error:', unlinkError.message);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
};

// Verify Cloudinary configuration
const verifyCloudinaryConfig = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  
  if (!cloud_name || !api_key || !api_secret) {
    console.error("⚠️ Cloudinary configuration incomplete!");
    return false;
  }
  
  console.log("✅ Cloudinary configured successfully");
  return true;
};

// Connect to database
connectDB();
verifyCloudinaryConfig();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create temp directory
const createTempDir = () => {
  const tempDir = path.join(__dirname, "temp", "uploads");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log("✅ Created temp upload directory");
  }
};

createTempDir();

// 🎯 INTEGRATED CLOUDINARY UPLOAD ROUTE FOR /api/projects/upload-image
app.post('/api/projects/upload-image', upload.single('image'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    // Validate file
    if (!isValidImageType(req.file.mimetype)) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, WEBP, and GIF files are allowed'
      });
    }

    if (!isValidFileSize(req.file.size)) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }

    // Generate unique public ID
    const publicId = generateUniqueFilename(req.file.originalname).split('.')[0];
    
    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.path, {
      public_id: publicId,
      folder: "portfolio/projects"
    });

    if (uploadResult.success) {
      console.log(`✅ Image uploaded successfully: ${uploadResult.publicId}`);
      
      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          publicId: uploadResult.publicId,
          url: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          size: uploadResult.size,
          filename: req.file.originalname
        }
      });
    } else {
      console.error(`❌ Upload failed: ${uploadResult.error}`);
      
      res.status(500).json({
        success: false,
        message: 'Failed to upload image to Cloudinary',
        error: uploadResult.error
      });
    }

  } catch (error) {
    console.error('Upload route error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.warn('Could not delete temp file:', unlinkError.message);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during upload',
      error: error.message
    });
  }
});

// 🎯 ADDITIONAL CLOUDINARY UTILITY ROUTES
app.delete('/api/projects/delete-image/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      res.status(200).json({
        success: true,
        message: 'Image deleted successfully',
        publicId: publicId
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Image not found or already deleted',
        result: result.result
      });
    }
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message
    });
  }
});

app.get('/api/projects/image-details/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    const result = await cloudinary.api.resource(publicId);
    
    res.status(200).json({
      success: true,
      data: {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        created: result.created_at,
        folder: result.folder
      }
    });
  } catch (error) {
    console.error('Get image details error:', error);
    res.status(404).json({
      success: false,
      message: 'Image not found',
      error: error.message
    });
  }
});

// Other API routes
app.use("/api/contact", contactroute);
app.use("/api/projects", projectroute); // This will handle other project routes
app.use("/api/skills", skillroute);
app.use("/api", adminRoute);

// Serve uploads folder (for backward compatibility)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Cloudinary health check
app.get("/api/cloudinary/health", async (req, res) => {
  try {
    const { cloud_name, api_key } = cloudinary.config();
    
    if (!cloud_name || !api_key) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary not configured properly"
      });
    }

    const ping = await cloudinary.api.ping();
    
    res.status(200).json({
      success: true,
      message: "Cloudinary is connected",
      cloudName: cloud_name,
      status: ping.status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Cloudinary connection failed",
      error: error.message
    });
  }
});

// General health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    cloudinary: {
      configured: !!cloudinary.config().cloud_name
    },
    timestamp: new Date().toISOString()
  });
});

// SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return next();
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Maximum size is 10MB"
    });
  }
  
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  res.status(500).json({ 
    success: false, 
    message: "Server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`☁️ Cloudinary health: http://localhost:${PORT}/api/cloudinary/health`);
  console.log(`🖼️ Image upload: POST http://localhost:${PORT}/api/projects/upload-image`);
});
