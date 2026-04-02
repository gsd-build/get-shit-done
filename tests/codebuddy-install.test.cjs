/**
 * GSD Tools Tests - Codebuddy Install Plumbing
 *
 * Tests for Codebuddy runtime directory resolution, config paths,
 * and integration with the multi-runtime installer.
 *
 * Codebuddy is Claude Code-compatible: same directory structure, same
 * agent frontmatter, same tool names. Only path mappings and labels differ.
 *
 * Requirements: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
} = require('../bin/install.js');

// ─── getDirName ─────────────────────────────────────────────────────────────────

describe('getDirName (Codebuddy)', () => {
  test('returns .codebuddy for codebuddy', () => {
    assert.strictEqual(getDirName('codebuddy'), '.codebuddy');
  });

  test('does not break existing runtimes', () => {
    assert.strictEqual(getDirName('claude'), '.claude');
    assert.strictEqual(getDirName('opencode'), '.opencode');
    assert.strictEqual(getDirName('gemini'), '.gemini');
    assert.strictEqual(getDirName('codex'), '.codex');
    assert.strictEqual(getDirName('copilot'), '.github');
    assert.strictEqual(getDirName('cursor'), '.cursor');
    assert.strictEqual(getDirName('windsurf'), '.windsurf');
  });
});

// ─── getGlobalDir ───────────────────────────────────────────────────────────────

describe('getGlobalDir (Codebuddy)', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = process.env.CODEBUDDY_CONFIG_DIR;
    delete process.env.CODEBUDDY_CONFIG_DIR;
  });

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.CODEBUDDY_CONFIG_DIR = savedEnv;
    } else {
      delete process.env.CODEBUDDY_CONFIG_DIR;
    }
  });

  test('returns ~/.codebuddy with no env var or explicit dir', () => {
    const result = getGlobalDir('codebuddy');
    assert.strictEqual(result, path.join(os.homedir(), '.codebuddy'));
  });

  test('respects CODEBUDDY_CONFIG_DIR env var', () => {
    const customDir = path.join(os.homedir(), 'custom-codebuddy');
    process.env.CODEBUDDY_CONFIG_DIR = customDir;
    const result = getGlobalDir('codebuddy');
    assert.strictEqual(result, customDir);
  });

  test('explicit dir overrides CODEBUDDY_CONFIG_DIR', () => {
    process.env.CODEBUDDY_CONFIG_DIR = path.join(os.homedir(), 'from-env');
    const explicit = path.join(os.homedir(), 'explicit-codebuddy');
    const result = getGlobalDir('codebuddy', explicit);
    assert.strictEqual(result, explicit);
  });

  test('expands tilde in CODEBUDDY_CONFIG_DIR', () => {
    process.env.CODEBUDDY_CONFIG_DIR = '~/custom-codebuddy';
    const result = getGlobalDir('codebuddy');
    assert.strictEqual(result, path.join(os.homedir(), 'custom-codebuddy'));
  });

  test('expands tilde in explicit dir', () => {
    const result = getGlobalDir('codebuddy', '~/my-codebuddy');
    assert.strictEqual(result, path.join(os.homedir(), 'my-codebuddy'));
  });

  test('does not break existing runtimes', () => {
    assert.strictEqual(getGlobalDir('codex'), path.join(os.homedir(), '.codex'));
    assert.strictEqual(getGlobalDir('windsurf'), path.join(os.homedir(), '.windsurf'));
  });
});

// ─── getConfigDirFromHome ───────────────────────────────────────────────────────

describe('getConfigDirFromHome (Codebuddy)', () => {
  test('returns .codebuddy path string for global (isGlobal=true)', () => {
    assert.strictEqual(getConfigDirFromHome('codebuddy', true), "'.codebuddy'");
  });

  test('returns .codebuddy path string for local (isGlobal=false)', () => {
    assert.strictEqual(getConfigDirFromHome('codebuddy', false), "'.codebuddy'");
  });

  test('does not break existing runtimes', () => {
    assert.strictEqual(getConfigDirFromHome('claude', true), "'.claude'");
    assert.strictEqual(getConfigDirFromHome('gemini', true), "'.gemini'");
    assert.strictEqual(getConfigDirFromHome('codex', true), "'.codex'");
    assert.strictEqual(getConfigDirFromHome('opencode', true), "'.config', 'opencode'");
    assert.strictEqual(getConfigDirFromHome('copilot', true), "'.copilot'");
  });
});

// ─── Source code integration checks ─────────────────────────────────────────────

describe('Source code integration (Codebuddy)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');

  test('CLI-01: --codebuddy flag parsing exists', () => {
    assert.ok(src.includes("args.includes('--codebuddy')"), '--codebuddy flag parsed');
  });

  test('CLI-03: --all array includes codebuddy', () => {
    assert.ok(
      src.includes("'codebuddy'") && src.includes('selectedRuntimes = ['),
      '--all includes codebuddy runtime'
    );
  });

  test('CLI-06: banner/label text includes Codebuddy', () => {
    assert.ok(src.includes('Codebuddy'), 'source mentions Codebuddy');
  });

  test('CLI-06: help text includes --codebuddy', () => {
    assert.ok(src.includes('--codebuddy'), 'source has --codebuddy option');
  });

  test('CLI-02: promptRuntime runtimeMap has Codebuddy as option 9', () => {
    assert.ok(src.includes("'9': 'codebuddy'"), 'runtimeMap has 9 -> codebuddy');
  });

  test('CLI-02: promptRuntime allRuntimes array includes codebuddy', () => {
    const allMatch = src.match(/const allRuntimes = \[([^\]]+)\]/);
    assert.ok(allMatch && allMatch[1].includes('codebuddy'), 'allRuntimes includes codebuddy');
  });

  test('CLI-02: "All" shortcut uses option 0', () => {
    assert.ok(src.includes("input === '0'"), '"All" shortcut is option 0');
    assert.ok(!src.includes("input === '9'"), '"All" shortcut is no longer option 9');
  });

  test('isCodebuddy variable exists in install function', () => {
    assert.ok(src.includes("const isCodebuddy = runtime === 'codebuddy'"), 'isCodebuddy defined');
  });

  test('--both flag unchanged (still claude + opencode only)', () => {
    const bothUsage = src.indexOf('} else if (hasBoth)');
    assert.ok(bothUsage > 0, 'hasBoth usage exists');
    const bothSection = src.substring(bothUsage, bothUsage + 200);
    assert.ok(bothSection.includes("['claude', 'opencode']"), '--both maps to claude+opencode');
    assert.ok(!bothSection.includes('codebuddy'), '--both does NOT include codebuddy');
  });
});

// ─── Integration: three functions work together ─────────────────────────────────

describe('Integration (Codebuddy)', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = process.env.CODEBUDDY_CONFIG_DIR;
    delete process.env.CODEBUDDY_CONFIG_DIR;
  });

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.CODEBUDDY_CONFIG_DIR = savedEnv;
    } else {
      delete process.env.CODEBUDDY_CONFIG_DIR;
    }
  });

  test('getDirName, getGlobalDir, and getConfigDirFromHome are consistent', () => {
    const dirName = getDirName('codebuddy');
    const globalDir = getGlobalDir('codebuddy');
    const configDirGlobal = getConfigDirFromHome('codebuddy', true);
    const configDirLocal = getConfigDirFromHome('codebuddy', false);

    // All reference .codebuddy
    assert.ok(dirName.includes('codebuddy'), `dirName=${dirName}`);
    assert.ok(globalDir.includes('codebuddy'), `globalDir=${globalDir}`);
    assert.ok(configDirGlobal.includes('codebuddy'), `configDirGlobal=${configDirGlobal}`);
    assert.ok(configDirLocal.includes('codebuddy'), `configDirLocal=${configDirLocal}`);

    // Global dir is under homedir
    assert.ok(globalDir.startsWith(os.homedir()), `globalDir should be under homedir`);
  });
});
