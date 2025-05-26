import { io } from 'socket.io-client';

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.listeners = new Map();
    }

    connect(token) {
        if (this.socket) {
            return;
        }

        const baseURL = process.env.NODE_ENV === 'production'
            ? 'https://thelinks-gray.vercel.app'
            : 'http://localhost:3000';

        this.socket = io(baseURL, {
            path: '/socket.io',
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.socket.on('connect', () => {
            console.log('Socket.IO connected');
            this.connected = true;
            this.socket.emit('authenticate', token);
        });

        this.socket.on('authenticated', (response) => {
            if (response.status === 'success') {
                console.log('Socket authenticated successfully');
            } else {
                console.error('Socket authentication failed:', response.message);
                this.disconnect();
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
            this.connected = false;
        });

        this.socket.on('error', (error) => {
            console.error('Socket.IO error:', error);
            this.connected = false;
        });

        this.socket.connect();
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }

    joinChat(itemId) {
        if (this.socket && this.connected) {
            this.socket.emit('join_chat', itemId);
        }
    }

    leaveChat(itemId) {
        if (this.socket && this.connected) {
            this.socket.emit('leave_chat', itemId);
        }
    }

    onNotification(callback) {
        if (this.socket) {
            this.socket.on('notification', callback);
            this.listeners.set('notification', callback);
        }
    }

    onChatMessage(callback) {
        if (this.socket) {
            this.socket.on('chat_message', callback);
            this.listeners.set('chat_message', callback);
        }
    }

    removeAllListeners() {
        if (this.socket) {
            this.listeners.forEach((callback, event) => {
                this.socket.off(event, callback);
            });
            this.listeners.clear();
        }
    }
}

const socketService = new SocketService();
export default socketService; 