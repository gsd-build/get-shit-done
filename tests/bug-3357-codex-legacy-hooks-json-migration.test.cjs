/**
 * Regression test for bug #3357.
 *
 * Older Codex installs used hooks.json for SessionStart hooks. Current Codex
 * installs write config.toml hooks. Reinstalling must remove only GSD-managed
 * legacy hooks.json entries so users do not end up with duplicate GSD hooks.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { install, parseTomlToObject } = require('../bin/install.js');
const { createTempDir, cleanup } = require('./helpers.cjs');

function withCodexHome(codexHome, fn) {
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  try {
    return fn();
  } finally {
    if (previousCodexHome == null) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
  }
}

function legacyGsdHook(codexHome) {
  return {
    hooks: [{
      type: 'command',
      command: `node "${path.join(codexHome, 'hooks', 'gsd-check-update.js')}"`,
    }],
  };
}

function userHook() {
  return {
    hooks: [{
      type: 'command',
      command: 'node "/Users/example/bin/user-hook.js"',
    }],
  };
}

function tomlGsdHookCount(codexHome) {
  const parsed = parseTomlToObject(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'));
  const sessionStart = parsed.hooks?.SessionStart ?? [];
  return sessionStart
    .flatMap((entry) => Array.isArray(entry.hooks) ? entry.hooks : [])
    .filter((hook) => typeof hook.command === 'string' && hook.command.includes('gsd-check-update.js'))
    .length;
}

describe('#3357 — Codex install removes legacy GSD hooks.json entries', { concurrency: false }, () => {
  let tmpRoot;
  let codexHome;

  beforeEach(() => {
    tmpRoot = createTempDir('gsd-3357-');
    codexHome = path.join(tmpRoot, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpRoot);
  });

  test('removes hooks.json when it only contained the legacy GSD SessionStart hook', () => {
    fs.writeFileSync(
      path.join(codexHome, 'hooks.json'),
      JSON.stringify({ SessionStart: [legacyGsdHook(codexHome)] }, null, 2),
    );

    withCodexHome(codexHome, () => install(true, 'codex'));

    assert.equal(fs.existsSync(path.join(codexHome, 'hooks.json')), false);
    assert.equal(tomlGsdHookCount(codexHome), 1);
  });

  test('preserves user hooks.json entries while removing the legacy GSD hook', () => {
    const userOwnedSameBasenameHook = {
      hooks: [{
        type: 'command',
        command: 'node "/Users/example/bin/gsd-check-update.js"',
      }],
    };
    fs.writeFileSync(
      path.join(codexHome, 'hooks.json'),
      JSON.stringify({ SessionStart: [legacyGsdHook(codexHome), userHook(), userOwnedSameBasenameHook] }, null, 2),
    );

    withCodexHome(codexHome, () => install(true, 'codex'));

    const hooksJson = JSON.parse(fs.readFileSync(path.join(codexHome, 'hooks.json'), 'utf8'));
    const commands = hooksJson.SessionStart.flatMap((entry) => entry.hooks).map((hook) => hook.command);
    assert.deepEqual(commands, [
      'node "/Users/example/bin/user-hook.js"',
      'node "/Users/example/bin/gsd-check-update.js"',
    ]);
    assert.equal(tomlGsdHookCount(codexHome), 1);
  });
});
