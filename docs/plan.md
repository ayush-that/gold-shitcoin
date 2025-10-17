# Automated BNB to PAXG Distribution System

## Architecture Overview

Express.js server with scheduled cron job that:

1. Fetches wallet BNB balance on BSC
2. Converts all BNB to PAXG on Ethereum via deBridge cross-chain swap
3. Retrieves top 100 BSC token holders from Moralis
4. Distributes PAXG proportionally to holders on Ethereum

## Implementation Steps

### 1. Project Setup

- Install dependencies: `express`, `node-cron`, `ethers`, `axios`, `dotenv`
- Update `package.json` with new dependencies and scripts
- Add new environment variables to `.env`:
  - `BNB_PRIVATE_KEY` (wallet with BNB on BSC)
  - `ETH_PRIVATE_KEY` (wallet to receive/distribute PAXG on Ethereum)
  - `DEBRIDGE_API_KEY` (if required)
  - `BSC_RPC_URL` (BSC node endpoint)
  - `ETH_RPC_URL` (Ethereum node endpoint)
  - `PAXG_CONTRACT_ADDRESS` (PAXG token on Ethereum)

### 2. Core Modules

**File: `holders.js`**

- Export `getTopHoldersMoralis()` function from existing `script.js`
- Remove file operations, keep only the fetch logic
- Return holders with addresses and percentages

**File: `debridge.js`**

- Function `getBNBBalance()` - Check BNB balance on BSC using ethers.js
- Function `getPAXGBalance()` - Check PAXG balance on Ethereum
- Function `swapBNBtoPAXG(amount)` - Use deBridge DLN API
  - API endpoint: `https://api.dln.trade/v1.0/dln/order/create-tx`
  - Parameters: srcChainId (BSC), dstChainId (Ethereum), srcChainTokenIn (BNB), dstChainTokenOut (PAXG)
  - Returns transaction data to sign and send

**File: `distributor.js`**

- Function `distributePAXG(holders, totalPAXG)`
- Calculate each holder's share based on `percentage_relative_to_total_supply`
- Use ethers.js to send PAXG ERC20 transfers on Ethereum
- Batch transactions with proper gas estimation
- Handle failures and log successful distributions

**File: `server.js`** (main Express server)

- Set up Express app on port 3000
- Health check endpoint: `GET /health`
- Manual trigger endpoint: `POST /distribute` (for testing)
- Use `node-cron` to schedule task every 60 minutes: `0 * * * *`
- Cron job flow:
  1. Get BNB balance
  2. If balance > 0, swap to PAXG via deBridge
  3. Wait for PAXG to arrive (poll balance)
  4. Fetch top 100 holders
  5. Distribute PAXG proportionally

### 3. deBridge Integration Details

Based on web search, deBridge DLN (Decentralized Liquidity Network) supports cross-chain swaps:

- Use REST API to get quote and create order
- Sign transaction on source chain (BSC)
- deBridge handles cross-chain messaging
- Funds arrive on destination chain (Ethereum)

API flow:

1. GET quote: amount, chains, tokens
2. POST create order with signed transaction
3. Monitor order status until complete

### 4. Distribution Logic

- Filter out contract addresses and exchange wallets (optional)
- Calculate proportional shares: `holderShare = (holderPercentage / 100) * totalPAXG`
- Minimum distribution threshold to save gas (e.g., skip amounts < 0.001 PAXG)
- Use multicall or batch transfers for efficiency

### 5. Error Handling & Logging

- Log all operations to console with timestamps
- Handle API failures gracefully (retry logic)
- Alert on critical failures (swap failed, distribution failed)
- Keep distribution history in JSON files

### 6. Testing Strategy

- Test swap with small BNB amount first
- Verify PAXG arrives on Ethereum
- Test distribution to a few test addresses
- Run manual trigger before enabling cron

## File Structure

```
/Users/shydev/mini-projects/gold-shitcoin/
├── server.js          (Express server + cron)
├── holders.js         (Moralis integration)
├── debridge.js        (Swap logic)
├── distributor.js     (PAXG distribution)
├── script.js          (keep for reference)
├── package.json       (updated dependencies)
├── .env               (updated with new vars)
└── env.example        (updated template)
```

## Key Dependencies

- `express`: Web server
- `node-cron`: Scheduler (every 60 minutes)
- `ethers`: Blockchain interactions (v6)
- `axios`: HTTP requests for deBridge API
- `dotenv`: Environment variables
