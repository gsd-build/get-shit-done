// allow-test-rule: architectural-invariant
// state.cjs locking must use Atomics.wait() (not a spin-loop) and register an exit
// handler. These are implementation primitives, not string literals — behavioral tests
// cannot verify which sleep primitive was chosen. Source inspection is the right level.

/**
 * Regression tests for locking bugs #1909, #1916, #1925, #1927.
 *
 * These tests are written FIRST (TDD) — they must fail before the fixes are applied
 * and pass after.
 *
 * #1909 — CPU-burning busy-wait in acquireStateLock
 * #1916 — Lock files persist after process.exit()
 * #1925 — TOCTOU races in 8 state commands (read outside lock)
 * #1927 — config.json has no locking in setConfigValue
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, execSync, spawn } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');

const { runGsdTools, createTempProject, cleanup, TOOLS_PATH } = require('./helpers.cjs');

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function writeStateMd(tmpDir, content) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    content,
    'utf-8'
  );
}

function readStateMd(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
}

function writeConfig(tmpDir, obj) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(obj, null, 2), 'utf-8');
}

function readConfig(tmpDir) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// ─────────────────────────────────────────────────────────────────────────────
// #1909 — CPU-burning busy-wait in acquireStateLock
// Verify the implementation uses Atomics.wait (not a while-loop spin).
// ─────────────────────────────────────────────────────────────────────────────

describe('#1909 acquireStateLock: no CPU-burning busy-wait', () => {
  test('acquireStateLock source code uses Atomics.wait, not a spin-loop', () => {
    const stateSrc = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'state.cjs'),
      'utf-8'
    );

    // The bug: spin-loop pattern in acquireStateLock
    // The fix: use Atomics.wait() for cross-platform sleep, matching withPlanningLock in core.cjs
    const spinLoopPattern = /while\s*\(Date\.now\(\)\s*-\s*start\s*<\s*\w+\)\s*\{\s*(?:\/\*[^*]*\*\/)?\s*\}/;

    // Find the acquireStateLock function text
    const fnStart = stateSrc.indexOf('function acquireStateLock(');
    assert.ok(fnStart !== -1, 'acquireStateLock function must exist');

    // Extract ~50 lines after the function start to cover the retry logic
    const fnSnippet = stateSrc.slice(fnStart, fnStart + 2000);

    assert.ok(
      !spinLoopPattern.test(fnSnippet),
      'acquireStateLock must not use a CPU-burning spin-loop (while Date.now()-start < delay)'
    );

    assert.ok(
      fnSnippet.includes('Atomics.wait'),
      'acquireStateLock must use Atomics.wait() for sleeping, matching withPlanningLock in core.cjs'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #1916 — Lock files persist after process.exit()
// Verify that the STATE.md.lock file is removed even when process.exit() is called
// while the lock is held (e.g., via error() inside a locked region).
// ─────────────────────────────────────────────────────────────────────────────

describe('#1916 lock cleanup on process.exit()', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('STATE.md.lock is removed after a command exits with an error', () => {
    // Intentionally trigger an error path: state update with missing STATE.md leaves
    // no lock behind (the read-before-lock path returns gracefully, but let's verify
    // a command that holds the lock can't accidentally leave the file).
    writeStateMd(tmpDir, [
      '# Project State',
      '',
      '**Status:** Planning',
      '**Current Phase:** 01',
    ].join('\n') + '\n');

    // Run a state update — even if it fails, the lock must not remain
    runGsdTools('state update Status "In progress"', tmpDir);

    const lockPath = path.join(tmpDir, '.planning', 'STATE.md.lock');
    assert.ok(
      !fs.existsSync(lockPath),
      'STATE.md.lock must not persist after any state command terminates'
    );
  });

  test('STATE.md.lock module-level cleanup set is present in source', () => {
    // Verify the fix: module-level Set tracks held locks and process.on('exit') cleans them up.
    const stateSrc = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'state.cjs'),
      'utf-8'
    );

    assert.ok(
      stateSrc.includes("process.on('exit'"),
      "state.cjs must register process.on('exit', ...) to clean up held lock files"
    );
  });

  test('planning workspace lock owner registers exit cleanup', () => {
    // withPlanningLock moved from core.cjs to planning-workspace.cjs.
    // The lock owner must keep module-level process exit cleanup.
    const workspaceSrc = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'planning-workspace.cjs'),
      'utf-8'
    );

    assert.ok(
      workspaceSrc.includes("process.on('exit'"),
      "planning-workspace.cjs must register process.on('exit', ...) to clean up held planning lock files"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #1925 — TOCTOU races in 8 state commands
// Each of the 8 commands reads STATE.md outside the lock, then calls writeStateMd
// (which only locks the write). Two concurrent callers reading the same content
// means the second write clobbers the first.
//
// Fix: migrate all 8 to use readModifyWriteStateMd().
// Test: call the same command twice concurrently on SEPARATE fields and verify
// both updates survive.
// ─────────────────────────────────────────────────────────────────────────────

describe('#1925 TOCTOU: state commands use readModifyWriteStateMd', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state update: both concurrent updates to different fields survive', async () => {
    // Deterministic concurrency via file-barrier synchronization.
    //
    // Problem with the prior design: Promise.all([execAsync(A), execAsync(B)])
    // offers no guarantee that both subprocesses are alive simultaneously.  On a
    // loaded CI runner one subprocess can fully complete (acquire lock → transform
    // → release lock → exit) before the other's Node runtime has even started.
    // When that happens the second subprocess never contends on the lock — the
    // test trivially passes — but the test also fails to exercise what it claims
    // to test.  On Docker overlay-fs under load the opposite pathology occurs:
    // both subprocesses race O_EXCL creation, and depending on scheduler timing
    // one can observe stale fs state, causing a lost update that fails the
    // assertion.  Either way, the outcome is non-deterministic.
    //
    // Redesign: a barrier file forces both subprocesses to reach their "ready"
    // gate before either is allowed to proceed.  The barrier is removed only
    // after BOTH have signalled readiness, guaranteeing true overlap in the
    // critical section.  No sleep-based synchronization; the barrier loop uses
    // Atomics.wait (same primitive as acquireStateLock) so it yields the CPU
    // instead of spinning.

    writeStateMd(tmpDir, [
      '# Project State',
      '',
      '**Status:** Planning',
      '**Current Phase:** 01',
      '**Current Plan:** 01-01',
      '**Last Activity:** 2024-01-01',
    ].join('\n') + '\n');

    // ── Barrier infrastructure ────────────────────────────────────────────────
    // barrierPath: exists while subprocesses must hold.  Removed by the test
    //              orchestrator once both subprocesses have signalled readiness.
    // ready-{id}:  each subprocess creates this file to signal it is at the gate.
    const barrierPath = path.join(tmpDir, '.barrier');
    const readyA     = path.join(tmpDir, '.ready-a');
    const readyB     = path.join(tmpDir, '.ready-b');
    fs.writeFileSync(barrierPath, '1');       // erect the barrier
    if (fs.existsSync(readyA)) fs.unlinkSync(readyA);
    if (fs.existsSync(readyB)) fs.unlinkSync(readyB);

    // ── Wrapper script written to tmpDir ─────────────────────────────────────
    // Each subprocess runs this wrapper, which:
    //   1. Writes its ready-signal so the orchestrator knows it is alive.
    //   2. Spins (Atomics.wait, 10 ms steps) until the barrier is removed.
    //   3. Immediately calls gsd-tools to exercise the real lock contention.
    //
    // TOOLS_PATH and the caller-supplied args are injected via env vars to avoid
    // shell-quoting complexity when the tmpDir path contains spaces.
    const wrapperPath = path.join(tmpDir, '.barrier-wrapper-update.cjs');
    fs.writeFileSync(wrapperPath, [
      "'use strict';",
      'const fs   = require("fs");',
      'const path = require("path");',
      'const { execFileSync } = require("child_process");',
      'const { TOOLS_PATH, BARRIER_FILE, READY_FILE, FIELD_NAME, FIELD_VALUE, CWD_PATH } = process.env;',
      '',
      '// Signal readiness to the orchestrator.',
      'fs.writeFileSync(READY_FILE, String(process.pid));',
      '',
      '// Wait at the barrier (yield via Atomics.wait so we do not spin the CPU).',
      '// Budget: 10 s — if the orchestrator never releases us, something is broken.',
      'const sab = new SharedArrayBuffer(4);',
      'const sai = new Int32Array(sab);',
      'const deadline = Date.now() + 10000;',
      'while (fs.existsSync(BARRIER_FILE)) {',
      '  if (Date.now() > deadline) { process.stderr.write("barrier timeout\\n"); process.exit(1); }',
      '  Atomics.wait(sai, 0, 0, 10); // sleep 10 ms, then re-check',
      '}',
      '',
      '// Barrier is down — execute the actual gsd-tools command.',
      'execFileSync(process.execPath, [TOOLS_PATH, "state", "update", FIELD_NAME, FIELD_VALUE, "--cwd", CWD_PATH], {',
      '  stdio: "pipe",',
      '});',
    ].join('\n'));

    const nodeBin = process.execPath;

    // ── Spawn both subprocesses ───────────────────────────────────────────────
    // Both start immediately; both block at the barrier until the orchestrator
    // confirms both are ready, then both proceed to contend on the STATE.md lock.
    function spawnWrapper(fieldName, fieldValue, readyFile) {
      return new Promise((resolve, reject) => {
        const child = spawn(nodeBin, [wrapperPath], {
          env: {
            ...process.env,
            TOOLS_PATH,
            BARRIER_FILE: barrierPath,
            READY_FILE:   readyFile,
            FIELD_NAME:   fieldName,
            FIELD_VALUE:  fieldValue,
            CWD_PATH:     tmpDir,
          },
          stdio: 'pipe',
        });
        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (code) => {
          if (code !== 0) reject(new Error(`wrapper exited ${code}: ${stderr}`));
          else resolve();
        });
      });
    }

    const promiseA = spawnWrapper('Status', 'Executing', readyA);
    const promiseB = spawnWrapper('Current Phase', '02', readyB);

    // ── Orchestrate: wait for both ready-signals, then drop the barrier ───────
    // Poll with Atomics.wait (10 ms steps).  Budget: 10 s.
    const sab2 = new SharedArrayBuffer(4);
    const sai2 = new Int32Array(sab2);
    const deadline2 = Date.now() + 10000;
    while (!fs.existsSync(readyA) || !fs.existsSync(readyB)) {
      if (Date.now() > deadline2) throw new Error('Timed out waiting for both subprocesses to reach barrier');
      Atomics.wait(sai2, 0, 0, 10);
    }
    // Both subprocesses are at the gate — drop the barrier simultaneously.
    fs.unlinkSync(barrierPath);

    // ── Collect results ───────────────────────────────────────────────────────
    await Promise.all([promiseA, promiseB]);

    const content = readStateMd(tmpDir);
    assert.ok(
      content.includes('Executing') && content.includes('02'),
      'Both concurrent state update commands must survive (TOCTOU bug: second write clobbers first).\n' +
      'Content:\n' + content
    );
  });

  test('state add-decision: both concurrent calls append different decisions', async () => {
    writeStateMd(tmpDir, [
      '# Project State',
      '',
      '**Current Phase:** 01',
      '**Status:** Planning',
      '',
      '### Decisions',
      'None yet.',
    ].join('\n') + '\n');

    const nodeBin = process.execPath;
    const cmdA = `"${nodeBin}" "${TOOLS_PATH}" state add-decision --phase 01 --summary "Use TypeScript" --cwd "${tmpDir}"`;
    const cmdB = `"${nodeBin}" "${TOOLS_PATH}" state add-decision --phase 01 --summary "Use PostgreSQL" --cwd "${tmpDir}"`;

    await Promise.all([
      execAsync(cmdA, { encoding: 'utf-8' }).catch(() => {}),
      execAsync(cmdB, { encoding: 'utf-8' }).catch(() => {}),
    ]);

    const content = readStateMd(tmpDir);
    assert.ok(
      content.includes('Use TypeScript') && content.includes('Use PostgreSQL'),
      'Both concurrent add-decision calls must survive.\n' +
      'Content:\n' + content
    );
  });

  test('state add-blocker: both concurrent calls append different blockers', async () => {
    // Deterministic concurrency via file-barrier synchronization (Option A).
    //
    // Problem with the prior design: Promise.all([execAsync(A), execAsync(B)])
    // offers no guarantee that both subprocesses are alive simultaneously.  On a
    // loaded CI runner one subprocess can fully complete (acquire lock → transform
    // → release lock → exit) before the other's Node runtime has even started.
    // When that happens the second subprocess never contends on the lock — the
    // test trivially passes — but the test also fails to exercise what it claims
    // to test.  On Docker overlay-fs under load the opposite pathology occurs:
    // both subprocesses race O_EXCL creation, and depending on scheduler timing
    // one can observe stale fs state, causing a lost update that fails the
    // assertion.  Either way, the outcome is non-deterministic.
    //
    // Redesign: a barrier file forces both subprocesses to reach their "ready"
    // gate before either is allowed to proceed.  The barrier is removed only
    // after BOTH have signalled readiness, guaranteeing true overlap in the
    // critical section.  No sleep-based synchronization; the barrier loop uses
    // Atomics.wait (same primitive as acquireStateLock) so it yields the CPU
    // instead of spinning.

    writeStateMd(tmpDir, [
      '# Project State',
      '',
      '**Current Phase:** 01',
      '',
      '### Blockers',
      'None.',
    ].join('\n') + '\n');

    // ── Barrier infrastructure ────────────────────────────────────────────────
    // barrierPath: exists while subprocesses must hold.  Removed by the test
    //              orchestrator once both subprocesses have signalled readiness.
    // ready-{id}:  each subprocess creates this file to signal it is at the gate.
    const barrierPath = path.join(tmpDir, '.barrier');
    const readyA     = path.join(tmpDir, '.ready-a');
    const readyB     = path.join(tmpDir, '.ready-b');
    fs.writeFileSync(barrierPath, '1');       // erect the barrier
    if (fs.existsSync(readyA)) fs.unlinkSync(readyA);
    if (fs.existsSync(readyB)) fs.unlinkSync(readyB);

    // ── Wrapper script written to tmpDir ─────────────────────────────────────
    // Each subprocess runs this wrapper, which:
    //   1. Writes its ready-signal so the orchestrator knows it is alive.
    //   2. Spins (Atomics.wait, 10 ms steps) until the barrier is removed.
    //   3. Immediately calls gsd-tools to exercise the real lock contention.
    //
    // TOOLS_PATH and the caller-supplied args are injected via env vars to avoid
    // shell-quoting complexity when the tmpDir path contains spaces.
    const wrapperPath = path.join(tmpDir, '.barrier-wrapper.cjs');
    fs.writeFileSync(wrapperPath, [
      "'use strict';",
      'const fs   = require("fs");',
      'const path = require("path");',
      'const { execFileSync } = require("child_process");',
      'const { TOOLS_PATH, BARRIER_FILE, READY_FILE, BLOCKER_TEXT, CWD_PATH } = process.env;',
      '',
      '// Signal readiness to the orchestrator.',
      'fs.writeFileSync(READY_FILE, String(process.pid));',
      '',
      '// Wait at the barrier (yield via Atomics.wait so we do not spin the CPU).',
      '// Budget: 10 s — if the orchestrator never releases us, something is broken.',
      'const sab = new SharedArrayBuffer(4);',
      'const sai = new Int32Array(sab);',
      'const deadline = Date.now() + 10000;',
      'while (fs.existsSync(BARRIER_FILE)) {',
      '  if (Date.now() > deadline) { process.stderr.write("barrier timeout\\n"); process.exit(1); }',
      '  Atomics.wait(sai, 0, 0, 10); // sleep 10 ms, then re-check',
      '}',
      '',
      '// Barrier is down — execute the actual gsd-tools command.',
      'execFileSync(process.execPath, [TOOLS_PATH, "state", "add-blocker", "--text", BLOCKER_TEXT, "--cwd", CWD_PATH], {',
      '  stdio: "pipe",',
      '});',
    ].join('\n'));

    const nodeBin = process.execPath;

    // ── Spawn both subprocesses ───────────────────────────────────────────────
    // Both start immediately; both block at the barrier until the orchestrator
    // confirms both are ready, then both proceed to contend on the STATE.md lock.
    function spawnWrapper(blockerId, readyFile) {
      return new Promise((resolve, reject) => {
        const child = spawn(nodeBin, [wrapperPath], {
          env: {
            ...process.env,
            TOOLS_PATH,
            BARRIER_FILE: barrierPath,
            READY_FILE:   readyFile,
            BLOCKER_TEXT: blockerId,
            CWD_PATH:     tmpDir,
          },
          stdio: 'pipe',
        });
        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (code) => {
          if (code !== 0) reject(new Error(`wrapper exited ${code}: ${stderr}`));
          else resolve();
        });
      });
    }

    const promiseA = spawnWrapper('Need API credentials',    readyA);
    const promiseB = spawnWrapper('Waiting for design review', readyB);

    // ── Orchestrate: wait for both ready-signals, then drop the barrier ───────
    // Poll with Atomics.wait (10 ms steps).  Budget: 10 s.
    const sab2 = new SharedArrayBuffer(4);
    const sai2 = new Int32Array(sab2);
    const deadline2 = Date.now() + 10000;
    while (!fs.existsSync(readyA) || !fs.existsSync(readyB)) {
      if (Date.now() > deadline2) throw new Error('Timed out waiting for both subprocesses to reach barrier');
      Atomics.wait(sai2, 0, 0, 10);
    }
    // Both subprocesses are at the gate — drop the barrier simultaneously.
    fs.unlinkSync(barrierPath);

    // ── Collect results ───────────────────────────────────────────────────────
    await Promise.all([promiseA, promiseB]);

    const content = readStateMd(tmpDir);
    assert.ok(
      content.includes('Need API credentials') && content.includes('Waiting for design review'),
      'Both concurrent add-blocker calls must survive.\n' +
      'Content:\n' + content
    );
  });

  test('state commands use readModifyWriteStateMd (source audit)', () => {
    const stateSrc = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'state.cjs'),
      'utf-8'
    );

    // Each of these functions should NOT contain a bare `fs.readFileSync(...STATE.md...)`
    // followed by a `writeStateMd` — they should use readModifyWriteStateMd instead.
    //
    // We verify this by checking that within the function body we do NOT see the
    // TOCTOU pattern: `let content = fs.readFileSync(statePath` (old pattern)
    // while also calling `writeStateMd` — except wrapped in readModifyWrite.

    const affectedFunctions = [
      'cmdStateUpdate',
      'cmdStateAdvancePlan',
      'cmdStateRecordMetric',
      'cmdStateUpdateProgress',
      'cmdStateAddDecision',
      'cmdStateAddBlocker',
      'cmdStateResolveBlocker',
      'cmdStateRecordSession',
      'cmdStateBeginPhase',
    ];

    for (const fnName of affectedFunctions) {
      // Find the function in source
      const fnIdx = stateSrc.indexOf(`function ${fnName}(`);
      assert.ok(fnIdx !== -1, `${fnName} must exist in state.cjs`);

      // Grab the function body (rough heuristic: up to the next top-level function)
      const bodyStart = stateSrc.indexOf('{', fnIdx);
      // Find end by tracking braces
      let depth = 0;
      let bodyEnd = bodyStart;
      for (let i = bodyStart; i < stateSrc.length; i++) {
        if (stateSrc[i] === '{') depth++;
        else if (stateSrc[i] === '}') {
          depth--;
          if (depth === 0) { bodyEnd = i; break; }
        }
      }
      const fnBody = stateSrc.slice(fnIdx, bodyEnd + 1);

      // The function must call readModifyWriteStateMd
      assert.ok(
        fnBody.includes('readModifyWriteStateMd'),
        `${fnName} must use readModifyWriteStateMd() to prevent TOCTOU races`
      );

      // The function must NOT have bare readFileSync for statePath outside the lambda
      // (the readFileSync inside readModifyWrite's lambda is fine — that's inside the lock)
      // We check for the pre-fix pattern: `let content = fs.readFileSync(statePath`
      assert.ok(
        !fnBody.match(/let content\s*=\s*fs\.readFileSync\s*\(\s*statePath/),
        `${fnName} must not read STATE.md with fs.readFileSync outside readModifyWriteStateMd (TOCTOU)`
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #1927 — config.json has no locking in setConfigValue
// setConfigValue does read-modify-write on config.json without holding any lock.
// Fix: wrap in withPlanningLock.
// ─────────────────────────────────────────────────────────────────────────────

describe('#1927 config.json: setConfigValue must hold planning lock', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('both concurrent config-set calls persist their values', async () => {
    writeConfig(tmpDir, {
      model_profile: 'balanced',
      workflow: {
        research: true,
        plan_check: true,
      },
    });

    const nodeBin = process.execPath;
    const cmdA = `"${nodeBin}" "${TOOLS_PATH}" config-set model_profile quality --cwd "${tmpDir}"`;
    const cmdB = `"${nodeBin}" "${TOOLS_PATH}" config-set workflow.research false --cwd "${tmpDir}"`;

    await Promise.all([
      execAsync(cmdA, { encoding: 'utf-8' }).catch(() => {}),
      execAsync(cmdB, { encoding: 'utf-8' }).catch(() => {}),
    ]);

    const config = readConfig(tmpDir);
    assert.strictEqual(
      config.model_profile,
      'quality',
      'config-set model_profile must survive concurrent write'
    );
    assert.strictEqual(
      config.workflow?.research,
      false,
      'config-set workflow.research must survive concurrent write'
    );
  });

  test('config.cjs setConfigValue uses withPlanningLock (source audit)', () => {
    const configSrc = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'config.cjs'),
      'utf-8'
    );

    // setConfigValue must import/use withPlanningLock
    assert.ok(
      configSrc.includes('withPlanningLock'),
      'config.cjs must use withPlanningLock in setConfigValue to prevent concurrent write data loss'
    );
  });
});
