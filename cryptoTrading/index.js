const socket=require("ws")
const wss= new socket('wss://stream.binance.com:9443/stream?streams=btcusdt@trade')
//wss://stream.binance.com:9443/stream?streams=btcusdt@trade&timeUnit=MICROSECOND

wss.on('open',()=>{
    console.log("connection is on")
})
wss.on('message',(data) => {
    const parsed = JSON.parse(data);
    console.log('DATA:', parsed)
})
wss.on('close',()=>{
    console.log('connection closed')
})

wss.on('error',(err)=>{
    console.log('connection Err:', err)
})
