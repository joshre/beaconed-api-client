/**
 * ScoresResource — score history endpoints
 *
 * Spec-backed endpoints:
 *   GET /api/v1/products/{product_id}/scores         (lines 789-836)
 *   GET /api/v1/products/{product_id}/scores/latest  (lines 838-882)
 *
 * Task-requested endpoints (SPEC-ABSENT — not in openapi/v1.yaml):
 *   GET /api/v1/scores        (scores.list)
 *   GET /api/v1/scores/latest (scores.latest)
 *
 * Types derived from openapi/v1.yaml:
 *   ScoreHistory (lines 326-344)
 *   ScoreDetail  (lines 360-394)
 */

import { request } from '../http.js';
import { paginate } from '../pagination.js';
import type { BeaconedClient } from '../client.js';
import type { PageInfo } from '../pagination.js';

// From openapi/v1.yaml components/schemas/ScoreHistory (lines 326-344)
export interface Score {
  id: string;
  overall_score: number;
  grade: string;
  score_change: number | null;
  scored_at: string;
  created_at: string;
}

// From openapi/v1.yaml components/schemas/ScoreDetail (lines 360-394)
export interface ScoreDetail extends Score {
  product_id: string;
  category_scores: Record<string, { score: number; weight: number }>;
  recommendations: string[];
  lowest_categories: Array<{ category: string; score: number }>;
  potential_improvement: number;
  improved: boolean;
}

// Query parameters for product score list (spec lines 803-824)
export interface ProductScoreListParams {
  page?: number;
  per_page?: number;
  since?: string;
  until?: string;
  grade?: string;
}

// Query parameters for global score list (SPEC-ABSENT — not in openapi/v1.yaml)
// TODO: verify with API team if these endpoints exist
export interface ScoreListParams {
  page?: number;
  per_page?: number;
  since?: string;
  until?: string;
  grade?: string;
}

export class ScoresResource {
  constructor(private readonly client: BeaconedClient) {}

  /**
   * GET /api/v1/products/{product_id}/scores
   * Returns the score history for a specific product.
   */
  async listByProduct(
    productId: string,
    params?: ProductScoreListParams,
    opts?: { signal?: AbortSignal },
  ): Promise<{ data: Score[]; pageInfo: PageInfo }> {
    const envelope = await request<Score[]>(this.client, {
      method: 'GET',
      path: `/api/v1/products/${encodeURIComponent(productId)}/scores`,
      query: params as Record<string, string | number | undefined>,
      signal: opts?.signal,
    });
    return { data: envelope.data, pageInfo: envelope.pageInfo! };
  }

  /**
   * GET /api/v1/products/{product_id}/scores/latest
   * Returns the latest score (with full detail) for a specific product.
   */
  async latestByProduct(
    productId: string,
    opts?: { signal?: AbortSignal },
  ): Promise<ScoreDetail> {
    const envelope = await request<ScoreDetail>(this.client, {
      method: 'GET',
      path: `/api/v1/products/${encodeURIComponent(productId)}/scores/latest`,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * GET /api/v1/scores
   * Returns a paginated list of scores across all products.
   *
   * SPEC-ABSENT: This endpoint is not defined in openapi/v1.yaml.
   * TODO: verify with API team.
   */
  async list(
    params?: ScoreListParams,
    opts?: { signal?: AbortSignal },
  ): Promise<{ data: Score[]; pageInfo: PageInfo }> {
    const envelope = await request<Score[]>(this.client, {
      method: 'GET',
      path: '/api/v1/scores',
      query: params as Record<string, string | number | undefined>,
      signal: opts?.signal,
    });
    return { data: envelope.data, pageInfo: envelope.pageInfo! };
  }

  /**
   * GET /api/v1/scores/latest
   * Returns the latest scores across all products.
   *
   * SPEC-ABSENT: This endpoint is not defined in openapi/v1.yaml.
   * TODO: verify with API team.
   */
  async latest(
    params?: ScoreListParams,
    opts?: { signal?: AbortSignal },
  ): Promise<{ data: Score[]; pageInfo: PageInfo }> {
    const envelope = await request<Score[]>(this.client, {
      method: 'GET',
      path: '/api/v1/scores/latest',
      query: params as Record<string, string | number | undefined>,
      signal: opts?.signal,
    });
    return { data: envelope.data, pageInfo: envelope.pageInfo! };
  }

  /**
   * Async iterator that yields all scores for a product across all pages.
   */
  listAllByProduct(
    productId: string,
    params?: Omit<ProductScoreListParams, 'page'>,
    opts?: { signal?: AbortSignal },
  ): AsyncGenerator<Score> {
    return paginate((page) =>
      this.listByProduct(productId, { ...params, page }, opts),
    );
  }

  /**
   * Async iterator that yields all scores across all pages.
   * Uses the SPEC-ABSENT GET /api/v1/scores endpoint.
   */
  listAll(
    params?: Omit<ScoreListParams, 'page'>,
    opts?: { signal?: AbortSignal },
  ): AsyncGenerator<Score> {
    return paginate((page) =>
      this.list({ ...params, page }, opts),
    );
  }
}
