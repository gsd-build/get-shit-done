'use strict';

// allow-test-rule: source-text-is-the-product
// State.md is the deployed artifact; asserting on its literal text content
// tests the deployed contract.

/**
 * Regression test for #3489
 *
 *   `gsd state complete-phase --phase <N>` was non-idempotent. Re-invoking it
 *   on a phase already marked complete in STATE.md silently rolled STATE.md
 *   back to that phase's moment-of-completion — overwriting Status, Last
 *   Activity, Current Position and the body Status/Phase with stale values
 *   derived from the just-completed phase.
 *
 *   Expected: when the target phase is already marked complete (and STATE.md
 *   has clearly advanced past it — e.g. a later phase is now in progress or
 *   inserted), `complete-phase` must be a no-op. No STATE.md write at all.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

describe('bug #3489: state complete-phase must be idempotent', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('bug-3489-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('re-running complete-phase on an already-complete phase does not roll STATE.md back', () => {
    // STATE.md as it would appear AFTER phase 02.2 was legitimately completed
    // AND a follow-up Phase 02.2.1 has since been inserted as in-progress.
    // Re-invoking `state complete-phase --phase 02.2` from a downstream tool
    // (e.g. a re-run of /gsd-execute-phase) must NOT regress this content.
    const stateMd = [
      '---',
      'milestone: v1.0',
      '---',
      '',
      '# State',
      '',
      '**Status:** in-progress',
      '**Current Phase:** 02.2.1',
      '**Last Activity:** 2026-05-13',
      '**Last Activity Description:** Phase 02.2.1 inserted (urgent — gates Phase 5)',
      '',
      '## Current Position',
      '',
      'Phase: 02.2.1 — Not planned yet',
      'Status: Phase 02.2.1 inserted (urgent — gates Phase 5)',
      'Last activity: 2026-05-13 -- Phase 02.2.1 inserted (urgent — gates Phase 5)',
      '',
    ].join('\n');

    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, stateMd, 'utf8');
    const before = fs.readFileSync(statePath, 'utf8');

    const result = runGsdTools(['state', 'complete-phase', '--phase', '02.2'], tmpDir);
    assert.ok(result.success, `command should not error, got: ${result.error || result.output}`);

    const after = fs.readFileSync(statePath, 'utf8');

    // Hard assertion: file is byte-identical to its pre-call snapshot.
    assert.equal(
      after,
      before,
      `STATE.md must not be rewritten when phase is already complete.\n\n--- before ---\n${before}\n--- after ---\n${after}`,
    );

    // Output should advertise the no-op so downstream consumers can detect it.
    let payload = null;
    try { payload = JSON.parse(result.output); } catch (_) { /* ignore */ }
    assert.ok(payload && typeof payload === 'object', `expected JSON payload, got: ${result.output}`);
    assert.deepEqual(payload.updated, [], `expected empty updated list, got: ${JSON.stringify(payload.updated)}`);
    assert.equal(payload.phase, '02.2');
    assert.equal(payload.idempotent, true, `expected idempotent:true flag, got: ${JSON.stringify(payload)}`);
  });

  test('completing the currently in-progress phase still works normally (no false-positive idempotency)', () => {
    // Sanity check: the guard must not fire on the legitimate first completion.
    const stateMd = [
      '---',
      'milestone: v1.0',
      '---',
      '',
      '# State',
      '',
      '**Status:** in-progress',
      '**Current Phase:** 03',
      '**Last Activity:** 2026-05-13',
      '',
      '## Current Position',
      '',
      'Phase: 03',
      'Status: Phase 03 executing',
      '',
    ].join('\n');

    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, stateMd, 'utf8');

    const result = runGsdTools(['state', 'complete-phase', '--phase', '03'], tmpDir);
    assert.ok(result.success, `command failed: ${result.error || result.output}`);

    const after = fs.readFileSync(statePath, 'utf8');
    assert.ok(
      after.includes('**Status:** Phase 03 complete'),
      `expected Status updated to "Phase 03 complete", got:\n${after}`,
    );

    const payload = JSON.parse(result.output);
    assert.notEqual(payload.idempotent, true, 'first completion must not be flagged idempotent');
    assert.ok(Array.isArray(payload.updated) && payload.updated.length > 0, 'expected non-empty updated list');
  });
});
