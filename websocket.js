const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

class SocketServer {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.NODE_ENV === 'production'
                    ? ['https://thelinks-gray.vercel.app', 'https://thelinks.vercel.app']
                    : 'http://localhost:3000',
                methods: ['GET', 'POST'],
                credentials: true
            },
            path: '/socket.io'
        });

        this.clients = new Map();

        this.io.on('connection', (socket) => {
            console.log('New Socket.IO connection:', socket.id);

            socket.on('authenticate', async (token) => {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    socket.userId = decoded.userId;
                    this.clients.set(decoded.userId, socket);
                    console.log('Client authenticated:', decoded.userId);

                    // Join a room specific to this user
                    socket.join(`user_${decoded.userId}`);
                    
                    socket.emit('authenticated', { status: 'success' });
                } catch (error) {
                    console.error('Authentication error:', error);
                    socket.emit('authenticated', { 
                        status: 'error',
                        message: 'Authentication failed'
                    });
                    socket.disconnect();
                }
            });

            socket.on('join_chat', (itemId) => {
                if (socket.userId) {
                    socket.join(`chat_${itemId}`);
                    console.log(`User ${socket.userId} joined chat ${itemId}`);
                }
            });

            socket.on('leave_chat', (itemId) => {
                socket.leave(`chat_${itemId}`);
                console.log(`User ${socket.userId} left chat ${itemId}`);
            });

            socket.on('disconnect', () => {
                if (socket.userId) {
                    this.clients.delete(socket.userId);
                    console.log('Client disconnected:', socket.userId);
                }
            });

            socket.on('error', (error) => {
                console.error('Socket error:', error);
                if (socket.userId) {
                    this.clients.delete(socket.userId);
                }
            });
        });
    }

    notifyUser(userId, data) {
        try {
            this.io.to(`user_${userId}`).emit('notification', data);
            return true;
        } catch (error) {
            console.error('Error sending notification to user:', error);
            return false;
        }
    }

    notifyChat(itemId, data, excludeUserId = null) {
        try {
            if (excludeUserId) {
                socket.to(`chat_${itemId}`).emit('chat_message', {
                    ...data,
                    itemId
                });
            } else {
                this.io.to(`chat_${itemId}`).emit('chat_message', {
                    ...data,
                    itemId
                });
            }
        } catch (error) {
            console.error('Error broadcasting message:', error);
        }
    }
}

module.exports = SocketServer; 