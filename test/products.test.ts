/**
 * Tests for ProductsResource — list, scores, optimizations, listAll
 * get() is tested here too since it lives on the same resource.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeaconedClient } from '../src/client.js';
import { BeaconedNotFoundError } from '../src/errors.js';
import type { Product } from '../src/resources/products.js';

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

const sampleProduct: Product = {
  id: 'prod-1',
  shopify_id: 12345,
  title: 'Test Product',
  handle: 'test-product',
  status: 'active',
  vendor: 'TestVendor',
  product_type: 'Widget',
  readiness_score: 80,
  readiness_grade: 'good',
  optimization_status: null,
  pending_optimizations_count: 0,
  primary_image_url: null,
  last_synced_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('ProductsResource.list()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/products and returns data + pageInfo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [sampleProduct] }, paginationHeaders(1, 25, 1, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = makeClient();
    const result = await client.products.list();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/products');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
    expect((init.headers as Record<string, string>)['Accept']).toBe('application/json');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/@joshre\/beaconed-api-client/);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('prod-1');
    expect(result.pageInfo.page).toBe(1);
    expect(result.pageInfo.total).toBe(1);
  });

  it('passes filter params as query string', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [] }, paginationHeaders(1, 25, 0, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().products.list({ status: 'active', min_score: 50, grade: 'good', q: 'shirt' });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('status=active');
    expect(url).toContain('min_score=50');
    expect(url).toContain('grade=good');
    expect(url).toContain('q=shirt');
  });

  it('passes page and per_page params', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [] }, paginationHeaders(2, 10, 50, 5)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().products.list({ page: 2, per_page: 10 });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('page=2');
    expect(url).toContain('per_page=10');
    expect(result.pageInfo.page).toBe(2);
    expect(result.pageInfo.totalPages).toBe(5);
  });
});

describe('ProductsResource.get()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/products/{id} and returns ProductDetail', async () => {
    const detail = { ...sampleProduct, description: 'A widget', images: [], options: [], score_history: [] };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: detail }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().products.get('prod-1');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/products/prod-1');
    expect(result.id).toBe('prod-1');
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().products.get('nonexistent')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('ProductsResource.scores()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/products/{id}/scores and returns data + pageInfo', async () => {
    const scoreItem = { overall_score: 75, grade: 'good', scored_at: '2026-01-01T00:00:00Z', score_change: null };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [scoreItem] }, paginationHeaders(1, 25, 1, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().products.scores('prod-1');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/products/prod-1/scores');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].overall_score).toBe(75);
    expect(result.pageInfo.total).toBe(1);
  });

  it('passes since, until, grade params', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [] }, paginationHeaders(1, 25, 0, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().products.scores('prod-1', { since: '2026-01-01T00:00:00Z', grade: 'good' });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('since=');
    expect(url).toContain('grade=good');
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().products.scores('nonexistent')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('ProductsResource.optimizations()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/optimizations?product_id={id} and returns data + pageInfo', async () => {
    const optItem = { id: 'opt-1', field: 'title', status: 'pending', created_at: '2026-01-01T00:00:00Z' };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [optItem] }, paginationHeaders(1, 25, 1, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().products.optimizations('prod-1');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/optimizations');
    expect(url).toContain('product_id=prod-1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('opt-1');
  });

  it('passes status and field filters alongside product_id', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [] }, paginationHeaders(1, 25, 0, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().products.optimizations('prod-1', { status: 'pending', field: 'title' });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('product_id=prod-1');
    expect(url).toContain('status=pending');
    expect(url).toContain('field=title');
  });
});

describe('ProductsResource.listAll()', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('yields all products across pages via listAll()', async () => {
    const products1 = [{ ...sampleProduct, id: 'p1' }, { ...sampleProduct, id: 'p2' }];
    const products2 = [{ ...sampleProduct, id: 'p3' }];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(200, { data: products1 }, paginationHeaders(1, 2, 3, 2)),
      )
      .mockResolvedValueOnce(
        makeResponse(200, { data: products2 }, paginationHeaders(2, 2, 3, 2)),
      );
    vi.stubGlobal('fetch', fetchMock);

    const collected: string[] = [];
    for await (const p of makeClient().products.listAll()) {
      collected.push(p.id);
    }

    expect(collected).toEqual(['p1', 'p2', 'p3']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
