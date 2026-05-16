/**
 * ProductsResource — /api/v1/products and nested endpoints
 *
 * Types derived from openapi/v1.yaml:
 *   Product      (lines 87-131)
 *   ProductDetail (lines 133-174, allOf extending Product)
 *   ProductInput  (lines 176-231)
 *   Image        (lines 232-246)
 */

import { request } from '../http.js';
import { paginate } from '../pagination.js';
import type { BeaconedClient } from '../client.js';
import type { PageInfo } from '../pagination.js';
import type { ScoreCalculationResult } from './scores.js';

// From openapi/v1.yaml components/schemas/Product (lines 87-131)
export interface Product {
  id: string;
  shopify_id: number | null;
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  vendor: string | null;
  product_type: string | null;
  readiness_score: number;
  readiness_grade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  optimization_status: string | null;
  pending_optimizations_count: number;
  primary_image_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// Query parameters for GET /api/v1/products (spec lines 504-546)
export interface ProductListParams {
  page?: number;
  per_page?: number;
  status?: 'active' | 'draft' | 'archived';
  min_score?: number;
  max_score?: number;
  grade?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  needs_optimization?: boolean;
  /** Search by title */
  q?: string;
}

// Query parameters for GET /api/v1/products/{product_id}/scores (spec lines 803-824)
export interface ProductScoreListParams {
  page?: number;
  per_page?: number;
  since?: string;
  until?: string;
  grade?: string;
}

// From openapi/v1.yaml components/schemas/ProductInput (lines 176-231)
// Used for POST /api/v1/products (create) — all fields optional except none required in spec.
export interface ProductCreateInput {
  title?: string;
  description?: string;
  handle?: string;
  status?: 'active' | 'draft' | 'archived';
  vendor?: string;
  product_type?: string;
  meta_title?: string;
  meta_description?: string;
  og_title?: string;
  og_description?: string;
  tags?: string;
  /** Your system's product ID. Used for idempotency on create. */
  external_id?: string;
  images?: Array<{
    id?: string;
    src?: string;
    altText?: string;
    width?: number;
    height?: number;
  }>;
}

// Used for PATCH /api/v1/products/:id — all fields optional (partial update)
export type ProductUpdateInput = ProductCreateInput;

// Response type for POST /api/v1/products/:id/sync (spec lines 711-724)
export interface ProductSyncResult {
  message: string;
  product_id: string;
}

// Request input for POST /api/v1/products/:id/optimization (spec lines 748-753)
export interface ProductOptimizeInput {
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

// Response type for POST /api/v1/products/:id/optimization (spec lines 760-776)
export interface ProductOptimizeResult {
  message: string;
  product_id: string;
  product_title: string;
  status: string;
}

// Query parameters for GET /api/v1/products/{product_id}/optimizations
// The spec uses GET /api/v1/optimizations with product_id filter (lines 919-942).
// There is no dedicated /products/{id}/optimizations endpoint in openapi/v1.yaml.
// This method calls the global optimizations endpoint with product_id set.
export interface ProductOptimizationListParams {
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
}

// From openapi/v1.yaml components/schemas/Image (lines 232-246)
export interface Image {
  id: string;
  src: string;
  alt_text: string | null;
  width: number;
  height: number;
}

// From openapi/v1.yaml components/schemas/OptimizationSummary (lines 312-324)
export interface OptimizationSummary {
  id: string;
  field: string;
  status: string;
  created_at: string;
}

// From openapi/v1.yaml components/schemas/ScoreHistorySummary (lines 346-355)
export interface ScoreHistorySummary {
  overall_score: number;
  grade: string;
  scored_at: string;
  score_change: number | null;
}

/**
 * ProductDetail — full product with all fields.
 * Combines Product base (lines 87-131) and ProductDetail extension (lines 133-174).
 *
 * Fields (in order, matching spec):
 * From Product base:
 *   id, shopify_id, title, handle, status, vendor, product_type,
 *   readiness_score, readiness_grade, optimization_status,
 *   pending_optimizations_count, primary_image_url,
 *   last_synced_at, created_at, updated_at
 *
 * From ProductDetail extension:
 *   description, meta_title, meta_description, og_title, og_description,
 *   tags, options, images, price_min, latest_optimization, score_history
 */
export interface ProductDetail {
  // Product base fields (openapi/v1.yaml lines 87-131)
  id: string;
  shopify_id: number | null;
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  vendor: string | null;
  product_type: string | null;
  readiness_score: number;
  readiness_grade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  optimization_status: string | null;
  pending_optimizations_count: number;
  primary_image_url: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;

  // ProductDetail extension fields (openapi/v1.yaml lines 138-174)
  description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  /** AI-optimized Open Graph title for social media previews */
  og_title: string | null;
  /** AI-optimized Open Graph description for social media previews */
  og_description: string | null;
  tags: string | null;
  options: Record<string, unknown>[];
  images: Image[];
  price_min: number | null;
  latest_optimization: OptimizationSummary | null;
  score_history: ScoreHistorySummary[];
}

export class ProductsResource {
  constructor(private readonly client: BeaconedClient) {}

