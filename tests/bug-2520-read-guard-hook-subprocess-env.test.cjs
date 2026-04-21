/**
 * Regression test for bug #2520
 *
 * The fix for #2344 added `|| process.env.CLAUDECODE` to the Claude Code
 * skip check. That works in principle — CLAUDECODE=1 is propagated to Bash
 * tool subprocesses — but it does NOT reach hook subprocesses on Claude Code
 * v2.1.116. Claude Code applies a separate env filter when spawning
 * PreToolUse hook commands; that filter drops bare CLAUDECODE and
 * CLAUDE_SESSION_ID and keeps only CLAUDE_CODE_*-prefixed vars plus
 * CLAUDE_PROJECT_DIR. `data.session_id` is, however, reliably delivered via
 * the hook's stdin JSON payload (documented part of Claude Code's hook
 * input schema).
 *
 * Fix: use `data.session_id` as the primary Claude Code signal, with
 * CLAUDE_CODE_ENTRYPOINT / CLAUDE_CODE_SSE_PORT as env-var fallbacks, and
 * keep legacy CLAUDECODE / CLAUDE_SESSION_ID for back-compat and
 * future-proofing.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { createTempDir, cleanup } = require('./helpers.cjs');

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'gsd-read-guard.js');

/**
 * Spawn the hook with an env that mirrors the actual Claude Code hook
 * subprocess env: CLAUDECODE and CLAUDE_SESSION_ID are stripped, only
 * CLAUDE_CODE_*-prefixed vars (plus CLAUDE_PROJECT_DIR) remain. Extra env
 * overrides can be supplied via `envOverrides`.
 */
function runHookInClaudeCodeSubprocess(payload, envOverrides = {}) {
  const input = JSON.stringify(payload);
  const baseEnv = { ...process.env };
  // Strip env vars Claude Code does NOT propagate to hook subprocesses.
  delete baseEnv.CLAUDECODE;
  delete baseEnv.CLAUDE_SESSION_ID;
  const env = {
    ...baseEnv,
    // Env vars Claude Code DOES propagate to hook subprocesses (observed on
    // Claude Code CLI 2.1.116).
    CLAUDE_CODE_ENTRYPOINT: 'cli',
    CLAUDE_CODE_SSE_PORT: '51291',
    CLAUDE_PROJECT_DIR: process.cwd(),
    ...envOverrides,
  };
  try {
    const stdout = execFileSync(process.execPath, [HOOK_PATH], {
      input,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout || '').toString().trim(),
      stderr: (err.stderr || '').toString().trim(),
    };
  }
}

describe('bug #2520: read guard detects Claude Code without relying on CLAUDECODE env', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempDir('gsd-read-guard-2520-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('skips advisory when stdin payload includes session_id (Claude Code hook-subprocess env)', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');

    // Isolate the stdin `session_id` signal by clearing the CLAUDE_CODE_*
    // env fallbacks the helper normally provides. Without this the env
    // fallback would rescue the skip even if session_id detection broke,
    // hiding a regression of the primary signal.
    const result = runHookInClaudeCodeSubprocess(
      {
        session_id: 'e7123e54-0977-45dd-848a-b9c8a45a5cd3',
        tool_name: 'Edit',
        tool_input: { file_path: filePath, old_string: 'const x = 1;', new_string: 'const x = 2;' },
      },
      { CLAUDE_CODE_ENTRYPOINT: '', CLAUDE_CODE_SSE_PORT: '', CLAUDE_PROJECT_DIR: '' },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(
      result.stdout,
      '',
      'advisory must not fire when session_id is present on stdin (real Claude Code hook env)',
    );
  });

  test('skips advisory when CLAUDE_CODE_ENTRYPOINT is set (env-var fallback, no session_id on stdin)', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');

    const result = runHookInClaudeCodeSubprocess(
      { tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'const x = 1;', new_string: 'const x = 2;' } },
      { CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_CODE_SSE_PORT: '' },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'advisory must not fire when CLAUDE_CODE_ENTRYPOINT is set');
  });

  test('still injects advisory when no Claude Code signal is present (non-Claude host)', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');

    const result = runHookInClaudeCodeSubprocess(
      { tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'const x = 1;', new_string: 'const x = 2;' } },
      { CLAUDE_CODE_ENTRYPOINT: '', CLAUDE_CODE_SSE_PORT: '', CLAUDE_PROJECT_DIR: '' },
    );

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'advisory should fire on non-Claude-Code hosts');
    const output = JSON.parse(result.stdout);
    assert.ok(output.hookSpecificOutput?.additionalContext?.includes('Read'));
  });
});
