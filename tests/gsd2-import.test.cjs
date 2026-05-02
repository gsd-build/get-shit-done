'use strict';

// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

const { describe, it, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempDir, cleanup, runGsdTools } = require('./helpers.cjs');

const {
  findGsd2Root,
  parseSlicesFromRoadmap,
  parseMilestoneTitle,
  parseTaskTitle,
  parseTaskDescription,
  parseTaskMustHaves,
  parseGsd2,
  buildPlanningArtifacts,
  buildRoadmapMd,
  buildStateMd,
  slugify,
  zeroPad,
} = require('../get-shit-done/bin/lib/gsd2-import.cjs');

// ─── Fixture Builders ──────────────────────────────────────────────────────

/** Build a minimal but complete GSD-2 .gsd/ directory in tmpDir. */
function makeGsd2Project(tmpDir, opts = {}) {
  const gsdDir = path.join(tmpDir, '.gsd');
  const m001Dir = path.join(gsdDir, 'milestones', 'M001');
  const s01Dir = path.join(m001Dir, 'slices', 'S01');
  const s02Dir = path.join(m001Dir, 'slices', 'S02');
  const s01TasksDir = path.join(s01Dir, 'tasks');

  fs.mkdirSync(s01TasksDir, { recursive: true });

  fs.writeFileSync(path.join(gsdDir, 'PROJECT.md'), '# My Project\n\nA test project.\n');
  fs.writeFileSync(path.join(gsdDir, 'REQUIREMENTS.md'), [
    '# Requirements',
    '',
    '## Active',
    '',
    '### R001 — Do the thing',
    '',
    '- Status: active',
    '- Description: The core requirement.',
    '',
  ].join('\n'));

  const roadmap = [
    '# M001: Foundation',
    '',
    '**Vision:** Build the foundation.',
    '',
    '## Success Criteria',
    '',
    '- It works.',
    '',
    '## Slices',
    '',
    '- [x] **S01: Setup** `risk:low` `depends:[]`',
    '  > After this: setup complete',
    '- [ ] **S02: Auth System** `risk:medium` `depends:[S01]`',
    '  > After this: auth works',
  ].join('\n');
  fs.writeFileSync(path.join(m001Dir, 'M001-ROADMAP.md'), roadmap);

  // S01 — completed slice with research and a done task
  fs.writeFileSync(path.join(s01Dir, 'S01-PLAN.md'), [
    '# S01: Setup',
    '',
    '**Goal:** Set up the project.',
    '',
    '## Tasks',
    '- [x] **T01: Init**',
  ].join('\n'));
  fs.writeFileSync(path.join(s01Dir, 'S01-RESEARCH.md'), '# Research\n\nSome research.\n');
  fs.writeFileSync(path.join(s01Dir, 'S01-SUMMARY.md'), '---\nstatus: done\n---\n\nSlice done.\n');

  fs.writeFileSync(path.join(s01TasksDir, 'T01-PLAN.md'), [
    '# T01: Init Project',
    '',
    '**Slice:** S01 — **Milestone:** M001',
    '',
    '## Description',
    'Initialize the project structure.',
    '',
    '## Must-Haves',
    '- [x] package.json exists',
    '- [x] tsconfig.json exists',
    '',
    '## Files',
    '- `package.json`',
    '- `tsconfig.json`',
  ].join('\n'));
  fs.writeFileSync(path.join(s01TasksDir, 'T01-SUMMARY.md'), [
    '---',
    'status: done',
    'completed_at: 2025-01-15',
    '---',
    '',
    '# T01: Init Project',
    '',
    'Set up package.json and tsconfig.json.',
  ].join('\n'));

  // S02 — not started: slice appears in roadmap but no slice directory
  if (opts.withS02Dir) {
    fs.mkdirSync(path.join(s02Dir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(s02Dir, 'S02-PLAN.md'), [
      '# S02: Auth System',
      '',
      '**Goal:** Add authentication.',
      '',
      '## Tasks',
      '- [ ] **T01: JWT middleware**',
    ].join('\n'));
    fs.writeFileSync(path.join(s02Dir, 'tasks', 'T01-PLAN.md'), [
      '# T01: JWT Middleware',
      '',
      '**Slice:** S02 — **Milestone:** M001',
      '',
      '## Description',
      'Implement JWT token validation middleware.',
      '',
      '## Must-Haves',
      '- [ ] validateToken() returns 401 on invalid JWT',
    ].join('\n'));
  }

  return gsdDir;
}

/** Build a two-milestone GSD-2 project. */
function makeTwoMilestoneProject(tmpDir) {
  const gsdDir = path.join(tmpDir, '.gsd');
  const m001Dir = path.join(gsdDir, 'milestones', 'M001');
  const m002Dir = path.join(gsdDir, 'milestones', 'M002');

  fs.mkdirSync(path.join(m001Dir, 'slices', 'S01', 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(m002Dir, 'slices', 'S01', 'tasks'), { recursive: true });

  fs.writeFileSync(path.join(gsdDir, 'PROJECT.md'), '# Multi-milestone Project\n');

  fs.writeFileSync(path.join(m001Dir, 'M001-ROADMAP.md'), [
    '# M001: Alpha',
    '',
    '## Slices',
    '',
    '- [x] **S01: Core** `risk:low` `depends:[]`',
    '- [x] **S02: API** `risk:low` `depends:[S01]`',
  ].join('\n'));

  fs.writeFileSync(path.join(m002Dir, 'M002-ROADMAP.md'), [
    '# M002: Beta',
    '',
    '## Slices',
    '',
    '- [ ] **S01: Dashboard** `risk:medium` `depends:[]`',
  ].join('\n'));

  return gsdDir;
}

// ─── Unit Tests ────────────────────────────────────────────────────────────

describe('parseSlicesFromRoadmap', () => {
  test('parses done and pending slices', () => {
    const content = [
      '## Slices',
      '',
      '- [x] **S01: Setup** `risk:low` `depends:[]`',
      '- [ ] **S02: Auth System** `risk:medium` `depends:[S01]`',
    ].join('\n');
    const slices = parseSlicesFromRoadmap(content);
    assert.strictEqual(slices.length, 2);
    assert.deepStrictEqual(slices[0], { done: true, id: 'S01', title: 'Setup' });
    assert.deepStrictEqual(slices[1], { done: false, id: 'S02', title: 'Auth System' });
  });

  test('returns empty array when no Slices section', () => {
    const slices = parseSlicesFromRoadmap('# M001: Title\n\n## Success Criteria\n\n- Works.');
    assert.strictEqual(slices.length, 0);
  });

  test('ignores non-slice lines in the section', () => {
    const content = [
      '## Slices',
      '',
      'Some intro text.',
      '- [x] **S01: Core** `risk:low` `depends:[]`',
      '  > After this: done',
    ].join('\n');
    const slices = parseSlicesFromRoadmap(content);
    assert.strictEqual(slices.length, 1);
    assert.strictEqual(slices[0].id, 'S01');
  });
});

describe('parseMilestoneTitle', () => {
  test('extracts title from first heading', () => {
    assert.strictEqual(parseMilestoneTitle('# M001: Foundation\n\nBody.'), 'Foundation');
  });

  test('returns null when heading absent', () => {
    assert.strictEqual(parseMilestoneTitle('No heading here.'), null);
  });
});

describe('parseTaskTitle', () => {
  test('extracts title from task plan', () => {
    assert.strictEqual(parseTaskTitle('# T01: Init Project\n\nBody.', 'T01'), 'Init Project');
  });

  test('falls back to provided default', () => {
    assert.strictEqual(parseTaskTitle('No heading.', 'T01'), 'T01');
  });
});

describe('parseTaskDescription', () => {
  test('extracts description body', () => {
    const content = [
      '# T01: Title',
      '',
      '## Description',
      'Do the thing.',
      '',
      '## Must-Haves',
    ].join('\n');
    assert.strictEqual(parseTaskDescription(content), 'Do the thing.');
  });

  test('returns empty string when section absent', () => {
    assert.strictEqual(parseTaskDescription('# T01: Title\n\nNo sections.'), '');
  });
});

describe('parseTaskMustHaves', () => {
  test('parses checked and unchecked items', () => {
    const content = [
      '## Must-Haves',
      '- [x] File exists',
      '- [ ] Tests pass',
    ].join('\n');
    const mh = parseTaskMustHaves(content);
    assert.deepStrictEqual(mh, ['File exists', 'Tests pass']);
  });

  test('returns empty array when section absent', () => {
    assert.deepStrictEqual(parseTaskMustHaves('# T01: Title\n\nNo sections.'), []);
  });
});

describe('slugify', () => {
  test('lowercases and replaces non-alphanumeric with hyphens', () => {
    assert.strictEqual(slugify('Auth System'), 'auth-system');
    assert.strictEqual(slugify('My Feature (v2)'), 'my-feature-v2');
  });

  test('strips leading/trailing hyphens', () => {
    assert.strictEqual(slugify('  spaces  '), 'spaces');
  });
});

describe('zeroPad', () => {
  test('pads to 2 digits by default', () => {
    assert.strictEqual(zeroPad(1), '01');
    assert.strictEqual(zeroPad(12), '12');
  });
});

// ─── Integration Tests ─────────────────────────────────────────────────────

describe('parseGsd2', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir('gsd2-parse-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('reads project and requirements passthroughs', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    assert.ok(data.projectContent.includes('My Project'));
    assert.ok(data.requirements.includes('R001'));
  });

  test('parses milestone with slices', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    assert.strictEqual(data.milestones.length, 1);
    assert.strictEqual(data.milestones[0].id, 'M001');
    assert.strictEqual(data.milestones[0].title, 'Foundation');
    assert.strictEqual(data.milestones[0].slices.length, 2);
  });

  test('marks S01 as done, S02 as not done', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    const [s01, s02] = data.milestones[0].slices;
    assert.strictEqual(s01.done, true);
    assert.strictEqual(s02.done, false);
  });

  test('reads research for completed slice', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    assert.ok(data.milestones[0].slices[0].research.includes('Some research'));
  });

  test('reads tasks from tasks/ directory', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    const tasks = data.milestones[0].slices[0].tasks;
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].id, 'T01');
    assert.strictEqual(tasks[0].title, 'Init Project');
    assert.strictEqual(tasks[0].done, true);
  });

  test('parses task must-haves', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    const mh = data.milestones[0].slices[0].tasks[0].mustHaves;
    assert.deepStrictEqual(mh, ['package.json exists', 'tsconfig.json exists']);
  });

  test('handles missing .gsd/milestones/ gracefully', () => {
    const gsdDir = path.join(tmpDir, '.gsd');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(path.join(gsdDir, 'PROJECT.md'), '# Empty\n');
    const data = parseGsd2(gsdDir);
    assert.strictEqual(data.milestones.length, 0);
  });

  test('slice with no directory has empty tasks list', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    // S02 has no slice directory in the default fixture
    const s02 = data.milestones[0].slices[1];
    assert.strictEqual(s02.tasks.length, 0);
    assert.strictEqual(s02.research, null);
  });
});

