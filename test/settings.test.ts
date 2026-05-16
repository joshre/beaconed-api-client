/**
 * Tests for SettingsResource — get()
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { BeaconedClient } from '../src/client.js';
import { BeaconedAuthError } from '../src/errors.js';
import type { Settings } from '../src/resources/settings.js';

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

const sampleSettings: Settings = {
  brand_voice: 'Friendly, approachable, expert',
  brand_context: 'Premium home decor for modern living',
  required_keywords: ['handcrafted', 'sustainable'],
  excluded_keywords: ['cheap'],
  default_fields: ['title', 'description', 'meta_title', 'meta_description'],
  auto_push_on_approve: false,
};

describe('SettingsResource.get()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls GET /api/v1/settings and returns Settings', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: sampleSettings }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().settings.get();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://beaconed.ai/api/v1/settings');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
    expect((init.headers as Record<string, string>)['Accept']).toBe('application/json');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/@joshre\/beaconed-api-client/);
    expect(result.brand_voice).toBe('Friendly, approachable, expert');
    expect(result.auto_push_on_approve).toBe(false);
  });

  it('returns settings with nullable fields set to null', async () => {
    const nullSettings: Settings = {
      brand_voice: null,
      brand_context: null,
      required_keywords: null,
      excluded_keywords: null,
      default_fields: [],
      auto_push_on_approve: true,
    };

    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(200, { data: nullSettings }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeClient().settings.get();
    expect(result.brand_voice).toBeNull();
    expect(result.required_keywords).toBeNull();
    expect(result.auto_push_on_approve).toBe(true);
  });

  it('throws BeaconedAuthError on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeResponse(401, { success: false, error: 'Invalid API key', errors: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeClient().settings.get()).rejects.toBeInstanceOf(BeaconedAuthError);
  });
});
