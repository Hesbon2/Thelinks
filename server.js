const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const path = require('path');
const WebSocketServer = require('./websocket');
const webpush = require('web-push');
require('dotenv').config();
const User = require('./models/User');
const Enquiry = require('./models/Enquiry');
const PropertyListing = require('./models/PropertyListing');
const config = require('./config');

// Configure web push
const vapidKeys = webpush.generateVAPIDKeys();
webpush.setVapidDetails(
    'mailto:hesbonmakori15@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Store this somewhere safe and use it in your client-side code
console.log('VAPID Public Key:', vapidKeys.publicKey);

const app = express();

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://thelinks-gray.vercel.app', 'https://thelinks.vercel.app']
        : 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve service worker at the root path
app.get('/service-worker.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
});

// Serve index.html for all routes (SPA support)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer(server);

// Store WebSocket server instance globally
app.set('wss', wss);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Models
const Message = require('./models/Message');
const Bookmark = require('./models/Bookmark');

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
        res.status(401).send({ error: 'Please authenticate.' });
    }
};

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, userType, phone, whatsapp } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user
        const user = new User({
            name,
            email,
            password,
            userType,
            phone,
            whatsapp
        });

        await user.save();

        // Generate JWT token
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
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
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
app.get('/api/user', auth, async (req, res) => {
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
app.post('/api/enquiries', auth, async (req, res) => {
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

app.get('/api/enquiries', async (req, res) => {
    try {
        let query = {};
        
        // If userId is provided, filter by user
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
app.post('/api/listings', auth, async (req, res) => {
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

app.get('/api/listings', async (req, res) => {
    try {
        let query = {};
        
        // If userId is provided, filter by user
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

// Update views count
app.patch('/api/enquiries/:id/views', async (req, res) => {
    try {
        const enquiry = await Enquiry.findByIdAndUpdate(
            req.params.id,
            { $inc: { views: 1 } },
            { new: true }
        );
        res.json(enquiry);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.patch('/api/listings/:id/views', async (req, res) => {
    try {
        const listing = await PropertyListing.findByIdAndUpdate(
            req.params.id,
            { $inc: { views: 1 } },
            { new: true }
        );
        res.json(listing);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update replies count
app.patch('/api/enquiries/:id/replies', async (req, res) => {
    try {
        const enquiry = await Enquiry.findByIdAndUpdate(
            req.params.id,
            { $inc: { replies: 1 } },
            { new: true }
        );
        res.json(enquiry);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.patch('/api/listings/:id/replies', async (req, res) => {
    try {
        const listing = await PropertyListing.findByIdAndUpdate(
            req.params.id,
            { $inc: { replies: 1 } },
            { new: true }
        );
        res.json(listing);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Message Routes
app.get('/api/messages/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;

        // Get all top-level messages (no parent) for this item
        const messages = await Message.find({
            itemId,
            parentMessageId: null
        })
        .sort({ timestamp: 1 })
        .populate('senderId', 'name profilePic userType')
        .populate({
            path: 'replies',
            populate: {
                path: 'senderId',
                select: 'name profilePic userType'
            }
        })
        .populate('likes', 'name');

        res.json(messages);
    } catch (error) {
        res.status(500).send({ error: 'Error fetching messages' });
    }
});

app.post('/api/messages', auth, async (req, res) => {
    try {
        const { itemId, content, parentMessageId } = req.body;
        const userId = req.user._id; // Use _id instead of id

        // Create the message
        const message = new Message({
            itemId,
            content,
            senderId: userId,
            parentMessageId,
            timestamp: new Date()
        });

        // Save the message
        await message.save();

        // Populate the message with sender details
        await message.populate({
            path: 'senderId',
            select: 'name profilePic userType'
        });

        // Try to find the item in both enquiries and listings
        let item;
        try {
            item = await Enquiry.findById(itemId).populate('userId');
            if (!item) {
                item = await PropertyListing.findById(itemId).populate('userId');
            }
            if (!item) {
                throw new Error('Item not found');
            }
        } catch (error) {
            console.error('Error finding item:', error);
            throw new Error('Item not found');
        }

        // If this is a reply, update the parent message
        if (parentMessageId) {
            await Message.findByIdAndUpdate(parentMessageId, {
                $push: { replies: message._id }
            });
        }

        // Update reply count on the item
        const updateQuery = { $inc: { replies: 1 } };
        if (item.constructor.modelName === 'Enquiry') {
            await Enquiry.findByIdAndUpdate(itemId, updateQuery);
        } else {
            await PropertyListing.findByIdAndUpdate(itemId, updateQuery);
        }

        // Prepare notification data
        const notificationData = {
            type: parentMessageId ? 'new_reply' : 'new_message',
            message: {
                ...message.toObject(),
                itemTitle: item.title,
                itemUserId: item.userId._id
            }
        };

        // If it's a reply, notify the parent message sender
        if (parentMessageId) {
            const parentMessage = await Message.findById(parentMessageId).populate('senderId');
            if (parentMessage && parentMessage.senderId._id.toString() !== userId.toString()) {
                wss.notifyUser(parentMessage.senderId._id, notificationData);
            }
        }

        // Always notify the item owner
        if (item.userId._id.toString() !== userId.toString()) {
            wss.notifyUser(item.userId._id, notificationData);
        }

        // Notify other participants in the chat
        wss.notifyChat(itemId, notificationData, userId);

        // Send the populated message in response
        res.status(201).json(message);
    } catch (error) {
        console.error('Error posting message:', error);
        res.status(500).json({ error: 'Failed to post message' });
    }
});

// Like/Unlike a message
app.post('/api/messages/:messageId/like', auth, async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const userId = req.user._id;

        const message = await Message.findById(messageId)
            .populate('senderId', 'name profilePic userType')
            .populate('itemId', 'title userId');

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const hasLiked = message.likes.includes(userId);
        
        if (hasLiked) {
            // Unlike
            message.likes = message.likes.filter(id => !id.equals(userId));
        } else {
            // Like
            message.likes.push(userId);
            
            // Send notification only when liking, not unliking
            if (message.senderId._id.toString() !== userId.toString()) {
                const wss = req.app.get('wss');
                wss.notifyUser(message.senderId._id, {
                    type: 'new_like',
                    message: {
                        _id: message._id,
                        content: message.content,
                        itemId: message.itemId._id,
                        itemTitle: message.itemId.title,
                        likedBy: {
                            _id: req.user._id,
                            name: req.user.name,
                            profilePic: req.user.profilePic
                        }
                    }
                });
            }
        }

        await message.save();
        res.json(message);
    } catch (error) {
        console.error('Error updating like:', error);
        res.status(500).json({ error: 'Failed to update like' });
    }
});

// Bookmark endpoints
app.post('/api/bookmarks', auth, async (req, res) => {
    try {
        const { itemId, itemType } = req.body;
        const userId = req.user.id;

        // Check if bookmark already exists
        let bookmark = await Bookmark.findOne({ userId, itemId });

        if (bookmark) {
            // If bookmark exists, remove it
            await Bookmark.findByIdAndDelete(bookmark._id);
            res.json({ bookmarked: false });
        } else {
            // If bookmark doesn't exist, create it
            bookmark = new Bookmark({
                userId,
                itemId,
                itemType
            });
            await bookmark.save();
            res.json({ bookmarked: true });
        }
    } catch (error) {
        console.error('Bookmark error:', error);
        res.status(500).json({ error: 'Failed to toggle bookmark' });
    }
});

// Get user's bookmarks
app.get('/api/bookmarks', auth, async (req, res) => {
    try {
        const bookmarks = await Bookmark.find({ userId: req.user.id })
            .populate({
                path: 'itemId',
                populate: {
                    path: 'userId',
                    select: 'name userType profilePic'
                }
            });

        // Filter out any bookmarks where the item has been deleted
        const validBookmarks = bookmarks
            .filter(bookmark => bookmark.itemId)
            .map(bookmark => bookmark.itemId);

        res.json(validBookmarks);
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
});

// Check if item is bookmarked
app.get('/api/bookmarks/check/:itemId', auth, async (req, res) => {
    try {
        const bookmark = await Bookmark.findOne({
            userId: req.user.id,
            itemId: req.params.itemId
        });
        res.json({ bookmarked: !!bookmark });
    } catch (error) {
        console.error('Error checking bookmark:', error);
        res.status(500).json({ error: 'Failed to check bookmark status' });
    }
});

// Add push subscription endpoint
app.post('/api/push-subscription', auth, async (req, res) => {
    try {
        const subscription = req.body;
        const user = req.user;

        // Store the subscription in the user document
        user.pushSubscription = subscription;
        await user.save();

        res.json({ message: 'Push subscription saved' });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        res.status(500).json({ error: 'Failed to save push subscription' });
    }
});

// Function to send push notification
async function sendPushNotification(userId, notification) {
    try {
        const user = await User.findById(userId);
        if (!user || !user.pushSubscription) return;

        await webpush.sendNotification(
            user.pushSubscription,
            JSON.stringify(notification)
        );
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 