// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression test for bug #2784
 *
 * /gsd-update cache-clear step only cleared per-runtime cache paths
 * (e.g. ~/.claude/cache/gsd-update-check.json) but the SessionStart hook
 * (hooks/gsd-check-update.js) writes to the shared tool-agnostic path
 * ~/.cache/gsd/gsd-update-check.json. After a successful update, the statusline
 * kept showing the stale "⬆ /gsd-update" indicator because the actual cache
 * file was never deleted.
 *
 * Fix: add `rm -f "$HOME/.cache/gsd/gsd-update-check.json"` to the
 * run_update step's cache-clear block in get-shit-done/workflows/update.md.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const UPDATE_WORKFLOW = path.join(
  REPO_ROOT,
  'get-shit-done',
  'workflows',
  'update.md'
);
const CHECK_UPDATE_HOOK = path.join(REPO_ROOT, 'hooks', 'gsd-check-update.js');

describe('bug-2784: update.md cache-clear covers shared cache path', () => {
  test('gsd-check-update.js hook constructs cache dir from .cache and gsd path segments', () => {
    const hookContent = fs.readFileSync(CHECK_UPDATE_HOOK, 'utf-8');
    // Parse the path.join() call structurally rather than text-grepping.
    const m = hookContent.match(/const cacheDir\s*=\s*path\.join\(([^)]+)\)/);
    assert.ok(
      m !== null,
      'hook must assign cacheDir via path.join() with explicit path segments'
    );
    const segments = m[1].split(',').map((a) => a.trim().replace(/^['"]|['"]$/g, ''));
    assert.ok(
      segments.includes('.cache'),
      `hook cacheDir path.join() must include '.cache' segment; got: ${JSON.stringify(segments)}`
    );
    assert.ok(
      segments.includes('gsd'),
      `hook cacheDir path.join() must include 'gsd' segment; got: ${JSON.stringify(segments)}`
    );
  });

  test('update.md run_update bash commands include rm for shared gsd cache file', () => {
    const workflowContent = fs.readFileSync(UPDATE_WORKFLOW, 'utf-8');
    // Parse the step block structurally, then extract only bash fenced code lines.
    const stepMatch = workflowContent.match(/<step name="run_update">[\s\S]*?<\/step>/);
    assert.ok(stepMatch, 'update.md must have a <step name="run_update"> block');
    const stepContent = stepMatch[0];

    const bashLines = [];
    const fenceRe = /```(?:bash|sh)\n([\s\S]*?)```/g;
    let m;
    while ((m = fenceRe.exec(stepContent)) !== null) {
      for (const line of m[1].split('\n')) {
        const trimmed = line.trim();
        if (trimmed) bashLines.push(trimmed);
      }
    }

    const sharedCacheClearCmds = bashLines.filter(
      (line) => /^rm\b/.test(line) && line.includes('.cache/gsd/gsd-update-check.json')
    );
    assert.ok(
      sharedCacheClearCmds.length > 0,
      [
        'run_update step bash blocks must include an `rm` command targeting .cache/gsd/gsd-update-check.json.',
        `Bash lines found: ${JSON.stringify(bashLines)}`,
      ].join('\n')
    );
    const hasHomeExpansion = sharedCacheClearCmds.some(
      (line) => line.includes('$HOME') || line.includes('~/')
    );
    assert.ok(
      hasHomeExpansion,
      `shared cache rm command must use $HOME or ~/ expansion; found: ${JSON.stringify(sharedCacheClearCmds)}`
    );
  });
});
