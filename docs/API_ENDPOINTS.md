# OpenAlgo Chart - API Endpoints Documentation

> **For Hosted OpenAlgo Server with Remote Configuration**

This document provides a comprehensive reference for all API endpoints required by the openalgo-chart project to communicate with a hosted OpenAlgo server. These endpoints enable charting, real-time market data, option chain analysis, and cloud workspace features.

---

## Table of Contents

1. [Base Configuration](#base-configuration)
2. [Authentication](#authentication)
3. [Market Data Endpoints](#market-data-endpoints)
4. [Option Chain Endpoints](#option-chain-endpoints)
5. [Market Timings & Holidays](#market-timings--holidays)
6. [Cloud Workspace](#cloud-workspace)
7. [WebSocket Endpoints](#websocket-endpoints)
8. [Response Format Standards](#response-format-standards)

---

## Base Configuration

### API Base URL Structure

```
{protocol}://{serverHost}:{serverPort}/api/v1
```

**Configuration (from `signal-config.js`):**
- `serverHost`: Environment variable `OPENALGO_SERVER_HOST` (e.g., `upright-dog-rapidly.ngrok-free.app`)
- `serverPort`: Environment variable `OPENALGO_SERVER_PORT` (empty for ngrok URLs using standard HTTPS port 443)
- `apiKey`: Environment variable `OPENALGO_API_KEY` or `API_KEY`

**Example:**
```
https://upright-dog-rapidly.ngrok-free.app/api/v1
```

---

## Authentication

### API Key Authentication

All API requests require authentication via API key, sent in the request body:

```json
{
  "apikey": "your-api-key-here"
}
```

The API key is:
- Stored in `localStorage` as `oa_apikey` (set by OpenAlgo after login)
- Included in every POST request body
- Used as query parameter for GET requests: `?apikey={apikey}`

### Auth Check

**Client-side check:**
```javascript
const apiKey = localStorage.getItem('oa_apikey');
if (!apiKey || apiKey.trim() === '') {
  // User not authenticated - redirect to login
  window.location.href = `${hostUrl}/auth/login`;
}
```

---

## Market Data Endpoints

### 1. Historical OHLC Data (Klines)

**Endpoint:** `POST /api/v1/history`

**Purpose:** Fetch historical candlestick (OHLC) data for charting

**Request Body:**
```json
{
  "apikey": "string",
  "symbol": "string",          // e.g., "RELIANCE", "NIFTY", "BANKNIFTY25DECFUT"
  "exchange": "string",        // "NSE", "BSE", "NFO", "MCX", "BFO", "NSE_INDEX", "BSE_INDEX"
  "interval": "string",        // "D" (daily), "W" (weekly), "M" (monthly), "1m", "5m", "15m", "30m", "1h", "2h", "4h"
  "start_date": "YYYY-MM-DD",  // e.g., "2024-01-01"
  "end_date": "YYYY-MM-DD"     // e.g., "2024-12-31"
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "timestamp": 1704067200,      // Unix timestamp in seconds (UTC)
      "open": 2789.50,
      "high": 2805.75,
      "low": 2785.00,
      "close": 2799.30,
      "volume": 12345678
    }
    // ... more candles
  ]
}
```

**Notes:**
- Timestamps are in **UTC seconds**
- Client adds IST offset (+19800 seconds / 5h 30m) for display
- Response is sorted chronologically (oldest first)
- Used for: Initial chart load, scroll-back pagination, replay mode

---

### 2. Real-time Ticker/Quote Data

**Endpoint:** `POST /api/v1/quotes`

**Purpose:** Get current market quote (LTP, OHLC, volume) for a symbol

**Request Body:**
```json
{
  "apikey": "string",
  "symbol": "string",           // e.g., "RELIANCE", "NIFTY"
  "exchange": "string"          // "NSE", "BSE", "NFO", etc.
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "ltp": 2799.30,              // Last Traded Price (or use "last_price")
    "open": 2789.50,
    "high": 2805.75,
    "low": 2785.00,
    "prev_close": 2788.00,       // Previous day's close (or "previous_close")
    "volume": 12345678,
    // Additional fields may include:
    "bid": 2799.00,
    "ask": 2799.50,
    "oi": 0                      // Open Interest (for derivatives)
  }
}
```

**Notes:**
- `prev_close` may be 0 for some brokers (e.g., Upstox) - client falls back to `open` for change calculation
- Used for: Initial price display, watchlist initialization, change% calculation
- Client caches `prev_close` for WebSocket updates (WebSocket mode 2 doesn't include it)

---

### 3. Symbol Search

**Endpoint:** `POST /api/v1/search`

**Purpose:** Search for trading symbols across exchanges

**Request Body:**
```json
{
  "apikey": "string",
  "query": "string",                  // Search term (e.g., "RELIANCE", "NIFTY")
  "exchange": "string",               // Optional filter: "NSE", "BSE", "NFO", "MCX", "BFO", "NSE_INDEX", "BSE_INDEX"
  "instrumenttype": "string"          // Optional filter: "EQ", "FUT", "CE", "PE", "OPTIDX"
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "symbol": "RELIANCE",
      "exchange": "NSE",
      "instrumenttype": "EQ",
      "name": "Reliance Industries Ltd",
      "lotsize": 1,
      // Additional fields may vary by broker
      "tradingsymbol": "RELIANCE-EQ",
      "token": "2885"
    }
    // ... more results
  ]
}
```

**Notes:**
- Used for: Symbol search dialog, autocomplete, option expiry detection
- Results should be sorted by relevance
- Maximum ~100 results recommended

---

### 4. Available Intervals

**Endpoint:** `POST /api/v1/intervals`

**Purpose:** Get supported timeframe intervals for this broker

**Request Body:**
```json
{
  "apikey": "string"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "seconds": [],                    // e.g., ["1s", "5s"]
    "minutes": [1, 3, 5, 10, 15, 30], // Minute intervals
    "hours": [1, 2, 4],               // Hour intervals
    "days": [1],                      // Daily intervals
    "weeks": [1],                     // Weekly intervals
    "months": [1]                     // Monthly intervals
  }
}
```

**Notes:**
- Used to dynamically populate interval selector based on broker capabilities
- Chart defaults to standard intervals if API unavailable
- Client converts: `1d` → `D`, `1w` → `W`, `1M` → `M` for API requests

---

## Option Chain Endpoints

### 5. Option Chain Data

**Endpoint:** `POST /api/v1/optionchain`

**Purpose:** Get option chain for index/stock (Call/Put strikes with LTP, OI, Greeks)

**Request Body:**
```json
{
  "apikey": "string",
  "underlying": "string",        // "NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX", "RELIANCE"
  "exchange": "string",          // "NSE_INDEX", "BSE_INDEX", "NSE", "BSE"
  "expiry_date": "DDMMMYY",      // Optional: "30DEC25" (omit for nearest expiry)
  "strike_count": 15             // Number of strikes above/below ATM (1-100)
}
```

**Response:**
```json
{
  "status": "success",
  "underlying": "NIFTY",
  "underlying_ltp": 23500.50,
  "underlying_prev_close": 23450.00,
  "expiry_date": "30DEC25",
  "atm_strike": 23500,
  "chain": [
    {
      "strike": 23400,
      "ce": {
        "symbol": "NIFTY30DEC2523400CE",
        "ltp": 125.50,
        "prev_close": 120.00,
        "open": 118.00,
        "high": 128.00,
        "low": 115.00,
        "bid": 125.00,
        "ask": 126.00,
        "oi": 1234567,           // Open Interest
        "volume": 567890,
        "label": "ITM",          // "ITM", "ATM", "OTM"
        "lotsize": 25            // Or "lot_size"
      },
      "pe": {
        "symbol": "NIFTY30DEC2523400PE",
        "ltp": 15.25,
        "prev_close": 18.00,
        "open": 17.50,
        "high": 19.00,
        "low": 14.50,
        "bid": 15.00,
        "ask": 15.50,
        "oi": 2345678,
        "volume": 345678,
        "label": "OTM",
        "lotsize": 25
      }
    }
    // ... more strikes (23450, 23500 ATM, 23550, 23600, etc.)
  ]
}
```

**Notes:**
- Used for: Option Chain Picker modal, strategy builder, PCR calculation
- Client calculates: straddle premium (CE LTP + PE LTP), PCR (PE OI / CE OI)
- ATM strike determined by nearest to `underlying_ltp`
- Caching: Client caches for 5 minutes to avoid rate limits

---

### 6. Option Greeks

**Endpoint:** `POST /api/v1/optiongreeks`

**Purpose:** Calculate option Greeks (Delta, Gamma, Theta, Vega, Rho, IV)

**Request Body:**
```json
{
  "apikey": "string",
  "symbol": "string",                 // e.g., "NIFTY30DEC2523500CE"
  "exchange": "string",               // "NFO", "BFO", "CDS", "MCX"
  // Optional parameters:
  "interest_rate": 0.06,              // Risk-free rate (default: 6%)
  "forward_price": 23550.00,          // Forward price of underlying
  "underlying_symbol": "NIFTY",       // For auto-detection
  "underlying_exchange": "NSE_INDEX",
  "expiry_time": "15:30:00"           // Expiry time (default: 15:30 IST)
}
```

**Response:**
```json
{
  "status": "success",
  "symbol": "NIFTY30DEC2523500CE",
  "underlying": "NIFTY",
  "strike": 23500,
  "option_type": "CE",               // "CE" or "PE"
  "expiry_date": "2025-12-30",
  "days_to_expiry": 25,
  "spot_price": 23500.50,
  "option_price": 125.50,            // Current LTP
  "implied_volatility": 18.5,        // IV in percentage
  "greeks": {
    "delta": 0.52,                   // 0 to 1 for CE, -1 to 0 for PE
    "gamma": 0.0015,
    "theta": -12.5,                  // Daily time decay
    "vega": 45.2,                    // Per 1% IV change
    "rho": 8.5                       // Per 1% interest rate change
  }
}
```

**Notes:**
- Used for: Option Chain Greek display, risk analysis
- Greeks calculated using Black-Scholes model
- IV (Implied Volatility) most important for option traders

---

## Market Timings & Holidays

### 7. Market Holidays

**Endpoint:** `POST /api/v1/market/holidays`

**Purpose:** Get trading holidays for a specific year

**Request Body:**
```json
{
  "apikey": "string",
  "year": 2025                       // Year (2020-2050)
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "date": "2025-02-26",
      "description": "Maha Shivaratri",
      "holiday_type": "TRADING_HOLIDAY",  // Or "SETTLEMENT_HOLIDAY", "SPECIAL_SESSION"
      "closed_exchanges": ["NSE", "BSE", "NFO", "BFO"],
      "open_exchanges": [
        {
          "exchange": "MCX",
          "start_time": 1740543600000,    // Epoch milliseconds
          "end_time": 1740565200000
        }
      ]
    }
    // ... more holidays
  ]
}
```

**Notes:**
- Used for: Session break markers, holiday detection in indicators (VWAP, TPO)
- Cached for 1 hour
- Client checks if current date is holiday before showing market status

---

### 8. Market Timings

**Endpoint:** `POST /api/v1/market/timings`

**Purpose:** Get market open/close times for a specific date

**Request Body:**
```json
{
  "apikey": "string",
  "date": "2025-12-30"               // Date in YYYY-MM-DD format
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "exchange": "NSE",
      "start_time": 1735543200000,   // Epoch milliseconds (9:15 AM IST)
      "end_time": 1735566000000      // Epoch milliseconds (3:30 PM IST)
    },
    {
      "exchange": "BSE",
      "start_time": 1735543200000,
      "end_time": 1735566000000
    },
    {
      "exchange": "MCX",
      "start_time": 1735540800000,   // 9:00 AM
      "end_time": 1735619700000      // 11:55 PM
    }
  ]
}
```

**Notes:**
- Returns **empty array** if market closed (weekend/holiday)
- Used for: Session boundary detection for VWAP, market open/close indicators
- Client converts to seconds and adds IST offset for chart coordinates
- Cached for 1 hour per date

---

## Cloud Workspace

### 9. Fetch User Preferences

**Endpoint:** `GET /api/v1/chart?apikey={apikey}`

**Purpose:** Load saved chart settings from cloud (watchlists, drawings, layouts)

**Request:**
```
GET /api/v1/chart?apikey=your-api-key-here
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "watchlists": {
      "My Watchlist": [
        { "symbol": "RELIANCE", "exchange": "NSE" },
        { "symbol": "NIFTY", "exchange": "NSE_INDEX" }
      ]
    },
    "favorites": ["RELIANCE", "TCS", "INFY"],
    "chartLayout": "2x2",
    "drawings": {
      "RELIANCE:NSE:1d": [
        {
          "type": "trendline",
          "points": [{"time": 1704067200, "price": 2800}, {"time": 1704153600, "price": 2850}],
          "color": "#2962FF",
          "lineWidth": 2
        }
      ]
    },
    "indicators": {
      "sma": { "period": 20, "color": "#2962FF" },
      "ema": { "period": 9, "color": "#FF6D00" }
    }
    // Any custom user preferences
  }
}
```

**Notes:**
- Called on app initialization after authentication
- 401/403 response = invalid API key → redirect to login
- Used to sync settings across devices
- Client merges cloud preferences with local state

---

### 10. Save User Preferences

**Endpoint:** `POST /api/v1/chart`

**Purpose:** Save chart settings to cloud workspace

**Request Body:**
```json
{
  "apikey": "string",
  "watchlists": { /* watchlist data */ },
  "favorites": [ /* favorite symbols */ ],
  "chartLayout": "2x2",
  "drawings": { /* drawings by symbol */ },
  "indicators": { /* indicator settings */ }
  // Any key-value pairs to save
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Preferences saved successfully"
}
```

**Notes:**
- Called when user modifies: watchlists, drawings, layouts, indicator settings
- Full state replacement (not incremental)
- Client debounces save operations (max 1 req/5s)

---

## WebSocket Endpoints

### WebSocket Connection

**URL:** `ws://{wsHost}:{wsPort}` or `wss://{wsHost}:{wsPort}` (for SSL)

**Configuration:**
- `wsHost`: From `OPENALGO_SERVER_HOST` or `signal-config.js`
- `wsPort`: From `OPENALGO_WS_PORT` (empty for standard  ports 80/443)

**Example:** `wss://upright-dog-rapidly.ngrok-free.app`

---

### WebSocket Protocol

#### 1. Authentication

**Sent on connection open:**
```json
{
  "action": "authenticate",
  "api_key": "your-api-key-here"
}
```

**Server Response (Success):**
```json
{
  "type": "auth",
  "status": "success",
  "message": "Authenticated successfully",
  "broker": "zerodha"             // Broker name
}
```

**Server Response (Error):**
```json
{
  "type": "error",
  "code": "AUTH_FAILED",
  "message": "Invalid API key"
}
```

---

#### 2. Subscribe to Market Data

**Sent after authentication:**
```json
{
  "action": "subscribe",
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "mode": 2                        // 1=LTP only, 2=Quote (OHLC), 3=Full (Greeks)
}
```

**Modes:**
- **Mode 1 (LTP):** Only last traded price
- **Mode 2 (Quote):** LTP + OHLC + Volume (used by chart)
- **Mode 3 (Full):** All Quote fields + depth data

---

#### 3. Market Data Updates

**Server sends (Mode 2 - Quote):**
```json
{
  "type": "market_data",
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "data": {
    "ltp": 2799.50,                // Last Traded Price
    "open": 2789.50,
    "high": 2805.75,
    "low": 2785.00,
    "volume": 12345678,
    "timestamp": 1704067200000     // Epoch milliseconds
  }
}
```

**Notes:**
- Client adds IST offset to timestamp for chart display
- `prev_close` **NOT included in mode 2** → client uses cached value from initial quotes API
- Updates chart with live candle using `chart.update()` method

---

#### 4. Unsubscribe

**Sent before disconnecting (cleanup):**
```json
{
  "action": "unsubscribe",
  "symbol": "RELIANCE",
  "exchange": "NSE"
}
```

**Notes:**
- Client sends unsubscribe for all symbols before closing WebSocket
- Similar to Python API: `client.unsubscribe_ltp(instruments)`
- Server stops sending updates for unsubscribed symbols

---

#### 5. Ping/Pong Heartbeat

**Server Ping:**
```json
{
  "type": "ping"
}
```

**Client Response:**
```json
{
  "type": "pong"
}
```

**Notes:**
- Keepalive mechanism to maintain connection
- Client auto-responds to ping messages
- Connection closes if no pong within timeout

---

### WebSocket Features

#### Auto-Reconnect
- Client reconnects on disconnect with exponential backoff
- Max 5 reconnect attempts
- Re-authenticates and re-subscribes to all symbols on reconnect

#### Connection States
- `CONNECTING`: Initial connection or reconnecting
- `CONNECTED`: Authenticated and ready
- `RECONNECTING`: Lost connection, attempting to reconnect
- `DISCONNECTED`: Manually closed or max retries exceeded

---

## Response Format Standards

### Success Response
```json
{
  "status": "success",
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description",
  "code": "ERROR_CODE"             // Optional error code
}
```

### HTTP Status Codes
- **200 OK**: Request successful
- **400 Bad Request**: Invalid parameters
- **401 Unauthorized**: Invalid/missing API key → redirect to login
- **403 Forbidden**: API key lacks permissions
- **404 Not Found**: Endpoint not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

---

## Data Flow Summary

### Initial Chart Load
1. **Check Auth:** `localStorage.getItem('oa_apikey')`
2. **Fetch Preferences:** `GET /api/v1/chart?apikey={key}` (watchlists, layouts)
3. **Load Symbol:** User selects symbol from search or watchlist
4. **Get Historical Data:** `POST /api/v1/history` (2 years for daily, 10 days for intraday)
5. **Get Current Quote:** `POST /api/v1/quotes` (LTP, prev_close for change%)
6. **Render Chart:** Display candlesticks with indicators
7. **Connect WebSocket:** Authenticate → Subscribe → Receive live updates

### Option Chain Flow
1. **User Opens Option Chain:** Click "Quick Option Picker" or strategy builder
2. **Fetch Option Chain:** `POST /api/v1/optionchain` (underlying, expiry, strike_count)
3. **Display Chain:** Show Call/Put strikes with LTP, OI, IV
4. **User Selects Options:** Click strikes to add to strategy
5. **Fetch Historical Data:** `POST /api/v1/history` for each option symbol
6. **Combine OHLC:** Client combines multi-leg OHLC (buy/sell logic)
7. **Display Strategy Chart:** Show combined premium as candlesticks

### Market Timings Flow
1. **App Initialization:** Fetch holidays for current year
2. **Indicator Calculation:** Get session boundaries for VWAP, TPO reset times
3. **Session Markers:** Draw vertical lines at market open/close times
4. **Real-time Status:** Check if market currently open for exchange

---

## Configuration Checklist

For proper charting functionality, ensure the hosted OpenAlgo server implements:

- [x] `POST /api/v1/history` - Historical OHLC data
- [x] `POST /api/v1/quotes` - Real-time quotes
- [x] `POST /api/v1/search` - Symbol search
- [x] `POST /api/v1/intervals` - Available intervals
- [x] `POST /api/v1/optionchain` - Option chain data
- [x] `POST /api/v1/optiongreeks` - Option Greeks calculation
- [x] `GET /api/v1/chart` - Fetch user preferences
- [x] `POST /api/v1/chart` - Save user preferences
- [x] `POST /api/v1/market/holidays` - Market holidays
- [x] `POST /api/v1/market/timings` - Market timings
- [x] WebSocket endpoint with authentication, subscribe/unsubscribe, market_data updates
- [x] CORS headers for remote access (if chart hosted on different domain)
- [x] API key validation and authentication
- [x] IST timezone handling for timestamps

---

## Additional Notes

### Timestamp Handling
- **Server sends:** UTC timestamps in seconds (history) or milliseconds (WebSocket)
- **Client displays:** IST (UTC + 19800 seconds) for chart consistency
- **All candle times:** Aligned to IST for proper session display

### Rate Limiting
- Client implements caching (5 min for option chains, 1 hour for holidays/timings)
- Minimum 5 seconds between option chain API calls
- WebSocket preferred for real-time data (avoids polling rate limits)

### Error Handling
- **401 response:** Redirect to `${hostUrl}/auth/login`
- **Network errors:** Show error toast, retry with exponential backoff
- **WebSocket disconnect:** Auto-reconnect up to 5 attempts
- **Stale cache:** Use cached data if API fails (better than empty chart)

---

**Last Updated:** 2026-01-05  
**Chart Version:** openalgo-chart v1.0  
**Compatible with:** OpenAlgo API v1
