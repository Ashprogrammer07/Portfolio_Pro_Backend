const connectDB = require("./config/db");
const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const multer = require("multer");

// Import Cloudinary v2
const cloudinary = require("cloudinary").v2;

const contactroute = require("./routes/Contactroute");
const projectroute = require("./routes/projectroutes");
const skillroute = require("./routes/skillsRoutes");
const adminRoute = require("./routes/adminroute");

// Load environment variables
dotenv.config({ path: "./config/config.env" });

// ✅ Configure Cloudinary (only cloud_name needed for unsigned uploads)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,    // Optional for unsigned uploads
  api_secret: process.env.CLOUDINARY_API_SECRET, // Optional for unsigned uploads
  secure: true
});

// Import existing utility functions
const { 
  generateUniqueFilename,
  isValidImageType,
  isValidFileSize
} = require('./utils/uploadImage');

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Configure multer for memory storage (perfect for Render)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    console.log("📁 File received:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    if (isValidImageType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF files are allowed'), false);
    }
  }
});

// ✅ CORRECTED: Use unsigned_upload method (no signature needed)
const uploadToCloudinary = async (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starting UNSIGNED Cloudinary upload...");
    
    // Generate clean public ID (optional for unsigned uploads)
    const baseFilename = path.basename(originalname, path.extname(originalname));
    const cleanBasename = baseFilename.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 6);
    const publicId = `${cleanBasename}_${timestamp}_${randomString}`;
    
    // ✅ Use unsigned_upload method instead of upload
    cloudinary.uploader.unsigned_upload_stream(
      "portfolio_upload", // Your unsigned upload preset name
      {
        // ✅ Minimal options for unsigned upload
        public_id: publicId, // Optional
        resource_type: "auto",
        // Don't specify folder here if it's set in the upload preset
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary unsigned upload error:", error);
          resolve({
            success: false,
            error: error.message
          });
        } else {
          console.log("✅ Unsigned upload successful:", result.public_id);
          resolve({
            success: true,
            publicId: result.public_id,
            url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.bytes,
            version: result.version,
            thumbnailUrl: cloudinary.url(result.public_id, {
              width: 200,
              height: 200,
              crop: "fill",
              gravity: "center",
              format: "auto",
              quality: "auto",
              secure: true
            })
          });
        }
      }
    ).end(buffer); // Send buffer to stream
  });
};

// ✅ CORRECTED UPLOAD ROUTE - Using unsigned upload
app.post('/api/projects/upload-image', upload.single('image'), async (req, res) => {
  try {
    console.log("📤 Unsigned upload request received");
    
    if (!req.file) {
      console.log("❌ No file received");
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    console.log("📁 File details:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferLength: req.file.buffer.length
    });

    // Validate file
    if (!isValidImageType(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, WEBP, and GIF files are allowed'
      });
    }

    if (!isValidFileSize(req.file.size)) {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }

    // ✅ Upload using unsigned method
    const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    if (uploadResult.success) {
      console.log(`✅ Unsigned upload successful: ${uploadResult.publicId}`);
      
      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully via unsigned upload',
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
      console.error(`❌ Unsigned upload failed: ${uploadResult.error}`);
      
      res.status(500).json({
        success: false,
        message: 'Failed to upload image via unsigned upload',
        error: uploadResult.error
      });
    }

  } catch (error) {
    console.error('❌ Upload route error:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error during unsigned upload',
      error: error.message
    });
  }
});

// ✅ Alternative: Direct buffer upload without stream
app.post('/api/projects/upload-image-direct', upload.single('image'), async (req, res) => {
  try {
    console.log("📤 Direct unsigned upload request");
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    // ✅ Use unsigned_upload with buffer directly
    const result = await cloudinary.uploader.unsigned_upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
      "portfolio_upload", // Your unsigned upload preset
      {
        resource_type: "auto"
        // Don't add public_id or other signed-upload parameters
      }
    );

    console.log("✅ Direct unsigned upload successful:", result.public_id);

    res.status(200).json({
      success: true,
      message: 'Direct unsigned upload successful',
      data: {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        filename: req.file.originalname
      }
    });

  } catch (error) {
    console.error('❌ Direct upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Direct unsigned upload failed',
      error: error.message
    });
  }
});

// ✅ Test endpoint to verify your upload preset works
app.get('/api/test-unsigned-upload', async (req, res) => {
  try {
    console.log("🧪 Testing unsigned upload with tiny image...");
    
    // Test with a tiny 1x1 pixel image
    const tinyImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    const result = await cloudinary.uploader.unsigned_upload(
      tinyImageBase64,
      "portfolio_upload" // Your unsigned upload preset
    );
    
    // Clean up test image
    await cloudinary.uploader.destroy(result.public_id);
    
    res.json({
      success: true,
      message: "✅ Unsigned upload preset is working!",
      testPublicId: result.public_id,
      uploadPreset: "portfolio_upload"
    });
    
  } catch (error) {
    console.error("❌ Test upload failed:", error);
    res.status(500).json({
      success: false,
      message: "❌ Unsigned upload test failed",
      error: error.message,
      instructions: [
        "1. Go to https://console.cloudinary.com/",
        "2. Navigate to Settings > Upload > Upload presets",
        "3. Create a new preset named 'portfolio_upload'",
        "4. Set 'Signing mode' to 'Unsigned'",
        "5. Save the preset and try again"
      ]
    });
  }
});

// Other routes
app.use("/api/contact", contactroute);
app.use("/api/projects", projectroute);
app.use("/api/skills", skillroute);
app.use("/api", adminRoute);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server running with unsigned Cloudinary uploads",
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error Handler:", err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB"
      });
    }
  }
  
  res.status(500).json({ 
    success: false, 
    message: "Server error",
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} with unsigned uploads`);
  console.log(`🧪 Test unsigned upload: GET /api/test-unsigned-upload`);
  console.log(`🖼️ Upload endpoint: POST /api/projects/upload-image`);
  console.log(`⚡ Direct upload: POST /api/projects/upload-image-direct`);
});
