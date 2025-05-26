const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    budget: {
        type: Number,
        required: true
    },
    checkIn: {
        type: Date,
        required: true
    },
    checkOut: {
        type: Date,
        required: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    amenities: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    views: {
        type: Number,
        default: 0
    },
    replies: {
        type: Number,
        default: 0
    },
    posted: {
        type: Date,
        default: Date.now
    }
});

const Enquiry = mongoose.model('Enquiry', enquirySchema);

module.exports = Enquiry; 