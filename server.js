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

// ✅ Configure Cloudinary (ONLY cloud_name needed for unsigned uploads)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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
app.use(cors({
  origin: ["http://localhost:3000", "https://yourapp.render.com"], // Add your Render URL
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Configure multer for memory storage (perfect for Render)
const storage = multer.memoryStorage(); // Files stored in memory, not disk

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

// ✅ Cloudinary upload function using buffer (perfect for Render)
const uploadToCloudinary = async (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starting Cloudinary upload from buffer...");
    
    // Generate clean public ID
    const baseFilename = path.basename(originalname, path.extname(originalname));
    const cleanBasename = baseFilename.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 6);
    const publicId = `${cleanBasename}_${timestamp}_${randomString}`;
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        // ✅ Use your unsigned upload preset name
        upload_preset: "portfolio_upload", // Replace with your preset name
        public_id: publicId,
        resource_type: "image",
        // Don't specify folder here if it's in the preset
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary upload error:", error);
          resolve({
            success: false,
            error: error.message
          });
        } else {
          console.log("✅ Upload successful:", result.public_id);
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
    );

    // Send the buffer to Cloudinary
    uploadStream.end(buffer);
  });
};

// ✅ WORKING CLOUDINARY UPLOAD ROUTE FOR RENDER
app.post('/api/projects/upload-image', upload.single('image'), async (req, res) => {
  try {
    console.log("📤 Upload request received on Render");
    
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

    // Upload to Cloudinary using buffer
    const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    if (uploadResult.success) {
      console.log(`✅ Upload successful: ${uploadResult.publicId}`);
      
      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully to Cloudinary',
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

    res.status(500).json({
      success: false,
      message: 'Internal server error during upload',
      error: error.message
    });
  }
});

// ✅ Alternative: Direct frontend upload endpoint (returns signature for frontend)
app.post('/api/projects/get-signature', (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    
    // For unsigned uploads, you don't need signature
    // Just return the upload configuration
    res.json({
      success: true,
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        uploadPreset: "portfolio_upload", // Your unsigned preset name
        timestamp: timestamp,
        // No signature needed for unsigned uploads
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate upload configuration',
      error: error.message
    });
  }
});

// ✅ Delete image from Cloudinary
app.delete('/api/projects/delete-image/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Image not found or already deleted'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message
    });
  }
});

// ✅ Health check endpoint
app.get('/api/cloudinary/health', async (req, res) => {
  try {
    // Test if Cloudinary config is working
    const config = cloudinary.config();
    
    res.json({
      success: true,
      message: "Cloudinary configured for Render deployment",
      cloudName: config.cloud_name,
      hasApiKey: !!config.api_key,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Cloudinary health check failed",
      error: error.message
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
    message: "Server is running on Render",
    environment: process.env.NODE_ENV || 'development',
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
    message: "Server error on Render",
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on Render port ${PORT}`);
  console.log(`☁️ Cloudinary health: /api/cloudinary/health`);
  console.log(`🖼️ Upload endpoint: POST /api/projects/upload-image`);
});
