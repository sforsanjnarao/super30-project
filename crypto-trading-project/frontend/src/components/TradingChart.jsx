
import { createChart,
    ColorType,
   
    CandlestickSeries
 } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const TradingChart = ({setLivePrice, setLastLivePrice}) => {
    const chartContainerRef = useRef();
    const chart = useRef();
    const candleSeries = useRef();
    const [lastCandle, setLastCandle] = useState(null);


    const lastCandleRef = useRef(null);
    useEffect(() => {
        lastCandleRef.current = lastCandle;
    }, [lastCandle]);

    // Effect for initializing the chart
    useEffect(() => {
        if (!chartContainerRef.current) return; //inside this their is a div

        // console.log('lalalal',createChart)
        // console.log('chart.current', chart.current);
        // console.dir(chart.current);
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

        candleSeries.current = chart.current.addSeries(CandlestickSeries,{
            upColor: '#4bffb5',
            downColor: '#ff4976',
            borderDownColor: '#ff4976',
            borderUpColor: '#4bffb5',
            wickDownColor: '#ff4976',
            wickUpColor: '#4bffb5',
        });

        // Fetch initial historical data
        const fetchInitialData = async () => {
            console.log("fetchInitialData started"); 
            try {
                const response = await axios.get('http://localhost:3000/api/candles/BTCUSDT?interval=1m');
                console.log("API Response:", response.data);
                
                // The API returns 'bucket' or 'open_time', TradingView needs 'time'
                // Also, Timescale returns time in ISO format, we need UNIX timestamp
                const formattedData = response.data.map(d => ({
                    time: new Date(d.bucket || d.open_time).getTime() / 1000,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                }));

                console.log("Formatted:", formattedData);
                
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
     // Effect for handling WebSocket connection and live updates
     useEffect(() => {
        // Only attempt to connect if we have a candle to update
        if (!lastCandle) return;

        const ws = new WebSocket('ws://localhost:8080'); // Connect to our WebSocket server
        // console.log(ws)

        ws.onopen = () => {
            console.log('WebSocket connection established.');
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log(message)
            // console.log(message)
            // Handle live trade updates to make the last candle "tick"
            if (message.type === 'trade') {
                const trade = message.data;
                const tradePrice = parseFloat(trade.p);
                // console.log(trade)


                // Create an updated candle object
                const updatedCandle = {
                    // ...lastCandle,
                    // high: Math.max(lastCandle.high, tradePrice),
                    // low: Math.min(lastCandle.low, tradePrice),
                    ...lastCandleRef.current,
                    high: Math.max(lastCandleRef.current.high, tradePrice),
                    low: Math.min(lastCandleRef.current.low, tradePrice),
                    close: tradePrice,
                };
                
                // Update the chart and our state
                candleSeries.current.update(updatedCandle);
                setLastCandle(updatedCandle);
            }

            // Handle live depth (ask/bid) updates for the price display
            if (message.type === 'depth') {
                const newPrice = message.bestBid; // Or message.bestAsk
                console.log(newPrice)
                if (newPrice) {
                    setLastLivePrice(prev => {
                      setLivePrice(newPrice);
                      return prev;
                    });
                }
            }
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed.');
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        // Cleanup: close the connection when the component unmounts
        return () => {
            ws.close();
        };
    // }, []);
    }, [lastCandle, setLivePrice, setLastLivePrice]);

    return <div ref={chartContainerRef} style={{ position: 'relative' }} />;
};

export default TradingChart;



















