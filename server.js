const connectDB = require("./config/db");
const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");

// Import Cloudinary v2
const cloudinary = require("cloudinary").v2;

const contactroute = require("./routes/Contactroute");
const projectroute = require("./routes/projectroutes");
const skillroute = require("./routes/skillsRoutes");
const adminRoute = require("./routes/adminroute");

// Load environment variables first
dotenv.config({ path: "./config/config.env" });

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Use HTTPS
  upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || undefined, // Optional
});

// Verify Cloudinary configuration
const verifyCloudinaryConfig = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  
  if (!cloud_name || !api_key || !api_secret) {
    console.error("⚠️ Cloudinary configuration incomplete!");
    console.error("Missing:", {
      cloud_name: !cloud_name ? "CLOUDINARY_CLOUD_NAME" : "✓",
      api_key: !api_key ? "CLOUDINARY_API_KEY" : "✓",
      api_secret: !api_secret ? "CLOUDINARY_API_SECRET" : "✓"
    });
    return false;
  }
  
  console.log("✅ Cloudinary configured successfully");
  console.log(`Cloud Name: ${cloud_name}`);
  return true;
};

// Cloudinary utility functions
const cloudinaryUtils = {
  // Upload single image
  uploadImage: async (filePath, options = {}) => {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: options.folder || "portfolio/uploads",
        public_id: options.publicId,
        resource_type: "image",
        format: options.format || "auto",
        quality: options.quality || "auto",
        transformation: options.transformation || [
          { width: 1200, height: 800, crop: "limit" },
          { fetch_format: "auto", quality: "auto" }
        ],
        ...options
      });
      
      return {
        success: true,
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        version: result.version
      };
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Upload multiple images
  uploadMultipleImages: async (filePaths, options = {}) => {
    const results = [];
    
    for (const filePath of filePaths) {
      const result = await cloudinaryUtils.uploadImage(filePath, options);
      results.push(result);
    }
    
    return results;
  },

  // Delete image by public ID
  deleteImage: async (publicId) => {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return {
        success: result.result === "ok",
        result: result.result,
        publicId
      };
    } catch (error) {
      console.error("Cloudinary delete error:", error);
      return {
        success: false,
        error: error.message,
        publicId
      };
    }
  },

  // Delete multiple images
  deleteMultipleImages: async (publicIds) => {
    try {
      const result = await cloudinary.api.delete_resources(publicIds);
      return {
        success: true,
        deleted: result.deleted,
        partial: result.partial || {},
        count: Object.keys(result.deleted).length
      };
    } catch (error) {
      console.error("Cloudinary batch delete error:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Generate thumbnail URL
  generateThumbnail: (publicId, options = {}) => {
    return cloudinary.url(publicId, {
      width: options.width || 200,
      height: options.height || 200,
      crop: options.crop || "fill",
      gravity: options.gravity || "face",
      format: "auto",
      quality: "auto",
      secure: true,
      ...options
    });
  },

  // Generate responsive URLs
  generateResponsiveUrls: (publicId) => {
    const sizes = {
      thumbnail: { width: 200, height: 200 },
      small: { width: 400, height: 300 },
      medium: { width: 800, height: 600 },
      large: { width: 1200, height: 900 },
      xlarge: { width: 1600, height: 1200 }
    };

    const urls = {};
    Object.entries(sizes).forEach(([size, dimensions]) => {
      urls[size] = cloudinary.url(publicId, {
        ...dimensions,
        crop: "fit",
        format: "auto",
        quality: "auto",
        secure: true
      });
    });

    return urls;
  },

  // Get image details
  getImageDetails: async (publicId) => {
    try {
      const result = await cloudinary.api.resource(publicId);
      return {
        success: true,
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        created: result.created_at,
        folder: result.folder
      };
    } catch (error) {
      console.error("Cloudinary get details error:", error);
      return {
        success: false,
        error: error.message,
        publicId
      };
    }
  },

  // Upload from buffer (useful for direct uploads)
  uploadFromBuffer: (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || "portfolio/uploads",
          resource_type: "image",
          format: options.format || "auto",
          quality: options.quality || "auto",
          public_id: options.publicId,
          transformation: options.transformation || [
            { width: 1200, height: 800, crop: "limit" },
            { fetch_format: "auto", quality: "auto" }
          ],
          ...options
        },
        (error, result) => {
          if (error) {
            reject({
              success: false,
              error: error.message
            });
          } else {
            resolve({
              success: true,
              publicId: result.public_id,
              url: result.secure_url,
              width: result.width,
              height: result.height,
              format: result.format,
              size: result.bytes,
              version: result.version
            });
          }
        }
      );

      uploadStream.end(buffer);
    });
  },

  // Clean up old images (requires folder structure)
  cleanupOldImages: async (folder = "portfolio/uploads", daysOld = 30) => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const resources = await cloudinary.api.resources({
        type: "upload",
        prefix: folder,
        max_results: 500
      });
      
      const oldImages = resources.resources.filter(resource => {
        const createdDate = new Date(resource.created_at);
        return createdDate < cutoffDate;
      });
      
      if (oldImages.length > 0) {
        const publicIds = oldImages.map(img => img.public_id);
        const deleteResult = await cloudinaryUtils.deleteMultipleImages(publicIds);
        
        console.log(`Cleaned up ${deleteResult.count || 0} old images from ${folder}`);
        return deleteResult;
      }
      
      return { success: true, count: 0, message: "No old images to clean up" };
    } catch (error) {
      console.error("Cleanup error:", error);
      return { success: false, error: error.message };
    }
  }
};

