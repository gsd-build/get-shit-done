/**
 * Regression tests for bug #2005
 *
 * When the in-progress milestone section is wrapped in a <details> block
 * (the standard /gsd-new-project layout), phase complete silently skips:
 * 1. The plan count update (**Plans:** N/M → X/M plans complete)
 * 2. Mis-reports is_last_phase and next_phase
 *
 * Root cause: replaceInCurrentMilestone() uses the last </details> as the
 * boundary, so when the current milestone is itself inside <details>, the
 * replacement target is in the empty space AFTER the current milestone's
 * closing </details>, and the regex never matches anything inside the block.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const gsdTools = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

describe('bug #2005: phase complete updates plan count when milestone is inside <details>', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2005-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ project_code: 'TEST' })
    );

    fs.writeFileSync(
      path.join(planningDir, 'STATE.md'),
      '---\ncurrent_phase: 1\nstatus: executing\nmilestone: v2.0\n---\n# State\n'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('plan count is updated when current milestone is wrapped in <details>', () => {
    // This is the standard /gsd-new-project layout: every milestone in <details>
    const phasesDir = path.join(planningDir, 'phases', '01-setup');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    // Current milestone (v2.0) is wrapped in <details>
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '<details>',
      '<summary>v1.0 (shipped)</summary>',
      '',
      '## v1.0 Phases',
      '- [x] **Phase 0: Bootstrap** - shipped',
      '',
      '</details>',
      '',
      '<details open>',
      '<summary>v2.0 (in progress)</summary>',
      '',
      '## v2.0 Phases',
      '',
      '- [ ] **Phase 1: Setup** - initial setup',
      '- [ ] **Phase 2: Build** - build features',
      '',
      '## Progress',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Setup | 0/1 | Pending | - |',
      '| 2. Build | 0/1 | Pending | - |',
      '',
      '### Phase 1: Setup',
      '',
      '**Plans:** 0/1 plans complete',
      '',
      '### Phase 2: Build',
      '',
      '**Plans:** 0/1 plans complete',
      '',
      '</details>',
    ].join('\n'));

    try {
      execFileSync('node', [gsdTools, 'phase', 'complete', '1'], { cwd: tmpDir, timeout: 10000 });
    } catch {
      // May exit non-zero if STATE.md update fails, but ROADMAP.md update is the target
    }

    const result = fs.readFileSync(roadmapPath, 'utf-8');

    // Plan count must be updated inside the <details> block
    assert.match(
      result,
      /\*\*Plans:\*\*\s*1\/1 plans complete/,
      'plan count in Phase 1 section must be updated to 1/1 plans complete'
    );

    // Phase 1 checkbox must be checked
    assert.match(
      result,
      /- \[x\] \*\*Phase 1: Setup\*\*/,
      'Phase 1 checkbox must be checked after completion'
    );

    // Phase 2 must be untouched
    assert.match(
      result,
      /- \[ \] \*\*Phase 2: Build\*\*/,
      'Phase 2 checkbox must remain unchecked'
    );
  });

  test('phase complete with all milestones in <details> does not corrupt phase 2 plan count', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-setup');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '<details open>',
      '<summary>v2.0 (in progress)</summary>',
      '',
      '## v2.0 Phases',
      '',
      '- [ ] **Phase 1: Setup** - initial setup',
      '- [ ] **Phase 2: Build** - build features',
      '',
      '### Phase 1: Setup',
      '',
      '**Plans:** 0/1 plans complete',
      '',
      '### Phase 2: Build',
      '',
      '**Plans:** 0/2 plans complete',
      '',
      '</details>',
    ].join('\n'));

    try {
      execFileSync('node', [gsdTools, 'phase', 'complete', '1'], { cwd: tmpDir, timeout: 10000 });
    } catch {}

    const result = fs.readFileSync(roadmapPath, 'utf-8');

    // Phase 2's plan count must NOT be touched
    assert.match(
      result,
      /Phase 2: Build[\s\S]*?\*\*Plans:\*\*\s*0\/2 plans complete/,
      'Phase 2 plan count must remain 0/2 (untouched)'
    );
  });
});
