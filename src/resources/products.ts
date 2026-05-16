/**
 * ProductsResource — GET /api/v1/products/{id}
 *
 * Types derived from openapi/v1.yaml components/schemas/ProductDetail (lines 133-174)
 * which is an allOf extending Product (lines 87-131).
 */

import { request } from '../http.js';
import type { BeaconedClient } from '../client.js';

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
}
