// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression tests for bug #1991
 *
 * Cline is listed in GSD documentation as a supported runtime but was
 * completely absent from bin/install.js. Running `npx get-shit-done-cc`
 * did not show Cline as an option in the interactive menu.
 *
 * Fixed: Cline is now a first-class runtime that:
 * - Appears in the interactive menu and --all flag
 * - Supports the --cline CLI flag
 * - Writes .clinerules to the install directory
 * - Installs get-shit-done/ engine with path replacement
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createTempDir, cleanup } = require('./helpers.cjs');

const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
  convertClaudeToCliineMarkdown,
  install,
  finishInstall,
} = require('../bin/install.js');

describe('Cline runtime directory mapping', () => {
  test('getDirName returns .cline for local installs', () => {
    assert.strictEqual(getDirName('cline'), '.cline');
  });

  test('getGlobalDir returns ~/.cline for global installs', () => {
    assert.strictEqual(getGlobalDir('cline'), path.join(os.homedir(), '.cline'));
  });

  test('getConfigDirFromHome returns .cline fragment', () => {
    assert.strictEqual(getConfigDirFromHome('cline', false), "'.cline'");
    assert.strictEqual(getConfigDirFromHome('cline', true), "'.cline'");
  });
});

describe('getGlobalDir (Cline)', () => {
  let originalClineConfigDir;

  beforeEach(() => {
    originalClineConfigDir = process.env.CLINE_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalClineConfigDir !== undefined) {
      process.env.CLINE_CONFIG_DIR = originalClineConfigDir;
    } else {
      delete process.env.CLINE_CONFIG_DIR;
    }
  });

  test('returns ~/.cline with no env var or explicit dir', () => {
    delete process.env.CLINE_CONFIG_DIR;
    const result = getGlobalDir('cline');
    assert.strictEqual(result, path.join(os.homedir(), '.cline'));
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('cline', '/custom/cline-path');
    assert.strictEqual(result, '/custom/cline-path');
  });

  test('respects CLINE_CONFIG_DIR env var', () => {
    process.env.CLINE_CONFIG_DIR = '~/custom-cline';
    const result = getGlobalDir('cline');
    assert.strictEqual(result, path.join(os.homedir(), 'custom-cline'));
  });

  test('explicit dir takes priority over CLINE_CONFIG_DIR', () => {
    process.env.CLINE_CONFIG_DIR = '~/from-env';
    const result = getGlobalDir('cline', '/explicit/path');
    assert.strictEqual(result, '/explicit/path');
  });

  test('does not break other runtimes', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
    assert.strictEqual(getGlobalDir('codex'), path.join(os.homedir(), '.codex'));
  });
});

describe('Cline markdown conversion', () => {
  test('convertClaudeToCliineMarkdown exists and is a function', () => {
    assert.strictEqual(typeof convertClaudeToCliineMarkdown, 'function');
  });

  test('replaces Claude Code brand with Cline', () => {
    const result = convertClaudeToCliineMarkdown('Use Claude Code to run');
    assert.ok(!result.includes('Claude Code'));
    assert.ok(result.includes('Cline'));
  });

  test('replaces .claude/ paths with .cline/', () => {
    const result = convertClaudeToCliineMarkdown('See ~/.claude/get-shit-done/');
    assert.ok(!result.includes('.claude/'), `Expected no .claude/ in: ${result}`);
    assert.ok(result.includes('.cline/'));
  });

  test('replaces CLAUDE.md references', () => {
    const result = convertClaudeToCliineMarkdown('See CLAUDE.md for config');
    assert.ok(!result.includes('CLAUDE.md'));
    assert.ok(result.includes('.clinerules'));
  });

  test('replaces .claude/skills/ with .cline/skills/', () => {
    const result = convertClaudeToCliineMarkdown('skills at .claude/skills/gsd-executor');
    assert.ok(!result.includes('.claude/skills/'));
    assert.ok(result.includes('.cline/skills/'));
  });
});

describe('Cline install (local)', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-cline-test-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('install creates .clinerules file', () => {
    install(false, 'cline');
    const clinerules = path.join(tmpDir, '.clinerules');
    assert.ok(fs.existsSync(clinerules), '.clinerules must exist after cline install');
  });

  test('.clinerules contains GSD instructions', () => {
    install(false, 'cline');
    const clinerules = path.join(tmpDir, '.clinerules');
    const content = fs.readFileSync(clinerules, 'utf8');
    assert.ok(content.includes('GSD') || content.includes('gsd'), '.clinerules must reference GSD');
  });

  test('install creates get-shit-done engine directory', () => {
    install(false, 'cline');
    const engineDir = path.join(tmpDir, 'get-shit-done');
    assert.ok(fs.existsSync(engineDir), 'get-shit-done directory must exist after install');
  });

  test('finishInstall does not throw ERR_INVALID_ARG_TYPE for cline runtime (regression: null settingsPath guard)', () => {
    // install() returns settingsPath: null for cline — finishInstall() must not call
    // writeSettings(null, ...) or it crashes with ERR_INVALID_ARG_TYPE.
    // Before fix: isCline was missing from the writeSettings guard in finishInstall().
    // After fix:  !isCline is in the guard, matching codex/copilot/cursor/windsurf/trae.
    assert.doesNotThrow(
      () => finishInstall(null, null, null, false, 'cline', false, tmpDir),
      'finishInstall must not throw when called with null settingsPath for cline runtime'
    );
  });

  test('settings.json is not written for cline runtime', () => {
    finishInstall(null, null, null, false, 'cline', false, tmpDir);
    const settingsJson = path.join(tmpDir, 'settings.json');
    assert.ok(!fs.existsSync(settingsJson), 'settings.json must not be written for cline runtime');
  });

  test('installed engine files have no leaked .claude paths', () => {
    install(false, 'cline');
    const engineDir = path.join(tmpDir, 'get-shit-done');
    if (!fs.existsSync(engineDir)) return; // skip if engine not installed

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.cjs') || entry.name.endsWith('.js')) {
          // CHANGELOG.md is a historical record and is not path-converted — skip it
          if (entry.name === 'CHANGELOG.md') continue;
          const content = fs.readFileSync(fullPath, 'utf8');
          // Check for GSD install paths that should have been substituted.
          // profile-pipeline.cjs intentionally references ~/.claude/projects (Claude Code
          // session data) as a runtime feature — that is not a leaked install path.
          const hasLeaked = /~\/\.claude\/(?:get-shit-done|commands|agents|hooks)|HOME\/\.claude\/(?:get-shit-done|commands|agents|hooks)/.test(content);
          assert.ok(!hasLeaked, `Found leaked GSD .claude install path in ${fullPath}`);
        }
      }
    }
    scanDir(engineDir);
  });
});
