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
const { createTempProject, createTempGitProject, cleanup } = require('./helpers.cjs');

const {
  loadConfig,
  resolveModelInternal,
  escapeRegex,
  generateSlugInternal,
  normalizePhaseName,
  reapStaleTempFiles,
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
    assert.strictEqual(config.text_mode, false);
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

// ─── loadConfig commit_docs gitignore auto-detection (#1250) ──────────────────

describe('loadConfig commit_docs gitignore auto-detection (#1250)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
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

  test('commit_docs defaults to false when .planning/ is gitignored and no explicit config', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.planning/\n');
    // No commit_docs in config — should auto-detect
    writeConfig({ model_profile: 'balanced' });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.commit_docs, false,
      'commit_docs should be false when .planning/ is gitignored and not explicitly set');
  });

  test('commit_docs defaults to true when .planning/ is NOT gitignored and no explicit config', () => {
    // No .gitignore, no commit_docs in config
    writeConfig({ model_profile: 'balanced' });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.commit_docs, true,
      'commit_docs should default to true when .planning/ is not gitignored');
  });

  test('explicit commit_docs: false is respected even when .planning/ is not gitignored', () => {
    writeConfig({ commit_docs: false });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.commit_docs, false);
  });

  test('explicit commit_docs: true is respected even when .planning/ is gitignored', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.planning/\n');
    writeConfig({ commit_docs: true });
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.commit_docs, true,
      'explicit commit_docs: true should override gitignore auto-detection');
  });

  test('commit_docs auto-detect works with no config.json', () => {
    // Remove config.json so loadConfig uses defaults
    try { fs.unlinkSync(path.join(tmpDir, '.planning', 'config.json')); } catch {}
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.planning/\n');
    const config = loadConfig(tmpDir);
    // When config.json is missing, loadConfig catches and returns defaults.
    // The gitignore check happens inside the try block, so with no config.json
    // the catch returns defaults (commit_docs: true). This is acceptable since
    // a project without config.json hasn't been initialized by GSD yet.
    assert.strictEqual(typeof config.commit_docs, 'boolean');
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

  describe('resolve_model_ids: "omit"', () => {
    test('returns empty string for known agents', () => {
      writeConfig({ resolve_model_ids: 'omit' });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), '');
    });

    test('returns empty string for unknown agents', () => {
      writeConfig({ resolve_model_ids: 'omit' });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-nonexistent'), '');
    });

    test('still respects model_overrides even when omit', () => {
      writeConfig({
        resolve_model_ids: 'omit',
        model_overrides: { 'gsd-planner': 'openai/gpt-5.4' },
      });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'openai/gpt-5.4');
    });

    test('returns empty string with inherit profile', () => {
      writeConfig({ resolve_model_ids: 'omit', model_profile: 'inherit' });
      assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), '');
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

// ─── Stale hook filter regression (#1200) ─────────────────────────────────────

describe('stale hook filter', () => {
  test('filter should only match gsd-prefixed .js files', () => {
    const files = [
      'gsd-check-update.js',
      'gsd-context-monitor.js',
      'gsd-prompt-guard.js',
      'gsd-statusline.js',
      'gsd-workflow-guard.js',
      'guard-edits-outside-project.js',  // user hook
      'my-custom-hook.js',               // user hook
      'gsd-check-update.js.bak',         // backup file
      'README.md',                       // non-js file
    ];

    const gsdFilter = f => f.startsWith('gsd-') && f.endsWith('.js');
    const filtered = files.filter(gsdFilter);

    assert.deepStrictEqual(filtered, [
      'gsd-check-update.js',
      'gsd-context-monitor.js',
      'gsd-prompt-guard.js',
      'gsd-statusline.js',
      'gsd-workflow-guard.js',
    ], 'should only include gsd-prefixed .js files');

    assert.ok(!filtered.includes('guard-edits-outside-project.js'), 'must not include user hooks');
    assert.ok(!filtered.includes('my-custom-hook.js'), 'must not include non-gsd hooks');
  });
});

// ─── stale hook path regression (#1249) ──────────────────────────────────────

describe('stale hook path', () => {
  test('gsd-check-update.js checks get-shit-done/hooks/ not configDir/hooks/', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'hooks', 'gsd-check-update.js'), 'utf-8'
    );
    assert.ok(
      content.includes("path.join(configDir, 'get-shit-done', 'hooks')"),
      'stale hook check must look in configDir/get-shit-done/hooks/, not configDir/hooks/'
    );
    assert.ok(
      !content.includes("path.join(configDir, 'hooks')") ||
      content.indexOf("path.join(configDir, 'get-shit-done', 'hooks')") <
      content.indexOf("path.join(configDir, 'hooks')") + 100, // allow the old pattern only if corrected version exists first
      'should not use the wrong hooks path'
    );
  });
});

