# @joshre/beaconed-api-client

TypeScript HTTP client for the [Beaconed](https://beaconed.ai) v1 API. This is the shared library that `beaconed-mcp` and `beaconed-cli` depend on — it wraps every endpoint in the Beaconed v1 spec, handles API-key auth, typed error classes, automatic retries with `Retry-After` respect, and async pagination iterators so callers never need to handle raw HTTP.

> Status: alpha, expect breaking changes before 1.0.

## Install

```
pnpm add @joshre/beaconed-api-client
```

## Quickstart

```typescript
import { BeaconedClient } from '@joshre/beaconed-api-client';

const client = new BeaconedClient({ apiKey: process.env.BEACONED_API_KEY! });

// List products (first page)
const page = await client.products.list({ per_page: 25 });
console.log(page.data);

// Auto-paginate all products
for await (const product of client.products.listAll()) {
  console.log(product.id, product.title);
}
```

Get your API key at [beaconed.ai](https://beaconed.ai) under Settings > API Keys.
