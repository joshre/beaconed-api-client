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
  Product,
  ProductDetail,
  ProductListParams,
  ProductScoreListParams,
  ProductOptimizationListParams,
  Image,
  OptimizationSummary,
  ScoreHistorySummary,
} from './resources/products.js';

export type {
  Optimization,
  OptimizationDetail,
  OptimizationListParams,
} from './resources/optimizations.js';

export type {
  Score,
  ScoreDetail,
  ScoreListParams,
} from './resources/scores.js';

export type { Settings } from './resources/settings.js';

export type {
  Webhook,
  WebhookDetail,
  WebhookEvent,
  WebhookListParams,
  WebhookEventsParams,
} from './resources/webhooks.js';
