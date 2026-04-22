'use strict';

/**
 * Tests for ROADMAP wave dependency surfacing (#2447).
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const PLAN_TEMPLATE = (wave, truths = []) => `---
phase: "1"
plan: "01-0${wave}"
type: standard
wave: ${wave}
depends_on: []
files_modified: []
autonomous: true
requirements: []
must_haves:
  truths:
${truths.map(t => `    - ${t}`).join('\n') || '    - (none)'}
  artifacts: []
  key_links: []
---

<objective>
Plan ${wave} objective
</objective>
`;

function makePlanProject(files = {}) {
  const dir = createTempProject();
  fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '');
  fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-foundation'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

describe('roadmap annotate-dependencies', () => {
  let tmpDir;

  afterEach(() => cleanup(tmpDir));

  test('inserts wave headers for multi-wave plan set', () => {
    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': `# Roadmap

### Phase 1: Foundation
**Goal:** Set up project
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Set up DB
- [ ] 01-02-PLAN.md — Build API
`,
      '.planning/phases/01-foundation/01-01-PLAN.md': PLAN_TEMPLATE(1, ['DB schema is correct']),
      '.planning/phases/01-foundation/01-02-PLAN.md': PLAN_TEMPLATE(2, ['API returns 200']),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, true);
    assert.strictEqual(out.waves, 2);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('**Wave 1**'), 'Wave 1 header present');
    assert.ok(roadmap.includes('**Wave 2**'), 'Wave 2 header present');
    assert.ok(roadmap.includes('blocked on Wave 1'), 'Wave 2 blocked-on note present');
  });

  test('does not insert wave headers for single-wave plan set', () => {
    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': `# Roadmap

### Phase 1: Foundation
**Goal:** Set up project
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Set up DB
- [ ] 01-02-PLAN.md — Build API
`,
      '.planning/phases/01-foundation/01-01-PLAN.md': PLAN_TEMPLATE(1, ['DB schema is correct']),
      '.planning/phases/01-foundation/01-02-PLAN.md': PLAN_TEMPLATE(1, ['API returns 200']),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(!roadmap.includes('**Wave 1**'), 'no Wave header for single-wave set');
    assert.ok(!roadmap.includes('blocked on'), 'no blocked-on note for single wave');
  });

  test('surfaces cross-cutting constraints when truths appear in 2+ plans', () => {
    const sharedTruth = 'All endpoints require auth';
    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': `# Roadmap

### Phase 1: Foundation
**Goal:** Set up project
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Set up DB
- [ ] 01-02-PLAN.md — Build API
`,
      '.planning/phases/01-foundation/01-01-PLAN.md': PLAN_TEMPLATE(1, [sharedTruth, 'DB schema is correct']),
      '.planning/phases/01-foundation/01-02-PLAN.md': PLAN_TEMPLATE(2, [sharedTruth, 'API returns 200']),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const out = JSON.parse(result.output);
    assert.strictEqual(out.cross_cutting_constraints, 1);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Cross-cutting constraints:'), 'constraints subsection present');
    assert.ok(roadmap.includes(sharedTruth), 'shared truth listed');
  });

  test('does not surface constraints that appear in only one plan', () => {
    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': `# Roadmap

### Phase 1: Foundation
**Goal:** Set up project
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Set up DB
- [ ] 01-02-PLAN.md — Build API
`,
      '.planning/phases/01-foundation/01-01-PLAN.md': PLAN_TEMPLATE(1, ['Only in plan 1']),
      '.planning/phases/01-foundation/01-02-PLAN.md': PLAN_TEMPLATE(2, ['Only in plan 2']),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const out = JSON.parse(result.output);
    assert.strictEqual(out.cross_cutting_constraints, 0);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(!roadmap.includes('Cross-cutting constraints:'), 'no constraints section when none are cross-cutting');
  });

  test('is idempotent — running twice does not double-insert wave headers', () => {
    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': `# Roadmap

### Phase 1: Foundation
**Goal:** Set up project
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Set up DB
- [ ] 01-02-PLAN.md — Build API
`,
      '.planning/phases/01-foundation/01-01-PLAN.md': PLAN_TEMPLATE(1),
      '.planning/phases/01-foundation/01-02-PLAN.md': PLAN_TEMPLATE(2),
    });

    runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    const secondResult = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(secondResult.success);

    const out = JSON.parse(secondResult.output);
    assert.strictEqual(out.updated, false, 'second run should be no-op');

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    const waveMatches = roadmap.match(/\*\*Wave \d+\*\*/g) || [];
    assert.strictEqual(waveMatches.length, 2, 'exactly 2 wave headers (not doubled)');
  });

  test('returns no-op when phase has no plans', () => {
    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Set up project\n`,
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.updated, false);
  });

  test('plan-phase.md documents annotate-dependencies step', () => {
    const planPhase = fs.readFileSync(
      path.join(__dirname, '../get-shit-done/workflows/plan-phase.md'), 'utf-8'
    );
    assert.ok(planPhase.includes('annotate-dependencies'), 'plan-phase.md references annotate-dependencies command');
    assert.ok(planPhase.includes('13d'), 'plan-phase.md has step 13d');
    assert.ok(planPhase.includes('Cross-cutting constraints'), 'plan-phase.md documents cross-cutting constraints');
  });
});
