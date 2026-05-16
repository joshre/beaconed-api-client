/**
 * OptimizationsResource — /api/v1/optimizations endpoints
 *
 * Types derived from openapi/v1.yaml:
 *   Optimization      (lines 248-288)
 *   OptimizationDetail (lines 290-311)
 *
 * Mutation endpoints (M3a):
 *   POST /api/v1/optimizations/:id/approval    (spec lines 983-1012)
 *   POST /api/v1/optimizations/:id/rejection   (spec lines 1014-1047)
 *   POST /api/v1/optimizations/:id/application (spec lines 1049-1079)
 *   POST /api/v1/optimizations/:id/reversion   (spec lines 1080-1109)
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

// Input for POST /api/v1/optimizations/:id/rejection (spec lines 1029-1035)
// reason is optional — spec has no required fields
export interface OptimizationRejectInput {
  reason?: string;
}

// Response type for POST /api/v1/optimizations/:id/application (spec lines 1068-1079)
export interface OptimizationApplyResult {
  message: string;
  optimization_id: string;
}

// Response type for POST /api/v1/optimizations/:id/reversion (spec lines 1097-1109)
export interface OptimizationRevertResult {
  message: string;
  optimization_id: string;
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
   * POST /api/v1/optimizations/:id/approval
   * Approves a pending optimization. Returns updated OptimizationDetail.
   * EXPENSIVE-tier rate limit: 10 req/min.
   * Spec: openapi/v1.yaml lines 983-1012.
   */
  async approve(id: string, opts?: { signal?: AbortSignal }): Promise<OptimizationDetail> {
    const envelope = await request<OptimizationDetail>(this.client, {
      method: 'POST',
      path: `/api/v1/optimizations/${encodeURIComponent(id)}/approval`,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * POST /api/v1/optimizations/:id/rejection
   * Rejects a pending optimization. Optional reason in body.
   * Returns updated OptimizationDetail.
   * Spec: openapi/v1.yaml lines 1014-1047.
   */
  async reject(
    id: string,
    input?: OptimizationRejectInput,
    opts?: { signal?: AbortSignal },
  ): Promise<OptimizationDetail> {
    const envelope = await request<OptimizationDetail>(this.client, {
      method: 'POST',
      path: `/api/v1/optimizations/${encodeURIComponent(id)}/rejection`,
      body: input,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * POST /api/v1/optimizations/:id/application
   * Pushes an approved optimization to Shopify. Returns 202 (queued).
   * EXPENSIVE-tier rate limit: 10 req/min.
   * Spec: openapi/v1.yaml lines 1049-1079.
   */
  async apply(id: string, opts?: { signal?: AbortSignal }): Promise<OptimizationApplyResult> {
    const envelope = await request<OptimizationApplyResult>(this.client, {
      method: 'POST',
      path: `/api/v1/optimizations/${encodeURIComponent(id)}/application`,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * POST /api/v1/optimizations/:id/reversion
   * Reverts an applied optimization back to original content. Returns 202 (queued).
   * EXPENSIVE-tier rate limit: 10 req/min.
   * Spec: openapi/v1.yaml lines 1080-1109.
   */
  async revert(id: string, opts?: { signal?: AbortSignal }): Promise<OptimizationRevertResult> {
    const envelope = await request<OptimizationRevertResult>(this.client, {
      method: 'POST',
      path: `/api/v1/optimizations/${encodeURIComponent(id)}/reversion`,
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
