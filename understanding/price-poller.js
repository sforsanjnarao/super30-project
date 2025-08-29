// price-poller.js
const WebSocket = require('ws');
const Redis = require('ioredis'); // Assuming you're using ioredis for Redis
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@trade/btcusdt@depth'; // Added depth for ask/bid

const REDIS_CHANNEL_RAW_TRADES = 'raw_trades';
const REDIS_CHANNEL_UPDATES = 'processed_updates'; // For ask/bid and 1m candles

const publisher = new Redis({ host: 'localhost', port: 6379 });

const binanceWs = new WebSocket(BINANCE_WS_URL);

binanceWs.on('open', () => {
    console.log("Binance WebSocket connection opened!");
});

binanceWs.on('message', (data) => {
    const parsedData = JSON.parse(data);

    // console.log(parsedData); // Uncomment for debugging raw data

    if (parsedData.stream) {
        if (parsedData.stream.includes('@trade') && parsedData.data && parsedData.data.e === 'trade') {
            const trade = parsedData.data;
            const symbol = trade.s; // e.g., "BTCUSDT"

            // Publish raw trade to Redis
            publisher.publish(REDIS_CHANNEL_RAW_TRADES, JSON.stringify(trade))
                .catch(err => {
                    console.error('Error publishing raw trade to Redis:', err);
                });

            // For simplicity, let's also publish individual trades as processed updates for now
            // Later, this will be more sophisticated with 1-min candles and ask/bid
            publisher.publish(REDIS_CHANNEL_UPDATES, JSON.stringify({ type: 'trade', data: trade }))
                .catch(err => {
                    console.error('Error publishing trade to processed_updates:', err);
                });

        } else if (parsedData.stream.includes('@depth') && parsedData.data && parsedData.data.e === 'depthUpdate') {
            const depth = parsedData.data;
            // Process depth updates for live ask/bid prices
            // For now, let's just publish the raw depth update
            publisher.publish(REDIS_CHANNEL_UPDATES, JSON.stringify({ type: 'depth', data: depth }))
                .catch(err => {
                    console.error('Error publishing depth to processed_updates:', err);
                });
        }
    }
});

binanceWs.on('close', () => {
    console.log('Binance WebSocket connection closed!');
    // Implement a more robust reconnection strategy here, perhaps with backoff
    setTimeout(() => {
        console.log('Attempting to reconnect to Binance WebSocket...');
        // For production, consider a process manager like PM2 or a more sophisticated retry mechanism
        // process.exit(1); // Exiting might restart the process if managed by PM2
        new WebSocket(BINANCE_WS_URL); // Simple re-initialization, refine for production
    }, 5000);
});

binanceWs.on('error', (err) => {
    console.error('Binance WebSocket Error:', err);
});

// Keep the process alive
process.on('SIGINT', () => {
    console.log('Price poller shutting down...');
    binanceWs.close();
    publisher.quit();
    process.exit();
});