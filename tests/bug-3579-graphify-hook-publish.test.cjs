'use strict';

/**
 * Regression tests for #3579 — graphify auto-update hook (#3347 / PR #3557)
 * was dead-on-arrival in 1.50.0-canary.x because:
 *
 *   Gap 1: scripts/build-hooks.js HOOKS_TO_COPY did not include
 *          gsd-graphify-update.sh, so it never landed in hooks/dist/ — the
 *          installer's bin/install.js readdir loop then never copied it to
 *          ~/.claude/hooks/.
 *   Gap 2: build-hooks.js (flat allowlist) and bin/install.js (readdir +
 *          isFile filter) never copied hooks/lib/gsd-graphify-rebuild.sh.
 *          Without the helper the hook resolves rebuild script → not found →
 *          exit 0 — feature silently dead.
 *
 * Beyond these two gaps the issue body lists a Gap 3 (npm tarball missing
 * the source files). Inspection of `npm pack --dry-run --json` on origin/main
 * shows both files are now present in the tarball, so the tarball-side
 * regression is not reproduced; only Gaps 1 & 2 are in scope here.
 *
 * Test strategy — three layers, each independent:
 *   1. build-hooks.js HOOKS_TO_COPY includes every top-level .sh under hooks/
 *      (allowlist-coverage drift guard). This generalizes beyond graphify so
 *      the next .sh added cannot drift back into the gap.
 *   2. After running scripts/build-hooks.js, hooks/dist/gsd-graphify-update.sh
 *      and hooks/dist/lib/gsd-graphify-rebuild.sh both exist.
 *   3. After installing into a temp config dir, both files land at
 *      hooks/gsd-graphify-update.sh and hooks/lib/gsd-graphify-rebuild.sh
 *      and the installer does not emit the "Missing expected hook" warning
 *      for gsd-graphify-update.sh.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(REPO_ROOT, 'hooks');
const DIST_DIR = path.join(HOOKS_DIR, 'dist');
const BUILD_SCRIPT = path.join(REPO_ROOT, 'scripts', 'build-hooks.js');
const INSTALL_SCRIPT = path.join(REPO_ROOT, 'bin', 'install.js');

// ─── Coverage guard ─────────────────────────────────────────────────────────

describe('#3579 Gap 1: build-hooks.js packages every top-level hooks/*.sh into dist', () => {
  // Behavior-based drift guard: rather than parsing the HOOKS_TO_COPY literal
  // out of scripts/build-hooks.js as text (a source-grep that breaks under
  // harmless refactors and fails to catch any other reason a file might get
  // dropped on the floor), we run the actual build and assert the actual
  // filesystem outcome: every top-level hooks/*.sh has a corresponding file
  // in hooks/dist/. This catches the original gap (missing allowlist entry)
  // AND any future regression that silently drops a hook for any other
  // reason (e.g. a copy that swallows errors, a syntax-validator bug, etc.).
  before(() => {
    execFileSync(process.execPath, [BUILD_SCRIPT], { encoding: 'utf-8', stdio: 'pipe' });
  });

  test('every top-level hooks/*.sh is emitted to hooks/dist/ by the build', () => {
    const topLevelSh = fs
      .readdirSync(HOOKS_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.sh'))
      .map((e) => e.name);

    assert.ok(topLevelSh.length > 0, 'expected at least one top-level hooks/*.sh in source');

    const missing = topLevelSh.filter(
      (sh) => !fs.existsSync(path.join(DIST_DIR, sh))
    );
    assert.deepStrictEqual(
      missing,
      [],
      `every top-level hooks/*.sh must be emitted to hooks/dist/ by scripts/build-hooks.js; missing from dist: ${JSON.stringify(missing)}`
    );
  });
});

// ─── build-hooks emits dist/ files ──────────────────────────────────────────

describe('#3579 Gap 1 + Gap 2: build-hooks.js populates dist with graphify hook + lib helper', () => {
  before(() => {
    execFileSync(process.execPath, [BUILD_SCRIPT], { encoding: 'utf-8', stdio: 'pipe' });
  });

  test('hooks/dist/gsd-graphify-update.sh exists after build', () => {
    assert.ok(
      fs.existsSync(path.join(DIST_DIR, 'gsd-graphify-update.sh')),
      'expected hooks/dist/gsd-graphify-update.sh to exist after build (Gap 1)'
    );
  });

  test('hooks/dist/lib/gsd-graphify-rebuild.sh exists after build', () => {
    assert.ok(
      fs.existsSync(path.join(DIST_DIR, 'lib', 'gsd-graphify-rebuild.sh')),
      'expected hooks/dist/lib/gsd-graphify-rebuild.sh to exist after build (Gap 2)'
    );
  });
});

// ─── install lands the files at the target ──────────────────────────────────

describe('#3579: installer deploys graphify hook + lib helper to target', () => {
  let tmpDir;
  let installStdout;

  before(() => {
    execFileSync(process.execPath, [BUILD_SCRIPT], { encoding: 'utf-8', stdio: 'pipe' });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3579-install-'));
    installStdout = execFileSync(
      process.execPath,
      [INSTALL_SCRIPT, '--claude', '--global', '--yes', '--no-sdk'],
      {
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, CLAUDE_CONFIG_DIR: tmpDir },
      }
    );
  });

  after(() => {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  test('hooks/gsd-graphify-update.sh present at install target', () => {
    const dest = path.join(tmpDir, 'hooks', 'gsd-graphify-update.sh');
    assert.ok(fs.existsSync(dest), `expected ${dest} to exist after install`);
  });

  test('hooks/lib/gsd-graphify-rebuild.sh present at install target', () => {
    const dest = path.join(tmpDir, 'hooks', 'lib', 'gsd-graphify-rebuild.sh');
    assert.ok(fs.existsSync(dest), `expected ${dest} to exist after install`);
  });

  test('installer does not warn about missing gsd-graphify-update.sh', () => {
    assert.ok(
      !installStdout.includes('Missing expected hook: gsd-graphify-update.sh'),
      `installer output must not warn about missing graphify hook; got:\n${installStdout}`
    );
    assert.ok(
      !installStdout.includes(
        'Skipped graphify auto-update hook — gsd-graphify-update.sh not found'
      ),
      `installer must not skip graphify hook configuration; got:\n${installStdout}`
    );
  });
});
