import React from 'react';
import './PositionsPanel.css';

const PositionsPanel = () => {
    return (
        <div className="positions-panel">
            <table>
                <thead>
                    <tr>
                        <th>Asset</th><th>Type</th><th>Vol</th><th>Open Price</th>
                        <th>Current Price</th><th>PnL</th><th>TP</th><th>SL</th><th>Close</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>SOLUSDT</td><td>Buy</td><td>1</td><td>201.080</td>
                        <td>199.298</td><td className="pnl-loss">-1.78</td>
                        <td>nil</td><td>nil</td><td><button className="close-btn">X</button></td>
                    </tr>
                    <tr>
                        <td>BTCUSDT</td><td>Buy</td><td>0.01</td><td>109237.832</td>
                        <td>108261.423</td><td className="pnl-loss">-9.76</td>
                        <td>nil</td><td>nil</td><td><button className="close-btn">X</button></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default PositionsPanel;