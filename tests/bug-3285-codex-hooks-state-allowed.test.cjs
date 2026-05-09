/**
 * Regression: issue #3285 — Codex install fails when config.toml contains
 * hooks.state entries.
 *
 * Root cause: validateCodexConfigSchema walks every `hooks.*` table section
 * and asserts array-of-tables (AoT) shape, without distinguishing the
 * `hooks.state.*` namespace (Codex-managed per-hook trust persistence, a
 * regular table) from `hooks.<EVENT>` (event handlers like SessionStart,
 * which DO require AoT shape via [[hooks.SessionStart]]).
 *
 * Fix: add a carve-out so that any table whose path starts with `hooks.state`
 * is validated as a regular table (not AoT). All `hooks.<EVENT>` paths still
 * require AoT.
 */

// GSD_TEST_MODE must be set before require('../bin/install.js') so the module
// skips the main CLI entry point and exports its internals.
const previousGsdTestMode = process.env.GSD_TEST_MODE;
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const { validateCodexConfigSchema, install } = require('../bin/install.js');
const installModule = require('../bin/install.js');

if (previousGsdTestMode === undefined) {
  delete process.env.GSD_TEST_MODE;
} else {
  process.env.GSD_TEST_MODE = previousGsdTestMode;
}

// Ensure hooks/dist/ is populated — mirrors the pattern used by codex-config.test.cjs.
const { before, beforeEach, afterEach } = require('node:test');
const HOOKS_DIST = path.join(__dirname, '..', 'hooks', 'dist');
const BUILD_HOOKS_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
before(() => {
  if (!fs.existsSync(HOOKS_DIST) || fs.readdirSync(HOOKS_DIST).length === 0) {
    execFileSync(process.execPath, [BUILD_HOOKS_SCRIPT], { encoding: 'utf-8', stdio: 'pipe' });
  }
});

// ---------------------------------------------------------------------------
// Validator unit tests (no install, just validateCodexConfigSchema)
// ---------------------------------------------------------------------------

describe('#3285 — validateCodexConfigSchema: hooks.state is a regular table (not AoT)', () => {
  test('bare [hooks.state] table header passes validation', () => {
    const content = [
      '[hooks.state]',
      '',
    ].join('\n');
    const result = validateCodexConfigSchema(content);
    assert.strictEqual(result.ok, true,
      'bare [hooks.state] must be allowed (regular-table namespace): ' + result.reason);
  });

  test('bare [hooks.state.<project-key>] table header passes validation', () => {
    // Mirrors the exact shape Codex CLI 0.130.0+ writes for per-hook trust entries.
    // The key contains slashes and colons — must be quoted in TOML.
    const content = [
      '[hooks.state]',
      '',
      "[hooks.state.'/home/user/.codex/hooks.json:pre_tool_use:0:0']",
      'enabled = true',
      'trusted_hash = "sha256:abc123"',
      '',
    ].join('\n');
    const result = validateCodexConfigSchema(content);
    assert.strictEqual(result.ok, true,
      'bare [hooks.state.<key>] with trust fields must be allowed: ' + result.reason);
  });

  test('hooks.state alongside [[hooks.SessionStart]] AoT both pass', () => {
    // The real-world fixture: user has both Codex trust state AND GSD-managed
    // event hooks in the same config.toml.
    const content = [
      '[hooks.state]',
      '',
      "[hooks.state.'/home/user/.codex/hooks.json:pre_tool_use:0:0']",
      'enabled = true',
      'trusted_hash = "sha256:abc123"',
      '',
      '[[hooks.SessionStart]]',
      '',
      '[[hooks.SessionStart.hooks]]',
      'type = "command"',
      'command = "/usr/local/bin/gsd-check-update"',
      '',
    ].join('\n');
    const result = validateCodexConfigSchema(content);
    assert.strictEqual(result.ok, true,
      'mixed hooks.state (regular table) + [[hooks.SessionStart]] (AoT) must pass: ' + result.reason);
  });

  test('[[hooks.SessionStart]] AoT still requires array-of-tables shape', () => {
    // Regression guard: the fix must NOT relax AoT requirements for event hooks.
    // [hooks.SessionStart] (single-bracket) must still fail.
    const content = [
      '[hooks.SessionStart]',
      'type = "command"',
      'command = "/some/command"',
      '',
    ].join('\n');
    const result = validateCodexConfigSchema(content);
    assert.strictEqual(result.ok, false,
      '[hooks.SessionStart] bare table (not AoT) must still be rejected');
    assert.ok(
      result.reason.includes('hooks.SessionStart'),
      'rejection reason must mention hooks.SessionStart, got: ' + result.reason
    );
  });

  test('hooks.state object in parsed structure does not trigger non-array rejection', () => {
    // The parsed-object check loops over Object.entries(parsed.hooks) and
    // asserts !Array.isArray(value) → error. hooks.state is an object, not
    // an array. The fix must skip hooks.state in that loop too.
    const content = [
      '[hooks.state]',
      '',
      "[hooks.state.'some-key']",
      'enabled = true',
      'trusted_hash = "sha256:deadbeef"',
      '',
    ].join('\n');
    const result = validateCodexConfigSchema(content);
    assert.strictEqual(result.ok, true,
      'parsed hooks.state object must not trigger "hooks.state must be an array" rejection: ' + result.reason);
  });

  test('multiple hooks.state sub-keys all pass validation', () => {
    const content = [
      '[hooks.state]',
      '',
      "[hooks.state.'/project/a/.codex/hooks.json:pre_tool_use:0:0']",
      'enabled = true',
      'trusted_hash = "sha256:aaa"',
      '',
      "[hooks.state.'/project/b/.codex/hooks.json:pre_tool_use:0:0']",
      'enabled = false',
      'trusted_hash = "sha256:bbb"',
      '',
    ].join('\n');
    const result = validateCodexConfigSchema(content);
    assert.strictEqual(result.ok, true,
      'multiple hooks.state sub-keys must all pass: ' + result.reason);
  });

  test('[[hooks.state]] AoT form is rejected', () => {
    // hooks.state must be a regular table — array-of-tables shape is invalid.
    const content = [
      '[[hooks.state]]',
      'enabled = true',
      '',
    ].join('\n');
    const result = validateCodexConfigSchema(content);
    assert.strictEqual(result.ok, false,
      '[[hooks.state]] (AoT) must be rejected');
    assert.ok(
      result.reason.includes('hooks.state'),
      'rejection reason must mention hooks.state, got: ' + result.reason
    );
  });

  test('[[hooks.state.foo]] AoT sub-key form is rejected', () => {
    // hooks.state.* sub-keys must be regular tables — AoT sub-key shape is invalid.
    const content = [
      '[[hooks.state.foo]]',
      'enabled = true',
      '',
    ].join('\n');
    const result = validateCodexConfigSchema(content);
    assert.strictEqual(result.ok, false,
      '[[hooks.state.foo]] (AoT sub-key) must be rejected');
    assert.ok(
      result.reason.includes('hooks.state'),
      'rejection reason must mention hooks.state, got: ' + result.reason
    );
  });
});

