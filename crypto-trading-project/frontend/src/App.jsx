
import { useState } from 'react';
import './App.css'
import TradingChart from './components/TradingChart'
import LivePrice from './components/LivePrice'

function App() {

  const [livePrice, setLivePrice] = useState(null);
  // We store the previous price to determine the color flash (green/red)
  const [lastLivePrice, setLastLivePrice] = useState(null);


  return (
    <>
      <div className="App">
        <header className="App-header">
        <h1>Real-Time Crypto Trading Dashboard</h1>
        </header>
        <main>
        <LivePrice price={livePrice} lastPrice={lastLivePrice} />
        <TradingChart setLivePrice={setLivePrice} setLastLivePrice={setLastLivePrice} />
        </main>
      </div>

    </>
  )
}

export default App
