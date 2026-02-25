/**
 * GSD Tools Tests - template.cjs
 *
 * CLI integration tests for template select heuristics and template fill
 * exercised through gsd-tools.cjs via execSync.
 *
 * Requirements: TEST-14
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Write a plan file with specific content for testing template select heuristics.
 */
function writePlanFile(tmpDir, relPath, content) {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  return relPath;
}

/**
 * Set up a phase directory and ROADMAP.md so findPhaseInternal can find the phase.
 */
function setupPhaseDir(tmpDir, phaseNum, phaseName) {
  phaseNum = phaseNum || '1';
  phaseName = phaseName || 'test-phase';
  const padded = String(phaseNum).padStart(2, '0');
  const phaseDir = path.join(tmpDir, '.planning', 'phases', `${padded}-${phaseName}`);
  fs.mkdirSync(phaseDir, { recursive: true });
  const roadmap = `# Roadmap\n\n### Phase ${phaseNum}: Test Phase\n**Goal**: Testing\n`;
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
  return phaseDir;
}

// ─── template select ─────────────────────────────────────────────────────────

describe('template select command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // --- Minimal selection ---

  test('selects minimal for plan with 1 task, 0 files, no decisions', () => {
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md',
      '# Plan\n\n### Task 1\nDo something simple.\n');

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'minimal');
    assert.strictEqual(output.taskCount, 1);
  });

  test('selects minimal at boundary: 2 tasks, 3 files, no decisions', () => {
    const content = [
      '# Plan',
      '',
      '### Task 1',
      'Work with `src/a.js` file.',
      '',
      '### Task 2',
      'Work with `src/b.js` and `src/c.js` files.',
    ].join('\n');
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'minimal');
    assert.strictEqual(output.taskCount, 2);
    assert.strictEqual(output.fileCount, 3);
  });

  // --- Complex selection ---

  test('selects complex when plan contains decision keyword', () => {
    const content = '# Plan\n\n### Task 1\nMake a decision about architecture.\n';
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'complex');
    assert.strictEqual(output.hasDecisions, true);
  });

  test('selects complex when file count > 6', () => {
    const content = [
      '# Plan',
      '',
      '### Task 1',
      'Files: `src/a.js`, `src/b.js`, `src/c.js`, `src/d.js`',
      '',
      '### Task 2',
      'Files: `src/e.js`, `src/f.js`, `src/g.js`',
    ].join('\n');
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'complex');
    assert.strictEqual(output.fileCount, 7);
  });

  test('selects complex when task count > 5', () => {
    const tasks = Array.from({ length: 6 }, (_, i) => `### Task ${i + 1}\nDo thing ${i + 1}.`).join('\n\n');
    const content = `# Plan\n\n${tasks}\n`;
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'complex');
    assert.strictEqual(output.taskCount, 6);
  });

  // --- Standard selection ---

  test('selects standard for 3 tasks, 4 files, no decisions', () => {
    const content = [
      '# Plan',
      '',
      '### Task 1',
      'Work with `src/a.js`.',
      '',
      '### Task 2',
      'Work with `src/b.js` and `src/c.js`.',
      '',
      '### Task 3',
      'Work with `src/d.js`.',
    ].join('\n');
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'standard');
  });

  test('selects standard for 3 tasks, 0 files, no decisions', () => {
    const content = '# Plan\n\n### Task 1\nA\n\n### Task 2\nB\n\n### Task 3\nC\n';
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'standard');
    assert.strictEqual(output.taskCount, 3);
  });

  // --- Boundary isolation ---

  test('task-count-only at boundary: exactly 5 tasks is standard, not complex', () => {
    const tasks = Array.from({ length: 5 }, (_, i) => `### Task ${i + 1}\nDo thing.`).join('\n\n');
    const content = `# Plan\n\n${tasks}\n`;
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'standard', 'taskCount=5 is not > 5, should be standard');
    assert.strictEqual(output.taskCount, 5);
  });

  test('file-count-only at boundary: exactly 6 files is standard, not complex', () => {
    const files = Array.from({ length: 6 }, (_, i) => `\`src/file${i}.js\``).join(', ');
    const content = `# Plan\n\n### Task 1\nFiles: ${files}\n`;
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'standard', 'fileCount=6 is not > 6, should be standard');
    assert.strictEqual(output.fileCount, 6);
  });

  // --- Fallback ---

  test('falls back to standard when plan file does not exist', () => {
    const result = runGsdTools('template select nonexistent/path.md', tmpDir);
    assert.ok(result.success, 'Should succeed with fallback, not error');

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'standard');
    assert.ok(output.error, 'Should include error field explaining fallback');
  });

  // --- Filtering ---

  test('ignores http URLs in file count', () => {
    const content = [
      '# Plan',
      '',
      '### Task 1',
      'See `https://example.com/path/file.js` and `src/real.js`.',
    ].join('\n');
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.fileCount, 1, 'should only count local path, not http URL');
  });

  test('ignores backtick paths without slashes', () => {
    const content = '# Plan\n\n### Task 1\nUse `nodemon` and `jest` tools.\n';
    const planPath = writePlanFile(tmpDir, '.planning/test-plan.md', content);

    const result = runGsdTools(`template select ${planPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.fileCount, 0, 'paths without slashes should not count');
  });
});

// ─── template fill ───────────────────────────────────────────────────────────

describe('template fill command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // --- Summary ---

  test('creates SUMMARY.md with correct frontmatter', () => {
    setupPhaseDir(tmpDir);

    const result = runGsdTools('template fill summary --phase 1 --plan 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);
    assert.strictEqual(output.template, 'summary');

    // Read created file and verify content
    const filePath = path.join(tmpDir, output.path);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('phase:'), 'should have phase in frontmatter');
    assert.ok(content.includes('plan:'), 'should have plan in frontmatter');
    assert.ok(content.includes('completed:'), 'should have completed date');
    assert.ok(content.includes('# Phase 1:'), 'should have phase heading in body');
  });

  test('merges custom fields into frontmatter', () => {
    setupPhaseDir(tmpDir);

    const fields = JSON.stringify({ subsystem: 'testing', tags: ['unit'] });
    const result = runGsdTools(`template fill summary --phase 1 --plan 02 --fields '${fields}'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const filePath = path.join(tmpDir, output.path);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('subsystem: testing'), 'should have custom subsystem field');
    assert.ok(content.includes('unit'), 'should have custom tags');
  });

  // --- Plan ---

  test('creates PLAN.md with correct frontmatter', () => {
    setupPhaseDir(tmpDir);

    const result = runGsdTools('template fill plan --phase 1 --plan 02 --wave 2 --type execute', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const filePath = path.join(tmpDir, output.path);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('wave: 2'), 'should have wave 2');
    assert.ok(content.includes('type: execute'), 'should have type execute');
    assert.ok(content.includes('depends_on:'), 'should have depends_on');
    assert.ok(content.includes('autonomous: true'), 'should have autonomous');
  });

  test('creates PLAN.md with default wave 1 when not specified', () => {
    setupPhaseDir(tmpDir);

    const result = runGsdTools('template fill plan --phase 1 --plan 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const filePath = path.join(tmpDir, output.path);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('wave: 1'), 'should default to wave 1');
  });

  // --- Verification ---

  test('creates VERIFICATION.md with correct frontmatter', () => {
    setupPhaseDir(tmpDir);

    const result = runGsdTools('template fill verification --phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const filePath = path.join(tmpDir, output.path);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('status: pending'), 'should have status pending');
    assert.ok(content.includes('verified:'), 'should have verified timestamp');
    assert.ok(content.includes('## Observable Truths'), 'should have Observable Truths section');
  });

  // --- Error paths ---

  test('rejects unknown template type', () => {
    setupPhaseDir(tmpDir);

    const result = runGsdTools('template fill unknown --phase 1', tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error.includes('Unknown template type'),
      `Expected "Unknown template type" in error: ${result.error}`
    );
  });

  test('returns error when output file already exists', () => {
    setupPhaseDir(tmpDir);

    // First fill succeeds
    const first = runGsdTools('template fill summary --phase 1 --plan 01', tmpDir);
    assert.ok(first.success, `First fill failed: ${first.error}`);

    // Second fill should return error (not crash)
    const second = runGsdTools('template fill summary --phase 1 --plan 01', tmpDir);
    assert.ok(second.success, 'Command should exit 0 but return error object');
    const output = JSON.parse(second.output);
    assert.ok(output.error, 'Should have error field');
    assert.ok(output.error.includes('File already exists'), `Expected "File already exists" in error: ${output.error}`);
  });

  test('errors when --phase not provided', () => {
    const result = runGsdTools('template fill summary', tmpDir);
    assert.strictEqual(result.success, false);
  });

  test('returns error for nonexistent phase', () => {
    // No phase 99 directory exists
    const result = runGsdTools('template fill summary --phase 99', tmpDir);
    assert.ok(result.success, 'Command should exit 0 but return error object');
    const output = JSON.parse(result.output);
    assert.ok(output.error, 'Should have error field');
    assert.ok(
      output.error.includes('Phase not found') || output.error.includes('not found'),
      `Expected "Phase not found" in error: ${output.error}`
    );
  });

  // --- Completeness ---

  test('fills all three template types without error', () => {
    setupPhaseDir(tmpDir);

    const summary = runGsdTools('template fill summary --phase 1 --plan 01', tmpDir);
    assert.ok(summary.success, `summary failed: ${summary.error}`);
    assert.strictEqual(JSON.parse(summary.output).created, true);

    const plan = runGsdTools('template fill plan --phase 1 --plan 02', tmpDir);
    assert.ok(plan.success, `plan failed: ${plan.error}`);
    assert.strictEqual(JSON.parse(plan.output).created, true);

    const verification = runGsdTools('template fill verification --phase 1', tmpDir);
    assert.ok(verification.success, `verification failed: ${verification.error}`);
    assert.strictEqual(JSON.parse(verification.output).created, true);

    // Verify all three files exist
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test-phase');
    const files = fs.readdirSync(phaseDir);
    assert.ok(files.some(f => f.includes('SUMMARY')), 'SUMMARY.md should exist');
    assert.ok(files.some(f => f.includes('PLAN')), 'PLAN.md should exist');
    assert.ok(files.some(f => f.includes('VERIFICATION')), 'VERIFICATION.md should exist');
  });
});
