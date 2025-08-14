const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Skill name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Skill category is required'],
    trim: true
  },
  level: {
    type: Number,
    required: [true, 'Skill level is required'],
    min: [1, 'Skill level must be at least 1'],
    max: [100, 'Skill level cannot exceed 100']
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  yearsOfExperience: {
    type: Number,
    min: 0,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

skillSchema.index({ category: 1, level: -1 });
skillSchema.index({ name: 1 });

module.exports = mongoose.model('Skill', skillSchema);
