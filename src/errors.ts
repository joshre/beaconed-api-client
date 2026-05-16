/**
 * Error class hierarchy for the Beaconed API client.
 *
 * Parses the flat error envelope returned by the Beaconed v1 API:
 *   { "success": false, "error": "...", "errors": ["..."] }
 */

export class BeaconedError extends Error {
  readonly status: number;
  readonly summary: string;
  readonly errors: string[];

  constructor(status: number, summary: string, errors: string[] = []) {
    super(summary);
    this.name = 'BeaconedError';
    this.status = status;
    this.summary = summary;
    this.errors = errors;
  }
}

/** 401 Unauthorized */
export class BeaconedAuthError extends BeaconedError {
  constructor(summary: string, errors: string[] = []) {
    super(401, summary, errors);
    this.name = 'BeaconedAuthError';
  }
}

/** 403 Forbidden */
export class BeaconedForbiddenError extends BeaconedError {
  constructor(summary: string, errors: string[] = []) {
    super(403, summary, errors);
    this.name = 'BeaconedForbiddenError';
  }
}

/** 404 Not Found */
export class BeaconedNotFoundError extends BeaconedError {
  constructor(summary: string, errors: string[] = []) {
    super(404, summary, errors);
    this.name = 'BeaconedNotFoundError';
  }
}

/** 402 Payment Required (credits exhausted) */
export class BeaconedPaymentRequiredError extends BeaconedError {
  constructor(summary: string, errors: string[] = []) {
    super(402, summary, errors);
    this.name = 'BeaconedPaymentRequiredError';
  }
}

/** 429 Too Many Requests */
export class BeaconedRateLimitError extends BeaconedError {
  readonly retryAfter?: number;

  constructor(summary: string, errors: string[] = [], retryAfter?: number) {
    super(429, summary, errors);
    this.name = 'BeaconedRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** 422 Unprocessable Entity (validation failure; errors[] has detail) */
export class BeaconedValidationError extends BeaconedError {
  constructor(summary: string, errors: string[] = []) {
    super(422, summary, errors);
    this.name = 'BeaconedValidationError';
  }
}

/** 5xx Server Error */
export class BeaconedServerError extends BeaconedError {
  constructor(status: number, summary: string, errors: string[] = []) {
    super(status, summary, errors);
    this.name = 'BeaconedServerError';
  }
}
