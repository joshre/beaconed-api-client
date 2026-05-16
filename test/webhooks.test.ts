/**
 * Tests for WebhooksResource — list, get, events, listAll,
 * create, update, delete, test (M3a mutations)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { BeaconedClient } from '../src/client.js';
import { BeaconedNotFoundError, BeaconedValidationError } from '../src/errors.js';
import type { Webhook, WebhookDetail, WebhookWithSecret } from '../src/resources/webhooks.js';

function makeClient(): BeaconedClient {
  return new BeaconedClient({ apiKey: 'test-key', baseUrl: 'https://beaconed.ai' });
}

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function paginationHeaders(
  page: number,
  perPage: number,
  total: number,
  totalPages: number,
): Record<string, string> {
  return {
    'X-Page': String(page),
    'X-Per-Page': String(perPage),
    'X-Total': String(total),
    'X-Total-Pages': String(totalPages),
  };
}

const sampleWebhook: Webhook = {
  id: 'wh-1',
  url: 'https://example.com/webhooks',
  events: ['optimization.applied', 'product.scored'],
  status: 'active',
  failure_count: 0,
  last_triggered_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const sampleWebhookDetail: WebhookDetail = {
  ...sampleWebhook,
  last_success_at: null,
  last_failure_at: null,
  last_error: null,
};

describe('WebhooksResource.list()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/webhooks and returns data + pageInfo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [sampleWebhook] }, paginationHeaders(1, 25, 1, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.list();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/webhooks');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
    expect((init.headers as Record<string, string>)['Accept']).toBe('application/json');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/@joshre\/beaconed-api-client/);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('wh-1');
    expect(result.pageInfo.total).toBe(1);
  });

  it('passes page and per_page params', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [] }, paginationHeaders(2, 10, 5, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().webhooks.list({ page: 2, per_page: 10 });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('page=2');
    expect(url).toContain('per_page=10');
  });
});

describe('WebhooksResource.get()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/webhooks/{id} and returns WebhookDetail', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: sampleWebhookDetail }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.get('wh-1');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/webhooks/wh-1');
    expect(result.id).toBe('wh-1');
    expect(result.last_error).toBeNull();
    expect(result.events).toEqual(['optimization.applied', 'product.scored']);
  });

  it('sends Authorization, User-Agent, and Accept headers', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: sampleWebhookDetail }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().webhooks.get('wh-1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-key');
    expect(headers['Accept']).toBe('application/json');
    expect(headers['User-Agent']).toMatch(/@joshre\/beaconed-api-client/);
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().webhooks.get('nonexistent')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('WebhooksResource.events()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/webhooks/events and returns event catalog', async () => {
    const eventsPayload = {
      events: [
        { name: 'optimization.created', description: 'An optimization was created' },
        { name: 'optimization.applied', description: 'An optimization was applied' },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: eventsPayload }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.events();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/webhooks/events');
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('optimization.created');
  });

  it('accepts an id argument (unused; maps to global event catalog)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: { events: [] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    // id is accepted for API compatibility but not used in URL routing
    const result = await makeClient().webhooks.events('wh-1');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/webhooks/events');
    expect(result.data).toEqual([]);
  });

  it('provides a synthetic PageInfo when response has no pagination headers', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: { events: [{ name: 'product.scored', description: 'desc' }] } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.events();
    expect(result.pageInfo.page).toBe(1);
    expect(result.pageInfo.total).toBe(1);
    expect(result.pageInfo.totalPages).toBe(1);
  });
});

describe('WebhooksResource.listAll()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('yields all webhooks across pages via listAll()', async () => {
    const wh2 = { ...sampleWebhook, id: 'wh-2' };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(200, { data: [sampleWebhook] }, paginationHeaders(1, 1, 2, 2)),
      )
      .mockResolvedValueOnce(
        makeResponse(200, { data: [wh2] }, paginationHeaders(2, 1, 2, 2)),
      );
    vi.stubGlobal('fetch', fetchMock);

    const collected: string[] = [];
    for await (const wh of makeClient().webhooks.listAll()) {
      collected.push(wh.id);
    }

    expect(collected).toEqual(['wh-1', 'wh-2']);
  });
});

// ---- M3a mutation tests ----

describe('WebhooksResource.create()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/v1/webhooks with wrapped body and returns WebhookWithSecret', async () => {
    const created: WebhookWithSecret = {
      ...sampleWebhookDetail,
      id: 'wh-new',
      secret: 'whsec_abc123def456',
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(201, { data: created }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.create({
      url: 'https://example.com/webhooks',
      events: ['optimization.applied', 'product.scored'],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/webhooks');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toHaveProperty('webhook');
    const webhook = body['webhook'] as Record<string, unknown>;
    expect(webhook['url']).toBe('https://example.com/webhooks');
    expect(webhook['events']).toEqual(['optimization.applied', 'product.scored']);
    expect(result.id).toBe('wh-new');
  });

  it('secret field is present and is a non-empty string', async () => {
    const created: WebhookWithSecret = {
      ...sampleWebhookDetail,
      secret: 'whsec_xyz789',
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(201, { data: created }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.create({
      url: 'https://example.com/webhooks',
      events: ['product.synced'],
    });

    expect(typeof result.secret).toBe('string');
    expect(result.secret.length).toBeGreaterThan(0);
    expect(result.secret).toBe('whsec_xyz789');
  });

  it('throws BeaconedValidationError on 422 with errors array', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(422, {
        success: false,
        error: 'Validation failed',
        errors: ['URL must be HTTPS', 'Events cannot be empty'],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    let caught: unknown;
    try {
      await makeClient().webhooks.create({ url: 'http://insecure.com', events: [] });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BeaconedValidationError);
    const ve = caught as BeaconedValidationError;
    expect(ve.validationErrors).toContain('URL must be HTTPS');
    expect(ve.validationErrors).toContain('Events cannot be empty');
  });
});

describe('WebhooksResource.update()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls PATCH /api/v1/webhooks/:id with wrapped body and returns WebhookDetail', async () => {
    const updated: WebhookDetail = { ...sampleWebhookDetail, status: 'paused' };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: updated }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.update('wh-1', { status: 'paused' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/webhooks/wh-1');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect((body['webhook'] as Record<string, unknown>)['status']).toBe('paused');
    expect(result.status).toBe('paused');
  });

  it('allows partial updates (events only)', async () => {
    const updated: WebhookDetail = { ...sampleWebhookDetail, events: ['optimization.applied'] };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: updated }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.update('wh-1', { events: ['optimization.applied'] });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect((body['webhook'] as Record<string, unknown>)['events']).toEqual(['optimization.applied']);
    expect(result.events).toEqual(['optimization.applied']);
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().webhooks.update('no-such', {})).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('WebhooksResource.delete()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls DELETE /api/v1/webhooks/:id and returns void on 204', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.delete('wh-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/webhooks/wh-1');
    expect(init.method).toBe('DELETE');
    expect(result).toBeUndefined();
  });

  it('URL-encodes the webhook id', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().webhooks.delete('wh/1 2');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/webhooks/wh%2F1%202');
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().webhooks.delete('no-such')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('WebhooksResource.test()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/v1/webhooks/:id/test and returns WebhookTestResult', async () => {
    const testResult = { message: 'Test queued', webhook_id: 'wh-1' };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: testResult }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().webhooks.test('wh-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/webhooks/wh-1/test');
    expect(init.method).toBe('POST');
    expect(result.message).toBe('Test queued');
    expect(result.webhook_id).toBe('wh-1');
  });

  it('sends no body (test has no request body)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: { message: 'ok', webhook_id: 'x' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().webhooks.test('x');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().webhooks.test('no-such')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});
