export interface ContainerConfig {
  image: string;
  volumes: VolumeMount[];
  workDir: string;
  entrypoint?: string[];
  env?: Record<string, string>;
  autoRemove?: boolean;
}

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  mode: 'ro' | 'rw';
}

export interface DockerAvailability {
  available: boolean;
  version?: string;
  error?: string;
}

export interface CredentialPath {
  hostPath: string;
  containerPath: string;
  mode: 'ro';
}

export interface CredentialConfig {
  filePaths: CredentialPath[];
  envVars: Record<string, string>;
}