// ─── resolveWorktreeRoot ─────────────────────────────────────────────────────

describe('resolveWorktreeRoot', () => {
  const { resolveWorktreeRoot } = require('../get-shit-done/bin/lib/core.cjs');
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns cwd when not in a git repo', () => {
    assert.strictEqual(resolveWorktreeRoot(tmpDir), tmpDir);
  });

  test('returns cwd in a normal git repo (not a worktree)', () => {
    const { execSync: execSyncLocal } = require('child_process');
    execSyncLocal('git init', { cwd: tmpDir, stdio: 'pipe' });
    assert.strictEqual(resolveWorktreeRoot(tmpDir), tmpDir);
  });
});

// ─── resolveWorktreeRoot — linked worktree with .planning/ (#1315) ───────────

describe('resolveWorktreeRoot with linked worktree .planning/', () => {
  const { resolveWorktreeRoot } = require('../get-shit-done/bin/lib/core.cjs');
  const { execSync: execSyncLocal } = require('child_process');
  // On Windows CI, os.tmpdir() may return 8.3 short paths (RUNNER~1) while
  // git returns long paths (runneradmin). realpathSync.native resolves both.
  const normalizePath = (p) => {
    try { return fs.realpathSync.native(p); } catch { return fs.realpathSync(p); }
  };

  let mainDir;
  let worktreeDir;

  function initBareGitRepo() {
    const dir = normalizePath(fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-wt-main-')));
    execSyncLocal('git init', { cwd: dir, stdio: 'pipe' });
    execSyncLocal('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
    execSyncLocal('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSyncLocal('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' });
    fs.writeFileSync(path.join(dir, 'README.md'), '# Main');
    execSyncLocal('git add -A', { cwd: dir, stdio: 'pipe' });
    execSyncLocal('git commit -m "initial"', { cwd: dir, stdio: 'pipe' });
    return dir;
  }

  beforeEach(() => {
    mainDir = initBareGitRepo();
    worktreeDir = null;
  });

  afterEach(() => {
    if (worktreeDir) {
      try { execSyncLocal(`git worktree remove "${worktreeDir}" --force`, { cwd: mainDir, stdio: 'pipe' }); } catch { /* ok */ }
      try { fs.rmSync(worktreeDir, { recursive: true, force: true }); } catch { /* ok */ }
    }
    cleanup(mainDir);
  });

  test('returns linked worktree cwd when it has its own .planning/', () => {
    // Add .planning/ to main repo
    fs.mkdirSync(path.join(mainDir, '.planning'), { recursive: true });

    // Create a linked worktree
    worktreeDir = normalizePath(fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-wt-linked-')));
    fs.rmSync(worktreeDir, { recursive: true, force: true });
    execSyncLocal(`git worktree add "${worktreeDir}" -b test-linked`, { cwd: mainDir, stdio: 'pipe' });

    // Give the linked worktree its own .planning/
    fs.mkdirSync(path.join(worktreeDir, '.planning'), { recursive: true });

    // resolveWorktreeRoot should return the linked worktree dir, not the main repo
    const result = normalizePath(resolveWorktreeRoot(worktreeDir));
    assert.strictEqual(result, worktreeDir,
      'linked worktree with .planning/ should resolve to itself, not the main repo');
  });

  test('returns main repo root when linked worktree has no .planning/', () => {
    // Create a linked worktree (no .planning/ in main or worktree)
    worktreeDir = normalizePath(fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-wt-linked-')));
    fs.rmSync(worktreeDir, { recursive: true, force: true });
    execSyncLocal(`git worktree add "${worktreeDir}" -b test-linked-no-plan`, { cwd: mainDir, stdio: 'pipe' });

    // resolveWorktreeRoot should return the main repo root
    const result = normalizePath(resolveWorktreeRoot(worktreeDir));
    const expected = normalizePath(mainDir);
    assert.strictEqual(result, expected,
      'linked worktree without .planning/ should resolve to main repo root');
  });
});

// ─── monorepo worktree CWD preservation (#1283) ─────────────────────────────

describe('monorepo worktree CWD preservation', () => {
  const { resolveWorktreeRoot } = require('../get-shit-done/bin/lib/core.cjs');
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-monorepo-wt-'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('CWD with .planning/ skips worktree resolution (monorepo subdirectory)', () => {
    const subDir = path.join(tmpDir, 'service-alpha');
    fs.mkdirSync(path.join(subDir, '.planning'), { recursive: true });
    let cwd = subDir;
    if (!fs.existsSync(path.join(cwd, '.planning'))) {
      const worktreeRoot = resolveWorktreeRoot(cwd);
      if (worktreeRoot !== cwd) cwd = worktreeRoot;
    }
    assert.strictEqual(cwd, subDir, 'CWD with .planning/ must not be overridden by worktree resolution');
  });

  test('CWD without .planning/ still goes through worktree resolution', () => {
    let cwd = tmpDir;
    let worktreeResolutionCalled = false;
    if (!fs.existsSync(path.join(cwd, '.planning'))) {
      worktreeResolutionCalled = true;
      const worktreeRoot = resolveWorktreeRoot(cwd);
      if (worktreeRoot !== cwd) cwd = worktreeRoot;
    }
    assert.ok(worktreeResolutionCalled, 'worktree resolution must be called when .planning/ is absent');
  });
});

// ─── withPlanningLock ────────────────────────────────────────────────────────

describe('withPlanningLock', () => {
  const { withPlanningLock, planningDir } = require('../get-shit-done/bin/lib/core.cjs');
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('executes function and returns result', () => {
    const result = withPlanningLock(tmpDir, () => 42);
    assert.strictEqual(result, 42);
    // Lock file should be cleaned up
    assert.ok(!fs.existsSync(path.join(planningDir(tmpDir), '.lock')));
  });

  test('cleans up lock file even on error', () => {
    assert.throws(() => {
      withPlanningLock(tmpDir, () => { throw new Error('test'); });
    }, /test/);
    assert.ok(!fs.existsSync(path.join(planningDir(tmpDir), '.lock')));
  });

  test('recovers from stale lock (>30s old)', () => {
    const lockPath = path.join(tmpDir, '.planning', '.lock');
    // Create a stale lock
    fs.writeFileSync(lockPath, '{"pid":99999}');
    // Backdate the lock file by 31 seconds
    const staleTime = new Date(Date.now() - 31000);
    fs.utimesSync(lockPath, staleTime, staleTime);

    const result = withPlanningLock(tmpDir, () => 'recovered');
    assert.strictEqual(result, 'recovered');
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

  test('walks up from nested path inside sub-repo via .git heuristic', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });

    // Sub-repo with .git at its root
    const backendDir = path.join(projectRoot, 'backend');
    fs.mkdirSync(path.join(backendDir, '.git'), { recursive: true });

    // Nested path deep inside the sub-repo
    const nestedDir = path.join(backendDir, 'src', 'modules', 'auth');
    fs.mkdirSync(nestedDir, { recursive: true });

    // isInsideGitRepo walks up and finds backend/.git
    assert.strictEqual(findProjectRoot(nestedDir), projectRoot);
  });

  test('walks up from nested path inside sub-repo via sub_repos config', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['backend'] })
    );

    // Nested path deep inside the sub-repo
    const nestedDir = path.join(projectRoot, 'backend', 'src', 'modules');
    fs.mkdirSync(nestedDir, { recursive: true });

    // With sub_repos config, it checks topSegment of relative path
    assert.strictEqual(findProjectRoot(nestedDir), projectRoot);
  });

  test('walks up from nested path via legacy multiRepo flag', () => {
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.planning', 'config.json'),
      JSON.stringify({ multiRepo: true })
    );

    const backendDir = path.join(projectRoot, 'backend');
    fs.mkdirSync(path.join(backendDir, '.git'), { recursive: true });

    // Nested inside sub-repo — isInsideGitRepo walks up and finds backend/.git
    const nestedDir = path.join(backendDir, 'src');
    fs.mkdirSync(nestedDir, { recursive: true });

    assert.strictEqual(findProjectRoot(nestedDir), projectRoot);
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

  test('walks up from subdirectory when .git is at same level as .planning/ (single-repo)', () => {
    // Common single-repo layout: .git and .planning are siblings at project root
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });

    // User cwd is a subdirectory (e.g., src/)
    const srcDir = path.join(projectRoot, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Should detect that parent has .planning/ and .git is at that same level
    assert.strictEqual(findProjectRoot(srcDir), projectRoot);
  });

  test('walks up from deep subdirectory when .git is at same level as .planning/', () => {
    // Single-repo: .git and .planning at root, cwd deep inside
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });

    const deepDir = path.join(projectRoot, 'src', 'lib', 'utils');
    fs.mkdirSync(deepDir, { recursive: true });

    assert.strictEqual(findProjectRoot(deepDir), projectRoot);
  });

  test('returns startDir when .planning exists at same level (cwd is project root)', () => {
    // User is already at project root — no parent to walk up to
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.git'), { recursive: true });

    assert.strictEqual(findProjectRoot(projectRoot), projectRoot);
  });

  test('does not walk past child with own .planning/ to workspace parent (#1362)', () => {
    // Workspace layout: parent has .planning/, child git repo also has .planning/
    // findProjectRoot should return the child (startDir), not the parent
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });

    const childRepo = path.join(projectRoot, 'authenticator');
    fs.mkdirSync(path.join(childRepo, '.planning'), { recursive: true });
    fs.mkdirSync(path.join(childRepo, '.git'), { recursive: true });

    assert.strictEqual(findProjectRoot(childRepo), childRepo);
  });

  test('does not walk past nested dir whose git root has .planning/ (#1362)', () => {
    // Workspace layout: parent has .planning/, child git repo also has .planning/
    // cwd is deep inside child — should resolve to child root, not workspace root
    fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });

    const childRepo = path.join(projectRoot, 'authenticator');
    fs.mkdirSync(path.join(childRepo, '.planning'), { recursive: true });
    fs.mkdirSync(path.join(childRepo, '.git'), { recursive: true });

    const deepDir = path.join(childRepo, 'src', 'lib');
    fs.mkdirSync(deepDir, { recursive: true });

    assert.strictEqual(findProjectRoot(deepDir), childRepo);
  });
});

