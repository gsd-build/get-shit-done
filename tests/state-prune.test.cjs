/**
 * Tests for `state prune` command (#1970).
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

function writeStateMd(tmpDir, content) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), content);
}

function readStateMd(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
}

function archiveExists(tmpDir) {
  return fs.existsSync(path.join(tmpDir, '.planning', 'STATE-ARCHIVE.md'));
}

function readArchive(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'STATE-ARCHIVE.md'), 'utf-8');
}

describe('state prune (#1970)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('prunes decisions older than cutoff', () => {
    writeStateMd(tmpDir, [
      '# Session State',
      '',
      '**Current Phase:** 10',
      '',
      '## Decisions',
      '',
      '- [Phase 1]: Old decision',
      '- [Phase 3]: Old decision 3',
      '- [Phase 8]: Recent decision',
      '- [Phase 10]: Current decision',
      '',
    ].join('\n'));

    const result = runGsdTools('state prune --keep-recent 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.pruned, true);
    assert.strictEqual(output.cutoff_phase, 7);

    const newState = readStateMd(tmpDir);
    assert.match(newState, /\[Phase 8\]: Recent decision/);
    assert.match(newState, /\[Phase 10\]: Current decision/);
    assert.doesNotMatch(newState, /\[Phase 1\]: Old decision/);
    assert.doesNotMatch(newState, /\[Phase 3\]: Old decision 3/);

    assert.ok(archiveExists(tmpDir), 'STATE-ARCHIVE.md should exist');
    const archive = readArchive(tmpDir);
    assert.match(archive, /\[Phase 1\]: Old decision/);
    assert.match(archive, /\[Phase 3\]: Old decision 3/);
  });

  test('--dry-run reports what would be pruned without modifying STATE.md', () => {
    const originalContent = [
      '# Session State',
      '',
      '**Current Phase:** 10',
      '',
      '## Decisions',
      '',
      '- [Phase 1]: Old decision',
      '- [Phase 2]: Another old decision',
      '- [Phase 9]: Recent decision',
      '',
    ].join('\n');
    writeStateMd(tmpDir, originalContent);

    const result = runGsdTools('state prune --keep-recent 3 --dry-run', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.pruned, false);
    assert.strictEqual(output.dry_run, true);
    assert.strictEqual(output.total_would_archive, 2);

    // STATE.md should be unchanged
    const unchanged = readStateMd(tmpDir);
    assert.strictEqual(unchanged, originalContent);

    // No archive file should be created
    assert.ok(!archiveExists(tmpDir), 'dry-run should not create archive');
  });

  test('prunes resolved blockers older than cutoff', () => {
    writeStateMd(tmpDir, [
      '# Session State',
      '',
      '**Current Phase:** 10',
      '',
      '## Blockers',
      '',
      '- ~~Phase 1: Old resolved issue~~',
      '- [RESOLVED] Phase 2: Another old issue',
      '- Phase 9: Current blocker (unresolved)',
      '',
    ].join('\n'));

    const result = runGsdTools('state prune --keep-recent 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.pruned, true);
    const blockerSection = output.sections.find(s => /Blockers/i.test(s.section));
    assert.ok(blockerSection, 'should report Blockers section');
    assert.strictEqual(blockerSection.entries_archived, 2);

    const newState = readStateMd(tmpDir);
    assert.match(newState, /Phase 9: Current blocker/);
    assert.doesNotMatch(newState, /Phase 1: Old resolved issue/);
  });

  test('returns pruned:false when nothing to prune', () => {
    writeStateMd(tmpDir, [
      '# Session State',
      '',
      '**Current Phase:** 2',
      '',
      '## Decisions',
      '',
      '- [Phase 1]: Recent decision',
      '- [Phase 2]: Current decision',
      '',
    ].join('\n'));

    const result = runGsdTools('state prune --keep-recent 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.pruned, false);
  });

  describe('Performance Metrics table pruning (#2087)', () => {
    test('prunes old metric table rows by phase number', () => {
      writeStateMd(tmpDir, [
        '# Session State',
        '',
        '**Current Phase:** 10',
        '',
        '## Performance Metrics',
        '',
        '| Phase | Plans | Duration | Status |',
        '|-------|-------|----------|--------|',
        '| 1 | 3/3 | 2h | Complete |',
        '| 2 | 2/2 | 1h | Complete |',
        '| 3 | 4/4 | 3h | Complete |',
        '| 8 | 5/5 | 4h | Complete |',
        '| 9 | 2/2 | 1h | Complete |',
        '| 10 | 1/3 | - | In Progress |',
        '',
      ].join('\n'));

      const result = runGsdTools('state prune --keep-recent 3', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const output = JSON.parse(result.output);
      assert.strictEqual(output.pruned, true);

      const newState = readStateMd(tmpDir);
      // Should keep phases 8, 9, 10 (within keep-recent of phase 10, cutoff=7)
      assert.match(newState, /\| 8 \|/);
      assert.match(newState, /\| 9 \|/);
      assert.match(newState, /\| 10 \|/);
      // Should prune phases 1, 2, 3
      assert.doesNotMatch(newState, /\| 1 \|.*Complete/);
      assert.doesNotMatch(newState, /\| 2 \|.*Complete/);
      assert.doesNotMatch(newState, /\| 3 \|.*Complete/);
      // Header row should be preserved
      assert.match(newState, /\| Phase \| Plans \| Duration \| Status \|/);
      assert.match(newState, /\|-------|-------|----------|--------\|/);
    });

    test('--dry-run reports metrics rows that would be pruned', () => {
      writeStateMd(tmpDir, [
        '# Session State',
        '',
        '**Current Phase:** 8',
        '',
        '## Performance Metrics',
        '',
        '| Phase | Plans | Status |',
        '|-------|-------|--------|',
        '| 1 | 3/3 | Complete |',
        '| 2 | 2/2 | Complete |',
        '| 6 | 4/4 | Complete |',
        '| 7 | 2/2 | Complete |',
        '| 8 | 1/3 | In Progress |',
        '',
      ].join('\n'));

      const result = runGsdTools('state prune --keep-recent 3 --dry-run', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const output = JSON.parse(result.output);
      assert.strictEqual(output.dry_run, true);
      assert.ok(output.total_would_archive > 0, 'should report rows to archive');
      const metricsSection = output.sections.find(s => /Metrics/i.test(s.section));
      assert.ok(metricsSection, 'should include Performance Metrics section');
      assert.strictEqual(metricsSection.entries_would_archive, 2);
    });

    test('does not touch prose lines outside the metrics table', () => {
      writeStateMd(tmpDir, [
        '# Session State',
        '',
        '**Current Phase:** 10',
        '',
        '## Performance Metrics',
        '',
        'Overall project velocity is improving.',
        '',
        '| Phase | Plans | Status |',
        '|-------|-------|--------|',
        '| 1 | 3/3 | Complete |',
        '| 9 | 2/2 | Complete |',
        '| 10 | 1/3 | In Progress |',
        '',
        'Average duration: 2.5 hours per phase.',
        '',
      ].join('\n'));

      const result = runGsdTools('state prune --keep-recent 3', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const newState = readStateMd(tmpDir);
      assert.match(newState, /Overall project velocity is improving\./);
      assert.match(newState, /Average duration: 2\.5 hours per phase\./);
      assert.doesNotMatch(newState, /\| 1 \|/);
      assert.match(newState, /\| 9 \|/);
    });

    test('preserves table when no rows are old enough to prune', () => {
      writeStateMd(tmpDir, [
        '# Session State',
        '',
        '**Current Phase:** 5',
        '',
        '## Performance Metrics',
        '',
        '| Phase | Plans | Status |',
        '|-------|-------|--------|',
        '| 3 | 3/3 | Complete |',
        '| 4 | 2/2 | Complete |',
        '| 5 | 1/3 | In Progress |',
        '',
      ].join('\n'));

      const result = runGsdTools('state prune --keep-recent 3', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const newState = readStateMd(tmpDir);
      assert.match(newState, /\| 3 \|/);
      assert.match(newState, /\| 4 \|/);
      assert.match(newState, /\| 5 \|/);
    });
  });
});
