'use strict';

/**
 * Bug #3426 — Codex on Windows: SessionStart/PostToolUse hooks fail with exit code 1
 *
 * After PRs #3396/#3397 fixed bare-bash and quote-escaping issues, a new failure
 * mode appeared on v1.42.3+:
 *
 *   Failed with non-blocking status code:
 *   C:/Program Files/Git/bin/bash.exe: C:/Program Files/Git/bin/bash.exe: cannot execute binary file
 *
 * Root cause: Codex on Windows runs hook commands from a PowerShell/cmd
 * execution environment (see install.js comment at buildHookCommand).  The
 * command string written to hooks.json was:
 *
 *   "C:/Program Files/nodejs/node.exe" "C:/path/.codex/hooks/gsd-check-update.js"
 *
 * When Codex's hook runner passes this to its subprocess spawner, the quoted
 * path resolves through Git Bash (MSYS), which then tries to POSIX-exec
 * node.exe — a Windows PE binary — via the MSYS exec layer.  The MSYS exec
 * path calls execvp() on the PE binary directly, which fails with ENOEXEC,
 * reported as "cannot execute binary file".  The "bash.exe: bash.exe:" prefix
 * appears because the error propagates through the bash.exe process that Codex
 * uses as its hook-dispatch shell.
 *
 * Fix: on Windows, write a .cmd shim (using the same buildWindowsShimTriple
 * IR pattern as gsd-sdk.cmd) and put the .cmd path as the hooks.json command.
 * cmd.exe executes .cmd files natively via CreateProcess — no POSIX exec layer,
 * no MSYS shebang walk.
 *
 * Test strategy:
 * - Assert on the typed IR returned by buildCodexHookWindowsShimIR — not on
 *   rendered .cmd text (per CONTRIBUTING.md L558-L565 IR-first discipline).
 * - Counter-tests confirm darwin/linux paths are unchanged.
 *
 * NOTE: Windows wall-clock verification depends on Docker matrix Windows
 * runners.  Local test exercises the generator IR shape only.
 */

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL = require('../bin/install.js');
const PROJECTION = require('../get-shit-done/bin/lib/shell-command-projection.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

const {
  buildCodexHookWindowsShimIR,
  ensureCodexHooksJsonSessionStart,
  resolveNodeRunner,
  uninstall,
} = INSTALL;

const { projectManagedHookCommand } = PROJECTION;

// ─── Step 1: Export surface check ────────────────────────────────────────────

describe('#3426 — export surface: buildCodexHookWindowsShimIR must be exported', () => {
  test('buildCodexHookWindowsShimIR is a function', () => {
    assert.equal(typeof buildCodexHookWindowsShimIR, 'function',
      'buildCodexHookWindowsShimIR must be exported from bin/install.js');
  });

  test('ensureCodexHooksJsonSessionStart is a function', () => {
    assert.equal(typeof ensureCodexHooksJsonSessionStart, 'function',
      'ensureCodexHooksJsonSessionStart must be exported from bin/install.js');
  });
});

// ─── Step 2: Typed IR shape for Windows Codex hook shim ──────────────────────

describe('#3426 — buildCodexHookWindowsShimIR: typed IR (not rendered text)', () => {
  const FAKE_SCRIPT = 'C:/Users/me/.codex/hooks/gsd-check-update.js';
  const FAKE_RUNNER = '"C:/Program Files/nodejs/node.exe"';

  test('returns typed IR with invocation, cmdPath, and render factory', () => {
    const ir = buildCodexHookWindowsShimIR(FAKE_SCRIPT, FAKE_RUNNER);
    // IR shape assertion — per CONTRIBUTING.md L558 IR-first discipline
    assert.ok(ir && typeof ir === 'object', 'must return an object');
    assert.ok(typeof ir.invocation === 'object', 'must have invocation record');
    assert.ok(typeof ir.cmdPath === 'string', 'must have cmdPath string');
    assert.ok(typeof ir.hookCommand === 'string', 'must have hookCommand string (written to hooks.json)');
    assert.ok(typeof ir.render === 'object', 'must have render factory');
    assert.ok(typeof ir.render.cmd === 'function', 'must have render.cmd() factory');
  });

  test('invocation.target equals the resolved script path', () => {
    const ir = buildCodexHookWindowsShimIR(FAKE_SCRIPT, FAKE_RUNNER);
    // invocation.target is the JS file being wrapped — same IR contract as buildWindowsShimTriple
    assert.ok(
      ir.invocation.target.includes('gsd-check-update.js'),
      `invocation.target must reference the hook script, got: ${ir.invocation.target}`,
    );
  });

  test('invocation.interpreter is the node runner (not bash)', () => {
    const ir = buildCodexHookWindowsShimIR(FAKE_SCRIPT, FAKE_RUNNER);
    // The shim must invoke node, never bash — bash is not a valid Codex hook runner on Windows
    const interp = ir.invocation.interpreter;
    assert.ok(
      typeof interp === 'string' && (interp.includes('node') || interp === 'node'),
      `invocation.interpreter must be a node path, not bash. Got: ${interp}`,
    );
    assert.ok(
      !interp.toLowerCase().includes('bash'),
      `invocation.interpreter must NOT be bash — bash is the source of the #3426 failure. Got: ${interp}`,
    );
  });

  test('cmdPath ends with .cmd extension', () => {
    const ir = buildCodexHookWindowsShimIR(FAKE_SCRIPT, FAKE_RUNNER);
    assert.ok(
      ir.cmdPath.endsWith('.cmd'),
      `cmdPath must end with .cmd for cmd.exe native execution, got: ${ir.cmdPath}`,
    );
  });

  test('hookCommand is the .cmd path (not a "runner script.js" string)', () => {
    const ir = buildCodexHookWindowsShimIR(FAKE_SCRIPT, FAKE_RUNNER);
    // The hook command written to hooks.json must be the .cmd path, not "node.exe script.js"
    // because cmd.exe executes .cmd natively without POSIX exec layer
    assert.ok(
      ir.hookCommand.includes('.cmd'),
      `hookCommand must reference the .cmd shim, got: ${ir.hookCommand}`,
    );
    // hookCommand must NOT contain bash — this was the failure mode
    assert.ok(
      !ir.hookCommand.toLowerCase().includes('bash'),
      `hookCommand must NOT reference bash, got: ${ir.hookCommand}`,
    );
  });

  test('returns null when absoluteRunnerToken is null (caller skips registration)', () => {
    const ir = buildCodexHookWindowsShimIR(FAKE_SCRIPT, null);
    assert.equal(ir, null,
      'must return null when runner is unavailable so caller can warn-and-skip');
  });
});

// ─── Step 2b: Typed IR — eol / quoting / passthroughArgs ─────────────────────
// Per CONTRIBUTING.md L558-L565: assert on the typed IR, not on rendered text.
// These assertions cover the three bug-critical render semantics that
// text-matching tests would miss (silent EOL/quoting/passthrough regressions).

describe('#3426 — buildCodexHookWindowsShimIR: typed IR eol / quoting / passthroughArgs', () => {
  const FAKE_SCRIPT = 'C:/Users/me/.codex/hooks/gsd-check-update.js';
  const FAKE_RUNNER = '"C:/Program Files/nodejs/node.exe"';

  test('eol.cmd is CRLF (\\r\\n) — canonical for cmd.exe .cmd files', () => {
    const ir = buildCodexHookWindowsShimIR(FAKE_SCRIPT, FAKE_RUNNER);
    assert.ok(ir && typeof ir.eol === 'object', 'IR must expose an eol field');
    assert.strictEqual(
      ir.eol.cmd,
      '\r\n',
      'eol.cmd must be CRLF (\\r\\n) — LF-only .cmd files risk silent parse failures on some Windows versions',
    );
  });

  test('invocation.target has no shell-metachar leakage (clean absolute path)', () => {
    const ir = buildCodexHookWindowsShimIR(FAKE_SCRIPT, FAKE_RUNNER);
    const target = ir.invocation.target;
    assert.ok(typeof target === 'string' && target.length > 0, 'invocation.target must be a non-empty string');
    // The target stored in the IR is the raw unquoted path — quoting happens at
    // render time. A metachar in the raw value means the IR is already corrupted.
    assert.ok(
      !target.includes('"') && !target.includes("'") && !target.includes('`'),
      `invocation.target must be the raw path without shell quoting, got: ${target}`,
    );
    assert.ok(
      target.endsWith('.js'),
      `invocation.target must resolve to the .js script, got: ${target}`,
    );
  });

  test('passthroughArgs is true — shim forwards all args via %*', () => {
    const ir = buildCodexHookWindowsShimIR(FAKE_SCRIPT, FAKE_RUNNER);
    assert.strictEqual(
      ir.passthroughArgs,
      true,
      'passthroughArgs must be true: the .cmd shim must forward all arguments to the node script via %*',
    );
  });
});

// ─── Step 3: Counter-test — non-Windows platforms use node-runner command ────

describe('#3426 counter-test: darwin/linux Codex paths use node-runner command (not .cmd shim)', () => {
  test('projectManagedHookCommand on darwin emits node-runner command, not .cmd', () => {
    const runner = resolveNodeRunner() || '"/usr/local/bin/node"';
    const cmd = projectManagedHookCommand({
      absoluteRunner: runner,
      scriptPath: '/Users/me/.codex/hooks/gsd-check-update.js',
      runtime: 'codex',
      platform: 'darwin',
    });
    assert.ok(typeof cmd === 'string', 'must return a string on darwin');
    assert.ok(!cmd.endsWith('.cmd'), 'darwin command must NOT reference a .cmd shim');
    assert.ok(
      cmd.includes('gsd-check-update.js'),
      `darwin command must reference the .js hook directly, got: ${cmd}`,
    );
  });

  test('projectManagedHookCommand on linux emits node-runner command, not .cmd', () => {
    const runner = resolveNodeRunner() || '"/usr/local/bin/node"';
    const cmd = projectManagedHookCommand({
      absoluteRunner: runner,
      scriptPath: '/home/me/.codex/hooks/gsd-check-update.js',
      runtime: 'codex',
      platform: 'linux',
    });
    assert.ok(typeof cmd === 'string', 'must return a string on linux');
    assert.ok(!cmd.endsWith('.cmd'), 'linux command must NOT reference a .cmd shim');
    assert.ok(
      cmd.includes('gsd-check-update.js'),
      `linux command must reference the .js hook directly, got: ${cmd}`,
    );
  });
});

// ─── Step 4: Integration — ensureCodexHooksJsonSessionStart on win32 writes .cmd shim ──

describe('#3426 integration: ensureCodexHooksJsonSessionStart on win32 writes .cmd shim', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-3426-');
    fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true });
    // Stub the hook file that must exist for the hook to be registered
    fs.writeFileSync(
      path.join(tmpDir, 'hooks', 'gsd-check-update.js'),
      '#!/usr/bin/env node\nconsole.log("ok");\n',
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('win32: hooks.json command references .cmd shim (not "node.exe script.js")', () => {
    const fakeRunner = '"C:/Program Files/nodejs/node.exe"';

    const result = ensureCodexHooksJsonSessionStart(tmpDir, {
      absoluteRunner: fakeRunner,
      platform: 'win32',
    });

    assert.ok(result.wrote || result.changed, 'must write hooks.json on win32');

    const hooksJsonPath = path.join(tmpDir, 'hooks.json');
    assert.ok(fs.existsSync(hooksJsonPath), 'hooks.json must exist after install');

    const hooksJson = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
    const commands = (hooksJson.SessionStart || [])
      .flatMap((e) => (Array.isArray(e.hooks) ? e.hooks : []))
      .map((h) => h && h.command)
      .filter((c) => typeof c === 'string');

    assert.ok(commands.length > 0, 'must have at least one SessionStart hook command');

    const cmd = commands.find((c) => c.includes('gsd-check-update'));
    assert.ok(cmd, 'must have a gsd-check-update hook command');

    // KEY ASSERTION: on win32, the command must reference a .cmd file — not bash
    assert.ok(
      cmd.includes('.cmd'),
      `win32 hook command must reference a .cmd shim to avoid bash.exe exec failure (#3426). Got: ${cmd}`,
    );
    assert.ok(
      !cmd.toLowerCase().includes('bash'),
      `win32 hook command must NOT reference bash.exe — this was the #3426 failure. Got: ${cmd}`,
    );
  });

  test('win32: .cmd shim file is written to the hooks directory', () => {
    const fakeRunner = '"C:/Program Files/nodejs/node.exe"';

    ensureCodexHooksJsonSessionStart(tmpDir, {
      absoluteRunner: fakeRunner,
      platform: 'win32',
    });

    const cmdShimPath = path.join(tmpDir, 'hooks', 'gsd-check-update.cmd');
    assert.ok(
      fs.existsSync(cmdShimPath),
      `win32: .cmd shim must be written at ${cmdShimPath}`,
    );
    // File must be non-empty — structure check only (IR-first discipline)
    const size = fs.statSync(cmdShimPath).size;
    assert.ok(size > 0, '.cmd shim must have non-zero content');
  });

  test('non-Windows (darwin): hooks.json command is "node.exe script.js" (no .cmd shim)', () => {
    const fakeRunner = '"/usr/local/bin/node"';

    const result = ensureCodexHooksJsonSessionStart(tmpDir, {
      absoluteRunner: fakeRunner,
      platform: 'darwin',
    });

    assert.ok(result.wrote || result.changed, 'must write hooks.json on darwin');

    const hooksJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'hooks.json'), 'utf8'),
    );
    const commands = (hooksJson.SessionStart || [])
      .flatMap((e) => (Array.isArray(e.hooks) ? e.hooks : []))
      .map((h) => h && h.command)
      .filter((c) => typeof c === 'string');

    const cmd = commands.find((c) => c.includes('gsd-check-update'));
    assert.ok(cmd, 'must have a gsd-check-update hook command on darwin');

    // Counter-test: darwin must NOT use a .cmd shim
    assert.ok(
      !cmd.endsWith('.cmd'),
      `darwin hook command must NOT reference a .cmd shim, got: ${cmd}`,
    );
    assert.ok(
      cmd.includes('gsd-check-update.js'),
      `darwin hook command must reference the .js file directly, got: ${cmd}`,
    );

    // .cmd shim must NOT be written on darwin
    const cmdShimPath = path.join(tmpDir, 'hooks', 'gsd-check-update.cmd');
    assert.ok(
      !fs.existsSync(cmdShimPath),
      'darwin must NOT write a .cmd shim',
    );
  });

  test('non-Windows (linux): same as darwin — no .cmd shim', () => {
    const fakeRunner = '"/usr/local/bin/node"';

    ensureCodexHooksJsonSessionStart(tmpDir, {
      absoluteRunner: fakeRunner,
      platform: 'linux',
    });

    const hooksJson = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'hooks.json'), 'utf8'),
    );
    const commands = (hooksJson.SessionStart || [])
      .flatMap((e) => (Array.isArray(e.hooks) ? e.hooks : []))
      .map((h) => h && h.command)
      .filter((c) => typeof c === 'string');

    const cmd = commands.find((c) => c.includes('gsd-check-update'));
    assert.ok(cmd, 'linux must have a gsd-check-update hook command');
    assert.ok(!cmd.endsWith('.cmd'), 'linux must NOT use a .cmd shim');

    const cmdShimPath = path.join(tmpDir, 'hooks', 'gsd-check-update.cmd');
    assert.ok(!fs.existsSync(cmdShimPath), 'linux must NOT write a .cmd shim');
  });
});

