import {WebSocket} from "ws";
import { Client } from "pg";
import format from "pg-format";
import { createClient } from "redis";
// import { timeStamp } from "console";


const url="wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade";

const wss =new WebSocket(url);

const spread=0.01; //1%
let batch:[string, string, number, number, number][]=[]
const batch_size=100;
let batch_count=1;



const redisClient=createClient({
    url:'redis://localhost:6379'
})

const client= new Client({
    host:'localhost',
    port:5432,
    user:'postgres',
    password:'yourpassword',
    database:'xness',
})

async function startServer(){
    await redisClient.connect()
    .catch(err=>console.error('redis connection failed:', err));
}
startServer().catch(err=>console.error('server start failed:', err));
await client.connect().catch(err=>{console.error('connection faled')})

wss.on('open',()=>{
    console.log('connected to binance websocket');
});

const formatePrise= (str:string): {whole:number,decimal:number}=>{
    if(!str.includes('.')){
        return {whole:parseInt(str,10), decimal:0};
    }
    let [intPart, decimalPart]=str.split('.');
    return {whole:parseInt(intPart + decimalPart,10),decimal:decimalPart .length}
}
const formateBuySell=(whole:number,decimals:number, spread:number):{buy:number, sell:number,
    decimal:number}=>{
        const scale=10 **decimals;
        const spreadAdj=spread *scale;

        const buy=Math.round((whole * (scale + spreadAdj/2))/scale);
        const sell=Math.round((whole * (scale - spreadAdj/2))/scale);

        return {buy, sell, decimal:decimals};
}

wss.on('message',async event=>{
    const data=JSON.parse(event.toString());
    const ts=new Date(data.data.T).toISOString().replace('T',' ').replace('Z','')

    const {whole, decimal}=formatePrise(data.data.p);

    const {buy, sell  }=formateBuySell(whole, decimal || 0, spread);
    //data formate:-> ts:timespan , p:trading name, whole price, decimal, q: quatity

    batch.push([ts, data.data.p, whole, decimal, data.data.q])

    if(batch.length>=batch_size){
        const query=format(`INSERT INTO trades(time, assest, whole, decimal, quantity) VALUES %L`, batch);

        await client.query(query)
        batch_count++;
        batch=[];
    }
    await redisClient.publish('trades',JSON.stringify({
        time:ts,
        asset:data.data.s,
        price:whole,
        decimal:decimal,
        buy,
        sell
    }))
})