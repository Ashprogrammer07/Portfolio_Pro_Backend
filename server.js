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

// ✅ Load environment variables
dotenv.config({ path: "./config/config.env" });

// ✅ COMPLETE DIAGNOSTIC - Check your credentials
console.log("🔍 COMPLETE CREDENTIAL DIAGNOSTIC:");
console.log("Raw CLOUDINARY_CLOUD_NAME:", JSON.stringify(process.env.CLOUDINARY_CLOUD_NAME));
console.log("Raw CLOUDINARY_API_KEY:", JSON.stringify(process.env.CLOUDINARY_API_KEY));
console.log("Raw CLOUDINARY_API_SECRET:", JSON.stringify(process.env.CLOUDINARY_API_SECRET));

// ✅ Clean and configure Cloudinary
const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

console.log("Cleaned cloud_name:", cloudName);
console.log("Cleaned api_key:", apiKey);
console.log("Cleaned api_secret length:", apiSecret.length);

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true
});

// Connect to database
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ STEP 1: Test if your credentials are completely valid
app.get('/api/cloudinary/full-diagnostic', async (req, res) => {
  try {
    console.log("🩺 Running full Cloudinary diagnostic...");
    
    const config = cloudinary.config();
    
    // Check if all required fields are present
    const diagnostics = {
      configPresent: {
        cloud_name: !!config.cloud_name,
        api_key: !!config.api_key,
        api_secret: !!config.api_secret
      },
      configValues: {
        cloud_name: config.cloud_name,
        api_key: config.api_key,
        api_secret_length: config.api_secret ? config.api_secret.length : 0
      },
      envVarsRaw: {
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET_LENGTH: process.env.CLOUDINARY_API_SECRET ? process.env.CLOUDINARY_API_SECRET.length : 0
      }
    };
    
    // Test basic ping (doesn't require credentials)
    try {
      const pingResult = await cloudinary.api.ping();
      diagnostics.ping = { success: true, status: pingResult.status };
    } catch (pingError) {
      diagnostics.ping = { success: false, error: pingError.message };
    }
    
    // Test admin API call (requires valid credentials)
    try {
      const adminResult = await cloudinary.api.resources({ max_results: 1 });
      diagnostics.adminApi = { success: true, resourceCount: adminResult.resources.length };
    } catch (adminError) {
      diagnostics.adminApi = { success: false, error: adminError.message };
    }
    
    res.json({
      success: true,
      message: "Full diagnostic complete",
      diagnostics
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Diagnostic failed",
      error: error.message
    });
  }
});

// ✅ STEP 2: Simple credential test with manual signature generation
app.get('/api/cloudinary/manual-test', async (req, res) => {
  try {
    const crypto = require('crypto');
    
    // Generate timestamp
    const timestamp = Math.round(Date.now() / 1000);
    
    // Create parameters to sign (alphabetical order, no file/api_key/cloud_name)
    const paramsToSign = `timestamp=${timestamp}`;
    
    // Add API secret
    const stringToSign = paramsToSign + apiSecret;
    
    console.log("📝 Manual signature generation:");
    console.log("Params to sign:", paramsToSign);
    console.log("API Secret length:", apiSecret.length);
    console.log("String to sign:", stringToSign);
    
    // Generate signature
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');
    
    console.log("Generated signature:", signature);
    
    // Test with manual curl-like approach
    const testData = new FormData();
    testData.append('timestamp', timestamp.toString());
    testData.append('api_key', apiKey);
    testData.append('signature', signature);
    testData.append('file', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: testData
    });
    
    const result = await response.json();
    
    if (result.public_id) {
      // Clean up test image
      await cloudinary.uploader.destroy(result.public_id);
    }
    
    res.json({
      success: !result.error,
      message: result.error ? "Credential test failed" : "Credentials are working!",
      timestamp,
      signature,
      stringToSign,
      cloudinaryResponse: result
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Manual test failed",
      error: error.message
    });
  }
});

// ✅ STEP 3: Get NEW credentials from Cloudinary (this will tell you if credentials are wrong)
app.get('/api/cloudinary/verify-credentials', async (req, res) => {
  try {
    // This endpoint tests if your current credentials work at all
    const result = await cloudinary.api.resources({ max_results: 1 });
    
    res.json({
      success: true,
      message: "✅ Your Cloudinary credentials are VALID!",
      account: cloudName,
      resourceCount: result.resources.length
    });
    
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "❌ Your Cloudinary credentials are INVALID!",
      error: error.message,
      instructions: [
        "1. Go to https://console.cloudinary.com/",
        "2. Login to your account",
        "3. Go to Settings > API Keys", 
        "4. Copy your Cloud Name, API Key, and API Secret",
        "5. Update your config/config.env file",
        "6. Restart your server"
      ]
    });
  }
});

// Other routes...
app.use("/api/contact", contactroute);
app.use("/api/projects", projectroute);
app.use("/api/skills", skillroute);
app.use("/api", adminRoute);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🩺 Full diagnostic: GET http://localhost:${PORT}/api/cloudinary/full-diagnostic`);
  console.log(`🔑 Verify credentials: GET http://localhost:${PORT}/api/cloudinary/verify-credentials`);
  console.log(`🧪 Manual test: GET http://localhost:${PORT}/api/cloudinary/manual-test`);
});
