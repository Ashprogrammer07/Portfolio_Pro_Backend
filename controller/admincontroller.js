const User = require('../models/User');
const Project = require('../models/Project');
const Contact = require('../models/Contact');
const { generateToken } = require('../middleware/auth');
const login = async (req, res) => {
  try {
    const { email, password } = req.body;


    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }


    user.lastLogin = new Date();
    await user.save();





const token = generateToken(user._id);


    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};


const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};


const updateProfile = async (req, res) => {
  try {
    const allowedFields = ['name', 'email'];
    const updates = {};


    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update profile error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};


const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};


const getDashboardStats = async (req, res) => {
  try {

    const totalProjects = await Project.countDocuments();
    const featuredProjects = await Project.countDocuments({ featured: true });
    const totalContacts = await Contact.countDocuments();
    const unreadContacts = await Contact.countDocuments({ isRead: false });


    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentProjects = await Project.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });


    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentContacts = await Contact.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });


    const projectsByCategory = await Project.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const contactsByPriority = await Contact.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);


    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const contactTrends = await Contact.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProjects,
          featuredProjects,
          totalContacts,
          unreadContacts,
          recentProjects,
          recentContacts
        },
        projectsByCategory,
        contactsByPriority,
        contactTrends
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

const createInitialAdmin = async (req, res) => {
  try {

    const existingAdmin = await User.findOne({ role: 'Admin' });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin user already exists'
      });
    }

    const { name, email, password } = req.body;


    const user = await User.create({
      name,
      email,
      password,
      role: 'Admin'
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Initial admin user created successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Create initial admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create admin user'
    });
  }
};

module.exports = {
  login,
  getProfile,
  updateProfile,
  changePassword,
  getDashboardStats,
  createInitialAdmin
};