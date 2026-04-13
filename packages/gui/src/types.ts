export interface ConfigFile {
  path: string;
  type: 'markdown' | 'json' | 'text';
}

export interface ConfigGroup {
  label: string;
  basePath: string;
  files: ConfigFile[];
}
