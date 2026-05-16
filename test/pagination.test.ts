import { describe, it, expect } from 'vitest';
import { parsePageInfo, parsePageInfoIfPresent, paginate } from '../src/pagination.js';
import { BeaconedError } from '../src/errors.js';

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
