'use strict';

/**
 * Regression tests for the three milestone.complete bugs documented in the
 * accompanying PR:
 *
 *   1. Header duplication — `## v5.0 v5.0` when --name is omitted
 *      (milestoneName falls back to version, both slots filled identically).
 *
 *   2. Phase-range leakage — when the active milestone section in ROADMAP.md
 *      uses checkbox bullets (`- [ ] **Phase 26: ...**`) instead of headings
 *      (`### Phase 26: ...`), the phase pattern matches zero entries, the
 *      passAll fallback fires, and every phase dir on disk gets folded into
 *      the milestone.
 *
 *   3. One-liner extraction noise — the regex matched the first **bold**
 *      span after *any* heading level, so SUMMARYs whose title was not
 *      immediately followed by bold (e.g. blockquote, or `## Objective`
 *      and prose first) leaked deviation-section fragments like
 *      `Found during:` or `1. [Rule 3 - Blocking] ...` as the
 *      "one-liner" accomplishment.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');
const { extractOneLinerFromBody } = require('../get-shit-done/bin/lib/core.cjs');

function writeRoadmap(tmpDir, content) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);
}

function writeState(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `# STATE\n\n## Current Position\n\n## Project Reference\n`,
  );
}

function mkPhaseDir(tmpDir, name, opts = {}) {
  const p = path.join(tmpDir, '.planning', 'phases', name);
  fs.mkdirSync(p, { recursive: true });
  if (opts.oneLiner) {
    fs.writeFileSync(
      path.join(p, `${name.split('-')[0]}-01-SUMMARY.md`),
      `---\none-liner: ${opts.oneLiner}\n---\n# Summary\n`,
    );
  }
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('milestone.complete header duplication (bug 1)', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('omitting --name does not produce duplicated version header', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    writeState(tmpDir);

    const result = runGsdTools('milestone complete v1.0', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(
      !milestones.includes('## v1.0 v1.0'),
      `expected no duplicated version header; got:\n${milestones.split('\n').slice(0, 5).join('\n')}`,
    );
    assert.ok(milestones.includes('## v1.0 (Shipped:'));
  });

  test('--name still renders correctly (no regression)', () => {
    writeRoadmap(tmpDir, `# Roadmap v1.0\n`);
    writeState(tmpDir);

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('## v1.0 MVP (Shipped:'));
    assert.ok(!milestones.includes('## v1.0 v1.0'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('milestone.complete phase-range leakage (bug 2)', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('checkbox-bullet phase declarations are matched (no passAll leak)', () => {
    // ROADMAP whose v1.0 section declares phases as bullets, with an
    // unrelated phase 99 in a later section that must NOT leak in.
    writeRoadmap(tmpDir, [
      '# Roadmap',
      '',
      '## Milestones',
      '',
      '- 🚧 **v1.0** — Phases 1-2',
      '',
      '## Phases',
      '',
      '### 🚧 Active — v1.0 milestone-foo',
      '',
      '- [ ] **Phase 1: foundation** — set up things',
      '- [ ] **Phase 2: api** — wire api',
      '',
      '### 🚧 Standalone outside v1.0 scope',
      '',
      '- [x] **Phase 99: unrelated** — should NOT count toward v1.0',
      '',
      '## Phase Details',
      '',
      '### Phase 99: unrelated',
      '**Goal:** Not part of v1.0',
      '',
    ].join('\n'));
    writeState(tmpDir);
    mkPhaseDir(tmpDir, '01-foundation', { oneLiner: 'one-liner-1' });
    mkPhaseDir(tmpDir, '02-api', { oneLiner: 'one-liner-2' });
    mkPhaseDir(tmpDir, '99-unrelated', { oneLiner: 'leaked-from-phase-99' });

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('one-liner-1'), 'phase 1 one-liner should be present');
    assert.ok(milestones.includes('one-liner-2'), 'phase 2 one-liner should be present');
    assert.ok(
      !milestones.includes('leaked-from-phase-99'),
      'phase 99 was outside v1.0 scope — its one-liner must not leak in',
    );

    // Also verify phase count in JSON output is 2, not 3.
    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 2, 'should count 2 phases (1 + 2), not 3');
  });

  test('heading-style phase declarations still match (no regression)', () => {
    writeRoadmap(tmpDir, [
      '# Roadmap',
      '',
      '## 🚧 Active — v1.0',
      '',
      '### Phase 1: Foundation',
      '**Goal:** Setup',
      '',
    ].join('\n'));
    writeState(tmpDir);
    mkPhaseDir(tmpDir, '01-foundation', { oneLiner: 'still-works' });

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 1);
    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('still-works'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('extractOneLinerFromBody — deviation-fragment leak (bug 3)', () => {
  test('does NOT extract bold from a later sub-heading (Deviation block)', () => {
    const body = [
      '# Phase 26 Plan 03',
      '',
      '## Objective',
      '',
      'Some prose.',
      '',
      '## Deviations',
      '',
      '### Deviation 1 — Atomic per-task commits',
      '',
      '**Found during:** Task 3 (the plan\'s combined-commit step)',
      '**Issue:** Plan asked for combined commit.',
      '',
    ].join('\n');
    assert.strictEqual(extractOneLinerFromBody(body), null);
  });

  test('does NOT extract bold from Auto-fixed Issues sub-heading', () => {
    const body = [
      '# Phase 27 Plan 01',
      '',
      '## Performance',
      '',
      'Stats here.',
      '',
      '### Auto-fixed Issues',
      '',
      '**1. [Rule 3 - Blocking] Lockstep mock-layer patches to keep tsc clean**',
      '- **Found during:** Task 1',
      '',
    ].join('\n');
    assert.strictEqual(extractOneLinerFromBody(body), null);
  });

  test('extracts blockquote-style one-liner (template variant)', () => {
    const body = [
      '# Phase 26 Plan 03: Add series.* i18n namespace (EN + HE) Summary',
      '',
      '> Bilingual copywriting contract for the v5.0 series-builder under a new top-level namespace.',
      '',
      '## Objective',
      '',
    ].join('\n');
    assert.strictEqual(
      extractOneLinerFromBody(body),
      'Bilingual copywriting contract for the v5.0 series-builder under a new top-level namespace.',
    );
  });

  test('bare-bold one-liner still works (no regression)', () => {
    const body = '# Title\n\n**Real prose here.**\n\n## Next';
    assert.strictEqual(extractOneLinerFromBody(body), 'Real prose here.');
  });

  test('labeled-bold one-liner still works (no regression)', () => {
    const body = '# Title\n\n**One-liner:** the actual prose.\n';
    assert.strictEqual(extractOneLinerFromBody(body), 'the actual prose.');
  });
});
