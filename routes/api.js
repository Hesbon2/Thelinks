const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const PropertyListing = require('../models/PropertyListing');
const Message = require('../models/Message');
const Bookmark = require('../models/Bookmark');

// Authentication middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId });
        
        if (!user) {
            throw new Error();
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate.' });
    }
};

// Register endpoint
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, userType, phone, whatsapp } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const user = new User({
            name,
            email,
            password,
            userType,
            phone,
            whatsapp
        });

        await user.save();
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                userType: user.userType,
                profilePic: user.profilePic,
                phone: user.phone,
                whatsapp: user.whatsapp
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                userType: user.userType,
                profilePic: user.profilePic,
                phone: user.phone,
                whatsapp: user.whatsapp
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get current user
router.get('/user', auth, async (req, res) => {
    res.json({
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            userType: req.user.userType,
            profilePic: req.user.profilePic,
            phone: req.user.phone,
            whatsapp: req.user.whatsapp
        }
    });
});

// Export the router
module.exports = router; 