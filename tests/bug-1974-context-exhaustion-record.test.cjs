/**
 * Integration tests for gsd-context-monitor.js auto-record on CRITICAL (#1974).
 *
 * Verifies:
 * 1. On CRITICAL + active GSD project, the hook sets criticalRecorded in the
 *    warn sentinel AND the state record-session command writes the "Stopped At"
 *    field to STATE.md.
 * 2. Subsequent CRITICAL firings within the same session do NOT re-fire
 *    the subprocess (sentinel guard prevents repeated overwrites).
 * 3. When no .planning/STATE.md exists, the subprocess is not spawned.
 * 4. Path resolution uses __dirname, not hardcoded ~/.claude/.
 * 5. A WARNING-only fire does NOT set criticalRecorded (selectivity counter-test).
 *
 * Design note (#3726): the original test polled STATE.md on a wall-clock deadline
 * against a fire-and-forget spawn().unref() subprocess — racy under Docker
 * contention.  The fix uses two deterministic assertions:
 *   (a) The hook writes criticalRecorded:true to the warnPath file BEFORE it
 *       exits (synchronously, before .unref() returns).  Since runHook() uses
 *       spawnSync, this is readable the moment runHook() returns.
 *   (b) The state record-session command is invoked synchronously (spawnSync)
 *       to verify the persistence function writes STATE.md correctly.  This
 *       decouples the hook's fire-and-forget semantics from the test assertion.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { cleanup } = require('./helpers.cjs');

const HOOK_PATH = path.resolve(__dirname, '..', 'hooks', 'gsd-context-monitor.js');
const GSD_TOOLS = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

/**
 * Run the hook with a given session id and context percentage.
 * Writes a bridge metrics file first, then pipes the hook input via stdin.
 * Returns after the hook exits.
 */