describe('buildPlanningArtifacts', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir('gsd2-artifacts-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('produces PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    const artifacts = buildPlanningArtifacts(data);
    assert.ok(artifacts.has('PROJECT.md'));
    assert.ok(artifacts.has('REQUIREMENTS.md'));
    assert.ok(artifacts.has('ROADMAP.md'));
    assert.ok(artifacts.has('STATE.md'));
    assert.ok(artifacts.has('config.json'));
  });

  test('S01 (done) maps to phase 01 with PLAN and SUMMARY', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    const artifacts = buildPlanningArtifacts(data);
    assert.ok(artifacts.has('phases/01-setup/01-CONTEXT.md'));
    assert.ok(artifacts.has('phases/01-setup/01-RESEARCH.md'));
    assert.ok(artifacts.has('phases/01-setup/01-01-PLAN.md'));
    assert.ok(artifacts.has('phases/01-setup/01-01-SUMMARY.md'));
  });

  test('S02 (pending) maps to phase 02 with only CONTEXT and PLAN', () => {
    const gsdDir = makeGsd2Project(tmpDir, { withS02Dir: true });
    const data = parseGsd2(gsdDir);
    const artifacts = buildPlanningArtifacts(data);
    assert.ok(artifacts.has('phases/02-auth-system/02-CONTEXT.md'));
    assert.ok(artifacts.has('phases/02-auth-system/02-01-PLAN.md'));
    assert.ok(!artifacts.has('phases/02-auth-system/02-01-SUMMARY.md'), 'no summary for pending task');
  });

  test('ROADMAP.md marks S01 done, S02 pending', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    const artifacts = buildPlanningArtifacts(data);
    const roadmap = artifacts.get('ROADMAP.md');
    assert.ok(roadmap.includes('[x]'));
    assert.ok(roadmap.includes('[ ]'));
  });

  test('PLAN.md includes frontmatter with phase and plan keys', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    const artifacts = buildPlanningArtifacts(data);
    const plan = artifacts.get('phases/01-setup/01-01-PLAN.md');
    assert.ok(plan.includes('phase: "01"'));
    assert.ok(plan.includes('plan: "01"'));
    assert.ok(plan.includes('type: "implementation"'));
  });

  test('SUMMARY.md strips GSD-2 frontmatter and adds v1 frontmatter', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    const artifacts = buildPlanningArtifacts(data);
    const summary = artifacts.get('phases/01-setup/01-01-SUMMARY.md');
    assert.ok(summary.includes('phase: "01"'));
    assert.ok(summary.includes('plan: "01"'));
    // GSD-2 frontmatter field should not appear
    assert.ok(!summary.includes('completed_at:'));
    // Body content should be preserved
    assert.ok(summary.includes('Init Project'));
  });

  test('config.json is valid JSON', () => {
    const gsdDir = makeGsd2Project(tmpDir);
    const data = parseGsd2(gsdDir);
    const artifacts = buildPlanningArtifacts(data);
    assert.doesNotThrow(() => JSON.parse(artifacts.get('config.json')));
  });

  test('multi-milestone: slices numbered sequentially across milestones', () => {
    const gsdDir = makeTwoMilestoneProject(tmpDir);
    const data = parseGsd2(gsdDir);
    const artifacts = buildPlanningArtifacts(data);
    // M001/S01 → phase 01, M001/S02 → phase 02, M002/S01 → phase 03
    assert.ok(artifacts.has('phases/01-core/01-CONTEXT.md'));
    assert.ok(artifacts.has('phases/02-api/02-CONTEXT.md'));
    assert.ok(artifacts.has('phases/03-dashboard/03-CONTEXT.md'));
  });
});

