/**
 * Tests for OptimizationsResource — list, get, listAll,
 * approve, reject, apply, revert (M3a mutations)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { BeaconedClient } from '../src/client.js';
import { BeaconedNotFoundError, BeaconedValidationError } from '../src/errors.js';
import type { Optimization, OptimizationDetail } from '../src/resources/optimizations.js';

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

const sampleOptimization: Optimization = {
  id: 'opt-1',
  product_id: 'prod-1',
  product_title: 'Test Product',
  field: 'title',
  status: 'pending',
  score_before: null,
  score_after: null,
  approved_at: null,
  applied_at: null,
  reverted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const sampleOptimizationDetail: OptimizationDetail = {
  ...sampleOptimization,
  original_content: 'Old Title',
  optimized_content: 'Better Title',
  rejection_reason: null,
  shopify_error: null,
  image_shopify_id: null,
  approved_by_name: null,
};

describe('OptimizationsResource.list()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/optimizations and returns data + pageInfo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [sampleOptimization] }, paginationHeaders(1, 25, 1, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().optimizations.list();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/optimizations');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
    expect((init.headers as Record<string, string>)['Accept']).toBe('application/json');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/@joshre\/beaconed-api-client/);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('opt-1');
    expect(result.pageInfo.total).toBe(1);
  });

  it('passes status and field filters', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [] }, paginationHeaders(1, 25, 0, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().optimizations.list({ status: 'pending', field: 'description', product_id: 'prod-abc' });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('status=pending');
    expect(url).toContain('field=description');
    expect(url).toContain('product_id=prod-abc');
  });

  it('passes since filter', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [] }, paginationHeaders(1, 25, 0, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().optimizations.list({ since: '2026-01-01T00:00:00Z' });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('since=');
  });
});

describe('OptimizationsResource.get()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/optimizations/{id} and returns OptimizationDetail', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: sampleOptimizationDetail }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().optimizations.get('opt-1');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/optimizations/opt-1');
    expect(result.id).toBe('opt-1');
    expect(result.original_content).toBe('Old Title');
    expect(result.optimized_content).toBe('Better Title');
  });

  it('sends Authorization, User-Agent, and Accept headers', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: sampleOptimizationDetail }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().optimizations.get('opt-1');

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

    await expect(makeClient().optimizations.get('nonexistent')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('OptimizationsResource.listAll()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('yields all optimizations across pages', async () => {
    const opt2 = { ...sampleOptimization, id: 'opt-2' };
    const opt3 = { ...sampleOptimization, id: 'opt-3' };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(200, { data: [sampleOptimization, opt2] }, paginationHeaders(1, 2, 3, 2)),
      )
      .mockResolvedValueOnce(
        makeResponse(200, { data: [opt3] }, paginationHeaders(2, 2, 3, 2)),
      );
    vi.stubGlobal('fetch', fetchMock);

    const collected: string[] = [];
    for await (const o of makeClient().optimizations.listAll()) {
      collected.push(o.id);
    }

    expect(collected).toEqual(['opt-1', 'opt-2', 'opt-3']);
  });
});

// ---- M3a mutation tests ----

describe('OptimizationsResource.approve()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/v1/optimizations/:id/approval and returns OptimizationDetail', async () => {
    const approved = { ...sampleOptimizationDetail, status: 'approved' as const, approved_at: '2026-05-16T00:00:00Z' };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: approved }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().optimizations.approve('opt-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/optimizations/opt-1/approval');
    expect(init.method).toBe('POST');
    expect(result.status).toBe('approved');
    expect(result.approved_at).toBe('2026-05-16T00:00:00Z');
  });

  it('sends no body (approval has no request body)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: sampleOptimizationDetail }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().optimizations.approve('opt-1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('throws BeaconedValidationError on 422 (cannot approve wrong status)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(422, {
        success: false,
        error: 'Cannot approve',
        errors: ['Optimization is not in pending status'],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    let caught: unknown;
    try {
      await makeClient().optimizations.approve('opt-1');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BeaconedValidationError);
    const ve = caught as BeaconedValidationError;
    expect(ve.validationErrors).toContain('Optimization is not in pending status');
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().optimizations.approve('no-such')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('OptimizationsResource.reject()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/v1/optimizations/:id/rejection and returns OptimizationDetail', async () => {
    const rejected = { ...sampleOptimizationDetail, status: 'rejected' as const, rejection_reason: 'Does not match brand voice' };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: rejected }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().optimizations.reject('opt-1', { reason: 'Does not match brand voice' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/optimizations/opt-1/rejection');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['reason']).toBe('Does not match brand voice');
    expect(result.status).toBe('rejected');
    expect(result.rejection_reason).toBe('Does not match brand voice');
  });

  it('sends no body when called with no reason', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: sampleOptimizationDetail }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().optimizations.reject('opt-1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // no input passed — body should be undefined
    expect(init.body).toBeUndefined();
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().optimizations.reject('no-such')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('OptimizationsResource.apply()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/v1/optimizations/:id/application and returns apply result', async () => {
    const applyResult = { message: 'Apply queued', optimization_id: 'opt-1' };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: applyResult }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().optimizations.apply('opt-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/optimizations/opt-1/application');
    expect(init.method).toBe('POST');
    expect(result.message).toBe('Apply queued');
    expect(result.optimization_id).toBe('opt-1');
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().optimizations.apply('no-such')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('OptimizationsResource.revert()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/v1/optimizations/:id/reversion and returns revert result', async () => {
    const revertResult = { message: 'Revert queued', optimization_id: 'opt-1' };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: revertResult }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().optimizations.revert('opt-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/optimizations/opt-1/reversion');
    expect(init.method).toBe('POST');
    expect(result.message).toBe('Revert queued');
    expect(result.optimization_id).toBe('opt-1');
  });

  it('sends no body', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: { message: 'ok', optimization_id: 'x' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().optimizations.revert('x');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().optimizations.revert('no-such')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});
