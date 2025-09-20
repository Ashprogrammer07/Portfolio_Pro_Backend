const connectDB = require("./config/db");
const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

const contactroute = require("./routes/Contactroute");
const projectroute = require("./routes/projectroutes");
const skillroute = require("./routes/skillsRoutes");
const adminRoute = require("./routes/adminroute");

dotenv.config({ path: "./config/config.env" });
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/contact", contactroute);
app.use("/api/projects", projectroute);
app.use("/api/skills", skillroute);
app.use("/api", adminRoute);

// Serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Serve React build folder first


// Health check API
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// ✅ SPA fallback for React Router (regex safe for Express 5)
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return next(); // Don't send index.html for API or uploads
  }
  
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Maximum size is 5MB"
    });
  }
  res.status(500).json({ success: false, message: "Server error" });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
