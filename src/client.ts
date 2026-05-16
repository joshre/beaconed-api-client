/**
 * BeaconedClient — the main entry point for the @joshre/beaconed-api-client library.
 *
 * ## Authentication
 *
 * All API requests require authentication via the `Authorization` header. Two methods are supported:
 *
 * **API Key (recommended)**: Pass your API key directly as a Bearer token.
 *
 * ```
 * Authorization: Bearer <your-api-key>
 * ```
 *
 * **JWT Token**: Generate a JWT from your API key and pass it as a Bearer token.
 *
 * ```
 * Authorization: Bearer <your-jwt-token>
 * ```
 *
 * Generate API keys in your Beaconed dashboard under Settings > API Keys.
 *
 * @see https://beaconed.ai/docs
 */

import { ProductsResource } from './resources/products.js';
import { VERSION } from './version.js';

export interface BeaconedClientConfig {
  apiKey: string;
  baseUrl?: string;
  userAgent?: string;
}

export class BeaconedClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly userAgent: string;
  readonly products: ProductsResource;

  constructor(config: BeaconedClientConfig) {
    if (!config.apiKey) {
      throw new Error('BeaconedClient: apiKey is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://beaconed.ai').replace(/\/$/, '');
    this.userAgent =
      config.userAgent ?? `@joshre/beaconed-api-client/${VERSION}`;
    this.products = new ProductsResource(this);
  }
}
