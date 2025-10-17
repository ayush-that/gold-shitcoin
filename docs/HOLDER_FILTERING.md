# Holder Filtering Implementation

## Overview

The system now automatically filters out LP contracts, routers, and other non-real holders to ensure only actual token holders receive PAXG rewards.

## What Gets Filtered

### 1. **Contract Addresses** (`is_contract: true`)

- All smart contracts are automatically excluded
- Includes LP pairs, routers, vaults, etc.

### 2. **Token Contract Itself**

- The token's own contract address is excluded
- Prevents self-distribution

### 3. **Known Patterns (Label or Address)**

Addresses matching these patterns are skipped:

- `pancake` / `pancakeswap`
- `router`
- `lp` / `liquidity`
- `burn` / `dead`

### 4. **Custom Blacklist** (Optional)

Add addresses to skip via environment variable:

```bash
SKIP_ADDRESSES=0xaddress1,0xaddress2,0xaddress3
```

## How It Works

1. **Fetch Extra Holders**: System fetches up to 150 holders instead of 100
2. **Apply Filters**: Removes all addresses matching skip criteria
3. **Take Top 100**: After filtering, returns the top 100 real holders
4. **Sort by Balance**: Maintains descending balance order

## Example

Before filtering:

```
1. 0xPancakeLP    - 200M tokens (LP contract)
2. 0xRouter       - 150M tokens (Router)
3. 0xHolder1      - 100M tokens (real user)
4. 0xHolder2      -  80M tokens (real user)
...
```

After filtering:

```
1. 0xHolder1      - 100M tokens (real user)
2. 0xHolder2      -  80M tokens (real user)
...
100. 0xHolder100  -   1M tokens (real user)
```

## Configuration

### Required (Already in `.env`)

```bash
MORALIS_API_KEY=your_api_key
BSC_TOKEN_ADDRESS=0xc4d7b23f4d39925b0dd56568e9b83976a6e88888
BNB_PRIVATE_KEY=your_private_key
```

### Optional (New)

```bash
# Comma-separated list of addresses to exclude
SKIP_ADDRESSES=0xBadActor1,0xBadActor2
```

## Testing

Run holder filtering tests:

```bash
# All holder tests
pnpm test tests/holders.test.js

# Specific filtering tests
pnpm test tests/holders.test.js -t "skip contract"
pnpm test tests/holders.test.js -t "skip holders with LP"
pnpm test tests/holders.test.js -t "SKIP_ADDRESSES"
```

## Test Coverage

✅ **Contract Filtering** - Skips addresses marked as contracts  
✅ **Label Filtering** - Skips LP/Pancake/Router labels  
✅ **Token Contract** - Skips the token's own address  
✅ **Custom Blacklist** - Respects SKIP_ADDRESSES env var  
✅ **Top 100 Limit** - Always returns exactly 100 (after filtering)  
✅ **Balance Order** - Maintains descending sort order

## Benefits

1. **Fair Distribution**: Only real holders get rewards
2. **No Waste**: Doesn't send PAXG to LP contracts
3. **Flexible**: Easy to add custom addresses to skip
4. **Automatic**: No manual intervention needed
5. **Tested**: Comprehensive test coverage

## Code Changes

### `holders.js`

- Added `shouldSkipHolder()` function
- Fetches 150 holders, filters, then returns top 100
- Respects `SKIP_ADDRESSES` environment variable

### `env.example`

- Added `SKIP_ADDRESSES` (optional)

### `tests/holders.test.js`

- Added 5 new tests for filtering logic
- Total: 11 tests, all passing ✅
