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

// ✅ Load environment variables FIRST
dotenv.config({ path: "./config/config.env" });

// ✅ Debug environment variables (remove in production)
console.log("🔍 Environment Variables Check:");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "✅ Set" : "❌ Missing");
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? "✅ Set" : "❌ Missing");
console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? "✅ Set" : "❌ Missing");

// ✅ Configure Cloudinary with string values (not variables)
cloudinary.config({
  cloud_name: String(process.env.CLOUDINARY_CLOUD_NAME).trim(),
  api_key: String(process.env.CLOUDINARY_API_KEY).trim(),
  api_secret: String(process.env.CLOUDINARY_API_SECRET).trim(),
  secure: true
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

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (isValidImageType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// ✅ SIMPLIFIED Cloudinary upload function - minimal parameters to avoid signature issues
const uploadToCloudinary = async (filePath) => {
  try {
    console.log("🚀 Starting Cloudinary upload...");
    console.log("📁 File path:", filePath);
    
    // ✅ Use MINIMAL upload options to avoid signature generation issues
    const result = await cloudinary.uploader.upload(filePath, {
      // Only essential parameters - no custom transformations
      resource_type: "auto",
      folder: "portfolio" // Simplified folder name
    });
    
    console.log("✅ Upload successful:", result.public_id);
    
    // Clean up temp file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('Could not delete temp file:', e.message);
    }
    
    return {
      success: true,
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes
    };
    
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error);
    
    // Clean up temp file on error
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('Could not delete temp file after error:', e.message);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
};

// Connect to database
connectDB();

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

// ✅ TEST ENDPOINT - Verify Cloudinary credentials work
app.get('/api/cloudinary/test-credentials', async (req, res) => {
  try {
    console.log("🧪 Testing Cloudinary credentials...");
    
    // Test with a simple 1x1 pixel image
    const testImageData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    const result = await cloudinary.uploader.upload(testImageData, {
      public_id: "test_" + Date.now(),
      resource_type: "image"
    });
    
    // Delete the test image
    await cloudinary.uploader.destroy(result.public_id);
    
    res.json({
      success: true,
      message: "Cloudinary credentials are working!",
      cloudName: cloudinary.config().cloud_name,
      testPublicId: result.public_id
    });
    
  } catch (error) {
    console.error("❌ Credential test failed:", error);
    res.status(500).json({
      success: false,
      message: "Cloudinary credentials test failed",
      error: error.message,
      cloudName: cloudinary.config().cloud_name
    });
  }
});

// ✅ SIMPLIFIED UPLOAD ROUTE
app.post('/api/projects/upload-image', upload.single('image'), async (req, res) => {
  try {
    console.log("📤 Upload request received");
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    console.log("📁 File details:", {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Validate file
    if (!isValidImageType(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type'
      });
    }

    if (!isValidFileSize(req.file.size)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }

    // ✅ Use the simplified upload function
    const uploadResult = await uploadToCloudinary(req.file.path);

    if (uploadResult.success) {
      console.log(`✅ Upload successful: ${uploadResult.publicId}`);
      
      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          publicId: uploadResult.publicId,
          url: uploadResult.url,
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
    
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn('Could not delete temp file:', e.message);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during upload',
      error: error.message
    });
  }
});

// Other routes...
app.use("/api/contact", contactroute);
app.use("/api/projects", projectroute);
app.use("/api/skills", skillroute);
app.use("/api", adminRoute);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  res.status(500).json({ 
    success: false, 
    message: "Server error"
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🧪 Test credentials: GET http://localhost:${PORT}/api/cloudinary/test-credentials`);
  console.log(`🖼️ Upload image: POST http://localhost:${PORT}/api/projects/upload-image`);
});
