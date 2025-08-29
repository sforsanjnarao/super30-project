// websocket-server.js
const WebSocket = require('ws');
const Redis = require('ioredis');
const http = require('http'); // Required to create a server for ws

const REDIS_CHANNEL_FOR_LIVE = 'live_updates_channel'; // Matches the channel from price-poller

const subscriber = new Redis({ host: 'localhost', port: 6379 });

subscriber.subscribe(REDIS_CHANNEL_FOR_LIVE, (err, count) => {
    if (err) return console.error('Failed to subscribe to Redis:', err);
    console.log(`Subscribed to ${count} channel(s) for frontend updates.`);
});

// Create an HTTP server (even if it just serves WebSockets)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running\n');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket!');

    // Send a welcome message or initial data if needed
    ws.send(JSON.stringify({ type: 'info', message: 'Welcome to the crypto updates!' }));

    ws.on('close', () => console.log('Client disconnected.'));
    ws.on('error', (error) => console.error('WebSocket client error:', error));

    // Optional: Handle messages from clients if your frontend sends anything
    ws.on('message', (message) => {
        console.log(`Received message from client: ${message}`);
        // You might want to parse this, e.g., for subscription requests for specific symbols
    });
});

// This sends data to all connected client WebSockets
subscriber.on('message', (channel, message) => {
    // console.log(`Received message on channel ${channel}: ${message}`); // Debugging
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`WebSocket server listening on port ${PORT}`);
});

// Keep the process alive
process.on('SIGINT', () => {
    console.log('WebSocket server shutting down...');
    wss.close();
    subscriber.quit();
    server.close(() => process.exit());
});