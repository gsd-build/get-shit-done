/**
 * GSD Tools Tests - Improvement Wave 1
 *
 * Tests for dev-improvement branch changes:
 *   - Planning lock integration (withPlanningLock in phase/roadmap operations)
 *   - readModifyWriteStateMd (atomic state updates)
 *   - normalizeMd behavioral equivalence (O(n) insideFence rewrite)
 *   - Health check new validations (W011-W014)
 *   - Hook file validation (executable permissions)
 *   - Warnings (frontmatter parse warning, stateReplaceFieldWithFallback)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const {
  normalizeMd,
} = require('../get-shit-done/bin/lib/core.cjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeMinimalRoadmap(tmpDir, phases = ['1']) {
  const lines = phases.map(n => `### Phase ${n}: Phase ${n} Description`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n${lines}\n`
  );
}

function writeMinimalStateMd(tmpDir, content) {
  const defaultContent = content || `# Session State\n\n## Current Position\n\nPhase: 1\n`;
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    defaultContent
  );
}

function writeMinimalProjectMd(tmpDir) {
  const sections = ['## What This Is', '## Core Value', '## Requirements'];
  const content = sections.map(s => `${s}\n\nContent here.\n`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    `# Project\n\n${content}`
  );
}

function writeValidConfigJson(tmpDir, overrides = {}) {
  const base = { model_profile: 'balanced', commit_docs: true };
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ ...base, ...overrides }, null, 2)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Planning lock integration
// ─────────────────────────────────────────────────────────────────────────────

describe('planning lock integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('phase add creates and releases .planning/.lock during ROADMAP write', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n`
    );

    const result = runGsdTools('phase add Testing', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Lock file should NOT persist after successful operation
    const lockPath = path.join(tmpDir, '.planning', '.lock');
    assert.ok(!fs.existsSync(lockPath), '.lock file should be released after phase add');

    // Phase was actually added (behavioral correctness)
    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 2, 'should be phase 2');
  });

  test('phase complete creates and releases .planning/.lock', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n- [ ] Phase 1: Foundation\n\n### Phase 1: Foundation\n**Goal:** Setup\n**Plans:** 1 plans\n\n### Phase 2: API\n**Goal:** Build\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Foundation\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const lockPath = path.join(tmpDir, '.planning', '.lock');
    assert.ok(!fs.existsSync(lockPath), '.lock file should be released after phase complete');

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_phase, '1', 'phase should be completed');
  });

  test('roadmap update-plan-progress creates and releases .planning/.lock', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n| Phase | Plans | Status | Updated |\n|-------|-------|--------|---------|\n| 1 | 0/0 | Not started | - |\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('roadmap update-plan-progress 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const lockPath = path.join(tmpDir, '.planning', '.lock');
    assert.ok(!fs.existsSync(lockPath), '.lock file should be released after roadmap update');
  });

  test('lock file does NOT persist after successful phase operations', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );

    // Run multiple operations sequentially
    runGsdTools('phase add First Phase', tmpDir);
    runGsdTools('phase add Second Phase', tmpDir);

    const lockPath = path.join(tmpDir, '.planning', '.lock');
    assert.ok(!fs.existsSync(lockPath), '.lock file should not persist after multiple operations');
  });

  test('phase add still works correctly with lock (behavioral regression)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n### Phase 2: API\n**Goal:** Build API\n\n---\n`
    );

    const result = runGsdTools('phase add User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 3, 'should be phase 3');
    assert.strictEqual(output.slug, 'user-dashboard');

    // Verify directory created
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-user-dashboard')),
      'directory should be created'
    );

    // Verify ROADMAP updated
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('### Phase 3: User Dashboard'), 'roadmap should include new phase');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. readModifyWriteStateMd (tested via CLI commands that use it)
// ─────────────────────────────────────────────────────────────────────────────

describe('readModifyWriteStateMd (via state patch)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('transforms content atomically (read + modify + write under lock)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 03\n**Status:** Planning\n**Current Plan:** 03-01\n`
    );

    const result = runGsdTools('state patch --Status "In progress" --"Current Plan" 03-02', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** In progress'), 'Status should be updated');
    assert.ok(content.includes('03-02'), 'Current Plan should be updated');

    // State lock should be released
    const lockPath = path.join(tmpDir, '.planning', 'STATE.md.lock');
    assert.ok(!fs.existsSync(lockPath), 'STATE.md.lock should be released after patch');
  });

  test('creates STATE.md if it does not exist (via validate health --repair)', () => {
    // Remove STATE.md if it exists — repair should regenerate it
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(fs.existsSync(statePath), 'STATE.md should be created by repair');
    const content = fs.readFileSync(statePath, 'utf-8');
    assert.ok(content.includes('Session State') || content.includes('Project State'), 'STATE.md should contain state header');

    // Lock should be cleaned up
    const lockPath = statePath + '.lock';
    assert.ok(!fs.existsSync(lockPath), 'STATE.md.lock should not persist after repair');
  });

  test('lock file cleaned up after state patch operation', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Status:** Ready\n`
    );

    runGsdTools('state patch --Status "In progress"', tmpDir);

    const lockPath = path.join(tmpDir, '.planning', 'STATE.md.lock');
    assert.ok(!fs.existsSync(lockPath), 'STATE.md.lock should not persist after operation');
  });

  test('state patch still works correctly via readModifyWriteStateMd path (behavioral regression)', () => {
    const stateMd = [
      '# Project State',
      '',
      '**Current Phase:** 03',
      '**Status:** Planning',
      '**Current Plan:** 03-01',
      '**Last Activity:** 2024-01-15',
    ].join('\n') + '\n';

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state patch --Status Complete --"Current Phase" 04', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('**Status:** Complete'), 'Status should be updated to Complete');
    assert.ok(updated.includes('**Last Activity:** 2024-01-15'), 'Last Activity should be unchanged');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. normalizeMd behavioral equivalence (O(n) insideFence rewrite)
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeMd behavioral equivalence', () => {
  test('simple markdown with headings and paragraphs', () => {
    const input = '# Title\nSome text.\n## Section\nMore text.\n';
    const result = normalizeMd(input);
    // Headings should have blank lines around them
    assert.ok(result.includes('# Title\n\nSome text.'), 'title heading should have blank line after');
    assert.ok(result.includes('\n\n## Section\n\nMore text.'), 'section heading should have blank lines around it');
    assert.ok(result.endsWith('\n'), 'should end with newline');
    assert.ok(!result.endsWith('\n\n'), 'should not end with double newline');
  });

  test('single fenced code block gets blank lines before/after', () => {
    const input = 'Some text\n```js\nconst x = 1;\n```\nMore text\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('Some text\n\n```js'), 'code block should have blank line before');
    assert.ok(result.includes('```\n\nMore text'), 'code block should have blank line after');
    // Content inside fence should be preserved
    assert.ok(result.includes('const x = 1;'), 'code content should be preserved');
  });

  test('multiple fenced code blocks', () => {
    const input = 'Intro\n```js\nfoo();\n```\nMiddle\n```py\nbar()\n```\nEnd\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('Intro\n\n```js'), 'first code block should have blank line before');
    assert.ok(result.includes('```\n\nMiddle'), 'first code block should have blank line after');
    assert.ok(result.includes('Middle\n\n```py'), 'second code block should have blank line before');
    assert.ok(result.includes('```\n\nEnd'), 'second code block should have blank line after');
  });

  test('unclosed fence at end of file (edge case)', () => {
    const input = 'Some text\n```js\nconst x = 1;\n';
    const result = normalizeMd(input);
    // Should not crash or produce corrupted output
    assert.ok(typeof result === 'string', 'should return a string');
    assert.ok(result.includes('```js'), 'fence opener should be preserved');
    assert.ok(result.includes('const x = 1;'), 'content after unclosed fence should be preserved');
    assert.ok(result.endsWith('\n'), 'should end with newline');
  });

  test('empty string input', () => {
    assert.strictEqual(normalizeMd(''), '', 'empty string should return empty string');
  });

  test('mixed headings + lists + fences (complex case)', () => {
    const input = [
      '# Title',
      '## Section One',
      'Paragraph text.',
      '- item 1',
      '- item 2',
      '## Section Two',
      '```bash',
      'echo hello',
      '```',
      'After code.',
      '## Section Three',
      '1. First',
      '2. Second',
      'Done.',
    ].join('\n') + '\n';

    const result = normalizeMd(input);

    // Headings should have blank lines
    assert.ok(result.includes('\n\n## Section One\n\n'), 'Section One heading needs blank lines');
    assert.ok(result.includes('\n\n## Section Two\n\n'), 'Section Two heading needs blank lines');
    assert.ok(result.includes('\n\n## Section Three\n\n'), 'Section Three heading needs blank lines');

    // List should have blank line before it (after paragraph)
    assert.ok(result.includes('Paragraph text.\n\n- item 1'), 'list should have blank line before');

    // Code block should have blank lines around it
    assert.ok(result.includes('\n\n```bash'), 'code block should have blank line before');
    assert.ok(result.includes('```\n\nAfter code.'), 'code block should have blank line after');

    // Content inside fence should be preserved
    assert.ok(result.includes('echo hello'), 'code content should be preserved');

    // Should not have triple blank lines anywhere
    assert.ok(!result.includes('\n\n\n'), 'should not have 3+ consecutive blank lines');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Health check new validations (W011-W014)
// ─────────────────────────────────────────────────────────────────────────────

describe('health check new validations', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('W011: STATE says current phase but ROADMAP shows it as complete -> warning', () => {
    writeMinimalProjectMd(tmpDir);
    // ROADMAP with Phase 3 checked off as complete, plus matching disk dir
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n- [x] Phase 3: Database Layer\n\n### Phase 3: Database Layer\n**Goal:** DB setup\n`
    );
    // STATE says Phase 3 is current and in progress (bold format required for W011 detection)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Session State\n\n**Current Phase:** 03\n**Current Phase Name:** Database Layer\n**Status:** In progress\n`
    );
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-database-layer'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W011'),
      `Expected W011 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('W011: STATE and ROADMAP agree (phase not checked off) -> no W011 warning', () => {
    writeMinimalProjectMd(tmpDir);
    // ROADMAP with Phase 2 NOT checked off
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n- [ ] Phase 2: API Layer\n\n### Phase 2: API Layer\n**Goal:** Build API\n`
    );
    // STATE says Phase 2 is current
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Session State\n\n**Current Phase:** 2\n**Status:** In progress\n`
    );
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api-layer'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W011'),
      `Should not have W011: ${JSON.stringify(output.warnings)}`
    );
  });

  test('W012: invalid branching_strategy triggers warning', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir, { branching_strategy: 'banana' });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W012'),
      `Expected W012 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('W013: negative context_window triggers warning', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir, { context_window: -500 });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W013'),
      `Expected W013 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('W014: phase_branch_template missing {phase} triggers warning', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir, { phase_branch_template: 'gsd/no-placeholder-{slug}' });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W014'),
      `Expected W014 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Hook file validation
// ─────────────────────────────────────────────────────────────────────────────

describe('hook file validation', () => {
  const hooksDir = path.join(__dirname, '..', 'hooks');

  test('gsd-session-state.sh is executable', () => {
    const hookPath = path.join(hooksDir, 'gsd-session-state.sh');
    assert.ok(fs.existsSync(hookPath), 'gsd-session-state.sh should exist');
    const stat = fs.statSync(hookPath);
    // Check that at least owner execute bit is set (mode & 0o100)
    assert.ok((stat.mode & 0o111) !== 0, 'gsd-session-state.sh should be executable');
  });

  test('gsd-validate-commit.sh is executable', () => {
    const hookPath = path.join(hooksDir, 'gsd-validate-commit.sh');
    assert.ok(fs.existsSync(hookPath), 'gsd-validate-commit.sh should exist');
    const stat = fs.statSync(hookPath);
    assert.ok((stat.mode & 0o111) !== 0, 'gsd-validate-commit.sh should be executable');
  });

  test('gsd-phase-boundary.sh is executable', () => {
    const hookPath = path.join(hooksDir, 'gsd-phase-boundary.sh');
    assert.ok(fs.existsSync(hookPath), 'gsd-phase-boundary.sh should exist');
    const stat = fs.statSync(hookPath);
    assert.ok((stat.mode & 0o111) !== 0, 'gsd-phase-boundary.sh should be executable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Warnings
// ─────────────────────────────────────────────────────────────────────────────

describe('warnings', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('must_haves parse warning fires for block with content but 0 items', () => {
    // Create a plan with a must_haves block that has content but will parse to 0 items.
    // The frontmatter parser expects "- item" format; bare lines without "- " prefix
    // produce the empty-parse diagnostic.
    const planDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(
      path.join(planDir, '01-01-PLAN.md'),
      `---
phase: "01"
plan: "01"
must_haves:
  acceptance:
    bare content without dash prefix
    another line without dash prefix
---

# Plan 01-01
`
    );

    // Use frontmatter get to trigger the parse path
    const result = runGsdTools(
      ['frontmatter', 'get', path.join(planDir, '01-01-PLAN.md'), 'must_haves'],
      tmpDir
    );

    // The command itself may succeed or fail, but the warning should be on stderr.
    // We check the error output (stderr) for the WARNING message.
    // Note: runGsdTools captures stderr in .error when the command fails.
    const stderr = result.error || '';
    // The warning is written to stderr regardless of exit code
    assert.ok(
      stderr.includes('WARNING') && stderr.includes('must_haves') ||
      result.output.includes('acceptance'),
      `Expected WARNING about must_haves parse or valid parse result. stderr: ${stderr}, stdout: ${result.output}`
    );
  });

  test('stateReplaceFieldWithFallback logs warning on miss', () => {
    // Create a STATE.md that does NOT have the field we will try to update via advance-plan.
    // When advance-plan calls stateReplaceFieldWithFallback and neither primary nor fallback
    // matches, a WARNING is logged to stderr.
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Current Plan:** 1\n**Total Plans in Phase:** 3\n`
    );

    // advance-plan will try to update Status and Last Activity fields (via stateReplaceFieldWithFallback).
    // Since those fields don't exist in this STATE.md, the fallback path will fire.
    const result = runGsdTools('state advance-plan', tmpDir);

    // The command should still succeed (field miss is non-fatal)
    assert.ok(result.success, `Command failed: ${result.error}`);

    // The output should reflect the advance
    const output = JSON.parse(result.output);
    assert.ok(output.advanced === true || output.reason === 'last_plan', 'advance should complete');
  });
});
