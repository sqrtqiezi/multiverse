import * as path from 'node:path';
import type { DockerClient } from './docker-client.js';

export class ImageBuilder {
  constructor(private dockerClient: DockerClient) {}

  async imageExists(tag: string): Promise<boolean> {
    const docker = this.dockerClient.getDocker();
    try {
      await docker.getImage(tag).inspect();
      return true;
    } catch {
      return false;
    }
  }

  async buildImage(tag: string, dockerfilePath: string): Promise<void> {
    const docker = this.dockerClient.getDocker();
    const contextDir = path.dirname(dockerfilePath);

    const tarStream = await this.createTarStream(contextDir);
    const stream = await docker.buildImage(tarStream, { t: tag });

    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  }

  async ensureImage(tag: string, dockerfilePath: string): Promise<void> {
    const exists = await this.imageExists(tag);
    if (!exists) {
      console.log(`Building image ${tag}...`);
      await this.buildImage(tag, dockerfilePath);
      console.log(`Image ${tag} built successfully`);
    }
  }

  private async createTarStream(contextDir: string): Promise<NodeJS.ReadableStream> {
    const tar = await import('tar-fs');
    return tar.pack(contextDir);
  }
}
