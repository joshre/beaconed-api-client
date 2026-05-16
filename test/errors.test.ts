import { describe, it, expect } from 'vitest';
import {
  parseErrorResponse,
  parseRetryAfter,
  BeaconedAuthError,
  BeaconedForbiddenError,
  BeaconedNotFoundError,
  BeaconedValidationError,
  BeaconedRateLimitError,
  BeaconedServerError,
  BeaconedError,
} from '../src/errors.js';

function makeResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

const URL = 'https://beaconed.ai/api/v1/products/123';
const METHOD = 'GET';

describe('parseErrorResponse', () => {
  it('returns BeaconedAuthError for 401', () => {
    const body = { success: false, error: 'Unauthorized', errors: [] };
    const err = parseErrorResponse(makeResponse(401), body, URL, METHOD);
    expect(err).toBeInstanceOf(BeaconedAuthError);
    expect(err.status).toBe(401);
    expect(err.code).toBe('auth');
    expect(err.message).toBe('Unauthorized');
  });

  it('returns BeaconedForbiddenError for 403', () => {
    const body = { success: false, error: 'Forbidden', errors: [] };
    const err = parseErrorResponse(makeResponse(403), body, URL, METHOD);
    expect(err).toBeInstanceOf(BeaconedForbiddenError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('forbidden');
  });

  it('returns BeaconedNotFoundError for 404', () => {
    const body = { success: false, error: 'Not found', errors: [] };
    const err = parseErrorResponse(makeResponse(404), body, URL, METHOD);
    expect(err).toBeInstanceOf(BeaconedNotFoundError);
    expect(err.status).toBe(404);
    expect(err.code).toBe('not_found');
  });

  it('returns BeaconedValidationError for 422 with validationErrors', () => {
    const body = {
      success: false,
      error: 'Validation failed',
      errors: ['Title is required', 'Handle is invalid'],
    };
    const err = parseErrorResponse(makeResponse(422), body, URL, METHOD);
    expect(err).toBeInstanceOf(BeaconedValidationError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('validation');
    const validationErr = err as BeaconedValidationError;
    expect(validationErr.validationErrors).toEqual(['Title is required', 'Handle is invalid']);
  });

  it('returns BeaconedRateLimitError for 429', () => {
    const body = { success: false, error: 'Rate limit exceeded', errors: [] };
    const response = new Response(null, {
      status: 429,
      headers: { 'Retry-After': '30' },
    });
    const err = parseErrorResponse(response, body, URL, METHOD);
    expect(err).toBeInstanceOf(BeaconedRateLimitError);
    expect(err.status).toBe(429);
    const rateLimitErr = err as BeaconedRateLimitError;
    expect(rateLimitErr.retryAfterSeconds).toBe(30);
  });

  it('returns BeaconedServerError for 500', () => {
    const body = { success: false, error: 'Internal server error', errors: [] };
    const err = parseErrorResponse(makeResponse(500), body, URL, METHOD);
    expect(err).toBeInstanceOf(BeaconedServerError);
    expect(err.status).toBe(500);
    expect(err.code).toBe('server');
  });

  it('returns BeaconedServerError for 503', () => {
    const body = { success: false, error: 'Service unavailable', errors: [] };
    const err = parseErrorResponse(makeResponse(503), body, URL, METHOD);
    expect(err).toBeInstanceOf(BeaconedServerError);
    expect(err.status).toBe(503);
  });

  it('handles missing error body gracefully', () => {
    const err = parseErrorResponse(makeResponse(500), null, URL, METHOD);
    expect(err).toBeInstanceOf(BeaconedServerError);
    expect(err.message).toContain('500');
  });

  it('attaches responseBody for debugging', () => {
    const body = { success: false, error: 'Not found', errors: [] };
    const err = parseErrorResponse(makeResponse(404), body, URL, METHOD);
    expect(err.responseBody).toBe(body);
  });

  it('attaches requestUrl and requestMethod', () => {
    const err = parseErrorResponse(makeResponse(401), null, URL, 'POST');
    expect(err.requestUrl).toBe(URL);
    expect(err.requestMethod).toBe('POST');
  });
});

describe('parseRetryAfter', () => {
  it('parses numeric seconds', () => {
    expect(parseRetryAfter('60')).toBe(60);
    expect(parseRetryAfter('0')).toBe(0);
    expect(parseRetryAfter('30')).toBe(30);
  });

  it('parses HTTP-date format', () => {
    // A date far in the future should return a positive number
    const future = new Date(Date.now() + 10_000).toUTCString();
    const result = parseRetryAfter(future);
    expect(result).toBeDefined();
    expect(result!).toBeGreaterThan(0);
    expect(result!).toBeLessThanOrEqual(11);
  });

  it('returns undefined for null', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseRetryAfter('')).toBeUndefined();
  });

  it('returns undefined for unparseable string', () => {
    expect(parseRetryAfter('not-a-date-or-number')).toBeUndefined();
  });

  it('handles HTTP-date in the past as 0', () => {
    const past = new Date(Date.now() - 10_000).toUTCString();
    const result = parseRetryAfter(past);
    expect(result).toBe(0);
  });
});

describe('BeaconedValidationError', () => {
  it('exposes validationErrors array', () => {
    const body = {
      success: false,
      error: 'Validation failed',
      errors: ['Name is required', 'Email is invalid'],
    };
    const err = parseErrorResponse(makeResponse(422), body, URL, METHOD);
    expect(err).toBeInstanceOf(BeaconedValidationError);
    const ve = err as BeaconedValidationError;
    expect(ve.validationErrors).toHaveLength(2);
    expect(ve.validationErrors[0]).toBe('Name is required');
  });

  it('defaults to empty array when errors field absent', () => {
    const body = { success: false, error: 'Validation failed' };
    const err = parseErrorResponse(makeResponse(422), body, URL, METHOD);
    const ve = err as BeaconedValidationError;
    expect(ve.validationErrors).toEqual([]);
  });
});

describe('BeaconedError base class', () => {
  it('has correct name', () => {
    const err = new BeaconedError('test', 0, 'unknown', '', '');
    expect(err.name).toBe('BeaconedError');
  });

  it('subclass names are correct', () => {
    expect(new BeaconedAuthError('', '', '').name).toBe('BeaconedAuthError');
    expect(new BeaconedForbiddenError('', '', '').name).toBe('BeaconedForbiddenError');
    expect(new BeaconedNotFoundError('', '', '').name).toBe('BeaconedNotFoundError');
    expect(new BeaconedValidationError('', [], '', '').name).toBe('BeaconedValidationError');
    expect(new BeaconedRateLimitError('', '', '').name).toBe('BeaconedRateLimitError');
    expect(new BeaconedServerError('', 500, '', '').name).toBe('BeaconedServerError');
  });
});
