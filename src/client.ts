/**
 * BeaconedClient — the main entry point for the @beaconed/api-client library.
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
import { OptimizationsResource } from './resources/optimizations.js';
import { BulkOptimizationsResource } from './resources/bulk-optimizations.js';
import { ScoresResource } from './resources/scores.js';
import { SettingsResource } from './resources/settings.js';
import { WebhooksResource } from './resources/webhooks.js';
import { VERSION } from './version.js';

export interface BeaconedClientConfig {
  apiKey: string;
  baseUrl?: string;
  userAgent?: string;
  /**
   * Identifies the calling client to the API. Sent as the `X-Client` header,
   * which the server validates (`/^[a-z0-9][a-z0-9._-]{0,63}$/`, lowercased,
   * capped at 64 chars) and records as the source of each request. Set this to
   * a stable slug per integration, e.g. "beaconed-mcp" or "beaconed-cli".
   * When omitted, no `X-Client` header is sent and the request is unattributed.
   */
  clientId?: string;
}

export class BeaconedClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly userAgent: string;
  readonly clientId: string | undefined;
  readonly products: ProductsResource;
  readonly optimizations: OptimizationsResource;
  readonly bulkOptimizations: BulkOptimizationsResource;
  readonly scores: ScoresResource;
  readonly settings: SettingsResource;
  readonly webhooks: WebhooksResource;

  constructor(config: BeaconedClientConfig) {
    if (!config.apiKey) {
      throw new Error('BeaconedClient: apiKey is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://beaconed.ai').replace(/\/$/, '');
    this.userAgent =
      config.userAgent ?? `@beaconed/api-client/${VERSION}`;
    this.clientId = config.clientId;
    this.products = new ProductsResource(this);
    this.optimizations = new OptimizationsResource(this);
    this.bulkOptimizations = new BulkOptimizationsResource(this);
    this.scores = new ScoresResource(this);
    this.settings = new SettingsResource(this);
    this.webhooks = new WebhooksResource(this);
  }
}
