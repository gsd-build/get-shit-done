'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2994: scripts/verify-reapply-patches.cjs ships in tarball but is
 * not installed at ${GSD_HOME}/scripts/.
 *
 * Root cause: bin/install.js copies the get-shit-done/ source tree to
 * ${configDir}/get-shit-done/ but does NOT copy the top-level scripts/
 * directory. The verifier script lived under scripts/ so /gsd-reapply-patches
 * Step 5 hit `Cannot find module …/scripts/verify-reapply-patches.cjs`.
 *
 * Fix: move the script to get-shit-done/bin/verify-reapply-patches.cjs
 * (which IS installed) and update reapply-patches.md to point there.
 *
 * This test enforces the structural invariant that prevents regression.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNTIME_SCRIPT_PATH = path.join(ROOT, 'get-shit-done', 'bin', 'verify-reapply-patches.cjs');
const STALE_SCRIPT_PATH = path.join(ROOT, 'scripts', 'verify-reapply-patches.cjs');
const REAPPLY_WORKFLOW = path.join(ROOT, 'get-shit-done', 'workflows', 'reapply-patches.md');

describe('Bug #2994: verify-reapply-patches.cjs lives at the runtime-installed path', () => {
  test('the script exists under get-shit-done/bin/ (installed by copyWithPathReplacement)', () => {
    assert.equal(fs.existsSync(RUNTIME_SCRIPT_PATH), true,
      `Expected verifier script at ${RUNTIME_SCRIPT_PATH} -- installer copies get-shit-done/ recursively`);
  });

  test('the script does NOT live at the legacy scripts/ path (not installed)', () => {
    assert.equal(fs.existsSync(STALE_SCRIPT_PATH), false,
      `scripts/ is not copied by installer; verifier must be under get-shit-done/bin/ instead`);
  });

  test('the script is requireable (loads without throwing)', () => {
    const mod = require(RUNTIME_SCRIPT_PATH);
    assert.equal(typeof mod.REASON, 'object');
    assert.notEqual(mod.REASON, null);
  });
});

// Parse reapply-patches.md to extract every `node "${GSD_HOME}/...cjs"`
// invocation as structured records. Assertions go against the parsed
// records, not against the markdown text.
function extractScriptInvocations(markdown) {
  const invocations = [];
  const re = /node\s+"\$\{GSD_HOME\}\/([^"]+\.cjs)"/g;
  let match;
  while ((match = re.exec(markdown)) !== null) {
    invocations.push({ relPath: match[1] });
  }
  return invocations;
}

describe('Bug #2994: reapply-patches workflow references the runtime-installed path', () => {
  test('every node ${GSD_HOME}/... invocation in reapply-patches.md uses an installed runtime path', () => {
    const md = fs.readFileSync(REAPPLY_WORKFLOW, 'utf-8');
    const invocations = extractScriptInvocations(md);
    assert.ok(invocations.length > 0, 'sanity: expected at least one node ${GSD_HOME}/... invocation in reapply-patches.md');

    const violations = invocations.filter(inv => !inv.relPath.startsWith('get-shit-done/'));
    assert.deepEqual(violations, [], `invocations under non-installed paths: ${JSON.stringify(violations)}`);
  });

  test('reapply-patches.md references the verifier at get-shit-done/bin/verify-reapply-patches.cjs', () => {
    const md = fs.readFileSync(REAPPLY_WORKFLOW, 'utf-8');
    const invocations = extractScriptInvocations(md);
    const verifierInvocations = invocations.filter(inv => inv.relPath.endsWith('verify-reapply-patches.cjs'));
    assert.deepEqual(
      verifierInvocations.map(i => i.relPath),
      ['get-shit-done/bin/verify-reapply-patches.cjs'],
      'workflow must call the runtime-installed verifier path exactly once',
    );
  });
});
