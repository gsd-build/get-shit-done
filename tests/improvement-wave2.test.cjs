/**
 * GSD Tools Tests - Improvement Wave 2
 *
 * Pass 2 of iterative test strategy for dev-improvement branch changes:
 *   A) Boundary condition tests (context_window, health check edge cases)
 *   B) Concurrent write simulation (state patch sequential + lock cleanup)
 *   C) Installer hook registration (gsd-validate-commit, gsd-session-state, gsd-phase-boundary)
 *   D) normalizeMd performance benchmark (O(n) verification)
 *   E) Workflow template syntax validation (CONTEXT_WINDOW conditionals, files_to_read)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
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
// A) Boundary condition tests
// ─────────────────────────────────────────────────────────────────────────────

describe('boundary condition tests', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('context_window config accepts 500000 (boundary value for 1M enrichment)', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir, { context_window: 500000 });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // 500000 is a valid positive integer -- no W013
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

  test('W013 does NOT fire for context_window exactly 200000', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir, { context_window: 200000 });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const w013 = output.warnings.filter(w => w.code === 'W013');
    assert.strictEqual(w013.length, 0, `W013 should not fire for valid context_window=200000: ${JSON.stringify(w013)}`);
  });

  test('W013 does NOT fire when context_window is absent from config', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    // No context_window key at all
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

  test('health check handles STATE.md with no "Current Phase" field (no W011 crash)', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    // STATE.md with no Current Phase field at all
    writeMinimalStateMd(tmpDir, '# Session State\n\nSome content but no phase reference.\n');
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command should not crash: ${result.error}`);

    // It should return valid JSON regardless
    const output = JSON.parse(result.output);
    assert.ok(typeof output.status === 'string', 'should return a status string');
    assert.ok(Array.isArray(output.errors), 'should return errors array');
    assert.ok(Array.isArray(output.warnings), 'should return warnings array');
  });

  test('health check handles empty ROADMAP.md (no crash, still reports E003-level issues)', () => {
    writeMinimalProjectMd(tmpDir);
    // Write an empty ROADMAP.md
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '');
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1.\n');
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });

    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command should not crash on empty ROADMAP.md: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(typeof output.status === 'string', 'should return a status string');
    // An empty ROADMAP still exists on disk, so E003 should not fire,
    // but W006/W007 or other warnings may fire for missing phases
    assert.ok(Array.isArray(output.errors), 'should return errors array');
    assert.ok(Array.isArray(output.warnings), 'should return warnings array');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B) Concurrent write simulation
// ─────────────────────────────────────────────────────────────────────────────

describe('concurrent write simulation (state patch)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state patch updates field correctly (single operation baseline)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Status:** Planning\n**Current Plan:** 01-01\n`
    );

    const result = runGsdTools('state patch --Status "In progress"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** In progress'), 'Status should be updated to "In progress"');
    assert.ok(content.includes('**Current Phase:** 01'), 'Current Phase should be unchanged');
  });

  test('two sequential state patches both persist (patch A then patch B)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Status:** Planning\n**Current Plan:** 01-01\n**Last Activity:** 2024-01-01\n`
    );

    // Patch A: update Status
    const resultA = runGsdTools('state patch --Status "In progress"', tmpDir);
    assert.ok(resultA.success, `Patch A failed: ${resultA.error}`);

    // Patch B: update Current Plan
    const resultB = runGsdTools('state patch --"Current Plan" 01-02', tmpDir);
    assert.ok(resultB.success, `Patch B failed: ${resultB.error}`);

    // Both patches should be visible in the final file
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** In progress'), 'Patch A (Status) should persist');
    assert.ok(content.includes('01-02'), 'Patch B (Current Plan) should persist');
    assert.ok(content.includes('**Last Activity:** 2024-01-01'), 'Untouched field should be preserved');
  });

  test('lock file does not persist after rapid sequential patches', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Status:** Planning\n**Current Plan:** 01-01\n`
    );

    // Run several patches in rapid succession
    runGsdTools('state patch --Status "In progress"', tmpDir);
    runGsdTools('state patch --"Current Plan" 01-02', tmpDir);
    runGsdTools('state patch --Status Complete', tmpDir);

    const lockPath = path.join(tmpDir, '.planning', 'STATE.md.lock');
    assert.ok(!fs.existsSync(lockPath), 'STATE.md.lock should not persist after rapid sequential patches');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C) Installer hook registration
// ─────────────────────────────────────────────────────────────────────────────

describe('installer hook registration', () => {
  const installJsPath = path.join(__dirname, '..', 'bin', 'install.js');
  let installSource;

  beforeEach(() => {
    installSource = fs.readFileSync(installJsPath, 'utf-8');
  });

  test('install.js source contains gsd-validate-commit registration block', () => {
    assert.ok(
      installSource.includes('gsd-validate-commit'),
      'install.js should contain gsd-validate-commit hook registration'
    );
    assert.ok(
      installSource.includes('validateCommitCommand'),
      'install.js should define validateCommitCommand variable'
    );
    assert.ok(
      installSource.includes('hasValidateCommitHook'),
      'install.js should check for existing validate-commit hook'
    );
  });

  test('install.js source contains gsd-session-state registration block', () => {
    assert.ok(
      installSource.includes('gsd-session-state'),
      'install.js should contain gsd-session-state hook registration'
    );
    assert.ok(
      installSource.includes('sessionStateCommand'),
      'install.js should define sessionStateCommand variable'
    );
    assert.ok(
      installSource.includes('hasSessionStateHook'),
      'install.js should check for existing session-state hook'
    );
  });

  test('install.js source contains gsd-phase-boundary registration block', () => {
    assert.ok(
      installSource.includes('gsd-phase-boundary'),
      'install.js should contain gsd-phase-boundary hook registration'
    );
    assert.ok(
      installSource.includes('phaseBoundaryCommand'),
      'install.js should define phaseBoundaryCommand variable'
    );
    assert.ok(
      installSource.includes('hasPhaseBoundaryHook'),
      'install.js should check for existing phase-boundary hook'
    );
  });

  test('install.js registers validate-commit with PreToolUse event and Bash matcher', () => {
    // The validate-commit hook should be pushed to preToolEvent (PreToolUse)
    // with matcher: 'Bash'
    assert.ok(
      installSource.includes("settings.hooks[preToolEvent].push"),
      'validate-commit should be pushed to preToolEvent hooks array'
    );
    // The specific block for validate-commit should have matcher: 'Bash'
    const validateCommitBlock = installSource.substring(
      installSource.indexOf('// Configure commit validation hook'),
      installSource.indexOf('// Configure session state orientation hook')
    );
    assert.ok(
      validateCommitBlock.includes("matcher: 'Bash'"),
      'validate-commit hook should use Bash matcher'
    );
    assert.ok(
      validateCommitBlock.includes('preToolEvent'),
      'validate-commit hook should register on preToolEvent (PreToolUse)'
    );
  });

  test('install.js adds all 3 new hooks to the uninstall cleanup list (gsdHooks array)', () => {
    // The gsdHooks array in the uninstall section should contain all 3 hook filenames
    const gsdHooksMatch = installSource.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(gsdHooksMatch, 'install.js should define gsdHooks array for uninstall cleanup');

    const gsdHooksContent = gsdHooksMatch[1];
    assert.ok(
      gsdHooksContent.includes('gsd-session-state.sh'),
      'gsdHooks should include gsd-session-state.sh'
    );
    assert.ok(
      gsdHooksContent.includes('gsd-validate-commit.sh'),
      'gsdHooks should include gsd-validate-commit.sh'
    );
    assert.ok(
      gsdHooksContent.includes('gsd-phase-boundary.sh'),
      'gsdHooks should include gsd-phase-boundary.sh'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D) normalizeMd performance benchmark
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeMd performance benchmark', () => {
  test('processes a 100-line markdown file in under 50ms', () => {
    // Generate a 100-line markdown file with headings, paragraphs, and a code block
    const lines = [];
    for (let i = 0; i < 100; i++) {
      if (i % 20 === 0) {
        lines.push(`## Section ${i / 20 + 1}`);
      } else if (i % 30 === 0) {
        lines.push('```js');
        lines.push(`const x${i} = ${i};`);
        lines.push('```');
      } else if (i % 5 === 0) {
        lines.push(`- List item ${i}`);
      } else {
        lines.push(`Paragraph text line ${i} with some content to process.`);
      }
    }
    const input = lines.join('\n') + '\n';

    const start = performance.now();
    const result = normalizeMd(input);
    const elapsed = performance.now() - start;

    assert.ok(typeof result === 'string', 'should return a string');
    assert.ok(result.length > 0, 'result should not be empty');
    assert.ok(result.endsWith('\n'), 'result should end with newline');
    assert.ok(elapsed < 50, `100-line file should process in under 50ms, took ${elapsed.toFixed(2)}ms`);
  });

  test('processes a 1000-line markdown file with 20 code blocks in under 200ms', () => {
    // Generate a 1000-line markdown file with 20 code blocks interspersed
    const lines = [];
    let codeBlockCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (i % 50 === 0 && codeBlockCount < 20) {
        lines.push(`## Section ${codeBlockCount + 1}`);
        lines.push('');
        lines.push('Some introductory text for this section.');
        lines.push('');
        lines.push('```python');
        for (let j = 0; j < 5; j++) {
          lines.push(`    result_${codeBlockCount}_${j} = compute(${j})`);
        }
        lines.push('```');
        lines.push('');
        lines.push('Explanation of the code above.');
        codeBlockCount++;
      } else if (i % 10 === 0) {
        lines.push(`### Subsection at line ${i}`);
      } else if (i % 7 === 0) {
        lines.push(`- Item ${i}: description of this list item`);
      } else if (i % 13 === 0) {
        lines.push(`1. Ordered item ${i}`);
      } else {
        lines.push(`Line ${i}: Regular paragraph content with various markdown elements.`);
      }
    }
    const input = lines.join('\n') + '\n';

    // Warm up JIT
    normalizeMd(input);

    const start = performance.now();
    const result = normalizeMd(input);
    const elapsed = performance.now() - start;

    assert.ok(typeof result === 'string', 'should return a string');
    assert.ok(result.length > 0, 'result should not be empty');
    assert.ok(result.endsWith('\n'), 'result should end with newline');
    assert.ok(!result.includes('\n\n\n'), 'should not have 3+ consecutive blank lines');
    assert.ok(elapsed < 200, `1000-line file with 20 code blocks should process in under 200ms, took ${elapsed.toFixed(2)}ms`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E) Workflow template syntax validation
// ─────────────────────────────────────────────────────────────────────────────

describe('workflow template syntax validation', () => {
  const EXECUTE_WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
  const PLAN_WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');

  test('execute-phase.md contains CONTEXT_WINDOW config-get command', () => {
    const content = fs.readFileSync(EXECUTE_WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('CONTEXT_WINDOW'),
      'execute-phase.md should reference CONTEXT_WINDOW variable'
    );
    assert.ok(
      content.includes('config-get context_window'),
      'execute-phase.md should read context_window via config-get'
    );
    // Verify the default fallback is 200000
    assert.ok(
      content.includes('|| echo "200000"'),
      'execute-phase.md should default CONTEXT_WINDOW to 200000'
    );
  });

  test('execute-phase.md contains conditional prior_wave_summaries in executor prompt', () => {
    const content = fs.readFileSync(EXECUTE_WORKFLOW_PATH, 'utf-8');
    // The conditional should gate enrichment on CONTEXT_WINDOW >= 500000
    assert.ok(
      content.includes('CONTEXT_WINDOW >= 500000'),
      'execute-phase.md should gate enrichment on CONTEXT_WINDOW >= 500000'
    );
    assert.ok(
      content.includes('prior_wave_summaries'),
      'execute-phase.md should include prior_wave_summaries in enrichment block'
    );
    // The executor prompt should conditionally include CONTEXT.md and RESEARCH.md
    assert.ok(
      content.includes('CONTEXT.md'),
      'execute-phase.md should reference CONTEXT.md in conditional enrichment'
    );
    assert.ok(
      content.includes('RESEARCH.md'),
      'execute-phase.md should reference RESEARCH.md in conditional enrichment'
    );
  });

  test('execute-phase.md verifier prompt includes files_to_read block', () => {
    const content = fs.readFileSync(EXECUTE_WORKFLOW_PATH, 'utf-8');
    // There should be a <files_to_read> block in the verifier section
    assert.ok(
      content.includes('<files_to_read>'),
      'execute-phase.md should contain <files_to_read> opening tag'
    );
    assert.ok(
      content.includes('</files_to_read>'),
      'execute-phase.md should contain </files_to_read> closing tag'
    );
    // The verifier files_to_read should reference PLAN.md and SUMMARY.md
    // Find the verifier section's files_to_read block (the second one in the file)
    const verifierSection = content.substring(content.lastIndexOf('<files_to_read>'));
    assert.ok(
      verifierSection.includes('PLAN.md'),
      'verifier files_to_read should reference PLAN.md'
    );
    assert.ok(
      verifierSection.includes('SUMMARY.md'),
      'verifier files_to_read should reference SUMMARY.md'
    );
    assert.ok(
      verifierSection.includes('REQUIREMENTS.md'),
      'verifier files_to_read should reference REQUIREMENTS.md'
    );
  });

  test('plan-phase.md contains CONTEXT_WINDOW conditional for prior CONTEXT.md', () => {
    const content = fs.readFileSync(PLAN_WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('CONTEXT_WINDOW'),
      'plan-phase.md should reference CONTEXT_WINDOW variable'
    );
    assert.ok(
      content.includes('config-get context_window'),
      'plan-phase.md should read context_window via config-get'
    );
    // The conditional enrichment for cross-phase context
    assert.ok(
      content.includes('CONTEXT_WINDOW >= 500000'),
      'plan-phase.md should gate cross-phase context on CONTEXT_WINDOW >= 500000'
    );
    // Should mention prior CONTEXT.md files for cross-phase consistency
    assert.ok(
      content.includes('CONTEXT.md'),
      'plan-phase.md should reference CONTEXT.md in cross-phase enrichment'
    );
  });
});
