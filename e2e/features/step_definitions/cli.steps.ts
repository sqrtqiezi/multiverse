import assert from 'node:assert';
import { Then, When } from '@cucumber/cucumber';
import { run } from '@multiverse/cli';

let output: string;

When('I run the CLI with {string}', (args: string) => {
  output = run(args.split(' '));
});

Then('the output should be {string}', (expected: string) => {
  assert.strictEqual(output, expected);
});
