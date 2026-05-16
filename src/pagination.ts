/**
 * Pagination utilities for the Beaconed API client.
 *
 * Per openapi/v1.yaml lines 38-46:
 *   Query params: page (default 1), per_page (default 25, max 100)
 *   Response headers: X-Page, X-Per-Page, X-Total, X-Total-Pages
 */

import { BeaconedError } from './errors.js';

export interface PageInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/**
 * Parses pagination headers from a response.
 * Throws BeaconedError (code: 'server') if required headers are missing.
 */
export function parsePageInfo(headers: Headers): PageInfo {
  const page = headers.get('X-Page');
  const perPage = headers.get('X-Per-Page');
  const total = headers.get('X-Total');
  const totalPages = headers.get('X-Total-Pages');

  if (page === null || perPage === null || total === null || totalPages === null) {
    throw new BeaconedError(
      'API response missing pagination headers',
      0,
      'server',
      '',
      '',
      undefined,
    );
  }

  return {
    page: parseInt(page, 10),
    perPage: parseInt(perPage, 10),
    total: parseInt(total, 10),
    totalPages: parseInt(totalPages, 10),
  };
}

/**
 * Parses pagination headers if present; returns undefined if any header is missing.
 * Used by the HTTP layer for non-list endpoints where headers may not be present.
 */
export function parsePageInfoIfPresent(headers: Headers): PageInfo | undefined {
  const page = headers.get('X-Page');
  const perPage = headers.get('X-Per-Page');
  const total = headers.get('X-Total');
  const totalPages = headers.get('X-Total-Pages');

  if (page === null || perPage === null || total === null || totalPages === null) {
    return undefined;
  }

  return {
    page: parseInt(page, 10),
    perPage: parseInt(perPage, 10),
    total: parseInt(total, 10),
    totalPages: parseInt(totalPages, 10),
  };
}

/**
 * Async generator that yields items one at a time across all pages.
 * Re-emits errors from fetchPage unchanged.
 */
export async function* paginate<T>(
  fetchPage: (page: number) => Promise<{ data: T[]; pageInfo: PageInfo }>,
): AsyncGenerator<T> {
  let currentPage = 1;

  while (true) {
    const result = await fetchPage(currentPage);
    for (const item of result.data) {
      yield item;
    }

    if (currentPage >= result.pageInfo.totalPages) {
      break;
    }

    currentPage++;
  }
}
