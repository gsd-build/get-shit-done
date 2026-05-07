'use strict';

/**
 * #3164 — gsd-tools doesn't support .planning/milestones/v*-phases/ layout.
 *
 * Validators hardcode `phasesDir = .planning/phases/`. On projects that have
 * graduated to milestone-archive layout (.planning/milestones/v*-phases/),
 * the old path doesn't exist and diskPhases stays empty, triggering W006
 * "Phase N in ROADMAP.md but no directory on disk" for every active phase.
 *
 * Fix: resolve phasesDir to the active milestone's archive dir when
 * .planning/phases/ does not exist.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

function setupMilestoneArchiveProject(tmpDir, options = {}) {
  const {
    milestone = 'v1.7',
    phases = ['64-secondary-grader-fix'],
    roadmapPhases = ['64'],
  } = options;

  // Remove the default .planning/phases/ dir (milestone-archive layout has no flat phases/)
  fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true, force: true });

  // Create milestone-archive phase directories
  const archiveDir = path.join(tmpDir, '.planning', 'milestones', `${milestone}-phases`);
  for (const phase of phases) {
    const phaseDir = path.join(archiveDir, phase);
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, 'PLAN.md'), `# Plan\nPhase ${phase}\n`);
  }

  // Write STATE.md with current milestone
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `milestone: ${milestone}\n# Session State\n\nPhase: ${roadmapPhases[0]}\n`
  );

  // Write PROJECT.md
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    '# Project\n\n## What This Is\nTest.\n## Core Value\nTest.\n## Requirements\nTest.\n'
  );

  // Write ROADMAP.md with phases in the milestone section
  const phaseLines = roadmapPhases.map(n => `### Phase ${n}: Description\n\nGoal: implement it.\n`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n## Roadmap ${milestone}: Current\n\n${phaseLines}\n`
  );

  // Write config.json
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ model_profile: 'balanced', commit_docs: true }, null, 2)
  );
}

describe('#3164 — validate consistency: milestone-archive layout', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('no W006 warnings for phases that exist in .planning/milestones/v*-phases/', () => {
    setupMilestoneArchiveProject(tmpDir, {
      milestone: 'v1.7',
      phases: ['64-secondary-grader-fix'],
      roadmapPhases: ['64'],
    });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `validate consistency should succeed: ${result.error}`);

    const out = JSON.parse(result.output);
    const w006 = (out.warnings || []).filter(w => w.includes('Phase 64') && w.includes('no directory'));
    assert.deepStrictEqual(
      w006, [],
      `Got spurious W006 for phase 64 in milestone-archive layout:\n  ${w006.join('\n  ')}`
    );
  });

  test('no W006 when multiple phases exist in milestone-archive layout', () => {
    setupMilestoneArchiveProject(tmpDir, {
      milestone: 'v1.7',
      phases: ['48-feature-a', '51-feature-b', '64-feature-c'],
      roadmapPhases: ['48', '51', '64'],
    });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `validate consistency should succeed: ${result.error}`);

    const out = JSON.parse(result.output);
    const w006 = (out.warnings || []).filter(w => w.includes('no directory'));
    assert.deepStrictEqual(
      w006, [],
      `Got spurious W006 warnings in milestone-archive layout:\n  ${w006.join('\n  ')}`
    );
  });

  test('prefixed archive dir names (CK-64-...) are recognized as phase 64', () => {
    setupMilestoneArchiveProject(tmpDir, {
      milestone: 'v1.7',
      phases: ['CK-64-secondary-grader-fix'],
      roadmapPhases: ['64'],
    });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `validate consistency should succeed: ${result.error}`);

    const out = JSON.parse(result.output);
    const w006 = (out.warnings || []).filter(w => w.includes('Phase 64') && w.includes('no directory'));
    assert.deepStrictEqual(
      w006, [],
      `Prefixed phase dir should count as phase 64, got W006:\n  ${w006.join('\n  ')}`
    );
  });

  test('consistency scans only active milestone archive and still validates plans/frontmatter', () => {
    // Remove default flat phases dir; this project is archive-only.
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true, force: true });

    // Old archived milestone should NOT be treated as active on-disk phase roots.
    const oldDir = path.join(tmpDir, '.planning', 'milestones', 'v1.6-phases', '64-legacy');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, '64-01-PLAN.md'), '# legacy plan\n');

    // Active milestone includes intentionally malformed plan numbering/frontmatter.
    const activeDir = path.join(tmpDir, '.planning', 'milestones', 'v1.7-phases', '65-current');
    fs.mkdirSync(activeDir, { recursive: true });
    fs.writeFileSync(path.join(activeDir, '65-01-PLAN.md'), '# plan 1\n');
    fs.writeFileSync(path.join(activeDir, '65-03-PLAN.md'), '# plan 3\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Session State\n\n**Milestone:** v1.7 Current Milestone\nPhase: 65\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n## Roadmap v1.7: Current\n\n### Phase 65: Current work\n\nGoal: test.\n'
    );

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `validate consistency should succeed: ${result.error}`);

    const out = JSON.parse(result.output);
    const warnings = out.warnings || [];
    const phase64Warnings = warnings.filter(w => w.includes('Phase 64 exists on disk but not in ROADMAP.md'));
    assert.deepStrictEqual(
      phase64Warnings,
      [],
      `Old archived milestone phase 64 should not be treated as active:\n  ${phase64Warnings.join('\n  ')}`
    );
    assert.ok(
      warnings.some(w => w.includes('Gap in plan numbering in milestones/v1.7-phases/65-current')),
      `Expected plan numbering warning from active archive root, got:\n  ${warnings.join('\n  ')}`
    );
    assert.ok(
      warnings.some(w => w.includes("milestones/v1.7-phases/65-current/65-01-PLAN.md: missing 'wave'"))
        || warnings.some(w => w.includes("milestones/v1.7-phases/65-current/65-03-PLAN.md: missing 'wave'")),
      `Expected frontmatter warning from active archive plans, got:\n  ${warnings.join('\n  ')}`
    );
  });
});

describe('#3164 — validate health: milestone-archive layout', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('no W006 warnings for phases that exist in .planning/milestones/v*-phases/', () => {
    setupMilestoneArchiveProject(tmpDir, {
      milestone: 'v1.7',
      phases: ['64-secondary-grader-fix'],
      roadmapPhases: ['64'],
    });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `validate health should succeed: ${result.error}`);

    const out = JSON.parse(result.output);
    const w006 = (out.warnings || []).filter(w => {
      const msg = typeof w === 'string' ? w : w.message;
      return msg && msg.includes('Phase 64') && msg.includes('no directory');
    });
    assert.deepStrictEqual(
      w006, [],
      `Got spurious W006 for phase 64 in milestone-archive validate health:\n  ${w006.map(w => typeof w === 'string' ? w : w.message).join('\n  ')}`
    );
  });
});

describe('#3164 — find-phase: milestone-archive layout', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('find-phase 64 returns found:true for phase in .planning/milestones/v*-phases/', () => {
    setupMilestoneArchiveProject(tmpDir, {
      milestone: 'v1.7',
      phases: ['64-secondary-grader-fix'],
      roadmapPhases: ['64'],
    });

    const result = runGsdTools('find-phase 64', tmpDir);
    assert.ok(result.success, `find-phase should succeed: ${result.error}`);

    const out = JSON.parse(result.output);
    assert.strictEqual(out.found, true, `find-phase 64 should return found:true, got: ${JSON.stringify(out)}`);
  });

  test('find-phase searches milestone archives in deterministic sorted order', () => {
    // Remove flat phases dir so search relies on milestone archives only.
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true, force: true });

    const milestonesDir = path.join(tmpDir, '.planning', 'milestones');
    const v110 = path.join(milestonesDir, 'v1.10-phases', '64-from-110');
    const v12 = path.join(milestonesDir, 'v1.2-phases', '64-from-12');
    fs.mkdirSync(v110, { recursive: true });
    fs.mkdirSync(v12, { recursive: true });
    fs.writeFileSync(path.join(v110, 'PLAN.md'), '# v1.10 plan\n');
    fs.writeFileSync(path.join(v12, 'PLAN.md'), '# v1.2 plan\n');

    const result = runGsdTools('find-phase 64', tmpDir);
    assert.ok(result.success, `find-phase should succeed: ${result.error}`);

    const out = JSON.parse(result.output);
    assert.strictEqual(out.found, true, `find-phase 64 should return found:true, got: ${JSON.stringify(out)}`);
    assert.strictEqual(
      out.directory,
      '.planning/milestones/v1.2-phases/64-from-12',
      `Expected deterministic archive ordering (v1.2 before v1.10), got directory: ${out.directory}`
    );
  });

  test('find-phase not-found payload includes searched_directories', () => {
    setupMilestoneArchiveProject(tmpDir, {
      milestone: 'v1.7',
      phases: ['64-secondary-grader-fix'],
      roadmapPhases: ['64'],
    });

    const result = runGsdTools('find-phase 999', tmpDir);
    assert.ok(result.success, `find-phase should succeed with found:false payload: ${result.error}`);

    const out = JSON.parse(result.output);
    assert.strictEqual(out.found, false, `find-phase 999 should return found:false, got: ${JSON.stringify(out)}`);
    assert.ok(Array.isArray(out.searched_directories), 'searched_directories should be an array on not-found payload');
    assert.ok(
      out.searched_directories.includes('.planning/milestones/v1.7-phases'),
      `searched_directories should include active archive dir, got: ${JSON.stringify(out.searched_directories)}`
    );
  });
});
