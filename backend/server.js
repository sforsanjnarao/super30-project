const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const Redis = require('ioredis');
const { Pool } = require('pg');
const cors = require('cors'); // <-- IMPORT CORS

// --- Configuration ---
const PORT = 8080;
const REDIS_CHANNEL_UPDATES = 'binance:BTCUSDT:1m:updates';

// --- Express & HTTP Server Setup ---
const app = express();
app.use(cors()); 


const server = http.createServer(app);

// --- PostgreSQL/TimescaleDB Setup ---
const pool = new Pool({
    user: 'trading_user',
    host: 'localhost',
    database: 'tradingDB',
    password: 'tradingISon', // Make sure this matches your docker-compose.yml
    port: 5432,
});

pool.on('connect', () => console.log('Backend connected to TimescaleDB!'));
pool.on('error', (err) => console.error('Backend TimescaleDB pool error:', err));

// --- REST API Endpoint for Historical Candles ---
app.get('/api/history', async (req, res) => {
    const { symbol = 'BTCUSDT', interval = '1m', limit = 500 } = req.query;

    let tableName;
    switch (interval) {
        case '1m': tableName = 'candles_1m'; break;
        case '5m': tableName = 'candles_5m'; break;
        case '1h': tableName = 'candles_1h'; break;
        default: return res.status(400).json({ error: 'Invalid interval.' });
    }

    const timeColumn = (tableName === 'candles_1m') ? 'time' : 'bucket';

    try {
        const query = `
            SELECT ${timeColumn} AS time, open, high, low, close, volume 
            FROM ${tableName}
            WHERE symbol = $1
            ORDER BY ${timeColumn} DESC
            LIMIT $2;
        `;
        const { rows } = await pool.query(query, [symbol, parseInt(limit)]);
        res.json(rows.reverse());
    } catch (err) {
        console.error('API Error fetching historical data:', err);
        res.status(500).json({ error: 'Failed to fetch historical data.' });
    }
});

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket!');
    ws.on('close', () => console.log('Client disconnected.'));
    ws.on('error', (error) => console.error('WebSocket client error:', error));
});

// --- Redis Subscriber Setup ---
const subscriber = new Redis({ host: 'localhost', port: 6379 });

subscriber.on('connect', () => {
    console.log('Backend connected to Redis as a subscriber!');
    subscriber.subscribe(REDIS_CHANNEL_UPDATES, (err, count) => {
        if (err) return console.error('Failed to subscribe to Redis:', err);
        console.log(`Subscribed to ${count} channel(s). Listening for updates...`);
    });
});

// When a message arrives from Redis, broadcast it to all WebSocket clients
subscriber.on('message', (channel, message) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
});

subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));

// --- Start the Server ---
server.listen(PORT, () => {
    console.log(`Backend server with API and WebSocket is running on http://localhost:${PORT}`);
});