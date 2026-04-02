import { describe, it, expect, vi } from 'vitest';
import { ImageBuilder } from '../image-builder.js';
import { DockerClient } from '../docker-client.js';

describe('ImageBuilder', () => {
  it('should check if image exists', async () => {
    const dockerClient = new DockerClient();
    const builder = new ImageBuilder(dockerClient);

    const exists = await builder.imageExists('multiverse/claude-code:latest');
    expect(typeof exists).toBe('boolean');
  });

  it('should not build image if it already exists', async () => {
    const dockerClient = new DockerClient();
    const builder = new ImageBuilder(dockerClient);

    // Mock imageExists to return true
    vi.spyOn(builder, 'imageExists').mockResolvedValue(true);
    const buildSpy = vi.spyOn(builder, 'buildImage');

    await builder.ensureImage('multiverse/claude-code:latest', '/path/to/Dockerfile');

    expect(buildSpy).not.toHaveBeenCalled();
  });
});
