import { describe, expect, it, vi } from 'vitest';
import { DockerClient } from '../docker-client.js';

describe('DockerClient', () => {
  it('should detect Docker availability', async () => {
    const client = new DockerClient();
    const result = await client.checkAvailability();

    expect(result).toHaveProperty('available');
    expect(typeof result.available).toBe('boolean');
  });

  it('should return Docker version when available', async () => {
    const client = new DockerClient();
    const result = await client.checkAvailability();

    if (result.available) {
      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
    }
  });

  it('should return error message when Docker unavailable', async () => {
    // Mock Dockerode to throw error
    vi.mock('dockerode', () => ({
      default: class {
        ping() {
          throw new Error('Docker not running');
        }
      },
    }));

    const client = new DockerClient();
    const result = await client.checkAvailability();

    expect(result.available).toBe(false);
    expect(result.error).toBeDefined();
  });
});
