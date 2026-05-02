/**
 * Tests for gsd-update-banner.js (#2795).
 *
 * The banner hook is an opt-in SessionStart consumer of the update cache that
 * gsd-check-update-worker.js writes. When a user declines GSD's statusline,
 * install.js may register this hook so update availability still surfaces in
 * runtimes that use a non-GSD statusline.
 *
 * Tests follow the typed-IR convention (CONTRIBUTING.md "Prohibited: Raw Text
 * Matching on Test Outputs"): assert on parsed JSON envelopes, not on raw
 * stdout substrings.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'gsd-update-banner.js');
const {
  buildBannerOutput,
  shouldSuppressFailureWarning,
  RATE_LIMIT_SECONDS,
} = require('../hooks/gsd-update-banner.js');

// ─── Pure function: buildBannerOutput ───────────────────────────────────────

describe('buildBannerOutput', () => {
  test('returns null when cache is missing', () => {
    const out = buildBannerOutput({
      cache: null,
      parseError: false,
      suppressFailureWarning: false,
    });
    assert.equal(out, null);
  });

  test('returns null when update_available is false', () => {
    const out = buildBannerOutput({
      cache: { update_available: false, installed: '1.40.0', latest: '1.40.0' },
      parseError: false,
      suppressFailureWarning: false,
    });
    assert.equal(out, null);
  });

  test('returns banner envelope when update_available is true', () => {
    const out = buildBannerOutput({
      cache: { update_available: true, installed: '1.39.0', latest: '1.40.0' },
      parseError: false,
      suppressFailureWarning: false,
    });
    assert.ok(out, 'expected banner envelope');
    assert.equal(typeof out.systemMessage, 'string');
    assert.ok(
      out.systemMessage.includes('1.39.0'),
      'banner should name installed version'
    );
    assert.ok(
      out.systemMessage.includes('1.40.0'),
      'banner should name latest version'
    );
    assert.ok(
      out.systemMessage.includes('/gsd-update'),
      'banner should reference /gsd-update command'
    );
  });

  test('returns failure diagnostic on parseError when not suppressed', () => {
    const out = buildBannerOutput({
      cache: null,
      parseError: true,
      suppressFailureWarning: false,
    });
    assert.ok(out, 'expected diagnostic envelope');
    assert.equal(typeof out.systemMessage, 'string');
    assert.ok(
      /check failed/i.test(out.systemMessage),
      'diagnostic should describe a failed check'
    );
  });

  test('returns null on parseError when suppressed by rate limit', () => {
    const out = buildBannerOutput({
      cache: null,
      parseError: true,
      suppressFailureWarning: true,
    });
    assert.equal(out, null);
  });

  test('falls back to "unknown" when installed/latest missing', () => {
    const out = buildBannerOutput({
      cache: { update_available: true },
      parseError: false,
      suppressFailureWarning: false,
    });
    assert.ok(out);
    assert.ok(
      out.systemMessage.includes('unknown'),
      'banner should degrade gracefully when versions are absent'
    );
  });
});

// ─── Pure function: shouldSuppressFailureWarning ────────────────────────────

describe('shouldSuppressFailureWarning', () => {
  function tmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-banner-supp-'));
  }

  test('returns false when sentinel file is missing', () => {
    const dir = tmpDir();
    try {
      const result = shouldSuppressFailureWarning(
        path.join(dir, 'no-such-file'),
        100
      );
      assert.equal(result, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns true within rate-limit window', () => {
    const dir = tmpDir();
    try {
      const f = path.join(dir, 'sentinel');
      fs.writeFileSync(f, '1000');
      const result = shouldSuppressFailureWarning(f, 1000 + RATE_LIMIT_SECONDS - 1);
      assert.equal(result, true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns false outside rate-limit window', () => {
    const dir = tmpDir();
    try {
      const f = path.join(dir, 'sentinel');
      fs.writeFileSync(f, '1000');
      const result = shouldSuppressFailureWarning(f, 1000 + RATE_LIMIT_SECONDS + 1);
      assert.equal(result, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns false when sentinel content is non-numeric', () => {
    const dir = tmpDir();
    try {
      const f = path.join(dir, 'sentinel');
      fs.writeFileSync(f, 'garbage-not-a-number');
      const result = shouldSuppressFailureWarning(f, 100);
      assert.equal(result, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── End-to-end: spawn the hook against fixture cache states ────────────────

describe('gsd-update-banner.js end-to-end', () => {
  function setupHome() {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-banner-home-'));
    fs.mkdirSync(path.join(home, '.cache', 'gsd'), { recursive: true });
    return home;
  }

  function runHook(home) {
    return spawnSync(process.execPath, [HOOK_PATH], {
      env: { ...process.env, HOME: home, USERPROFILE: home },
      encoding: 'utf8',
    });
  }

  function writeCache(home, contents) {
    fs.writeFileSync(
      path.join(home, '.cache', 'gsd', 'gsd-update-check.json'),
      typeof contents === 'string' ? contents : JSON.stringify(contents)
    );
  }

  test('exits 0 with empty stdout when cache file missing', () => {
    const home = setupHome();
    try {
      const r = runHook(home);
      assert.equal(r.status, 0, `expected exit 0, got ${r.status} stderr=${r.stderr}`);
      assert.equal(r.stdout.trim(), '');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('emits valid SessionStart JSON when update_available=true', () => {
    const home = setupHome();
    try {
      writeCache(home, {
        update_available: true,
        installed: '1.39.0',
        latest: '1.40.0',
      });
      const r = runHook(home);
      assert.equal(r.status, 0);
      const parsed = JSON.parse(r.stdout);
      assert.equal(typeof parsed.systemMessage, 'string');
      assert.ok(parsed.systemMessage.includes('1.40.0'));
      assert.ok(parsed.systemMessage.includes('/gsd-update'));
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('exits silent when update_available=false', () => {
    const home = setupHome();
    try {
      writeCache(home, {
        update_available: false,
        installed: '1.40.0',
        latest: '1.40.0',
      });
      const r = runHook(home);
      assert.equal(r.status, 0);
      assert.equal(r.stdout.trim(), '');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('emits failure diagnostic when cache JSON is malformed', () => {
    const home = setupHome();
    try {
      writeCache(home, 'not json {{{{');
      const r = runHook(home);
      assert.equal(r.status, 0);
      const parsed = JSON.parse(r.stdout);
      assert.equal(typeof parsed.systemMessage, 'string');
      assert.ok(/check failed/i.test(parsed.systemMessage));
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('suppresses repeat failure diagnostic within 24h via sentinel', () => {
    const home = setupHome();
    try {
      writeCache(home, 'not json');
      const r1 = runHook(home);
      assert.equal(
        r1.status,
        0,
        `expected exit 0, got ${r1.status} stderr=${r1.stderr}`
      );
      const parsed1 = JSON.parse(r1.stdout);
      assert.ok(/check failed/i.test(parsed1.systemMessage));

      // Sentinel should now exist so the next run is silent
      const sentinel = path.join(home, '.cache', 'gsd', 'banner-failure-warned-at');
      assert.ok(fs.existsSync(sentinel), 'first run must record the warning sentinel');

      const r2 = runHook(home);
      assert.equal(r2.status, 0);
      assert.equal(
        r2.stdout.trim(),
        '',
        'subsequent run within rate-limit window must stay silent'
      );
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('handles cache present but update_available field absent (older cache schema)', () => {
    const home = setupHome();
    try {
      writeCache(home, { installed: '1.40.0', latest: '1.40.0' });
      const r = runHook(home);
      assert.equal(r.status, 0);
      assert.equal(r.stdout.trim(), '');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

// ─── Install.js wiring: prompt + SessionStart entry registration ────────────
//
// These tests load bin/install.js as a module via GSD_TEST_MODE and assert on
// pure exported helpers. The shape mirrors how runtime-prompt-builder /
// statusline tests interact with install.js.

describe('install.js update-banner wiring', () => {
  process.env.GSD_TEST_MODE = '1';
  // Re-require fresh so test-mode exports are populated.
  const installPath = path.join(__dirname, '..', 'bin', 'install.js');
  delete require.cache[installPath];
  const installExports = require(installPath);

  test('exports buildUpdateBannerPromptText for structural prompt assertions', () => {
    assert.equal(
      typeof installExports.buildUpdateBannerPromptText,
      'function',
      'install.js must export buildUpdateBannerPromptText so tests can assert without grepping source'
    );
    const text = installExports.buildUpdateBannerPromptText();
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
    // Strip ANSI color escapes before structural assertions — the choice
    // digits are wrapped in color codes so word-boundary regex against the
    // raw text would miss them.
    const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
    // Prompt must offer at least two choices (default + opt-in).
    assert.match(stripped, /\b1\b/);
    assert.match(stripped, /\b2\b/);
  });

  test('parseUpdateBannerInput defaults to false on empty / "1"', () => {
    assert.equal(typeof installExports.parseUpdateBannerInput, 'function');
    assert.equal(installExports.parseUpdateBannerInput(''), false);
    assert.equal(installExports.parseUpdateBannerInput('  '), false);
    assert.equal(installExports.parseUpdateBannerInput('1'), false);
  });

  test('parseUpdateBannerInput returns true on "2"', () => {
    assert.equal(installExports.parseUpdateBannerInput('2'), true);
    assert.equal(installExports.parseUpdateBannerInput('2 '), true);
  });

  test('parseUpdateBannerInput accepts "y" / "yes" affirmative shortcuts', () => {
    assert.equal(installExports.parseUpdateBannerInput('y'), true);
    assert.equal(installExports.parseUpdateBannerInput('Y'), true);
    assert.equal(installExports.parseUpdateBannerInput('yes'), true);
    assert.equal(installExports.parseUpdateBannerInput('YES'), true);
  });

  test('buildUpdateBannerHookEntry produces a SessionStart hook entry', () => {
    assert.equal(typeof installExports.buildUpdateBannerHookEntry, 'function');
    const entry = installExports.buildUpdateBannerHookEntry(
      '"/usr/local/bin/node" "/home/u/.claude/hooks/gsd-update-banner.js"'
    );
    assert.ok(entry, 'expected hook entry object');
    assert.ok(Array.isArray(entry.hooks), 'entry.hooks must be an array');
    assert.equal(entry.hooks.length, 1);
    assert.equal(entry.hooks[0].type, 'command');
    assert.ok(
      entry.hooks[0].command.includes('gsd-update-banner.js'),
      'command must reference the banner hook'
    );
  });

  test('buildUpdateBannerHookEntry returns null on null command', () => {
    assert.equal(installExports.buildUpdateBannerHookEntry(null), null);
    assert.equal(installExports.buildUpdateBannerHookEntry(''), null);
  });
});
