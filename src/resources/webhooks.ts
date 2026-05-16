/**
 * WebhooksResource — GET /api/v1/webhooks, /api/v1/webhooks/{id}
 *
 * Types derived from openapi/v1.yaml:
 *   Webhook      (lines 415-442)
 *   WebhookDetail (lines 444-460)
 *   WebhookEvent  (lines 485-492)
 *
 * Spec-backed GET endpoints:
 *   GET /api/v1/webhooks           (lines 1111-1138)
 *   GET /api/v1/webhooks/{id}      (lines 1187-1211)
 *   GET /api/v1/webhooks/events    (lines 1304-1325) — global event catalog, no {id}
 *
 * Task-requested endpoint (SPEC-ABSENT — per-webhook delivery log not in openapi/v1.yaml):
 *   webhooks.events(id, params?) — would be GET /api/v1/webhooks/{id}/events
 *   TODO: verify with API team whether per-webhook delivery history exists.
 *   Implemented as a stub that calls the global /api/v1/webhooks/events endpoint
 *   ignoring the id until the spec is updated.
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
