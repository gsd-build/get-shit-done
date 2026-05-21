'use strict';

/**
 * GSD Tools Tests - Milestone Archive Layout and Phase Filter
 *
 * Covers:
 *   - bug #2684: milestone.complete forwards version to phases.archive
 *   - bug #2787: extractCurrentMilestone fenced code block boundary
 *   - bug #3164: validate consistency/health/find-phase with milestone-archive layout
 *   - bug #3600: getMilestonePhaseFilter with project-code-prefixed directories
 */

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('child_process');
const { createTempProject, cleanup, runGsdTools, toPosixPath } = require('./helpers.cjs');

const SDK_CLI = path.join(__dirname, '..', 'sdk', 'dist', 'cli.js');

function runSdkQuery(args, cwd) {
  try {
    const result = execFileSync(process.execPath, [SDK_CLI, 'query', ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, data: JSON.parse(result.trim()) };
  } catch (err) {
    const stdout = err.stdout?.toString().trim() || '';
    try { return { success: true, data: JSON.parse(stdout) }; } catch { /* not JSON */ }
    return { success: false, error: (err.stderr?.toString().trim() || err.message) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// bug #2684: milestone.complete forwards version to phases.archive
// ─────────────────────────────────────────────────────────────────────────────

describe('bug #2684: milestone.complete forwards version to phases.archive', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('milestone.complete v1.0 does not throw version required error', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`,
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runSdkQuery(['milestone.complete', 'v1.0'], tmpDir);
    assert.ok(result.success, `milestone.complete should succeed, got error: ${result.error}`);
    assert.ok(
      !result.error || !result.error.includes('version required'),
      `should not throw "version required" — got: ${result.error}`,
    );
  });

  test('milestone.complete returns version in response data', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`,
    );

    const result = runSdkQuery(['milestone.complete', 'v2.5'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(result.data.version, 'v2.5');
  });

  test('milestone.complete with --archive-phases forwards version correctly', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`,
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');

    const result = runSdkQuery(['milestone.complete', 'v1.0', '--archive-phases'], tmpDir);
    assert.ok(result.success, `milestone.complete --archive-phases failed: ${result.error}`);
    assert.strictEqual(result.data.version, 'v1.0');
    assert.ok(result.data.archived.phases === true, 'phases should be archived');
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-phases')));
  });

  test('phases.archive v1.0 (direct call) also works', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`,
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runSdkQuery(['phases.archive', 'v1.0'], tmpDir);
    assert.ok(result.success, `phases.archive failed: ${result.error}`);
    assert.strictEqual(result.data.version, 'v1.0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// bug #2787: extractCurrentMilestone — fenced code block boundary
// ─────────────────────────────────────────────────────────────────────────────

describe('extractCurrentMilestone — fenced code block boundary (#2787)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('roadmap analyze returns all phases when a fenced block contains a heading-like line matching the milestone-end pattern', () => {
    const roadmap = [
      '# Project Roadmap',
      '',
      '## ✅ v1.0: Foundation',
      '',
      '<details>',
      '<summary>✅ v1.0 Foundation — SHIPPED</summary>',
      '',
      '### Phase 1: Bootstrap',
      '**Goal:** Bootstrap the project',
      '',
      '</details>',
      '',
      '## Roadmap v1.1: New Work',
      '',
      '### Phase 1: Setup',
      '**Goal:** Set up the environment',
      '',
      '### Phase 2: Core Logic',
      '**Goal:** Implement core logic',
      '',
      'Deployment notes:',
      '',
      '```bash',
      '# Ops runbook — v1.0 compat',
      'echo "deploy complete"',
      '```',
      '',
      '### Phase 3: Testing',
      '**Goal:** Write regression tests',
      '',
      '### Phase 4: Deploy',
      '**Goal:** Ship to production',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: v1.1\n---\n\n# GSD State\n');

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `roadmap analyze should succeed: ${result.error}`);
    assert.strictEqual(JSON.parse(result.output).phase_count, 4, 'All 4 phases in v1.1 should be found');
  });

  test('roadmap analyze returns all phases when a fenced block contains a backtick-tilde fence with milestone-like heading', () => {
    const roadmap = [
      '## Roadmap v2.0: Feature Work',
      '',
      '### Phase 1: Alpha',
      '**Goal:** Alpha release',
      '',
      '~~~markdown',
      '## Prior art (v1.9 snapshot)',
      '~~~',
      '',
      '### Phase 2: Beta',
      '**Goal:** Beta release',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: v2.0\n---\n\n# GSD State\n');

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `roadmap analyze should succeed: ${result.error}`);
    assert.strictEqual(JSON.parse(result.output).phase_count, 2, 'Both phases in v2.0 should be found');
  });

  test('fenced block with info string (e.g. ```js) is not closed by a nested info-string line', () => {
    const roadmap = [
      '## Roadmap v3.0: Info-String Edge Case',
      '',
      '### Phase 1: Setup',
      '**Goal:** First phase',
      '',
      '```text',
      '```js',
      '# This heading-like line (v3.0 compat) must NOT end the milestone',
      '```',
      '',
      '### Phase 2: Core',
      '**Goal:** Second phase',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: v3.0\n---\n\n# GSD State\n');

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).phase_count, 2, 'Both phases should be found; ```js line must not close fence');
  });

  test('roadmap get-phase finds a phase defined after a fenced code block', () => {
    const roadmap = [
      '## Roadmap v1.1: New Work',
      '',
      '### Phase 1: Setup',
      '**Goal:** Bootstrap',
      '',
      '```bash',
      '# Runbook for v1.0 deploy',
      '```',
      '',
      '### Phase 2: Core',
      '**Goal:** Core implementation',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone: v1.1\n---\n\n# GSD State\n');

    const result = runGsdTools('roadmap get-phase 2', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(output.found, 'Phase 2 should be found even after a fenced code block');
    assert.strictEqual(output.phase_number, '2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// bug #3164: milestone-archive layout support in validate/find-phase
// ─────────────────────────────────────────────────────────────────────────────

function setupMilestoneArchiveProject(tmpDir, options = {}) {
  const {
    milestone = 'v1.7',
    phases = ['64-secondary-grader-fix'],
    roadmapPhases = ['64'],
  } = options;

  fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true, force: true });

  const archiveDir = path.join(tmpDir, '.planning', 'milestones', `${milestone}-phases`);
  for (const phase of phases) {
    const phaseDir = path.join(archiveDir, phase);
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, 'PLAN.md'), `# Plan\nPhase ${phase}\n`);
  }

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `milestone: ${milestone}\n# Session State\n\nPhase: ${roadmapPhases[0]}\n`,
  );
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    '# Project\n\n## What This Is\nTest.\n## Core Value\nTest.\n## Requirements\nTest.\n',
  );
  const phaseLines = roadmapPhases.map(n => `### Phase ${n}: Description\n\nGoal: implement it.\n`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n## Roadmap ${milestone}: Current\n\n${phaseLines}\n`,
  );
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ model_profile: 'balanced', commit_docs: true }, null, 2),
  );
}

describe('#3164 — validate consistency: milestone-archive layout', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('no W006 warnings for phases that exist in .planning/milestones/v*-phases/', () => {
    setupMilestoneArchiveProject(tmpDir, { milestone: 'v1.7', phases: ['64-secondary-grader-fix'], roadmapPhases: ['64'] });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success);

    const w006 = (JSON.parse(result.output).warnings || []).filter(w => w.includes('Phase 64') && w.includes('no directory'));
    assert.deepStrictEqual(w006, [], `Got spurious W006: ${w006.join(', ')}`);
  });

  test('no W006 when multiple phases exist in milestone-archive layout', () => {
    setupMilestoneArchiveProject(tmpDir, { milestone: 'v1.7', phases: ['48-feature-a', '51-feature-b', '64-feature-c'], roadmapPhases: ['48', '51', '64'] });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success);

    const w006 = (JSON.parse(result.output).warnings || []).filter(w => w.includes('no directory'));
    assert.deepStrictEqual(w006, [], `Got spurious W006: ${w006.join(', ')}`);
  });

  test('prefixed archive dir names (CK-64-...) are recognized as phase 64', () => {
    setupMilestoneArchiveProject(tmpDir, { milestone: 'v1.7', phases: ['CK-64-secondary-grader-fix'], roadmapPhases: ['64'] });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success);

    const w006 = (JSON.parse(result.output).warnings || []).filter(w => w.includes('Phase 64') && w.includes('no directory'));
    assert.deepStrictEqual(w006, [], `Prefixed phase dir should count as phase 64`);
  });

  test('consistency scans only active milestone archive and still validates plans/frontmatter', () => {
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true, force: true });

    const oldDir = path.join(tmpDir, '.planning', 'milestones', 'v1.6-phases', '64-legacy');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, '64-01-PLAN.md'), '# legacy plan\n');

    const activeDir = path.join(tmpDir, '.planning', 'milestones', 'v1.7-phases', '65-current');
    fs.mkdirSync(activeDir, { recursive: true });
    fs.writeFileSync(path.join(activeDir, '65-01-PLAN.md'), '# plan 1\n');
    fs.writeFileSync(path.join(activeDir, '65-03-PLAN.md'), '# plan 3\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Session State\n\n**Milestone:** v1.7 Current Milestone\nPhase: 65\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n## Roadmap v1.7: Current\n\n### Phase 65: Current work\n\nGoal: test.\n',
    );

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success);

    const out = JSON.parse(result.output);
    const warnings = out.warnings || [];
    const warningsPosix = warnings.map(w => toPosixPath(w));

    const phase64Warnings = warnings.filter(w => w.includes('Phase 64 exists on disk but not in ROADMAP.md'));
    assert.deepStrictEqual(phase64Warnings, [], 'Old archived milestone phase 64 should not be treated as active');
    assert.ok(
      warningsPosix.some(w => /Gap in plan numbering in .*milestones\/v1\.7-phases\/65-current/.test(w)),
      `Expected plan numbering warning, got: ${warnings.join(', ')}`,
    );
    assert.ok(
      warningsPosix.some(w => /milestones\/v1\.7-phases\/65-current\/65-01-PLAN\.md: missing 'wave'/.test(w))
        || warningsPosix.some(w => /milestones\/v1\.7-phases\/65-current\/65-03-PLAN\.md: missing 'wave'/.test(w)),
      `Expected frontmatter warning from active archive plans`,
    );
  });
});

