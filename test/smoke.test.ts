import { describe, it, expect } from 'vitest';
import { BeaconedClient } from '../src/index.js';

describe('BeaconedClient', () => {
  it('stores the apiKey', () => {
    const client = new BeaconedClient({ apiKey: 'x' });
    expect(client.apiKey).toBe('x');
  });

  it('defaults baseUrl to https://beaconed.ai', () => {
    const client = new BeaconedClient({ apiKey: 'test-key' });
    expect(client.baseUrl).toBe('https://beaconed.ai');
  });

  it('accepts a custom baseUrl', () => {
    const client = new BeaconedClient({ apiKey: 'test-key', baseUrl: 'http://localhost:3000' });
    expect(client.baseUrl).toBe('http://localhost:3000');
  });

  it('strips trailing slash from baseUrl', () => {
    const client = new BeaconedClient({ apiKey: 'test-key', baseUrl: 'https://beaconed.ai/' });
    expect(client.baseUrl).toBe('https://beaconed.ai');
  });

  it('throws when apiKey is empty', () => {
    expect(() => new BeaconedClient({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('exposes a products resource', () => {
    const client = new BeaconedClient({ apiKey: 'test-key' });
    expect(client.products).toBeDefined();
    expect(typeof client.products.get).toBe('function');
  });
});
