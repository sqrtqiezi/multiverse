import { greet } from '@multiverse/core';

export function run(args: string[]): string {
  if (args.includes('--version')) {
    return 'multiverse 0.0.1';
  }
  return greet();
}

const args = process.argv.slice(2);
if (args.length > 0) {
  console.log(run(args));
}