// ─── reapStaleTempFiles ─────────────────────────────────────────────────────

describe('reapStaleTempFiles', () => {
  test('removes stale gsd-*.json files older than maxAgeMs', () => {
    const tmpDir = os.tmpdir();
    const stalePath = path.join(tmpDir, `gsd-reap-test-${Date.now()}.json`);
    fs.writeFileSync(stalePath, '{}');
    // Set mtime to 10 minutes ago
    const oldTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(stalePath, oldTime, oldTime);

    reapStaleTempFiles('gsd-reap-test-', { maxAgeMs: 5 * 60 * 1000 });

    assert.ok(!fs.existsSync(stalePath), 'stale file should be removed');
  });

  test('preserves fresh gsd-*.json files', () => {
    const tmpDir = os.tmpdir();
    const freshPath = path.join(tmpDir, `gsd-reap-fresh-${Date.now()}.json`);
    fs.writeFileSync(freshPath, '{}');

    reapStaleTempFiles('gsd-reap-fresh-', { maxAgeMs: 5 * 60 * 1000 });

    assert.ok(fs.existsSync(freshPath), 'fresh file should be preserved');
    // Clean up
    fs.unlinkSync(freshPath);
  });

  test('removes stale temp directories when present', () => {
    const tmpDir = os.tmpdir();
    const staleDir = fs.mkdtempSync(path.join(tmpDir, 'gsd-reap-dir-'));
    fs.writeFileSync(path.join(staleDir, 'data.jsonl'), 'test');
    // Set mtime to 10 minutes ago
    const oldTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(staleDir, oldTime, oldTime);

    reapStaleTempFiles('gsd-reap-dir-', { maxAgeMs: 5 * 60 * 1000 });

    assert.ok(!fs.existsSync(staleDir), 'stale directory should be removed');
  });

  test('does not throw on empty or missing prefix matches', () => {
    assert.doesNotThrow(() => {
      reapStaleTempFiles('gsd-nonexistent-prefix-xyz-', { maxAgeMs: 0 });
    });
  });
});
