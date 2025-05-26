const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws',
            clientTracking: true
        });

        this.clients = new Map();

        this.wss.on('connection', (ws) => {
            console.log('New WebSocket connection established');

            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    
                    if (data.type === 'auth') {
                        const token = data.token;
                        try {
                            const decoded = jwt.verify(token, process.env.JWT_SECRET);
                            ws.userId = decoded.userId;
                            this.clients.set(decoded.userId, ws);
                            console.log('Client authenticated:', decoded.userId);
                        } catch (error) {
                            console.error('Authentication error:', error);
                            ws.close();
                        }
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            });

            ws.on('close', () => {
                if (ws.userId) {
                    this.clients.delete(ws.userId);
                    console.log('Client disconnected:', ws.userId);
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                if (ws.userId) {
                    this.clients.delete(ws.userId);
                }
            });
        });

        // Set up ping interval
        const pingInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    if (ws.userId) {
                        this.clients.delete(ws.userId);
                    }
                    return ws.terminate();
                }
                
                ws.isAlive = false;
                ws.ping(() => {});
            });
        }, 30000);

        this.wss.on('close', () => {
            clearInterval(pingInterval);
        });
    }

    notifyUser(userId, data) {
        const client = this.clients.get(userId);
        if (client && client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(data));
                return true;
            } catch (error) {
                console.error('Error sending notification to user:', error);
                return false;
            }
        }
        return false;
    }

    notifyChat(itemId, data, excludeUserId = null) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && (!excludeUserId || client.userId !== excludeUserId)) {
                try {
                    client.send(JSON.stringify({
                        ...data,
                        itemId
                    }));
                } catch (error) {
                    console.error('Error broadcasting message:', error);
                }
            }
        });
    }
}

module.exports = WebSocketServer; 