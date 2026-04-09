/**
 * GSD Tools Tests - Health Validation
 *
 * Tests for fix/health-validation-1473c:
 *   - W011: STATE/ROADMAP cross-validation (phase divergence detection)
 *   - W012: branching_strategy validation
 *   - W013: context_window validation
 *   - W014: phase_branch_template placeholder validation
 *   - W015: milestone_branch_template placeholder validation
 *   - stateReplaceFieldWithFallback field-miss warning
 *   - Boundary conditions and edge cases
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

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
// 1. W011: STATE/ROADMAP cross-validation
// ─────────────────────────────────────────────────────────────────────────────

describe('W011: STATE/ROADMAP cross-validation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('STATE says current phase but ROADMAP shows it as complete -> warning', () => {
    writeMinimalProjectMd(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n- [x] Phase 3: Database Layer\n\n### Phase 3: Database Layer\n**Goal:** DB setup\n`
    );
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

  test('STATE and ROADMAP agree (phase not checked off) -> no W011 warning', () => {
    writeMinimalProjectMd(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n- [ ] Phase 2: API Layer\n\n### Phase 2: API Layer\n**Goal:** Build API\n`
    );
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
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. W012-W015: Config field validation
// ─────────────────────────────────────────────────────────────────────────────

describe('config field validation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
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

  test('W015: milestone_branch_template missing {milestone} triggers warning', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir, { milestone_branch_template: 'release/no-placeholder' });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.code === 'W015'),
      `Expected W015 in warnings: ${JSON.stringify(output.warnings)}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Boundary conditions
// ─────────────────────────────────────────────────────────────────────────────

describe('boundary conditions', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('context_window config accepts 500000 (boundary value)', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir, { context_window: 500000 });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W013'),
      `Should not have W013 for context_window=500000: ${JSON.stringify(output.warnings)}`
    );
  });

  test('context_window config accepts 200000 (default value)', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir, { context_window: 200000 });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W013'),
      `Should not have W013 for context_window=200000: ${JSON.stringify(output.warnings)}`
    );
  });

  test('W013 does NOT fire when context_window is absent from config', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      !output.warnings.some(w => w.code === 'W013'),
      `Should not have W013 when context_window is absent: ${JSON.stringify(output.warnings)}`
    );
  });

  test('health check handles STATE.md with no Current Phase field (no W011 crash)', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nSome content but no phase reference.\n');
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(typeof output.status === 'string', 'should return a status string');
    assert.ok(Array.isArray(output.errors), 'should return errors array');
    assert.ok(Array.isArray(output.warnings), 'should return warnings array');
  });

  test('health check handles empty ROADMAP.md (no crash)', () => {
    writeMinimalProjectMd(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '');
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1.\n');
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command should not crash on empty ROADMAP.md: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(typeof output.status === 'string', 'should return a status string');
    assert.ok(Array.isArray(output.errors), 'should return errors array');
    assert.ok(Array.isArray(output.warnings), 'should return warnings array');
  });

  test('config.json with trailing comma -- validate health reports parse error', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1.\n');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      '{"model_profile": "balanced",}'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Test Phase\n'
    );

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `validate health should not crash on invalid JSON: ${result.error}`);

    const output = JSON.parse(result.output);
    const hasE005 = output.errors.some(e => e.code === 'E005');
    assert.ok(hasE005, `Should report E005 for invalid config.json: ${JSON.stringify(output.errors)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. stateReplaceFieldWithFallback warning
// ─────────────────────────────────────────────────────────────────────────────

describe('stateReplaceFieldWithFallback field-miss warning', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('advance-plan completes even when fields are missing (non-fatal)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Current Plan:** 1\n**Total Plans in Phase:** 3\n`
    );

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.advanced === true || output.reason === 'last_plan', 'advance should complete');
  });

  test('validate health on 50-phase project completes in under 3000ms', () => {
    // Stress test for the new health checks at scale
    let roadmapContent = '# Roadmap v1.0\n\n';
    for (let i = 1; i <= 50; i++) {
      roadmapContent += `- [${i <= 25 ? 'x' : ' '}] Phase ${i}: Feature ${i}\n`;
    }
    roadmapContent += '\n';
    for (let i = 1; i <= 50; i++) {
      const pad = String(i).padStart(2, '0');
      roadmapContent += `### Phase ${i}: Feature ${i}\n\n**Goal:** Build feature ${i}\n**Plans:** 1 plans\n\n`;
    }
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmapContent);

    writeMinimalProjectMd(tmpDir);
    writeMinimalStateMd(tmpDir, '# Session State\n\n**Current Phase:** 26\n**Status:** Planning\n');
    writeValidConfigJson(tmpDir);

    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    for (let i = 1; i <= 50; i++) {
      const pad = String(i).padStart(2, '0');
      const phaseDir = path.join(phasesDir, `${pad}-feature-${i}`);
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, `${pad}-01-PLAN.md`), `# Plan ${i}\n`);
      if (i <= 25) {
        fs.writeFileSync(path.join(phaseDir, `${pad}-01-SUMMARY.md`), `# Summary ${i}\n`);
      }
    }

    const { performance } = require('perf_hooks');
    const start = performance.now();
    const result = runGsdTools('validate health', tmpDir);
    const elapsed = performance.now() - start;

    assert.ok(result.success, `validate health should succeed: ${result.error}`);
    assert.ok(elapsed < 3000, `Should complete in under 3000ms, took ${elapsed.toFixed(0)}ms`);

    const output = JSON.parse(result.output);
    assert.ok(typeof output.status === 'string', 'Should return a status string');
  });
});
