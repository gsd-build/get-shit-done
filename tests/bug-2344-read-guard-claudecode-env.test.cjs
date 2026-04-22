/**
 * Regression test for bug #2344
 *
 * gsd-read-guard.js checked process.env.CLAUDE_SESSION_ID to detect the
 * Claude Code runtime and skip its advisory. However, Claude Code CLI exports
 * CLAUDECODE=1, not CLAUDE_SESSION_ID. The skip never fired, so the
 * READ-BEFORE-EDIT advisory injected on every Edit/Write call inside Claude
 * Code — producing noise in long-running sessions.
 *
 * Fix: check CLAUDECODE (and CLAUDE_SESSION_ID for back-compat) before
 * emitting the advisory.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { createTempDir, cleanup } = require('./helpers.cjs');

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'gsd-read-guard.js');

function runHook(payload, envOverrides = {}) {
  const input = JSON.stringify(payload);
  const env = {
    ...process.env,
    CLAUDE_SESSION_ID: '',
    CLAUDECODE: '',
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

describe('bug #2344: read guard skips on CLAUDECODE env var', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempDir('gsd-read-guard-2344-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('skips advisory when CLAUDECODE=1 is set (Claude Code CLI env)', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');

    const result = runHook(
      { tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'const x = 1;', new_string: 'const x = 2;' } },
      { CLAUDECODE: '1' }
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'advisory must not fire when CLAUDECODE=1');
  });

  test('skips advisory when CLAUDE_SESSION_ID is set (back-compat)', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');

    const result = runHook(
      { tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'const x = 1;', new_string: 'const x = 2;' } },
      { CLAUDE_SESSION_ID: 'test-session-123' }
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'advisory must not fire when CLAUDE_SESSION_ID is set');
  });

  test('still injects advisory when neither CLAUDECODE nor CLAUDE_SESSION_ID is set', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');

    const result = runHook(
      { tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'const x = 1;', new_string: 'const x = 2;' } },
      { CLAUDECODE: '', CLAUDE_SESSION_ID: '' }
    );

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'advisory should fire on non-Claude-Code runtimes');
    const output = JSON.parse(result.stdout);
    assert.ok(output.hookSpecificOutput?.additionalContext?.includes('Read'));
  });
});
