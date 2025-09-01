import React, { useEffect, useRef } from 'react';
import './LeftPanel.css';

// A helper component for a single asset row
const AssetRow = ({ assetName, ask, bid }) => {
    const prevAskRef = useRef();
    const prevBidRef = useRef();

    useEffect(() => {
        prevAskRef.current = ask;
        prevBidRef.current = bid;
    });

    const askDirection = !prevAskRef.current || prevAskRef.current === ask ? '' : ask > prevAskRef.current ? 'up' : 'down';
    const bidDirection = !prevBidRef.current || prevBidRef.current === bid ? '' : bid > prevBidRef.current ? 'up' : 'down';

    return (
        <div className="asset-row">
            <span className="asset-name">{assetName}</span>
            <div className={`price-box ask ${askDirection}`}>
                {ask ? parseFloat(ask).toFixed(3) : '---'}
            </div>
            <div className={`price-box bid ${bidDirection}`}>
                {bid ? parseFloat(bid).toFixed(3) : '---'}
            </div>
        </div>
    );
};

// The main Left Panel component
const LeftPanel = ({ askPrice, bidPrice }) => {
    return (
        <div className="left-panel">
            <div className="panel-header">
                <span>Assets</span>
                <span>Ask</span>
                <span>Bid</span>
            </div>
            <div className="assets-list">
                <AssetRow assetName="BTCUSDT" ask={askPrice} bid={bidPrice} />
                {/* Add more assets here when you subscribe to more streams */}
                <AssetRow assetName="SOLUSDT" ask="201.302" bid="199.298" />
                <AssetRow assetName="ETHUSDT" ask="4391.197" bid="4347.503" />
            </div>
        </div>
    );
};

export default LeftPanel