// @ts-check
'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');

const { runAddDeclaration } = require('./add-declaration');
const { runAddMilestone } = require('./add-milestone');
const { runAddAction } = require('./add-action');
const { runLoadGraph } = require('./load-graph');
const { parseFutureFile } = require('../artifacts/future');
const { parseMilestonesFile } = require('../artifacts/milestones');

/**
 * Create a temp directory with git init and .planning/ for testing.
 * @param {{ withPlanning?: boolean, withConfig?: boolean }} [opts]
 * @returns {string} Temp directory path
 */
function createTempDir(opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'declare-test-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'pipe' });

  if (opts.withPlanning !== false) {
    mkdirSync(join(dir, '.planning'), { recursive: true });
  }

  if (opts.withConfig !== false) {
    writeFileSync(
      join(dir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: false }, null, 2),
      'utf-8'
    );
  }

  return dir;
}

// =============================================================================
// add-declaration
// =============================================================================

describe('add-declaration', () => {
  it('returns error when --title missing', () => {
    const dir = createTempDir();
    const result = runAddDeclaration(dir, ['--statement', 'Some truth']);
    assert.ok('error' in result);
    assert.match(result.error, /--title/);
  });

  it('returns error when --statement missing', () => {
    const dir = createTempDir();
    const result = runAddDeclaration(dir, ['--title', 'My Future']);
    assert.ok('error' in result);
    assert.match(result.error, /--statement/);
  });

  it('creates D-01 in empty FUTURE.md', () => {
    const dir = createTempDir();
    const result = runAddDeclaration(dir, ['--title', 'First Future', '--statement', 'We will ship']);
    assert.equal(result.id, 'D-01');
    assert.equal(result.title, 'First Future');
    assert.equal(result.statement, 'We will ship');
    assert.equal(result.status, 'PENDING');
  });

  it('auto-increments to D-02 when D-01 exists', () => {
    const dir = createTempDir();
    runAddDeclaration(dir, ['--title', 'First', '--statement', 'Truth 1']);
    const result = runAddDeclaration(dir, ['--title', 'Second', '--statement', 'Truth 2']);
    assert.equal(result.id, 'D-02');
  });

  it('returns correct JSON shape', () => {
    const dir = createTempDir();
    const result = runAddDeclaration(dir, ['--title', 'Test', '--statement', 'Test truth']);
    assert.ok('id' in result);
    assert.ok('title' in result);
    assert.ok('statement' in result);
    assert.ok('status' in result);
    assert.ok('committed' in result);
  });

  it('FUTURE.md on disk contains the new declaration', () => {
    const dir = createTempDir();
    runAddDeclaration(dir, ['--title', 'Persisted', '--statement', 'Check disk']);
    const content = readFileSync(join(dir, '.planning', 'FUTURE.md'), 'utf-8');
    const declarations = parseFutureFile(content);
    assert.equal(declarations.length, 1);
    assert.equal(declarations[0].id, 'D-01');
    assert.equal(declarations[0].title, 'Persisted');
    assert.equal(declarations[0].statement, 'Check disk');
  });
});

// =============================================================================
// add-milestone
// =============================================================================

describe('add-milestone', () => {
  it('returns error when --title missing', () => {
    const dir = createTempDir();
    const result = runAddMilestone(dir, ['--realizes', 'D-01']);
    assert.ok('error' in result);
    assert.match(result.error, /--title/);
  });

  it('returns error when --realizes missing', () => {
    const dir = createTempDir();
    const result = runAddMilestone(dir, ['--title', 'My MS']);
    assert.ok('error' in result);
    assert.match(result.error, /--realizes/);
  });

  it('returns error when realizes references non-existent declaration', () => {
    const dir = createTempDir();
    const result = runAddMilestone(dir, ['--title', 'Bad MS', '--realizes', 'D-99']);
    assert.ok('error' in result);
    assert.match(result.error, /D-99/);
  });

  it('creates M-01 linked to D-01', () => {
    const dir = createTempDir();
    runAddDeclaration(dir, ['--title', 'Future', '--statement', 'Truth']);
    const result = runAddMilestone(dir, ['--title', 'First Milestone', '--realizes', 'D-01']);
    assert.equal(result.id, 'M-01');
    assert.equal(result.title, 'First Milestone');
    assert.deepEqual(result.realizes, ['D-01']);
    assert.equal(result.status, 'PENDING');
  });

  it('updates FUTURE.md milestones field on the realized declaration', () => {
    const dir = createTempDir();
    runAddDeclaration(dir, ['--title', 'Future', '--statement', 'Truth']);
    runAddMilestone(dir, ['--title', 'MS One', '--realizes', 'D-01']);
    const content = readFileSync(join(dir, '.planning', 'FUTURE.md'), 'utf-8');
    const declarations = parseFutureFile(content);
    assert.ok(declarations[0].milestones.includes('M-01'));
  });

  it('both FUTURE.md and MILESTONES.md updated', () => {
    const dir = createTempDir();
    runAddDeclaration(dir, ['--title', 'Future', '--statement', 'Truth']);
    runAddMilestone(dir, ['--title', 'MS', '--realizes', 'D-01']);

    assert.ok(existsSync(join(dir, '.planning', 'FUTURE.md')));
    assert.ok(existsSync(join(dir, '.planning', 'MILESTONES.md')));

    const msContent = readFileSync(join(dir, '.planning', 'MILESTONES.md'), 'utf-8');
    const { milestones } = parseMilestonesFile(msContent);
    assert.equal(milestones.length, 1);
    assert.equal(milestones[0].id, 'M-01');
    assert.deepEqual(milestones[0].realizes, ['D-01']);
  });
});

