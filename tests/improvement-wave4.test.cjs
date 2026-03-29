/**
 * GSD Tools Tests - Improvement Wave 4
 *
 * Pass 4 of iterative test strategy for dev-improvement branch changes:
 *   A) Stress tests with 50+ phases (performance + correctness at scale)
 *   B) Cross-branch merge verification (structural compatibility)
 *   C) Snapshot testing for normalizeMd (regression detection)
 *   D) Negative security tests for hooks (injection + malformed input)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { performance } = require('perf_hooks');
const { runGsdTools, createTempProject, cleanup, TOOLS_PATH } = require('./helpers.cjs');

const {
  normalizeMd,
} = require('../get-shit-done/bin/lib/core.cjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/**
 * Generate a 50-phase project structure for stress testing.
 *
 * Creates:
 * - ROADMAP.md with 50 phases (first `completedCount` checked off)
 * - Phase directories for all 50 phases
 * - PLAN.md and SUMMARY.md files for the first `completedCount` phases
 * - PLAN.md only for remaining phases
 */
function create50PhaseProject(tmpDir, completedCount = 25) {
  // Build ROADMAP.md content
  let roadmapContent = '# Roadmap v1.0\n\n';
  for (let i = 1; i <= 50; i++) {
    roadmapContent += `- [${i <= completedCount ? 'x' : ' '}] Phase ${i}: Feature ${i}\n`;
  }
  roadmapContent += '\n';
  for (let i = 1; i <= 50; i++) {
    const pad = String(i).padStart(2, '0');
    roadmapContent += `### Phase ${i}: Feature ${i}\n\n`;
    roadmapContent += `**Goal:** Build feature ${i}\n`;
    roadmapContent += `**Requirements:** REQ-${pad}\n`;
    roadmapContent += `**Plans:** 1 plans\n\n`;
    roadmapContent += `Plans:\n- [${i <= completedCount ? 'x' : ' '}] ${pad}-01-PLAN.md\n\n`;
  }
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    roadmapContent
  );

  // Create phase directories with plan and summary files
  const phasesDir = path.join(tmpDir, '.planning', 'phases');
  for (let i = 1; i <= 50; i++) {
    const pad = String(i).padStart(2, '0');
    const dirName = `${pad}-feature-${i}`;
    const phaseDir = path.join(phasesDir, dirName);
    fs.mkdirSync(phaseDir, { recursive: true });

    // Every phase gets a PLAN.md
    fs.writeFileSync(
      path.join(phaseDir, `${pad}-01-PLAN.md`),
      `# Phase ${i} Plan 1\n\nBuild feature ${i}.\n`
    );

    // Completed phases also get a SUMMARY.md
    if (i <= completedCount) {
      fs.writeFileSync(
        path.join(phaseDir, `${pad}-01-SUMMARY.md`),
        `# Phase ${i} Plan 1 Summary\n\nFeature ${i} completed.\n`
      );
    }
  }
}

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const isWindows = process.platform === 'win32';

// ─────────────────────────────────────────────────────────────────────────────
// A) Stress tests with 50+ phases
// ─────────────────────────────────────────────────────────────────────────────

