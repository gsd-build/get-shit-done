// Migrated to typed-IR (#2974): the gsd-session-state.sh and
// gsd-phase-boundary.sh hooks now emit Claude Code SessionStart/PostToolUse
// JSON envelopes ({ hookSpecificOutput: { hookEventName, additionalContext,
// state_present, config_mode | planning_modified, file_path } }) instead of
// plain text. gsd-validate-commit.sh already emitted JSON ({ decision,
// reason }). Tests parse the JSON and assert on typed fields.

/**
 * GSD Tools Tests - Community Hooks (opt-in)
 *
 * Tests for feat/hooks-opt-in-1473d:
 *   - Hook file existence and permissions
 *   - Installer hook registration in install.js
 *   - Hook execution with opt-in enabled and disabled
 *   - Negative security tests for hooks
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const isWindows = process.platform === 'win32';

// Ensure the running node binary is on PATH so bash hooks can call `node`
// (Claude Code shell sessions do not have `node` on PATH).
const hookEnv = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
};

// Wrapper that always injects hookEnv so bash hooks can find `node`.
function spawnHook(hookPath, options) {
  return spawnSync('bash', [hookPath], { ...options, env: hookEnv });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTempProject(prefix = 'gsd-hook-test-') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}

function writeConfigWithHooks(tmpDir, enabled) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({
      model_profile: 'balanced',
      hooks: { community: enabled }
    }, null, 2)
  );
}

function writeMinimalStateMd(tmpDir, content) {
  const defaultContent = content || '# Session State\n\n**Current Phase:** 01\n**Status:** Active\n';
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    defaultContent
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Hook file existence and permissions
// ─────────────────────────────────────────────────────────────────────────────

describe('hook file validation', () => {
  test('gsd-session-state.sh exists', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-session-state.sh');
    assert.ok(fs.existsSync(hookPath), 'gsd-session-state.sh should exist');
  });

  test('gsd-validate-commit.sh exists', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    assert.ok(fs.existsSync(hookPath), 'gsd-validate-commit.sh should exist');
  });

  test('gsd-phase-boundary.sh exists', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-phase-boundary.sh');
    assert.ok(fs.existsSync(hookPath), 'gsd-phase-boundary.sh should exist');
  });

  test('gsd-session-state.sh is executable', { skip: isWindows ? 'Windows has no POSIX file permissions' : false }, () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-session-state.sh');
    const stat = fs.statSync(hookPath);
    assert.ok((stat.mode & 0o111) !== 0, 'gsd-session-state.sh should be executable');
  });

  test('gsd-validate-commit.sh is executable', { skip: isWindows ? 'Windows has no POSIX file permissions' : false }, () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const stat = fs.statSync(hookPath);
    assert.ok((stat.mode & 0o111) !== 0, 'gsd-validate-commit.sh should be executable');
  });

  test('gsd-phase-boundary.sh is executable', { skip: isWindows ? 'Windows has no POSIX file permissions' : false }, () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-phase-boundary.sh');
    const stat = fs.statSync(hookPath);
    assert.ok((stat.mode & 0o111) !== 0, 'gsd-phase-boundary.sh should be executable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Installer hook registration
// ─────────────────────────────────────────────────────────────────────────────

describe('installer hook registration', () => {
  const installJsPath = path.join(__dirname, '..', 'bin', 'install.js');
  let installSource;

  beforeEach(() => {
    installSource = fs.readFileSync(installJsPath, 'utf-8');
  });

  test('install.js contains gsd-validate-commit registration block', () => {
    assert.ok(
      installSource.includes('gsd-validate-commit'),
      'install.js should contain gsd-validate-commit hook registration'
    );
    assert.ok(
      installSource.includes('validateCommitCommand'),
      'install.js should define validateCommitCommand variable'
    );
    assert.ok(
      installSource.includes('hasValidateCommitHook'),
      'install.js should check for existing validate-commit hook'
    );
  });

  test('install.js contains gsd-session-state registration block', () => {
    assert.ok(
      installSource.includes('gsd-session-state'),
      'install.js should contain gsd-session-state hook registration'
    );
    assert.ok(
      installSource.includes('sessionStateCommand'),
      'install.js should define sessionStateCommand variable'
    );
    assert.ok(
      installSource.includes('hasSessionStateHook'),
      'install.js should check for existing session-state hook'
    );
  });

  test('install.js contains gsd-phase-boundary registration block', () => {
    assert.ok(
      installSource.includes('gsd-phase-boundary'),
      'install.js should contain gsd-phase-boundary hook registration'
    );
    assert.ok(
      installSource.includes('phaseBoundaryCommand'),
      'install.js should define phaseBoundaryCommand variable'
    );
    assert.ok(
      installSource.includes('hasPhaseBoundaryHook'),
      'install.js should check for existing phase-boundary hook'
    );
  });

  test('install.js registers validate-commit with PreToolUse event and Bash matcher', () => {
    assert.ok(
      installSource.includes("settings.hooks[preToolEvent].push"),
      'validate-commit should be pushed to preToolEvent hooks array'
    );
    const validateCommitBlock = installSource.substring(
      installSource.indexOf('// Configure commit validation hook'),
      installSource.indexOf('// Configure session state orientation hook')
    );
    assert.ok(
      validateCommitBlock.includes("matcher: 'Bash'"),
      'validate-commit hook should use Bash matcher'
    );
    assert.ok(
      validateCommitBlock.includes('preToolEvent'),
      'validate-commit hook should register on preToolEvent (PreToolUse)'
    );
  });

  test('install.js adds all 3 new hooks to the uninstall cleanup list', () => {
    const gsdHooksMatch = installSource.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(gsdHooksMatch, 'install.js should define gsdHooks array for uninstall cleanup');

    const gsdHooksContent = gsdHooksMatch[1];
    assert.ok(
      gsdHooksContent.includes('gsd-session-state.sh'),
      'gsdHooks should include gsd-session-state.sh'
    );
    assert.ok(
      gsdHooksContent.includes('gsd-validate-commit.sh'),
      'gsdHooks should include gsd-validate-commit.sh'
    );
    assert.ok(
      gsdHooksContent.includes('gsd-phase-boundary.sh'),
      'gsdHooks should include gsd-phase-boundary.sh'
    );
  });

  test('install.js log messages indicate opt-in behavior', () => {
    assert.ok(
      installSource.includes('opt-in via config'),
      'install.js should mention opt-in in log messages'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Opt-in gating behavior
// ─────────────────────────────────────────────────────────────────────────────

describe('opt-in gating behavior', { skip: isWindows ? 'bash hooks require unix shell' : false }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validate-commit is a no-op when hooks.community is false', () => {
    writeConfigWithHooks(tmpDir, false);
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "WIP save"' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    // Should exit 0 (no-op) even with a bad commit message
    assert.strictEqual(result.status, 0, `Should be no-op when disabled, got ${result.status}`);
  });

  test('validate-commit is a no-op when config.json is absent', (t) => {
    // No config.json at all
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-hook-bare-'));
    t.after(() => { fs.rmSync(bareDir, { recursive: true, force: true }); });
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "WIP save"' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: bareDir,
    });

    assert.strictEqual(result.status, 0, `Should be no-op without config.json, got ${result.status}`);
  });

  test('session-state is a no-op when hooks.community is false', () => {
    writeConfigWithHooks(tmpDir, false);
    writeMinimalStateMd(tmpDir);
    const hookPath = path.join(HOOKS_DIR, 'gsd-session-state.sh');

    const result = spawnHook(hookPath, {
      input: '',
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 0, `Should exit 0: ${result.stderr}`);
    // Migrated #2974: typed assertion that stdout is empty (no JSON envelope
    // emitted when the hook is a no-op). The previous shape grepped for
    // "Project State Reminder" prose; now the contract is "no output".
    assert.equal(result.stdout.trim(), '',
      `Should produce no output when disabled: ${JSON.stringify(result.stdout)}`);
  });

  test('phase-boundary is a no-op when hooks.community is false', () => {
    writeConfigWithHooks(tmpDir, false);
    const hookPath = path.join(HOOKS_DIR, 'gsd-phase-boundary.sh');
    const input = JSON.stringify({
      tool_input: { file_path: '.planning/STATE.md' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 0, `Should exit 0: ${result.stderr}`);
    // Migrated #2974: typed empty-stdout assertion (#2974).
    assert.equal(result.stdout.trim(), '',
      `Should produce no output when disabled: ${JSON.stringify(result.stdout)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Hook execution when enabled
// ─────────────────────────────────────────────────────────────────────────────

describe('hook execution when enabled', { skip: isWindows ? 'bash hooks require unix shell' : false }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeConfigWithHooks(tmpDir, true);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validate-commit allows valid conventional commit', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "fix(core): add locking mechanism"' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 0, `Valid commit should exit 0, got ${result.status}. stderr: ${result.stderr}`);
  });

  test('validate-commit blocks non-conventional commit', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "WIP save"' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 2, `Non-conventional commit should exit 2, got ${result.status}`);
    // Migrated #2974: parse the hook's JSON envelope and assert on typed
    // fields (decision, reason). Hook protocol returns
    // { decision: 'block', reason: '...' } for blocked commits.
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.decision, 'block',
      `expected typed decision: 'block', got: ${JSON.stringify(parsed)}`);
    // Assert on the typed `code` field (stable enum value), not the
    // human-readable `reason` string. CR feedback (#3016): substring
    // matching on `reason` is still text matching — the hook now emits
    // a typed code alongside the prose so tests pin behavior, not copy.
    assert.strictEqual(parsed.code, 'CONVENTIONAL_COMMITS_VIOLATION',
      `expected typed code: 'CONVENTIONAL_COMMITS_VIOLATION', got: ${JSON.stringify(parsed)}`);
  });

  test('validate-commit allows non-commit commands', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git push origin main' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 0, `Non-commit command should exit 0, got ${result.status}`);
  });

  test('session-state outputs state info when enabled', () => {
    writeMinimalStateMd(tmpDir);
    const hookPath = path.join(HOOKS_DIR, 'gsd-session-state.sh');

    const result = spawnHook(hookPath, {
      input: '',
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 0, `Should exit 0: ${result.stderr}`);
    // Migrated #2974: parse the SessionStart JSON envelope and assert on
    // typed fields. The hook now emits
    // { hookSpecificOutput: { hookEventName, additionalContext, state_present, config_mode } }.
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.strictEqual(parsed.hookSpecificOutput.state_present, true,
      'state_present must reflect that STATE.md was written by writeMinimalStateMd');
  });

  test('session-state exits 0 without .planning/ (in enabled project)', (t) => {
    // Create a dir with config but no STATE.md
    const noStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-hook-nostate-'));
    t.after(() => { fs.rmSync(noStateDir, { recursive: true, force: true }); });
    fs.mkdirSync(path.join(noStateDir, '.planning'), { recursive: true });
    writeConfigWithHooks(noStateDir, true);
    const hookPath = path.join(HOOKS_DIR, 'gsd-session-state.sh');

    const result = spawnHook(hookPath, {
      input: '',
      encoding: 'utf-8',
      cwd: noStateDir,
    });

    assert.strictEqual(result.status, 0, `Should exit 0: ${result.stderr}`);
    // Migrated #2974: typed assertion on state_present field instead of
    // grepping additionalContext text for "No .planning/ found".
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.hookSpecificOutput.state_present, false,
      'state_present must be false when STATE.md is absent');
  });

  test('phase-boundary detects .planning/ writes when enabled', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-phase-boundary.sh');
    const input = JSON.stringify({
      tool_input: { file_path: '.planning/STATE.md' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 0, `Should exit 0: ${result.stderr}`);
    // Migrated #2974: parse the PostToolUse JSON envelope. The hook emits
    // { hookSpecificOutput: { hookEventName, additionalContext,
    //   planning_modified, file_path } } when a .planning/ write is detected.
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.strictEqual(parsed.hookSpecificOutput.planning_modified, true);
    assert.strictEqual(parsed.hookSpecificOutput.file_path, '.planning/STATE.md');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Negative security tests for hooks
// ─────────────────────────────────────────────────────────────────────────────

describe('hook security tests', { skip: isWindows ? 'bash hooks require unix shell' : false }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeConfigWithHooks(tmpDir, true);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validate-commit blocks message with shell metacharacters', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "$(rm -rf /)"' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 2, `Shell metacharacter message should be blocked: ${result.status}`);
    // Migrated #2974: typed JSON envelope assertion (parsed.decision === 'block').
    assert.strictEqual(JSON.parse(result.stdout).decision, 'block');
  });

  test('validate-commit blocks message with backtick injection', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "`whoami`"' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 2, `Backtick injection should be blocked: ${result.status}`);
    // Migrated #2974: typed JSON envelope assertion (parsed.decision === 'block').
    assert.strictEqual(JSON.parse(result.stdout).decision, 'block');
  });

  test('validate-commit allows commit with scope containing special chars', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "fix(api/v2): handle edge case"' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 0, `Valid commit with / in scope should be allowed: ${result.status}`);
  });

  test('phase-boundary handles malformed JSON input gracefully', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-phase-boundary.sh');
    const input = 'not json at all';

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(result.status, 0, `Should not crash on malformed JSON: ${result.stderr}`);
  });

  test('hooks handle config.json with broken JSON gracefully', () => {
    // Write malformed JSON config
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      '{ broken json'
    );

    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "WIP save"' }
    });

    const result = spawnHook(hookPath, {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    // Should exit 0 (treat malformed config as disabled)
    assert.strictEqual(result.status, 0, `Malformed config should be treated as disabled: ${result.status}`);
  });
});
