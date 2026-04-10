/**
 * Regression test for #2043 — autonomous.md must include Agent in allowed-tools.
 *
 * The gsd-autonomous skill spawns background agents via Agent(..., run_in_background=true).
 * Without Agent in allowed-tools the runtime rejects those calls silently.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('commands/gsd/autonomous.md allowed-tools', () => {
  test('includes Agent in allowed-tools list', () => {
    const filePath = path.join(__dirname, '..', 'commands', 'gsd', 'autonomous.md');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract the YAML frontmatter block between the first pair of --- delimiters
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(frontmatterMatch, 'autonomous.md must have YAML frontmatter');

    const frontmatter = frontmatterMatch[1];

    // Parse the allowed-tools list items (lines starting with "  - ")
    const toolLines = frontmatter
      .split('\n')
      .filter((line) => /^\s+-\s+/.test(line))
      .map((line) => line.replace(/^\s+-\s+/, '').trim());

    assert.ok(
      toolLines.includes('Agent'),
      `allowed-tools must include "Agent" but found: [${toolLines.join(', ')}]`
    );
  });
});
