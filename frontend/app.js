// --- Chart Configuration ---
const chartProperties = {
    width: 1200,
    height: 600,
    timeScale: {
        timeVisible: true,
        secondsVisible: false,
    },
    layout: {
        background: { color: '#121212' },
        textColor: '#e0e0e0',
    },
    grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
    },
};

// --- DOM Elements ---
const chartContainer = document.getElementById('chart-container');
const connectionStatusEl = document.getElementById('connection-status');

// --- Global Variables ---
const SYMBOL = 'BTCUSDT';
const INTERVAL = '1m'; // Change to '5m' to test the 5-minute chart
let candleSeries;

// --- Chart Initialization ---
const chart = LightweightCharts.createChart(chartContainer, chartProperties);
chart.timeScale().fitContent();


// --- Fetch Historical Data and Initialize Chart ---
async function initializeChart() {
    try {
        // Fetch historical data from our backend REST API
        const response = await fetch(`http://localhost:8080/api/history?symbol=${SYMBOL}&interval=${INTERVAL}&limit=1000`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const formattedData = data.map(candle => ({
            time: new Date(candle.time).getTime() / 1000,
            open: candle.open, high: candle.high, low: candle.low, close: candle.close,
        }));

        candleSeries = chart.addCandlestickSeries({
            upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
            wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        });


        candleSeries.setData(formattedData);
        console.log('Historical data loaded and chart initialized.');
    } catch (error) {
        console.error('Failed to initialize chart:', error);
        chartContainer.innerHTML = `<p style="color: red;">Could not load chart data. Is the backend running?</p>`;

    }
}

// --- WebSocket Connection for Real-time Updates ---
function setupWebSocket() {
    // Connect to the WebSocket server we built
    const socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        console.log('✅ WebSocket connection established!');
        connectionStatusEl.textContent = 'Connected';
        connectionStatusEl.className = 'connected';
    };

    socket.onmessage = (event) => {
        if(!candleSeries) return;
        // Parse the message from the server
        const message = JSON.parse(event.data);

        // Check if it's a real-time candle update
        if (message.event === 'candle_update' && message.symbol === SYMBOL) {
            const candle = message.data;
            
            // Format the candle data for the charting library
            const formattedCandle = {
                time: new Date(candle.startTime).getTime() / 1000,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                // volume: candle.volume
            };

            // Update the series with the new/updated candle
            candleSeries.update(formattedCandle);
            // console.log('📨 Candle updated:', formattedCandle);
        }
    };

    socket.onclose = () => {
        console.log('❌ WebSocket connection closed. Attempting to reconnect...');
        connectionStatusEl.textContent = 'Disconnected. Retrying...';
        connectionStatusEl.className = 'disconnected';
        // Simple reconnect logic: try again after 3 seconds
        setTimeout(setupWebSocket, 3000);
    };

    socket.onerror = error => {
        console.error('WebSocket error:', error);
        socket.close(); // This will trigger the onclose event and the reconnect logic
    };
}

// --- Start the Application ---
initializeChart();
setupWebSocket();