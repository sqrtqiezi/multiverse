type MethodHandler = (params: Record<string, unknown>) => Promise<unknown>;

export const configMethods: Record<string, MethodHandler> = {};
