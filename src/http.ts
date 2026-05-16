/**
 * Core HTTP request wrapper for the Beaconed API client.
 *
 * Uses Node 20 native fetch (globalThis.fetch) — no runtime deps.
 */

import {
  BeaconedNetworkError,
  BeaconedRateLimitError,
  BeaconedServerError,
  parseErrorResponse,
  parseRetryAfter,
} from './errors.js';
import { parsePageInfoIfPresent, type PageInfo } from './pagination.js';
import type { BeaconedClient } from './client.js';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ResponseEnvelope<T> {
  data: T;
  pageInfo?: PageInfo;
  rateLimitRemaining?: number;
}

function parseRateLimitRemaining(headers: Headers): number | undefined {
  const val = headers.get('X-RateLimit-Remaining');
  if (val === null) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseBody(response: Response, url: string, method: string): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Non-JSON body on error status — wrap in server error
    throw new BeaconedServerError(
      `Failed to parse API response as JSON: ${text.slice(0, 200)}`,
      response.status,
      url,
      method,
      text,
    );
  }
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const url = `${baseUrl}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(query)) {
    if (val !== undefined) {
      params.set(key, String(val));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Makes an authenticated request to the Beaconed API.
 * Handles retry logic:
 *   - 429: respect Retry-After header, cap at 30s, retry once
 *   - 5xx: exponential backoff + jitter, retry once (base 500ms)
 *   - Network errors: no retry (potential partial write)
 */
export async function request<T>(
  client: BeaconedClient,
  opts: RequestOptions,
): Promise<ResponseEnvelope<T>> {
  const url = buildUrl(client.baseUrl, opts.path, opts.query);
  const method = opts.method;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${client.apiKey}`,
    Accept: 'application/json',
    'User-Agent': client.userAgent,
  };

  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchInit: RequestInit = {
    method,
    headers,
    signal: opts.signal,
  };

  if (opts.body !== undefined) {
    fetchInit.body = JSON.stringify(opts.body);
  }

  async function attemptRequest(): Promise<Response> {
    try {
      return await globalThis.fetch(url, fetchInit);
    } catch (err) {
      throw new BeaconedNetworkError(
        err instanceof Error ? err.message : 'Network request failed',
        url,
        method,
        err,
      );
    }
  }

  function processSuccess<U>(response: Response, body: unknown): ResponseEnvelope<U> {
    // Unwrap { data: ... } envelope defensively
    const parsed = body as Record<string, unknown> | null | undefined;
    const data =
      parsed !== null &&
      parsed !== undefined &&
      typeof parsed === 'object' &&
      'data' in parsed
        ? (parsed['data'] as U)
        : (body as U);

    return {
      data,
      pageInfo: parsePageInfoIfPresent(response.headers),
      rateLimitRemaining: parseRateLimitRemaining(response.headers),
    };
  }

  // First attempt
  let response = await attemptRequest();
  let body = await parseBody(response, url, method);

  if (response.ok) {
    return processSuccess<T>(response, body);
  }

  // Handle 429 — respect Retry-After, cap at 30s, retry once
  if (response.status === 429) {
    if (!opts.signal?.aborted) {
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      const waitMs = Math.min((retryAfter ?? 1) * 1000, 30_000);
      await sleep(waitMs);

      response = await attemptRequest();
      body = await parseBody(response, url, method);

      if (response.ok) {
        return processSuccess<T>(response, body);
      }

      if (response.status === 429) {
        const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
        throw new BeaconedRateLimitError(
          'Rate limit exceeded after retry',
          url,
          method,
          retryAfterSeconds,
          body,
        );
      }

      throw parseErrorResponse(response, body, url, method);
    }
  }

  // Handle 5xx — exponential backoff with jitter, retry once
  if (response.status >= 500) {
    if (!opts.signal?.aborted) {
      const jitter = Math.random() * 200;
      const waitMs = 500 + jitter;
      await sleep(waitMs);

      response = await attemptRequest();
      body = await parseBody(response, url, method);

      if (response.ok) {
        return processSuccess<T>(response, body);
      }

      if (response.status >= 500) {
        throw new BeaconedServerError(
          (body as Record<string, unknown> | null)
            ? String((body as Record<string, unknown>)['error'] ?? `Server error ${response.status}`)
            : `Server error ${response.status}`,
          response.status,
          url,
          method,
          body,
        );
      }

      throw parseErrorResponse(response, body, url, method);
    }
  }

  throw parseErrorResponse(response, body, url, method);
}
