'use strict';

// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Regression — issue #3691
 *
 * Two regex defects fixed in `roadmap.cjs` function `cmdRoadmapAnnotateDependencies`,
 * plus two review-cycle additions (F3 defensive guard, F4 adversarial gaps):
 *
 * Bug 1 (line ~553) — Plans-block detection regex `/(Plans:\s*\n)/i` requires no text
 *   after the colon. Headers like `Plans: 3 plans across 2 waves\n` or
 *   `**Plans:** 3 plans\n` are silently skipped and the function early-returns.
 *   Fix: `(?:^|\n)(\*{0,2}Plans\*{0,2}:[^\n]*\n)` anchors to start-of-line and
 *   accepts optional bold wrappers and any trailing text on the header line.
 *
 * Bug 3 (line ~566) — Plan-ID extraction regex `/([\w-]+?)/` excludes `.`, so
 *   decimal plan IDs like `02.3-01` are captured as `02` only, never match
 *   the planData entry, and every plan defaults to wave 1.
 *   Fix: `[\w.-]+?` includes `.` so decimal IDs are captured in full.
 *
 * Note: "Bug 2" (phase-section boundary `\d` → `\d[\d.]*`) was confirmed empirically
 *   to be a no-op: any phase heading starts with a digit, so `\d` already matches.
 *   The no-op change was dropped from the PR; this file has no Bug 2 describe block.
 *
 * Review additions:
 *   F3 — Leading-dot plan ID guard: malformed IDs like `.invalid` are rejected
 *        before planData.find() rather than silently defaulting to wave 1.
 *   F4 — Adversarial gaps: multi-decimal leading-zero IDs (001.10-PLAN.md) and
 *        bare-bold `**Plans:**` (no trailing text) are explicitly covered.
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

