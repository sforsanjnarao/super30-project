// const socket=require("ws")
// const wss= new socket('wss://stream.binance.com:9443/stream?streams=btcusdt@trade')
// //wss://stream.binance.com:9443/stream?streams=btcusdt@trade&timeUnit=MICROSECOND

// wss.on('open',()=>{
//     console.log("connection is on")
// })
// wss.on('message',(data) => {
//     const parsed = JSON.parse(data);
//     console.log('DATA:', parsed)
// })
// wss.on('close',()=>{
//     console.log('connection closed')
// })

// wss.on('error',(err)=>{
//     console.log('connection Err:', err)
// })

const { Pool } = require('pg');



const WebSocket = require('ws');
const Redis = require('ioredis');

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@trade';
const REDIS_CHANNEL_RAW_TRADES = 'binance:btcusdt:raw_trades';

const publisher = new Redis({
    host: 'localhost',
    port: 6379
});
publisher.on('connect', () => {
    console.log('Redis Publisher connected!');
});
publisher.on('error', (err) => {
    console.error('Redis Publisher Error:', err);
});


const binanceWs = new WebSocket(BINANCE_WS_URL);

binanceWs.on('open', () => {
    console.log("Binance WebSocket connection opened!");
});

binanceWs.on('message', (data) => {
    const parsedData = JSON.parse(data);
    // console.log('RAW BINANCE DATA:', parsedData); 

    if (parsedData.stream && parsedData.data && parsedData.data.e === 'trade') {
        const trade = parsedData.data;
        // Publish the raw trade data to Redis
        publisher.publish(REDIS_CHANNEL_RAW_TRADES, JSON.stringify(trade)) 
            .then(() => {
                console.log(`Published raw trade to Redis channel "${REDIS_CHANNEL_RAW_TRADES}"`);
            })
            .catch(err => {
                console.error('Error publishing to Redis:', err);
            });
    }
});

binanceWs.on('close', () => {
    console.log('Binance WebSocket connection closed!');
    setTimeout(() => {
        console.log('Attempting to reconnect to Binance WebSocket...');
        // i can put the whole ws login inside a function put over for re-connection
        process.exit(1); 
    }, 5000);
});

binanceWs.on('error', (err) => {
    console.error('Binance WebSocket Error:', err);
    // binanceWs.close()
});

process.on('SIGINT', () => {    // SIGINT listen to control + C
    console.log('Received SIGINT. Closing connections...');
    binanceWs.close();
    publisher.quit(); 
    process.exit(0);
});


const pool = new Pool({
    user: 'trading_user',
    host: 'localhost', // Since we exposed the port in Docker
    database: 'tradingDB',
    password: 'your_super_secret_password',
    port: 5432,
});

pool.on('connect', () => {
    console.log('TimescaleDB pool connected!');
});

pool.on('error', (err) => {
    console.error('TimescaleDB pool error:', err);
});






 //Candlestick Aggregation 
const ONE_MINUTE_MS = 60 * 1000;
// const FIVE_MINUTE_MS = 5 * 60 * 1000;
// const TEN_MINUTE_MS = 10 * 60 * 1000;



const currentCandles = {}; // e.g., { 'BTCUSDT:1m': { open: ..., high: ..., low: ..., close: ..., volume: ..., startTime: ... } }

// Function to initialize a new candle
function createNewCandle(symbol, timestamp) {
    // Calculate the start of the current minute
    const minuteStartTime = Math.floor(timestamp / ONE_MINUTE_MS) * ONE_MINUTE_MS;
    return {
        open: null, // Will be set by the first trade in the minute
        high: -Infinity,
        low: Infinity,
        close: null, // Will be updated with each trade
        volume: 0,
        startTime: minuteStartTime, // Milliseconds timestamp of the candle's start
        trades: [], // Optional: to store individual trades for debugging/detailed analysis
    };
}

