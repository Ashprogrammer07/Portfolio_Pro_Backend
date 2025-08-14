const jwt = require('jsonwebtoken');
const User = require('../models/User');


const adminonly = async (req, res, next) => {
  
  try {
    if (!req.body.user || !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    // Handle both "Admin" and "admin" cases
    const userRole = req.body.user.role.toLowerCase()|| req.user.role.toLowerCase();
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in admin authorization'
    });
  }
};


const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

module.exports = {
  adminonly,
  generateToken
};