function makePlanProject(files = {}) {
  const dir = createTempProject();
  fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

/** Build a minimal PLAN.md frontmatter string */
function makePlan({ phase, plan, wave, dependsOn = [] }) {
  return [
    '---',
    `phase: "${phase}"`,
    `plan: "${plan}"`,
    'type: standard',
    `wave: ${wave}`,
    `depends_on: [${dependsOn.map(d => `"${d}"`).join(', ')}]`,
    'files_modified: []',
    'autonomous: true',
    'must_haves:',
    '  truths: []',
    '  artifacts: []',
    '  key_links: []',
    '---',
    '',
    `<objective>Plan ${plan}</objective>`,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Bug 1 — Plans-block detection: inline summary text after the colon
// ---------------------------------------------------------------------------

describe('bug #3691 — Bug 1: Plans-block detection with inline summary', () => {
  let tmpDir;
  afterEach(() => cleanup(tmpDir));

  test('Plans: N plans (inline count after colon) is detected as a Plans-block', (t) => {
    // Pre-fix: `Plans:\s*\n` requires bare newline — fails for "Plans: 2 plans\n"
    // Post-fix: `Plans:[^\n]*\n` accepts any text after the colon
    const roadmap = [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      '**Goal:** Set up project',
      '',
      'Plans: 2 plans',
      '- [ ] 01-01-PLAN.md — Task A',
      '- [ ] 01-02-PLAN.md — Task B',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/01-foundation/01-01-PLAN.md': makePlan({ phase: '1', plan: '01-01', wave: 1 }),
      '.planning/phases/01-foundation/01-02-PLAN.md': makePlan({ phase: '1', plan: '01-02', wave: 2, dependsOn: ['01-01'] }),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true,
      'Plans-block with inline summary must be detected and written');
    assert.ok(out.waves >= 1, 'at least one wave must be written');

    const written = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(written.includes('Wave'), 'wave annotation must appear in ROADMAP.md');
  });

  test('Plans: N plans across N waves (longer inline text) is detected', (t) => {
    const roadmap = [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      'Plans: 3 plans across 2 waves',
      '- [ ] 01-01-PLAN.md — Task A',
      '- [ ] 01-02-PLAN.md — Task B',
      '- [ ] 01-03-PLAN.md — Task C',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/01-foundation/01-01-PLAN.md': makePlan({ phase: '1', plan: '01-01', wave: 1 }),
      '.planning/phases/01-foundation/01-02-PLAN.md': makePlan({ phase: '1', plan: '01-02', wave: 1 }),
      '.planning/phases/01-foundation/01-03-PLAN.md': makePlan({ phase: '1', plan: '01-03', wave: 2, dependsOn: ['01-01'] }),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true,
      'Plans-block with "N plans across N waves" inline text must be detected');
  });

  test('**Plans:** (bold markdown wrapper) is detected as a Plans-block', (t) => {
    // Bold wrapper: `**Plans:** 3 plans across 2 waves`
    const roadmap = [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      '**Plans:** 2 plans',
      '- [ ] 01-01-PLAN.md — Task A',
      '- [ ] 01-02-PLAN.md — Task B',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/01-foundation/01-01-PLAN.md': makePlan({ phase: '1', plan: '01-01', wave: 1 }),
      '.planning/phases/01-foundation/01-02-PLAN.md': makePlan({ phase: '1', plan: '01-02', wave: 2 }),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true,
      '**Plans:** bold-wrapped header must be detected as a Plans-block');
  });

  test('bare Plans: (no inline text, legacy format) still works after fix', (t) => {
    // Regression guard: the fix must not break the working case
    const roadmap = [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      'Plans:',
      '- [ ] 01-01-PLAN.md — Task A',
      '- [ ] 01-02-PLAN.md — Task B',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/01-foundation/01-01-PLAN.md': makePlan({ phase: '1', plan: '01-01', wave: 1 }),
      '.planning/phases/01-foundation/01-02-PLAN.md': makePlan({ phase: '1', plan: '01-02', wave: 2 }),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true,
      'bare Plans: (legacy format) must still be detected after the fix');
  });
});

// ---------------------------------------------------------------------------
// Bug 3 — Plan-ID extraction: decimal phase IDs like 02.3-01
// ---------------------------------------------------------------------------

describe('bug #3691 — Bug 3: decimal plan IDs (e.g. 02.3-01-PLAN.md) parse correctly', () => {
  let tmpDir;
  afterEach(() => cleanup(tmpDir));

  test('decimal plan ID 02.3-01 is captured fully and matched to the correct wave', (t) => {
    // Pre-fix: `[\w-]+?` stops at `.` → captures `02` only → planData.find misses → wave = 1 for all
    // Post-fix: `[\w.-]+?` captures `02.3-01` → planData.find resolves → correct wave written
    const roadmap = [
      '# Roadmap',
      '',
      '### Phase 02.3: Surgical edit ops',
      '',
      'Plans: 2 plans across 2 waves',
      '- [ ] 02.3-01-PLAN.md — Path resolver',
      '- [ ] 02.3-02-PLAN.md — Op handlers',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/02.3-surgical-edit-ops/02.3-01-PLAN.md': makePlan({ phase: '02.3', plan: '02.3-01', wave: 1 }),
      '.planning/phases/02.3-surgical-edit-ops/02.3-02-PLAN.md': makePlan({ phase: '02.3', plan: '02.3-02', wave: 2, dependsOn: ['02.3-01'] }),
    });

    const result = runGsdTools('roadmap annotate-dependencies 02.3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true,
      'decimal-phase ROADMAP with inline Plans: summary must be annotated');
    assert.strictEqual(out.waves, 2,
      'two distinct waves must be identified (02.3-01→wave 1, 02.3-02→wave 2)');

    const written = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(/Wave 1/.test(written), 'Wave 1 header must appear in output');
    assert.ok(/Wave 2/.test(written), 'Wave 2 header must appear in output');
  });

  test('combined fixture: decimal phase + bold Plans: header (both bugs together)', (t) => {
    // Exercises Bug 1 (bold **Plans:** header) AND Bug 3 (decimal IDs) simultaneously.
    // This is the exact ROADMAP fragment from the issue report.
    const roadmap = [
      '# Roadmap',
      '',
      '## Milestone v1.2',
      '',
      '### Phase 02.3: Surgical edit ops',
      '',
      '**Plans:** 3 plans across 2 waves',
      '- [ ] 02.3-01-PLAN.md — Path resolver',
      '- [ ] 02.3-02-PLAN.md — Op handlers',
      '- [ ] 02.3-03-PLAN.md — Tests',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/02.3-surgical-edit-ops/02.3-01-PLAN.md': makePlan({ phase: '02.3', plan: '02.3-01', wave: 1 }),
      '.planning/phases/02.3-surgical-edit-ops/02.3-02-PLAN.md': makePlan({ phase: '02.3', plan: '02.3-02', wave: 1 }),
      '.planning/phases/02.3-surgical-edit-ops/02.3-03-PLAN.md': makePlan({ phase: '02.3', plan: '02.3-03', wave: 2, dependsOn: ['02.3-01', '02.3-02'] }),
    });

    const result = runGsdTools('roadmap annotate-dependencies 02.3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true,
      'combined fixture (bold Plans: + decimal IDs) must produce updated: true');
    assert.strictEqual(out.waves, 2,
      'wave 2 dependency must be detected from decimal plan IDs');
  });
});

// ---------------------------------------------------------------------------
// F3 review fix — Leading-dot ID validation guard (defensive, malformed ROADMAP)
// ---------------------------------------------------------------------------

describe('review fix F3 — leading-dot plan ID is rejected (defensive guard)', () => {
  let tmpDir;
  afterEach(() => cleanup(tmpDir));

  test('checklist line with leading-dot plan ID is skipped and does not silently default to wave 1', (t) => {
    // Guards: `.invalid-PLAN.md` would be captured as `.invalid` by the `[\w.-]+?` regex
    // (since `.` is now included), which starts with a dot — an invalid ID.
    // Without the guard, planData.find() misses it and wave defaults to 1, silently
    // polluting the output. With the guard, the line is skipped entirely.
    // We verify this by having TWO real plans with known waves (1 and 2), plus one
    // malformed line. The malformed line must not appear in the wave-annotated output.
    const roadmap = [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      'Plans: 3 items',
      '- [ ] 01-01-PLAN.md — Task A',
      '- [ ] .invalid-PLAN.md — Corrupted entry',
      '- [ ] 01-02-PLAN.md — Task B',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/01-foundation/01-01-PLAN.md': makePlan({ phase: '1', plan: '01-01', wave: 1 }),
      '.planning/phases/01-foundation/01-02-PLAN.md': makePlan({ phase: '1', plan: '01-02', wave: 2, dependsOn: ['01-01'] }),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    // Two valid plans resolve to 2 waves — annotation must still proceed
    assert.strictEqual(out.updated, true, 'annotation must proceed despite malformed line');
    assert.strictEqual(out.waves, 2, 'two distinct waves from the two valid plans');

    const written = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    // The malformed line should not appear in the written output (it was skipped)
    assert.ok(!written.includes('.invalid-PLAN.md'),
      'malformed leading-dot entry must be dropped from the annotated output');
  });
});

// ---------------------------------------------------------------------------
// F4 review additions — adversarial test gaps
// ---------------------------------------------------------------------------

describe('review fix F4 — adversarial test gaps', () => {
  let tmpDir;
  afterEach(() => cleanup(tmpDir));

  test('001.10-PLAN.md multi-decimal leading-zero ID is captured fully and wave-assigned correctly', (t) => {
    // Guards regression of Bug 3: `[\w-]+?` would stop at the first `.` and
    // capture `001` instead of `001.10`, which never matches any planData entry.
    // Post-fix `[\w.-]+?` must capture `001.10` in full.
    const roadmap = [
      '# Roadmap',
      '',
      '### Phase 001.10: Extended decimal phase',
      '',
      'Plans: 2 plans across 2 waves',
      '- [ ] 001.10-01-PLAN.md — First task',
      '- [ ] 001.10-02-PLAN.md — Second task',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/001.10-extended/001.10-01-PLAN.md': makePlan({ phase: '001.10', plan: '001.10-01', wave: 1 }),
      '.planning/phases/001.10-extended/001.10-02-PLAN.md': makePlan({ phase: '001.10', plan: '001.10-02', wave: 2, dependsOn: ['001.10-01'] }),
    });

    const result = runGsdTools('roadmap annotate-dependencies 001.10', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true,
      'multi-decimal leading-zero plan ID must be captured fully and annotated');
    assert.strictEqual(out.waves, 2,
      'wave 2 dependency must be resolved from full 001.10-02 ID (not truncated to 001)');
  });

  test('**Plans:** (bold, no trailing text) is matched and checklist is processed', (t) => {
    // Guards the bare-bold variant: `**Plans:**` with nothing after the colon.
    // The `[^\n]*` quantifier accepts zero chars so this should already work,
    // but this test would fail if `\*{0,2}Plans\*{0,2}` regressed to require no stars.
    const roadmap = [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      '**Plans:**',
      '- [ ] 01-01-PLAN.md — Task A',
      '- [ ] 01-02-PLAN.md — Task B',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/01-foundation/01-01-PLAN.md': makePlan({ phase: '1', plan: '01-01', wave: 1 }),
      '.planning/phases/01-foundation/01-02-PLAN.md': makePlan({ phase: '1', plan: '01-02', wave: 2, dependsOn: ['01-01'] }),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true,
      '**Plans:** bare-bold variant (no trailing text) must be detected and annotated');
    assert.strictEqual(out.waves, 2,
      'wave assignment must resolve correctly from planData for bare-bold variant');
  });
});
