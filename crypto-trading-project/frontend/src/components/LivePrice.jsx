import React from 'react';
import './LivePrice.css'; // We will create this CSS file next

const LivePrice = ({ price, lastPrice }) => {
  // Determine if the price went up or down to apply a color class
  const priceDirection = !lastPrice || lastPrice === price ? '' : price > lastPrice ? 'up' : 'down';

  return (
    <div className="live-price-container">
      <h2>Live Price (BTC/USDT)</h2>
      <div className={`price-display ${priceDirection}`}>
        {price ? `$${parseFloat(price).toFixed(2)}` : 'Connecting...'}
      </div>
    </div>
  );
};

export default LivePrice;