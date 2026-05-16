/**
 * BulkOptimizationsResource — /api/v1/bulk_optimizations endpoint
 *
 * Types derived from openapi/v1.yaml lines 1327-1393:
 *   POST /api/v1/bulk_optimizations  (202 response)
 *
 * Request body: product_ids (required), fields (optional enum array)
 * Response: { data: { queued_count, queued_product_ids, skipped_product_ids, credits_remaining } }
 */

import { request } from '../http.js';
import type { BeaconedClient } from '../client.js';

// From openapi/v1.yaml lines 1344-1356 (request body schema)
export interface BulkOptimizationInput {
  /** Array of product UUIDs to optimize. Must be non-empty. */
  product_ids: string[];
  /** Fields to optimize. Defaults to all fields if omitted. */
  fields?: Array<
    | 'title'
    | 'description'
    | 'alt_text'
    | 'meta_title'
    | 'meta_description'
    | 'tags'
    | 'product_type'
    | 'og_title'
    | 'og_description'
  >;
}

// From openapi/v1.yaml lines 1363-1383 (202 response body data object)
export interface BulkOptimizationResult {
  queued_count: number;
  queued_product_ids: string[];
  skipped_product_ids: string[];
  /** Remaining credits. Null for unlimited plans. */
  credits_remaining: number | null;
}

export class BulkOptimizationsResource {
  constructor(private readonly client: BeaconedClient) {}

  /**
   * POST /api/v1/bulk_optimizations
   * Submits a list of product IDs for batch optimization.
   * Returns 202 with counts of queued and skipped products.
   * Spec: openapi/v1.yaml lines 1327-1393.
   */
  async create(
    input: BulkOptimizationInput,
    opts?: { signal?: AbortSignal },
  ): Promise<BulkOptimizationResult> {
    const envelope = await request<BulkOptimizationResult>(this.client, {
      method: 'POST',
      path: '/api/v1/bulk_optimizations',
      body: input,
      signal: opts?.signal,
    });
    return envelope.data;
  }
}
