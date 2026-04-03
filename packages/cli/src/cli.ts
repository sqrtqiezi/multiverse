import { Command } from 'commander';
import { startCommand } from './commands/start.js';

const CLI_NAME = 'multiverse';
const CLI_VERSION = '0.0.1';

function createProgram() {
  const program = new Command();

  program.name(CLI_NAME).version(CLI_VERSION).description('Coding agent harness management tool');

  program.command('start').description('Start a containerized coding agent').action(startCommand);

  return program;
}

export function run(args: string[]): string {
  if (args.includes('--version') || args.includes('-V')) {
    return `${CLI_NAME} ${CLI_VERSION}`;
  }

  const program = createProgram();
  let output = '';

  program.exitOverride().configureOutput({
    writeOut: (str) => {
      output += str;
    },
    writeErr: (str) => {
      output += str;
    },
  });

  try {
    program.parse(args, { from: 'user' });
  } catch {
    // Intentionally swallow to keep this helper deterministic for tests.
  }

  return output.trim();
}

const isDirectExecution = process.argv[1]?.endsWith('/dist/cli.js');

if (isDirectExecution) {
  const program = createProgram();
  void program.parseAsync(process.argv).catch(async (error) => {
    const { ErrorHandler } = await import('@multiverse/core');
    const { formatErrorOutput, toAppError } = await import('./utils/error-formatter.js');

    const handler = new ErrorHandler();
    const appError = toAppError(error);
    const formatted = handler.format(appError);

    console.error(formatErrorOutput(formatted));
    process.exit(formatted.exitCode);
  });
}
