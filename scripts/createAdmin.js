const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Adjust path based on your structure
require('dotenv').config();

// Admin creation function
const createAdminAccount = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@portfolio.com' });
    
    if (existingAdmin) {
      console.log('Admin account already exists');
      return;
    }

    // Hash the admin password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Create admin user
    const adminUser = new User({
      name: 'Portfolio Admin',
      email: 'admin@portfolio.com',
      password: hashedPassword,
      role: 'Admin', // Match your User model enum
      createdAt: new Date(),
      lastLogin: new Date()
    });

    await adminUser.save();
    console.log('✅ Admin account created successfully!');
    console.log('📧 Email: admin@portfolio.com');
    console.log('🔑 Password: admin123');
    console.log('⚠️  Please change the password after first login');

  } catch (error) {
    console.error('❌ Error creating admin account:', error.message);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Export the function
module.exports = createAdminAccount;

// If running directly, execute the function
if (require.main === module) {
  createAdminAccount();
}
