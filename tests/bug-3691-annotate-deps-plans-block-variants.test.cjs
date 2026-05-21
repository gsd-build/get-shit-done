'use strict';

// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Regression — issue #3691
 *
 * Three regex defects in `roadmap.cjs` function `cmdRoadmapAnnotateDependencies`:
 *
 * Bug 1 (line ~553) — Plans-block detection regex `/(Plans:\s*\n)/i` requires no text
 *   after the colon. Headers like `Plans: 3 plans across 2 waves\n` or
 *   `**Plans:** 3 plans\n` are silently skipped and the function early-returns.
 *
 * Bug 2 (line ~542) — Phase-section boundary regex `/\n#{2,4}\s+Phase\s+\d/i` uses
 *   `\d` (single digit) so decimal phase headings like `### Phase 02.3:` are not
 *   recognized as boundaries. Content from an adjacent decimal phase may bleed into
 *   the section being annotated.
 *
 * Bug 3 (line ~566) — Plan-ID extraction regex `/([\w-]+?)/` excludes `.`, so
 *   decimal plan IDs like `02.3-01` are captured as `02` only, never match
 *   the planData entry, and every plan defaults to wave 1.
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
// Bug 2 — Phase boundary: decimal phase headings as section terminators
// ---------------------------------------------------------------------------

describe('bug #3691 — Bug 2: decimal phase heading used as section boundary', () => {
  let tmpDir;
  afterEach(() => cleanup(tmpDir));

  test('adjacent decimal phase heading terminates current phase section', (t) => {
    // Pre-fix: `/\n#{2,4}\s+Phase\s+\d/i` uses bare `\d` → doesn't match `### Phase 02.3:`
    // → phaseEnd = content.length → section includes all subsequent phases → plans from
    //   phase 02.3 are mistakenly processed when annotating phase 02.2.
    // Post-fix: `/\n#{2,4}\s+Phase\s+\d[\d.]*/i` → matches decimal headings too
    //
    // Setup: phase 02.2 has 2 plans at different waves (so wave annotation is written).
    //        phase 02.3 has 1 unannotated plan. We annotate phase 02.2 only.
    //        Post-fix: phase 02.3 section must remain untouched.
    const roadmap = [
      '# Roadmap',
      '',
      '### Phase 02.2: First phase',
      '',
      'Plans: 2 plans',
      '- [ ] 02.2-01-PLAN.md — First task',
      '- [ ] 02.2-02-PLAN.md — Second task',
      '',
      '### Phase 02.3: Surgical edit ops',
      '',
      'Plans: 2 plans',
      '- [ ] 02.3-01-PLAN.md — Path resolver',
      '- [ ] 02.3-02-PLAN.md — Op handlers',
      '',
    ].join('\n');

    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': roadmap,
      '.planning/phases/02.2-first/02.2-01-PLAN.md': makePlan({ phase: '02.2', plan: '02.2-01', wave: 1 }),
      '.planning/phases/02.2-first/02.2-02-PLAN.md': makePlan({ phase: '02.2', plan: '02.2-02', wave: 2, dependsOn: ['02.2-01'] }),
      '.planning/phases/02.3-surgical-edit-ops/02.3-01-PLAN.md': makePlan({ phase: '02.3', plan: '02.3-01', wave: 1 }),
      '.planning/phases/02.3-surgical-edit-ops/02.3-02-PLAN.md': makePlan({ phase: '02.3', plan: '02.3-02', wave: 1 }),
    });

    // Annotate phase 02.2 only
    const result = runGsdTools('roadmap annotate-dependencies 02.2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true, 'phase 02.2 must be annotated (2 plans across 2 waves)');
    assert.strictEqual(out.waves, 2, 'phase 02.2 must show 2 waves');

    const written = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    // Wave headers must appear in phase 02.2 section
    const phase022Section = written.split('### Phase 02.3:')[0];
    assert.ok(/\*\*Wave/.test(phase022Section),
      'wave headers must be written into the phase 02.2 section');
    // Phase 02.3 section must NOT contain wave headers (boundary must stop at Phase 02.3 heading)
    const phase023Section = written.split('### Phase 02.3:')[1] ?? '';
    assert.ok(!/\*\*Wave/.test(phase023Section),
      'phase 02.3 section must not contain wave headers when only 02.2 was annotated');
  });
});
