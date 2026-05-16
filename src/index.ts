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
  ProductCreateInput,
  ProductUpdateInput,
  ProductSyncResult,
  ProductOptimizeInput,
  ProductOptimizeResult,
  Image,
  OptimizationSummary,
  ScoreHistorySummary,
} from './resources/products.js';

export type {
  Optimization,
  OptimizationDetail,
  OptimizationListParams,
  OptimizationRejectInput,
  OptimizationApplyResult,
  OptimizationRevertResult,
} from './resources/optimizations.js';

export type {
  Score,
  ScoreDetail,
  ScoreCalculationResult,
  ScoreListParams,
} from './resources/scores.js';

export type { Settings } from './resources/settings.js';

export type {
  Webhook,
  WebhookDetail,
  WebhookEvent,
  WebhookCreateInput,
  WebhookUpdateInput,
  WebhookWithSecret,
  WebhookTestResult,
  WebhookListParams,
  WebhookEventsParams,
} from './resources/webhooks.js';
