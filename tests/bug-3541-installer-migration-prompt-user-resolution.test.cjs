/**
 * Regression test for #3541: first-time-baseline installer migration
 * `prompt-user` actions threw hard with no resolution path, making
 * `/gsd-update` unrecoverable when leftover `gsd-*` files were classified
 * as `stale-gsd-looking`.
 *
 * Fix shape (per triage brief):
 *   A. Classify-and-default for safe categories - stale SDK build
 *      artifacts default to "remove"; user-facing skills/gsd-asterisk/SKILL.md
 *      defaults to "keep". Each resolution is logged.
 *   B. Improved error message when an unresolved prompt-user action
 *      remains: lists choices, suggests the resolution path, groups
 *      blocked paths by reason.
 *
 * Behavioural test — exercises the actual installer migration code paths
 * via the public `runInstallerMigrations` + new resolver entry points.
 * No source-grep (per CONTEXT.md L98–101 / RULESET.TESTS).
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  runInstallerMigrations,
} = require('../get-shit-done/bin/lib/installer-migrations.cjs');
const {
  assertInstallerMigrationsUnblocked,
  resolveInstallerMigrationPromptsForNonTty,
} = require('../get-shit-done/bin/lib/installer-migration-report.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function writeFile(root, relPath, content) {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function writeManifest(root, files) {
  fs.writeFileSync(
    path.join(root, 'gsd-file-manifest.json'),
    JSON.stringify({
      version: '1.41.2',
      timestamp: '2026-05-10T00:00:00.000Z',
      mode: 'full',
      files,
    }, null, 2),
    'utf8'
  );
}

describe('#3541: installer migration prompt-user non-TTY resolution', { concurrency: false }, () => {
  let configDir;

  beforeEach(() => {
    configDir = createTempDir('gsd-3541-');
  });

  afterEach(() => {
    cleanup(configDir);
  });

  test('Test A: non-TTY default resolution removes stale SDK artifacts and keeps user skills', () => {
    // Stale SDK build artifact: replicates the 1.41.2 → 1.42.2 upgrade where
    // 24 stale `get-shit-done/sdk/{dist,src}/gsd-*` files leaked into the
    // baseline because the new manifest no longer classifies them as managed.
    writeFile(configDir, 'get-shit-done/sdk/dist/gsd-old-bundle.js', 'stale sdk bundle\n');
    // User-facing skill: replicates `skills/gsd-roadmap/SKILL.md` from the
    // same incident — user-owned content that must be preserved.
    writeFile(configDir, 'skills/gsd-roadmap/SKILL.md', '# Roadmap skill\nuser content\n');

    // Plant an empty manifest so both files classify as `stale-gsd-looking`
    // (they look like GSD artifacts but are not manifest-managed).
    writeManifest(configDir, {});

    const result = runInstallerMigrations({
      configDir,
      runtime: 'claude',
      scope: 'global',
      baselineScan: true,
    });

    // Confirm the migration framework classified both as prompt-user
    // blockers — this is the precondition the fix resolves.
    const blockedPaths = (result.blocked || []).map((a) => a.relPath).sort();
    assert.deepEqual(
      blockedPaths,
      ['get-shit-done/sdk/dist/gsd-old-bundle.js', 'skills/gsd-roadmap/SKILL.md'],
      'precondition: both stale-looking files should be flagged for explicit user choice'
    );

    // Now run the non-TTY resolver. It must classify-and-default each
    // blocked action and return a structured log of resolutions.
    const resolved = resolveInstallerMigrationPromptsForNonTty(result, { isTty: false });

    assert.ok(Array.isArray(resolved.resolutions), 'resolver returns a resolutions log');
    assert.equal(
      resolved.resolutions.length,
      2,
      'one resolution entry per blocked action'
    );

    const byPath = new Map(resolved.resolutions.map((r) => [r.relPath, r]));
    const sdkResolution = byPath.get('get-shit-done/sdk/dist/gsd-old-bundle.js');
    const skillResolution = byPath.get('skills/gsd-roadmap/SKILL.md');

    assert.ok(sdkResolution, 'SDK artifact resolution logged');
    assert.equal(sdkResolution.choice, 'remove', 'stale SDK build artifact defaults to remove');
    assert.equal(sdkResolution.category, 'stale-sdk-build-artifact');

    assert.ok(skillResolution, 'user skill resolution logged');
    assert.equal(skillResolution.choice, 'keep', 'user-facing skill defaults to keep');
    assert.equal(skillResolution.category, 'user-facing-skill');

    // After resolution there must be no blocked actions remaining; the
    // assertion gatekeeper must not throw.
    assert.equal(
      (resolved.result.blocked || []).length,
      0,
      'all prompt-user actions resolved'
    );
    assert.doesNotThrow(() => assertInstallerMigrationsUnblocked(resolved.result));
  });

  test('Test B: error message groups paths by reason and suggests a resolution path', () => {
    // Build a synthetic result with two blocked prompt-user actions of
    // distinct reasons. The improved error message must (1) list the
    // documented choices, (2) suggest the non-interactive resolution
    // path, (3) group blocked paths by reason rather than emit each path
    // individually.
    const blocked = [
      {
        type: 'prompt-user',
        relPath: 'get-shit-done/sdk/dist/gsd-a.js',
        reason: 'GSD-looking file is not proven manifest-managed and needs explicit user choice',
        classification: 'stale-gsd-looking',
        prompt: 'Choose whether to remove this stale-looking GSD artifact or keep it as user-owned.',
        choices: ['keep', 'remove'],
      },
      {
        type: 'prompt-user',
        relPath: 'get-shit-done/sdk/dist/gsd-b.js',
        reason: 'GSD-looking file is not proven manifest-managed and needs explicit user choice',
        classification: 'stale-gsd-looking',
        prompt: 'Choose whether to remove this stale-looking GSD artifact or keep it as user-owned.',
        choices: ['keep', 'remove'],
      },
    ];

    let captured = null;
    try {
      assertInstallerMigrationsUnblocked({ blocked });
      assert.fail('expected assertInstallerMigrationsUnblocked to throw');
    } catch (err) {
      captured = err;
    }

    assert.ok(captured instanceof Error);
    const message = captured.message;

    // (a) Documented choices listed.
    assert.match(message, /keep/, 'error message lists `keep` choice');
    assert.match(message, /remove/, 'error message lists `remove` choice');

    // (b) Suggests the resolution path. The fix introduces an
    // environment variable as the documented non-interactive resolution
    // surface — the message must point users at it.
    assert.match(
      message,
      /GSD_INSTALLER_MIGRATION_RESOLVE/,
      'error message suggests the non-interactive resolution env var'
    );

    // (c) Paths grouped by reason — two paths sharing the same reason
    // appear under one summary count, not as two separate path lines.
    // The message must include a `2 files` (or similar) grouped summary
    // and must NOT list each individual relPath in the top-level message.
    assert.match(
      message,
      /2 (files?|paths?|artifacts?)/,
      'error message groups blocked paths into a count summary'
    );

    // Structured surface: the thrown error must carry a `blockedByReason`
    // map so callers can render their own report without re-parsing.
    assert.ok(captured.blockedByReason, 'error carries blockedByReason data');
    const reasons = Object.keys(captured.blockedByReason);
    assert.equal(reasons.length, 1, 'two same-reason paths grouped under one key');
    assert.equal(captured.blockedByReason[reasons[0]].length, 2);
  });
});
