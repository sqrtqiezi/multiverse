import { createRpcHandler } from './rpc-handler.js';

const handler = createRpcHandler();

process.stdin.setEncoding('utf8');

let buffer = '';
process.stdin.on('data', async (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) continue;
    const response = await handler(line);
    process.stdout.write(`${response}\n`);
  }
});

process.stderr.write('multiverse-gui-server ready\n');
