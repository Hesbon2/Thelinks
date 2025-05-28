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
            path: '/socket.io',
            transports: ['polling', 'websocket'],
            allowEIO3: true,
            pingTimeout: 60000,
            pingInterval: 25000,
            cookie: {
                name: 'io',
                httpOnly: true,
                sameSite: 'strict'
            }
        });

        this.clients = new Map();

        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
                if (!token) {
                    return next(new Error('Authentication token missing'));
                }

                const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
                socket.userId = decoded.userId;
                next();
            } catch (error) {
                next(new Error('Authentication failed'));
            }
        });

        this.io.on('connection', (socket) => {
            console.log('New Socket.IO connection:', socket.id);

            // Join user's personal room
            if (socket.userId) {
                socket.join(`user_${socket.userId}`);
                this.clients.set(socket.userId, socket);
                console.log('Client authenticated:', socket.userId);
                socket.emit('authenticated', { status: 'success' });
            }

            socket.on('join_chat', (itemId) => {
                try {
                    if (!socket.userId) {
                        throw new Error('Not authenticated');
                    }
                    if (!itemId) {
                        throw new Error('Invalid chat room');
                    }
                    socket.join(`chat_${itemId}`);
                    console.log(`User ${socket.userId} joined chat ${itemId}`);
                    socket.emit('chat_joined', { status: 'success', itemId });
                } catch (error) {
                    console.error('Join chat error:', error);
                    socket.emit('error', { message: error.message });
                }
            });

            socket.on('leave_chat', (itemId) => {
                try {
                    if (!itemId) {
                        throw new Error('Invalid chat room');
                    }
                    socket.leave(`chat_${itemId}`);
                    console.log(`User ${socket.userId} left chat ${itemId}`);
                    socket.emit('chat_left', { status: 'success', itemId });
                } catch (error) {
                    console.error('Leave chat error:', error);
                    socket.emit('error', { message: error.message });
                }
            });

            socket.on('disconnect', (reason) => {
                if (socket.userId) {
                    this.clients.delete(socket.userId);
                    console.log('Client disconnected:', socket.userId, 'Reason:', reason);
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
            if (!userId || !data) {
                throw new Error('Invalid notification parameters');
            }
            this.io.to(`user_${userId}`).emit('notification', data);
            return true;
        } catch (error) {
            console.error('Error sending notification to user:', error);
            return false;
        }
    }
    
    notifyChat(itemId, data, excludeUserId = null) {
        try {
            if (!itemId || !data) {
                throw new Error('Invalid chat notification parameters');
            }
            if (excludeUserId) {
                this.io.to(`chat_${itemId}`).except(`user_${excludeUserId}`).emit('chat_message', {
                    ...data,
                    itemId
                });
            } else {
                this.io.to(`chat_${itemId}`).emit('chat_message', {
                    ...data,
                    itemId
                });
            }
            return true;
        } catch (error) {
            console.error('Error broadcasting message:', error);
            return false;
        }
    }
}

module.exports = SocketServer; 