// Function to process an incoming trade and update the current candle
function processTradeForCandle(trade, symbol, interval = '1m') {
    const key = `${symbol}:${interval}`;
    const tradeTime = trade.E; // Event time in milliseconds

    let candle = currentCandles[key];

    // Check if we need a new candle (first trade, or new minute)
    const currentMinuteStartTime = Math.floor(tradeTime / ONE_MINUTE_MS) * ONE_MINUTE_MS;

    if (!candle || candle.startTime !== currentMinuteStartTime) {
        // If there's an existing candle that just completed, process and publish it
        if (candle) {
            publishClosedCandle(symbol, interval, candle);
        }
        // Create a new candle for the new minute
        candle = createNewCandle(symbol, tradeTime);
        currentCandles[key] = candle;
    }

    // Update candle properties
    const price = parseFloat(trade.p);
    const quantity = parseFloat(trade.q);

    if (candle.open === null) { // First trade for this candle
        candle.open = price;
    }
    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price; // Close is always the last trade price
    candle.volume += quantity;
    
    // Optionally store the trade if needed for more complex aggregations later
    // candle.trades.push(trade); 

    // console.log(`Updated ${key} candle: O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume}`);

    // Publish the *partial, ongoing* candle update to a separate Redis channel
    // This is what your frontend's WebSocket server will subscribe to for real-time chart updates
    publisher.publish(
        `binance:${symbol}:${interval}:updates`,
        JSON.stringify({
            event: 'candle_update',
            symbol: symbol,
            interval: interval,
            data: {
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume,
                startTime: candle.startTime, // Unix timestamp in milliseconds
                timestamp: Date.now() // When this update was generated
            }
        })
    );
}

// Function to publish a *closed* candle (e.g., to a DB and a separate Pub/Sub channel)
function publishClosedCandle(symbol, interval, candle) {
    if (candle.open === null) return; // Don't publish empty candles

    const closedCandleData = {
        symbol: symbol,
        interval: interval,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        startTime: candle.startTime,
        endTime: candle.startTime + ONE_MINUTE_MS - 1, // End of the minute
        isFinal: true
    };
    console.log(`CLOSED ${symbol}:${interval} Candle`);

    saveCandleToDatabase(closedCandleData);


    // --- Here you would typically save to your historical database ---
    // (e.g., using a separate function or ORM like Sequelize/TypeORM/Mongoose)
    // saveCandleToDatabase(closedCandleData); 
    // For now, we'll just publish to Redis
    publisher.publish(
        `binance:${symbol}:${interval}:closed_candles`,
        JSON.stringify(closedCandleData)
    );

    // Also store the latest closed candle in Redis for quick lookup
    publisher.set(`latest_closed_candle:${symbol}:${interval}`, JSON.stringify(closedCandleData));
}


async function saveCandleToDatabase(candleData) {
    const insertQuery = `
        INSERT INTO candles_1m(time, symbol, open, high, low, close, volume)
        VALUES($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING; -- Or use ON CONFLICT...DO UPDATE for more complex logic
    `;
    
    const values = [
        new Date(candleData.startTime), // Convert Unix ms to a Timestamp object
        candleData.symbol,
        candleData.open,
        candleData.high,
        candleData.low,
        candleData.close,
        candleData.volume
    ];

    try {
        await pool.query(insertQuery, values);
        // console.log(`Saved closed candle for ${candleData.symbol} at ${new Date(candleData.startTime).toISOString()} to DB.`);
    } catch (err) {
        console.error('Error saving candle to database:', err);
    }
}





// Modify the binanceWs.on('message') to call our candle processing function
// IMPORTANT: Replace the existing `binanceWs.on('message', ...)` block with this one.
binanceWs.on('message', (data) => {
    const parsedData = JSON.parse(data);

    if (parsedData.stream && parsedData.data && parsedData.data.e === 'trade') {
        const trade = parsedData.data;
        const symbol = trade.s; // e.g., "BTCUSDT"

        // Publish the raw trade data to Redis (as before)
        publisher.publish(REDIS_CHANNEL_RAW_TRADES, JSON.stringify(trade))
            .catch(err => {
                console.error('Error publishing raw trade to Redis:', err);
            });

        // Process trade for candlestick aggregation
        processTradeForCandle(trade, symbol, '1m'); // We are aggregating 1-minute candles
    }
});

// Add a mechanism to check and publish the last ongoing candle when the process exits
// This is important so the last partial candle isn't lost on shutdown.
process.on('exit', () => {
    console.log('Aggregator exiting. Publishing any ongoing candles...');
    for (const key in currentCandles) {
        const [symbol, interval] = key.split(':');
        const candle = currentCandles[key];
        if (candle.open !== null) { // Only publish if it actually received trades
            publishClosedCandle(symbol, interval, candle);
        }
    }
    publisher.quit(); // Ensure Redis connections are closed
});

// A small visual of the overall flow up to this point: 




