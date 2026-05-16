# @joshre/beaconed-api-client

TypeScript HTTP client for the [Beaconed](https://beaconed.ai) v1 API. This is the shared library that `beaconed-mcp` and `beaconed-cli` depend on — it wraps every endpoint in the Beaconed v1 spec, handles API-key auth, typed error classes, automatic retries with `Retry-After` respect, and async pagination iterators so callers never need to handle raw HTTP.

> Status: alpha, expect breaking changes before 1.0.

## Install

```
pnpm add @joshre/beaconed-api-client
```

## Quickstart

Get your API key at [beaconed.ai/docs](https://beaconed.ai/docs) under Settings > API Keys.

```typescript
import { BeaconedClient } from '@joshre/beaconed-api-client';

const beaconed = new BeaconedClient({ apiKey: process.env.BEACONED_API_KEY! });

// Fetch a single product by ID
const product = await beaconed.products.get('abc-123');
console.log(product.title, product.readiness_score);
```

## Error handling

```typescript
import { BeaconedClient, BeaconedNotFoundError, BeaconedValidationError } from '@joshre/beaconed-api-client';

const beaconed = new BeaconedClient({ apiKey: process.env.BEACONED_API_KEY! });

try {
  const product = await beaconed.products.get('bad-id');
} catch (err) {
  if (err instanceof BeaconedNotFoundError) {
    console.error('Product not found');
  } else if (err instanceof BeaconedValidationError) {
    console.error('Validation errors:', err.validationErrors);
  } else {
    throw err;
  }
}
```

## Authentication

Pass your API key directly — no JWT exchange required:

```typescript
const beaconed = new BeaconedClient({
  apiKey: 'your_api_key_here',
  baseUrl: 'https://beaconed.ai', // default; override for local dev
});
```

## Error classes

| Class | Status | Description |
|-------|--------|-------------|
| `BeaconedAuthError` | 401 | Missing or invalid API key |
| `BeaconedForbiddenError` | 403 | Valid key, insufficient permissions |
| `BeaconedNotFoundError` | 404 | Resource not found |
| `BeaconedValidationError` | 422 | Validation failed — check `.validationErrors` |
| `BeaconedRateLimitError` | 429 | Rate limited — check `.retryAfterSeconds` |
| `BeaconedServerError` | 5xx | Server error |
| `BeaconedNetworkError` | 0 | Network failure (fetch threw) |

All classes extend `BeaconedError` which extends `Error`.
