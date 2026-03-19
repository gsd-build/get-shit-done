/**
 * GSD Tools Tests - core.cjs
 *
 * Tests for the foundational module's exports including regressions
 * for known bugs (REG-01: loadConfig model_overrides, REG-02: getRoadmapPhaseInternal export).
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createTempProject, cleanup } = require('./helpers.cjs');

const {
  loadConfig,
  resolveModelInternal,
  escapeRegex,
  generateSlugInternal,
  normalizePhaseName,
  normalizeMd,
  comparePhaseNum,
  safeReadFile,
  pathExistsInternal,
  getMilestoneInfo,
  getMilestonePhaseFilter,
  getRoadmapPhaseInternal,
  searchPhaseInDir,
  findPhaseInternal,
  findProjectRoot,
  detectSubRepos,
} = require('../get-shit-done/bin/lib/core.cjs');

// ─── loadConfig ────────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = createTempProject();
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
  });

  function writeConfig(obj) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(obj, null, 2)
    );
  }

  test('returns defaults when config.json is missing', () => {
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.commit_docs, true);
    assert.strictEqual(config.research, true);
    assert.strictEqual(config.plan_checker, true);
    assert.strictEqual(config.brave_search, false);
    assert.strictEqual(config.parallelization, true);
    assert.strictEqual(config.nyquist_validation, true);
  });

  test('reads model_profile from config.json', () => {
    writeConfig({ model_profile: 'quality' });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'quality');
  });

  test('reads nested config keys', () => {
    writeConfig({ planning: { commit_docs: false } });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.commit_docs, false);
  });

  test('reads branching_strategy from git section', () => {
    writeConfig({ git: { branching_strategy: 'per-phase' } });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.branching_strategy, 'per-phase');
  });

  // Bug: loadConfig previously omitted model_overrides from return value
  test('returns model_overrides when present (REG-01)', () => {
    writeConfig({ model_overrides: { 'gsd-executor': 'opus' } });
    const config = loadConfig(tmpDir);
    assert.deepStrictEqual(config.model_overrides, { 'gsd-executor': 'opus' });
  });

  test('returns model_overrides as null when not in config', () => {
    writeConfig({ model_profile: 'balanced' });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_overrides, null);
  });

  test('returns defaults when config.json contains invalid JSON', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      'not valid json {{{{'
    );
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.commit_docs, true);
  });

  test('handles parallelization as boolean', () => {
    writeConfig({ parallelization: false });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.parallelization, false);
  });

  test('handles parallelization as object with enabled field', () => {
    writeConfig({ parallelization: { enabled: false } });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.parallelization, false);
  });

  test('prefers top-level keys over nested keys', () => {
    writeConfig({ commit_docs: false, planning: { commit_docs: true } });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.commit_docs, false);
  });
});

// ─── resolveModelInternal ──────────────────────────────────────────────────────

describe('resolveModelInternal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function writeConfig(obj) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(obj, null, 2)
    );
  }

  describe('model profile structural validation', () => {
    test('all known agents resolve to a valid string for each profile', () => {
      const knownAgents = ['gsd-planner', 'gsd-executor', 'gsd-phase-researcher', 'gsd-codebase-mapper'];
      const profiles = ['quality', 'balanced', 'budget', 'inherit'];
      const validValues = ['inherit', 'sonnet', 'haiku', 'opus'];

      for (const profile of profiles) {
        writeConfig({ model_profile: profile });
        for (const agent of knownAgents) {
          const result = resolveModelInternal(tmpDir, agent);
          assert.ok(
            validValues.includes(result),
            `profile=${profile} agent=${agent} returned unexpected value: ${result}`
          );
        }
      }
    });

    test('inherit profile forces all known agents to inherit model', () => {
      const knownAgents = ['gsd-planner', 'gsd-executor', 'gsd-phase-researcher', 'gsd-codebase-mapper'];
      writeConfig({ model_profile: 'inherit' });
      for (const agent of knownAgents) {
        assert.strictEqual(resolveModelInternal(tmpDir, agent), 'inherit');
      }
    });
  });

  describe('override precedence', () => {
    test('per-agent override takes precedence over profile', () => {
      writeConfig({
        model_profile: 'balanced',
        model_overrides: { 'gsd-executor': 'haiku' },
      });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-executor'), 'haiku');
    });

    test('opus override resolves to opus', () => {
      writeConfig({
        model_overrides: { 'gsd-executor': 'opus' },
      });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-executor'), 'opus');
    });

    test('agents not in override fall back to profile', () => {
      writeConfig({
        model_profile: 'quality',
        model_overrides: { 'gsd-executor': 'haiku' },
      });
      // gsd-planner not overridden, should use quality profile -> opus
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'opus');
    });
  });

  describe('edge cases', () => {
    test('returns sonnet for unknown agent type', () => {
      writeConfig({ model_profile: 'balanced' });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-nonexistent'), 'sonnet');
    });

    test('returns sonnet for unknown agent type even with inherit profile', () => {
      writeConfig({ model_profile: 'inherit' });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-nonexistent'), 'sonnet');
    });

    test('defaults to balanced profile when model_profile missing', () => {
      writeConfig({});
      // balanced profile, gsd-planner -> opus
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'opus');
    });
  });
});

// ─── escapeRegex ───────────────────────────────────────────────────────────────

describe('escapeRegex', () => {
  test('escapes dots', () => {
    assert.strictEqual(escapeRegex('file.txt'), 'file\\.txt');
  });

  test('escapes all special regex characters', () => {
    const input = '1.0 (alpha) [test] {ok} $100 ^start end$ a+b a*b a?b pipe|or back\\slash';
    const result = escapeRegex(input);
    // Verify each special char is escaped
    assert.ok(result.includes('\\.'));
    assert.ok(result.includes('\\('));
    assert.ok(result.includes('\\)'));
    assert.ok(result.includes('\\['));
    assert.ok(result.includes('\\]'));
    assert.ok(result.includes('\\{'));
    assert.ok(result.includes('\\}'));
    assert.ok(result.includes('\\$'));
    assert.ok(result.includes('\\^'));
    assert.ok(result.includes('\\+'));
    assert.ok(result.includes('\\*'));
    assert.ok(result.includes('\\?'));
    assert.ok(result.includes('\\|'));
    assert.ok(result.includes('\\\\'));
  });

  test('handles empty string', () => {
    assert.strictEqual(escapeRegex(''), '');
  });

  test('returns plain string unchanged', () => {
    assert.strictEqual(escapeRegex('hello'), 'hello');
  });
});

// ─── generateSlugInternal ──────────────────────────────────────────────────────

describe('generateSlugInternal', () => {
  test('converts text to lowercase kebab-case', () => {
    assert.strictEqual(generateSlugInternal('Hello World'), 'hello-world');
  });

  test('removes special characters', () => {
    assert.strictEqual(generateSlugInternal('core.cjs Tests!'), 'core-cjs-tests');
  });

  test('trims leading and trailing hyphens', () => {
    assert.strictEqual(generateSlugInternal('---hello---'), 'hello');
  });

  test('returns null for null input', () => {
    assert.strictEqual(generateSlugInternal(null), null);
  });

  test('returns null for empty string', () => {
    assert.strictEqual(generateSlugInternal(''), null);
  });
});

// ─── normalizePhaseName / comparePhaseNum ──────────────────────────────────────
// NOTE: Comprehensive tests for normalizePhaseName and comparePhaseNum are in
// phase.test.cjs (which covers all edge cases: hybrid, letter-suffix,
// multi-level decimal, case-insensitive, directory-slug, and full sort order).
// Removed duplicates here to keep a single authoritative test location.

// ─── safeReadFile ──────────────────────────────────────────────────────────────

describe('safeReadFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reads existing file', () => {
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello world');
    assert.strictEqual(safeReadFile(filePath), 'hello world');
  });

  test('returns null for missing file', () => {
    assert.strictEqual(safeReadFile('/nonexistent/path/file.txt'), null);
  });
});

// ─── pathExistsInternal ────────────────────────────────────────────────────────

describe('pathExistsInternal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns true for existing path', () => {
    assert.strictEqual(pathExistsInternal(tmpDir, '.planning'), true);
  });

  test('returns false for non-existing path', () => {
    assert.strictEqual(pathExistsInternal(tmpDir, 'nonexistent'), false);
  });

  test('handles absolute paths', () => {
    assert.strictEqual(pathExistsInternal(tmpDir, tmpDir), true);
  });
});

// ─── getMilestoneInfo ──────────────────────────────────────────────────────────

describe('getMilestoneInfo', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('extracts version and name from roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n## Roadmap v1.2: My Cool Project\n\nSome content'
    );
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v1.2');
    assert.strictEqual(info.name, 'My Cool Project');
  });

  test('returns defaults when roadmap missing', () => {
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v1.0');
    assert.strictEqual(info.name, 'milestone');
  });

  test('returns active milestone when shipped milestone is collapsed in details block', () => {
    const roadmap = [
      '# Milestones',
      '',
      '| Version | Status |',
      '|---------|--------|',
      '| v0.1    | Shipped |',
      '| v0.2    | Active |',
      '',
      '<details>',
      '<summary>v0.1 — Legacy Feature Parity (Shipped)</summary>',
      '',
      '## Roadmap v0.1: Legacy Feature Parity',
      '',
      '### Phase 1: Core Setup',
      'Some content about phase 1',
      '',
      '</details>',
      '',
      '## Roadmap v0.2: Dashboard Overhaul',
      '',
      '### Phase 8: New Dashboard Layout',
      'Some content about phase 8',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v0.2');
    assert.strictEqual(info.name, 'Dashboard Overhaul');
  });

  test('returns active milestone when multiple shipped milestones exist in details blocks', () => {
    const roadmap = [
      '# Milestones',
      '',
      '| Version | Status |',
      '|---------|--------|',
      '| v0.1    | Shipped |',
      '| v0.2    | Shipped |',
      '| v0.3    | Active |',
      '',
      '<details>',
      '<summary>v0.1 — Initial Release (Shipped)</summary>',
      '',
      '## Roadmap v0.1: Initial Release',
      '',
      '</details>',
      '',
      '<details>',
      '<summary>v0.2 — Feature Expansion (Shipped)</summary>',
      '',
      '## Roadmap v0.2: Feature Expansion',
      '',
      '</details>',
      '',
      '## Roadmap v0.3: Performance Tuning',
      '',
      '### Phase 12: Optimize Queries',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v0.3');
    assert.strictEqual(info.name, 'Performance Tuning');
  });

  test('returns defaults when roadmap has no heading matches', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\nSome content without version headings'
    );
    const info = getMilestoneInfo(tmpDir);
    assert.strictEqual(info.version, 'v1.0');
    assert.strictEqual(info.name, 'milestone');
  });
});

// ─── searchPhaseInDir ──────────────────────────────────────────────────────────

describe('searchPhaseInDir', () => {
  let tmpDir;
  let phasesDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-core-test-'));
    phasesDir = path.join(tmpDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('finds phase directory by normalized prefix', () => {
    fs.mkdirSync(path.join(phasesDir, '01-foundation'));
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.phase_number, '01');
    assert.strictEqual(result.phase_name, 'foundation');
  });

  test('returns plans and summaries', () => {
    const phaseDir = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(phaseDir);
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.ok(result.plans.includes('01-01-PLAN.md'));
    assert.ok(result.summaries.includes('01-01-SUMMARY.md'));
    assert.strictEqual(result.incomplete_plans.length, 0);
  });

  test('identifies incomplete plans', () => {
    const phaseDir = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(phaseDir);
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1');
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.strictEqual(result.incomplete_plans.length, 1);
    assert.ok(result.incomplete_plans.includes('01-02-PLAN.md'));
  });

  test('detects research and context files', () => {
    const phaseDir = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(phaseDir);
    fs.writeFileSync(path.join(phaseDir, '01-RESEARCH.md'), '# Research');
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context');
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.strictEqual(result.has_research, true);
    assert.strictEqual(result.has_context, true);
  });

  test('returns null when phase not found', () => {
    fs.mkdirSync(path.join(phasesDir, '01-foundation'));
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '99');
    assert.strictEqual(result, null);
  });

  test('generates phase_slug from directory name', () => {
    fs.mkdirSync(path.join(phasesDir, '01-core-cjs-tests'));
    const result = searchPhaseInDir(phasesDir, '.planning/phases', '01');
    assert.strictEqual(result.phase_slug, 'core-cjs-tests');
  });
});

// ─── findPhaseInternal ─────────────────────────────────────────────────────────

describe('findPhaseInternal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('finds phase in current phases directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'));
    const result = findPhaseInternal(tmpDir, '1');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.phase_number, '01');
  });

  test('returns null for non-existent phase', () => {
    const result = findPhaseInternal(tmpDir, '99');
    assert.strictEqual(result, null);
  });

  test('returns null for null phase', () => {
    const result = findPhaseInternal(tmpDir, null);
    assert.strictEqual(result, null);
  });

  test('searches archived milestones when not in current', () => {
    // Create archived milestone structure (no current phase match)
    const archiveDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0-phases', '01-foundation');
    fs.mkdirSync(archiveDir, { recursive: true });
    const result = findPhaseInternal(tmpDir, '1');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.archived, 'v1.0');
  });
});

// ─── getRoadmapPhaseInternal ───────────────────────────────────────────────────

describe('getRoadmapPhaseInternal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // Bug: getRoadmapPhaseInternal was missing from module.exports
  test('is exported from core.cjs (REG-02)', () => {
    assert.strictEqual(typeof getRoadmapPhaseInternal, 'function');
    // Also verify it works with a real roadmap (note: goal regex expects **Goal:** with colon inside bold)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Foundation\n**Goal:** Build the base\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '1');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.phase_name, 'Foundation');
    assert.strictEqual(result.goal, 'Build the base');
  });

  test('extracts phase name and goal from roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 2: API Layer\n**Goal:** Create REST endpoints\n**Depends on**: Phase 1\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '2');
    assert.strictEqual(result.phase_name, 'API Layer');
    assert.strictEqual(result.goal, 'Create REST endpoints');
  });

  test('returns goal when Goal uses colon-outside-bold format', () => {
    // **Goal**: (colon outside bold) is now supported alongside **Goal:**
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Foundation\n**Goal**: Build the base\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '1');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.phase_name, 'Foundation');
    assert.strictEqual(result.goal, 'Build the base');
  });

  test('returns null when roadmap missing', () => {
    const result = getRoadmapPhaseInternal(tmpDir, '1');
    assert.strictEqual(result, null);
  });

  test('returns null when phase not in roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Foundation\n**Goal**: Build the base\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '99');
    assert.strictEqual(result, null);
  });

  test('returns null for null phase number', () => {
    const result = getRoadmapPhaseInternal(tmpDir, null);
    assert.strictEqual(result, null);
  });

  test('extracts full section text', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Foundation\n**Goal**: Build the base\n**Requirements**: TEST-01\nSome details here\n\n### Phase 2: API\n**Goal**: REST\n'
    );
    const result = getRoadmapPhaseInternal(tmpDir, '1');
    assert.ok(result.section.includes('Phase 1: Foundation'));
    assert.ok(result.section.includes('Some details here'));
    // Should not include Phase 2 content
    assert.ok(!result.section.includes('Phase 2: API'));
  });
});

// ─── getMilestonePhaseFilter ────────────────────────────────────────────────────

describe('getMilestonePhaseFilter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('filters directories to only current milestone phases', () => {
    // ROADMAP lists only phases 5-7
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '## Roadmap v2.0: Next Release',
        '',
        '### Phase 5: Auth',
        '**Goal:** Add authentication',
        '',
        '### Phase 6: Dashboard',
        '**Goal:** Build dashboard',
        '',
        '### Phase 7: Polish',
        '**Goal:** Final polish',
      ].join('\n')
    );

    // Create phase dirs 1-7 on disk (leftover from previous milestones)
    for (let i = 1; i <= 7; i++) {
      const padded = String(i).padStart(2, '0');
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', `${padded}-phase-${i}`));
    }

    const filter = getMilestonePhaseFilter(tmpDir);

    // Only phases 5, 6, 7 should match
    assert.strictEqual(filter('05-auth'), true);
    assert.strictEqual(filter('06-dashboard'), true);
    assert.strictEqual(filter('07-polish'), true);

    // Phases 1-4 should NOT match
    assert.strictEqual(filter('01-phase-1'), false);
    assert.strictEqual(filter('02-phase-2'), false);
    assert.strictEqual(filter('03-phase-3'), false);
    assert.strictEqual(filter('04-phase-4'), false);
  });

  test('returns pass-all filter when ROADMAP.md is missing', () => {
    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('01-foundation'), true);
    assert.strictEqual(filter('99-anything'), true);
  });

  test('returns pass-all filter when ROADMAP has no phase headings', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\nSome content without phases.\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('01-foundation'), true);
    assert.strictEqual(filter('05-api'), true);
  });

  test('handles letter-suffix phases (e.g. 3A)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 3A: Sub-feature\n**Goal:** Sub work\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('03A-sub-feature'), true);
    assert.strictEqual(filter('03-main'), false);
    assert.strictEqual(filter('04-other'), false);
  });

  test('handles decimal phases (e.g. 5.1)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 5: Main\n**Goal:** Main work\n\n### Phase 5.1: Patch\n**Goal:** Patch work\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('05-main'), true);
    assert.strictEqual(filter('05.1-patch'), true);
    assert.strictEqual(filter('04-other'), false);
  });

  test('returns false for non-phase directory names', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Init\n**Goal:** Start\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);

    assert.strictEqual(filter('not-a-phase'), false);
    assert.strictEqual(filter('.gitkeep'), false);
  });

  test('phaseCount reflects ROADMAP phase count', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 5: Auth\n### Phase 6: Dashboard\n### Phase 7: Polish\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);
    assert.strictEqual(filter.phaseCount, 3);
  });

  test('phaseCount is 0 when ROADMAP is missing', () => {
    const filter = getMilestonePhaseFilter(tmpDir);
    assert.strictEqual(filter.phaseCount, 0);
  });

  test('phaseCount is 0 when ROADMAP has no phase headings', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\nSome content.\n'
    );

    const filter = getMilestonePhaseFilter(tmpDir);
    assert.strictEqual(filter.phaseCount, 0);
  });
});

// ─── normalizeMd ─────────────────────────────────────────────────────────────

describe('normalizeMd', () => {
  test('returns null/undefined/empty unchanged', () => {
    assert.strictEqual(normalizeMd(null), null);
    assert.strictEqual(normalizeMd(undefined), undefined);
    assert.strictEqual(normalizeMd(''), '');
  });

  test('MD022: adds blank lines around headings', () => {
    const input = 'Some text\n## Heading\nMore text\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('\n\n## Heading\n\n'), 'heading should have blank lines around it');
  });

  test('MD032: adds blank line before list after non-list content', () => {
    const input = 'Some text\n- item 1\n- item 2\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('Some text\n\n- item 1'), 'list should have blank line before it');
  });

  test('MD032: adds blank line after list before non-list content', () => {
    const input = '- item 1\n- item 2\nSome text\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('- item 2\n\nSome text'), 'list should have blank line after it');
  });

  test('MD032: does not add extra blank lines between list items', () => {
    const input = '- item 1\n- item 2\n- item 3\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('- item 1\n- item 2\n- item 3'), 'consecutive list items should not get blank lines');
  });

  test('MD031: adds blank lines around fenced code blocks', () => {
    const input = 'Some text\n```js\ncode\n```\nMore text\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('Some text\n\n```js'), 'code block should have blank line before');
    assert.ok(result.includes('```\n\nMore text'), 'code block should have blank line after');
  });

  test('MD012: collapses 3+ consecutive blank lines to 2', () => {
    const input = 'Line 1\n\n\n\n\nLine 2\n';
    const result = normalizeMd(input);
    assert.ok(!result.includes('\n\n\n'), 'should not have 3+ consecutive blank lines');
    assert.ok(result.includes('Line 1\n\nLine 2'), 'should collapse to double newline');
  });

  test('MD047: ensures file ends with single newline', () => {
    const input = 'Content';
    const result = normalizeMd(input);
    assert.ok(result.endsWith('\n'), 'should end with newline');
    assert.ok(!result.endsWith('\n\n'), 'should not end with double newline');
  });

  test('MD047: trims trailing multiple newlines', () => {
    const input = 'Content\n\n\n';
    const result = normalizeMd(input);
    assert.ok(result.endsWith('Content\n'), 'should end with single newline after content');
  });

  test('preserves frontmatter delimiters', () => {
    const input = '---\nkey: value\n---\n\n# Heading\n\nContent\n';
    const result = normalizeMd(input);
    assert.ok(result.startsWith('---\n'), 'should preserve opening frontmatter');
    assert.ok(result.includes('---\n\n# Heading'), 'should preserve frontmatter closing');
  });

  test('handles CRLF line endings', () => {
    const input = 'Some text\r\n## Heading\r\nMore text\r\n';
    const result = normalizeMd(input);
    assert.ok(!result.includes('\r'), 'should normalize to LF');
    assert.ok(result.includes('\n\n## Heading\n\n'), 'should add blank lines around heading');
  });

  test('handles ordered lists', () => {
    const input = 'Some text\n1. First\n2. Second\nMore text\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('Some text\n\n1. First'), 'ordered list should have blank line before');
  });

  test('does not add blank line between table and list', () => {
    const input = '| Col |\n|-----|\n| val |\n- item\n';
    const result = normalizeMd(input);
    // Table rows start with |, should not add extra blank before list after table
    assert.ok(result.includes('| val |\n\n- item'), 'list after table should have blank line');
  });

  test('complex real-world STATE.md-like content', () => {
    const input = [
      '# Project State',
      '## Current Position',
      'Phase: 5 of 10',
      'Status: Executing',
      '## Decisions',
      '- Decision 1',
      '- Decision 2',
      '## Blockers',
      'None',
    ].join('\n');
    const result = normalizeMd(input);
    // Every heading should have blank lines around it
    assert.ok(result.includes('\n\n## Current Position\n\n'), 'section heading needs blank lines');
    assert.ok(result.includes('\n\n## Decisions\n\n'), 'decisions heading needs blank lines');
    assert.ok(result.includes('\n\n## Blockers\n\n'), 'blockers heading needs blank lines');
    // List should have blank line before it
    assert.ok(result.includes('\n\n- Decision 1'), 'list needs blank line before');
  });
});

// ─── detectSubRepos ──────────────────────────────────────────────────────────

describe('detectSubRepos', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-detect-test-'));
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  test('returns empty array when no child directories have .git', () => {
    fs.mkdirSync(path.join(projectRoot, 'src'));
    fs.mkdirSync(path.join(projectRoot, 'lib'));
    assert.deepStrictEqual(detectSubRepos(projectRoot), []);
  });

  test('detects directories with .git', () => {
    fs.mkdirSync(path.join(projectRoot, 'backend', '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'frontend', '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'scripts')); // no .git
    assert.deepStrictEqual(detectSubRepos(projectRoot), ['backend', 'frontend']);
  });

  test('returns sorted results', () => {
    fs.mkdirSync(path.join(projectRoot, 'zeta', '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'alpha', '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'mid', '.git'), { recursive: true });
    assert.deepStrictEqual(detectSubRepos(projectRoot), ['alpha', 'mid', 'zeta']);
  });

  test('skips hidden directories', () => {
    fs.mkdirSync(path.join(projectRoot, '.hidden', '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'visible', '.git'), { recursive: true });
    assert.deepStrictEqual(detectSubRepos(projectRoot), ['visible']);
  });

  test('skips node_modules', () => {
    fs.mkdirSync(path.join(projectRoot, 'node_modules', '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'app', '.git'), { recursive: true });
    assert.deepStrictEqual(detectSubRepos(projectRoot), ['app']);
  });
});

// ─── loadConfig sub_repos auto-sync ──────────────────────────────────────────

describe('loadConfig sub_repos auto-sync', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-sync-test-'));
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  test('migrates multiRepo: true to sub_repos array', () => {
    // Create config with legacy multiRepo flag
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ multiRepo: true, model_profile: 'quality' })
    );
    // Create sub-repos
    fs.mkdirSync(path.join(projectRoot, 'backend', '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'frontend', '.git'), { recursive: true });

    const config = loadConfig(projectRoot);
    assert.deepStrictEqual(config.sub_repos, ['backend', 'frontend']);
    assert.strictEqual(config.commit_docs, false);

    // Verify config was persisted
    const saved = JSON.parse(fs.readFileSync(path.join(projectRoot, '.planning', 'config.json'), 'utf-8'));
    assert.deepStrictEqual(saved.sub_repos, ['backend', 'frontend']);
    assert.strictEqual(saved.multiRepo, undefined, 'multiRepo should be removed');
  });

  test('adds newly detected repos to sub_repos', () => {
    fs.mkdirSync(path.join(projectRoot, 'backend', '.git'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['backend'] })
    );

    // Add a new repo
    fs.mkdirSync(path.join(projectRoot, 'frontend', '.git'), { recursive: true });

    const config = loadConfig(projectRoot);
    assert.deepStrictEqual(config.sub_repos, ['backend', 'frontend']);
  });

  test('removes repos that no longer have .git', () => {
    fs.mkdirSync(path.join(projectRoot, 'backend', '.git'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['backend', 'old-repo'] })
    );

    const config = loadConfig(projectRoot);
    assert.deepStrictEqual(config.sub_repos, ['backend']);
  });

  test('does not sync when sub_repos is empty and no repos detected', () => {
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: [] })
    );

    const config = loadConfig(projectRoot);
    assert.deepStrictEqual(config.sub_repos, []);
  });
});

// ─── findProjectRoot ─────────────────────────────────────────────────────────

describe('findProjectRoot', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-root-test-'));
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  test('returns startDir when no .planning/ exists anywhere', () => {
    const subDir = path.join(projectRoot, 'backend');
    fs.mkdirSync(subDir);
    assert.strictEqual(findProjectRoot(subDir), subDir);
  });

  test('returns startDir when .planning/ is in startDir itself', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    assert.strictEqual(findProjectRoot(projectRoot), projectRoot);
  });

  test('walks up to parent with .planning/ and sub_repos config listing this dir', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['backend', 'frontend'] })
    );

    const backendDir = path.join(projectRoot, 'backend');
    fs.mkdirSync(backendDir);

    assert.strictEqual(findProjectRoot(backendDir), projectRoot);
  });

  test('walks up from nested sub-repo subdirectory', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['backend', 'frontend'] })
    );

    const deepDir = path.join(projectRoot, 'backend', 'src', 'services');
    fs.mkdirSync(deepDir, { recursive: true });

    assert.strictEqual(findProjectRoot(deepDir), projectRoot);
  });

  test('walks up via legacy multiRepo flag', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ multiRepo: true })
    );

    const backendDir = path.join(projectRoot, 'backend');
    fs.mkdirSync(path.join(backendDir, '.git'), { recursive: true });

    assert.strictEqual(findProjectRoot(backendDir), projectRoot);
  });

  test('walks up via .git heuristic when no config exists', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    // No config.json at all

    const backendDir = path.join(projectRoot, 'backend');
    fs.mkdirSync(path.join(backendDir, '.git'), { recursive: true });

    assert.strictEqual(findProjectRoot(backendDir), projectRoot);
  });

  test('does not walk up for dirs without .git when no sub_repos config', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });

    const scriptsDir = path.join(projectRoot, 'scripts');
    fs.mkdirSync(scriptsDir);

    assert.strictEqual(findProjectRoot(scriptsDir), scriptsDir);
  });

  test('handles planning.sub_repos nested config format', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ planning: { sub_repos: ['backend'] } })
    );

    const backendDir = path.join(projectRoot, 'backend');
    fs.mkdirSync(backendDir);

    assert.strictEqual(findProjectRoot(backendDir), projectRoot);
  });

  test('returns startDir when sub_repos is empty and no .git', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: [] })
    );

    const backendDir = path.join(projectRoot, 'backend');
    fs.mkdirSync(backendDir);

    assert.strictEqual(findProjectRoot(backendDir), backendDir);
  });
});
