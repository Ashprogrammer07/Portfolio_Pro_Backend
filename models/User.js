const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email address'
        ],
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false, // Don't include password in queries by default
    },
    role: {
        type: String,
        enum: ['User', 'Admin'],
        default: 'User',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    profileImage: {
        type: String,
        default: null,
    },
    resetPasswordToken: {
        type: String,
        default: null,
    },
    resetPasswordExpires: {
        type: Date,
        default: null,
    },
    emailVerificationToken: {
        type: String,
        default: null,
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    lastLogin: {
        type: Date,
        default: Date.now,
    },
    loginAttempts: {
        type: Number,
        default: 0,
    },
    lockUntil: {
        type: Date,
        default: null,
    },
});

// Indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with cost of 12
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware to update lastModified
UserSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedAt = Date.now();
    }
    next();
});

// Instance method to check password
UserSchema.methods.matchPassword = async function(enteredPassword) {
    try {
        return await bcrypt.compare(enteredPassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Instance method to update last login
UserSchema.methods.updateLastLogin = async function() {
    this.lastLogin = new Date();
    this.loginAttempts = 0; // Reset login attempts on successful login
    this.lockUntil = null; // Remove account lock on successful login
    return await this.save();
};

// Instance method to increment login attempts
UserSchema.methods.incLoginAttempts = async function() {
    const maxAttempts = 5;
    const lockTime = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return await this.updateOne({
            $unset: { lockUntil: 1 },
            $set: { loginAttempts: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    
    // If we hit max attempts and it's not locked yet, lock the account
    if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + lockTime };
    }
    
    return await this.updateOne(updates);
};

// Instance method to check if user is admin
UserSchema.methods.isAdmin = function() {
    return this.role === 'Admin';
};

// Instance method to get public profile (without sensitive data)
UserSchema.methods.getPublicProfile = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.resetPasswordToken;
    delete userObject.resetPasswordExpires;
    delete userObject.emailVerificationToken;
    delete userObject.loginAttempts;
    delete userObject.lockUntil;
    return userObject;
};

// Static method to find user by email (including password)
UserSchema.statics.findByCredentials = async function(email, password) {
    const user = await this.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
    }).select('+password');
    
    if (!user) {
        throw new Error('Invalid login credentials');
    }
    
    // Check if account is locked
    if (user.isLocked) {
        await user.incLoginAttempts();
        throw new Error('Account temporarily locked due to too many failed login attempts');
    }
    
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        await user.incLoginAttempts();
        throw new Error('Invalid login credentials');
    }
    
    // Update last login on successful authentication
    await user.updateLastLogin();
    return user;
};

// Static method to create admin user
UserSchema.statics.createAdmin = async function(adminData) {
    const { name, email, password } = adminData;
    
    // Check if admin already exists
    const existingAdmin = await this.findOne({ 
        $or: [
            { email: email.toLowerCase() },
            { role: 'Admin' }
        ]
    });
    
    if (existingAdmin) {
        throw new Error('Admin user already exists');
    }
    
    // Create admin user
    const admin = new this({
        name,
        email: email.toLowerCase(),
        password,
        role: 'Admin',
        isEmailVerified: true, // Auto-verify admin email
        isActive: true
    });
    
    return await admin.save();
};

// Static method to get user statistics
UserSchema.statics.getUserStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: {
                    $sum: {
                        $cond: [{ $eq: ['$isActive', true] }, 1, 0]
                    }
                },
                adminUsers: {
                    $sum: {
                        $cond: [{ $eq: ['$role', 'Admin'] }, 1, 0]
                    }
                },
                verifiedUsers: {
                    $sum: {
                        $cond: [{ $eq: ['$isEmailVerified', true] }, 1, 0]
                    }
                }
            }
        }
    ]);
    
    return stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        verifiedUsers: 0
    };
};

// Static method to find active admins
UserSchema.statics.findActiveAdmins = async function() {
    return await this.find({
        role: 'Admin',
        isActive: true
    }).select('-password -resetPasswordToken -emailVerificationToken');
};

// Static method to deactivate user
UserSchema.statics.deactivateUser = async function(userId) {
    return await this.findByIdAndUpdate(
        userId,
        { 
            isActive: false,
            lockUntil: null,
            loginAttempts: 0
        },
        { new: true }
    );
};

// Static method to activate user
UserSchema.statics.activateUser = async function(userId) {
    return await this.findByIdAndUpdate(
        userId,
        { 
            isActive: true,
            lockUntil: null,
            loginAttempts: 0
        },
        { new: true }
    );
};

// Static method to unlock user account
UserSchema.statics.unlockAccount = async function(userId) {
    return await this.findByIdAndUpdate(
        userId,
        {
            $unset: { lockUntil: 1 },
            $set: { loginAttempts: 0 }
        },
        { new: true }
    );
};

// Transform JSON output (remove sensitive fields by default)
UserSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.resetPasswordToken;
    delete user.resetPasswordExpires;
    delete user.emailVerificationToken;
    delete user.loginAttempts;
    delete user.lockUntil;
    return user;
};

module.exports = mongoose.model("User", UserSchema);
