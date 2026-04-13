import { describe, expect, it } from 'vitest';
import { createRpcHandler } from '../rpc-handler.js';

describe('createRpcHandler', () => {
  it('returns method not found for unknown method', async () => {
    const handler = createRpcHandler();
    const response = JSON.parse(
      await handler(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'unknown.method' })),
    );
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe(-32601);
    expect(response.id).toBe(1);
  });

  it('returns parse error for invalid JSON', async () => {
    const handler = createRpcHandler();
    const response = JSON.parse(await handler('not json'));
    expect(response.error).toBeDefined();
    expect(response.id).toBeNull();
  });

  it('preserves request id in response', async () => {
    const handler = createRpcHandler();
    const response = JSON.parse(
      await handler(JSON.stringify({ jsonrpc: '2.0', id: 42, method: 'nonexistent' })),
    );
    expect(response.id).toBe(42);
    expect(response.jsonrpc).toBe('2.0');
  });
});
