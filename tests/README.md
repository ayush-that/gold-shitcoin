# Test Suite

Comprehensive test coverage for BNB → PAXG distribution system.

## Test Structure

### Unit Tests

- **bridge.test.js** - DLN bridge integration tests
  - BNB balance fetching
  - DLN order creation
  - Retry logic and fallback hosts
  - Error handling (4xx, 5xx)
- **holders.test.js** - Moralis API integration tests
  - Top 100 holders fetching
  - Pagination handling
  - Sorting by balance
  - Metadata inclusion

- **orchestrator.test.js** - Distribution cycle orchestration tests
  - Balance gating (< 1 BNB skip)
  - Proportional share calculation
  - Minimum threshold enforcement (0.003 BNB)
  - Concurrent batch processing
  - 95% distribution / 5% reserve
  - Partial failure handling

### Integration Tests

- **integration.test.js** - End-to-end flow tests
  - Express API endpoints
  - Full distribution cycle
  - Error scenarios
  - Concurrency control

## Running Tests

### Run All Tests

```bash
pnpm test
```

### Watch Mode (Development)

```bash
pnpm test:watch
```

### Interactive UI

```bash
pnpm test:ui
```

### Coverage Report

```bash
pnpm test:coverage
```

## Test Coverage

The test suite validates:

✅ **Core Functionality**

- BNB balance checking
- Top 100 holder fetching from Moralis
- DLN order creation and submission
- Proportional distribution calculation
- 95%/5% split enforcement

✅ **Edge Cases**

- Low balance (< 1 BNB) skip
- Holders below minimum (< 0.003 BNB) skip
- Empty holder lists
- API pagination
- Retry logic on failures

✅ **Error Handling**

- DLN API errors (4xx, 5xx)
- Moralis API errors
- RPC errors
- Partial transaction failures
- Concurrent request conflicts

✅ **Performance**

- Concurrent batch processing (3 at a time)
- Batch delays (2s spacing)
- Timeout handling

## Test Data

Tests use mocked data to simulate:

- Various BNB balances (0.5, 1.0, 10.0, 100.0)
- Different holder distributions
- API responses and errors
- Transaction confirmations

## CI/CD Ready

All tests are:

- Isolated (no external dependencies)
- Fast (fully mocked)
- Deterministic (no flakiness)
- Comprehensive (high coverage)

Run before deployment to ensure system integrity.