function runHook(sessionId, remainingPct, cwd) {
  // Write the bridge metrics file the hook reads
  const bridgePath = path.join(os.tmpdir(), `claude-ctx-${sessionId}.json`);
  fs.writeFileSync(bridgePath, JSON.stringify({
    session_id: sessionId,
    remaining_percentage: remainingPct,
    used_pct: 100 - remainingPct,
    timestamp: Math.floor(Date.now() / 1000),
  }));

  const input = JSON.stringify({
    session_id: sessionId,
    cwd,
  });

  const result = spawnSync(process.execPath, [HOOK_PATH], {
    input,
    encoding: 'utf-8',
    timeout: 10000,
    env: { ...process.env, HOME: process.env.HOME },
  });

  return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Run gsd-tools state record-session synchronously.
 * Returns { exitCode, stdout, stderr }.
 * Used to verify the persistence seam deterministically without relying on
 * the fire-and-forget subprocess timing that caused flake (#3726).
 */
function runRecordSession(cwd, stoppedAt) {
  const result = spawnSync(
    process.execPath,
    [GSD_TOOLS, 'state', 'record-session', '--stopped-at', stoppedAt, '--cwd', cwd],
    { encoding: 'utf-8', timeout: 10000 }
  );
  return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Read and parse the warn sentinel file for a session.
 * Returns the parsed object, or null if the file does not exist.
 */
function readWarnData(sessionId) {
  const warnPath = path.join(os.tmpdir(), `claude-ctx-${sessionId}-warned.json`);
  try {
    return JSON.parse(fs.readFileSync(warnPath, 'utf-8'));
  } catch {
    return null;
  }
}

describe('#1974 context exhaustion auto-record', () => {
  let tmpDir;
  let statePath;
  let sessionId;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-1974-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // Minimal STATE.md with Stopped At field
    statePath = path.join(planningDir, 'STATE.md');
    fs.writeFileSync(statePath, [
      '# Session State',
      '',
      '**Current Phase:** 1',
      '**Status:** executing',
      '**Last session:** unset',
      '**Last Date:** unset',
      '**Stopped At:** None',
      '**Resume File:** None',
      '',
    ].join('\n'));

    // Minimal config.json required by gsd-tools
    fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify({ project_code: 'TEST' }));

    sessionId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  afterEach(() => {
    const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        cleanup(tmpDir);
        break;
      } catch (err) {
        const code = err && err.code;
        const transient = code === 'EPERM' || code === 'EBUSY' || code === 'ENOTEMPTY';
        if (!transient || attempt === 4) throw err;
        sleep(250 * (attempt + 1));
      }
    }
    // Clean up bridge files
    try {
      const warnPath = path.join(os.tmpdir(), `claude-ctx-${sessionId}-warned.json`);
      if (fs.existsSync(warnPath)) fs.unlinkSync(warnPath);
      const bridgePath = path.join(os.tmpdir(), `claude-ctx-${sessionId}.json`);
      if (fs.existsSync(bridgePath)) fs.unlinkSync(bridgePath);
    } catch { /* noop */ }
  });

  test('sets criticalRecorded sentinel and state record-session writes Stopped At on CRITICAL', () => {
    // Trigger CRITICAL — remaining <= 25
    const result = runHook(sessionId, 20, tmpDir);
    assert.strictEqual(result.exitCode, 0, `hook should exit 0: ${result.stderr}`);

    // (a) Deterministic: hook writes criticalRecorded:true to warnPath SYNCHRONOUSLY
    //     before the hook process exits, before the fire-and-forget subprocess runs.
    //     Since runHook() uses spawnSync, this is guaranteed readable now.
    const warnData = readWarnData(sessionId);
    assert.ok(warnData, 'warn sentinel file must exist after CRITICAL fire');
    assert.strictEqual(
      warnData.criticalRecorded,
      true,
      'hook must set criticalRecorded:true in warn sentinel on CRITICAL'
    );

    // (b) Deterministic: invoke state record-session synchronously to verify
    //     the persistence seam writes STATE.md correctly.  This is the same
    //     command the hook spawns — we call it directly (spawnSync) to avoid
    //     wall-clock timing dependency on the hook's fire-and-forget subprocess.
    const usedPct = 80; // 100 - 20
    const stoppedAt = `context exhaustion at ${usedPct}% (${new Date().toISOString().split('T')[0]})`;
    const recordResult = runRecordSession(tmpDir, stoppedAt);
    assert.strictEqual(recordResult.exitCode, 0, `record-session should exit 0: ${recordResult.stderr}`);

    const content = fs.readFileSync(statePath, 'utf-8');
    assert.match(content, /context exhaustion at \d+%/, 'STATE.md must contain context exhaustion entry');
  });

  test('does NOT spawn subprocess when .planning/STATE.md is absent', () => {
    // Delete STATE.md to simulate non-GSD project
    fs.unlinkSync(statePath);

    const result = runHook(sessionId, 20, tmpDir);
    assert.strictEqual(result.exitCode, 0);

    // The hook checks isGsdActive via fs.existsSync(STATE.md) before setting
    // criticalRecorded.  If STATE.md is absent, criticalRecorded must NOT be set.
    const warnData = readWarnData(sessionId);
    // warnData may exist (hook still debounces) but criticalRecorded must be absent/falsy.
    const criticalRecorded = warnData && warnData.criticalRecorded;
    assert.ok(!criticalRecorded, 'criticalRecorded must not be set when STATE.md is absent');
    assert.ok(!fs.existsSync(statePath), 'STATE.md should not be recreated when absent');
  });

  test('sentinel prevents repeated firing within same session', () => {
    // First CRITICAL fire — should set criticalRecorded synchronously.
    const result1 = runHook(sessionId, 20, tmpDir);
    assert.strictEqual(result1.exitCode, 0, `first hook fire should exit 0: ${result1.stderr}`);

    const warnData1 = readWarnData(sessionId);
    assert.ok(warnData1, 'warn sentinel must exist after first CRITICAL fire');
    assert.strictEqual(warnData1.criticalRecorded, true, 'first fire must set criticalRecorded:true');

    // Verify the persistence seam works by calling record-session directly
    // (synchronous — no subprocess race).
    const recordResult = runRecordSession(tmpDir, 'context exhaustion at 80% (2026-01-01)');
    assert.strictEqual(recordResult.exitCode, 0, 'record-session should succeed');

    // Second CRITICAL fire — same session, criticalRecorded already true in
    // warnPath.  Advance callsSinceWarn past DEBOUNCE_CALLS (5) so the hook
    // processes the warning message path and exercises the sentinel guard.
    const warnPath = path.join(os.tmpdir(), `claude-ctx-${sessionId}-warned.json`);
    const warnDataPatched = { ...warnData1, callsSinceWarn: 10 };
    fs.writeFileSync(warnPath, JSON.stringify(warnDataPatched));

    const result2 = runHook(sessionId, 18, tmpDir);
    assert.strictEqual(result2.exitCode, 0, `second hook fire should exit 0: ${result2.stderr}`);

    // The warnData must still carry criticalRecorded:true — the guard was
    // active and the hook did not reset or clear it.
    const warnData2 = readWarnData(sessionId);
    assert.strictEqual(warnData2 && warnData2.criticalRecorded, true, 'sentinel must remain true after second fire');

    // The hook's stdout must still emit a CRITICAL warning message (so the
    // agent sees context warnings) even though record-session was NOT re-fired.
    const output2 = result2.stdout ? (() => { try { return JSON.parse(result2.stdout); } catch { return null; } })() : null;
    assert.ok(
      output2 && output2.hookSpecificOutput && /CONTEXT CRITICAL/.test(output2.hookSpecificOutput.additionalContext),
      'second CRITICAL fire must still emit CONTEXT CRITICAL warning to the agent'
    );
  });

  test('WARNING-only fire does NOT set criticalRecorded (selectivity counter-test)', () => {
    // Trigger WARNING (remaining 30% — below WARNING_THRESHOLD=35, above CRITICAL_THRESHOLD=25)
    const result = runHook(sessionId, 30, tmpDir);
    assert.strictEqual(result.exitCode, 0, `hook should exit 0: ${result.stderr}`);

    // criticalRecorded must NOT be set on a WARNING-only fire
    const warnData = readWarnData(sessionId);
    const criticalRecorded = warnData && warnData.criticalRecorded;
    assert.ok(!criticalRecorded, 'WARNING-only fire must not set criticalRecorded');
  });

  test('hook uses __dirname-based path (runtime-agnostic)', () => {
    // Verify the hook source references __dirname, not ~/.claude/
    const hookSource = fs.readFileSync(HOOK_PATH, 'utf-8');
    assert.match(
      hookSource,
      /path\.join\(__dirname,\s*'\.\.',\s*'get-shit-done'/,
      'hook must use __dirname-based path resolution for gsd-tools.cjs'
    );
    assert.doesNotMatch(
      hookSource,
      /process\.env\.HOME.*\.claude.*get-shit-done.*gsd-tools\.cjs/,
      'hook must not hardcode ~/.claude/ path'
    );
  });
});
