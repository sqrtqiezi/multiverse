import { When, Then } from '@cucumber/cucumber';
import assert from 'node:assert';
import { run } from '@multiverse/cli';

let output: string;

When('I run the CLI with {string}', function (args: string) {
  output = run(args.split(' '));
});

Then('the output should be {string}', function (expected: string) {
  assert.strictEqual(output, expected);
});
