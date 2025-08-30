-- This ensures the TimescaleDB extension is active for your database.
-- The TimescaleDB docker image does this automatically, but it's safe to include.
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 1. Create the table for our 1-minute candlestick data.
CREATE TABLE candles_1m (
    open_time   TIMESTAMPTZ     NOT NULL,
    symbol      TEXT            NOT NULL,
    open        DOUBLE PRECISION  NOT NULL,
    high        DOUBLE PRECISION  NOT NULL,
    low         DOUBLE PRECISION  NOT NULL,
    close       DOUBLE PRECISION  NOT NULL,
    volume      DOUBLE PRECISION  NOT NULL,
    PRIMARY KEY (open_time, symbol)
);

-- 2. Turn this regular table into a TimescaleDB hypertable.
SELECT create_hypertable('candles_1m', 'open_time');

-----------------------------------------------------------
-- CONTINUOUS AGGREGATES
-----------------------------------------------------------

-- Create a continuous aggregate for 2-minute candles
CREATE MATERIALIZED VIEW candles_2m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('2 minutes', open_time) AS bucket,
    symbol,
    first(open, open_time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, open_time) AS close,
    sum(volume) AS volume
FROM candles_1m
GROUP BY bucket, symbol;

-- Create a continuous aggregate for 5-minute candles
CREATE MATERIALIZED VIEW candles_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', open_time) AS bucket,
    symbol,
    first(open, open_time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, open_time) AS close,
    sum(volume) AS volume
FROM candles_1m
GROUP BY bucket, symbol;

-- Create a continuous aggregate for 10-minute candles
CREATE MATERIALIZED VIEW candles_10m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('10 minutes', open_time) AS bucket,
    symbol,
    first(open, open_time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, open_time) AS close,
    sum(volume) AS volume
FROM candles_1m
GROUP BY bucket, symbol;


-----------------------------------------------------------
-- AGGREGATE POLICIES (to keep them up-to-date)
-----------------------------------------------------------
SELECT add_continuous_aggregate_policy('candles_2m', start_offset => INTERVAL '10 minutes', end_offset => INTERVAL '2 minutes', schedule_interval => INTERVAL '1 minute');
SELECT add_continuous_aggregate_policy('candles_5m', start_offset => INTERVAL '15 minutes', end_offset => INTERVAL '5 minutes', schedule_interval => INTERVAL '1 minute');
SELECT add_continuous_aggregate_policy('candles_10m', start_offset => INTERVAL '30 minutes', end_offset => INTERVAL '10 minutes', schedule_interval => INTERVAL '1 minute');