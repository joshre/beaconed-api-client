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
    expect(typeof client.products.list).toBe('function');
    expect(typeof client.products.scores).toBe('function');
    expect(typeof client.products.optimizations).toBe('function');
    expect(typeof client.products.listAll).toBe('function');
  });

  it('exposes an optimizations resource', () => {
    const client = new BeaconedClient({ apiKey: 'test-key' });
    expect(client.optimizations).toBeDefined();
    expect(typeof client.optimizations.list).toBe('function');
    expect(typeof client.optimizations.get).toBe('function');
    expect(typeof client.optimizations.listAll).toBe('function');
  });

  it('exposes a scores resource', () => {
    const client = new BeaconedClient({ apiKey: 'test-key' });
    expect(client.scores).toBeDefined();
    expect(typeof client.scores.listByProduct).toBe('function');
    expect(typeof client.scores.latestByProduct).toBe('function');
    expect(typeof client.scores.list).toBe('function');
    expect(typeof client.scores.latest).toBe('function');
    expect(typeof client.scores.listAll).toBe('function');
  });

  it('exposes a settings resource', () => {
    const client = new BeaconedClient({ apiKey: 'test-key' });
    expect(client.settings).toBeDefined();
    expect(typeof client.settings.get).toBe('function');
  });

  it('exposes a webhooks resource', () => {
    const client = new BeaconedClient({ apiKey: 'test-key' });
    expect(client.webhooks).toBeDefined();
    expect(typeof client.webhooks.list).toBe('function');
    expect(typeof client.webhooks.get).toBe('function');
    expect(typeof client.webhooks.events).toBe('function');
    expect(typeof client.webhooks.listAll).toBe('function');
  });
});
