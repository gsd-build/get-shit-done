// allow-test-rule: source-text-is-the-product
// agents/*.md text IS the deployed contract — Claude Code, Codex, etc. load these
// files at runtime and surface their content to users. Testing for retired slash
// commands in this text is testing what real users will see.

/**
 * Bug #3605: Stale slash command references in 5 agent files
 *
 * After #3042 deleted /gsd-research-phase (replaced by
 * /gsd-plan-phase --research-phase <N>) and v1.40.0 consolidated /gsd-insert-phase
 * into /gsd-phase insert, six occurrences survived in agents/*.md because none of
 * the consolidation passes (#3029, #3044, #3131) included agents/ in their per-name
 * scrub scope. scripts/fix-slash-commands.cjs lists agents/ in SEARCH_DIRS but only
 * runs the /gsd- → /gsd: namespace transform, not retired-name replacement.
 *
 * This guard fails when any retired command name reappears in agents/*.md.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');

const RETIRED_COMMANDS = [
  '/gsd-research-phase',
  '/gsd-insert-phase',
  '/gsd-add-phase',
  '/gsd-remove-phase',
  '/gsd-analyze-dependencies',
];

function listAgentFiles() {
  return fs
    .readdirSync(AGENTS_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(AGENTS_DIR, name));
}

function scanForRetired(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    for (const cmd of RETIRED_COMMANDS) {
      const idx = lines[i].indexOf(cmd);
      if (idx === -1) continue;
      const next = lines[i].charCodeAt(idx + cmd.length);
      // Only count if the match is a real invocation, not a prefix of a longer name.
      // The next char must be a non-name char (anything outside [A-Za-z0-9-_]).
      const isWordBoundary =
        Number.isNaN(next) ||
        !((next >= 48 && next <= 57) || // 0-9
          (next >= 65 && next <= 90) || // A-Z
          (next >= 97 && next <= 122) || // a-z
          next === 45 || // -
          next === 95); // _
      if (!isWordBoundary) continue;
      hits.push({ line: i + 1, cmd, text: lines[i].trim() });
    }
  }
  return hits;
}

describe('bug #3605: agent contracts must not reference retired slash commands', () => {
  const agentFiles = listAgentFiles();

  test('at least one agent file is scanned (smoke)', () => {
    assert.ok(agentFiles.length > 0, 'expected agents/*.md to exist');
  });

  for (const file of agentFiles) {
    const rel = path.relative(path.join(__dirname, '..'), file);
    test(`${rel} contains no retired slash commands`, () => {
      const hits = scanForRetired(file);
      assert.deepEqual(
        hits,
        [],
        `${rel} contains retired command references:\n` +
          hits.map((h) => `  line ${h.line}: ${h.cmd} — ${h.text}`).join('\n'),
      );
    });
  }
});