// =============================================================================
// add-action
// =============================================================================

describe('add-action', () => {
  it('returns error when --title missing', () => {
    const dir = createTempDir();
    const result = runAddAction(dir, ['--causes', 'M-01']);
    assert.ok('error' in result);
    assert.match(result.error, /--title/);
  });

  it('returns error when --causes missing', () => {
    const dir = createTempDir();
    const result = runAddAction(dir, ['--title', 'My Action']);
    assert.ok('error' in result);
    assert.match(result.error, /--causes/);
  });

  it('returns error when causes references non-existent milestone', () => {
    const dir = createTempDir();
    const result = runAddAction(dir, ['--title', 'Bad Action', '--causes', 'M-99']);
    assert.ok('error' in result);
    assert.match(result.error, /M-99/);
  });

  it('creates A-01 linked to M-01', () => {
    const dir = createTempDir();
    runAddDeclaration(dir, ['--title', 'Future', '--statement', 'Truth']);
    runAddMilestone(dir, ['--title', 'MS', '--realizes', 'D-01']);
    const result = runAddAction(dir, ['--title', 'First Action', '--causes', 'M-01']);
    assert.equal(result.id, 'A-01');
    assert.equal(result.title, 'First Action');
    assert.deepEqual(result.causes, ['M-01']);
    assert.equal(result.status, 'PENDING');
  });

  it('updates MILESTONES.md causedBy field on the caused milestone', () => {
    const dir = createTempDir();
    runAddDeclaration(dir, ['--title', 'Future', '--statement', 'Truth']);
    runAddMilestone(dir, ['--title', 'MS', '--realizes', 'D-01']);
    runAddAction(dir, ['--title', 'Action', '--causes', 'M-01']);

    const msContent = readFileSync(join(dir, '.planning', 'MILESTONES.md'), 'utf-8');
    const { milestones } = parseMilestonesFile(msContent);
    assert.ok(milestones[0].causedBy.includes('A-01'));
  });
});

// =============================================================================
// load-graph
// =============================================================================

describe('load-graph', () => {
  it('returns error when .planning/ does not exist', () => {
    const dir = createTempDir({ withPlanning: false, withConfig: false });
    const result = runLoadGraph(dir);
    assert.ok('error' in result);
    assert.match(result.error, /No Declare project/);
  });

  it('returns empty graph for initialized but empty project', () => {
    const dir = createTempDir();
    const result = runLoadGraph(dir);
    assert.ok(!('error' in result));
    assert.deepEqual(result.declarations, []);
    assert.deepEqual(result.milestones, []);
    assert.deepEqual(result.actions, []);
    assert.equal(result.stats.declarations, 0);
    assert.equal(result.stats.milestones, 0);
    assert.equal(result.stats.actions, 0);
    assert.ok(result.validation.valid);
  });

  it('returns populated graph with declarations, milestones, actions, stats, validation', () => {
    const dir = createTempDir();
    runAddDeclaration(dir, ['--title', 'Future', '--statement', 'Truth']);
    runAddMilestone(dir, ['--title', 'MS', '--realizes', 'D-01']);
    runAddAction(dir, ['--title', 'Action', '--causes', 'M-01']);

    const result = runLoadGraph(dir);
    assert.ok(!('error' in result));
    assert.equal(result.declarations.length, 1);
    assert.equal(result.milestones.length, 1);
    assert.equal(result.actions.length, 1);
    assert.equal(result.stats.declarations, 1);
    assert.equal(result.stats.milestones, 1);
    assert.equal(result.stats.actions, 1);
    assert.equal(result.stats.edges, 2); // A-01->M-01, M-01->D-01
    assert.ok(result.validation.valid);
  });

  it('validation errors surfaced for orphan milestones', () => {
    const dir = createTempDir();
    // Create FUTURE.md with D-01
    runAddDeclaration(dir, ['--title', 'Future', '--statement', 'Truth']);

    // Manually write a milestone with no realizes (orphan)
    const { writeMilestonesFile } = require('../artifacts/milestones');
    const msContent = writeMilestonesFile(
      [{ id: 'M-01', title: 'Orphan', status: 'PENDING', realizes: [], causedBy: [] }],
      [],
      'test'
    );
    writeFileSync(join(dir, '.planning', 'MILESTONES.md'), msContent, 'utf-8');

    const result = runLoadGraph(dir);
    assert.ok(!('error' in result));
    assert.ok(!result.validation.valid);
    assert.ok(result.validation.errors.some(e => e.type === 'orphan' && e.node === 'M-01'));
  });
});
