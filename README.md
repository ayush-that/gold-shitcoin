# BNB → PAXG Top-100 Distributor

Automated system that distributes PAXG rewards to top 100 BSC token holders every 10 minutes.

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment:

```bash
cp env.example .env
# Edit .env with your keys:
# - MORALIS_API_KEY
# - BSC_TOKEN_ADDRESS
# - BNB_PRIVATE_KEY
```

## How It Works

Every 10 minutes:

1. Reads dev BNB balance on BSC
2. Skips cycle if balance < 1 BNB
3. Keeps 5% BNB reserve, bridges 95% to PAXG
4. Fetches top 100 token holders via Moralis
5. Distributes PAXG proportionally to each holder's ETH address
6. Saves cycle history to `bridge-dist-YYYY-MM-DD....json`

## Usage

### Start Automated Server

```bash
pnpm start
```

Runs every 10 minutes automatically.

### Manual Trigger

```bash
curl -X POST http://localhost:3000/run
```

### Check Status

```bash
curl http://localhost:3000/status
```

### Run Once (Test)

```bash
pnpm run:once
```

### Test Bridge (Single Holder)

```bash
pnpm bridge:test 0.006 0xRecipientAddress
```

### Run Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Interactive UI
pnpm test:ui

# Coverage report
pnpm test:coverage
```

## API Endpoints

- `GET /health` - Server health check
- `GET /status` - Last run status and stats
- `POST /run` - Manually trigger distribution cycle

## Configuration

- **Minimum Total BNB**: 1 BNB (cycle skipped if less)
- **Reserve**: 5% kept on BSC
- **Distribution**: 95% bridged to PAXG
- **Minimum Per Order**: 0.003 BNB (holders below this are skipped)
- **Concurrency**: 3 orders processed simultaneously
- **Batch Delay**: 2 seconds between batches

## Files

- `bridge.js` - deBridge DLN integration for BNB→PAXG swaps
- `orchestrator.js` - Core distribution logic and cycle orchestration
- `holders.js` - Moralis API integration for fetching top 100 holders
- `server.js` - Express server with cron scheduling (every 10 min)
- `bridge-test.js` - Standalone test script for single transactions

## Notes

- Recipients' ETH addresses = BSC addresses
- History files: `bridge-dist-*.json`
- No console output (silent operation)
- RPC endpoints: hardcoded public nodes
- PAXG: `0x45804880De22913dAFE09f4980848ECE6EcbAf78`
