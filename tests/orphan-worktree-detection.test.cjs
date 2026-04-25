// allow-test-rule: architectural-invariant
// verify.cjs must contain the W017 warning code and the worktree list invocation.
// These checks guard the existence of the detection feature, not its text output.
// Behavioral tests cover the detection flow; structural tests guard the implementation contract.

/**
 * GSD Tools Tests - Orphan/Stale Worktree Detection (W017)
 *
 * Tests for feat/worktree-health-w017-2167:
 *   - W017 code exists in verify.cjs (structural)
 *   - No false positives on projects without linked worktrees
 *   - Adding the check does not regress baseline health status
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempGitProject, cleanup } = require('./helpers.cjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeMinimalProjectMd(tmpDir) {
  const sections = ['## What This Is', '## Core Value', '## Requirements'];
  const content = sections.map(s => `${s}\n\nContent here.\n`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    `# Project\n\n${content}`
  );
}

function writeMinimalRoadmap(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    '# Roadmap\n\n### Phase 1: Setup\n'
  );
}

function writeMinimalStateMd(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    '# Session State\n\n## Current Position\n\nPhase: 1\n'
  );
}

function writeValidConfigJson(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({
      model_profile: 'balanced',
      commit_docs: true,
      workflow: { nyquist_validation: true, ai_integration_phase: true },
    }, null, 2)
  );
}

function setupHealthyProject(tmpDir) {
  writeMinimalProjectMd(tmpDir);
  writeMinimalRoadmap(tmpDir);
  writeMinimalStateMd(tmpDir);
  writeValidConfigJson(tmpDir);
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Structural: W017 code exists in verify.cjs
// ─────────────────────────────────────────────────────────────────────────────

describe('W017: structural presence', () => {
  test('verify.cjs contains W017 warning code', () => {
    const verifyPath = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'verify.cjs');
    const source = fs.readFileSync(verifyPath, 'utf-8');
    assert.ok(source.includes("'W017'"), 'verify.cjs should contain W017 warning code');
  });

  test('verify.cjs contains worktree list --porcelain invocation', () => {
    const verifyPath = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'verify.cjs');
    const source = fs.readFileSync(verifyPath, 'utf-8');
    assert.ok(
      source.includes('worktree') && source.includes('--porcelain'),
      'verify.cjs should invoke git worktree list --porcelain'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. No worktrees = no W017
// ─────────────────────────────────────────────────────────────────────────────

describe('W017: no false positives', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
    setupHealthyProject(tmpDir);
  });

  afterEach(() => cleanup(tmpDir));

  test('no W017 when project has no linked worktrees', () => {
    const result = runGsdTools('validate health --raw', tmpDir);
    assert.ok(result.success, `validate health should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);

    // Collect all warning codes
    const warningCodes = (parsed.warnings || []).map(w => w.code);
    assert.ok(!warningCodes.includes('W017'), `W017 should not fire when no linked worktrees exist, got warnings: ${JSON.stringify(warningCodes)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Clean project still reports healthy
// ─────────────────────────────────────────────────────────────────────────────

describe('W017: no regression on healthy projects', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
    setupHealthyProject(tmpDir);
  });

  afterEach(() => cleanup(tmpDir));

  test('validate health still reports healthy on a clean project', () => {
    const result = runGsdTools('validate health --raw', tmpDir);
    assert.ok(result.success, `validate health should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.equal(parsed.status, 'healthy', `Expected healthy status, got ${parsed.status}. Errors: ${JSON.stringify(parsed.errors)}. Warnings: ${JSON.stringify(parsed.warnings)}`);
  });
});
