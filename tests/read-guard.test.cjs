/**
 * Tests for gsd-read-guard.js PreToolUse hook.
 *
 * The read guard intercepts Write/Edit tool calls on existing files and injects
 * advisory guidance telling the model to Read the file first. This prevents
 * infinite retry loops when non-Claude models (e.g. MiniMax M2.5 on OpenCode)
 * attempt to edit files without reading them, hitting the runtime's
 * "You must read file before overwriting it" error repeatedly.
 *
 * The hook is advisory-only (does not block) so Claude Code behavior is unaffected.
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
 * Run the read guard hook with a given tool input payload.
 * Returns { exitCode, stdout, stderr }.
 */
function runHook(payload, envOverrides = {}) {
  const input = JSON.stringify(payload);
  // Sanitize all Claude Code detection signals so positive-path tests work
  // when the test runner itself is running inside Claude Code (#2344, #2520).
  const env = {
    ...process.env,
    CLAUDE_SESSION_ID: '',
    CLAUDECODE: '',
    CLAUDE_CODE_ENTRYPOINT: '',
    CLAUDE_CODE_SSE_PORT: '',
    CLAUDE_PROJECT_DIR: '',
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

describe('gsd-read-guard hook', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-read-guard-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ─── Core: advisory on Write to existing file ───────────────────────────

  test('injects read-first guidance when Write targets an existing file', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'console.log("hello");\n');

    const result = runHook({
      tool_name: 'Write',
      tool_input: { file_path: filePath, content: 'console.log("world");\n' },
    });

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'should produce output');

    const output = JSON.parse(result.stdout);
    assert.ok(output.hookSpecificOutput, 'should have hookSpecificOutput');
    assert.ok(output.hookSpecificOutput.additionalContext, 'should have additionalContext');
    assert.ok(
      output.hookSpecificOutput.additionalContext.includes('Read'),
      'guidance should mention Read tool'
    );
  });

  test('injects read-first guidance when Edit targets an existing file', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');

    const result = runHook({
      tool_name: 'Edit',
      tool_input: { file_path: filePath, old_string: 'const x = 1;', new_string: 'const x = 2;' },
    });

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'should produce output');

    const output = JSON.parse(result.stdout);
    assert.ok(output.hookSpecificOutput.additionalContext.includes('Read'));
  });

  // ─── No-op cases: should NOT inject guidance ────────────────────────────

  test('does nothing for Write to a new file (file does not exist)', () => {
    const filePath = path.join(tmpDir, 'brand-new.js');
    // File does NOT exist

    const result = runHook({
      tool_name: 'Write',
      tool_input: { file_path: filePath, content: 'new content' },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'should produce no output for new files');
  });

  test('does nothing for non-Write/Edit tools', () => {
    const result = runHook({
      tool_name: 'Bash',
      tool_input: { command: 'echo hello' },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '');
  });

  test('does nothing for Read tool', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'content');

    const result = runHook({
      tool_name: 'Read',
      tool_input: { file_path: filePath },
    });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '');
  });

  // ─── Error resilience ──────────────────────────────────────────────────

  test('exits cleanly on invalid JSON input', () => {
    try {
      const stdout = execFileSync(process.execPath, [HOOK_PATH], {
        input: 'not json',
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // Should exit 0 silently
      assert.equal(stdout.trim(), '');
    } catch (err) {
      assert.equal(err.status, 0, 'should exit 0 on parse error');
    }
  });

  test('exits cleanly when tool_input is missing', () => {
    const result = runHook({ tool_name: 'Write' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '');
  });

  // ─── Guidance content quality ──────────────────────────────────────────

  test('guidance message includes the filename', () => {
    const filePath = path.join(tmpDir, 'myfile.ts');
    fs.writeFileSync(filePath, 'export const foo = 1;\n');

    const result = runHook({
      tool_name: 'Write',
      tool_input: { file_path: filePath, content: 'export const foo = 2;\n' },
    });

    const output = JSON.parse(result.stdout);
    assert.ok(
      output.hookSpecificOutput.additionalContext.includes('myfile.ts'),
      'guidance should include the filename being edited'
    );
  });

  test('guidance message instructs to use Read tool before editing', () => {
    const filePath = path.join(tmpDir, 'target.py');
    fs.writeFileSync(filePath, 'x = 1\n');

    const result = runHook({
      tool_name: 'Edit',
      tool_input: { file_path: filePath, old_string: 'x = 1', new_string: 'x = 2' },
    });

    const output = JSON.parse(result.stdout);
    const ctx = output.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('Read'), 'must mention Read tool');
    assert.ok(
      ctx.includes('before') || ctx.includes('first'),
      'must indicate Read should come before the edit'
    );
  });

  // ─── Build / install integration ───────────────────────────────────────

  test('hook is registered in build-hooks.js HOOKS_TO_COPY', () => {
    const buildHooksPath = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
    const content = fs.readFileSync(buildHooksPath, 'utf8');
    assert.ok(
      content.includes('gsd-read-guard.js'),
      'gsd-read-guard.js must be in HOOKS_TO_COPY so it ships in hooks/dist/'
    );
  });

  test('hook is registered in install.js uninstall hook list', () => {
    const installPath = path.join(__dirname, '..', 'bin', 'install.js');
    const content = fs.readFileSync(installPath, 'utf8');
    assert.ok(
      content.includes("'gsd-read-guard.js'"),
      'gsd-read-guard.js must be in the uninstall gsdHooks list'
    );
  });

  test('exits cleanly when tool_input.file_path is non-string', () => {
    const result = runHook({
      tool_name: 'Write',
      tool_input: { file_path: 12345, content: 'data' },
    });
    // file_path is a number — || '' yields '' — hook exits silently
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '');
  });

  // ─── Claude Code runtime skip (#1984) ─────────────────────────────────

  test('skips advisory on Claude Code runtime (CLAUDE_SESSION_ID set)', () => {
    const filePath = path.join(tmpDir, 'existing.js');
    fs.writeFileSync(filePath, 'const x = 1;\n');

    const result = runHook(
      { tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'const x = 1;', new_string: 'const x = 2;' } },
      { CLAUDE_SESSION_ID: 'test-session-123' }
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'should produce no output on Claude Code');
  });
});
