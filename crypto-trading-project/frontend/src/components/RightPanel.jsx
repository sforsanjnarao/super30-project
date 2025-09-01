import React from 'react';
import './RightPanel.css';

const RightPanel = () => {
    return (
        <div className="right-panel">
            <div className="panel-header">Trade</div>
            <div className="trade-controls">
                <div className="button-group">
                    <button className="trade-button buy">Buy</button>
                    <button className="trade-button sell">Sell</button>
                </div>
                <div className="input-group">
                    <label>Volume</label>
                    <input type="number" placeholder="0.00" disabled />
                </div>
                <div className="input-group">
                    <label>Leverage</label>
                    <input type="text" placeholder="1x" disabled />
                </div>
                <div className="input-group">
                    <label>Take Profit</label>
                    <input type="number" placeholder="0.00" disabled />
                </div>
                <div className="input-group">
                    <label>Stop Loss</label>
                    <input type="number" placeholder="0.00" disabled />
                </div>
                <button className="confirm-button" disabled>Confirm</button>
            </div>
        </div>
    );
};

export default RightPanel;