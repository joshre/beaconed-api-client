/**
 * Error class hierarchy for the Beaconed API client.
 *
 * Parses the flat error envelope returned by the Beaconed v1 API:
 *   { "success": false, "error": "...", "errors": ["..."] }
 *
 * Note: The openapi/v1.yaml Error schema (lines 67-85) uses a nested shape,
 * but the customer-facing docs (errors.html.erb) show the flat shape above.
 * The flat shape is what the API actually returns; this parser implements that.
 */

export type ErrorCode =
  | 'network'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

export class BeaconedError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly responseBody?: unknown;
  readonly requestUrl: string;
  readonly requestMethod: string;

  constructor(
    message: string,
    status: number,
    code: ErrorCode,
    requestUrl: string,
    requestMethod: string,
    responseBody?: unknown,
  ) {
    super(message);
    this.name = 'BeaconedError';
    this.status = status;
    this.code = code;
    this.requestUrl = requestUrl;
    this.requestMethod = requestMethod;
    this.responseBody = responseBody;
  }
}

/** 401 Unauthorized — missing or invalid API key */
export class BeaconedAuthError extends BeaconedError {
  constructor(
    message: string,
    requestUrl: string,
    requestMethod: string,
    responseBody?: unknown,
  ) {
    super(message, 401, 'auth', requestUrl, requestMethod, responseBody);
    this.name = 'BeaconedAuthError';
  }
}

/** 403 Forbidden — valid key, insufficient permissions */
export class BeaconedForbiddenError extends BeaconedError {
  constructor(
    message: string,
    requestUrl: string,
    requestMethod: string,
    responseBody?: unknown,
  ) {
    super(message, 403, 'forbidden', requestUrl, requestMethod, responseBody);
    this.name = 'BeaconedForbiddenError';
  }
}

/** 404 Not Found */
export class BeaconedNotFoundError extends BeaconedError {
  constructor(
    message: string,
    requestUrl: string,
    requestMethod: string,
    responseBody?: unknown,
  ) {
    super(message, 404, 'not_found', requestUrl, requestMethod, responseBody);
    this.name = 'BeaconedNotFoundError';
  }
}

/** 422 Unprocessable Entity — validation failure */
export class BeaconedValidationError extends BeaconedError {
  readonly validationErrors: string[];

  constructor(
    message: string,
    validationErrors: string[],
    requestUrl: string,
    requestMethod: string,
    responseBody?: unknown,
  ) {
    super(message, 422, 'validation', requestUrl, requestMethod, responseBody);
    this.name = 'BeaconedValidationError';
    this.validationErrors = validationErrors;
  }
}

/** 429 Too Many Requests — rate limit exceeded */
export class BeaconedRateLimitError extends BeaconedError {
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    requestUrl: string,
    requestMethod: string,
    retryAfterSeconds?: number,
    responseBody?: unknown,
  ) {
    super(message, 429, 'rate_limited', requestUrl, requestMethod, responseBody);
    this.name = 'BeaconedRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** 5xx Server Error */
export class BeaconedServerError extends BeaconedError {
  constructor(
    message: string,
    status: number,
    requestUrl: string,
    requestMethod: string,
    responseBody?: unknown,
  ) {
    super(message, status, 'server', requestUrl, requestMethod, responseBody);
    this.name = 'BeaconedServerError';
  }
}

/** Network-level error — fetch threw before a response was received */
export class BeaconedNetworkError extends BeaconedError {
  constructor(message: string, requestUrl: string, requestMethod: string, cause?: unknown) {
    super(message, 0, 'network', requestUrl, requestMethod, undefined);
    this.name = 'BeaconedNetworkError';
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Parses a Retry-After header value.
 * Accepts either a numeric seconds value or an HTTP-date string.
 * Returns seconds as a number, or undefined if unparseable.
 */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;

  const asNumber = Number(value.trim());
  if (!isNaN(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  // Try HTTP-date format (e.g. "Wed, 21 Oct 2015 07:28:00 GMT")
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    const secondsUntil = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
    return secondsUntil;
  }

  return undefined;
}

/** Shape of the flat Beaconed error envelope */
interface FlatErrorBody {
  success: false;
  error: string;
  errors?: string[];
}

function isFlatErrorBody(body: unknown): body is FlatErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'success' in body &&
    (body as Record<string, unknown>)['success'] === false &&
    typeof (body as Record<string, unknown>)['error'] === 'string'
  );
}

/**
 * Factory function: picks the right BeaconedError subclass based on HTTP status
 * and the flat error envelope { success, error, errors }.
 */
export function parseErrorResponse(
  response: Response,
  body: unknown,
  url: string,
  method: string,
): BeaconedError {
  const status = response.status;
  const message = isFlatErrorBody(body)
    ? body.error
    : `Request failed with status ${status}`;
  const validationErrors: string[] = isFlatErrorBody(body) ? (body.errors ?? []) : [];

  switch (status) {
    case 401:
      return new BeaconedAuthError(message, url, method, body);
    case 403:
      return new BeaconedForbiddenError(message, url, method, body);
    case 404:
      return new BeaconedNotFoundError(message, url, method, body);
    case 422:
      return new BeaconedValidationError(message, validationErrors, url, method, body);
    case 429: {
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      return new BeaconedRateLimitError(message, url, method, retryAfter, body);
    }
    default:
      if (status >= 500) {
        return new BeaconedServerError(message, status, url, method, body);
      }
      return new BeaconedError(message, status, 'unknown', url, method, body);
  }
}
