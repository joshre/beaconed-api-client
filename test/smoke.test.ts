import { describe, it, expect } from 'vitest';
import { BeaconedClient } from '../src/index.js';

describe('BeaconedClient', () => {
  it('stores the apiKey in config', () => {
    const client = new BeaconedClient({ apiKey: 'x' });
    expect(client.config.apiKey).toBe('x');
  });

  it('defaults baseUrl to https://beaconed.ai', () => {
    const client = new BeaconedClient({ apiKey: 'test-key' });
    expect(client.config.baseUrl).toBe('https://beaconed.ai');
  });

  it('accepts a custom baseUrl', () => {
    const client = new BeaconedClient({ apiKey: 'test-key', baseUrl: 'http://localhost:3000' });
    expect(client.config.baseUrl).toBe('http://localhost:3000');
  });
});
