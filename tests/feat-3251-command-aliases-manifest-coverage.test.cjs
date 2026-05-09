'use strict';
/**
 * Regression guard for issue #3251:
 * 14 commands used in workflows must be present in command-aliases.generated.cjs.
 *
 * Asserts structurally by requiring the manifest and checking each canonical
 * command appears in either the family arrays or the non-family array.
 * Never greps the source file — see feedback_no_source_grep_tests.md.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const COMMAND_ALIASES_FILE = path.join(
  REPO_ROOT,
  'get-shit-done',
  'bin',
  'lib',
  'command-aliases.generated.cjs',
);

const MISSING_14 = [
  'check.decision-coverage-plan',
  'check.decision-coverage-verify',
  'frontmatter.get',
  'frontmatter.set',
  'learnings.copy',
  'milestone.complete',
  'phase.mvp-mode',
  'progress.bar',
  'requirements.mark-complete',
  'stats.json',
  'task.is-behavior-adding',
  'todo.match-phase',
  'uat.render-checkpoint',
  'workstream.list',
];

describe('feat-3251: command-aliases.generated.cjs manifest coverage', () => {
  let manifest;

  test('manifest file can be required without error', () => {
    try {
      manifest = require(COMMAND_ALIASES_FILE);
    } catch (err) {
      assert.fail(`Failed to require manifest: ${err.message}`);
    }
    assert.ok(manifest, 'manifest should be truthy');
  });

  test('manifest exports NON_FAMILY_COMMAND_ALIASES array', () => {
    manifest = manifest ?? require(COMMAND_ALIASES_FILE);
    assert.ok(
      Array.isArray(manifest.NON_FAMILY_COMMAND_ALIASES),
      'NON_FAMILY_COMMAND_ALIASES must be an exported array in command-aliases.generated.cjs',
    );
  });

  test('all 14 missing commands are present in the manifest (family or non-family)', () => {
    manifest = manifest ?? require(COMMAND_ALIASES_FILE);

    const allCanonicalsInManifest = new Set();

    // Collect from all family arrays
    const familyArrayKeys = [
      'STATE_COMMAND_ALIASES',
      'VERIFY_COMMAND_ALIASES',
      'INIT_COMMAND_ALIASES',
      'PHASE_COMMAND_ALIASES',
      'PHASES_COMMAND_ALIASES',
      'VALIDATE_COMMAND_ALIASES',
      'ROADMAP_COMMAND_ALIASES',
    ];
    for (const key of familyArrayKeys) {
      const arr = manifest[key];
      if (!Array.isArray(arr)) continue;
      for (const entry of arr) {
        if (entry && entry.canonical) allCanonicalsInManifest.add(entry.canonical);
      }
    }

    // Collect from non-family array
    const nonFamily = manifest.NON_FAMILY_COMMAND_ALIASES;
    if (Array.isArray(nonFamily)) {
      for (const entry of nonFamily) {
        if (entry && entry.canonical) allCanonicalsInManifest.add(entry.canonical);
      }
    }

    const missing = MISSING_14.filter((cmd) => !allCanonicalsInManifest.has(cmd));
    assert.deepStrictEqual(
      missing,
      [],
      `${missing.length} command(s) still missing from manifest: ${missing.join(', ')}`,
    );
  });

  test('each non-family entry has required fields: canonical, aliases, mutation', () => {
    manifest = manifest ?? require(COMMAND_ALIASES_FILE);
    const nonFamily = manifest.NON_FAMILY_COMMAND_ALIASES;
    if (!Array.isArray(nonFamily)) return; // caught by earlier test

    for (const entry of nonFamily) {
      assert.ok(typeof entry.canonical === 'string' && entry.canonical.length > 0,
        `entry missing canonical: ${JSON.stringify(entry)}`);
      assert.ok(Array.isArray(entry.aliases),
        `entry missing aliases array for canonical=${entry.canonical}`);
      assert.ok(typeof entry.mutation === 'boolean',
        `entry missing mutation boolean for canonical=${entry.canonical}`);
    }
  });

  test('NON_FAMILY_COMMAND_ALIASES is sorted by canonical (deterministic output)', () => {
    manifest = manifest ?? require(COMMAND_ALIASES_FILE);
    const nonFamily = manifest.NON_FAMILY_COMMAND_ALIASES;
    if (!Array.isArray(nonFamily)) return; // caught by earlier test

    const canonicals = nonFamily.map((e) => e.canonical);
    const sorted = [...canonicals].sort((a, b) => a.localeCompare(b));
    assert.deepStrictEqual(
      canonicals,
      sorted,
      'NON_FAMILY_COMMAND_ALIASES must be sorted by canonical for deterministic regeneration',
    );
  });
});
