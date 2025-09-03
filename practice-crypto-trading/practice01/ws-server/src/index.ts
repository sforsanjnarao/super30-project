import { WebSocketServer } from 'ws';
import {createClient} from 'redis'


const wss= new WebSocketServer({port: 8080})  //this websocket server is for the client to connect

const subscribe= createClient()
await subscribe.connect()



interface IncomingAssetData{
    timestamp:string,
    assert:string, //it's symbol
    price:Number,
    buy:Number,
    sell:Number,
    decimal:Number
}

interface OutgoingAssetData{
  symbol:string,
  price:Number,
  buy:Number,
  sell:Number,
  decimal:Number,
  status: 'up' | 'down'
}

const Prices:OutgoingAssetData[]=[
  { symbol: "BTCUSDT", price: 0, buy: 0, sell: 0, decimal: 0, status: "up" },
  { symbol: "SOLUSDT", price: 0, buy: 0, sell: 0, decimal: 0, status: "up"},
  { symbol: "ETHUSDT", price: 0, buy: 0, sell: 0, decimal: 0, status: "up" },
];

wss.on('connection', async ()=>{
  wss.on('open',()=>console.log('socket server connection is on the runn'))

  await subscribe.subscribe('trade',async (message)=>{ //receving the data bia websocket connection
    const parseData= await JSON.parse(message)

  })
})
