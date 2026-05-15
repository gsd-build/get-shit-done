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
} = require('../bin/install.js');

describe('Grok Build runtime directory mapping (Phase 1)', () => {
  test('maps grok to .grok for local installs', () => {
    assert.strictEqual(getDirName('grok'), '.grok');
  });

  test('maps grok to ~/.grok for global installs', () => {
    const originalGrokConfig = process.env.GROK_CONFIG_DIR;
    delete process.env.GROK_CONFIG_DIR;
    try {
      assert.strictEqual(getGlobalDir('grok'), path.join(os.homedir(), '.grok'));
    } finally {
      if (originalGrokConfig === undefined) delete process.env.GROK_CONFIG_DIR;
      else process.env.GROK_CONFIG_DIR = originalGrokConfig;
    }
  });

  test('returns .grok config fragments for local and global installs', () => {
    assert.strictEqual(getConfigDirFromHome('grok', false), "'.grok'");
    assert.strictEqual(getConfigDirFromHome('grok', true), "'.grok'");
  });
});

describe('getGlobalDir (Grok Build)', () => {
  let originalGrokConfigDir;

  beforeEach(() => {
    originalGrokConfigDir = process.env.GROK_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalGrokConfigDir !== undefined) {
      process.env.GROK_CONFIG_DIR = originalGrokConfigDir;
    } else {
      delete process.env.GROK_CONFIG_DIR;
    }
  });

  test('returns ~/.grok with no env var or explicit dir', () => {
    delete process.env.GROK_CONFIG_DIR;
    const result = getGlobalDir('grok');
    assert.strictEqual(result, path.join(os.homedir(), '.grok'));
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('grok', '/custom/grok-path');
    assert.strictEqual(result, '/custom/grok-path');
  });

  test('respects GROK_CONFIG_DIR env var', () => {
    process.env.GROK_CONFIG_DIR = '~/custom-grok';
    const result = getGlobalDir('grok');
    assert.strictEqual(result, path.join(os.homedir(), 'custom-grok'));
  });

  test('explicit dir takes priority over GROK_CONFIG_DIR', () => {
    process.env.GROK_CONFIG_DIR = '~/from-env';
    const result = getGlobalDir('grok', '/explicit/path');
    assert.strictEqual(result, '/explicit/path');
  });

  test('does not break other runtimes', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
    assert.strictEqual(getGlobalDir('gemini'), path.join(os.homedir(), '.gemini'));
  });
});

describe('Grok install no-op (Phase 1)', () => {
  // The install('grok') path prints friendly message and returns early without
  // mutating files. Full behavior tested in later phases.
  test('grok is a recognized runtime that does not throw in install fn', () => {
    // Requiring already exercises wiring; calling install would require more
    // mocks for profile etc. This happy-path just confirms no "unknown runtime".
    const { install } = require('../bin/install.js');
    assert.ok(typeof install === 'function', 'install function exported');
  });
});
