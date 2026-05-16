/**
 * WebhooksResource — /api/v1/webhooks endpoints
 *
 * Types derived from openapi/v1.yaml:
 *   Webhook           (lines 415-442)
 *   WebhookDetail     (lines 444-460)
 *   WebhookCreate     (lines 461-484)
 *   WebhookEvent      (lines 485-492)
 *   WebhookWithSecret (M3a — webhook create response, secret shown once)
 *
 * Spec-backed GET endpoints:
 *   GET    /api/v1/webhooks           (lines 1111-1138)
 *   GET    /api/v1/webhooks/{id}      (lines 1187-1211)
 *   GET    /api/v1/webhooks/events    (lines 1304-1325)
 *
 * Mutation endpoints (M3a):
 *   POST   /api/v1/webhooks           (lines 1140-1185)
 *   PATCH  /api/v1/webhooks/{id}      (lines 1212-1254)
 *   DELETE /api/v1/webhooks/{id}      (lines 1256-1272) — 204 No Content
 *   POST   /api/v1/webhooks/{id}/test (lines 1273-1302)
 *
 * SPEC-ABSENT GET endpoint (per-webhook delivery log):
 *   webhooks.events(id, params?) — would be GET /api/v1/webhooks/{id}/events
 *   TODO: verify with API team. Currently maps to global event catalog.
 */

import { request } from '../http.js';
import { paginate } from '../pagination.js';
import type { BeaconedClient } from '../client.js';
import type { PageInfo } from '../pagination.js';

// From openapi/v1.yaml components/schemas/Webhook (lines 415-442)
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'paused' | 'disabled';
  failure_count: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

// From openapi/v1.yaml components/schemas/WebhookDetail (lines 444-460)
export interface WebhookDetail extends Webhook {
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
}

// From openapi/v1.yaml components/schemas/WebhookEvent (lines 485-492)
export interface WebhookEvent {
  name: string;
  description: string;
}

// From openapi/v1.yaml components/schemas/WebhookCreate (lines 461-484)
// Used for POST /api/v1/webhooks request body.
export interface WebhookCreateInput {
  /** HTTPS URL to receive webhook deliveries */
  url: string;
  /** Events to subscribe to */
  events: Array<
    | 'optimization.created'
    | 'optimization.approved'
    | 'optimization.rejected'
    | 'optimization.applied'
    | 'optimization.reverted'
    | 'product.scored'
    | 'product.synced'
  >;
}

// Used for PATCH /api/v1/webhooks/:id — all fields optional
export interface WebhookUpdateInput {
  url?: string;
  events?: string[];
  status?: 'active' | 'paused';
}

/**
 * Response type for POST /api/v1/webhooks.
 * The secret is only included in the CREATE response — it is never returned again.
 * Store it securely on first receipt. Spec: openapi/v1.yaml lines 1165-1172.
 */
export interface WebhookWithSecret extends WebhookDetail {
  /** Signing secret for verifying webhook payloads. SHOWN ONLY ONCE on creation. */
  secret: string;
}

// Response type for POST /api/v1/webhooks/:id/test (spec lines 1293-1302)
export interface WebhookTestResult {
  message: string;
  webhook_id: string;
}

// Query parameters for GET /api/v1/webhooks (spec lines 1119-1127)
export interface WebhookListParams {
  page?: number;
  per_page?: number;
}

// Query parameters for per-webhook events (SPEC-ABSENT)
// TODO: verify with API team
export interface WebhookEventsParams {
  page?: number;
  per_page?: number;
}

export class WebhooksResource {
  constructor(private readonly client: BeaconedClient) {}

  /**
   * GET /api/v1/webhooks
   * Returns webhooks registered for the current API key.
   */
  async list(
    params?: WebhookListParams,
    opts?: { signal?: AbortSignal },
  ): Promise<{ data: Webhook[]; pageInfo: PageInfo }> {
    const envelope = await request<Webhook[]>(this.client, {
      method: 'GET',
      path: '/api/v1/webhooks',
      query: params as Record<string, string | number | undefined>,
      signal: opts?.signal,
    });
    return { data: envelope.data, pageInfo: envelope.pageInfo! };
  }

