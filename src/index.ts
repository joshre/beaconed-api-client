// Public API surface for @joshre/beaconed-api-client

export { BeaconedClient } from './client.js';
export type { BeaconedClientConfig } from './client.js';

export {
  BeaconedError,
  BeaconedAuthError,
  BeaconedForbiddenError,
  BeaconedNotFoundError,
  BeaconedValidationError,
  BeaconedRateLimitError,
  BeaconedServerError,
  BeaconedNetworkError,
} from './errors.js';
export type { ErrorCode } from './errors.js';

export type { PageInfo } from './pagination.js';

export type {
  ProductDetail,
  Image,
  OptimizationSummary,
  ScoreHistorySummary,
} from './resources/products.js';
