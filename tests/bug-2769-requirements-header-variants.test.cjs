/**
 * Regression tests for issue #2769
 *
 * The Requirements header in ROADMAP.md phase blocks renders identically in
 * markdown for three textually distinct forms:
 *
 *   **Requirements:**          colon INSIDE bold delimiters
 *   **Requirements**:          colon OUTSIDE bold delimiters
 *   **Requirements** :         space-then-colon outside bold
 *
 * Two parsers in the codebase used opposing strict regexes — one only
 * matched the outside-colon form (init.cjs / init.ts), the other only the
 * inside-colon form (phase.cjs `cmdPhaseComplete` REQUIREMENTS.md
 * traceability sweep). Both must accept all three variants so phase
 * metadata propagation is robust to authoring style.
 *
 * Tests for the init query side live in `tests/init.test.cjs` (parameterized
 * over the three variants). This file exercises the inverse bug in
 * `phase complete`: the REQUIREMENTS.md checkbox must flip when ROADMAP
 * uses the outside-colon form, which previously was silently skipped.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('bug #2769: phase complete ticks REQUIREMENTS.md across header variants', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      ['---', 'current_phase: 1', 'status: executing', '---', '# State', ''].join('\n'),
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  const headerVariants = [
    { name: 'colon inside bold (**Requirements:**)', header: '**Requirements:** REQ-001' },
    { name: 'colon outside bold (**Requirements**:)', header: '**Requirements**: REQ-001' },
    { name: 'space before colon (**Requirements** :)', header: '**Requirements** : REQ-001' },
  ];

  for (const variant of headerVariants) {
    test(`flips REQ-001 checkbox in REQUIREMENTS.md when ROADMAP uses ${variant.name}`, () => {
      const phasesDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
      fs.mkdirSync(phasesDir, { recursive: true });
      fs.writeFileSync(
        path.join(phasesDir, '01-1-PLAN.md'),
        ['---', 'phase: 1', 'plan: 1', '---', '# Plan 1', ''].join('\n'),
      );
      fs.writeFileSync(
        path.join(phasesDir, '01-1-SUMMARY.md'),
        ['---', 'status: complete', '---', '# Summary', 'Done.'].join('\n'),
      );

      const roadmap = [
        '# Roadmap',
        '',
        '### Phase 1: Foundation',
        '',
        '**Goal:** Build core',
        variant.header,
        '**Plans:** 1 plans',
        '',
        'Plans:',
        '- [x] 01-1-PLAN.md',
        '',
        '| Phase | Plans | Status | Completed |',
        '|-------|-------|--------|-----------|',
        '| 1. Foundation | 0/1 | Pending | - |',
      ].join('\n');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

      const requirements = [
        '# Requirements',
        '',
        '## Functional Requirements',
        '',
        '- [ ] **REQ-001**: Core data model',
        '',
        '## Traceability',
        '',
        '| REQ-ID | Phase | Status |',
        '|--------|-------|--------|',
        '| REQ-001 | 1 | Pending |',
      ].join('\n');
      fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), requirements);

      const result = runGsdTools(['phase', 'complete', '1'], tmpDir);
      assert.ok(result.success, `phase complete failed: ${result.error}`);

      const updated = fs.readFileSync(
        path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
        'utf-8',
      );
      assert.match(
        updated,
        /-\s*\[x\]\s*\*\*REQ-001\*\*/,
        `REQ-001 checkbox must be flipped to [x] when ROADMAP header is "${variant.header}". Got:\n${updated}`,
      );
      assert.match(
        updated,
        /\|\s*REQ-001\s*\|\s*1\s*\|\s*Complete\s*\|/,
        `Traceability row for REQ-001 must be marked Complete. Got:\n${updated}`,
      );
    });
  }
});
