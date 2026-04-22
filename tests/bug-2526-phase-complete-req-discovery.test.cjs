/**
 * Regression tests for bug #2526
 *
 * phase complete must warn about REQ-IDs that appear in the REQUIREMENTS.md
 * body but are missing from the Traceability table.
 *
 * Root cause: cmdPhaseComplete() only flips status for REQ-IDs already in
 * the Traceability table (from the roadmap **Requirements:** line). REQ-IDs
 * added to the REQUIREMENTS.md body after roadmap creation are never
 * discovered or reflected in the table.
 *
 * Fix (Option A — warning only): scan the REQUIREMENTS.md body for all
 * REQ-IDs, check which are absent from the Traceability table, and emit
 * a warning listing the missing IDs.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const gsdTools = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

describe('bug #2526: phase complete warns about unregistered REQ-IDs', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2526-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // Minimal config
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ project_code: '' })
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

  test('emits warning for REQ-IDs in body but missing from Traceability table', () => {
    // Set up phase directory with a plan and summary
    const phasesDir = path.join(planningDir, 'phases', '01-foundation');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );

    // ROADMAP.md — phase 1 lists only REQ-001 in its Requirements line
    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      '**Goal:** Build core',
      '**Requirements:** REQ-001',
      '**Plans:** 1 plans',
      '',
      'Plans:',
      '- [x] 01-1-PLAN.md',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Foundation | 0/1 | Pending | - |',
    ].join('\n'));

    // REQUIREMENTS.md — body has REQ-001 (in table) and REQ-002, REQ-003 (missing from table)
    const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
    fs.writeFileSync(reqPath, [
      '# Requirements',
      '',
      '## Functional Requirements',
      '',
      '- [x] **REQ-001**: Core data model',
      '- [ ] **REQ-002**: User authentication',
      '- [ ] **REQ-003**: API endpoints',
      '',
      '## Traceability',
      '',
      '| REQ-ID | Phase | Status |',
      '|--------|-------|--------|',
      '| REQ-001 | 1 | Pending |',
    ].join('\n'));

    let stdout = '';
    let stderr = '';
    try {
      const result = execFileSync('node', [gsdTools, 'phase', 'complete', '1'], {
        cwd: tmpDir,
        timeout: 10000,
        encoding: 'utf-8',
      });
      stdout = result;
    } catch (err) {
      stdout = err.stdout || '';
      stderr = err.stderr || '';
      throw err;
    }

    const combined = stdout + stderr;
    assert.match(
      combined,
      /REQ-002/,
      'output should mention REQ-002 as missing from Traceability table'
    );
    assert.match(
      combined,
      /REQ-003/,
      'output should mention REQ-003 as missing from Traceability table'
    );
  });

  test('no warning when all body REQ-IDs are present in Traceability table', () => {
    // Set up phase directory
    const phasesDir = path.join(planningDir, 'phases', '01-foundation');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      '**Goal:** Build core',
      '**Requirements:** REQ-001, REQ-002',
      '**Plans:** 1 plans',
      '',
      'Plans:',
      '- [x] 01-1-PLAN.md',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Foundation | 0/1 | Pending | - |',
    ].join('\n'));

    // All body REQ-IDs are present in the Traceability table
    const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
    fs.writeFileSync(reqPath, [
      '# Requirements',
      '',
      '## Functional Requirements',
      '',
      '- [x] **REQ-001**: Core data model',
      '- [x] **REQ-002**: User authentication',
      '',
      '## Traceability',
      '',
      '| REQ-ID | Phase | Status |',
      '|--------|-------|--------|',
      '| REQ-001 | 1 | Pending |',
      '| REQ-002 | 1 | Pending |',
    ].join('\n'));

    let stdout = '';
    let stderr = '';
    try {
      const result = execFileSync('node', [gsdTools, 'phase', 'complete', '1'], {
        cwd: tmpDir,
        timeout: 10000,
        encoding: 'utf-8',
      });
      stdout = result;
    } catch (err) {
      stdout = err.stdout || '';
      stderr = err.stderr || '';
      throw err;
    }

    const combined = stdout + stderr;
    assert.doesNotMatch(
      combined,
      /unregistered|missing.*traceability|not in.*traceability/i,
      'no warning should appear when all REQ-IDs are in the table'
    );
  });

  test('warning includes all missing REQ-IDs, not just the first', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-foundation');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      '**Goal:** Build core',
      '**Requirements:** REQ-001',
      '**Plans:** 1 plans',
      '',
      'Plans:',
      '- [x] 01-1-PLAN.md',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Foundation | 0/1 | Pending | - |',
    ].join('\n'));

    // Body has 4 REQ-IDs; table only has 1
    const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
    fs.writeFileSync(reqPath, [
      '# Requirements',
      '',
      '- [x] **REQ-001**: Core data model',
      '- [ ] **REQ-002**: User auth',
      '- [ ] **REQ-003**: API',
      '- [ ] **REQ-004**: Reports',
      '',
      '## Traceability',
      '',
      '| REQ-ID | Phase | Status |',
      '|--------|-------|--------|',
      '| REQ-001 | 1 | Pending |',
    ].join('\n'));

    let stdout = '';
    let stderr = '';
    try {
      const result = execFileSync('node', [gsdTools, 'phase', 'complete', '1'], {
        cwd: tmpDir,
        timeout: 10000,
        encoding: 'utf-8',
      });
      stdout = result;
    } catch (err) {
      stdout = err.stdout || '';
      stderr = err.stderr || '';
      throw err;
    }

    const combined = stdout + stderr;
    assert.match(combined, /REQ-002/, 'should warn about REQ-002');
    assert.match(combined, /REQ-003/, 'should warn about REQ-003');
    assert.match(combined, /REQ-004/, 'should warn about REQ-004');
  });
});
