/**
 * Tests for ScoresResource — listByProduct, latestByProduct, list, latest, listAll*,
 * calculate (M3a mutation)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { BeaconedClient } from '../src/client.js';
import { BeaconedNotFoundError } from '../src/errors.js';
import type { Score, ScoreDetail } from '../src/resources/scores.js';

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

const sampleScore: Score = {
  id: 'score-1',
  overall_score: 75,
  grade: 'C',
  score_change: null,
  scored_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
};

const sampleScoreDetail: ScoreDetail = {
  ...sampleScore,
  product_id: 'prod-1',
  category_scores: {
    title: { score: 85, weight: 0.2 },
    description: { score: 60, weight: 0.25 },
  },
  recommendations: ['Add meta description'],
  lowest_categories: [{ category: 'description', score: 60 }],
  potential_improvement: 15,
  improved: false,
};

describe('ScoresResource.listByProduct()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/products/{id}/scores and returns data + pageInfo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [sampleScore] }, paginationHeaders(1, 25, 1, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().scores.listByProduct('prod-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/products/prod-1/scores');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
    expect((init.headers as Record<string, string>)['Accept']).toBe('application/json');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/@beaconed\/api-client/);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('score-1');
    expect(result.pageInfo.total).toBe(1);
  });

  it('passes since, until, grade params', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [] }, paginationHeaders(1, 25, 0, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().scores.listByProduct('prod-1', { since: '2026-01-01T00:00:00Z', grade: 'good' });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('since=');
    expect(url).toContain('grade=good');
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().scores.listByProduct('nonexistent')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('ScoresResource.latestByProduct()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/products/{id}/scores/latest and returns ScoreDetail', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: sampleScoreDetail }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().scores.latestByProduct('prod-1');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/products/prod-1/scores/latest');
    expect(result.id).toBe('score-1');
    expect(result.product_id).toBe('prod-1');
    expect(result.category_scores).toBeDefined();
    expect(result.recommendations).toEqual(['Add meta description']);
  });

  it('sends Authorization, User-Agent, and Accept headers', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: sampleScoreDetail }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().scores.latestByProduct('prod-1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-key');
    expect(headers['Accept']).toBe('application/json');
    expect(headers['User-Agent']).toMatch(/@beaconed\/api-client/);
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().scores.latestByProduct('nonexistent')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});

describe('ScoresResource.list() — SPEC-ABSENT', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/scores and returns data + pageInfo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [sampleScore] }, paginationHeaders(1, 25, 1, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().scores.list();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/scores');
    expect(result.data).toHaveLength(1);
    expect(result.pageInfo.total).toBe(1);
  });
});

describe('ScoresResource.latest() — SPEC-ABSENT', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/scores/latest and returns data + pageInfo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: [sampleScore] }, paginationHeaders(1, 25, 1, 1)),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().scores.latest();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/scores/latest');
    expect(result.data).toHaveLength(1);
  });
});

describe('ScoresResource.listAllByProduct()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('yields all scores across pages via listAllByProduct()', async () => {
    const score2 = { ...sampleScore, id: 'score-2' };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(200, { data: [sampleScore] }, paginationHeaders(1, 1, 2, 2)),
      )
      .mockResolvedValueOnce(
        makeResponse(200, { data: [score2] }, paginationHeaders(2, 1, 2, 2)),
      );
    vi.stubGlobal('fetch', fetchMock);

    const collected: string[] = [];
    for await (const s of makeClient().scores.listAllByProduct('prod-1')) {
      collected.push(s.id);
    }

    expect(collected).toEqual(['score-1', 'score-2']);
  });
});

// ---- M3a mutation tests ----

describe('ScoresResource.calculate()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/v1/products/:id/scores/calculation and returns ScoreCalculationResult', async () => {
    const calcResult = {
      product_id: 'prod-1',
      overall_score: 88,
      grade: 'excellent',
      category_scores: { title: { score: 90, weight: 0.2 } },
      recommendations: ['Optimize meta description'],
      calculated_at: '2026-05-16T00:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(201, { data: calcResult }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().scores.calculate('prod-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/products/prod-1/scores/calculation');
    expect(init.method).toBe('POST');
    expect(result.overall_score).toBe(88);
    expect(result.product_id).toBe('prod-1');
    expect(result.calculated_at).toBe('2026-05-16T00:00:00Z');
  });

  it('sends no body (POST with no request body)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(201, {
        data: {
          product_id: 'x',
          overall_score: 0,
          grade: 'critical',
          category_scores: {},
          recommendations: [],
          calculated_at: '2026-01-01T00:00:00Z',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().scores.calculate('x');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });

  it('throws BeaconedNotFoundError on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(404, { success: false, error: 'Not found', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().scores.calculate('no-such')).rejects.toBeInstanceOf(BeaconedNotFoundError);
  });
});
