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

const CHECK_UPDATE_PATH = path.join(__dirname, '..', 'hooks', 'gsd-check-update.js');
const BUILD_HOOKS_PATH = path.join(__dirname, '..', 'scripts', 'build-hooks.js');

describe('orphaned hooks stale detection (#1750)', () => {
  test('stale hook scanner uses an allowlist of managed hooks, not a wildcard', () => {
    const content = fs.readFileSync(CHECK_UPDATE_PATH, 'utf8');

    // The scanner MUST NOT use a broad `startsWith('gsd-')` filter that catches
    // orphaned files from removed features (gsd-intel-index.js, gsd-intel-prune.js, etc.)
    // Instead, it should reference a known set of managed hook filenames.

    // Extract the spawned child script (everything between the template literal backticks)
    const childScriptMatch = content.match(/spawn\(process\.execPath,\s*\['-e',\s*`([\s\S]*?)`\]/);
    assert.ok(childScriptMatch, 'should find the spawned child script');
    const childScript = childScriptMatch[1];

    // The child script must NOT have a broad gsd-*.js wildcard filter
    const hasBroadFilter = /readdirSync\([^)]+\)\.filter\([^)]*startsWith\('gsd-'\)\s*&&[^)]*endsWith\('\.js'\)/s.test(childScript);
    assert.ok(!hasBroadFilter,
      'scanner must NOT use broad startsWith("gsd-") && endsWith(".js") filter — ' +
      'this catches orphaned hooks from removed features (e.g., gsd-intel-index.js). ' +
      'Use a MANAGED_HOOKS allowlist instead.');
  });

  test('managed hooks list in check-update matches build-hooks HOOKS_TO_COPY JS entries', () => {
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

    // The check-update hook should define its own managed hooks list
    // that matches the JS entries from HOOKS_TO_COPY
    const checkContent = fs.readFileSync(CHECK_UPDATE_PATH, 'utf8');
    const childScriptMatch = checkContent.match(/spawn\(process\.execPath,\s*\['-e',\s*`([\s\S]*?)`\]/);
    const childScript = childScriptMatch[1];

    // Verify each JS hook from HOOKS_TO_COPY is referenced in the managed list
    for (const hook of jsHooks) {
      assert.ok(
        childScript.includes(hook),
        `managed hooks in check-update should include '${hook}' from HOOKS_TO_COPY`
      );
    }
  });

  test('orphaned hook filenames would NOT match the managed hooks list', () => {
    const checkContent = fs.readFileSync(CHECK_UPDATE_PATH, 'utf8');
    const childScriptMatch = checkContent.match(/spawn\(process\.execPath,\s*\['-e',\s*`([\s\S]*?)`\]/);
    const childScript = childScriptMatch[1];

    // These are real orphaned hooks from the removed intel feature
    const orphanedHooks = [
      'gsd-intel-index.js',
      'gsd-intel-prune.js',
      'gsd-intel-session.js',
    ];

    for (const orphan of orphanedHooks) {
      assert.ok(
        !childScript.includes(orphan),
        `orphaned hook '${orphan}' must NOT be in the managed hooks list`
      );
    }
  });
});
