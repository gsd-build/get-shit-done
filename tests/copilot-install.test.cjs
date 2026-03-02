/**
 * GSD Tools Tests - Copilot Install Plumbing
 *
 * Tests for Copilot runtime directory resolution, config paths,
 * and integration with the multi-runtime installer.
 *
 * Requirements: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
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

describe('getDirName (Copilot)', () => {
  test('returns .github for copilot', () => {
    assert.strictEqual(getDirName('copilot'), '.github');
  });

  test('does not break existing runtimes', () => {
    assert.strictEqual(getDirName('claude'), '.claude');
    assert.strictEqual(getDirName('opencode'), '.opencode');
    assert.strictEqual(getDirName('gemini'), '.gemini');
    assert.strictEqual(getDirName('codex'), '.codex');
  });
});

// ─── getGlobalDir ───────────────────────────────────────────────────────────────

describe('getGlobalDir (Copilot)', () => {
  test('returns ~/.copilot with no env var or explicit dir', () => {
    const original = process.env.COPILOT_CONFIG_DIR;
    try {
      delete process.env.COPILOT_CONFIG_DIR;
      const result = getGlobalDir('copilot');
      assert.strictEqual(result, path.join(os.homedir(), '.copilot'));
    } finally {
      if (original !== undefined) {
        process.env.COPILOT_CONFIG_DIR = original;
      } else {
        delete process.env.COPILOT_CONFIG_DIR;
      }
    }
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('copilot', '/custom/path');
    assert.strictEqual(result, '/custom/path');
  });

  test('respects COPILOT_CONFIG_DIR env var', () => {
    const original = process.env.COPILOT_CONFIG_DIR;
    try {
      process.env.COPILOT_CONFIG_DIR = '~/custom-copilot';
      const result = getGlobalDir('copilot');
      assert.strictEqual(result, path.join(os.homedir(), 'custom-copilot'));
    } finally {
      if (original !== undefined) {
        process.env.COPILOT_CONFIG_DIR = original;
      } else {
        delete process.env.COPILOT_CONFIG_DIR;
      }
    }
  });

  test('explicit dir takes priority over COPILOT_CONFIG_DIR', () => {
    const original = process.env.COPILOT_CONFIG_DIR;
    try {
      process.env.COPILOT_CONFIG_DIR = '~/env-path';
      const result = getGlobalDir('copilot', '/explicit/path');
      assert.strictEqual(result, '/explicit/path');
    } finally {
      if (original !== undefined) {
        process.env.COPILOT_CONFIG_DIR = original;
      } else {
        delete process.env.COPILOT_CONFIG_DIR;
      }
    }
  });

  test('does not break existing runtimes', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
    assert.strictEqual(getGlobalDir('codex'), path.join(os.homedir(), '.codex'));
  });
});

// ─── getConfigDirFromHome ───────────────────────────────────────────────────────

describe('getConfigDirFromHome (Copilot)', () => {
  test('returns .github path string for local (isGlobal=false)', () => {
    assert.strictEqual(getConfigDirFromHome('copilot', false), "'.github'");
  });

  test('returns .copilot path string for global (isGlobal=true)', () => {
    assert.strictEqual(getConfigDirFromHome('copilot', true), "'.copilot'");
  });

  test('does not break existing runtimes', () => {
    assert.strictEqual(getConfigDirFromHome('opencode', true), "'.config', 'opencode'");
    assert.strictEqual(getConfigDirFromHome('claude', true), "'.claude'");
    assert.strictEqual(getConfigDirFromHome('gemini', true), "'.gemini'");
    assert.strictEqual(getConfigDirFromHome('codex', true), "'.codex'");
  });
});

// ─── Source code integration checks ─────────────────────────────────────────────

describe('Source code integration (Copilot)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');

  test('CLI-01: --copilot flag parsing exists', () => {
    assert.ok(src.includes("args.includes('--copilot')"), '--copilot flag parsed');
  });

  test('CLI-03: --all array includes copilot', () => {
    assert.ok(
      src.includes("'claude', 'opencode', 'gemini', 'codex', 'copilot'"),
      '--all includes copilot as 5th runtime'
    );
  });

  test('CLI-06: banner text includes Copilot', () => {
    assert.ok(src.includes('Copilot by'), 'banner mentions Copilot');
  });

  test('CLI-06: help text includes --copilot', () => {
    assert.ok(src.includes('--copilot'), 'help text has --copilot option');
  });

  test('CLI-02: promptRuntime has Copilot as option 5', () => {
    assert.ok(src.includes("choice === '5'"), 'choice 5 exists');
    // Verify choice 5 maps to copilot (the line after choice === '5' should reference copilot)
    const choice5Index = src.indexOf("choice === '5'");
    const nextLines = src.substring(choice5Index, choice5Index + 100);
    assert.ok(nextLines.includes('copilot'), 'choice 5 maps to copilot');
  });

  test('CLI-02: promptRuntime has All as option 6', () => {
    assert.ok(src.includes("choice === '6'"), 'choice 6 exists');
    const choice6Index = src.indexOf("choice === '6'");
    const nextLines = src.substring(choice6Index, choice6Index + 150);
    assert.ok(nextLines.includes('copilot'), 'choice 6 (All) includes copilot');
  });

  test('isCopilot variable exists in install function', () => {
    assert.ok(src.includes("const isCopilot = runtime === 'copilot'"), 'isCopilot defined');
  });

  test('hooks are skipped for Copilot', () => {
    assert.ok(src.includes('!isCodex && !isCopilot'), 'hooks skip check includes copilot');
  });

  test('--both flag unchanged (still claude + opencode only)', () => {
    // Verify the else-if-hasBoth maps to ['claude', 'opencode'] — NOT including copilot
    const bothUsage = src.indexOf('} else if (hasBoth)');
    assert.ok(bothUsage > 0, 'hasBoth usage exists');
    const bothSection = src.substring(bothUsage, bothUsage + 200);
    assert.ok(bothSection.includes("['claude', 'opencode']"), '--both maps to claude+opencode');
    assert.ok(!bothSection.includes('copilot'), '--both does NOT include copilot');
  });
});
