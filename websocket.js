const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws' // Add specific path for WebSocket
        });
        this.clients = new Map(); // Map to store client connections with their user IDs
        
        this.wss.on('connection', (ws) => {
            console.log('New client connected');
            
            // Add ping/pong to keep connection alive
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });
            
            ws.on('message', async (message) => {
                try {
                    console.log('Received message:', message.toString());
                    const data = JSON.parse(message);
                    
                    if (data.type === 'auth') {
                        await this.handleAuth(ws, data.token);
                    }
                } catch (error) {
                    console.error('WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });
            
            ws.on('close', () => {
                // Remove client from the map when they disconnect
                for (const [userId, client] of this.clients.entries()) {
                    if (client === ws) {
                        this.clients.delete(userId);
                        console.log(`Client ${userId} disconnected`);
                        break;
                    }
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });

        // Set up ping interval to keep connections alive
        const interval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    console.log('Terminating inactive connection');
                    return ws.terminate();
                }
                
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        this.wss.on('close', () => {
            clearInterval(interval);
        });
    }
    
    handleAuth(ws, token) {
        try {
            // Verify the JWT token
            const decoded = jwt.verify(token, config.JWT_SECRET);
            const userId = decoded.userId;
            
            // Store the WebSocket connection with the user ID
            this.clients.set(userId, ws);
            console.log(`Client ${userId} authenticated`);
            
            // Send confirmation to client
            ws.send(JSON.stringify({
                type: 'auth_success',
                message: 'Successfully authenticated'
            }));
        } catch (error) {
            console.error('Authentication error:', error);
            ws.send(JSON.stringify({
                type: 'auth_error',
                message: 'Authentication failed'
            }));
        }
    }
    
    // Send notification to a specific user
    notifyUser(userId, data) {
        try {
            const client = this.clients.get(userId.toString());
            if (client && client.readyState === WebSocket.OPEN) {
                console.log(`Sending notification to user ${userId}:`, data);
                client.send(JSON.stringify(data));
            } else {
                console.log(`User ${userId} not connected or socket not open`);
            }
        } catch (error) {
            console.error(`Error sending notification to user ${userId}:`, error);
        }
    }
    
    // Notify all participants in a chat
    notifyChat(itemId, data, excludeUserId = null) {
        try {
            console.log(`Broadcasting to chat ${itemId}, excluding user ${excludeUserId}`);
            let notifiedCount = 0;
            
            this.clients.forEach((client, userId) => {
                if (userId !== excludeUserId?.toString() && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                    notifiedCount++;
                }
            });
            
            console.log(`Notified ${notifiedCount} participants in chat ${itemId}`);
        } catch (error) {
            console.error(`Error broadcasting to chat ${itemId}:`, error);
        }
    }
}

module.exports = WebSocketServer; 