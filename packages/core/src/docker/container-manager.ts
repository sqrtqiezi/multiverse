import type { ContainerConfig } from '@multiverse/types';
import type { Container } from 'dockerode';
import type { DockerClient } from './docker-client.js';

export class ContainerManager {
  constructor(private dockerClient: DockerClient) {}

  async create(config: ContainerConfig): Promise<Container> {
    const docker = this.dockerClient.getDocker();
    const tty = config.tty ?? true;

    const binds = config.volumes.map((v) => `${v.hostPath}:${v.containerPath}:${v.mode}`);

    return await docker.createContainer({
      Image: config.image,
      User: config.user,
      WorkingDir: config.workDir,
      Entrypoint: config.entrypoint,
      Env: config.env ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`) : undefined,
      Tty: tty,
      OpenStdin: tty,
      AttachStdin: tty,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        Binds: binds,
        ExtraHosts: config.extraHosts,
        AutoRemove: config.autoRemove ?? true,
      },
    });
  }

  async start(container: Container): Promise<void> {
    await container.start();
  }

  async createAndStart(config: ContainerConfig): Promise<Container> {
    const container = await this.create(config);
    await this.start(container);
    return container;
  }

  async logs(container: Container): Promise<string> {
    const output = await container.logs({
      stdout: true,
      stderr: true,
    });

    return output.toString('utf8');
  }

  async attach(container: Container): Promise<void> {
    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      hijack: true,
    });

    // Bind stdin/stdout
    process.stdin.pipe(stream);
    stream.pipe(process.stdout);

    // Set raw mode to preserve terminal control characters
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const resizeHandler = async () => {
      try {
        await container.resize({
          h: process.stdout.rows || 24,
          w: process.stdout.columns || 80,
        });
      } catch (_err) {
        // Ignore resize errors (container might be stopped)
      }
    };

    // Handle terminal resize
    if (process.stdout.isTTY) {
      await resizeHandler();
      process.stdout.on('resize', resizeHandler);
    }

    // Cleanup on exit
    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      stream.end();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  async waitForExit(container: Container): Promise<number> {
    const result = await container.wait();
    return result.StatusCode;
  }

  async remove(container: Container): Promise<void> {
    try {
      await container.remove({ force: true });
    } catch (_err) {
      // Ignore errors if container already removed (AutoRemove)
    }
  }
}
