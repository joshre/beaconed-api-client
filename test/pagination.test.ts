import { describe, it, expect, vi, afterEach } from 'vitest';
import { parsePageInfo, parsePageInfoIfPresent, paginate } from '../src/pagination.js';
import { BeaconedError } from '../src/errors.js';
import { BeaconedClient } from '../src/client.js';
import type { Optimization } from '../src/resources/optimizations.js';

function makeHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('parsePageInfo', () => {
  it('parses all four pagination headers', () => {
    const headers = makeHeaders({
      'X-Page': '2',
      'X-Per-Page': '25',
      'X-Total': '100',
      'X-Total-Pages': '4',
    });
    const info = parsePageInfo(headers);
    expect(info.page).toBe(2);
    expect(info.perPage).toBe(25);
    expect(info.total).toBe(100);
    expect(info.totalPages).toBe(4);
  });

  it('throws BeaconedError when a header is missing', () => {
    const headers = makeHeaders({
      'X-Page': '1',
      'X-Per-Page': '25',
      // X-Total missing
      'X-Total-Pages': '4',
    });
    expect(() => parsePageInfo(headers)).toThrow(BeaconedError);
    expect(() => parsePageInfo(headers)).toThrow('API response missing pagination headers');
  });

  it('throws when all headers are missing', () => {
    expect(() => parsePageInfo(new Headers())).toThrow(BeaconedError);
  });
});

describe('parsePageInfoIfPresent', () => {
  it('returns PageInfo when all headers are present', () => {
    const headers = makeHeaders({
      'X-Page': '1',
      'X-Per-Page': '25',
      'X-Total': '50',
      'X-Total-Pages': '2',
    });
    const info = parsePageInfoIfPresent(headers);
    expect(info).toBeDefined();
    expect(info?.page).toBe(1);
  });

  it('returns undefined when headers are missing', () => {
    expect(parsePageInfoIfPresent(new Headers())).toBeUndefined();
  });
});

