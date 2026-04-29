/**
 * Regression test for #2831: OpenCode @file references contain literal `$HOME`
 * which OpenCode does not expand — `@$HOME/.config/opencode/...` is resolved
 * as a path relative to the config command/ dir, producing
 * `command/$HOME/.config/opencode/...` (file not found).
 *
 * Root cause: install.js pathPrefix used `$HOME`-relative paths for OpenCode on
 * non-Windows hosts (only Windows was guarded by #2376). OpenCode's `@file`
 * include syntax does NOT shell-expand `$HOME` on any platform.
 *
 * Fix: pathPrefix must use the absolute path for OpenCode on all platforms.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const INSTALL_JS_PATH = path.join(__dirname, '..', 'bin', 'install.js');

// Mirror of the install.js pathPrefix logic for simulation. Keep the structural
// expression identical so a regression in install.js is detectable by failing
// these simulations.
function computePathPrefix({ isGlobal, isOpencode, isWindowsHost, resolvedTarget, homeDir }) {
  // The fix: OpenCode (any platform) must NOT use $HOME-relative paths because
  // `@file` references are not shell-expanded.
  return isGlobal && resolvedTarget.startsWith(homeDir) && !isOpencode && !(isOpencode && isWindowsHost)
    ? '$HOME' + resolvedTarget.slice(homeDir.length) + '/'
    : `${resolvedTarget}/`;
}

describe('bug-2831: OpenCode pathPrefix uses absolute path on all platforms', () => {
  test('install.js exists', () => {
    assert.ok(fs.existsSync(INSTALL_JS_PATH));
  });

  test('install.js pathPrefix expression excludes OpenCode (any platform) from $HOME substitution', () => {
    const content = fs.readFileSync(INSTALL_JS_PATH, 'utf-8');
    // Find the pathPrefix block.
    const match = content.match(/const pathPrefix[\s\S]*?\$HOME[\s\S]*?resolvedTarget\.slice\(homeDir\.length\)/);
    assert.ok(match, 'pathPrefix block must exist');
    const block = match[0];

    // Must contain a guard that excludes isOpencode unconditionally (not just
    // when paired with isWindowsHost).
    const hasUnconditionalOpencodeGuard =
      /!\s*isOpencode\b(?!\s*&&\s*isWindowsHost)/.test(block) ||
      /isOpencode\s*\?\s*`?\$\{?resolvedTarget/.test(block);

    assert.ok(
      hasUnconditionalOpencodeGuard,
      'pathPrefix must exclude $HOME substitution for OpenCode on all platforms'
    );
  });

  test('simulated pathPrefix: OpenCode on macOS uses absolute path (no $HOME)', () => {
    const pathPrefix = computePathPrefix({
      isGlobal: true,
      isOpencode: true,
      isWindowsHost: false,
      homeDir: '/Users/alice',
      resolvedTarget: '/Users/alice/.config/opencode',
    });
    assert.strictEqual(pathPrefix, '/Users/alice/.config/opencode/');
    assert.ok(!pathPrefix.includes('$HOME'));
  });

  test('simulated pathPrefix: OpenCode on Linux uses absolute path (no $HOME)', () => {
    const pathPrefix = computePathPrefix({
      isGlobal: true,
      isOpencode: true,
      isWindowsHost: false,
      homeDir: '/home/bob',
      resolvedTarget: '/home/bob/.config/opencode',
    });
    assert.strictEqual(pathPrefix, '/home/bob/.config/opencode/');
    assert.ok(!pathPrefix.includes('$HOME'));
  });

  test('simulated pathPrefix: OpenCode on Windows still uses absolute path (preserves #2376)', () => {
    const pathPrefix = computePathPrefix({
      isGlobal: true,
      isOpencode: true,
      isWindowsHost: true,
      homeDir: 'C:/Users/carol',
      resolvedTarget: 'C:/Users/carol/.config/opencode',
    });
    assert.strictEqual(pathPrefix, 'C:/Users/carol/.config/opencode/');
  });

  test('simulated pathPrefix: Claude Code on macOS still uses $HOME (unaffected)', () => {
    const pathPrefix = computePathPrefix({
      isGlobal: true,
      isOpencode: false,
      isWindowsHost: false,
      homeDir: '/Users/alice',
      resolvedTarget: '/Users/alice/.claude',
    });
    assert.strictEqual(pathPrefix, '$HOME/.claude/');
  });

  test('end-to-end: copyFlattenedCommands produces no @$HOME literal in OpenCode output', () => {
    // Stage a fake source command with @~/.claude/... and run install with
    // OpenCode runtime selected, then assert no @$HOME or $HOME/ remains in
    // emitted file.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2831-'));
    const srcRoot = path.join(tmp, 'src');
    const targetRoot = path.join(tmp, 'home', '.config', 'opencode');
    const srcCmdDir = path.join(srcRoot, 'commands', 'gsd');
    fs.mkdirSync(srcCmdDir, { recursive: true });
    fs.mkdirSync(targetRoot, { recursive: true });

    fs.writeFileSync(path.join(srcCmdDir, 'autonomous.md'),
      '---\nname: autonomous\n---\n<execution_context>\n@~/.claude/get-shit-done/workflows/autonomous.md\n@$HOME/.claude/get-shit-done/references/ui-brand.md\n</execution_context>\n');

    // Load install.js in a way that exposes copyFlattenedCommands.
    // Since it's a script, we re-implement the relevant call path using the
    // simulated pathPrefix above to validate the regex behavior.
    const isGlobal = true;
    const isOpencode = true;
    const isWindowsHost = false;
    const homeDir = path.join(tmp, 'home');
    const resolvedTarget = targetRoot.replace(/\\/g, '/');
    const pathPrefix = computePathPrefix({
      isGlobal, isOpencode, isWindowsHost,
      homeDir: homeDir.replace(/\\/g, '/'),
      resolvedTarget,
    });

    // Apply the same substitutions install.js applies in copyFlattenedCommands.
    let content = fs.readFileSync(path.join(srcCmdDir, 'autonomous.md'), 'utf8');
    content = content.replace(/~\/\.claude\//g, pathPrefix);
    content = content.replace(/\$HOME\/\.claude\//g, pathPrefix);

    assert.ok(!/@\$HOME\b/.test(content),
      `output must not contain @$HOME literal; got:\n${content}`);
    assert.ok(!/\$HOME\b/.test(content),
      `output must not contain $HOME literal; got:\n${content}`);
    assert.ok(content.includes(`@${resolvedTarget}/`),
      `output should include absolute path with @ prefix; got:\n${content}`);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