// Connect to database
connectDB();

// Verify Cloudinary configuration
verifyCloudinaryConfig();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create temp directory for uploads if it doesn't exist
const createTempDir = () => {
  const tempDir = path.join(__dirname, "temp", "uploads");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log("✅ Created temp upload directory");
  }
};

createTempDir();

// Make Cloudinary utils available globally
app.locals.cloudinary = cloudinary;
app.locals.cloudinaryUtils = cloudinaryUtils;

// API routes
app.use("/api/contact", contactroute);
app.use("/api/projects", projectroute);
app.use("/api/skills", skillroute);
app.use("/api", adminRoute);

// Serve uploads folder (for backward compatibility)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Cloudinary health check endpoint
app.get("/api/cloudinary/health", async (req, res) => {
  try {
    const { cloud_name, api_key } = cloudinary.config();
    
    if (!cloud_name || !api_key) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary not configured properly"
      });
    }

    // Test connection with a simple API call
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

// Cloudinary utility endpoints
app.get("/api/cloudinary/config", (req, res) => {
  const { cloud_name } = cloudinary.config();
  res.json({
    cloudName: cloud_name,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFormats: ["jpg", "jpeg", "png", "webp", "gif"],
    folders: {
      projects: "portfolio/projects",
      uploads: "portfolio/uploads",
      thumbnails: "portfolio/thumbnails"
    }
  });
});

// General health check API
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

// SPA fallback for React Router
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return next(); // Don't send index.html for API or uploads
  }
  // Add your React build serving logic here if needed
});

// Global error handler with Cloudinary support
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  
  // Handle Cloudinary-specific errors
  if (err.error && err.error.http_code) {
    return res.status(err.error.http_code).json({
      success: false,
      message: "Cloudinary error",
      error: err.error.message
    });
  }
  
  // Handle multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Maximum size is 10MB"
    });
  }
  
  // Handle Cloudinary upload errors
  if (err.message && err.message.includes("Invalid image file")) {
    return res.status(400).json({
      success: false,
      message: "Invalid image format"
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
});

// Export cloudinary utils for use in other files
module.exports = { app, cloudinary, cloudinaryUtils };