describe('paginate', () => {
  it('yields all items across multiple pages', async () => {
    const pages = [
      { data: ['a', 'b'], pageInfo: { page: 1, perPage: 2, total: 6, totalPages: 3 } },
      { data: ['c', 'd'], pageInfo: { page: 2, perPage: 2, total: 6, totalPages: 3 } },
      { data: ['e', 'f'], pageInfo: { page: 3, perPage: 2, total: 6, totalPages: 3 } },
    ];

    const fetchPage = async (page: number) => pages[page - 1];

    const results: string[] = [];
    for await (const item of paginate(fetchPage)) {
      results.push(item);
    }

    expect(results).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('stops when page >= totalPages', async () => {
    const fetchPage = async (page: number) => ({
      data: [`item-${page}`],
      pageInfo: { page, perPage: 1, total: 2, totalPages: 2 },
    });

    const results: string[] = [];
    for await (const item of paginate(fetchPage)) {
      results.push(item);
    }

    expect(results).toEqual(['item-1', 'item-2']);
  });

  it('handles a single page correctly', async () => {
    const fetchPage = async (_page: number) => ({
      data: ['only', 'one'],
      pageInfo: { page: 1, perPage: 25, total: 2, totalPages: 1 },
    });

    const results: string[] = [];
    for await (const item of paginate(fetchPage)) {
      results.push(item);
    }

    expect(results).toEqual(['only', 'one']);
  });

  it('handles empty results', async () => {
    const fetchPage = async (_page: number) => ({
      data: [] as string[],
      pageInfo: { page: 1, perPage: 25, total: 0, totalPages: 1 },
    });

    const results: string[] = [];
    for await (const item of paginate(fetchPage)) {
      results.push(item);
    }

    expect(results).toHaveLength(0);
  });

  it('propagates errors from fetchPage', async () => {
    const error = new Error('Network failure');
    const fetchPage = async (_page: number): Promise<{ data: string[]; pageInfo: { page: number; perPage: number; total: number; totalPages: number } }> => {
      throw error;
    };

    await expect(async () => {
      for await (const _item of paginate(fetchPage)) {
        // consume
      }
    }).rejects.toThrow('Network failure');
  });

  it('propagates BeaconedError from fetchPage unchanged', async () => {
    const beaconedError = new BeaconedError('Not found', 404, 'not_found', '/test', 'GET');
    let calls = 0;

    const fetchPage = async (_page: number): Promise<{ data: string[]; pageInfo: { page: number; perPage: number; total: number; totalPages: number } }> => {
      calls++;
      if (calls === 2) throw beaconedError;
      return { data: ['a'], pageInfo: { page: 1, perPage: 1, total: 2, totalPages: 2 } };
    };

    await expect(async () => {
      for await (const _item of paginate(fetchPage)) {
        // consume
      }
    }).rejects.toBe(beaconedError);
  });
});

describe('paginate — fallback when totalPages is missing/NaN', () => {
  it('stops when data.length < perPage (no totalPages signal)', async () => {
    // Simulate a server that omits or returns NaN for totalPages
    const pages = [
      { data: ['a', 'b', 'c'], pageInfo: { page: 1, perPage: 3, total: 0, totalPages: NaN } },
      { data: ['d', 'e'],       pageInfo: { page: 2, perPage: 3, total: 0, totalPages: NaN } },
    ];

    let call = 0;
    const fetchPage = async (_page: number) => pages[call++];

    const results: string[] = [];
    for await (const item of paginate(fetchPage)) {
      results.push(item);
    }

    // Page 1 has 3 items == perPage → continue. Page 2 has 2 < perPage → stop.
    expect(results).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('stops immediately when first page has 0 items and totalPages is NaN', async () => {
    const fetchPage = async (_page: number) => ({
      data: [] as string[],
      pageInfo: { page: 1, perPage: 25, total: 0, totalPages: NaN },
    });

    const results: string[] = [];
    for await (const item of paginate(fetchPage)) {
      results.push(item);
    }

    expect(results).toHaveLength(0);
  });

  it('respects totalPages: 0 (empty collection declared via valid headers)', async () => {
    // totalPages: 0 is not a valid positive integer — treated as missing, fallback by data length
    const fetchPage = async (_page: number) => ({
      data: [] as string[],
      pageInfo: { page: 1, perPage: 25, total: 0, totalPages: 0 },
    });

    const results: string[] = [];
    for await (const item of paginate(fetchPage)) {
      results.push(item);
    }

    expect(results).toHaveLength(0);
  });
});

/**
 * Integration: listAll() walks 3 mocked pages via OptimizationsResource.listAll()
 * and asserts the merged result count.
 */
describe('pagination integration: listAll() across 3 pages', () => {
  afterEach(() => vi.restoreAllMocks());

  it('collects all 9 optimizations from 3 pages of 3', async () => {
    function makeOptimization(id: string): Optimization {
      return {
        id,
        product_id: 'prod-1',
        product_title: 'Test',
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
    }

    function makeResponse(
      body: unknown,
      paginationHdrs: Record<string, string>,
    ): Response {
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...paginationHdrs },
      });
    }

    function pageHeaders(page: number): Record<string, string> {
      return {
        'X-Page': String(page),
        'X-Per-Page': '3',
        'X-Total': '9',
        'X-Total-Pages': '3',
      };
    }

    const page1 = [makeOptimization('opt-1'), makeOptimization('opt-2'), makeOptimization('opt-3')];
    const page2 = [makeOptimization('opt-4'), makeOptimization('opt-5'), makeOptimization('opt-6')];
    const page3 = [makeOptimization('opt-7'), makeOptimization('opt-8'), makeOptimization('opt-9')];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse({ data: page1 }, pageHeaders(1)))
      .mockResolvedValueOnce(makeResponse({ data: page2 }, pageHeaders(2)))
      .mockResolvedValueOnce(makeResponse({ data: page3 }, pageHeaders(3)));

    vi.stubGlobal('fetch', fetchMock);

    const client = new BeaconedClient({ apiKey: 'test-key', baseUrl: 'https://beaconed.ai' });
    const collected: string[] = [];
    for await (const opt of client.optimizations.listAll()) {
      collected.push(opt.id);
    }

    expect(collected).toHaveLength(9);
    expect(collected[0]).toBe('opt-1');
    expect(collected[8]).toBe('opt-9');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Verify page numbers were requested sequentially
    const urls = fetchMock.mock.calls.map((c) => (c as [string])[0]);
    expect(urls[0]).toContain('page=1');
    expect(urls[1]).toContain('page=2');
    expect(urls[2]).toContain('page=3');
  });
});
