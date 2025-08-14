const express = require('express');
const router = express.Router();
const {
  login,
  getProfile,
  updateProfile,
  changePassword,
  getDashboardStats,
  createInitialAdmin
} = require('../controller/admincontroller');
const { protect, adminonly } = require('../middleware/auth');
const { validateLogin, validateUser } = require('../middleware/validate');
const { body, validationResult } = require('express-validator');


router.post('/admin/login', login);
router.post('/createinitial', createInitialAdmin);
router.get('/profile/:id',getProfile); // Add protect
router.put('/profile', [/* validation */], updateProfile); // Add protect
router.put('/change-password',  [/* validation */], changePassword); // Add protect
router.get('/dashboard', adminonly, getDashboardStats); // Add protect



module.exports = router;