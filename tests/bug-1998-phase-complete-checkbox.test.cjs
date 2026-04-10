/**
 * Regression tests for bug #1998
 *
 * phase complete must update the top-level overview bullet checkbox
 * (- [ ] Phase N: → - [x] Phase N:) in addition to the Progress table row.
 *
 * Root cause: the checkbox update used replaceInCurrentMilestone() which
 * scopes to content after </details>, missing the current milestone's
 * overview bullets that appear before any <details> blocks.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const gsdTools = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

describe('bug #1998: phase complete updates overview checkbox', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-1998-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // Minimal config
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ project_code: 'TEST' })
    );

    // Minimal STATE.md
    fs.writeFileSync(
      path.join(planningDir, 'STATE.md'),
      '---\ncurrent_phase: 1\nstatus: executing\n---\n# State\n'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('checkbox updated when no archived milestones exist', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-foundation');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '## Phases',
      '',
      '- [ ] **Phase 1: Foundation** - core setup',
      '- [ ] **Phase 2: Features** - add features',
      '',
      '## Progress',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Foundation | 0/1 | Pending | - |',
      '| 2. Features | 0/1 | Pending | - |',
    ].join('\n'));

    try {
      execFileSync('node', [gsdTools, 'phase', 'complete', '1'], { cwd: tmpDir, timeout: 10000 });
    } catch {
      // Command may exit non-zero if STATE.md update fails, but ROADMAP.md update happens first
    }

    const result = fs.readFileSync(roadmapPath, 'utf-8');
    assert.match(result, /- \[x\] \*\*Phase 1: Foundation\*\*/, 'overview checkbox should be checked');
    assert.match(result, /- \[ \] \*\*Phase 2: Features\*\*/, 'phase 2 checkbox should remain unchecked');
  });

  test('checkbox updated when archived milestones exist in <details>', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-setup');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap v2.0',
      '',
      '## Phases',
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
      '<details>',
      '<summary>v1.0 (Archived)</summary>',
      '',
      '## v1.0 Phases',
      '- [x] **Phase 1: Init** - initialization',
      '- [x] **Phase 2: Deploy** - deployment',
      '',
      '</details>',
    ].join('\n'));

    try {
      execFileSync('node', [gsdTools, 'phase', 'complete', '1'], { cwd: tmpDir, timeout: 10000 });
    } catch {
      // May exit non-zero
    }

    const result = fs.readFileSync(roadmapPath, 'utf-8');
    assert.match(result, /- \[x\] \*\*Phase 1: Setup\*\*/, 'current milestone checkbox should be checked');
    assert.match(result, /- \[ \] \*\*Phase 2: Build\*\*/, 'phase 2 checkbox should remain unchecked');
  });
});