describe('buildRoadmapMd', () => {
  test('produces milestone sections with checked/unchecked phases', () => {
    const milestones = [{ id: 'M001', title: 'Alpha', slices: [] }];
    const phaseMap = [
      { milestoneId: 'M001', milestoneTitle: 'Alpha', slice: { done: true, title: 'Core' }, phaseNum: 1 },
      { milestoneId: 'M001', milestoneTitle: 'Alpha', slice: { done: false, title: 'API' }, phaseNum: 2 },
    ];
    const roadmap = buildRoadmapMd(milestones, phaseMap);
    assert.ok(roadmap.includes('## M001: Alpha'));
    assert.ok(roadmap.includes('[x]'));
    assert.ok(roadmap.includes('[ ]'));
    assert.ok(roadmap.includes('Phase 01: core'));
    assert.ok(roadmap.includes('Phase 02: api'));
  });
});

describe('buildStateMd', () => {
  test('sets current phase to first incomplete slice', () => {
    const phaseMap = [
      { milestoneId: 'M001', milestoneTitle: 'Alpha', slice: { done: true, title: 'Core' }, phaseNum: 1 },
      { milestoneId: 'M001', milestoneTitle: 'Alpha', slice: { done: false, title: 'API Layer' }, phaseNum: 2 },
    ];
    const state = buildStateMd(phaseMap);
    assert.ok(state.includes('Phase: 02'));
    assert.ok(state.includes('api-layer'));
    assert.ok(state.includes('Ready to plan'));
  });

  test('reports all complete when all slices done', () => {
    const phaseMap = [
      { milestoneId: 'M001', milestoneTitle: 'Alpha', slice: { done: true, title: 'Core' }, phaseNum: 1 },
    ];
    const state = buildStateMd(phaseMap);
    assert.ok(state.includes('All phases complete'));
  });
});

