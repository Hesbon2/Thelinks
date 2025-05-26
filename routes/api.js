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

// Enquiry endpoints
router.post('/enquiries', auth, async (req, res) => {
    try {
        const enquiry = new Enquiry({
            ...req.body,
            userId: req.user._id
        });
        await enquiry.save();
        
        const populatedEnquiry = await Enquiry.findById(enquiry._id).populate('userId', 'name profilePic userType');
        res.status(201).json(populatedEnquiry);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/enquiries', async (req, res) => {
    try {
        let query = {};
        if (req.query.userId) {
            query.userId = req.query.userId;
        }
        
        const enquiries = await Enquiry.find(query)
            .populate('userId', 'name profilePic userType')
            .sort({ posted: -1 });
        res.json(enquiries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Property listing endpoints
router.post('/listings', auth, async (req, res) => {
    try {
        const listing = new PropertyListing({
            ...req.body,
            userId: req.user._id
        });
        await listing.save();
        
        const populatedListing = await PropertyListing.findById(listing._id).populate('userId', 'name profilePic userType');
        res.status(201).json(populatedListing);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/listings', async (req, res) => {
    try {
        let query = {};
        if (req.query.userId) {
            query.userId = req.query.userId;
        }
        
        const listings = await PropertyListing.find(query)
            .populate('userId', 'name profilePic userType')
            .sort({ posted: -1 });
        res.json(listings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bookmark endpoints
router.post('/bookmarks', auth, async (req, res) => {
    try {
        const { itemId, itemType } = req.body;
        const userId = req.user.id;

        let bookmark = await Bookmark.findOne({ userId, itemId });

        if (bookmark) {
            await Bookmark.findByIdAndDelete(bookmark._id);
            res.json({ bookmarked: false });
        } else {
            bookmark = new Bookmark({
                userId,
                itemId,
                itemType
            });
            await bookmark.save();
            res.json({ bookmarked: true });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle bookmark' });
    }
});

router.get('/bookmarks', auth, async (req, res) => {
    try {
        const bookmarks = await Bookmark.find({ userId: req.user.id })
            .populate({
                path: 'itemId',
                populate: {
                    path: 'userId',
                    select: 'name userType profilePic'
                }
            });

        const validBookmarks = bookmarks
            .filter(bookmark => bookmark.itemId)
            .map(bookmark => bookmark.itemId);

        res.json(validBookmarks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
});

router.get('/bookmarks/check/:itemId', auth, async (req, res) => {
    try {
        const bookmark = await Bookmark.findOne({
            userId: req.user.id,
            itemId: req.params.itemId
        });
        res.json({ bookmarked: !!bookmark });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check bookmark status' });
    }
});

// Updates endpoint for polling fallback
router.get('/updates', auth, async (req, res) => {
    try {
        const userId = req.user._id;
        const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 30000); // Last 30 seconds by default

        // Fetch recent messages
        const messages = await Message.find({
            timestamp: { $gt: since }
        })
        .populate('senderId', 'name profilePic userType')
        .populate('itemId', 'title userId');

        // Format updates
        const updates = messages.map(message => {
            const update = {
                type: message.parentMessageId ? 'new_reply' : 'new_message',
                data: message.toObject()
            };

            // Add additional context for replies
            if (message.parentMessageId) {
                update.data.itemTitle = message.itemId.title;
                update.data.itemUserId = message.itemId.userId;
            }

            return update;
        });

        res.json(updates);
    } catch (error) {
        console.error('Error fetching updates:', error);
        res.status(500).json({ error: 'Failed to fetch updates' });
    }
});

// Export the router
module.exports = router; 