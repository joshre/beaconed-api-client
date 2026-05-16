/**
 * Tests for BulkOptimizationsResource — POST /api/v1/bulk_optimizations
 *
 * Spec: openapi/v1.yaml lines 1327-1393
 * Response status: 202 Accepted
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { BeaconedClient } from '../src/client.js';
import { BeaconedValidationError } from '../src/errors.js';
import type { BulkOptimizationInput, BulkOptimizationResult } from '../src/resources/bulk-optimizations.js';

function makeClient(): BeaconedClient {
  return new BeaconedClient({ apiKey: 'test-key', baseUrl: 'https://beaconed.ai' });
}

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const sampleResult: BulkOptimizationResult = {
  queued_count: 3,
  queued_product_ids: ['uuid-1', 'uuid-2', 'uuid-3'],
  skipped_product_ids: [],
  credits_remaining: 47,
};

describe('BulkOptimizationsResource.create()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls POST /api/v1/bulk_optimizations and returns BulkOptimizationResult', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: sampleResult }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const input: BulkOptimizationInput = {
      product_ids: ['uuid-1', 'uuid-2', 'uuid-3'],
    };

    const result = await makeClient().bulkOptimizations.create(input);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/bulk_optimizations');
    expect(init.method).toBe('POST');
    expect(result.queued_count).toBe(3);
    expect(result.queued_product_ids).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);
    expect(result.skipped_product_ids).toEqual([]);
    expect(result.credits_remaining).toBe(47);
  });

  it('sends the request body as JSON with product_ids and fields', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: sampleResult }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const input: BulkOptimizationInput = {
      product_ids: ['uuid-1', 'uuid-2'],
      fields: ['title', 'description'],
    };

    await makeClient().bulkOptimizations.create(input);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['product_ids']).toEqual(['uuid-1', 'uuid-2']);
    expect(body['fields']).toEqual(['title', 'description']);
  });

  it('sends authorization and accept headers', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: sampleResult }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().bulkOptimizations.create({ product_ids: ['uuid-1'] });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-key');
    expect(headers['Accept']).toBe('application/json');
    expect(headers['User-Agent']).toMatch(/@joshre\/beaconed-api-client/);
  });

  it('handles credits_remaining: null (unlimited plan)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: { ...sampleResult, credits_remaining: null } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().bulkOptimizations.create({ product_ids: ['uuid-1'] });

    expect(result.credits_remaining).toBeNull();
  });

  it('handles partially-queued results where some products are skipped', async () => {
    const partialResult: BulkOptimizationResult = {
      queued_count: 2,
      queued_product_ids: ['uuid-1', 'uuid-3'],
      skipped_product_ids: ['uuid-2'],
      credits_remaining: 10,
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(202, { data: partialResult }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().bulkOptimizations.create({
      product_ids: ['uuid-1', 'uuid-2', 'uuid-3'],
    });

    expect(result.queued_count).toBe(2);
    expect(result.skipped_product_ids).toEqual(['uuid-2']);
  });

  it('throws BeaconedValidationError on 422 (empty product_ids)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(422, {
        success: false,
        error: 'Validation failed',
        errors: ['product_ids must not be empty'],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    let caught: unknown;
    try {
      // Intentionally passing empty array to simulate server-side rejection
      await makeClient().bulkOptimizations.create({ product_ids: [] });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(BeaconedValidationError);
    const ve = caught as BeaconedValidationError;
    expect(ve.validationErrors).toContain('product_ids must not be empty');
  });
});
