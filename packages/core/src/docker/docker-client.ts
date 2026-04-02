import type { DockerAvailability } from '@multiverse/types';
import Docker from 'dockerode';

export class DockerClient {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async checkAvailability(): Promise<DockerAvailability> {
    try {
      await this.docker.ping();
      const version = await this.docker.version();

      return {
        available: true,
        version: version.Version,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getDocker(): Docker {
    return this.docker;
  }
}
