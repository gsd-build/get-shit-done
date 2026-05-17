// allow-test-rule: source-text-is-the-product
// The command markdown is loaded directly by runtime prompt assembly.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('#3418: /gsd-progress flag routing prompt contract', () => {
  test('progress command surfaces raw arguments on a dedicated line before routing parse', () => {
    const command = fs.readFileSync(
      path.join(__dirname, '..', 'commands', 'gsd', 'progress.md'),
      'utf8'
    );

    assert.ok(
      command.includes('Arguments provided: "$ARGUMENTS"'),
      'progress.md must surface $ARGUMENTS on a dedicated line for stable flag parsing'
    );
  });

  test('progress command must not inline-substitute $ARGUMENTS into parse instruction text', () => {
    const command = fs.readFileSync(
      path.join(__dirname, '..', 'commands', 'gsd', 'progress.md'),
      'utf8'
    );

    assert.ok(
      !command.includes('Parse the first token of $ARGUMENTS:'),
      'progress.md must keep parse instructions independent from argument interpolation'
    );
  });
});
