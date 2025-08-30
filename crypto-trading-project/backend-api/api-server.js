// backend-api/api-server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// --- DATABASE CONNECTION SETUP ---
// Uses the same environment variables as the batch-processor
const dbPool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.DB_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: 5432,
});

/**
 * API Endpoint to fetch candlestick data.
 * Path: /api/candles/:symbol
 * Query Params:
 *  - interval: string (e.g., '1m', '5m', '10m'). Required.
 *  - start: ISO 8601 string (e.g., '2025-08-25T10:00:00Z'). Optional.
 *  - end: ISO 8601 string (e.g., '2025-08-25T12:00:00Z'). Optional.
 */
app.get('/api/candles/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { interval, start, end } = req.query;

    // --- Input Validation ---
    if (!interval) {
        return res.status(400).json({ error: 'The "interval" query parameter is required.' });
    }

    // A whitelist to prevent SQL injection and ensure we query a valid table/view
    const validIntervals = {
        '1m': 'candles_1m',
        '2m': 'candles_2m',
        '5m': 'candles_5m',
        '10m': 'candles_10m',
    };

    const tableName = validIntervals[interval];
    if (!tableName) {
        return res.status(400).json({ error: 'Invalid interval. Valid options are: 1m, 2m, 5m, 10m.' });
    }

    // --- Dynamic SQL Query Construction ---
    // The column name is `bucket` in the aggregate views and `open_time` in the base table
    const timeColumn = tableName === 'candles_1m' ? 'open_time' : 'bucket';
    
    let query = `SELECT * FROM ${tableName} WHERE symbol = $1`;
    const queryParams = [symbol.toUpperCase()];

    if (start) {
        queryParams.push(start);
        query += ` AND ${timeColumn} >= $${queryParams.length}`;
    }
    if (end) {
        queryParams.push(end);
        query += ` AND ${timeColumn} <= $${queryParams.length}`;
    }

    query += ` ORDER BY ${timeColumn} ASC;`;
    
    console.log(`Executing query: ${query} with params: ${queryParams}`);

    try {
        const { rows } = await dbPool.query(query, queryParams);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).json({ error: 'An error occurred while fetching data.' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend API server listening on port ${PORT}`);
});