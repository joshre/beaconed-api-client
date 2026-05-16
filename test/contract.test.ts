/**
 * Contract test layer — validates that TypeScript types match the OpenAPI spec schemas.
 *
 * Per plan section 11: load openapi/v1.yaml via js-yaml, compile schemas with ajv,
 * validate sample objects against their spec schemas.
 *
 * This catches drift between the TS types in src/resources/products.ts and
 * the spec in openapi/v1.yaml.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import type { Product, ProductDetail, ProductCreateInput } from '../src/resources/products.js';
import type { Optimization, OptimizationDetail } from '../src/resources/optimizations.js';
import type { Score, ScoreDetail } from '../src/resources/scores.js';
import type { Settings } from '../src/resources/settings.js';
import type { Webhook, WebhookDetail, WebhookWithSecret } from '../src/resources/webhooks.js';

// Load the OpenAPI spec once
interface OpenApiSpec {
  components: {
    schemas: Record<string, unknown>;
  };
}

let spec: OpenApiSpec;
let ajv: Ajv;

beforeAll(() => {
  const specPath = resolve('/Users/josh/web/beaconed/openapi/v1.yaml');
  const raw = readFileSync(specPath, 'utf-8');
  spec = yaml.load(raw) as OpenApiSpec;

  ajv = new Ajv({
    strict: false,   // permit OpenAPI extensions and nullable
    allErrors: true,
  });

  // Add all component schemas to AJV so $ref resolution works.
  // We register each schema with its $id matching the $ref format used in the spec.
  for (const [name, schema] of Object.entries(spec.components.schemas)) {
    try {
      ajv.addSchema(schema as object, `#/components/schemas/${name}`);
    } catch {
      // Schema may already be added if referenced by another
    }
  }
});

/**
 * Recursively resolves $ref schemas within the spec.
 * Handles '#/components/schemas/Foo' references.
 */
function resolveSchema(schemaOrRef: unknown, fullSpec: OpenApiSpec): unknown {
  if (
    typeof schemaOrRef === 'object' &&
    schemaOrRef !== null &&
    '$ref' in schemaOrRef
  ) {
    const ref = (schemaOrRef as { $ref: string })['$ref'];
    const parts = ref.replace('#/', '').split('/');
    let current: unknown = fullSpec;
    for (const part of parts) {
      current = (current as Record<string, unknown>)[part];
    }
    return resolveSchema(current, fullSpec);
  }
  return schemaOrRef;
}

/**
 * Deep-resolve all $refs in a schema object (recursively replaces $ref with resolved schema).
 * Also handles OpenAPI's `nullable: true` by converting `type: T` → `type: [T, 'null']`.
 * AJV 8 uses JSON Schema Draft-07/2019 semantics, not OpenAPI semantics, so nullable
 * must be explicitly represented as a type union.
 */
function deepResolveRefs(schema: unknown, fullSpec: OpenApiSpec): unknown {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  if ('$ref' in schema) {
    const resolved = resolveSchema(schema, fullSpec);
    return deepResolveRefs(resolved, fullSpec);
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => deepResolveRefs(item, fullSpec));
  }

  const input = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (key === 'nullable') continue; // strip OpenAPI nullable keyword
    result[key] = deepResolveRefs(value, fullSpec);
  }

  // Handle OpenAPI's nullable: true → add 'null' to the type
  if (input['nullable'] === true && typeof result['type'] === 'string') {
    result['type'] = [result['type'], 'null'];
  }

  return result;
}

/**
 * Flatten an allOf schema into a single object schema.
 * This merges all properties from the allOf array for validation purposes.
 */