describe('stress tests with 50+ phases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('roadmap analyze on 50-phase ROADMAP completes in under 2000ms', () => {
    create50PhaseProject(tmpDir, 25);

    const start = performance.now();
    const result = runGsdTools('roadmap analyze', tmpDir);
    const elapsed = performance.now() - start;

    assert.ok(result.success, `roadmap analyze should succeed: ${result.error}`);
    assert.ok(elapsed < 2000, `Should complete in under 2000ms, took ${elapsed.toFixed(0)}ms`);

    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output.phases), 'Output should contain a phases array');
    assert.strictEqual(output.phases.length, 50, `Should have 50 phases, got ${output.phases.length}`);

    // Verify completion status is accurate
    const completedPhases = output.phases.filter(p => p.disk_status === 'complete');
    assert.strictEqual(completedPhases.length, 25, `Should have 25 complete phases, got ${completedPhases.length}`);
  });

  test('validate health on 50-phase project completes in under 3000ms', () => {
    create50PhaseProject(tmpDir, 25);
    writeMinimalProjectMd(tmpDir);
    writeMinimalStateMd(tmpDir, '# Session State\n\n**Current Phase:** 26\n**Status:** Planning\n');
    writeValidConfigJson(tmpDir);

    const start = performance.now();
    const result = runGsdTools('validate health', tmpDir);
    const elapsed = performance.now() - start;

    assert.ok(result.success, `validate health should succeed: ${result.error}`);
    assert.ok(elapsed < 3000, `Should complete in under 3000ms, took ${elapsed.toFixed(0)}ms`);

    const output = JSON.parse(result.output);
    assert.ok(typeof output.status === 'string', 'Should return a status string');
    assert.ok(Array.isArray(output.errors), 'Should return errors array');
    assert.ok(Array.isArray(output.warnings), 'Should return warnings array');
  });

  test('phase complete on phase 26 of 50-phase project works correctly', () => {
    create50PhaseProject(tmpDir, 25);
    writeMinimalStateMd(tmpDir, '# Session State\n\n**Current Phase:** 26\n**Status:** In progress\n');

    // Create summary for phase 26's plan to satisfy completion
    const phase26Dir = path.join(tmpDir, '.planning', 'phases', '26-feature-26');
    fs.writeFileSync(
      path.join(phase26Dir, '26-01-SUMMARY.md'),
      '# Phase 26 Plan 1 Summary\n\nFeature 26 completed.\n'
    );

    const result = runGsdTools('phase complete 26', tmpDir);
    assert.ok(result.success, `phase complete 26 should succeed: ${result.error}`);

    // Verify ROADMAP was updated -- phase 26 checkbox should now be checked
    const roadmapContent = fs.readFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      'utf-8'
    );
    const phase26Checkbox = roadmapContent.match(/-\s*\[(x| )\]\s*.*Phase\s+26/i);
    assert.ok(phase26Checkbox, 'Should find Phase 26 checkbox in ROADMAP');
    assert.strictEqual(phase26Checkbox[1], 'x', 'Phase 26 should now be marked as complete [x]');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B) Cross-branch merge verification
// ─────────────────────────────────────────────────────────────────────────────

