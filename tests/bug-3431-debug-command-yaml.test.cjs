// allow-test-rule: source-text-is-the-product
// Command markdown frontmatter is the deployed contract; this regression test
// verifies the real YAML surface that external parsers consume.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const DEBUG_COMMAND_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'debug.md');

function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, 'command must start with YAML frontmatter');
  return YAML.parse(match[1]);
}

test('#3431: commands/gsd/debug.md frontmatter parses as YAML and preserves argument-hint', () => {
  const frontmatter = readFrontmatter(DEBUG_COMMAND_PATH);

  assert.equal(frontmatter.name, 'gsd:debug');
  assert.equal(
    frontmatter['argument-hint'],
    '[list | status <slug> | continue <slug> | --diagnose] [issue description]',
    'argument-hint should remain user-visible text after YAML parsing'
  );
});