// ─── CLI Integration Tests ──────────────────────────────────────────────────

describe('gsd-tools from-gsd2 CLI', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir('gsd2-cli-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('--dry-run returns preview without writing files', () => {
    makeGsd2Project(tmpDir);
    const result = runGsdTools(['from-gsd2', '--dry-run', '--raw'], tmpDir);
    assert.ok(result.success, result.error);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.dryRun, true);
    assert.ok(parsed.preview.includes('PROJECT.md'));
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning')), 'no files written in dry-run');
  });

  test('writes .planning/ directory with correct structure', () => {
    makeGsd2Project(tmpDir);
    const result = runGsdTools(['from-gsd2', '--raw'], tmpDir);
    assert.ok(result.success, result.error);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.success, true);
    assert.ok(parsed.filesWritten > 0);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'ROADMAP.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'STATE.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'PROJECT.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md')));
  });

  test('errors when no .gsd/ directory present', () => {
    const result = runGsdTools(['from-gsd2', '--raw'], tmpDir);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.success, false);
    assert.ok(parsed.error.includes('No .gsd/'));
  });

  test('errors when .planning/ already exists without --force', () => {
    makeGsd2Project(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    const result = runGsdTools(['from-gsd2', '--raw'], tmpDir);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.success, false);
    assert.ok(parsed.error.includes('already exists'));
  });

  test('--force overwrites existing .planning/', () => {
    makeGsd2Project(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'OLD.md'), 'old content');
    const result = runGsdTools(['from-gsd2', '--force', '--raw'], tmpDir);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.success, true);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'ROADMAP.md')));
  });

  test('--path resolves target directory', () => {
    const projectDir = path.join(tmpDir, 'myproject');
    fs.mkdirSync(projectDir, { recursive: true });
    makeGsd2Project(projectDir);
    // Run from tmpDir but point at projectDir
    const result = runGsdTools(['from-gsd2', '--path', projectDir, '--dry-run', '--raw'], tmpDir);
    assert.ok(result.success, result.error);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.dryRun, true);
    assert.ok(parsed.preview.includes('PROJECT.md'));
  });

  test('completion state: S01 done → [x] in ROADMAP.md', () => {
    makeGsd2Project(tmpDir);
    runGsdTools(['from-gsd2', '--raw'], tmpDir);
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf8');
    assert.ok(roadmap.includes('[x]'));
    // S02 is pending
    assert.ok(roadmap.includes('[ ]'));
  });

  test('SUMMARY.md written for completed task, not for pending', () => {
    makeGsd2Project(tmpDir, { withS02Dir: true });
    runGsdTools(['from-gsd2', '--raw'], tmpDir);
    // S01/T01 is done → SUMMARY exists
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-SUMMARY.md')));
    // S02/T01 is pending → no SUMMARY
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-auth-system', '02-01-SUMMARY.md')));
  });
});
