/**
 * Regression test for #1750: orphaned hook files from removed features
 * (e.g., gsd-intel-*.js) should NOT be flagged as stale by gsd-check-update.js.
 *
 * The stale hooks scanner should only check hooks that are part of the current
 * distribution, not every gsd-*.js file in the hooks directory.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// MANAGED_HOOKS lives in the worker file (extracted from inline -e code to eliminate
// template-literal regex-escaping concerns). Tests read the worker directly.
const CHECK_UPDATE_PATH = path.join(__dirname, '..', 'hooks', 'gsd-check-update.js');
const WORKER_PATH = path.join(__dirname, '..', 'hooks', 'gsd-check-update-worker.js');
const BUILD_HOOKS_PATH = path.join(__dirname, '..', 'scripts', 'build-hooks.js');

describe('orphaned hooks stale detection (#1750)', () => {
  test('stale hook scanner uses an allowlist of managed hooks, not a wildcard', () => {
    const content = fs.readFileSync(WORKER_PATH, 'utf8');

    // The scanner MUST NOT use a broad `startsWith('gsd-')` filter that catches
    // orphaned files from removed features (gsd-intel-index.js, gsd-intel-prune.js, etc.)
    // Instead, it should reference a known set of managed hook filenames.
    const hasBroadFilter = /readdirSync\([^)]+\)\.filter\([^)]*startsWith\('gsd-'\)\s*&&[^)]*endsWith\('\.js'\)/s.test(content);
    assert.ok(!hasBroadFilter,
      'scanner must NOT use broad startsWith("gsd-") && endsWith(".js") filter — ' +
      'this catches orphaned hooks from removed features (e.g., gsd-intel-index.js). ' +
      'Use a MANAGED_HOOKS allowlist instead.');
  });

  test('gsd-check-update.js spawns the worker by file path (not inline -e code)', () => {
    // After the worker extraction, the main hook must spawn the worker file
    // rather than embedding all logic in a template literal.
    const content = fs.readFileSync(CHECK_UPDATE_PATH, 'utf8');
    assert.ok(
      content.includes('gsd-check-update-worker.js'),
      'gsd-check-update.js must reference gsd-check-update-worker.js as the spawn target'
    );
    assert.ok(
      !content.includes("'-e'"),
      'gsd-check-update.js must not use node -e inline code (logic moved to worker file)'
    );
  });

  test('managed hooks list in worker matches build-hooks HOOKS_TO_COPY JS entries', () => {
    // Extract JS hooks from build-hooks.js HOOKS_TO_COPY
    const buildContent = fs.readFileSync(BUILD_HOOKS_PATH, 'utf8');
    const hooksArrayMatch = buildContent.match(/HOOKS_TO_COPY\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(hooksArrayMatch, 'should find HOOKS_TO_COPY array');

    const jsHooks = [];
    const hookEntries = hooksArrayMatch[1].matchAll(/'([^']+\.js)'/g);
    for (const m of hookEntries) {
      jsHooks.push(m[1]);
    }
    assert.ok(jsHooks.length >= 5, `expected at least 5 JS hooks in HOOKS_TO_COPY, got ${jsHooks.length}`);

    // MANAGED_HOOKS in the worker must include each JS hook from HOOKS_TO_COPY
    const workerContent = fs.readFileSync(WORKER_PATH, 'utf8');
    for (const hook of jsHooks) {
      assert.ok(
        workerContent.includes(hook),
        `MANAGED_HOOKS in worker should include '${hook}' from HOOKS_TO_COPY`
      );
    }
  });

  test('orphaned hook filenames are NOT in the MANAGED_HOOKS list', () => {
    const workerContent = fs.readFileSync(WORKER_PATH, 'utf8');

    // These are real orphaned hooks from the removed intel feature
    const orphanedHooks = [
      'gsd-intel-index.js',
      'gsd-intel-prune.js',
      'gsd-intel-session.js',
    ];

    for (const orphan of orphanedHooks) {
      assert.ok(
        !workerContent.includes(orphan),
        `orphaned hook '${orphan}' must NOT be in the MANAGED_HOOKS list`
      );
    }
  });
});
