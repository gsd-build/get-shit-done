/**
 * Regression guard for #1766: $GSD_TOOLS env var undefined
 *
 * All command files must use the resolved path to gsd-tools.cjs
 * ($HOME/.claude/get-shit-done/bin/gsd-tools.cjs), not the undefined
 * $GSD_TOOLS variable. This test catches any command file that
 * references the undefined variable.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

describe('command files: gsd-tools path references (#1766)', () => {
  test('no command file references undefined $GSD_TOOLS variable', () => {
    const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(COMMANDS_DIR, file), 'utf-8');
      // Match $GSD_TOOLS or "$GSD_TOOLS" or ${GSD_TOOLS} used as a path
      // (not as a documentation reference)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\$GSD_TOOLS\b/.test(line) && /node\s/.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    assert.strictEqual(violations.length, 0,
      'Command files must not reference undefined $GSD_TOOLS. ' +
      'Use $HOME/.claude/get-shit-done/bin/gsd-tools.cjs instead.\n' +
      'Violations:\n' + violations.join('\n'));
  });

  test('workstreams.md documents gsd-sdk query or legacy gsd-tools.cjs', () => {
    const content = fs.readFileSync(
      path.join(COMMANDS_DIR, 'workstreams.md'), 'utf-8'
    );

    assert.ok(
      /gsd-sdk\s+query/.test(content) || /gsd-tools\.cjs/.test(content),
      'workstreams.md should document gsd-sdk query or gsd-tools.cjs'
    );

    const lines = content.split('\n');
    for (const line of lines) {
      if (/node\s/.test(line)) {
        assert.ok(
          line.includes('gsd-tools.cjs'),
          'Each node invocation must reference gsd-tools.cjs, got: ' + line.trim()
        );
      }
    }
  });
});
