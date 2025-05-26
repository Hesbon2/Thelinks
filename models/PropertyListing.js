const mongoose = require('mongoose');

const propertyListingSchema = new mongoose.Schema({
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
    propertyType: {
        type: String,
        required: true,
        enum: ['Studio', '1 bedroom', '2 bedrooms', '3 bedrooms', '4+ bedrooms', 'Villa', 'Penthouse']
    },
    price: {
        type: Number,
        required: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    availableFrom: {
        type: Date,
        required: true
    },
    availableTo: {
        type: Date,
        required: true
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

const PropertyListing = mongoose.model('PropertyListing', propertyListingSchema);

module.exports = PropertyListing; 