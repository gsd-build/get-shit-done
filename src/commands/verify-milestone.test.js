// @ts-check
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
const { runVerifyMilestone } = require('./verify-milestone');
const { writePlanFile } = require('../artifacts/plan');
const { writeFutureFile } = require('../artifacts/future');
const { writeMilestonesFile } = require('../artifacts/milestones');
const { ensureMilestoneFolder } = require('../artifacts/milestone-folders');

/**
 * Create a temp project with declarations, milestones, and actions on disk.
 * @returns {{ cwd: string, planningDir: string }}
 */
function createTestProject() {
  const cwd = mkdtempSync(join(tmpdir(), 'vm-test-'));
  execFileSync('git', ['init'], { cwd, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd, stdio: 'pipe' });

  const planningDir = join(cwd, '.planning');
  mkdirSync(planningDir, { recursive: true });

  // Write FUTURE.md with D-01
  const futureContent = writeFutureFile(
    [{ id: 'D-01', title: 'Users can auth', statement: 'Auth works', status: 'ACTIVE', milestones: ['M-01'] }],
    'Test Project'
  );
  writeFileSync(join(planningDir, 'FUTURE.md'), futureContent, 'utf-8');

  // Write MILESTONES.md with M-01
  const msContent = writeMilestonesFile(
    [{ id: 'M-01', title: 'Login flow', status: 'DONE', realizes: ['D-01'], hasPlan: true }],
    'Test Project'
  );
  writeFileSync(join(planningDir, 'MILESTONES.md'), msContent, 'utf-8');

  // Create milestone folder with PLAN.md
  const folder = ensureMilestoneFolder(planningDir, 'M-01', 'Login flow');
  const planContent = writePlanFile('M-01', 'Login flow', ['D-01'], [
    { id: 'A-01', title: 'Build login endpoint', status: 'DONE', produces: 'src/auth/login.js' },
    { id: 'A-02', title: 'Write documentation', status: 'DONE', produces: 'A description, not a file path' },
  ]);
  writeFileSync(join(folder, 'PLAN.md'), planContent, 'utf-8');

  // Create the produced file so artifact check passes
  mkdirSync(join(cwd, 'src', 'auth'), { recursive: true });
  writeFileSync(join(cwd, 'src', 'auth', 'login.js'), 'module.exports = {};', 'utf-8');

  return { cwd, planningDir };
}

describe('verify-milestone', () => {
  it('returns error when --milestone flag missing', () => {
    const { cwd } = createTestProject();
    const result = runVerifyMilestone(cwd, []);
    assert.ok('error' in result);
    assert.match(result.error, /--milestone/);
  });

  it('returns error for unknown milestone', () => {
    const { cwd } = createTestProject();
    const result = runVerifyMilestone(cwd, ['--milestone', 'M-99']);
    assert.ok('error' in result);
    assert.match(result.error, /M-99/);
  });

  it('returns criteria array with artifact checks for file-path produces', () => {
    const { cwd } = createTestProject();
    const result = runVerifyMilestone(cwd, ['--milestone', 'M-01']);
    assert.ok(!('error' in result));
    assert.ok(Array.isArray(result.criteria));

    // Should have artifact check for A-01 (file path), description pass for A-02, and AI placeholder
    const artifactCriteria = result.criteria.filter(c => c.type === 'artifact');
    assert.ok(artifactCriteria.length >= 1, 'Should have at least one artifact criterion');

    // A-01 produces src/auth/login.js which exists
    const a01Check = artifactCriteria.find(c => c.actionId === 'A-01');
    assert.ok(a01Check, 'Should have artifact check for A-01');
    assert.equal(a01Check.passed, true);
  });

  it('AI assessment criterion always present as last item', () => {
    const { cwd } = createTestProject();
    const result = runVerifyMilestone(cwd, ['--milestone', 'M-01']);
    assert.ok(!('error' in result));

    const lastCriterion = result.criteria[result.criteria.length - 1];
    assert.equal(lastCriterion.type, 'ai');
    assert.equal(lastCriterion.passed, null);
    assert.equal(lastCriterion.evidence, null);
  });

  it('programmaticPassed is true when all non-AI criteria pass', () => {
    const { cwd } = createTestProject();
    const result = runVerifyMilestone(cwd, ['--milestone', 'M-01']);
    assert.ok(!('error' in result));
    assert.equal(result.programmaticPassed, true);
  });

  it('programmaticPassed is false when artifact missing', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'vm-test-'));
    execFileSync('git', ['init'], { cwd, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd, stdio: 'pipe' });

    const planningDir = join(cwd, '.planning');
    mkdirSync(planningDir, { recursive: true });

    const futureContent = writeFutureFile(
      [{ id: 'D-01', title: 'Dec', statement: 'Truth', status: 'ACTIVE', milestones: ['M-01'] }],
      'Test'
    );
    writeFileSync(join(planningDir, 'FUTURE.md'), futureContent, 'utf-8');

    const msContent = writeMilestonesFile(
      [{ id: 'M-01', title: 'MS', status: 'DONE', realizes: ['D-01'], hasPlan: true }],
      'Test'
    );
    writeFileSync(join(planningDir, 'MILESTONES.md'), msContent, 'utf-8');

    const folder = ensureMilestoneFolder(planningDir, 'M-01', 'MS');
    const planContent = writePlanFile('M-01', 'MS', ['D-01'], [
      { id: 'A-01', title: 'Build thing', status: 'DONE', produces: 'src/missing-file.js' },
    ]);
    writeFileSync(join(folder, 'PLAN.md'), planContent, 'utf-8');
    // Don't create src/missing-file.js

    const result = runVerifyMilestone(cwd, ['--milestone', 'M-01']);
    assert.ok(!('error' in result));
    assert.equal(result.programmaticPassed, false);
  });

  it('returns traceContext with parent declarations', () => {
    const { cwd } = createTestProject();
    const result = runVerifyMilestone(cwd, ['--milestone', 'M-01']);
    assert.ok(!('error' in result));
    assert.ok(result.traceContext);
    assert.ok(Array.isArray(result.traceContext.declarations));
    assert.ok(result.traceContext.declarations.length > 0);
    assert.equal(result.traceContext.declarations[0].id, 'D-01');
  });
});