describe('#3164 — validate health: milestone-archive layout', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('no W006 warnings for phases that exist in .planning/milestones/v*-phases/', () => {
    setupMilestoneArchiveProject(tmpDir, { milestone: 'v1.7', phases: ['64-secondary-grader-fix'], roadmapPhases: ['64'] });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);

    const w006 = (JSON.parse(result.output).warnings || []).filter(w => {
      const msg = typeof w === 'string' ? w : w.message;
      return msg && msg.includes('Phase 64') && msg.includes('no directory');
    });
    assert.deepStrictEqual(w006, []);
  });
});

describe('#3164 — find-phase: milestone-archive layout', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('find-phase 64 returns found:true for phase in .planning/milestones/v*-phases/', () => {
    setupMilestoneArchiveProject(tmpDir, { milestone: 'v1.7', phases: ['64-secondary-grader-fix'], roadmapPhases: ['64'] });

    const result = runGsdTools('find-phase 64', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(JSON.parse(result.output).found, true);
  });

  test('find-phase searches milestone archives in deterministic sorted order', () => {
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true, force: true });

    const milestonesDir = path.join(tmpDir, '.planning', 'milestones');
    const v110 = path.join(milestonesDir, 'v1.10-phases', '64-from-110');
    const v12 = path.join(milestonesDir, 'v1.2-phases', '64-from-12');
    fs.mkdirSync(v110, { recursive: true });
    fs.mkdirSync(v12, { recursive: true });
    fs.writeFileSync(path.join(v110, 'PLAN.md'), '# v1.10 plan\n');
    fs.writeFileSync(path.join(v12, 'PLAN.md'), '# v1.2 plan\n');

    const result = runGsdTools('find-phase 64', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.found, true);
    assert.strictEqual(out.directory, '.planning/milestones/v1.2-phases/64-from-12');
  });

  test('find-phase not-found payload includes searched_directories', () => {
    setupMilestoneArchiveProject(tmpDir, { milestone: 'v1.7', phases: ['64-secondary-grader-fix'], roadmapPhases: ['64'] });

    const result = runGsdTools('find-phase 999', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.found, false);
    assert.ok(Array.isArray(out.searched_directories));
    assert.ok(
      out.searched_directories.includes('.planning/milestones/v1.7-phases'),
      `searched_directories should include active archive dir, got: ${JSON.stringify(out.searched_directories)}`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// bug #3600: milestone phase filter understands project-code-prefixed directories
// ─────────────────────────────────────────────────────────────────────────────

describe('bug #3600: milestone phase filter understands project-code-prefixed directories', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject('bug-3600-'); });
  afterEach(() => { cleanup(tmpDir); });

  function writeState(tmpDir, version) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `---\nmilestone: ${version}\n---\n`);
  }
  function writeRoadmap(tmpDir, body) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), body);
  }
  function writeConfig(tmpDir, configObj) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(configObj, null, 2));
  }
  function ensurePhaseDir(tmpDir, name) {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', name), { recursive: true });
  }

  test('init.new-milestone counts CK-NN-name dirs against numeric `Phase N:` headings', () => {
    writeConfig(tmpDir, { project_code: 'CK' });
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(tmpDir, [
      '# Roadmap', '',
      '## Current Milestone: v1.0.0 - Test', '',
      '### Phase 1: Discovery', '**Goal:** GoalOne', '',
      '### Phase 2: Build', '**Goal:** GoalTwo', '',
    ].join('\n'));
    ensurePhaseDir(tmpDir, 'CK-01-discovery');
    ensurePhaseDir(tmpDir, 'CK-02-build');

    const r = runGsdTools(['init', 'new-milestone', '--json'], tmpDir);
    assert.ok(r.success, `init new-milestone failed: ${r.error || r.output}`);
    const payload = JSON.parse(r.output);
    assert.strictEqual(payload.phase_dir_count, 2,
      `expected phase_dir_count=2, got ${payload.phase_dir_count}`);
  });

  test('unprefixed directories continue to count (#3537 / existing contract)', () => {
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(tmpDir, [
      '# Roadmap', '',
      '## Current Milestone: v1.0.0 - Test', '',
      '### Phase 1: First', '**Goal:** g', '',
    ].join('\n'));
    ensurePhaseDir(tmpDir, '01-first');

    const r = runGsdTools(['init', 'new-milestone', '--json'], tmpDir);
    assert.ok(r.success);
    assert.strictEqual(JSON.parse(r.output).phase_dir_count, 1);
  });

  test('custom-ID match for PROJ-42 directory + Phase PROJ-42: heading still works', () => {
    writeConfig(tmpDir, { project_code: 'PROJ' });
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(tmpDir, [
      '# Roadmap', '',
      '## Current Milestone: v1.0.0 - Test', '',
      '### Phase PROJ-42: Custom', '**Goal:** g', '',
    ].join('\n'));
    ensurePhaseDir(tmpDir, 'PROJ-42');

    const r = runGsdTools(['init', 'new-milestone', '--json'], tmpDir);
    assert.ok(r.success);
    assert.strictEqual(JSON.parse(r.output).phase_dir_count, 1,
      'PROJ-42 directory must still match Phase PROJ-42: via the custom-ID path');
  });

  test('directories that do not match the milestone do NOT count (counter-test)', () => {
    writeConfig(tmpDir, { project_code: 'CK' });
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(tmpDir, [
      '# Roadmap', '',
      '## Current Milestone: v1.0.0 - Test', '',
      '### Phase 1: First', '**Goal:** g', '',
    ].join('\n'));
    ensurePhaseDir(tmpDir, 'CK-01-first');
    ensurePhaseDir(tmpDir, 'CK-99-backlog');
    ensurePhaseDir(tmpDir, 'CK-100-future');

    const r = runGsdTools(['init', 'new-milestone', '--json'], tmpDir);
    assert.ok(r.success);
    assert.strictEqual(JSON.parse(r.output).phase_dir_count, 1,
      'only CK-01-first should match Phase 1; CK-99 and CK-100 must be excluded');
  });
});
