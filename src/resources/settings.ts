/**
 * SettingsResource — GET /api/v1/settings
 *
 * Types derived from openapi/v1.yaml paths /api/v1/settings response (lines 1395-1451).
 * Note: the spec defines the Settings shape inline in the response body (no named schema
 * component), so the Settings interface is derived from the inline properties.
 */

import { request } from '../http.js';
import type { BeaconedClient } from '../client.js';

// Derived from inline response schema at openapi/v1.yaml lines 1410-1440
export interface Settings {
  /** Brand voice/tone guidance for AI-generated content */
  brand_voice: string | null;
  /** Additional brand context for AI optimization */
  brand_context: string | null;
  /** Keywords that must appear in optimized content */
  required_keywords: string[] | null;
  /** Keywords to avoid in optimized content */
  excluded_keywords: string[] | null;
  /** Default fields to optimize when none specified */
  default_fields: string[];
  /** Whether approved optimizations are automatically pushed to Shopify */
  auto_push_on_approve: boolean;
}

export class SettingsResource {
  constructor(private readonly client: BeaconedClient) {}

  /**
   * GET /api/v1/settings
   * Returns the account's optimization settings.
   */
  async get(opts?: { signal?: AbortSignal }): Promise<Settings> {
    const envelope = await request<Settings>(this.client, {
      method: 'GET',
      path: '/api/v1/settings',
      signal: opts?.signal,
    });
    return envelope.data;
  }
}
