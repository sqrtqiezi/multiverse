import { configMethods } from './methods/config.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type MethodHandler = (params: Record<string, unknown>) => Promise<unknown>;

export function createRpcHandler(): (line: string) => Promise<string> {
  const methods: Record<string, MethodHandler> = {
    ...configMethods,
  };

  return async (line: string): Promise<string> => {
    let id: number | string | null = null;
    try {
      const request = JSON.parse(line) as JsonRpcRequest;
      id = request.id;

      const method = methods[request.method];
      if (!method) {
        return JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${request.method}` },
        } satisfies JsonRpcResponse);
      }

      const result = await method(request.params ?? {});
      return JSON.stringify({ jsonrpc: '2.0', id, result } satisfies JsonRpcResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message },
      } satisfies JsonRpcResponse);
    }
  };
}
