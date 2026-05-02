// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression tests for install process hook copying, permissions, manifest
 * tracking, uninstall cleanup, and settings.json registration.
 *
 * Covers: #1755, Codex hook path/filename, cache invalidation path,
 * manifest .sh tracking, uninstall settings cleanup, dead code removal.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cleanup, createTempDir } = require('./helpers.cjs');

const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');
const { writeManifest, validateHookFields } = require(INSTALL_SRC);
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
const HOOKS_DIST = path.join(__dirname, '..', 'hooks', 'dist');

// Expected .sh community hooks
const EXPECTED_SH_HOOKS = [
  'gsd-session-state.sh',
  'gsd-validate-commit.sh',
  'gsd-phase-boundary.sh',
];

// All hooks that should be in hooks/dist/ after build
const EXPECTED_ALL_HOOKS = [
  'gsd-check-update.js',
  'gsd-context-monitor.js',
  'gsd-prompt-guard.js',
  'gsd-read-guard.js',
  'gsd-read-injection-scanner.js',
  'gsd-statusline.js',
  'gsd-workflow-guard.js',
  ...EXPECTED_SH_HOOKS,
];

const isWindows = process.platform === 'win32';

// ─── Ensure hooks/dist/ is populated ────────────────────────────────────────

before(() => {
  execFileSync(process.execPath, [BUILD_SCRIPT], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
});

// ─── Helper: simulate the hook copy loop from install.js ────────────────────
// NOTE: This helper mirrors the chmod/copy logic only. It omits the .js
// template substitution ('.claude' → runtime dir, {{GSD_VERSION}} stamping)
// since these tests focus on file presence and permissions, not content.

function simulateHookCopy(hooksSrc, hooksDest) {
  fs.mkdirSync(hooksDest, { recursive: true });
  const hookEntries = fs.readdirSync(hooksSrc);
  for (const entry of hookEntries) {
    const srcFile = path.join(hooksSrc, entry);
    if (fs.statSync(srcFile).isFile()) {
      const destFile = path.join(hooksDest, entry);
      if (entry.endsWith('.js')) {
        const content = fs.readFileSync(srcFile, 'utf8');
        fs.writeFileSync(destFile, content);
        try { fs.chmodSync(destFile, 0o755); } catch (e) { /* Windows */ }
      } else {
        fs.copyFileSync(srcFile, destFile);
        if (entry.endsWith('.sh')) {
          try { fs.chmodSync(destFile, 0o755); } catch (e) { /* Windows */ }
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Hook file copy and permissions (#1755)
// ─────────────────────────────────────────────────────────────────────────────

describe('#1755: .sh hooks are copied and executable after install', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-hook-copy-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('all expected hooks are copied from hooks/dist/ to target', () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);

    for (const hook of EXPECTED_ALL_HOOKS) {
      assert.ok(
        fs.existsSync(path.join(hooksDest, hook)),
        `${hook} should exist in target hooks dir`
      );
    }
  });

  test('.sh hooks are executable after copy', {
    skip: isWindows ? 'Windows has no POSIX file permissions' : false,
  }, () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);

    for (const sh of EXPECTED_SH_HOOKS) {
      const stat = fs.statSync(path.join(hooksDest, sh));
      assert.ok(
        (stat.mode & 0o111) !== 0,
        `${sh} should be executable after install copy`
      );
    }
  });

  test('.js hooks are executable after copy', {
    skip: isWindows ? 'Windows has no POSIX file permissions' : false,
  }, () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);

    const jsHooks = EXPECTED_ALL_HOOKS.filter(h => h.endsWith('.js'));
    for (const js of jsHooks) {
      const stat = fs.statSync(path.join(hooksDest, js));
      assert.ok(
        (stat.mode & 0o111) !== 0,
        `${js} should be executable after install copy`
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. install.js source-level correctness checks
// ─────────────────────────────────────────────────────────────────────────────

describe('install.js source correctness', () => {
  let src;

  before(() => {
    src = fs.readFileSync(INSTALL_SRC, 'utf-8');
  });

  test('.sh files get chmod after copyFileSync', () => {
    // The else branch for non-.js hooks should apply chmod for .sh files
    assert.ok(
      src.includes("if (entry.endsWith('.sh'))"),
      'install.js should check for .sh extension to apply chmod'
    );
  });

  test('Codex hook uses correct filename gsd-check-update.js (not gsd-update-check.js)', () => {
    // The cache file gsd-update-check.json is legitimate (different artifact);
    // check that no hook registration uses the inverted .js filename.
    // Match the exact pattern: quote + gsd-update-check.js + quote
    assert.ok(
      !src.match(/['"]gsd-update-check\.js['"]/),
      'install.js must not reference the inverted hook name gsd-update-check.js in quotes'
    );
  });

  test('Codex hook path does not use get-shit-done/hooks/ subdirectory', () => {
    // The Codex hook should resolve to targetDir/hooks/, not targetDir/get-shit-done/hooks/
    assert.ok(
      !src.includes("'get-shit-done', 'hooks', 'gsd-check-update"),
      'Codex hook should not use get-shit-done/hooks/ path segment'
    );
  });

  test('cache invalidation uses ~/.cache/gsd/ path', () => {
    assert.ok(
      src.includes("os.homedir(), '.cache', 'gsd'"),
      'Cache path should use os.homedir()/.cache/gsd/'
    );
  });

  test('manifest tracks .sh hook files', () => {
    assert.ok(
      src.includes("file.endsWith('.sh')"),
      'writeManifest should track .sh files in addition to .js'
    );
  });

  test('gsd-workflow-guard.js is in uninstall hook list', () => {
    const gsdHooksMatch = src.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(gsdHooksMatch, 'gsdHooks array should exist');
    const gsdHooksContent = gsdHooksMatch[1];
    assert.ok(
      gsdHooksContent.includes('gsd-workflow-guard.js'),
      'gsdHooks should include gsd-workflow-guard.js'
    );
  });

  test('phantom gsd-check-update.sh is not in uninstall hook list', () => {
    const gsdHooksMatch = src.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(gsdHooksMatch, 'gsdHooks array should exist');
    const gsdHooksContent = gsdHooksMatch[1];
    assert.ok(
      !gsdHooksContent.includes('gsd-check-update.sh'),
      'gsdHooks should not include phantom gsd-check-update.sh'
    );
  });

  test('isGsdHookCommand covers all GSD hook names', () => {
    // The consolidated uninstall cleanup uses isGsdHookCommand — verify all hook names are present
    const expectedHookNames = [
      'gsd-check-update', 'gsd-statusline', 'gsd-session-state',
      'gsd-context-monitor', 'gsd-phase-boundary', 'gsd-prompt-guard',
      'gsd-read-guard', 'gsd-validate-commit', 'gsd-workflow-guard',
    ];
    for (const name of expectedHookNames) {
      assert.ok(
        src.includes(`'${name}'`) || src.includes(`"${name}"`),
        `isGsdHookCommand should match ${name}`
      );
    }
  });

  test('Codex install migrates legacy gsd-update-check entries', () => {
    assert.ok(
      src.includes('gsd-update-check'),
      'install.js should detect legacy gsd-update-check entries for migration'
    );
  });

  test('no duplicate isCursor or isWindsurf branches in uninstall skill removal', () => {
    // The uninstall skill removal if/else chain should not have standalone
    // isCursor or isWindsurf branches — they're already handled by the combined
    // (isCodex || isCursor || isWindsurf || isTrae) branch
    const uninstallStart = src.indexOf('function uninstall(');
    const uninstallEnd = src.indexOf('function verifyInstalled(');
    assert.ok(uninstallStart !== -1, 'function uninstall( must exist in install.js');
    assert.ok(uninstallEnd !== -1, 'function verifyInstalled( must exist in install.js');
    const uninstallBlock = src.substring(uninstallStart, uninstallEnd);

    // Count occurrences of 'else if (isCursor)' in uninstall — should be 0
    const cursorBranches = (uninstallBlock.match(/else if \(isCursor\)/g) || []).length;
    assert.strictEqual(cursorBranches, 0, 'No standalone isCursor branch should exist in uninstall');

    // Count occurrences of 'else if (isWindsurf)' in uninstall — should be 0
    const windsurfBranches = (uninstallBlock.match(/else if \(isWindsurf\)/g) || []).length;
    assert.strictEqual(windsurfBranches, 0, 'No standalone isWindsurf branch should exist in uninstall');
  });

  test('verifyInstalled warns about missing .sh hooks', () => {
    assert.ok(
      src.includes('Missing expected hook:'),
      'install should warn about missing .sh hooks after verification'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Manifest tracks .sh hooks
// ─────────────────────────────────────────────────────────────────────────────

describe('writeManifest includes .sh hooks', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-manifest-');
    // Set up minimal structure expected by writeManifest
    const hooksDir = path.join(tmpDir, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    // Copy hooks from dist to simulate install
    simulateHookCopy(HOOKS_DIST, hooksDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('manifest contains .sh hook entries', () => {
    writeManifest(tmpDir, 'claude');

    const manifestPath = path.join(tmpDir, 'gsd-file-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest file should exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    for (const sh of EXPECTED_SH_HOOKS) {
      assert.ok(
        manifest.files['hooks/' + sh],
        `manifest should contain hash for ${sh}`
      );
    }
  });

  test('manifest contains .js hook entries', () => {
    writeManifest(tmpDir, 'claude');

    const manifestPath = path.join(tmpDir, 'gsd-file-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const jsHooks = EXPECTED_ALL_HOOKS.filter(h => h.endsWith('.js'));
    for (const js of jsHooks) {
      assert.ok(
        manifest.files['hooks/' + js],
        `manifest should contain hash for ${js}`
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Uninstall per-hook granularity (#1755 followup)
// ─────────────────────────────────────────────────────────────────────────────

describe('uninstall settings cleanup preserves user hooks', () => {
  // Mirror the isGsdHookCommand logic from install.js
  const isGsdHookCommand = (cmd) =>
    cmd && (cmd.includes('gsd-check-update') || cmd.includes('gsd-statusline') ||
      cmd.includes('gsd-session-state') || cmd.includes('gsd-context-monitor') ||
      cmd.includes('gsd-phase-boundary') || cmd.includes('gsd-prompt-guard') ||
      cmd.includes('gsd-read-guard') || cmd.includes('gsd-validate-commit') ||
      cmd.includes('gsd-workflow-guard'));

  // Simulate the per-hook filtering logic from uninstall
  function filterGsdHooks(entries) {
    return entries
      .map(entry => {
        if (!entry.hooks || !Array.isArray(entry.hooks)) return entry;
        entry.hooks = entry.hooks.filter(h => !isGsdHookCommand(h.command));
        return entry.hooks.length > 0 ? entry : null;
      })
      .filter(Boolean);
  }

  test('mixed entry with GSD + user hooks preserves user hooks', () => {
    const entries = [{
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: 'node /path/to/gsd-prompt-guard.js' },
        { type: 'command', command: 'bash /my/custom-lint.sh' },
      ],
    }];

    const result = filterGsdHooks(entries);
    assert.strictEqual(result.length, 1, 'entry should survive with remaining user hook');
    assert.strictEqual(result[0].hooks.length, 1, 'only user hook should remain');
    assert.ok(result[0].hooks[0].command.includes('custom-lint'), 'user hook preserved');
  });

  test('entry with only GSD hooks is fully removed', () => {
    const entries = [{
      hooks: [
        { type: 'command', command: 'node /path/to/gsd-check-update.js' },
        { type: 'command', command: 'node /path/to/gsd-statusline.js' },
      ],
    }];

    const result = filterGsdHooks(entries);
    assert.strictEqual(result.length, 0, 'entry should be removed when all hooks are GSD');
  });

  test('entry with only user hooks is untouched', () => {
    const entries = [{
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: 'bash /my/pre-check.sh' },
      ],
    }];

    const result = filterGsdHooks(entries);
    assert.strictEqual(result.length, 1, 'entry should survive');
    assert.strictEqual(result[0].hooks.length, 1, 'user hook should remain');
  });

  test('non-array hook entries are preserved during uninstall (#1825)', () => {
    const entries = [
      { type: 'custom', command: 'echo hello' },
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'node /path/to/gsd-prompt-guard.js' }] },
      { url: 'https://example.com/webhook' },
    ];

    const result = filterGsdHooks(JSON.parse(JSON.stringify(entries)));
    assert.strictEqual(result.length, 2, 'both non-array entries should survive');
    assert.deepStrictEqual(result[0], { type: 'custom', command: 'echo hello' }, 'first non-array entry preserved');
    assert.deepStrictEqual(result[1], { url: 'https://example.com/webhook' }, 'second non-array entry preserved');
  });

  test('all GSD hook names are recognized by isGsdHookCommand', () => {
    const gsdCommands = [
      'node /path/gsd-check-update.js',
      'node /path/gsd-statusline.js',
      'bash /path/gsd-session-state.sh',
      'node /path/gsd-context-monitor.js',
      'bash /path/gsd-phase-boundary.sh',
      'node /path/gsd-prompt-guard.js',
      'node /path/gsd-read-guard.js',
      'bash /path/gsd-validate-commit.sh',
      'node /path/gsd-workflow-guard.js',
    ];

    for (const cmd of gsdCommands) {
      assert.ok(isGsdHookCommand(cmd), `should recognize: ${cmd}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Codex legacy migration
// ─────────────────────────────────────────────────────────────────────────────

describe('Codex legacy gsd-update-check migration', () => {
  test('install.js strips legacy gsd-update-check hook blocks from config', () => {
    const src = fs.readFileSync(INSTALL_SRC, 'utf-8');
    assert.ok(
      src.includes('gsd-update-check') && src.includes('replace('),
      'install.js should have migration logic to strip legacy gsd-update-check entries'
    );
  });

  test('migration regex removes LF legacy hook block', () => {
    const legacyBlock = [
      '[features]',
      'codex_hooks = true',
      '',
      '# GSD Hooks',
      '[[hooks]]',
      'event = "SessionStart"',
      'command = "node /old/path/gsd-update-check.js"',
      '',
    ].join('\n');

    let content = legacyBlock;
    content = content.replace(/\n# GSD Hooks\n\[\[hooks\]\]\nevent = "SessionStart"\ncommand = "node [^\n]*gsd-update-check\.js"\n/g, '\n');
    assert.ok(!content.includes('gsd-update-check'), 'legacy hook block should be removed');
    assert.ok(content.includes('[features]'), 'non-hook content should be preserved');
  });

  test('migration regex removes CRLF legacy hook block', () => {
    const legacyBlock = [
      '[features]',
      'codex_hooks = true',
      '',
      '# GSD Hooks',
      '[[hooks]]',
      'event = "SessionStart"',
      'command = "node /old/path/gsd-update-check.js"',
      '',
    ].join('\r\n');

    let content = legacyBlock;
    content = content.replace(/\r\n# GSD Hooks\r\n\[\[hooks\]\]\r\nevent = "SessionStart"\r\ncommand = "node [^\r\n]*gsd-update-check\.js"\r\n/g, '\r\n');
    assert.ok(!content.includes('gsd-update-check'), 'legacy CRLF hook block should be removed');
    assert.ok(content.includes('[features]'), 'non-hook content should be preserved');
  });
});
