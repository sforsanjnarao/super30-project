
import { createChart } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const TradingChart = () => {
    const chartContainerRef = useRef();
    const chart = useRef();
    const candleSeries = useRef();
    const [lastCandle, setLastCandle] = useState(null);

    // Effect for initializing the chart
    useEffect(() => {
        if (!chartContainerRef.current) return; 
        chart.current = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 500, // Adjust height as needed
            layout: {
                backgroundColor: '#000000',
                textColor: 'rgba(255, 255, 255, 0.9)',
            },
            grid: {
                vertLines: { color: '#334158' },
                horzLines: { color: '#334158' },
            },
        });

        candleSeries.current = chart.current.addCandlestickSeries({
            upColor: '#4bffb5',
            downColor: '#ff4976',
            borderDownColor: '#ff4976',
            borderUpColor: '#4bffb5',
            wickDownColor: '#ff4976',
            wickUpColor: '#4bffb5',
        });

        // Fetch initial historical data
        const fetchInitialData = async () => {
            try {
                const response = await axios.get('http://localhost:3000/api/candles/BTCUSDT?interval=1m');
                
                // The API returns 'bucket' or 'open_time', TradingView needs 'time'
                // Also, Timescale returns time in ISO format, we need UNIX timestamp
                const formattedData = response.data.map(d => ({
                    time: new Date(d.bucket || d.open_time).getTime() / 1000,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                }));
                
                candleSeries.current.setData(formattedData);
                if (formattedData.length > 0) {
                    setLastCandle(formattedData[formattedData.length - 1]);
                }
            } catch (error) {
                console.error("Failed to fetch initial chart data:", error);
            }
        };

        fetchInitialData();
        
        // Cleanup function
        return () => chart.current.remove();

    }, []); // Empty dependency array ensures this runs only once on mount

    // Effect for resizing the chart
    useEffect(() => {
        const handleResize = () => {
            chart.current.applyOptions({
                width: chartContainerRef.current.clientWidth,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Placeholder for WebSocket updates (we will add this later)
    // useEffect(() => { /* ... logic to update chart with live data ... */ }, [liveData]);

    return <div ref={chartContainerRef} style={{ position: 'relative' }} />;
};

export default TradingChart;