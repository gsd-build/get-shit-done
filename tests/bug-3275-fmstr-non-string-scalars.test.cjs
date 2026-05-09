/**
 * GSD Tools Tests — Bug #3275 (CR finding)
 *
 * Regression guard: `state-snapshot` must prefer YAML frontmatter scalar
 * values even when those scalars are numeric (e.g. current_phase: 19) or
 * boolean — not just when they are strings.
 *
 * Prior to the fix, `fmStr` checked `typeof v === 'string'`, so a numeric
 * frontmatter value like `current_phase: 19` was treated as missing and the
 * snapshot fell back to body extraction, which could return a stale or
 * incorrect value.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('state-snapshot: fmStr accepts non-string YAML scalars (#3275 CR)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('numeric current_phase in frontmatter wins over body extraction', () => {
    // YAML parses bare integers as numbers, not strings.
    // fmStr must not drop the frontmatter value when it is a number.
    const stateMd = [
      '---',
      'gsd_state_version: 1.0',
      'current_phase: 19',
      '---',
      '',
      '# Project State',
      '',
      '**Current Phase:** 03',
      '**Status:** executing',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Frontmatter numeric value must win over bold-body value
    assert.strictEqual(output.current_phase, '19', 'numeric frontmatter current_phase must be used');
  });

  test('numeric total_phases in frontmatter wins over body extraction', () => {
    const stateMd = [
      '---',
      'gsd_state_version: 1.0',
      'total_phases: 7',
      '---',
      '',
      '# Project State',
      '',
      '**Total Phases:** 3',
      '**Status:** executing',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Frontmatter says 7, body says 3 — frontmatter must win
    assert.strictEqual(output.total_phases, 7, 'numeric frontmatter total_phases must be used');
  });

  test('numeric total_plans_in_phase in frontmatter wins over body extraction', () => {
    const stateMd = [
      '---',
      'gsd_state_version: 1.0',
      'total_plans_in_phase: 5',
      '---',
      '',
      '# Project State',
      '',
      '**Total Plans in Phase:** 2',
      '**Status:** executing',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.total_plans_in_phase, 5, 'numeric frontmatter total_plans_in_phase must be used');
  });

  test('string current_phase in frontmatter still works (no regression)', () => {
    const stateMd = [
      '---',
      'gsd_state_version: 1.0',
      "current_phase: '19'",
      '---',
      '',
      '# Project State',
      '',
      '**Current Phase:** 03',
      '**Status:** executing',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.current_phase, '19', 'string frontmatter current_phase still works');
  });

  test('no-frontmatter file still extracts from body (no regression)', () => {
    const stateMd = [
      '# Project State',
      '',
      '**Current Phase:** 05',
      '**Total Phases:** 8',
      '**Status:** paused',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.current_phase, '05', 'body extraction still works without frontmatter');
    assert.strictEqual(output.total_phases, 8, 'numeric body total_phases still extracted');
  });
});
