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
  test('gsd-check-update.js hook writes to ~/.cache/gsd/ path', () => {
    const hookContent = fs.readFileSync(CHECK_UPDATE_HOOK, 'utf-8');
    // Verify the hook writes to the shared path (the one being missed).
    // The hook uses path.join(homeDir, '.cache', 'gsd') so check for the
    // constituent parts rather than a collapsed path string.
    const referencesSharedCache =
      hookContent.includes('.cache/gsd') ||
      hookContent.includes("'.cache'") ||
      hookContent.includes('".cache"') ||
      (hookContent.includes("'.cache'") && hookContent.includes("'gsd'")) ||
      (hookContent.includes('".cache"') && hookContent.includes('"gsd"')) ||
      hookContent.includes("path.join(homeDir, '.cache', 'gsd')");
    assert.ok(
      referencesSharedCache,
      'hook should write to ~/.cache/gsd/ shared path (via path.join or direct string)'
    );
  });

  test('update.md run_update step clears ~/.cache/gsd/gsd-update-check.json', () => {
    const workflowContent = fs.readFileSync(UPDATE_WORKFLOW, 'utf-8');

    // The workflow must explicitly clear the shared cache path the hook writes to.
    // Accept either literal $HOME or tilde expansion pattern.
    const clearsSharedPath =
      workflowContent.includes('"$HOME/.cache/gsd/gsd-update-check.json"') ||
      workflowContent.includes("'$HOME/.cache/gsd/gsd-update-check.json'") ||
      workflowContent.includes('~/.cache/gsd/gsd-update-check.json') ||
      workflowContent.includes('$HOME/.cache/gsd/gsd-update-check.json');

    assert.ok(
      clearsSharedPath,
      'update.md must clear $HOME/.cache/gsd/gsd-update-check.json — the path written by gsd-check-update.js'
    );
  });

  test('update.md run_update step places shared cache clear in the same block as per-runtime clears', () => {
    const workflowContent = fs.readFileSync(UPDATE_WORKFLOW, 'utf-8');

    // The run_update step should have a bash block that clears the cache.
    // The shared path clear must appear in the same run_update step block.
    const runUpdateStepMatch = workflowContent.match(
      /<step name="run_update">([\s\S]*?)<\/step>/
    );
    assert.ok(
      runUpdateStepMatch,
      'update.md must have a <step name="run_update"> block'
    );

    const stepContent = runUpdateStepMatch[1];
    assert.ok(
      stepContent.includes('.cache/gsd/gsd-update-check.json'),
      'run_update step must clear .cache/gsd/gsd-update-check.json'
    );
  });
});