describe('cross-branch merge verification', () => {
  test('dev-improvement source changes are present in lib files', () => {
    const libDir = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib');

    // Verify phase.cjs contains withPlanningLock (our improvement)
    const phaseContent = fs.readFileSync(path.join(libDir, 'phase.cjs'), 'utf-8');
    assert.ok(
      phaseContent.includes('withPlanningLock'),
      'phase.cjs should contain withPlanningLock (planning lock integration)'
    );

    // Verify state.cjs contains readModifyWriteStateMd (our improvement)
    const stateContent = fs.readFileSync(path.join(libDir, 'state.cjs'), 'utf-8');
    assert.ok(
      stateContent.includes('readModifyWriteStateMd'),
      'state.cjs should contain readModifyWriteStateMd (atomic state updates)'
    );

    // Verify core.cjs contains insideFence (our normalizeMd O(n) rewrite)
    const coreContent = fs.readFileSync(path.join(libDir, 'core.cjs'), 'utf-8');
    assert.ok(
      coreContent.includes('insideFence'),
      'core.cjs should contain insideFence (O(n) normalizeMd rewrite)'
    );

    // Verify verify.cjs contains W011 (our health check additions)
    const verifyContent = fs.readFileSync(path.join(libDir, 'verify.cjs'), 'utf-8');
    assert.ok(
      verifyContent.includes('W011'),
      'verify.cjs should contain W011 (health check improvements)'
    );
  });

  test('all improvement test files are self-contained (no cross-test-file dependencies)', () => {
    const waveFiles = [
      path.join(__dirname, 'improvement-wave1.test.cjs'),
      path.join(__dirname, 'improvement-wave2.test.cjs'),
      path.join(__dirname, 'improvement-wave3.test.cjs'),
    ];

    for (const filePath of waveFiles) {
      assert.ok(fs.existsSync(filePath), `${path.basename(filePath)} should exist`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const basename = path.basename(filePath);

      // Extract all require() calls
      const requireCalls = content.match(/require\(['"](.*?)['"]\)/g) || [];
      const importedPaths = requireCalls.map(r => r.match(/require\(['"](.*?)['"]\)/)[1]);

      // Verify imports are only from helpers.cjs, standard modules, or the lib
      for (const imp of importedPaths) {
        assert.ok(
          !imp.includes('improvement-wave'),
          `${basename} should not import from another improvement-wave file, found: ${imp}`
        );
      }

      // Verify each has its own describe() block
      const describeMatches = content.match(/^\s*describe\s*\(/gm);
      assert.ok(
        describeMatches && describeMatches.length > 0,
        `${basename} should have at least one describe() block`
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C) Snapshot testing for normalizeMd
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeMd snapshot tests', () => {
  test('snapshot - heading spacing', () => {
    const input = '# Title\nParagraph\n## Section\nMore text';
    const expected = '# Title\n\nParagraph\n\n## Section\n\nMore text\n';
    const result = normalizeMd(input);
    assert.strictEqual(result, expected,
      `Heading spacing snapshot mismatch.\nGot:      ${JSON.stringify(result)}\nExpected: ${JSON.stringify(expected)}`
    );
  });

  test('snapshot - code block spacing', () => {
    const input = 'Text before\n```js\nconst x = 1;\n```\nText after\n';
    const expected = 'Text before\n\n```js\nconst x = 1;\n```\n\nText after\n';
    const result = normalizeMd(input);
    assert.strictEqual(result, expected,
      `Code block spacing snapshot mismatch.\nGot:      ${JSON.stringify(result)}\nExpected: ${JSON.stringify(expected)}`
    );
  });

  test('snapshot - list spacing', () => {
    const input = 'Paragraph\n- item 1\n- item 2\nAnother paragraph';
    const expected = 'Paragraph\n\n- item 1\n- item 2\n\nAnother paragraph\n';
    const result = normalizeMd(input);
    assert.strictEqual(result, expected,
      `List spacing snapshot mismatch.\nGot:      ${JSON.stringify(result)}\nExpected: ${JSON.stringify(expected)}`
    );
  });

  test('snapshot - complex mixed document', () => {
    const input = [
      '# Main Title',
      'Intro paragraph.',
      '## Section One',
      'Some text here.',
      '```js',
      'const a = 1;',
      '```',
      '- first item',
      '- second item',
      '## Section Two',
      'Final text.',
    ].join('\n');

    const expected = [
      '# Main Title',
      '',
      'Intro paragraph.',
      '',
      '## Section One',
      '',
      'Some text here.',
      '',
      '```js',
      'const a = 1;',
      '```',
      '',
      '- first item',
      '- second item',
      '',
      '## Section Two',
      '',
      'Final text.',
      '',  // trailing newline
    ].join('\n');

    const result = normalizeMd(input);
    assert.strictEqual(result, expected,
      `Complex mixed document snapshot mismatch.\nGot:      ${JSON.stringify(result)}\nExpected: ${JSON.stringify(expected)}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D) Negative security tests for hooks
// ─────────────────────────────────────────────────────────────────────────────

describe('negative security tests for hooks', { skip: isWindows ? 'bash hooks require unix shell' : false }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validate-commit blocks message with shell metacharacters', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "$(rm -rf /)"' }
    });

    const result = spawnSync('bash', [hookPath], {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(
      result.status, 2,
      `Shell metacharacter message should be blocked (exit 2), got ${result.status}. stdout: ${result.stdout}`
    );
    assert.ok(
      result.stdout.includes('block'),
      `stdout should contain "block": ${result.stdout}`
    );
  });

  test('validate-commit blocks message with backtick injection', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "`whoami`"' }
    });

    const result = spawnSync('bash', [hookPath], {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(
      result.status, 2,
      `Backtick injection message should be blocked (exit 2), got ${result.status}. stdout: ${result.stdout}`
    );
    assert.ok(
      result.stdout.includes('block'),
      `stdout should contain "block": ${result.stdout}`
    );
  });

  test('validate-commit allows commit with scope containing special chars', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-validate-commit.sh');
    const input = JSON.stringify({
      tool_input: { command: 'git commit -m "fix(api/v2): handle edge case"' }
    });

    const result = spawnSync('bash', [hookPath], {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(
      result.status, 0,
      `Valid conventional commit with / in scope should be allowed (exit 0), got ${result.status}. stdout: ${result.stdout}`
    );
  });

  test('phase-boundary hook handles malformed JSON input gracefully', () => {
    const hookPath = path.join(HOOKS_DIR, 'gsd-phase-boundary.sh');
    const input = 'not json at all';

    const result = spawnSync('bash', [hookPath], {
      input,
      encoding: 'utf-8',
      cwd: tmpDir,
    });

    assert.strictEqual(
      result.status, 0,
      `Hook should not crash on malformed JSON (exit 0), got ${result.status}. stderr: ${result.stderr}`
    );
  });
});
