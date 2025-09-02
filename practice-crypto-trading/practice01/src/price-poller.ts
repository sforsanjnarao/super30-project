import {WebSocket} from "ws";


const url="wss://stream.binance.com:9443/stream?streams=btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade";

const wss =new WebSocket(url);

wss.on('open',()=>{
    console.log('connected to binance websocket');
});

const formatePrise= (str:string): {whole:number,decimal:number | undefined}=>{
    if(!str.includes('.')){
        return {whole:parseInt(str,10), decimal:0};
    }
    const [intPart, decimalPart]=str.split('.');
    return {whole:parseInt(intPart + decimalPart,10),decimal:decimalPart .length}
}
wss.on('message',event=>{
    const data=JSON.parse(event.toString());
    const ts=new Date(data.data.T).toISOString().replace('T',' ').replace('Z','')

    const {whole, decimal}=formatePrise(data.data.p);
    

})