// ─── Step 5: Uninstall cleanup — .cmd shim removed from disk ─────────────────

describe('#3426 uninstall: gsd-check-update.cmd is removed from hooks dir on uninstall', () => {
  let tmpDir;

  function withCodexHome(dir, fn) {
    const prev = process.env.CODEX_HOME;
    process.env.CODEX_HOME = dir;
    try { return fn(); }
    finally {
      if (prev == null) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prev;
    }
  }

  beforeEach(() => {
    tmpDir = createTempDir('gsd-3426-uninstall-');
    fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true });
    // Write the .js hook (required by install) and a pre-existing .cmd shim
    fs.writeFileSync(
      path.join(tmpDir, 'hooks', 'gsd-check-update.js'),
      '#!/usr/bin/env node\nconsole.log("ok");\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'hooks', 'gsd-check-update.cmd'),
      '@ECHO OFF\r\n@SETLOCAL\r\n@"C:/node.exe" "C:/path/gsd-check-update.js" %*\r\n',
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('uninstall removes gsd-check-update.cmd from hooks directory', () => {
    const cmdShimPath = path.join(tmpDir, 'hooks', 'gsd-check-update.cmd');
    assert.ok(fs.existsSync(cmdShimPath), 'pre-condition: .cmd shim exists before uninstall');

    withCodexHome(tmpDir, () => uninstall(true, 'codex'));

    assert.ok(
      !fs.existsSync(cmdShimPath),
      `gsd-check-update.cmd must be removed from disk on uninstall — orphaned .cmd shim would cause stale hook references. Path: ${cmdShimPath}`,
    );
  });
});

// ─── Step 6: Upgrade path — existing win32 hooks.json with node-runner command ─

describe('#3426 upgrade: reinstall on win32 migrates existing "node script.js" to .cmd shim', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-3426-upgrade-');
    fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'hooks', 'gsd-check-update.js'),
      '#!/usr/bin/env node\nconsole.log("ok");\n',
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('replaces old "node.exe script.js" command with .cmd shim on win32 reinstall', () => {
    const managedHookPath = path.join(tmpDir, 'hooks', 'gsd-check-update.js').replace(/\\/g, '/');
    // Pre-existing stale hooks.json with node-runner command (v1.42.3 shape)
    const staleLegacyCommand = `"C:/Program Files/nodejs/node.exe" "${managedHookPath}"`;
    fs.writeFileSync(
      path.join(tmpDir, 'hooks.json'),
      JSON.stringify({
        SessionStart: [{ hooks: [{ type: 'command', command: staleLegacyCommand }] }],
      }, null, 2),
    );

    const fakeRunner = '"C:/Program Files/nodejs/node.exe"';
    ensureCodexHooksJsonSessionStart(tmpDir, {
      absoluteRunner: fakeRunner,
      platform: 'win32',
    });

    const hooksJson = JSON.parse(fs.readFileSync(path.join(tmpDir, 'hooks.json'), 'utf8'));
    const commands = (hooksJson.SessionStart || [])
      .flatMap((e) => (Array.isArray(e.hooks) ? e.hooks : []))
      .map((h) => h && h.command)
      .filter((c) => typeof c === 'string');

    const gsdCmds = commands.filter((c) => c.includes('gsd-check-update'));
    // Exactly one managed hook after migration — no duplicates
    assert.equal(gsdCmds.length, 1, `must have exactly 1 gsd-check-update command after migration, got: ${JSON.stringify(gsdCmds)}`);

    // Must be the .cmd shim
    assert.ok(
      gsdCmds[0].includes('.cmd'),
      `migrated command must reference .cmd shim, got: ${gsdCmds[0]}`,
    );
  });
});
