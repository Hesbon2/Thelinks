// Socket.IO initialization
let socket;

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

function initializeSocket() {
    const baseURL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://thelinks-gray.vercel.app';

    try {
        socket = io(baseURL, {
            path: '/socket.io',
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            console.log('Socket.IO connected');
            // Send authentication
            const token = localStorage.getItem('token');
            if (token) {
                socket.emit('authenticate', token);
            }

            showNotificationToast({
                title: 'Connected',
                message: 'Real-time notifications are now active',
                type: 'success'
            });
        });

        socket.on('authenticated', (response) => {
            if (response.status === 'success') {
                console.log('Socket authenticated successfully');
            } else {
                console.error('Socket authentication failed:', response.message);
                socket.disconnect();
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

        socket.on('error', (error) => {
            console.error('Socket.IO error:', error);
            showNotificationToast({
                title: 'Connection Error',
                message: 'Failed to establish real-time connection',
                type: 'error'
            });
        });

        socket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
            showNotificationToast({
                title: 'Disconnected',
                message: 'Attempting to reconnect...',
                type: 'warning'
            });
        });

        socket.connect();
    } catch (error) {
        console.error('Error initializing Socket.IO:', error);
    }
}

// Join a chat room
function joinChatRoom(itemId) {
    if (socket && socket.connected) {
        socket.emit('join_chat', itemId);
    }
}

// Leave a chat room
function leaveChatRoom(itemId) {
    if (socket && socket.connected) {
        socket.emit('leave_chat', itemId);
    }
}

// Initialize socket when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeSocket();
}); 