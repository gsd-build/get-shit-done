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
 *
 * Tests exercise install.js's exported `computePathPrefix` directly (no source
 * grepping) and additionally simulate the `copyFlattenedCommands` substitution
 * pipeline on a temp tree to verify no `$HOME` literal leaks into emitted files.
 */

'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

let computePathPrefix;

before(() => {
  process.env.GSD_TEST_MODE = '1';
  delete require.cache[require.resolve('../bin/install.js')];
  ({ computePathPrefix } = require('../bin/install.js'));
});

after(() => {
  delete process.env.GSD_TEST_MODE;
});

describe('bug-2831: OpenCode pathPrefix uses absolute path on all platforms', () => {
  test('computePathPrefix is exported by install.js', () => {
    assert.equal(typeof computePathPrefix, 'function');
  });

  test('OpenCode on macOS: pathPrefix is absolute (no $HOME)', () => {
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

  test('OpenCode on Linux: pathPrefix is absolute (no $HOME)', () => {
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

  test('OpenCode on Windows: pathPrefix is absolute (preserves #2376)', () => {
    const pathPrefix = computePathPrefix({
      isGlobal: true,
      isOpencode: true,
      isWindowsHost: true,
      homeDir: 'C:/Users/carol',
      resolvedTarget: 'C:/Users/carol/.config/opencode',
    });
    assert.strictEqual(pathPrefix, 'C:/Users/carol/.config/opencode/');
  });

  test('Claude Code on macOS: pathPrefix still uses $HOME (unaffected)', () => {
    const pathPrefix = computePathPrefix({
      isGlobal: true,
      isOpencode: false,
      isWindowsHost: false,
      homeDir: '/Users/alice',
      resolvedTarget: '/Users/alice/.claude',
    });
    assert.strictEqual(pathPrefix, '$HOME/.claude/');
  });

  test('Local install (non-global): pathPrefix uses absolute path regardless of runtime', () => {
    const pathPrefix = computePathPrefix({
      isGlobal: false,
      isOpencode: false,
      isWindowsHost: false,
      homeDir: '/Users/alice',
      resolvedTarget: '/Users/alice/projects/foo/.claude',
    });
    assert.strictEqual(pathPrefix, '/Users/alice/projects/foo/.claude/');
  });

  test('Substitution pipeline simulation: OpenCode emits no @$HOME literal', () => {
    // This validates the same regex substitution pipeline used by
    // copyFlattenedCommands when writing OpenCode command files. We invoke the
    // real exported computePathPrefix; the regex passes mirror the install.js
    // call sites (globalClaudeRegex / globalClaudeHomeRegex).
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2831-'));
    try {
      const srcRoot = path.join(tmp, 'src');
      const targetRoot = path.join(tmp, 'home', '.config', 'opencode');
      const srcCmdDir = path.join(srcRoot, 'commands', 'gsd');
      fs.mkdirSync(srcCmdDir, { recursive: true });
      fs.mkdirSync(targetRoot, { recursive: true });

      const srcFile = path.join(srcCmdDir, 'autonomous.md');
      fs.writeFileSync(
        srcFile,
        '---\nname: autonomous\n---\n<execution_context>\n@~/.claude/get-shit-done/workflows/autonomous.md\n@$HOME/.claude/get-shit-done/references/ui-brand.md\n</execution_context>\n'
      );

      const homeDir = path.join(tmp, 'home').replace(/\\/g, '/');
      const resolvedTarget = targetRoot.replace(/\\/g, '/');
      const pathPrefix = computePathPrefix({
        isGlobal: true,
        isOpencode: true,
        isWindowsHost: false,
        homeDir,
        resolvedTarget,
      });

      let content = fs.readFileSync(srcFile, 'utf8');
      content = content.replace(/~\/\.claude\//g, pathPrefix);
      content = content.replace(/\$HOME\/\.claude\//g, pathPrefix);

      assert.ok(
        !/@\$HOME\b/.test(content),
        `output must not contain @$HOME literal; got:\n${content}`
      );
      assert.ok(
        !/\$HOME\b/.test(content),
        `output must not contain $HOME literal; got:\n${content}`
      );
      assert.ok(
        content.includes(`@${resolvedTarget}/`),
        `output should include absolute path with @ prefix; got:\n${content}`
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
