const Contact = require('../models/Contact');
const { sendContactEmail, sendAutoReply } = require('../utils/sendEmail');
const { validationResult } = require('express-validator'); // Optional: for validation

const submitContact = async (req, res) => {
  try {
    // Basic validation
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, subject, and message'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Create contact with additional metadata
    const contactData = {
      ...req.body,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      submittedAt: new Date()
    };

    const contact = await Contact.create(contactData);

    // Send emails (use Promise.allSettled to handle partial failures)
    const emailPromises = [
      sendContactEmail(contact),
      sendAutoReply(contact)
    ];

    const emailResults = await Promise.allSettled(emailPromises);
    
    // Log email sending results
    emailResults.forEach((result, index) => {
      const emailType = index === 0 ? 'notification' : 'auto-reply';
      if (result.status === 'rejected') {
        console.error(`Failed to send ${emailType} email:`, result.reason);
      }
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your message! I\'ll get back to you soon.',
      data: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        submittedAt: contact.createdAt
      }
    });
  } catch (error) {
    console.error('Submit contact error:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.'
    });
  }
};

const getContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      isRead,
      isReplied,
      priority,
      projectType,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page

    let query = {};

    // Build query filters
    if (isRead !== undefined) query.isRead = isRead === 'true';
    if (isReplied !== undefined) query.isReplied = isReplied === 'true';
    if (priority) query.priority = priority;
    if (projectType) query.projectType = projectType;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const contacts = await Contact.find(query)
      .sort(sortObj)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .select('-__v'); // Exclude version field

    const total = await Contact.countDocuments(query);

    res.status(200).json({
      success: true,
      count: contacts.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      hasNextPage: pageNum < Math.ceil(total / limitNum),
      hasPrevPage: pageNum > 1,
      data: contacts
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts'
    });
  }
};

const getContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).select('-__v');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Mark as read if not already read
    let wasUpdated = false;
    if (!contact.isRead) {
      contact.isRead = true;
      contact.readAt = new Date();
      await contact.save();
      wasUpdated = true;
    }

    res.status(200).json({
      success: true,
      data: contact,
      meta: {
        wasMarkedAsRead: wasUpdated
      }
    });
  } catch (error) {
    console.error('Get contact error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact'
    });
  }
};

const updateContact = async (req, res) => {
  try {
    const allowedFields = ['isRead', 'isReplied', 'priority', 'notes', 'tags'];
    const updates = {};

    // Filter allowed fields and add timestamps
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Add timestamps for status changes
    if (updates.isRead === true && req.body.isRead !== undefined) {
      updates.readAt = new Date();
    }
    if (updates.isReplied === true && req.body.isReplied !== undefined) {
      updates.repliedAt = new Date();
    }

    updates.updatedAt = new Date();

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    ).select('-__v');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact updated successfully',
      data: contact
    });
  } catch (error) {
    console.error('Update contact error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update contact'
    });
  }
};

const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully',
      data: {
        deletedId: req.params.id,
        deletedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete contact'
    });
  }
};

// Bulk operations
const bulkUpdateContacts = async (req, res) => {
  try {
    const { contactIds, updates } = req.body;
    
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of contact IDs'
      });
    }

    const allowedFields = ['isRead', 'isReplied', 'priority', 'tags'];
    const filteredUpdates = {};
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    });

    filteredUpdates.updatedAt = new Date();

    const result = await Contact.updateMany(
      { _id: { $in: contactIds } },
      filteredUpdates
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} contacts updated successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Bulk update contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contacts'
    });
  }
};

const getContactStats = async (req, res) => {
  try {
    // Basic counts
    const totalContacts = await Contact.countDocuments();
    const unreadContacts = await Contact.countDocuments({ isRead: false });
    const unrepliedContacts = await Contact.countDocuments({ isReplied: false });
    
    // Priority stats
    const priorityStats = await Contact.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Project type stats
    const contactsByType = await Contact.aggregate([
      {
        $group: {
          _id: '$projectType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Time-based stats
    const now = new Date();
    const timeRanges = {
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      quarter: new Date(now.getFullYear(), now.getMonth() - 3, 1)
    };

    const timeStats = {};
    for (const [period, date] of Object.entries(timeRanges)) {
      timeStats[period] = await Contact.countDocuments({
        createdAt: { $gte: date }
      });
    }

    // Response time stats (average time to reply)
    const avgResponseTime = await Contact.aggregate([
      {
        $match: {
          isReplied: true,
          repliedAt: { $exists: true }
        }
      },
      {
        $project: {
          responseTime: {
            $subtract: ['$repliedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalContacts,
        unreadContacts,
        unrepliedContacts,
        priorityStats,
        contactsByType,
        timeStats,
        avgResponseTimeHours: avgResponseTime[0] 
          ? Math.round(avgResponseTime[0].avgResponseTime / (1000 * 60 * 60)) 
          : null,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact statistics'
    });
  }
};

module.exports = {
  submitContact,
  getContacts,
  getContact,
  updateContact,
  deleteContact,
  bulkUpdateContacts,
  getContactStats
};
