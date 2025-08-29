//binance to price-poller to publicing the data
const WebSocket = require('ws');
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@trade';

const binanceWs = new WebSocket(BINANCE_WS_URL);

binanceWs.on('open', () => {
    console.log("Binance WebSocket connection opened!");
});

binanceWs.on('message', (data) => {
    const parsedData = JSON.parse(data);
    console.log(parsedData)

    if (parsedData.stream && parsedData.data && parsedData.data.e === 'trade') {
        const trade = parsedData.data;
        const symbol = trade.s; // e.g., "BTCUSDT"

        // Publish raw trade to Redis
        publisher.publish(REDIS_CHANNEL_RAW_TRADES, JSON.stringify(trade))
            .catch(err => {
                console.error('Error publishing raw trade to Redis:', err);
            });

        // Process trade for 1-minute candle aggregation
        processTradeForCandle(trade, symbol, '1m');
    }
});

binanceWs.on('close', () => {
    console.log('Binance WebSocket connection closed!');
    setTimeout(() => {
        console.log('Attempting to reconnect to Binance WebSocket...');
        process.exit(1); // You could also wrap reconnection in a function
    }, 5000);
});

binanceWs.on('error', (err) => {
    console.error('Binance WebSocket Error:', err);
});


//subcribing the data to multiple web socket to frontend
const subscriber = new Redis({ host: 'localhost', port: 6379 });

subscriber.subscribe(REDIS_CHANNEL_UPDATES, (err, count) => {
    if (err) return console.error('Failed to subscribe to Redis:', err);
    console.log(`Subscribed to ${count} channel(s). Listening for updates...`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket!');
    ws.on('close', () => console.log('Client disconnected.'));
    ws.on('error', (error) => console.error('WebSocket client error:', error));
});

// this send data to all the client webscocket
subscriber.on('message', (channel, message) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
});




// const socket = new WebSocket('ws://localhost:8080');

// socket.onmessage = (event) => {
//     const message = JSON.parse(event.data);
//     if (message.event === 'candle_update' && message.symbol === SYMBOL) {
//         candleSeries.update({
//             time: new Date(message.data.startTime).getTime() / 1000,
//             open: message.data.open,
//             high: message.data.high,
//             low: message.data.low,
//             close: message.data.close
//         });
//     }
// };
