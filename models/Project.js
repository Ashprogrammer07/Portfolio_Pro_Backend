const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    description: {
        type: String,
        required: true
    },
    
    // Add these missing fields for frontend compatibility
    shortDescription: {
        type: String,
        required: false
    },
    category: {
        type: String,
        required: false,
        default: 'Web Development'
    },
    image: {
        type: String, // Single main image
        required: false
    },
    featured: {
        type: Boolean,
        default: false
    },
    
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Completed'],
        default: 'Not Started'
    },
    technologies: [{
        type: String,
        required: true
    }],
    
    // Update field names to match frontend
    githubUrl: { // was githubLink
        type: String,
        required: true
    },
    liveUrl: { // was liveLink  
        type: String,
        required: true
    },
    
    // Keep existing fields but make them optional
    images: [{ type: String }], // Multiple images (optional)
    images_url: [{ type: String }], // Image URLs (optional)
    challenges: [{ type: String }], // Project challenges (optional)
    
    // Add timestamps
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model("Project", ProjectSchema);
