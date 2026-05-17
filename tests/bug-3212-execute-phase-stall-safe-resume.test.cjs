'use strict';

// allow-test-rule: source-text-is-product [#3212]
// The bug is in workflow/config contracts consumed by agents at runtime.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function runGsd(args, cwd) {
  return spawnSync(process.execPath, [path.join(ROOT, 'get-shit-done/bin/gsd-tools.cjs'), ...args], {
    cwd,
    encoding: 'utf8',
  });
}

describe('bug #3212 execute-phase stall detection and safe resume', () => {
  test('config schemas register executor stall detector keys', () => {
    // After Cycle 5 (#3536), both CJS and SDK source from the manifest.
    // Use the CJS runtime Set for CJS; use the manifest directly for SDK-side
    // verification (since config-schema.ts no longer has inline literals).
    const { VALID_CONFIG_KEYS: cjsKeys } = require('../get-shit-done/bin/lib/config-schema.cjs');
    const manifest = JSON.parse(read('sdk/shared/config-schema.manifest.json'));
    const manifestKeys = new Set(manifest.validKeys);

    for (const key of ['executor.stall_detect_interval_minutes', 'executor.stall_threshold_minutes']) {
      assert.ok(cjsKeys.has(key), `CJS VALID_CONFIG_KEYS must include ${key}`);
      assert.ok(manifestKeys.has(key), `Manifest validKeys must include ${key} (SDK sources from manifest)`);
    }
  });

  test('configuration docs describe stall detector defaults', () => {
    const docs = read('docs/CONFIGURATION.md');

    assert.match(docs, /`executor\.stall_detect_interval_minutes`\s*\|\s*number\s*\|\s*`5`/);
    assert.match(docs, /`executor\.stall_threshold_minutes`\s*\|\s*number\s*\|\s*`10`/);
  });

  test('config-get returns schema defaults for executor stall detector keys', (t) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3212-'));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    fs.mkdirSync(path.join(tmp, '.planning'));
    fs.writeFileSync(path.join(tmp, '.planning/config.json'), '{}\n');

    const interval = runGsd(['config-get', 'executor.stall_detect_interval_minutes', '--raw'], tmp);
    const threshold = runGsd(['config-get', 'executor.stall_threshold_minutes', '--raw'], tmp);

    assert.equal(interval.status, 0, interval.stderr);
    assert.equal(interval.stdout.trim(), '5');
    assert.equal(threshold.status, 0, threshold.stderr);
    assert.equal(threshold.stdout.trim(), '10');
  });

  test('execute-phase verifies partial-plan drift before dispatch', () => {
    const workflow = read('get-shit-done/workflows/execute-phase.md');

    assert.match(workflow, /<step name="safe_resume_gate"/, 'execute-phase must define a safe_resume_gate step');
    assert.match(workflow, /git log --oneline --grep="\$\{CURRENT_PLAN_ID\}"/, 'safe resume gate must check commits for the current plan id');
    assert.match(workflow, /SUMMARY.md is missing/, 'safe resume gate must detect production commits with missing SUMMARY.md');
    assert.match(workflow, /close out manually/, 'safe resume gate must offer manual close-out recovery');
    assert.match(workflow, /re-execute from scratch/, 'safe resume gate must offer re-execute recovery');
    assert.match(workflow, /mark-and-skip/, 'safe resume gate must offer mark-and-skip recovery');
  });

  test('execute-phase has configurable executor stall surveillance after dispatch', () => {
    const workflow = read('get-shit-done/workflows/execute-phase.md');

    assert.match(workflow, /EXECUTOR_STALL_INTERVAL_MINUTES=.*executor\.stall_detect_interval_minutes/);
    assert.match(workflow, /EXECUTOR_STALL_THRESHOLD_MINUTES=.*executor\.stall_threshold_minutes/);
    assert.match(workflow, /DISPATCH_TS=/, 'execute-phase must record dispatch timestamp');
    assert.match(workflow, /EXPECTED_BRANCH=/, 'execute-phase must record expected branch');
    assert.match(workflow, /git log "\$\{EXPECTED_BRANCH\}" --since="\$\{DISPATCH_TS\}"/, 'stall check must inspect branch commits since dispatch');
    assert.match(workflow, /continue waiting/, 'stall warning must offer continue waiting');
    assert.match(workflow, /kill and retry/, 'stall warning must offer kill and retry');
    assert.match(workflow, /kill and switch to inline execution/, 'stall warning must offer inline fallback');
  });

  test('execute-plan documents atomic close-out invariant', () => {
    const workflow = read('get-shit-done/workflows/execute-plan.md');

    assert.match(workflow, /<atomic_close_out_invariant>/, 'execute-plan must contain a formal atomic close-out invariant');
    assert.match(workflow, /production-code commit\(s\) -> SUMMARY commit -> STATE\/ROADMAP update/, 'invariant must name the legal close-out sequence');
    assert.match(workflow, /only legal half-state is mid-production-commits/, 'invariant must define the only legal half-state');
  });

  test('forensics includes the partial-plan drift detector', () => {
    const workflow = read('get-shit-done/workflows/forensics.md');

    assert.match(workflow, /Partial-plan Drift Detection/);
    assert.match(workflow, /commits exist but SUMMARY.md is missing/);
    assert.match(workflow, /safe-resume verifier/);
  });
});
