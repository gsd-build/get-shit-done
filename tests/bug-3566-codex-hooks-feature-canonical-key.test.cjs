'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { install, uninstall } = require('../bin/install.js');

const BUILD_HOOKS_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');

before(() => {
  execFileSync(process.execPath, [BUILD_HOOKS_SCRIPT], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
});

function withCodexHome(codexHome, fn) {
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  try {
    return fn();
  } finally {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
  }
}

function readConfig(codexHome) {
  return fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
}

function writeConfig(codexHome, content) {
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'config.toml'), content, 'utf8');
}

describe('#3566 — Codex installer uses canonical features.hooks key', () => {
  let tmpDir;
  let codexHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3566-'));
    codexHome = path.join(tmpDir, '.codex');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('fresh install writes [features].hooks and never emits legacy codex_hooks', () => {
    withCodexHome(codexHome, () => install(true, 'codex'));

    const content = readConfig(codexHome);
    assert.match(content, /^\[features\]\nhooks = true$/m);
    assert.doesNotMatch(content, /codex_hooks/);
  });

  test('reinstall over legacy codex_hooks normalizes forward to hooks', () => {
    writeConfig(codexHome, [
      '[features]',
      'codex_hooks = true',
      '',
    ].join('\n'));

    withCodexHome(codexHome, () => install(true, 'codex'));

    const content = readConfig(codexHome);
    assert.match(content, /^\[features\]\nhooks = true$/m);
    assert.doesNotMatch(content, /codex_hooks/);
  });

  test('uninstall preserves user-owned hooks without claiming ownership', () => {
    writeConfig(codexHome, [
      '[features]',
      'hooks = true',
      'user_feature = true',
      '',
    ].join('\n'));

    withCodexHome(codexHome, () => {
      install(true, 'codex');
      uninstall(true, 'codex');
    });

    const content = readConfig(codexHome);
    assert.match(content, /^\[features\]\nhooks = true$/m);
    assert.match(content, /^user_feature = true$/m);
    assert.doesNotMatch(content, /GSD hooks ownership/);
    assert.doesNotMatch(content, /codex_hooks/);
  });
});