  /**
   * GET /api/v1/webhooks/{id}
   * Returns details about a specific webhook subscription.
   */
  async get(id: string, opts?: { signal?: AbortSignal }): Promise<WebhookDetail> {
    const envelope = await request<WebhookDetail>(this.client, {
      method: 'GET',
      path: `/api/v1/webhooks/${encodeURIComponent(id)}`,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * POST /api/v1/webhooks
   * Creates a new webhook subscription. Returns 201 with WebhookWithSecret.
   * The `secret` field is present ONLY in this response — store it securely.
   * Spec: openapi/v1.yaml lines 1140-1185.
   */
  async create(
    input: WebhookCreateInput,
    opts?: { signal?: AbortSignal },
  ): Promise<WebhookWithSecret> {
    const envelope = await request<WebhookWithSecret>(this.client, {
      method: 'POST',
      path: '/api/v1/webhooks',
      body: { webhook: input },
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * PATCH /api/v1/webhooks/:id
   * Updates a webhook subscription. Returns updated WebhookDetail.
   * Spec: openapi/v1.yaml lines 1212-1254.
   */
  async update(
    id: string,
    input: WebhookUpdateInput,
    opts?: { signal?: AbortSignal },
  ): Promise<WebhookDetail> {
    const envelope = await request<WebhookDetail>(this.client, {
      method: 'PATCH',
      path: `/api/v1/webhooks/${encodeURIComponent(id)}`,
      body: { webhook: input },
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * DELETE /api/v1/webhooks/:id
   * Removes a webhook subscription. Returns 204 No Content.
   * The HTTP wrapper returns undefined for empty 204 bodies; this method returns void.
   * Spec: openapi/v1.yaml lines 1256-1272.
   */
  async delete(id: string, opts?: { signal?: AbortSignal }): Promise<void> {
    await request<undefined>(this.client, {
      method: 'DELETE',
      path: `/api/v1/webhooks/${encodeURIComponent(id)}`,
      signal: opts?.signal,
    });
    // 204 No Content — envelope.data is undefined; return void explicitly
  }

  /**
   * POST /api/v1/webhooks/:id/test
   * Sends a test event to the webhook. Returns 202 (queued).
   * Spec: openapi/v1.yaml lines 1273-1302.
   */
  async test(id: string, opts?: { signal?: AbortSignal }): Promise<WebhookTestResult> {
    const envelope = await request<WebhookTestResult>(this.client, {
      method: 'POST',
      path: `/api/v1/webhooks/${encodeURIComponent(id)}/test`,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * GET /api/v1/webhooks/events
   * Returns all available webhook event types.
   *
   * Note: The spec (lines 1304-1325) defines this as a global catalog endpoint
   * (GET /api/v1/webhooks/events), not a per-webhook delivery log.
   * The `id` parameter is accepted for API compatibility but is not used in the
   * request path — the global catalog has no per-webhook variant in the spec.
   *
   * SPEC-ABSENT for per-webhook delivery log:
   * If GET /api/v1/webhooks/{id}/events (delivery history) is needed,
   * that endpoint is not defined in openapi/v1.yaml.
   * TODO: verify with API team.
   */
  async events(
    _id?: string,
    _params?: WebhookEventsParams,
    opts?: { signal?: AbortSignal },
  ): Promise<{ data: WebhookEvent[]; pageInfo: PageInfo }> {
    const envelope = await request<{ events: WebhookEvent[] }>(this.client, {
      method: 'GET',
      path: '/api/v1/webhooks/events',
      signal: opts?.signal,
    });
    // Spec returns { data: { events: [...] } } — unwrap inner events array
    const eventsArray = (envelope.data as { events?: WebhookEvent[] }).events ?? [];
    return {
      data: eventsArray,
      // Global events catalog has no pagination headers; provide a synthetic PageInfo
      pageInfo: envelope.pageInfo ?? {
        page: 1,
        perPage: eventsArray.length,
        total: eventsArray.length,
        totalPages: 1,
      },
    };
  }

  /**
   * Async iterator that yields all webhooks across all pages.
   */
  listAll(
    params?: Omit<WebhookListParams, 'page'>,
    opts?: { signal?: AbortSignal },
  ): AsyncGenerator<Webhook> {
    return paginate((page) =>
      this.list({ ...params, page }, opts),
    );
  }
}
