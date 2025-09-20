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

// Configure Cloudinary (remove any extra spaces or special characters)
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

// ✅ CORRECTED Cloudinary upload function with proper transformation syntax
const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    // ✅ Fixed transformation format - removed nested arrays and conflicting parameters
    const uploadOptions = {
      folder: options.folder || "portfolio/projects",
      resource_type: "image",
      // ✅ Removed conflicting format/quality parameters that were causing signature issues
      transformation: [
        { width: 1200, height: 800, crop: "limit" }
        // ✅ Removed f_auto and q_auto from here - they'll be applied at delivery time
      ]
    };

    // ✅ Only add public_id if provided
    if (options.public_id) {
      uploadOptions.public_id = options.public_id;
    }

    console.log("🔧 Upload options:", JSON.stringify(uploadOptions, null, 2));

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    
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
        gravity: "center", // ✅ Changed from "face" to "center" for better compatibility
        format: "auto",
        quality: "auto",
        secure: true
      }),
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
      version: result.version
    };
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error);
    
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
  
  console.log("🔍 Checking Cloudinary config...");
  console.log("Cloud name:", cloud_name ? "✅" : "❌");
  console.log("API key:", api_key ? "✅" : "❌");  
  console.log("API secret:", api_secret ? "✅" : "❌");
  
  if (!cloud_name || !api_key || !api_secret) {
    console.error("⚠️ Cloudinary configuration incomplete!");
    console.error("Please check your environment variables:");
    console.error("- CLOUDINARY_CLOUD_NAME");
    console.error("- CLOUDINARY_API_KEY"); 
    console.error("- CLOUDINARY_API_SECRET");
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

// 🎯 CORRECTED CLOUDINARY UPLOAD ROUTE
app.post('/api/projects/upload-image', upload.single('image'), async (req, res) => {
  try {
    console.log("📤 Upload request received");
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    console.log("📁 File details:", {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });

    // Validate file
    if (!isValidImageType(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, WEBP, and GIF files are allowed'
      });
    }

    if (!isValidFileSize(req.file.size)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }

    // ✅ Generate clean public ID (no file extension, no special chars)
    const baseFilename = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const cleanBasename = baseFilename.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const publicId = `project_${cleanBasename}_${timestamp}_${randomString}`;
    
    console.log("🔑 Generated public ID:", publicId);
    
    // Upload to Cloudinary with corrected options
    const uploadResult = await uploadToCloudinary(req.file.path, {
      public_id: publicId, // ✅ Use underscore format as expected by Cloudinary
      folder: "portfolio/projects" // ✅ No trailing slash
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
    console.error('❌ Upload route error:', error);
    
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

// Test Cloudinary connection endpoint
app.get("/api/cloudinary/test", async (req, res) => {
  try {
    // Simple test upload with minimal parameters
    const testResult = await cloudinary.uploader.upload("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", {
      folder: "test",
      public_id: "test_image_" + Date.now()
    });
    
    // Clean up test image
    await cloudinary.uploader.destroy(testResult.public_id);
    
    res.json({
      success: true,
      message: "Cloudinary connection test successful",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Cloudinary connection test failed", 
      error: error.message
    });
  }
});

// Other routes...
app.use("/api/contact", contactroute);
app.use("/api/projects", projectroute);
app.use("/api/skills", skillroute);
app.use("/api", adminRoute);

// Serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
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

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Maximum size is 10MB"
    });
  }
  
  res.status(500).json({ 
    success: false, 
    message: "Server error"
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🖼️ Image upload: POST http://localhost:${PORT}/api/projects/upload-image`);
  console.log(`🧪 Cloudinary test: GET http://localhost:${PORT}/api/cloudinary/test`);
});
