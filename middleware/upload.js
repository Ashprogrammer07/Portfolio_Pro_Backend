const multer = require('multer');
const path = require('path');
const fs = require('fs');


const ensureUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/images');
    ensureUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});


const fileFilter = (req, file, cb) => {
  
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};


const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});


const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 5 files'
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message
    });
  } else if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  next();
};


const uploadSingle = upload.single('image');

const uploadMultiple = upload.array('images', 5);


const getFileUrl = (filename) => {
  return `${process.env.SERVER_URL || 'http://localhost:5000'}/uploads/images/${filename}`;
};


const deleteFile = (filename) => {
  const filePath = path.join(__dirname, '../uploads/images', filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  getFileUrl,
  deleteFile
};