function flattenAllOf(schema: unknown, fullSpec: OpenApiSpec): Record<string, unknown> {
  const resolved = deepResolveRefs(schema, fullSpec) as Record<string, unknown>;

  if (!resolved['allOf']) return resolved;

  const allOf = resolved['allOf'] as unknown[];
  const merged: Record<string, unknown> = { type: 'object', properties: {} };

  for (const item of allOf) {
    const flat = flattenAllOf(item, fullSpec);
    const props = (flat['properties'] as Record<string, unknown>) ?? {};
    Object.assign((merged['properties'] as Record<string, unknown>), props);
  }

  return merged;
}

describe('Contract: ProductDetail schema', () => {
  it('validates a valid ProductDetail object against the OpenAPI spec schema', () => {
    const productSchema = spec.components.schemas['ProductDetail'];
    const flatSchema = flattenAllOf(productSchema, spec);

    const validate = ajv.compile(flatSchema);

    // A complete sample ProductDetail — all fields present
    const sample: ProductDetail = {
      // Product base fields
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      shopify_id: 7982561779890,
      title: 'Organic Cotton T-Shirt',
      handle: 'organic-cotton-t-shirt',
      status: 'active',
      vendor: 'EcoThreads',
      product_type: 'Apparel',
      readiness_score: 85,
      readiness_grade: 'good',
      optimization_status: 'optimized',
      pending_optimizations_count: 0,
      primary_image_url: 'https://cdn.shopify.com/s/files/1/image.jpg',
      last_synced_at: '2026-03-15T14:30:00Z',
      created_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-15T14:30:00Z',
      // ProductDetail extension fields
      description: '<p>Made from 100% organic cotton.</p>',
      meta_title: 'Organic Cotton T-Shirt | EcoThreads',
      meta_description: 'Shop our best-selling organic cotton tee.',
      og_title: 'Organic Cotton T-Shirt',
      og_description: 'Sustainable, comfortable, and stylish.',
      tags: 'organic,cotton,sustainable',
      options: [{ name: 'Size', values: ['S', 'M', 'L'] }],
      images: [
        {
          id: 'img-1',
          src: 'https://cdn.shopify.com/s/files/1/image.jpg',
          alt_text: 'A white organic cotton t-shirt',
          width: 1200,
          height: 1200,
        },
      ],
      price_min: 29.99,
      latest_optimization: {
        id: 'opt-1',
        field: 'description',
        status: 'applied',
        created_at: '2026-03-10T10:00:00Z',
      },
      score_history: [
        {
          overall_score: 85,
          grade: 'good',
          scored_at: '2026-03-15T14:30:00Z',
          score_change: 5,
        },
      ],
    };

    const valid = validate(sample);
    if (!valid) {
      console.error('AJV validation errors:', validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('validates a ProductDetail with spec-declared nullable fields set to null', () => {
    // Only fields the spec actually declares as nullable: true are set to null.
    // shopify_id, vendor, product_type are NOT declared nullable in the spec
    // (spec discrepancy — real API can return null for API-sourced products, see plan §12).
    // latest_optimization and price_min are also not spec-nullable but may be null in practice.
    // We test with spec-compliant nulls only here.
    const productSchema = spec.components.schemas['ProductDetail'];
    const flatSchema = flattenAllOf(productSchema, spec);
    const validate = ajv.compile(flatSchema);

    const minimal: ProductDetail = {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      shopify_id: 0,            // spec says integer, not nullable
      title: 'Minimal Product',
      handle: 'minimal-product',
      status: 'draft',
      vendor: '',               // spec says string, not nullable
      product_type: '',         // spec says string, not nullable
      readiness_score: 0,
      readiness_grade: 'critical',
      optimization_status: null,     // spec: nullable
      pending_optimizations_count: 0,
      primary_image_url: null,       // spec: nullable
      last_synced_at: null,          // spec: nullable
      created_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-01T10:00:00Z',
      description: null,             // spec: nullable
      meta_title: null,              // spec: nullable
      meta_description: null,        // spec: nullable
      og_title: null,                // spec: nullable
      og_description: null,          // spec: nullable
      tags: null,                    // spec: nullable
      options: [],
      images: [],
      price_min: null,               // TS type allows null (API reality)
      // latest_optimization: spec uses $ref with no nullable; use valid object here
      latest_optimization: {
        id: 'opt-1',
        field: 'title',
        status: 'pending',
        created_at: '2026-03-01T10:00:00Z',
      },
      score_history: [],
    };

    const valid = validate(minimal);
    if (!valid) {
      console.error('AJV validation errors:', validate.errors);
    }
    expect(valid).toBe(true);
  });
});

describe('Contract: Error envelope schema (flat shape from docs)', () => {
  it('validates a flat error envelope { success, error, errors }', () => {
    // The customer-facing flat shape (errors.html.erb) — not the nested spec schema
    // We validate the shape we actually parse
    const flatErrorSchema = {
      type: 'object',
      required: ['success', 'error'],
      properties: {
        success: { type: 'boolean', enum: [false] },
        error: { type: 'string' },
        errors: { type: 'array', items: { type: 'string' } },
      },
    };

    const validate = ajv.compile(flatErrorSchema);

    const sampleError = {
      success: false,
      error: 'Resource not found',
      errors: ['Product with ID abc-123 does not exist'],
    };

    expect(validate(sampleError)).toBe(true);
  });

  it('rejects an error envelope without the error field', () => {
    const flatErrorSchema = {
      type: 'object',
      required: ['success', 'error'],
      properties: {
        success: { type: 'boolean', enum: [false] },
        error: { type: 'string' },
        errors: { type: 'array', items: { type: 'string' } },
      },
    };

    const validate = ajv.compile(flatErrorSchema);
    const invalid = { success: false };
    expect(validate(invalid)).toBe(false);
  });
});

describe('Contract: ProductDetail TypeScript type coverage', () => {
  it('TS type includes all Product base fields', () => {
    // Compile-time check: if the type is missing fields, this object literal fails to type-check.
    const check: Pick<
      ProductDetail,
      | 'id' | 'shopify_id' | 'title' | 'handle' | 'status' | 'vendor'
      | 'product_type' | 'readiness_score' | 'readiness_grade'
      | 'optimization_status' | 'pending_optimizations_count'
      | 'primary_image_url' | 'last_synced_at' | 'created_at' | 'updated_at'
    > = {
      id: 'x',
      shopify_id: null,
      title: 't',
      handle: 'h',
      status: 'active',
      vendor: null,
      product_type: null,
      readiness_score: 0,
      readiness_grade: 'fair',
      optimization_status: null,
      pending_optimizations_count: 0,
      primary_image_url: null,
      last_synced_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    expect(check.id).toBe('x');
  });

  it('TS type includes all ProductDetail extension fields', () => {
    const check: Pick<
      ProductDetail,
      | 'description' | 'meta_title' | 'meta_description'
      | 'og_title' | 'og_description' | 'tags' | 'options'
      | 'images' | 'price_min' | 'latest_optimization' | 'score_history'
    > = {
      description: null,
      meta_title: null,
      meta_description: null,
      og_title: null,
      og_description: null,
      tags: null,
      options: [],
      images: [],
      price_min: null,
      latest_optimization: null,
      score_history: [],
    };

    expect(check.score_history).toEqual([]);
  });
});

describe('Contract: Product schema', () => {
  it('validates a Product object against the OpenAPI spec schema', () => {
    const schema = spec.components.schemas['Product'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;

    // nullableToUnion: shopify_id is not declared nullable in spec but we model it as nullable
    // Validate only the spec-declared structure
    const validate = ajv.compile(resolved);

    const sample: Product = {
      id: 'prod-uuid',
      shopify_id: 12345,
      title: 'Widget',
      handle: 'widget',
      status: 'active',
      vendor: 'Acme',
      product_type: 'Gadget',
      readiness_score: 70,
      readiness_grade: 'good',
      optimization_status: null,
      pending_optimizations_count: 2,
      primary_image_url: null,
      last_synced_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (Product):', validate.errors);
    expect(valid).toBe(true);
  });
});

describe('Contract: Optimization schema', () => {
  it('validates an Optimization object against the OpenAPI spec schema', () => {
    const schema = spec.components.schemas['Optimization'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;
    const validate = ajv.compile(resolved);

    const sample: Optimization = {
      id: 'opt-uuid',
      product_id: 'prod-uuid',
      product_title: 'Widget',
      field: 'title',
      status: 'pending',
      score_before: null,
      score_after: null,
      approved_at: null,
      applied_at: null,
      reverted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (Optimization):', validate.errors);
    expect(valid).toBe(true);
  });
});

describe('Contract: OptimizationDetail schema', () => {
  it('validates an OptimizationDetail object against the OpenAPI spec schema', () => {
    const schema = spec.components.schemas['OptimizationDetail'];
    const flatSchema = flattenAllOf(schema, spec);
    const validate = ajv.compile(flatSchema);

    const sample: OptimizationDetail = {
      id: 'opt-uuid',
      product_id: 'prod-uuid',
      product_title: 'Widget',
      field: 'description',
      status: 'applied',
      score_before: 60,
      score_after: 80,
      approved_at: '2026-01-02T00:00:00Z',
      applied_at: '2026-01-03T00:00:00Z',
      reverted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
      original_content: 'Old description',
      optimized_content: 'Better description',
      rejection_reason: null,
      shopify_error: null,
      image_shopify_id: null,
      approved_by_name: null,
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (OptimizationDetail):', validate.errors);
    expect(valid).toBe(true);
  });
});

describe('Contract: ScoreHistory schema', () => {
  it('validates a Score object against the ScoreHistory schema', () => {
    const schema = spec.components.schemas['ScoreHistory'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;
    const validate = ajv.compile(resolved);

    const sample: Score = {
      id: 'score-uuid',
      overall_score: 75,
      grade: 'C',
      score_change: null,
      scored_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (ScoreHistory):', validate.errors);
    expect(valid).toBe(true);
  });
});

describe('Contract: ScoreDetail schema', () => {
  it('validates a ScoreDetail object against the OpenAPI spec schema', () => {
    const schema = spec.components.schemas['ScoreDetail'];
    const flatSchema = flattenAllOf(schema, spec);
    const validate = ajv.compile(flatSchema);

    const sample: ScoreDetail = {
      id: 'score-uuid',
      overall_score: 75,
      grade: 'C',
      score_change: 5,
      scored_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      product_id: 'prod-uuid',
      category_scores: {
        title: { score: 85, weight: 0.2 },
        description: { score: 60, weight: 0.25 },
      },
      recommendations: ['Add meta description'],
      lowest_categories: [{ category: 'description', score: 60 }],
      potential_improvement: 15,
      improved: false,
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (ScoreDetail):', validate.errors);
    expect(valid).toBe(true);
  });
});

describe('Contract: Webhook schema', () => {
  it('validates a Webhook object against the OpenAPI spec schema', () => {
    const schema = spec.components.schemas['Webhook'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;
    const validate = ajv.compile(resolved);

    const sample: Webhook = {
      id: 'wh-uuid',
      url: 'https://example.com/webhooks',
      events: ['optimization.applied', 'product.scored'],
      status: 'active',
      failure_count: 0,
      last_triggered_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (Webhook):', validate.errors);
    expect(valid).toBe(true);
  });
});

describe('Contract: WebhookDetail schema', () => {
  it('validates a WebhookDetail object against the OpenAPI spec schema', () => {
    const schema = spec.components.schemas['WebhookDetail'];
    const flatSchema = flattenAllOf(schema, spec);
    const validate = ajv.compile(flatSchema);

    const sample: WebhookDetail = {
      id: 'wh-uuid',
      url: 'https://example.com/webhooks',
      events: ['optimization.applied'],
      status: 'active',
      failure_count: 0,
      last_triggered_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      last_success_at: null,
      last_failure_at: null,
      last_error: null,
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (WebhookDetail):', validate.errors);
    expect(valid).toBe(true);
  });
});

describe('Contract: Settings schema', () => {
  // SPEC-ABSENT: Settings shape is defined inline in the /api/v1/settings response body
  // (openapi/v1.yaml lines 1410-1440) but there is no named Settings component schema
  // in components/schemas. AJV cannot compile a named ref for it.
  // TODO: ask API team to promote Settings to a named schema component.
  it('validates a Settings object against a locally-defined schema (SPEC-ABSENT named component)', () => {
    // Built from inline schema at lines 1410-1440
    const settingsSchema = {
      type: 'object',
      properties: {
        brand_voice: { type: ['string', 'null'] },
        brand_context: { type: ['string', 'null'] },
        required_keywords: {
          oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }],
        },
        excluded_keywords: {
          oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }],
        },
        default_fields: { type: 'array', items: { type: 'string' } },
        auto_push_on_approve: { type: 'boolean' },
      },
    };

    const validate = ajv.compile(settingsSchema);

    const sample: Settings = {
      brand_voice: 'Friendly',
      brand_context: null,
      required_keywords: ['handcrafted'],
      excluded_keywords: null,
      default_fields: ['title', 'description'],
      auto_push_on_approve: false,
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (Settings):', validate.errors);
    expect(valid).toBe(true);
  });
});

describe('Contract: TypeScript type coverage — new resources', () => {
  it('Product type has all base fields', () => {
    const check: Pick<Product, 'id' | 'status' | 'readiness_score' | 'readiness_grade'> = {
      id: 'x',
      status: 'archived',
      readiness_score: 50,
      readiness_grade: 'poor',
    };
    expect(check.id).toBe('x');
  });

  it('OptimizationDetail type has all detail fields', () => {
    const check: Pick<OptimizationDetail, 'original_content' | 'optimized_content' | 'rejection_reason'> = {
      original_content: 'old',
      optimized_content: 'new',
      rejection_reason: null,
    };
    expect(check.original_content).toBe('old');
  });

  it('ScoreDetail type has all detail fields', () => {
    const check: Pick<ScoreDetail, 'product_id' | 'category_scores' | 'recommendations' | 'improved'> = {
      product_id: 'p',
      category_scores: {},
      recommendations: [],
      improved: true,
    };
    expect(check.improved).toBe(true);
  });

  it('WebhookDetail type has all detail fields', () => {
    const check: Pick<WebhookDetail, 'last_success_at' | 'last_failure_at' | 'last_error'> = {
      last_success_at: null,
      last_failure_at: null,
      last_error: null,
    };
    expect(check.last_error).toBeNull();
  });

  it('Settings type has all fields including nullable', () => {
    const check: Settings = {
      brand_voice: null,
      brand_context: null,
      required_keywords: null,
      excluded_keywords: null,
      default_fields: [],
      auto_push_on_approve: false,
    };
    expect(check.auto_push_on_approve).toBe(false);
  });
});

// ---- M3a contract tests ----

describe('Contract: ProductInput request body schema (POST /api/v1/products)', () => {
  it('validates a full ProductCreateInput against the spec ProductInput schema', () => {
    const schema = spec.components.schemas['ProductInput'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;
    const validate = ajv.compile(resolved);

    // Build a fully-populated ProductCreateInput sample
    const sample: ProductCreateInput = {
      title: 'Organic Cotton Tee',
      description: '<p>Great shirt</p>',
      handle: 'organic-cotton-tee',
      status: 'active',
      vendor: 'EcoThreads',
      product_type: 'Apparel',
      meta_title: 'Organic Cotton Tee | EcoThreads',
      meta_description: 'Shop our top organic tee.',
      og_title: 'Organic Cotton Tee',
      og_description: 'Sustainable and stylish.',
      tags: 'organic,cotton',
      external_id: 'ext-123',
      images: [
        { id: 'img-1', src: 'https://example.com/img.jpg', altText: 'Product image', width: 800, height: 800 },
      ],
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (ProductInput):', validate.errors);
    expect(valid).toBe(true);
  });

  it('validates a minimal ProductCreateInput (all fields optional)', () => {
    const schema = spec.components.schemas['ProductInput'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;
    const validate = ajv.compile(resolved);

    // Empty object is valid — spec has no required fields in ProductInput
    const sample: ProductCreateInput = {};

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (ProductInput minimal):', validate.errors);
    expect(valid).toBe(true);
  });
});

describe('Contract: WebhookCreate request body schema (POST /api/v1/webhooks)', () => {
  it('validates a WebhookCreateInput against the spec WebhookCreate schema', () => {
    const schema = spec.components.schemas['WebhookCreate'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;
    const validate = ajv.compile(resolved);

    const sample = {
      url: 'https://example.com/webhooks',
      events: ['optimization.applied', 'product.scored'],
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (WebhookCreate):', validate.errors);
    expect(valid).toBe(true);
  });

  it('rejects WebhookCreate missing required url field', () => {
    const schema = spec.components.schemas['WebhookCreate'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;
    const validate = ajv.compile(resolved);

    const invalid = { events: ['product.scored'] };
    expect(validate(invalid)).toBe(false);
  });

  it('rejects WebhookCreate missing required events field', () => {
    const schema = spec.components.schemas['WebhookCreate'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;
    const validate = ajv.compile(resolved);

    const invalid = { url: 'https://example.com/webhooks' };
    expect(validate(invalid)).toBe(false);
  });
});

describe('Contract: WebhookWithSecret TypeScript type coverage', () => {
  it('WebhookWithSecret extends WebhookDetail and includes secret', () => {
    const check: WebhookWithSecret = {
      id: 'wh-uuid',
      url: 'https://example.com/webhooks',
      events: ['optimization.applied'],
      status: 'active',
      failure_count: 0,
      last_triggered_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      last_success_at: null,
      last_failure_at: null,
      last_error: null,
      secret: 'whsec_abc123',
    };
    expect(typeof check.secret).toBe('string');
    expect(check.secret.length).toBeGreaterThan(0);
  });
});

describe('Contract: OptimizationRejectInput schema', () => {
  // SPEC-ABSENT named component: rejection body is defined inline in the path
  // (openapi/v1.yaml lines 1029-1035), not as a named schema in components/schemas.
  // We validate against a locally-defined schema.
  it('validates an OptimizationRejectInput with optional reason (SPEC-ABSENT named component)', () => {
    const rejectSchema = {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
    };
    const validate = ajv.compile(rejectSchema);

    expect(validate({ reason: 'Does not match brand voice' })).toBe(true);
    expect(validate({})).toBe(true); // reason is optional
    expect(validate({ reason: null })).toBe(false); // null not allowed — string only
  });
});

describe('Contract: ScoreCalculationResult schema', () => {
  it('validates a ScoreCalculationResult against the spec schema', () => {
    const schema = spec.components.schemas['ScoreCalculationResult'];
    const resolved = deepResolveRefs(schema, spec) as Record<string, unknown>;
    const validate = ajv.compile(resolved);

    const sample = {
      product_id: 'prod-uuid',
      overall_score: 88,
      grade: 'excellent',
      category_scores: { title: { score: 90 } },
      recommendations: ['Optimize description'],
      calculated_at: '2026-05-16T00:00:00Z',
    };

    const valid = validate(sample);
    if (!valid) console.error('AJV errors (ScoreCalculationResult):', validate.errors);
    expect(valid).toBe(true);
  });
});
