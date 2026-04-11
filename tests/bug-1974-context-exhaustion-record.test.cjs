/**
 * Integration tests for gsd-context-monitor.js auto-record on CRITICAL (#1974).
 *
 * Verifies:
 * 1. On CRITICAL + active GSD project, subprocess is spawned and STATE.md
 *    receives the "Stopped At" field.
 * 2. Subsequent CRITICAL firings within the same session do NOT re-fire
 *    the subprocess (sentinel guard prevents repeated overwrites).
 * 3. When no .planning/STATE.md exists, the subprocess is not spawned.
 * 4. Path resolution uses __dirname, not hardcoded ~/.claude/.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const HOOK_PATH = path.resolve(__dirname, '..', 'hooks', 'gsd-context-monitor.js');

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
 * Wait up to `ms` for a file to exist (the subprocess is fire-and-forget).
 */
function waitForStoppedAt(statePath, ms = 2000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const content = fs.readFileSync(statePath, 'utf-8');
      if (/Stopped [Aa]t.*context exhaustion/.test(content)) return content;
    } catch { /* file may briefly not exist during atomic write */ }
    // Tight poll loop — subprocess should complete in <100ms
    const start = Date.now();
    while (Date.now() - start < 50) { /* spin */ }
  }
  return null;
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
    fs.rmSync(tmpDir, { recursive: true, force: true });
    // Clean up bridge files
    try {
      const warnPath = path.join(os.tmpdir(), `claude-ctx-${sessionId}-warned.json`);
      if (fs.existsSync(warnPath)) fs.unlinkSync(warnPath);
      const bridgePath = path.join(os.tmpdir(), `claude-ctx-${sessionId}.json`);
      if (fs.existsSync(bridgePath)) fs.unlinkSync(bridgePath);
    } catch { /* noop */ }
  });

  test('spawns subprocess and writes Stopped At field on CRITICAL with active GSD', () => {
    // Trigger CRITICAL — remaining <= 25
    const result = runHook(sessionId, 20, tmpDir);
    assert.strictEqual(result.exitCode, 0, `hook should exit 0: ${result.stderr}`);

    // Wait for fire-and-forget subprocess to write STATE.md
    const content = waitForStoppedAt(statePath);
    assert.ok(content, `STATE.md should contain "context exhaustion" after CRITICAL fire`);
    assert.match(content, /context exhaustion at \d+%/);
  });

  test('does NOT spawn subprocess when .planning/STATE.md is absent', () => {
    // Delete STATE.md to simulate non-GSD project
    fs.unlinkSync(statePath);
    const originalMtime = Date.now();

    const result = runHook(sessionId, 20, tmpDir);
    assert.strictEqual(result.exitCode, 0);

    // Wait a bit then verify STATE.md was NOT recreated
    const start = Date.now();
    while (Date.now() - start < 500) { /* spin */ }
    assert.ok(!fs.existsSync(statePath), 'STATE.md should not be recreated when absent');
  });

  test('sentinel prevents repeated firing within same session', () => {
    // First CRITICAL fire — should record
    runHook(sessionId, 20, tmpDir);
    const content1 = waitForStoppedAt(statePath);
    assert.ok(content1, 'first fire should record Stopped At');

    // Extract the timestamp from first fire
    const firstMatch = content1.match(/context exhaustion at (\d+)%/);
    assert.ok(firstMatch, 'first fire should have numeric usedPct');

    // Manually set Stopped At to a sentinel value to detect second fire
    const modified = content1.replace(/(\*\*Stopped At:\*\*) .+/, '$1 SENTINEL_SHOULD_NOT_CHANGE');
    fs.writeFileSync(statePath, modified);

    // Second CRITICAL fire — should NOT re-fire the subprocess
    runHook(sessionId, 18, tmpDir);

    // Wait and verify the sentinel is preserved
    const start = Date.now();
    while (Date.now() - start < 500) { /* spin */ }
    const content2 = fs.readFileSync(statePath, 'utf-8');
    assert.match(
      content2,
      /SENTINEL_SHOULD_NOT_CHANGE/,
      'second CRITICAL fire should not re-record (sentinel guard)'
    );
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
