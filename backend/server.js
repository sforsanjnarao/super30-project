const express= require('express')
const WebSocket = require('ws')
const https= require('http')
const Redis= require('ioredis');
// const { type } = require('os');
const { Pool } = require('pg');


const PORT = 8080;
const REDIS_CHANNEL_UPDATES='binance:BTCUSDT:1m:updates';

const app=express(); 
const server= https.createServer(app)

const wss= new WebSocket.Server({server});

wss.on('connection', (ws)=>{
    console.log('client connected!');

    ws.send(JSON.stringify({
        type: 'welcome',
        message: "connect to crypto Trading webSocket Server!"
    }));
    ws.on('message',(message)=>{
        console.log(`Received message from client: ${message}`)
    })

    ws.on('close',()=>{
        console.log('Client disconneted!')
    })
    ws.on('error',(error)=>{
        console.error('webSocket error on client:', error);
    })
})



// --- Redis Subscriber Setup ---


const subscriber= new Redis({
    host: 'localhost',
    port: 6379
})

subscriber.on('connect', ()=>{
    console.log('Redis Subscriber connected!')

    subscriber.subscribe(REDIS_CHANNEL_UPDATES, (err, count)=>{
        if(err){
            console.error('Failed to subscribe:', err)
            return;
        }
        console.log(`Subscribed to ${count} channel(s). Listening for updates on "${REDIS_CHANNEL_UPDATES}"...`);

    })
})
// This is the core logic: when a message is published on the Redis channel...

subscriber.on('message',(channel, message)=>{
    console.log(`Received message from Redis channel "${channel}":`, message);
    //broad casting to all the client 
    wss.clients.forEach(client => {
          // Check if the client's connection is still open before sending.
        if(client.readyState === WebSocket.OPEN){
            client.send(message);
        }
    });
})

subscriber.on('error',(err)=>{
    console.error('Redis Subscriber Error:', err);
})

//pg/timescale setup

const pool = new Pool({
    user: 'trading_user',
    host: 'localhost',
    database: 'tradingDB',
    password: 'your_super_secret_password',
    port: 5432,
});

pool.on('connect', () => {
    console.log('TimescaleDB pool connected for backend!');
});

pool.on('error', (err) => {
    console.error('TimescaleDB pool error for backend:', err);
});



app.get('/api/history', async (req, res) => {
    // Extract query parameters from the request URL
    const symbol = req.query.symbol;
    const interval = req.query.interval; // e.g., '1m', '5m', '1h'
    const limit = parseInt(req.query.limit) || 500; // Default to 500 candles

    // --- Input Validation (IMPORTANT for security) ---
    if (!symbol || !interval) {
        return res.status(400).json({ error: 'Symbol and interval parameters are required.' });
    }

    // Map the user-provided interval to a valid table/view name to prevent SQL injection
    let tableName;
    switch (interval) {
        case '1m': tableName = 'candles_1m'; 
        break;
        case '5m': tableName = 'candles_5m'; 
        break;
        case '1h': tableName = 'candles_1h'; 
        break;
        default: return res.status(400).json({ error: 'Invalid interval specified.' });
    }

    // The column name in our continuous aggregates is 'bucket', not 'time'
    const timeColumn = (tableName === 'candles_1m') ? 'time' : 'bucket';

    try {
        // Construct the query safely using the validated table name
        const query = `
            SELECT 
                ${timeColumn} AS time, 
                open, 
                high, 
                low, 
                close, 
                volume 
            FROM ${tableName}
            WHERE symbol = $1
            ORDER BY ${timeColumn} DESC
            LIMIT $2;
        `;
        
        const values = [symbol, limit];
        const { rows } = await pool.query(query, values);
        
        // The data is fetched in descending order (newest first),
        // but charting libraries usually want it in ascending order (oldest first).
        res.json(rows.reverse());

    } catch (err) {
        console.error('Error fetching historical data:', err);
        res.status(500).json({ error: 'Failed to fetch historical data.' });
    }
});



// --- Start the Server ---

server.listen(PORT,()=>{
    console.log(`backend runinging on ${PORT}`)
})

process.on('SIGINT',()=>{
    console.log('Received SIGINT. Closing connections...')
    wss.close();
    subscriber.quit();
    server.close()
    process.exit(0);
})


