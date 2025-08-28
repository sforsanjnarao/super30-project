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

const WebSocket = require('ws');
const Redis = require('ioredis');
const { Pool } = require('pg');


const BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@trade';
const REDIS_CHANNEL_RAW_TRADES = 'binance:btcusdt:raw_trades';
const ONE_MINUTE_MS = 60 * 1000;
// const FIVE_MINUTE_MS = 5 * 60 * 1000;
// const TEN_MINUTE_MS = 10 * 60 * 1000;

// --- Database Connection Pool ---
const pool = new Pool({
    user: 'trading_user',
    host: 'localhost',
    database: 'tradingDB',
    password: 'your_super_secret_password',
    port: 5432,
});
pool.on('connect', () => console.log('Aggregator connected to TimescaleDB!'));
pool.on('error', err => console.error('TimescaleDB pool error:', err));

// --- Redis Publisher Client ---
const publisher = new Redis({ host: 'localhost', port: 6379 });
publisher.on('connect', () => console.log('Aggregator connected to Redis as a publisher!'));
publisher.on('error', err => console.error('Redis Publisher Error:', err));



 //Candlestick Aggregation 
 const currentCandles = {}; // Stores in-progress candles

 async function saveCandleToDatabase(candleData) {
     const query = `INSERT INTO candles_1m(time, symbol, open, high, low, close, volume) VALUES($1, $2, $3, $4, $5, $6, $7)`;
     const values = [new Date(candleData.startTime), candleData.symbol, candleData.open, candleData.high, candleData.low, candleData.close, candleData.volume];
     try {
         await pool.query(query, values);
     } catch (err) {
         console.error('DB Insert Error:', err.message);
     }
 }
 
 function publishClosedCandle(symbol, interval, candle) {
     if (candle.open === null) return;
     console.log(`Closing ${interval} candle for ${symbol} at ${new Date(candle.startTime).toLocaleTimeString()}`);
     saveCandleToDatabase(candle); // Save to TimescaleDB
 }
 
 function processTradeForCandle(trade, symbol, interval = '1m') {
     const key = `${symbol}:${interval}`;
     const tradeTime = trade.E;
     const currentMinuteStartTime = Math.floor(tradeTime / ONE_MINUTE_MS) * ONE_MINUTE_MS;
 
     let candle = currentCandles[key];
 
     if (!candle || candle.startTime !== currentMinuteStartTime) {
         if (candle) {
             publishClosedCandle(symbol, interval, candle);
         }
         candle = {
             open: parseFloat(trade.p), high: parseFloat(trade.p), low: parseFloat(trade.p), close: parseFloat(trade.p),
             volume: parseFloat(trade.q), startTime: currentMinuteStartTime, symbol: symbol
         };
         currentCandles[key] = candle;
     } else {
         candle.high = Math.max(candle.high, parseFloat(trade.p));
         candle.low = Math.min(candle.low, parseFloat(trade.p));
         candle.close = parseFloat(trade.p);
         candle.volume += parseFloat(trade.q);
     }
 
     publisher.publish(`binance:${symbol}:${interval}:updates`, JSON.stringify({
         event: 'candle_update', symbol: symbol, interval: interval, data: candle
     }));
 }
 


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




