const express= require('express')
const WebSocket = require('wss')
const https= require('http')
const Redis= require('ioredis');
const { type } = require('os');

const PORT = 8080;
const REDIS_CHANNEL_UPDATES='binance:BTCUSDT:1m:updates';

const app=express(); 
const server= https.createServer(app)

const wss= new WebSocket.Server({server});

wss.on('connection', (ws)=>{
    console.log('client connected!');

    ws.send(JSON.stringify({
        type: 'welcome',
        message: "connect to crypto Trading webSocket Server!"
    }));
    ws.on('message',(message)=>{
        console.log(`Received message from client: ${message}`)
    })

    ws.on('close',()=>{
        console.log('Client disconneted!')
    })
    ws.on('error',(error)=>{
        console.error('webSocket error on client:', error);
    })
})



// --- Redis Subscriber Setup ---


const subscriber= new Redis({
    host: 'localhost',
    port: 6379
})

subscriber.on('connect', ()=>{
    console.log('Redis Subscriber connected!')

    subscriber.subscribe(REDIS_CHANNEL_UPDATES, (err, count)=>{
        if(err){
            console.error('Failed to subscribe:', err)
            return;
        }
    })
})



