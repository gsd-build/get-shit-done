/**
 * GSD Tools Tests - Verify
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, createTempGitProject, cleanup } = require('./helpers.cjs');
const { execSync } = require('child_process');

// ─── helpers ──────────────────────────────────────────────────────────────────

// Build a minimal valid PLAN.md content with all required frontmatter fields
function validPlanContent({ wave = 1, dependsOn = '[]', autonomous = 'true', extraTasks = '' } = {}) {
  return [
    '---',
    'phase: 01-test',
    'plan: 01',
    'type: execute',
    `wave: ${wave}`,
    `depends_on: ${dependsOn}`,
    'files_modified: [some/file.ts]',
    `autonomous: ${autonomous}`,
    'must_haves:',
    '  truths:',
    '    - "something is true"',
    '---',
    '',
    '<tasks>',
    '',
    '<task type="auto">',
    '  <name>Task 1: Do something</name>',
    '  <files>some/file.ts</files>',
    '  <action>Do the thing</action>',
    '  <verify><automated>echo ok</automated></verify>',
    '  <done>Thing is done</done>',
    '</task>',
    extraTasks,
    '',
    '</tasks>',
  ].join('\n');
}

describe('validate consistency command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('passes for consistent project', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n### Phase 2: B\n### Phase 3: C\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-b'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-c'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.passed, true, 'should pass');
    assert.strictEqual(output.warning_count, 0, 'no warnings');
  });

  test('warns about phase on disk but not in roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-orphan'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.warning_count > 0, 'should have warnings');
    assert.ok(
      output.warnings.some(w => w.includes('disk but not in ROADMAP')),
      'should warn about orphan directory'
    );
  });

  test('warns about gaps in phase numbering', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n### Phase 3: C\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-c'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.includes('Gap in phase numbering')),
      'should warn about gap'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verify plan-structure command
// ─────────────────────────────────────────────────────────────────────────────

describe('verify plan-structure command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reports missing required frontmatter fields', () => {
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, '# No frontmatter here\n\nJust a plan without YAML.\n');

    const result = runGsdTools('verify plan-structure .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid, false, 'should be invalid');
    assert.ok(
      output.errors.some(e => e.includes('Missing required frontmatter field')),
      `Expected "Missing required frontmatter field" in errors: ${JSON.stringify(output.errors)}`
    );
  });

  test('validates complete plan with all required fields and tasks', () => {
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, validPlanContent());

    const result = runGsdTools('verify plan-structure .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid, true, `should be valid, errors: ${JSON.stringify(output.errors)}`);
    assert.deepStrictEqual(output.errors, [], 'should have no errors');
    assert.strictEqual(output.task_count, 1, 'should have 1 task');
  });

  test('reports task missing name element', () => {
    const content = [
      '---',
      'phase: 01-test',
      'plan: 01',
      'type: execute',
      'wave: 1',
      'depends_on: []',
      'files_modified: [some/file.ts]',
      'autonomous: true',
      'must_haves:',
      '  truths:',
      '    - "something"',
      '---',
      '',
      '<tasks>',
      '<task type="auto">',
      '  <action>Do it</action>',
      '  <verify><automated>echo ok</automated></verify>',
      '  <done>Done</done>',
      '</task>',
      '</tasks>',
    ].join('\n');

    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, content);

    const result = runGsdTools('verify plan-structure .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.includes('Task missing <name>')),
      `Expected "Task missing <name>" in errors: ${JSON.stringify(output.errors)}`
    );
  });

  test('reports task missing action element', () => {
    const content = [
      '---',
      'phase: 01-test',
      'plan: 01',
      'type: execute',
      'wave: 1',
      'depends_on: []',
      'files_modified: [some/file.ts]',
      'autonomous: true',
      'must_haves:',
      '  truths:',
      '    - "something"',
      '---',
      '',
      '<tasks>',
      '<task type="auto">',
      '  <name>Task 1: No action</name>',
      '  <verify><automated>echo ok</automated></verify>',
      '  <done>Done</done>',
      '</task>',
      '</tasks>',
    ].join('\n');

    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, content);

    const result = runGsdTools('verify plan-structure .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.includes('missing <action>')),
      `Expected "missing <action>" in errors: ${JSON.stringify(output.errors)}`
    );
  });

  test('warns about wave > 1 with empty depends_on', () => {
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, validPlanContent({ wave: 2, dependsOn: '[]' }));

    const result = runGsdTools('verify plan-structure .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.includes('Wave > 1 but depends_on is empty')),
      `Expected "Wave > 1 but depends_on is empty" in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('errors when checkpoint task but autonomous is true', () => {
    const content = [
      '---',
      'phase: 01-test',
      'plan: 01',
      'type: execute',
      'wave: 1',
      'depends_on: []',
      'files_modified: [some/file.ts]',
      'autonomous: true',
      'must_haves:',
      '  truths:',
      '    - "something"',
      '---',
      '',
      '<tasks>',
      '<task type="auto">',
      '  <name>Task 1: Normal</name>',
      '  <files>some/file.ts</files>',
      '  <action>Do it</action>',
      '  <verify><automated>echo ok</automated></verify>',
      '  <done>Done</done>',
      '</task>',
      '<task type="checkpoint:human-verify">',
      '  <name>Task 2: Verify UI</name>',
      '  <files>some/file.ts</files>',
      '  <action>Check the UI</action>',
      '  <verify><human>Visit the app</human></verify>',
      '  <done>UI verified</done>',
      '</task>',
      '</tasks>',
    ].join('\n');

    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, content);

    const result = runGsdTools('verify plan-structure .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.errors.some(e => e.includes('checkpoint tasks but autonomous is not false')),
      `Expected checkpoint/autonomous error in errors: ${JSON.stringify(output.errors)}`
    );
  });

  test('returns error for nonexistent file', () => {
    const result = runGsdTools('verify plan-structure .planning/phases/01-test/nonexistent.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error, `Expected error field in output: ${JSON.stringify(output)}`);
    assert.ok(
      output.error.includes('File not found'),
      `Expected "File not found" in error: ${output.error}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verify phase-completeness command
// ─────────────────────────────────────────────────────────────────────────────

describe('verify phase-completeness command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create ROADMAP.md referencing phase 01 so findPhaseInternal can locate it
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Test\n**Goal**: Test phase\n'
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reports complete phase with matching plans and summaries', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');

    const result = runGsdTools('verify phase-completeness 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.complete, true, `should be complete, errors: ${JSON.stringify(output.errors)}`);
    assert.strictEqual(output.plan_count, 1, 'should have 1 plan');
    assert.strictEqual(output.summary_count, 1, 'should have 1 summary');
    assert.deepStrictEqual(output.incomplete_plans, [], 'should have no incomplete plans');
  });

  test('reports incomplete phase with plan missing summary', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');

    const result = runGsdTools('verify phase-completeness 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.complete, false, 'should be incomplete');
    assert.ok(
      output.incomplete_plans.some(id => id.includes('01-01')),
      `Expected "01-01" in incomplete_plans: ${JSON.stringify(output.incomplete_plans)}`
    );
    assert.ok(
      output.errors.some(e => e.includes('Plans without summaries')),
      `Expected "Plans without summaries" in errors: ${JSON.stringify(output.errors)}`
    );
  });

  test('warns about orphan summaries', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');

    const result = runGsdTools('verify phase-completeness 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.includes('Summaries without plans')),
      `Expected "Summaries without plans" in warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  test('returns error for nonexistent phase', () => {
    const result = runGsdTools('verify phase-completeness 99', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error, `Expected error field in output: ${JSON.stringify(output)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verify-summary command
// ─────────────────────────────────────────────────────────────────────────────

describe('verify summary command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns not found for nonexistent summary', () => {
    const result = runGsdTools('verify-summary .planning/phases/01-test/nonexistent.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.passed, false, 'should not pass');
    assert.strictEqual(output.checks.summary_exists, false, 'summary should not exist');
    assert.ok(
      output.errors.some(e => e.includes('SUMMARY.md not found')),
      `Expected "SUMMARY.md not found" in errors: ${JSON.stringify(output.errors)}`
    );
  });

  test('passes for valid summary with real files and commits', () => {
    // Create a source file and commit it
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'console.log("hello");\n');
    execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "add app.js"', { cwd: tmpDir, stdio: 'pipe' });

    const hash = execSync('git rev-parse --short HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();

    // Write SUMMARY.md referencing the file and commit hash
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-SUMMARY.md');
    fs.writeFileSync(summaryPath, [
      '# Summary',
      '',
      `Created: \`src/app.js\``,
      '',
      `Commit: ${hash}`,
    ].join('\n'));

    const result = runGsdTools('verify-summary .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.passed, true, `should pass, errors: ${JSON.stringify(output.errors)}`);
    assert.strictEqual(output.checks.summary_exists, true, 'summary should exist');
    assert.strictEqual(output.checks.commits_exist, true, 'commits should exist');
  });

  test('reports missing files mentioned in summary', () => {
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-SUMMARY.md');
    fs.writeFileSync(summaryPath, [
      '# Summary',
      '',
      'Created: `src/nonexistent.js`',
    ].join('\n'));

    const result = runGsdTools('verify-summary .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.checks.files_created.missing.includes('src/nonexistent.js'),
      `Expected missing to include "src/nonexistent.js": ${JSON.stringify(output.checks.files_created.missing)}`
    );
  });

  test('detects self-check section with pass indicators', () => {
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-SUMMARY.md');
    fs.writeFileSync(summaryPath, [
      '# Summary',
      '',
      '## Self-Check',
      '',
      'All tests pass',
    ].join('\n'));

    const result = runGsdTools('verify-summary .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.checks.self_check, 'passed', `Expected self_check "passed": ${JSON.stringify(output.checks)}`);
  });

  test('detects self-check section with fail indicators', () => {
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-SUMMARY.md');
    fs.writeFileSync(summaryPath, [
      '# Summary',
      '',
      '## Verification',
      '',
      'Tests failed',
    ].join('\n'));

    const result = runGsdTools('verify-summary .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.checks.self_check, 'failed', `Expected self_check "failed": ${JSON.stringify(output.checks)}`);
  });

  test('REG-03: returns self_check "not_found" when no self-check section exists', () => {
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-SUMMARY.md');
    fs.writeFileSync(summaryPath, [
      '# Summary',
      '',
      '## Accomplishments',
      '',
      'Everything went well.',
    ].join('\n'));

    const result = runGsdTools('verify-summary .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.checks.self_check, 'not_found', `Expected self_check "not_found": ${JSON.stringify(output.checks)}`);
    assert.strictEqual(output.passed, true, `Missing self-check should not fail: ${JSON.stringify(output)}`);
  });

  test('search(-1) regression: self-check guard prevents entry when no heading', () => {
    // No Self-Check/Verification/Quality Check heading — guard on line 79 prevents
    // content.search(selfCheckPattern) from ever being called, so -1 is impossible
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-SUMMARY.md');
    fs.writeFileSync(summaryPath, [
      '# Summary',
      '',
      '## Notes',
      '',
      'Some content here without a self-check heading.',
    ].join('\n'));

    const result = runGsdTools('verify-summary .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Guard works: selfCheckPattern.test() is false, if block not entered, selfCheck stays 'not_found'
    assert.strictEqual(output.checks.self_check, 'not_found', `Expected not_found since no heading: ${JSON.stringify(output.checks)}`);
  });

  test('respects checkFileCount parameter', () => {
    // Write summary referencing 5 files (none exist)
    const summaryPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-SUMMARY.md');
    fs.writeFileSync(summaryPath, [
      '# Summary',
      '',
      'Files: `src/a.js`, `src/b.js`, `src/c.js`, `src/d.js`, `src/e.js`',
    ].join('\n'));

    // Pass checkFileCount = 1 so only 1 file is checked
    const result = runGsdTools('verify-summary .planning/phases/01-test/01-01-SUMMARY.md --check-count 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.checks.files_created.checked <= 1,
      `Expected checked <= 1, got ${output.checks.files_created.checked}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verify references command
// ─────────────────────────────────────────────────────────────────────────────

describe('verify references command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, 'src', 'utils'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reports valid when all referenced files exist', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'console.log("app");\n');
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-test', 'doc.md');
    fs.writeFileSync(filePath, '@src/app.js\n');

    const result = runGsdTools('verify references .planning/phases/01-test/doc.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid, true, `should be valid: ${JSON.stringify(output)}`);
    assert.strictEqual(output.found, 1, `should find 1 file: ${JSON.stringify(output)}`);
  });

  test('reports missing for nonexistent referenced files', () => {
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-test', 'doc.md');
    fs.writeFileSync(filePath, '@src/missing.js\n');

    const result = runGsdTools('verify references .planning/phases/01-test/doc.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid, false, 'should be invalid');
    assert.ok(
      output.missing.includes('src/missing.js'),
      `Expected missing to include "src/missing.js": ${JSON.stringify(output.missing)}`
    );
  });

  test('detects backtick file paths', () => {
    fs.writeFileSync(path.join(tmpDir, 'src', 'utils', 'helper.js'), 'module.exports = {};\n');
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-test', 'doc.md');
    fs.writeFileSync(filePath, 'See `src/utils/helper.js` for details.\n');

    const result = runGsdTools('verify references .planning/phases/01-test/doc.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.found >= 1, `Expected at least 1 found, got ${output.found}`);
  });

  test('skips backtick template expressions', () => {
    // Template expressions like ${variable} in backtick paths are skipped
    // @-refs with http are processed but not found on disk
    const filePath = path.join(tmpDir, '.planning', 'phases', '01-test', 'doc.md');
    fs.writeFileSync(filePath, '`${variable}/path/file.js`\n');

    const result = runGsdTools('verify references .planning/phases/01-test/doc.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Template expression is skipped entirely — total should be 0
    assert.strictEqual(output.total, 0, `Expected total 0 (template skipped): ${JSON.stringify(output)}`);
  });

  test('returns error for nonexistent file', () => {
    const result = runGsdTools('verify references .planning/phases/01-test/nonexistent.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error, `Expected error field: ${JSON.stringify(output)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verify commits command
// ─────────────────────────────────────────────────────────────────────────────

describe('verify commits command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validates real commit hashes', () => {
    const hash = execSync('git rev-parse --short HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();

    const result = runGsdTools(`verify commits ${hash}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_valid, true, `Expected all_valid true: ${JSON.stringify(output)}`);
    assert.ok(output.valid.includes(hash), `Expected valid to include ${hash}: ${JSON.stringify(output.valid)}`);
  });

  test('reports invalid for fake hashes', () => {
    const result = runGsdTools('verify commits abcdef1234567', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_valid, false, `Expected all_valid false: ${JSON.stringify(output)}`);
    assert.ok(
      output.invalid.includes('abcdef1234567'),
      `Expected invalid to include "abcdef1234567": ${JSON.stringify(output.invalid)}`
    );
  });

  test('handles mixed valid and invalid hashes', () => {
    const hash = execSync('git rev-parse --short HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();

    const result = runGsdTools(`verify commits ${hash} abcdef1234567`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid.length, 1, `Expected 1 valid: ${JSON.stringify(output)}`);
    assert.strictEqual(output.invalid.length, 1, `Expected 1 invalid: ${JSON.stringify(output)}`);
    assert.strictEqual(output.all_valid, false, `Expected all_valid false: ${JSON.stringify(output)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verify artifacts command
// ─────────────────────────────────────────────────────────────────────────────

describe('verify artifacts command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function writePlanWithArtifacts(tmpDir, artifactsYaml) {
    // parseMustHavesBlock expects 4-space indent for block name, 6-space for items, 8-space for keys
    const content = [
      '---',
      'phase: 01-test',
      'plan: 01',
      'type: execute',
      'wave: 1',
      'depends_on: []',
      'files_modified: [src/app.js]',
      'autonomous: true',
      'must_haves:',
      '    artifacts:',
      ...artifactsYaml.map(line => `      ${line}`),
      '---',
      '',
      '<tasks>',
      '<task type="auto">',
      '  <name>Task 1: Do thing</name>',
      '  <files>src/app.js</files>',
      '  <action>Do it</action>',
      '  <verify><automated>echo ok</automated></verify>',
      '  <done>Done</done>',
      '</task>',
      '</tasks>',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, content);
  }

  test('passes when all artifacts exist and match criteria', () => {
    writePlanWithArtifacts(tmpDir, [
      '- path: "src/app.js"',
      '  min_lines: 2',
      '  contains: "export"',
    ]);
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'const x = 1;\nexport default x;\nconst y = 2;\n');

    const result = runGsdTools('verify artifacts .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_passed, true, `Expected all_passed true: ${JSON.stringify(output)}`);
  });

  test('reports missing artifact file', () => {
    writePlanWithArtifacts(tmpDir, [
      '- path: "src/nonexistent.js"',
    ]);

    const result = runGsdTools('verify artifacts .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_passed, false, 'Expected all_passed false');
    assert.ok(
      output.artifacts[0].issues.some(i => i.includes('File not found')),
      `Expected "File not found" in issues: ${JSON.stringify(output.artifacts[0].issues)}`
    );
  });

  test('reports insufficient line count', () => {
    writePlanWithArtifacts(tmpDir, [
      '- path: "src/app.js"',
      '  min_lines: 10',
    ]);
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'const x = 1;\n');

    const result = runGsdTools('verify artifacts .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_passed, false, 'Expected all_passed false');
    assert.ok(
      output.artifacts[0].issues.some(i => i.includes('Only') && i.includes('lines, need 10')),
      `Expected line count issue: ${JSON.stringify(output.artifacts[0].issues)}`
    );
  });

  test('reports missing pattern', () => {
    writePlanWithArtifacts(tmpDir, [
      '- path: "src/app.js"',
      '  contains: "module.exports"',
    ]);
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'const x = 1;\n');

    const result = runGsdTools('verify artifacts .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_passed, false, 'Expected all_passed false');
    assert.ok(
      output.artifacts[0].issues.some(i => i.includes('Missing pattern')),
      `Expected "Missing pattern" in issues: ${JSON.stringify(output.artifacts[0].issues)}`
    );
  });

  test('reports missing export', () => {
    writePlanWithArtifacts(tmpDir, [
      '- path: "src/app.js"',
      '  exports:',
      '    - GET',
    ]);
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'const x = 1;\nexport const POST = () => {};\n');

    const result = runGsdTools('verify artifacts .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_passed, false, 'Expected all_passed false');
    assert.ok(
      output.artifacts[0].issues.some(i => i.includes('Missing export')),
      `Expected "Missing export" in issues: ${JSON.stringify(output.artifacts[0].issues)}`
    );
  });

  test('returns error when no artifacts in frontmatter', () => {
    const content = [
      '---',
      'phase: 01-test',
      'plan: 01',
      'type: execute',
      'wave: 1',
      'depends_on: []',
      'files_modified: [src/app.js]',
      'autonomous: true',
      'must_haves:',
      '  truths:',
      '    - "something is true"',
      '---',
      '',
      '<tasks></tasks>',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, content);

    const result = runGsdTools('verify artifacts .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error, `Expected error field: ${JSON.stringify(output)}`);
    assert.ok(
      output.error.includes('No must_haves.artifacts'),
      `Expected "No must_haves.artifacts" in error: ${output.error}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verify key-links command
// ─────────────────────────────────────────────────────────────────────────────

describe('verify key-links command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  function writePlanWithKeyLinks(tmpDir, keyLinksYaml) {
    // parseMustHavesBlock expects 4-space indent for block name, 6-space for items, 8-space for keys
    const content = [
      '---',
      'phase: 01-test',
      'plan: 01',
      'type: execute',
      'wave: 1',
      'depends_on: []',
      'files_modified: [src/a.js]',
      'autonomous: true',
      'must_haves:',
      '    key_links:',
      ...keyLinksYaml.map(line => `      ${line}`),
      '---',
      '',
      '<tasks>',
      '<task type="auto">',
      '  <name>Task 1: Do thing</name>',
      '  <files>src/a.js</files>',
      '  <action>Do it</action>',
      '  <verify><automated>echo ok</automated></verify>',
      '  <done>Done</done>',
      '</task>',
      '</tasks>',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, content);
  }

  test('verifies link when pattern found in source', () => {
    writePlanWithKeyLinks(tmpDir, [
      '- from: "src/a.js"',
      '  to: "src/b.js"',
      '  pattern: "import.*b"',
    ]);
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.js'), "import { x } from './b';\n");
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.js'), 'exports.x = 1;\n');

    const result = runGsdTools('verify key-links .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_verified, true, `Expected all_verified true: ${JSON.stringify(output)}`);
  });

  test('verifies link when pattern found in target', () => {
    writePlanWithKeyLinks(tmpDir, [
      '- from: "src/a.js"',
      '  to: "src/b.js"',
      '  pattern: "exports\\.targetFunc"',
    ]);
    // pattern NOT in source, but found in target
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.js'), 'const x = 1;\n');
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.js'), 'exports.targetFunc = () => {};\n');

    const result = runGsdTools('verify key-links .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_verified, true, `Expected verified via target: ${JSON.stringify(output)}`);
    assert.ok(
      output.links[0].detail.includes('target'),
      `Expected detail about target: ${output.links[0].detail}`
    );
  });

  test('fails when pattern not found in source or target', () => {
    writePlanWithKeyLinks(tmpDir, [
      '- from: "src/a.js"',
      '  to: "src/b.js"',
      '  pattern: "missingPattern"',
    ]);
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.js'), 'const x = 1;\n');
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.js'), 'const y = 2;\n');

    const result = runGsdTools('verify key-links .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_verified, false, `Expected all_verified false: ${JSON.stringify(output)}`);
    assert.strictEqual(output.links[0].verified, false, 'link should not be verified');
  });

  test('verifies link without pattern using string inclusion', () => {
    writePlanWithKeyLinks(tmpDir, [
      '- from: "src/a.js"',
      '  to: "src/b.js"',
    ]);
    // source file contains the 'to' value as a string
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.js'), "const b = require('./src/b.js');\n");
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.js'), 'module.exports = {};\n');

    const result = runGsdTools('verify key-links .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.all_verified, true, `Expected all_verified true: ${JSON.stringify(output)}`);
    assert.ok(
      output.links[0].detail.includes('Target referenced in source'),
      `Expected "Target referenced in source" in detail: ${output.links[0].detail}`
    );
  });

  test('reports source file not found', () => {
    writePlanWithKeyLinks(tmpDir, [
      '- from: "src/nonexistent.js"',
      '  to: "src/b.js"',
      '  pattern: "something"',
    ]);
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.js'), 'module.exports = {};\n');

    const result = runGsdTools('verify key-links .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.links[0].detail.includes('Source file not found'),
      `Expected "Source file not found" in detail: ${output.links[0].detail}`
    );
  });

  test('returns error when no key_links in frontmatter', () => {
    const content = [
      '---',
      'phase: 01-test',
      'plan: 01',
      'type: execute',
      'wave: 1',
      'depends_on: []',
      'files_modified: [src/a.js]',
      'autonomous: true',
      'must_haves:',
      '  truths:',
      '    - "something is true"',
      '---',
      '',
      '<tasks></tasks>',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, content);

    const result = runGsdTools('verify key-links .planning/phases/01-test/01-01-PLAN.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error, `Expected error field: ${JSON.stringify(output)}`);
    assert.ok(
      output.error.includes('No must_haves.key_links'),
      `Expected "No must_haves.key_links" in error: ${output.error}`
    );
  });
});
