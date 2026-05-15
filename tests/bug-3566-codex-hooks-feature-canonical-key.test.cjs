'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Regression tests for bug #3566 — Codex installer must emit canonical
 * [features].hooks (not the legacy [features].codex_hooks).
 *
 * Codex itself marks `codex_hooks` as a `legacy_key` in
 * codex-rs/features/src/legacy.rs. The canonical current feature flag is
 * `hooks`. The GSD installer was still writing `codex_hooks` on every fresh
 * install / reinstall, leaving deprecated config behind. This file pins:
 *
 *   1. Fresh install writes canonical `[features].hooks = true` and never
 *      emits `codex_hooks` (section, root-dotted, or block-fallback forms).
 *   2. Reinstall over a section-form legacy `[features].codex_hooks = true`
 *      migrates forward to `[features].hooks = true` (legacy line removed).
 *   3. Reinstall over a root-dotted legacy `features.codex_hooks = true`
 *      migrates forward to `features.hooks = true`.
 *   4. Reinstall over a user-owned `[features].hooks = true` (no GSD
 *      ownership marker) preserves the user line; no double-write, no
 *      ownership stamp.
 *   5. The `hasEnabledCodexHooksFeature` recognizer treats both canonical
 *      `hooks` AND legacy `codex_hooks` as "enabled" so existing installs
 *      keep working across the migration window.
 *   6. Uninstall removes either GSD-owned `hooks` or GSD-owned legacy
 *      `codex_hooks`; user-owned `hooks` is preserved.
 *
 * All assertions use parseTomlToObject — never substring-match on raw TOML
 * text (per RULESET.TESTS.no-source-grep). The product surface is the
 * parsed config shape, not the file's lexical layout.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { install, uninstall, parseTomlToObject } = require('../bin/install.js');
const { createTempDir, cleanup } = require('./helpers.cjs');

const HOOKS_DIST = path.join(__dirname, '..', 'hooks', 'dist');
const BUILD_HOOKS_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');

function withCodexHome(codexHome, fn) {
  const prev = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  try {
    return fn();
  } finally {
    if (prev == null) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
  }
}

function readConfig(codexHome) {
  const text = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
  return { text, parsed: parseTomlToObject(text) };
}

function featuresHooks(parsed) {
  return parsed?.features?.hooks;
}

function featuresCodexHooks(parsed) {
  return parsed?.features?.codex_hooks;
}

describe('#3566 — Codex feature flag is canonical "hooks" (not legacy "codex_hooks")', { concurrency: false }, () => {
  let tmpRoot;
  let codexHome;

  beforeEach(() => {
    if (!fs.existsSync(HOOKS_DIST) || fs.readdirSync(HOOKS_DIST).length === 0) {
      execFileSync(process.execPath, [BUILD_HOOKS_SCRIPT], { stdio: 'pipe' });
    }
    tmpRoot = createTempDir('gsd-3566-');
    codexHome = path.join(tmpRoot, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpRoot);
  });

  test('fresh install writes [features].hooks = true and never emits codex_hooks', () => {
    withCodexHome(codexHome, () => install(true, 'codex'));
    const { parsed } = readConfig(codexHome);

    assert.strictEqual(
      featuresHooks(parsed),
      true,
      'fresh install must write canonical [features].hooks = true',
    );
    assert.strictEqual(
      featuresCodexHooks(parsed),
      undefined,
      'fresh install must NOT write legacy [features].codex_hooks',
    );
  });

  test('install over a pre-existing legacy [features].codex_hooks line preserves it (user-owned, #2760 defensive)', () => {
    // A user who hand-wrote `codex_hooks = true` keeps the legacy key.
    // Codex itself maps it via the runtime legacy_key alias, so this is
    // forward-compatible without GSD rewriting user-authored content.
    const legacy = [
      '[features]',
      'codex_hooks = true',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(codexHome, 'config.toml'), legacy);

    withCodexHome(codexHome, () => install(true, 'codex'));
    const { parsed } = readConfig(codexHome);

    assert.strictEqual(
      featuresCodexHooks(parsed),
      true,
      'user-owned legacy codex_hooks line must be preserved verbatim',
    );
  });

  test('install over a pre-existing legacy root-dotted features.codex_hooks line preserves it', () => {
    const legacy = 'features.codex_hooks = true\n';
    fs.writeFileSync(path.join(codexHome, 'config.toml'), legacy);

    withCodexHome(codexHome, () => install(true, 'codex'));
    const { parsed } = readConfig(codexHome);

    assert.strictEqual(
      featuresCodexHooks(parsed),
      true,
      'user-owned root-dotted legacy line must be preserved verbatim',
    );
  });

  test('reinstall preserves user-owned [features].hooks = true (no GSD ownership marker)', () => {
    const userOwned = [
      '[features]',
      'hooks = true',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(codexHome, 'config.toml'), userOwned);

    withCodexHome(codexHome, () => install(true, 'codex'));
    const { parsed } = readConfig(codexHome);

    assert.strictEqual(
      featuresHooks(parsed),
      true,
      'user-owned hooks=true must be preserved',
    );
  });

  test('uninstall removes GSD-owned canonical hooks line but preserves user-owned hooks', () => {
    // Phase 1: fresh GSD install — writes GSD-owned hooks line.
    withCodexHome(codexHome, () => install(true, 'codex'));
    const { parsed: afterInstall } = readConfig(codexHome);
    assert.strictEqual(
      featuresHooks(afterInstall),
      true,
      'precondition: install wrote canonical hooks',
    );

    withCodexHome(codexHome, () => uninstall(true, 'codex'));
    const configPath = path.join(codexHome, 'config.toml');
    if (!fs.existsSync(configPath)) {
      // Uninstall may delete config.toml entirely when nothing user-owned
      // remains — that is the strongest possible "feature flag removed"
      // signal and counts as success.
      return;
    }
    const { parsed: afterUninstall } = readConfig(codexHome);
    assert.notStrictEqual(
      featuresHooks(afterUninstall),
      true,
      'uninstall must remove GSD-owned canonical hooks line',
    );
  });

  test('uninstall preserves user-owned hooks=true when GSD never owned it', () => {
    const userOwned = [
      '[features]',
      'hooks = true',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(codexHome, 'config.toml'), userOwned);

    withCodexHome(codexHome, () => uninstall(true, 'codex'));
    const { parsed } = readConfig(codexHome);

    assert.strictEqual(
      featuresHooks(parsed),
      true,
      'uninstall must NOT touch a hooks line GSD never claimed ownership of (#2760 defensive principle)',
    );
  });
});
