// batch-processor.js
const Redis = require('ioredis');
// In the next step, we'll add the TimescaleDB client here
// const pg = require('pg'); 

const REDIS_QUEUE_FOR_DB = 'raw_trades_queue';
const redisClient = new Redis({ host: 'localhost', port: 6379 });

// In-memory store for the current candle being built
let currentCandle = null;
let currentMinute = null;

function initializeCandle(trade) {
    const tradePrice = parseFloat(trade.p);
    const tradeQty = parseFloat(trade.q);
    
    return {
        symbol: trade.s,
        open: tradePrice,
        high: tradePrice,
        low: tradePrice,
        close: tradePrice,
        volume: tradeQty,
        openTime: getMinuteTimestamp(trade.T),
    };
}

function updateCandle(candle, trade) {
    const tradePrice = parseFloat(trade.p);
    const tradeQty = parseFloat(trade.q);

    candle.high = Math.max(candle.high, tradePrice);
    candle.low = Math.min(candle.low, tradePrice);
    candle.close = tradePrice;
    candle.volume += tradeQty;
}

// Helper to get the timestamp for the start of the minute
function getMinuteTimestamp(tradeTimestamp) {
    const d = new Date(tradeTimestamp);
    d.setSeconds(0, 0); // Floor to the beginning of the minute
    return d.getTime();
}

async function processQueue() {
    console.log('Batch Processor: Worker started. Waiting for trades...');
    
    while (true) {
        try {
            // BRPOP is "Blocking Right Pop". It waits until an item is available.
            // The '0' means it will wait indefinitely.
            const result = await redisClient.brpop(REDIS_QUEUE_FOR_DB, 0);
            
            // result is an array: [queueName, itemValue]
            const trade = JSON.parse(result[1]);

            // --- 1. Quality Check ---
            if (!trade || !trade.p || !trade.q || !trade.T) {
                console.warn('Batch Processor: Skipping malformed trade data:', trade);
                continue; // Skip to the next item in the queue
            }
            
            const tradeMinute = getMinuteTimestamp(trade.T);

            // --- 2. Candle Aggregation Logic ---
            if (!currentCandle) {
                // This is the very first trade we've seen
                currentCandle = initializeCandle(trade);
                currentMinute = tradeMinute;
            } else if (tradeMinute > currentMinute) {
                // The minute has "rolled over". The previous candle is complete.
                console.log('--- Candle Complete ---');
                console.log(JSON.stringify(currentCandle, null, 2));

                // --- 3. Database Insertion (Simulated) ---
                // In the next step, this is where we'll insert `currentCandle` into TimescaleDB.
                // await saveCandleToDB(currentCandle);
                console.log('Batch Processor: [SIMULATED] Saving completed candle to TimescaleDB.');
                
                // Start the new candle
                currentCandle = initializeCandle(trade);
                currentMinute = tradeMinute;
            } else {
                // This trade is in the same minute as the current candle. Update it.
                updateCandle(currentCandle, trade);
            }

        } catch (err) {
            console.error('Batch Processor: Error processing queue:', err);
            // Wait a moment before retrying to avoid spamming errors
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

processQueue();