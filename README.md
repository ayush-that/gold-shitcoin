# BSC Token Top 100 Holders

A simple script to fetch and display the top 100 holders of any BSC (BNB Smart Chain) token using the Etherscan V2 API.

## Overview

This script:

1. Fetches the top 100 token holders from BSC using Etherscan V2 API (unified multichain API)
2. Displays them in a formatted table in your terminal
3. Saves the results to a JSON file with timestamp

## Prerequisites

- Node.js (v16 or higher)
- A BSC token contract address
- Etherscan API key (free tier works - get one at https://etherscan.io/apis)
  - Note: Etherscan V2 uses a single API key for all chains including BSC

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp env.example .env
   ```

   Edit `.env` with your values:

   ```
   BSC_TOKEN_ADDRESS=0xYourBSCTokenContractAddress
   ETHERSCAN_API_KEY=your_etherscan_api_key
   ```

## Usage

Run the script:

```bash
npm start
```

The script will:

1. Fetch top 100 holders from BSC using Etherscan V2 API
2. Display them in a formatted table
3. Save results to `top-100-holders-YYYY-MM-DDTHH-MM-SS.json`

## Example Output

```
🌟 BSC Token Top 100 Holders
=====================================

🔍 Fetching token holders from BSC...
✅ Found 100 holders

📊 TOP 100 TOKEN HOLDERS
================================================================================
Rank   Address                                      Balance
--------------------------------------------------------------------------------
1      0x1234567890abcdef1234567890abcdef12345678         1000000000000000000000
2      0xabcdef1234567890abcdef1234567890abcdef12          500000000000000000000
3      0x7890abcdef1234567890abcdef1234567890abcd          250000000000000000000
...
================================================================================
Total holders shown: 100

💾 Results saved to: top-100-holders-2025-10-16T12-30-45.json

✅ Done!
```

## Output File Format

The JSON file contains:

```json
{
  "timestamp": "2025-10-16T12:30:45.123Z",
  "tokenAddress": "0x...",
  "network": "BSC",
  "totalHolders": 100,
  "holders": [
    {
      "rank": 1,
      "address": "0x...",
      "balance": "1000000000000000000000"
    }
  ]
}
```

## API Details

This script uses the **Etherscan V2 API** - a unified multichain API that works across 50+ EVM chains with a single API key.

**Endpoint:**

```
https://api.etherscan.io/v2/api?chainid=56&module=token&action=tokenholderlist&contractaddress={TOKEN}&page=1&offset=100&apikey={KEY}
```

**Key Parameters:**

- `chainid=56` - BSC (BNB Smart Chain) network identifier
- Use the same Etherscan API key for all supported chains

**Response Format:**

- `TokenHolderAddress`: The wallet address
- `TokenHolderQuantity`: The token balance (in smallest unit)

## Notes

### Token Balance Format

- Balances are returned in the token's smallest decimal representation
- For example, a token with 18 decimals:
  - `1000000000000000000` = 1 token
  - `500000000000000000` = 0.5 tokens

### Rate Limits

- Etherscan free tier: 5 calls/second
- This script makes 1 API call total

### Getting an Etherscan V2 API Key

1. Visit https://etherscan.io/apis
2. Sign up for a free account
3. Generate an API key
4. Add it to your `.env` file
5. The same key works for BSC and 50+ other EVM chains

## Troubleshooting

### "Etherscan API error"

- Verify your BSC token address is correct
- Check your Etherscan API key is valid
- Ensure the token exists on BSC mainnet
- Make sure you're using the V2 API endpoint with chainid=56

### "No holders found"

- The token might not have any holders yet
- Check if the token address is correct
- Make sure you're using a BSC mainnet address

### "Network error"

- Check your internet connection
- Etherscan API might be temporarily down
- Try again in a few moments

## File Structure

```
├── package.json          # Dependencies
├── .env                  # Configuration (not committed)
├── env.example           # Configuration template
├── .gitignore           # Git ignore rules
├── index.js             # Main script
└── README.md            # This file
```

## License

MIT
