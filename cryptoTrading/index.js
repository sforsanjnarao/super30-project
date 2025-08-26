// const socket=require("ws")
// const wss= new socket('wss://stream.binance.com:9443/stream?streams=btcusdt@trade')
// //wss://stream.binance.com:9443/stream?streams=btcusdt@trade&timeUnit=MICROSECOND

// wss.on('open',()=>{
//     console.log("connection is on")
// })
// wss.on('message',(data) => {
//     const parsed = JSON.parse(data);
//     console.log('DATA:', parsed)
// })
// wss.on('close',()=>{
//     console.log('connection closed')
// })

// wss.on('error',(err)=>{
//     console.log('connection Err:', err)
// })

// import { PrismaClient } from '@prisma/client';
const prism = require('@prisma/client')
const prisma = new prism.PrismaClient();

async function main() {
  // Insert
  await prisma.sensorData.create({
    data: {
      deviceId: 'sensor_1',
      value: 45.7,
      timestamp: new Date(),
    },
  });

  // Query
  const data = await prisma.sensorData.findMany();
  console.log(data);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
