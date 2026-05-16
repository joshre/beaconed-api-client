/**
 * OptimizationsResource — GET /api/v1/optimizations
 *
 * Types derived from openapi/v1.yaml components/schemas/Optimization (lines 248-288)
 * and OptimizationDetail (lines 290-311).
 */

import { request } from '../http.js';
import { paginate } from '../pagination.js';
import type { BeaconedClient } from '../client.js';
import type { PageInfo } from '../pagination.js';

// From openapi/v1.yaml components/schemas/Optimization (lines 248-288)
export interface Optimization {
  id: string;
  product_id: string;
  product_title: string;
  field:
    | 'title'
    | 'description'
    | 'alt_text'
    | 'meta_title'
    | 'meta_description'
    | 'tags'
    | 'product_type'
    | 'og_title'
    | 'og_description';
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'reverted';
  score_before: number | null;
  score_after: number | null;
  approved_at: string | null;
  applied_at: string | null;
  reverted_at: string | null;
  created_at: string;
  updated_at: string;
}

// From openapi/v1.yaml components/schemas/OptimizationDetail (lines 290-311)
export interface OptimizationDetail extends Optimization {
  original_content: string;
  optimized_content: string;
  rejection_reason: string | null;
  shopify_error: string | null;
  image_shopify_id: number | null;
  approved_by_name: string | null;
}

// Query parameters for GET /api/v1/optimizations (spec lines 919-942)
export interface OptimizationListParams {
  page?: number;
  per_page?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'applied' | 'reverted';
  field?:
    | 'title'
    | 'description'
    | 'alt_text'
    | 'meta_title'
    | 'meta_description'
    | 'tags'
    | 'product_type'
    | 'og_title'
    | 'og_description';
  product_id?: string;
  since?: string;
}

export class OptimizationsResource {
  constructor(private readonly client: BeaconedClient) {}

  /**
   * GET /api/v1/optimizations
   * Returns a paginated list of optimizations.
   */
  async list(
    params?: OptimizationListParams,
    opts?: { signal?: AbortSignal },
  ): Promise<{ data: Optimization[]; pageInfo: PageInfo }> {
    const envelope = await request<Optimization[]>(this.client, {
      method: 'GET',
      path: '/api/v1/optimizations',
      query: params as Record<string, string | number | undefined>,
      signal: opts?.signal,
    });
    return { data: envelope.data, pageInfo: envelope.pageInfo! };
  }

  /**
   * GET /api/v1/optimizations/:id
   * Returns detailed information about a specific optimization.
   */
  async get(id: string, opts?: { signal?: AbortSignal }): Promise<OptimizationDetail> {
    const envelope = await request<OptimizationDetail>(this.client, {
      method: 'GET',
      path: `/api/v1/optimizations/${encodeURIComponent(id)}`,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * Async iterator that yields all optimizations across all pages.
   * Calls list() repeatedly until exhausted.
   */
  listAll(
    params?: Omit<OptimizationListParams, 'page'>,
    opts?: { signal?: AbortSignal },
  ): AsyncGenerator<Optimization> {
    return paginate((page) =>
      this.list({ ...params, page }, opts),
    );
  }
}
