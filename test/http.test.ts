import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request } from '../src/http.js';
import { BeaconedClient } from '../src/client.js';
import {
  BeaconedAuthError,
  BeaconedValidationError,
  BeaconedRateLimitError,
  BeaconedServerError,
  BeaconedNetworkError,
} from '../src/errors.js';

// Helper to build a Response with optional headers and body
function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const bodyStr = body !== undefined ? JSON.stringify(body) : '';
  return new Response(bodyStr, {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function makeClient(overrides?: { baseUrl?: string; clientId?: string }): BeaconedClient {
  return new BeaconedClient({
    apiKey: 'test-api-key',
    baseUrl: overrides?.baseUrl ?? 'https://beaconed.ai',
    clientId: overrides?.clientId,
  });
}

describe('request()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns unwrapped data on 200 with { data: ... } envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: { id: 'x', title: 'Test' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await request<{ id: string; title: string }>(makeClient(), {
      method: 'GET',
      path: '/api/v1/products/x',
    });

    expect(result.data).toEqual({ id: 'x', title: 'Test' });
  });

  it('sends Authorization and Accept headers', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: {} }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await request(makeClient(), { method: 'GET', path: '/api/v1/products' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-api-key');
    expect(headers['Accept']).toBe('application/json');
  });

  it('sends X-Client header when clientId is set', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeClient({ clientId: 'beaconed-mcp' }), {
      method: 'GET',
      path: '/api/v1/products',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Client']).toBe('beaconed-mcp');
  });

  it('omits X-Client header when clientId is not set', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeClient(), { method: 'GET', path: '/api/v1/products' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Client']).toBeUndefined();
  });

  it('does not send Content-Type when no body', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeClient(), { method: 'GET', path: '/api/v1/products' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('sends Content-Type when body is present', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(201, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeClient(), {
      method: 'POST',
      path: '/api/v1/products',
      body: { product: { title: 'New' } },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('builds query string from query param', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(200, { data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeClient(), {
      method: 'GET',
      path: '/api/v1/products',
      query: { page: 2, per_page: 10 },
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('page=2');
    expect(url).toContain('per_page=10');
  });

  it('skips undefined query params', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(200, { data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await request(makeClient(), {
      method: 'GET',
      path: '/api/v1/products',
      query: { page: 1, status: undefined },
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('status');
  });

  it('throws BeaconedAuthError on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(401, { success: false, error: 'Invalid API key', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      request(makeClient(), { method: 'GET', path: '/api/v1/products' }),
    ).rejects.toBeInstanceOf(BeaconedAuthError);
  });

  it('throws BeaconedValidationError on 422 with validationErrors', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(422, {
        success: false,
        error: 'Validation failed',
        errors: ['Title is required'],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    let caught: unknown;
    try {
      await request(makeClient(), {
        method: 'POST',
        path: '/api/v1/products',
        body: {},
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(BeaconedValidationError);
    expect((caught as BeaconedValidationError).validationErrors).toEqual(['Title is required']);
  });

  it('throws BeaconedRateLimitError on 429, retries once, still 429 throws', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(429, { success: false, error: 'Rate limited', errors: [] }, {
          'Retry-After': '5',
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(429, { success: false, error: 'Rate limited', errors: [] }, {
          'Retry-After': '5',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    // Start the request, run all timers (advances past the Retry-After wait), then resolve
    const result = await Promise.allSettled([
      request(makeClient(), { method: 'GET', path: '/api/v1/products' }),
      vi.runAllTimersAsync(),
    ]);

    expect(result[0].status).toBe('rejected');
    expect((result[0] as PromiseRejectedResult).reason).toBeInstanceOf(BeaconedRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('succeeds on second attempt after 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(429, { success: false, error: 'Rate limited', errors: [] }, {
          'Retry-After': '1',
        }),
      )
      .mockResolvedValueOnce(makeResponse(200, { data: { id: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    const [result] = await Promise.allSettled([
      request<{ id: string }>(makeClient(), {
        method: 'GET',
        path: '/api/v1/products/ok',
      }),
      vi.runAllTimersAsync(),
    ]);

    expect(result.status).toBe('fulfilled');
    expect((result as PromiseFulfilledResult<{ data: { id: string } }>).value.data).toEqual({ id: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws BeaconedServerError on 500 after retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(500, { success: false, error: 'Internal server error', errors: [] }),
      )
      .mockResolvedValueOnce(
        makeResponse(500, { success: false, error: 'Internal server error', errors: [] }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.allSettled([
      request(makeClient(), { method: 'GET', path: '/api/v1/products' }),
      vi.runAllTimersAsync(),
    ]);

    expect(results[0].status).toBe('rejected');
    expect((results[0] as PromiseRejectedResult).reason).toBeInstanceOf(BeaconedServerError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('succeeds on second attempt after 500', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(500, { success: false, error: 'Temporary error', errors: [] }),
      )
      .mockResolvedValueOnce(makeResponse(200, { data: { id: 'recovered' } }));
    vi.stubGlobal('fetch', fetchMock);

    const [result] = await Promise.allSettled([
      request<{ id: string }>(makeClient(), {
        method: 'GET',
        path: '/api/v1/products/recovered',
      }),
      vi.runAllTimersAsync(),
    ]);

    expect(result.status).toBe('fulfilled');
    expect((result as PromiseFulfilledResult<{ data: { id: string } }>).value.data).toEqual({ id: 'recovered' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws BeaconedNetworkError when fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      request(makeClient(), { method: 'GET', path: '/api/v1/products' }),
    ).rejects.toBeInstanceOf(BeaconedNetworkError);
  });

  it('does NOT retry on network error', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce(makeResponse(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      request(makeClient(), { method: 'GET', path: '/api/v1/products' }),
    ).rejects.toBeInstanceOf(BeaconedNetworkError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('populates pageInfo from pagination headers', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [] }, {
        'X-Page': '1',
        'X-Per-Page': '25',
        'X-Total': '100',
        'X-Total-Pages': '4',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await request<unknown[]>(makeClient(), {
      method: 'GET',
      path: '/api/v1/products',
    });

    expect(result.pageInfo).toBeDefined();
    expect(result.pageInfo?.page).toBe(1);
    expect(result.pageInfo?.totalPages).toBe(4);
    expect(result.pageInfo?.total).toBe(100);
  });

  it('pageInfo is undefined when headers are absent', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeResponse(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await request(makeClient(), {
      method: 'GET',
      path: '/api/v1/products/x',
    });

    expect(result.pageInfo).toBeUndefined();
  });

  it('populates rateLimitRemaining from X-RateLimit-Remaining header', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: {} }, { 'X-RateLimit-Remaining': '42' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await request(makeClient(), {
      method: 'GET',
      path: '/api/v1/products/x',
    });

    expect(result.rateLimitRemaining).toBe(42);
  });
});
