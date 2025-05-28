// Socket.IO initialization
let socket;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;

// Add notification toast functionality
function showNotificationToast({ title, message, type = 'info', duration = 5000 }) {
    const container = document.getElementById('notificationsContainer');
    if (!container) {
        console.error('Notifications container not found');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
        <div class="notification-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;

    container.appendChild(toast);

    // Remove toast after duration
    setTimeout(() => {
        toast.classList.add('exiting');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    }, duration);
}

function getAuthToken() {
    return localStorage.getItem('token');
}

function initializeSocket() {
    // Don't initialize if no token
    const token = getAuthToken();
    if (!token) {
        console.log('No authentication token found, skipping socket initialization');
        return;
    }

    const baseURL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://thelinks-gray.vercel.app';

    try {
        if (socket && socket.connected) {
            console.log('Socket already connected');
            return;
        }

        socket = io(baseURL, {
            path: '/socket.io',
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: RECONNECT_DELAY,
            auth: {
                token: token
            },
            transports: ['polling', 'websocket']
        });

        socket.on('connect', () => {
            console.log('Socket.IO connected');
            reconnectAttempts = 0;
            showNotificationToast({
                title: 'Connected',
                message: 'Real-time notifications are now active',
                type: 'success'
            });
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            reconnectAttempts++;
            
            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.error('Max reconnection attempts reached');
                socket.disconnect();
                showNotificationToast({
                    title: 'Connection Failed',
                    message: 'Unable to establish real-time connection',
                    type: 'error',
                    duration: 10000
                });
            } else {
                showNotificationToast({
                    title: 'Connection Error',
                    message: `Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
                    type: 'warning'
                });
            }
        });

        socket.on('authenticated', (response) => {
            if (response.status === 'success') {
                console.log('Socket authenticated successfully');
            } else {
                console.error('Socket authentication failed:', response.message);
                socket.disconnect();
                showNotificationToast({
                    title: 'Authentication Failed',
                    message: 'Please try logging in again',
                    type: 'error'
                });
            }
        });

        socket.on('notification', (data) => {
            console.log('Socket.IO notification received:', data);
            handleWebSocketMessage(data);
        });

        socket.on('chat_message', (data) => {
            console.log('Socket.IO chat message received:', data);
            handleWebSocketMessage(data);
        });

        socket.on('chat_joined', (response) => {
            if (response.status === 'success') {
                console.log('Joined chat room:', response.itemId);
            }
        });

        socket.on('chat_left', (response) => {
            if (response.status === 'success') {
                console.log('Left chat room:', response.itemId);
            }
        });

        socket.on('error', (error) => {
            console.error('Socket.IO error:', error);
            showNotificationToast({
                title: 'Error',
                message: error.message || 'An error occurred',
                type: 'error'
            });
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket.IO disconnected:', reason);
            showNotificationToast({
                title: 'Disconnected',
                message: 'Real-time connection lost',
                type: 'warning'
            });
        });

        socket.connect();
    } catch (error) {
        console.error('Error initializing Socket.IO:', error);
        showNotificationToast({
            title: 'Initialization Error',
            message: 'Failed to initialize real-time connection',
            type: 'error'
        });
    }
}

// Join a chat room
function joinChatRoom(itemId) {
    if (!itemId) {
        console.error('Invalid item ID for chat room');
        return;
    }

    if (socket && socket.connected) {
        socket.emit('join_chat', itemId);
    } else {
        console.error('Socket not connected');
        showNotificationToast({
            title: 'Connection Error',
            message: 'Not connected to chat server',
            type: 'error'
        });
    }
}

// Leave a chat room
function leaveChatRoom(itemId) {
    if (!itemId) {
        console.error('Invalid item ID for chat room');
        return;
    }

    if (socket && socket.connected) {
        socket.emit('leave_chat', itemId);
    }
}

// Initialize socket when user logs in
function initializeSocketOnLogin() {
    if (getAuthToken()) {
        initializeSocket();
    }
}

// Clean up socket when user logs out
function cleanupSocketOnLogout() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// Initialize socket when the page loads if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
    if (getAuthToken()) {
        initializeSocket();
    }
}); 