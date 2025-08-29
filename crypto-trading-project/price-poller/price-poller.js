// price-poller.js
const WebSocket = require('ws');
const Redis = require('ioredis');
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@trade/btcusdt@depth';

// Path A: The Redis List acting as a queue for the database worker.
const REDIS_QUEUE_FOR_DB = 'raw_trades_queue'; 

// Path B: The Redis Pub/Sub channel for all live frontend updates.
const REDIS_CHANNEL_FOR_LIVE = 'live_updates_channel'; 

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const publisher = new Redis({ host: REDIS_HOST, port: 6379 });
const binanceWs = new WebSocket(BINANCE_WS_URL);

binanceWs.on('open', () => {
    console.log("Price Poller: Binance WebSocket connection opened! Forwarding data to two paths.");
});

binanceWs.on('message', (data) => {
    const parsedData = JSON.parse(data);
    const stream = parsedData.stream;
    const eventData = parsedData.data;

    if (!stream || !eventData) return;

    let liveUpdateMessage = null;

    // Process trade data
    if (stream.includes('@trade') && eventData.e === 'trade') {
        const trade = eventData;
        liveUpdateMessage = { type: 'trade', data: trade };

        // --- PATH A: Push the raw trade to the queue for the database worker ---
        publisher.lpush(REDIS_QUEUE_FOR_DB, JSON.stringify(trade))
            .catch(err => console.error(`Error pushing trade to queue [${REDIS_QUEUE_FOR_DB}]:`, err));
    }
    // Process depth data (for live ask/bid)
    else if (stream.includes('@depth') && eventData.e === 'depthUpdate') {
        liveUpdateMessage = {
            type: 'depth',
            symbol: eventData.s,
            bestAsk: eventData.a[0] ? eventData.a[0][0] : null, // Price only
            bestBid: eventData.b[0] ? eventData.b[0][0] : null, // Price only
        };
    }

    // --- PATH B: Publish the live update message (trade or depth) to the Pub/Sub channel ---
    if (liveUpdateMessage) {
        publisher.publish(REDIS_CHANNEL_FOR_LIVE, JSON.stringify(liveUpdateMessage))
            .catch(err => console.error(`Error publishing to channel [${REDIS_CHANNEL_FOR_LIVE}]:`, err));
    }
});

binanceWs.on('error', (err) => console.error('Price Poller: WebSocket Error:', err));
binanceWs.on('close', () => console.log('Price Poller: WebSocket connection closed!'));