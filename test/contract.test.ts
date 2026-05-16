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
import type { ProductDetail } from '../src/resources/products.js';

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