  /**
   * GET /api/v1/products
   * Returns a paginated list of products.
   */
  async list(
    params?: ProductListParams,
    opts?: { signal?: AbortSignal },
  ): Promise<{ data: Product[]; pageInfo: PageInfo }> {
    const envelope = await request<Product[]>(this.client, {
      method: 'GET',
      path: '/api/v1/products',
      query: params as Record<string, string | number | undefined>,
      signal: opts?.signal,
    });
    return { data: envelope.data, pageInfo: envelope.pageInfo! };
  }

  /**
   * GET /api/v1/products/{id}
   * Returns detailed information about a specific product.
   */
  async get(id: string, opts?: { signal?: AbortSignal }): Promise<ProductDetail> {
    const envelope = await request<ProductDetail>(this.client, {
      method: 'GET',
      path: `/api/v1/products/${encodeURIComponent(id)}`,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * GET /api/v1/products/{id}/scores
   * Returns the score history for a product.
   */
  async scores(
    id: string,
    params?: ProductScoreListParams,
    opts?: { signal?: AbortSignal },
  ): Promise<{ data: ScoreHistorySummary[]; pageInfo: PageInfo }> {
    const envelope = await request<ScoreHistorySummary[]>(this.client, {
      method: 'GET',
      path: `/api/v1/products/${encodeURIComponent(id)}/scores`,
      query: params as Record<string, string | number | undefined>,
      signal: opts?.signal,
    });
    return { data: envelope.data, pageInfo: envelope.pageInfo! };
  }

  /**
   * GET /api/v1/optimizations?product_id={id}
   * Returns optimizations for a specific product.
   * Note: The spec does not define a dedicated /products/{id}/optimizations path.
   * This method calls the global /api/v1/optimizations endpoint with product_id set.
   */
  async optimizations(
    id: string,
    params?: ProductOptimizationListParams,
    opts?: { signal?: AbortSignal },
  ): Promise<{ data: OptimizationSummary[]; pageInfo: PageInfo }> {
    const envelope = await request<OptimizationSummary[]>(this.client, {
      method: 'GET',
      path: '/api/v1/optimizations',
      query: { ...params, product_id: id } as Record<string, string | number | undefined>,
      signal: opts?.signal,
    });
    return { data: envelope.data, pageInfo: envelope.pageInfo! };
  }

  /**
   * POST /api/v1/products
   * Create a product from external data (non-Shopify).
   * Use external_id for idempotency. Returns 201 with ProductDetail.
   * Spec: openapi/v1.yaml lines 590-623.
   */
  async create(
    input: ProductCreateInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ProductDetail> {
    const envelope = await request<ProductDetail>(this.client, {
      method: 'POST',
      path: '/api/v1/products',
      body: { product: input },
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * PATCH /api/v1/products/:id
   * Update a product's fields. Only include fields you want to change.
   * Returns 200 with updated ProductDetail.
   * Spec: openapi/v1.yaml lines 656-693.
   */
  async update(
    id: string,
    input: ProductUpdateInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ProductDetail> {
    const envelope = await request<ProductDetail>(this.client, {
      method: 'PATCH',
      path: `/api/v1/products/${encodeURIComponent(id)}`,
      body: { product: input },
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * POST /api/v1/products/:id/sync
   * Triggers a sync of the product from Shopify. Returns 202 (queued).
   * EXPENSIVE-tier rate limit: 10 req/min.
   * Spec: openapi/v1.yaml lines 695-724.
   */
  async sync(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<ProductSyncResult> {
    const envelope = await request<ProductSyncResult>(this.client, {
      method: 'POST',
      path: `/api/v1/products/${encodeURIComponent(id)}/sync`,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * POST /api/v1/products/:id/optimization
   * Queue AI optimization for one or more fields on a product.
   * Returns 202 (queued). EXPENSIVE-tier rate limit: 10 req/min.
   * Spec: openapi/v1.yaml lines 726-787.
   */
  async optimize(
    id: string,
    input?: ProductOptimizeInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ProductOptimizeResult> {
    const envelope = await request<ProductOptimizeResult>(this.client, {
      method: 'POST',
      path: `/api/v1/products/${encodeURIComponent(id)}/optimization`,
      body: input,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * POST /api/v1/products/:id/scores/calculation
   * Recalculates the readiness score for a product. Returns 201 with full calculation result.
   * EXPENSIVE-tier rate limit: 10 req/min.
   * Spec: openapi/v1.yaml lines 884-907.
   */
  async calculateScore(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<ScoreCalculationResult> {
    const envelope = await request<ScoreCalculationResult>(this.client, {
      method: 'POST',
      path: `/api/v1/products/${encodeURIComponent(id)}/scores/calculation`,
      signal: opts?.signal,
    });
    return envelope.data;
  }

  /**
   * Async iterator that yields all products across all pages.
   */
  listAll(
    params?: Omit<ProductListParams, 'page'>,
    opts?: { signal?: AbortSignal },
  ): AsyncGenerator<Product> {
    return paginate((page) =>
      this.list({ ...params, page }, opts),
    );
  }
}