// ---------------------------------------------------------------------------
// Full install integration test
// ---------------------------------------------------------------------------

describe('#3285 — install succeeds when config.toml contains hooks.state entries', { concurrency: false }, () => {
  let tmpDir;
  let codexHome;

  function writeCodexConfig(content) {
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(path.join(codexHome, 'config.toml'), content, 'utf8');
  }

  function runCodexInstall() {
    const previousCodexHome = process.env.CODEX_HOME;
    const previousCwd = process.cwd();
    process.env.CODEX_HOME = codexHome;
    try {
      process.chdir(path.join(__dirname, '..'));
      return install(true, 'codex');
    } finally {
      process.chdir(previousCwd);
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = previousCodexHome;
      }
    }
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3285-'));
    codexHome = path.join(tmpDir, 'codex-home');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('install does not throw when config.toml contains hooks.state trust entries', () => {
    // This is the exact failure scenario reported in #3285.
    const preInstall = [
      '[hooks.state]',
      '',
      "[hooks.state.'/home/user/.codex/hooks.json:pre_tool_use:0:0']",
      'enabled = true',
      'trusted_hash = "sha256:abc123def456"',
      '',
    ].join('\n');
    writeCodexConfig(preInstall);

    assert.doesNotThrow(
      () => runCodexInstall(),
      'install must not throw when config.toml contains hooks.state trust entries'
    );
  });

  test('hooks.state entries are preserved in post-install config.toml', () => {
    const preInstall = [
      '[hooks.state]',
      '',
      "[hooks.state.'/home/user/.codex/hooks.json:pre_tool_use:0:0']",
      'enabled = true',
      'trusted_hash = "sha256:abc123def456"',
      '',
    ].join('\n');
    writeCodexConfig(preInstall);

    runCodexInstall();

    const after = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    // Verify structurally: the trust hash key must survive the install.
    // Do NOT grep for the literal string — parse the TOML structure.
    const { parseTomlToObject } = require('../bin/install.js');
    const parsed = parseTomlToObject(after);
    assert.ok(
      parsed.hooks && typeof parsed.hooks.state === 'object' && parsed.hooks.state !== null,
      'post-install config.toml must have hooks.state as an object'
    );
    // Verify the actual trust entry survives — not just that hooks.state is an object.
    const trustKey = "/home/user/.codex/hooks.json:pre_tool_use:0:0";
    assert.ok(
      parsed.hooks.state[trustKey] != null,
      `post-install must preserve the original trust entry for key: ${trustKey}`
    );
    assert.strictEqual(
      parsed.hooks.state[trustKey].enabled,
      true,
      'preserved trust entry must have enabled = true'
    );
    assert.strictEqual(
      parsed.hooks.state[trustKey].trusted_hash,
      'sha256:abc123def456',
      'preserved trust entry must have the original trusted_hash'
    );
  });
});
