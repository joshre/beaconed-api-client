/**
 * BeaconedClient — placeholder for M1 implementation.
 *
 * The full HTTP layer, resource namespaces, retry logic, and pagination
 * iterators land in Milestone 1. This stub is enough to prove the toolchain
 * compiles and the smoke test passes.
 */

export interface BeaconedClientOptions {
  apiKey: string;
  baseUrl?: string;
  xClient?: string;
  timeout?: number;
  maxRetries?: number;
}

export class BeaconedClient {
  readonly config: BeaconedClientOptions;

  constructor(options: BeaconedClientOptions) {
    this.config = {
      baseUrl: 'https://beaconed.ai',
      timeout: 30_000,
      maxRetries: 3,
      ...options,
    };
  }
}
