import { Command } from 'commander';
import { startCommand } from './commands/start.js';

const program = new Command();

program.name('multiverse').version('0.0.1').description('Coding agent harness management tool');

program.command('start').description('Start a containerized coding agent').action(startCommand);

program.parse();
