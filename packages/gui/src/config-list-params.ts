export interface ConfigListParams {
  projectPath?: string;
  homePath?: string;
}

export function createConfigListParams(): ConfigListParams {
  const projectPath = import.meta.env.VITE_MULTIVERSE_GUI_PROJECT_PATH;
  const homePath = import.meta.env.VITE_MULTIVERSE_GUI_HOME_PATH;

  return {
    ...(projectPath ? { projectPath } : {}),
    ...(homePath ? { homePath } : {}),
  };
}
