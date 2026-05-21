// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.
// allow-test-rule: state-md-is-the-runtime-contract — regression tests for
// bug #3517 assert the exact STATE.md fields written by phase.complete;
// STATE.md IS the product surface being verified, not source code.
// Migration to typed-IR parser tracked in #2974.

/**
 * GSD Tools Tests - Phase
 *
 * Consolidated from 20 → 4 test files (issue #3740). This file covers the
 * CJS phase CLI layer (phase.cjs + gsd-tools.cjs): add, remove, complete,
 * list, insert, and all regression tests for bugs in that layer.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { runGsdTools, createTempProject, createTempDir, cleanup } = require('./helpers.cjs');

const GSD_TOOLS_BIN = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');
const SDK_CLI = path.join(__dirname, '..', 'sdk', 'dist', 'cli.js');

describe('phases list command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns empty array', () => {
    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.directories, [], 'directories should be empty');
    assert.strictEqual(output.count, 0, 'count should be 0');
  });

  test('lists phase directories sorted numerically', () => {
    // Create out-of-order directories
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '10-final'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 3, 'should have 3 directories');
    assert.deepStrictEqual(
      output.directories,
      ['01-foundation', '02-api', '10-final'],
      'should be sorted numerically'
    );
  });

  test('handles decimal phases in sort order', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.1-hotfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.2-patch'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-ui'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.directories,
      ['02-api', '02.1-hotfix', '02.2-patch', '03-ui'],
      'decimal phases should sort correctly between whole numbers'
    );
  });

  test('--type plans lists only PLAN.md files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(phaseDir, 'RESEARCH.md'), '# Research');

    const result = runGsdTools('phases list --type plans', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.files.sort(),
      ['01-01-PLAN.md', '01-02-PLAN.md'],
      'should list only PLAN files'
    );
  });

  test('--type summaries lists only SUMMARY.md files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary 2');

    const result = runGsdTools('phases list --type summaries', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.files.sort(),
      ['01-01-SUMMARY.md', '01-02-SUMMARY.md'],
      'should list only SUMMARY files'
    );
  });

  test('--phase filters to specific phase directory', () => {
    const phase01 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    const phase02 = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase01, { recursive: true });
    fs.mkdirSync(phase02, { recursive: true });
    fs.writeFileSync(path.join(phase01, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase02, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('phases list --type plans --phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.files, ['01-01-PLAN.md'], 'should only list phase 01 plans');
    assert.strictEqual(output.phase_dir, 'foundation', 'should report phase name without number prefix');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap get-phase command
// ─────────────────────────────────────────────────────────────────────────────


describe('phase next-decimal command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns X.1 when no decimal phases exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '07-next'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.1', 'should return 06.1');
    assert.deepStrictEqual(output.existing, [], 'no existing decimals');
  });

  test('increments from existing decimal phases', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-hotfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.2-patch'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.3', 'should return 06.3');
    assert.deepStrictEqual(output.existing, ['06.1', '06.2'], 'lists existing decimals');
  });

  test('handles gaps in decimal sequence', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-first'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.3-third'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Should take next after highest, not fill gap
    assert.strictEqual(output.next, '06.4', 'should return 06.4, not fill gap at 06.2');
  });

  test('handles single-digit phase input', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });

    const result = runGsdTools('phase next-decimal 6', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.1', 'should normalize to 06.1');
    assert.strictEqual(output.base_phase, '06', 'base phase should be padded');
  });

  test('returns error if base phase does not exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-start'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'base phase not found');
    assert.strictEqual(output.next, '06.1', 'should still suggest 06.1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase-plan-index command
// ─────────────────────────────────────────────────────────────────────────────


describe('phase-plan-index command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phase directory returns empty plans array', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase, '03', 'phase number correct');
    assert.deepStrictEqual(output.plans, [], 'plans should be empty');
    assert.deepStrictEqual(output.waves, {}, 'waves should be empty');
    assert.deepStrictEqual(output.incomplete, [], 'incomplete should be empty');
    assert.strictEqual(output.has_checkpoints, false, 'no checkpoints');
    assert.ok(output.warning === undefined, 'truly empty dir must not emit a warning');
  });

  // #2893 — when the planner produces filenames that don't match the canonical
  // `{padded_phase}-{NN}-PLAN.md` contract, the executor used to silently see
  // plan_count: 0 with no signal. Now the response must include a `warning`
  // field naming every offender, so the user gets an actionable error instead
  // of "execute-phase blocked, no clue why".
  test('non-canonical plan filenames surface a warning naming each offender (#2893)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // The reporter's exact symptom: planner wrote `{phase-id}-PLAN-{N}-{slug}.md`.
    fs.writeFileSync(path.join(phaseDir, '01-PLAN-01-foundation.md'), '---\n---\n');
    fs.writeFileSync(path.join(phaseDir, '01-PLAN-02-api.md'), '---\n---\n');

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 0, 'non-canonical files are not silently accepted');
    assert.ok(typeof output.warning === 'string', 'warning field must be present');
    assert.ok(output.warning.includes('01-PLAN-01-foundation.md'), 'warning names the first offender');
    assert.ok(output.warning.includes('01-PLAN-02-api.md'), 'warning names the second offender');
    assert.ok(
      output.warning.includes('{padded_phase}-{NN}-PLAN.md'),
      'warning cites the canonical pattern so user knows what to rename to',
    );
  });

  test('canonical plans suppress the warning even alongside derivative files (#2893)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Canonical plan + the legitimate derivative artifacts the planner emits.
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '---\nwave: 1\n---\n');
    fs.writeFileSync(path.join(phaseDir, '03-PLAN-OUTLINE.md'), '# outline\n');
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.pre-bounce.md'), '---\n---\n');

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 1, 'canonical plan detected');
    assert.ok(
      output.warning === undefined,
      `outline and pre-bounce files must not trigger the warning, got: ${output.warning}`,
    );
  });

  // #2893 parity — find-phase reads the same phase directory and applies the
  // same canonical filter, so it must emit the same warning shape. Without
  // these tests the two code paths could silently diverge.
  test('find-phase: non-canonical plan filenames surface the same warning (#2893 parity)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-PLAN-01-foundation.md'), '---\n---\n');
    fs.writeFileSync(path.join(phaseDir, '01-PLAN-02-api.md'), '---\n---\n');

    const result = runGsdTools('find-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase directory found');
    assert.deepStrictEqual(output.plans, [], 'non-canonical files are not silently accepted');
    assert.ok(typeof output.warning === 'string', 'warning field must be present');
    assert.ok(output.warning.includes('01-PLAN-01-foundation.md'), 'warning names the first offender');
    assert.ok(output.warning.includes('01-PLAN-02-api.md'), 'warning names the second offender');
    assert.ok(
      output.warning.includes('{padded_phase}-{NN}-PLAN.md'),
      'warning cites the canonical pattern',
    );
  });

  test('find-phase: canonical plans + derivatives suppress the warning (#2893 parity)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '---\nwave: 1\n---\n');
    fs.writeFileSync(path.join(phaseDir, '03-PLAN-OUTLINE.md'), '# outline\n');
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.pre-bounce.md'), '---\n---\n');

    const result = runGsdTools('find-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.plans, ['03-01-PLAN.md'], 'canonical plan detected');
    assert.ok(
      output.warning === undefined,
      `outline and pre-bounce files must not trigger the warning, got: ${output.warning}`,
    );
  });

  // #2893 parity — `phases list --type plans` aggregates across phase dirs
  // and prefixes each warning with `${dir}: ` so the user can locate the
  // offending phase. Test mirrors the find-phase pair but accounts for that
  // prefix in the assertion.
  test('phases list --type plans: non-canonical filenames surface a per-dir warning (#2893 parity)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-PLAN-01-foundation.md'), '---\n---\n');
    fs.writeFileSync(path.join(phaseDir, '01-PLAN-02-api.md'), '---\n---\n');

    const result = runGsdTools('phases list --type plans --phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.files, [], 'non-canonical files are not silently accepted');
    assert.ok(typeof output.warning === 'string', 'warning field must be present');
    assert.ok(output.warning.includes('03-api:'), 'warning is prefixed with the offending phase dir');
    assert.ok(output.warning.includes('01-PLAN-01-foundation.md'), 'warning names the first offender');
    assert.ok(output.warning.includes('01-PLAN-02-api.md'), 'warning names the second offender');
    assert.ok(
      output.warning.includes('{padded_phase}-{NN}-PLAN.md'),
      'warning cites the canonical pattern',
    );
  });

  test('phases list --type plans: canonical plans suppress the warning (#2893 parity)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '---\nwave: 1\n---\n');
    fs.writeFileSync(path.join(phaseDir, '03-PLAN-OUTLINE.md'), '# outline\n');
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.pre-bounce.md'), '---\n---\n');

    const result = runGsdTools('phases list --type plans --phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.files, ['03-01-PLAN.md'], 'canonical plan detected');
    assert.ok(
      output.warning === undefined,
      `outline and pre-bounce files must not trigger the warning, got: ${output.warning}`,
    );
  });

  test('extracts single plan with frontmatter', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Set up database schema
files-modified: [prisma/schema.prisma, src/lib/db.ts]
---

## Task 1: Create schema
## Task 2: Generate client
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 1, 'should have 1 plan');
    assert.strictEqual(output.plans[0].id, '03-01', 'plan id correct');
    assert.strictEqual(output.plans[0].wave, 1, 'wave extracted');
    assert.strictEqual(output.plans[0].autonomous, true, 'autonomous extracted');
    assert.strictEqual(output.plans[0].objective, 'Set up database schema', 'objective extracted');
    assert.deepStrictEqual(output.plans[0].files_modified, ['prisma/schema.prisma', 'src/lib/db.ts'], 'files extracted');
    assert.strictEqual(output.plans[0].task_count, 2, 'task count correct');
    assert.strictEqual(output.plans[0].has_summary, false, 'no summary yet');
  });

  test('groups multiple plans by wave (DAG-bucketing: 03-03 depends on 03-01 and 03-02)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      [
        '---',
        'wave: 1',
        'autonomous: true',
        'objective: Database setup',
        'depends_on: []',
        '---',
        '',
        '## Task 1: Schema',
      ].join('\n')
    );

    fs.writeFileSync(
      path.join(phaseDir, '03-02-PLAN.md'),
      [
        '---',
        'wave: 1',
        'autonomous: true',
        'objective: Auth setup',
        'depends_on: []',
        '---',
        '',
        '## Task 1: JWT',
      ].join('\n')
    );

    fs.writeFileSync(
      path.join(phaseDir, '03-03-PLAN.md'),
      [
        '---',
        'wave: 2',
        'autonomous: false',
        'objective: API routes',
        'depends_on:',
        '  - 03-01',
        '  - 03-02',
        '---',
        '',
        '## Task 1: Routes',
      ].join('\n')
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 3, 'should have 3 plans');
    assert.deepStrictEqual(output.waves['1'], ['03-01', '03-02'], 'wave 1 has 2 plans');
    assert.deepStrictEqual(output.waves['2'], ['03-03'], 'wave 2 has 1 plan');
    // No mismatch warning: declared wave 2 matches topo level 2
    assert.strictEqual(output.warnings, undefined, 'no warnings when declared wave matches DAG');
  });

  test('detects incomplete plans (no matching summary)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Plan with summary
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), `---\nwave: 1\n---\n## Task 1`);
    fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), `# Summary`);

    // Plan without summary
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), `---\nwave: 2\n---\n## Task 1`);

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans[0].has_summary, true, 'first plan has summary');
    assert.strictEqual(output.plans[1].has_summary, false, 'second plan has no summary');
    assert.deepStrictEqual(output.incomplete, ['03-02'], 'incomplete list correct');
  });

  test('phase-plan-index matches descriptive plan with prefix summary (#3101)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '03-01-auth-hardening-PLAN.md'), `---\nwave: 1\n---\n## Task 1`);
    fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), `# Summary`);

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans[0].has_summary, true, 'descriptive plan should match prefix summary');
    assert.deepStrictEqual(output.incomplete, [], 'plan should not be marked incomplete');
  });

  // #3266 CR — depends_on canonical-id mismatch: a plan named
  // '03-01-auth-hardening-PLAN.md' is stored with id '03-01-auth-hardening',
  // but a dependency declared as '03-01' was never resolving to it, silently
  // putting the dependent plan in the same wave as its prerequisite.
  test('depends_on short canonical prefix resolves against descriptive plan filename (#3266)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Plan 01: descriptive filename — id becomes '03-01-auth-hardening'
    fs.writeFileSync(
      path.join(phaseDir, '03-01-auth-hardening-PLAN.md'),
      `---\nwave: 1\n---\n## Task 1\n`,
    );
    // Plan 02: depends on the canonical prefix '03-01' (not the full stem)
    fs.writeFileSync(
      path.join(phaseDir, '03-02-followup-PLAN.md'),
      `---\ndepends_on:\n  - '03-01'\n---\n## Task 1\n`,
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const waves = output.waves;

    // Plan 01 must be in an earlier wave than plan 02
    const wave01 = Object.keys(waves).find(w => waves[w].some(id => id.startsWith('03-01')));
    const wave02 = Object.keys(waves).find(w => waves[w].some(id => id.startsWith('03-02')));
    assert.ok(wave01 !== undefined, 'plan 03-01-auth-hardening should appear in waves');
    assert.ok(wave02 !== undefined, 'plan 03-02-followup should appear in waves');
    assert.ok(
      Number(wave01) < Number(wave02),
      `03-02 must be in a later wave than 03-01 (got wave01=${wave01}, wave02=${wave02})`,
    );
  });

  test('detects checkpoints (autonomous: false)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: false
objective: Manual review needed
---

## Task 1: Review
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_checkpoints, true, 'should detect checkpoint');
    assert.strictEqual(output.plans[0].autonomous, false, 'plan marked non-autonomous');
  });

  test('phase not found returns error', () => {
    const result = runGsdTools('phase-plan-index 99', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'Phase not found', 'should report phase not found');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// phase-plan-index — canonical XML format (template-aligned)
// ─────────────────────────────────────────────────────────────────────────────

describe('phase-plan-index canonical format', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('files_modified: underscore key is parsed correctly', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '04-ui');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '04-01-PLAN.md'),
      `---
wave: 1
autonomous: true
files_modified: [src/App.tsx, src/index.ts]
---

<objective>
Build main application shell

Purpose: Entry point
Output: App component
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Create App component</name>
  <files>src/App.tsx</files>
  <action>Create component</action>
  <verify>npm run build</verify>
  <done>Component renders</done>
</task>
</tasks>
`
    );

    const result = runGsdTools('phase-plan-index 04', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.plans[0].files_modified,
      ['src/App.tsx', 'src/index.ts'],
      'files_modified with underscore should be parsed'
    );
  });

  test('objective: extracted from <objective> XML tag, not frontmatter', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '04-ui');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '04-01-PLAN.md'),
      `---
wave: 1
autonomous: true
files_modified: []
---

<objective>
Build main application shell

Purpose: Entry point for the SPA
Output: App.tsx with routing
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Scaffold</name>
  <files>src/App.tsx</files>
  <action>Create shell</action>
  <verify>build passes</verify>
  <done>App renders</done>
</task>
</tasks>
`
    );

    const result = runGsdTools('phase-plan-index 04', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(
      output.plans[0].objective,
      'Build main application shell',
      'objective should come from <objective> XML tag first line'
    );
  });

  test('task_count: counts <task> XML tags', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '04-ui');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '04-01-PLAN.md'),
      `---
wave: 1
autonomous: true
files_modified: []
---

<objective>
Create UI components
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Header</name>
  <files>src/Header.tsx</files>
  <action>Create header</action>
  <verify>build</verify>
  <done>Header renders</done>
</task>

<task type="auto">
  <name>Task 2: Footer</name>
  <files>src/Footer.tsx</files>
  <action>Create footer</action>
  <verify>build</verify>
  <done>Footer renders</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>UI components</what-built>
  <how-to-verify>Visit localhost:3000</how-to-verify>
  <resume-signal>Type approved</resume-signal>
</task>
</tasks>
`
    );

    const result = runGsdTools('phase-plan-index 04', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(
      output.plans[0].task_count,
      3,
      'should count all 3 <task> XML tags'
    );
  });

  test('all three fields work together in canonical plan format', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '04-ui');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '04-01-PLAN.md'),
      `---
phase: 04-ui
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/components/Chat.tsx, src/app/api/chat/route.ts]
autonomous: true
requirements: [R1, R2]
---

<objective>
Implement complete Chat feature as vertical slice.

Purpose: Self-contained chat that can run parallel to other features.
Output: Chat component, API endpoints.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
</context>

<tasks>
<task type="auto">
  <name>Task 1: Create Chat component</name>
  <files>src/components/Chat.tsx</files>
  <action>Build chat UI with message list and input</action>
  <verify>npm run build</verify>
  <done>Chat component renders messages</done>
</task>

<task type="auto">
  <name>Task 2: Create Chat API</name>
  <files>src/app/api/chat/route.ts</files>
  <action>GET /api/chat and POST /api/chat endpoints</action>
  <verify>curl tests pass</verify>
  <done>CRUD operations work</done>
</task>
</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] API endpoints respond correctly
</verification>
`
    );

    const result = runGsdTools('phase-plan-index 04', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const plan = output.plans[0];
    assert.strictEqual(plan.objective, 'Implement complete Chat feature as vertical slice.', 'objective from XML tag');
    assert.deepStrictEqual(plan.files_modified, ['src/components/Chat.tsx', 'src/app/api/chat/route.ts'], 'files_modified with underscore');
    assert.strictEqual(plan.task_count, 2, 'task_count from <task> XML tags');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state-snapshot command
// ─────────────────────────────────────────────────────────────────────────────


describe('phase add command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('adds phase after highest existing', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API

---
`
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
    assert.ok(roadmap.includes('**Depends on:** Phase 2'), 'should depend on previous');
  });

  test('handles empty roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );

    const result = runGsdTools('phase add Initial Setup', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 1, 'should be phase 1');
  });

  test('phase add includes **Requirements**: TBD in new ROADMAP entry', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n`
    );

    const result = runGsdTools('phase add User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('**Requirements**: TBD'), 'new phase entry should include Requirements TBD');
  });

  test('phase add ignores --raw instead of persisting it in the description', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n`
    );

    const result = runGsdTools(['phase', 'add', '--raw', 'User', 'Dashboard'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('### Phase 2: User Dashboard'), 'description should exclude --raw');
    assert.ok(!roadmap.includes('--raw'), 'raw flag must not be persisted into ROADMAP.md');
  });

  test('phase add rejects unsupported flags and dangling --id', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n`
    );

    const unsupported = runGsdTools(['phase', 'add', '--unknown', 'Dashboard'], tmpDir);
    assert.ok(!unsupported.success, 'unsupported flags should fail');
    assert.match(unsupported.error, /phase add does not support --unknown/);

    const dangling = runGsdTools(['phase', 'add', 'Dashboard', '--id'], tmpDir);
    assert.ok(!dangling.success, 'dangling --id should fail');
    assert.match(dangling.error, /--id requires a value/);
  });

  test('skips 999.x backlog phases when calculating next phase number', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API

### Phase 3: UI
**Goal:** Build UI

### Phase 999.1: Future Idea A
**Goal:** Backlog item

### Phase 999.2: Future Idea B
**Goal:** Backlog item

---
`
    );

    const result = runGsdTools('phase add Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 4, 'should be phase 4, not 1000');
    assert.strictEqual(output.slug, 'dashboard');

    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '04-dashboard')),
      'directory should be 04-dashboard, not 1000-dashboard'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase add — orphan directory collision prevention (#2026)
// ─────────────────────────────────────────────────────────────────────────────

describe('phase add — orphan directory collision prevention (#2026)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('orphan directory with higher number than ROADMAP pushes maxPhase up', () => {
    // Orphan directory 05-orphan exists on disk but is NOT in ROADMAP.md
    const orphanDir = path.join(tmpDir, '.planning', 'phases', '05-orphan');
    fs.mkdirSync(orphanDir, { recursive: true });
    fs.writeFileSync(path.join(orphanDir, 'SUMMARY.md'), 'existing work');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '## Milestone v1',
        '### Phase 1: First phase',
        '**Plans:** 0 plans',
        '---',
      ].join('\n')
    );

    const result = runGsdTools('phase add dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // ROADMAP max is 1, but orphan 05-orphan means disk max is 5 → new phase = 6
    assert.strictEqual(output.phase_number, 6, 'should be phase 6 (orphan 05 pushes max to 5)');

    // The new directory must be 06-dashboard, not 02-dashboard
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '06-dashboard')),
      'new phase directory must be 06-dashboard, not collide with orphan 05-orphan'
    );

    // The orphan directory must be untouched
    assert.ok(
      fs.existsSync(path.join(orphanDir, 'SUMMARY.md')),
      'orphan directory content must be preserved (not overwritten)'
    );
  });

  test('orphan directories with 999.x prefix are skipped when calculating disk max', () => {
    // 999.x backlog orphans must not inflate the next sequential phase number
    const backlogOrphan = path.join(tmpDir, '.planning', 'phases', '999-backlog-stuff');
    fs.mkdirSync(backlogOrphan, { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '### Phase 1: Foundation',
        '**Plans:** 0 plans',
        '---',
      ].join('\n')
    );

    const result = runGsdTools('phase add new-feature', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // ROADMAP max is 1, disk orphan is 999 (backlog) → should be ignored → new phase = 2
    assert.strictEqual(output.phase_number, 2, 'backlog 999.x orphan must not inflate phase count');
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-new-feature')),
      'new phase directory should be 02-new-feature'
    );
  });

  test('project_code prefix in orphan directory name is stripped before comparing', () => {
    // Orphan directory has project_code prefix e.g. CK-05-orphan
    const orphanDir = path.join(tmpDir, '.planning', 'phases', 'CK-05-old-feature');
    fs.mkdirSync(orphanDir, { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ project_code: 'CK' })
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '### Phase 1: Foundation',
        '**Plans:** 0 plans',
        '---',
      ].join('\n')
    );

    const result = runGsdTools('phase add new-feature', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // ROADMAP max is 1, disk has CK-05-old-feature → strip prefix → disk max is 5 → new phase = 6
    assert.strictEqual(output.phase_number, 6, 'project_code prefix must be stripped before disk max calculation');
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', 'CK-06-new-feature')),
      'new phase directory must be CK-06-new-feature'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase add with project_code prefix
// ─────────────────────────────────────────────────────────────────────────────


describe('phase add with project_code', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('prefixes phase directory with project_code', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ project_code: 'CK' })
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n'
    );

    const result = runGsdTools('phase add User Dashboard', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 2, 'should be phase 2');
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', 'CK-02-user-dashboard')),
      'directory should have CK- prefix'
    );
  });

  test('no prefix when project_code is null', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ project_code: null })
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n'
    );

    const result = runGsdTools('phase add User Dashboard', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-user-dashboard')),
      'directory should have no prefix'
    );
  });

  test('find-phase resolves prefixed directories', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', 'CK-01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');

    const result = runGsdTools('find-phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'should find prefixed phase');
    assert.strictEqual(output.phase_number, '01', 'should extract numeric phase number');
  });

  test('phases list sorts prefixed directories correctly', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', 'CK-02-api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', 'CK-01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', 'CK-03-ui'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.directories,
      ['CK-01-foundation', 'CK-02-api', 'CK-03-ui'],
      'prefixed phases should sort numerically'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase add-batch command (#2165)
// ─────────────────────────────────────────────────────────────────────────────

describe('phase add-batch command (#2165)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap v1.0',
        '',
        '### Phase 1: Foundation',
        '**Goal:** Setup',
        '',
        '---',
        '',
      ].join('\n')
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('adds multiple phases with sequential numbers in a single call', () => {
    // Use array form to avoid shell quoting issues with JSON args
    const result = runGsdTools(['phase', 'add-batch', '--descriptions', '["Alpha","Beta","Gamma"]'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 3, 'should report 3 phases added');
    assert.strictEqual(output.phases[0].phase_number, 2);
    assert.strictEqual(output.phases[1].phase_number, 3);
    assert.strictEqual(output.phases[2].phase_number, 4);

    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-alpha')), '02-alpha dir must exist');
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-beta')), '03-beta dir must exist');
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '04-gamma')), '04-gamma dir must exist');

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('### Phase 2: Alpha'), 'roadmap should include Phase 2');
    assert.ok(roadmap.includes('### Phase 3: Beta'), 'roadmap should include Phase 3');
    assert.ok(roadmap.includes('### Phase 4: Gamma'), 'roadmap should include Phase 4');
  });

  test('no duplicate phase numbers when multiple add-batch calls are made sequentially', () => {
    // Regression for #2165: parallel `phase add` invocations produced duplicates
    // because each read disk state before any write landed. add-batch serializes
    // the entire batch under a single lock so the next call sees the updated state.
    const r1 = runGsdTools(['phase', 'add-batch', '--descriptions', '["Wave-One-A","Wave-One-B"]'], tmpDir);
    assert.ok(r1.success, `First batch failed: ${r1.error}`);

    const r2 = runGsdTools(['phase', 'add-batch', '--descriptions', '["Wave-Two-A","Wave-Two-B"]'], tmpDir);
    assert.ok(r2.success, `Second batch failed: ${r2.error}`);

    const out1 = JSON.parse(r1.output);
    const out2 = JSON.parse(r2.output);
    const allNums = [...out1.phases, ...out2.phases].map(p => p.phase_number);
    const unique = new Set(allNums);
    assert.strictEqual(unique.size, allNums.length, `Duplicate phase numbers detected: ${allNums}`);

    // Directories must all exist and be unique
    const dirs = fs.readdirSync(path.join(tmpDir, '.planning', 'phases'));
    assert.strictEqual(dirs.length, 4, `Expected 4 phase dirs, got: ${dirs}`);
  });

  test('each phase directory contains a .gitkeep file', () => {
    const result = runGsdTools(['phase', 'add-batch', '--descriptions', '["Setup","Build"]'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-setup', '.gitkeep')),
      '.gitkeep must exist in 02-setup'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-build', '.gitkeep')),
      '.gitkeep must exist in 03-build'
    );
  });

  test('returns error for empty descriptions array', () => {
    const result = runGsdTools(['phase', 'add-batch', '--descriptions', '[]'], tmpDir);
    assert.ok(!result.success, 'should fail on empty array');
  });

  test('returns error when --descriptions JSON is not an array', () => {
    const result = runGsdTools(['phase', 'add-batch', '--descriptions', '{"one":"Alpha"}'], tmpDir);
    assert.ok(!result.success, 'should fail on non-array JSON');
    assert.match(result.error, /--descriptions must be a JSON array/);
  });

  test('returns error when --descriptions is missing its JSON value', () => {
    const missing = runGsdTools(['phase', 'add-batch', '--descriptions'], tmpDir);
    assert.ok(!missing.success, 'should fail on dangling --descriptions');
    assert.match(missing.error, /--descriptions must be a JSON array/);

    const flagValue = runGsdTools(['phase', 'add-batch', '--descriptions', '--raw'], tmpDir);
    assert.ok(!flagValue.success, 'should fail when --descriptions value is another flag');
    assert.match(flagValue.error, /--descriptions must be a JSON array/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase insert command
// ─────────────────────────────────────────────────────────────────────────────


describe('phase insert command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('inserts decimal phase after target', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phase insert 1 Fix Critical Bug', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '01.1', 'should be 01.1');
    assert.strictEqual(output.after_phase, '1');

    // Verify directory
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01.1-fix-critical-bug')),
      'decimal phase directory should be created'
    );

    // Verify ROADMAP
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Phase 01.1: Fix Critical Bug (INSERTED)'), 'roadmap should include inserted phase');
  });

  test('increments decimal when siblings exist', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01.1-hotfix'), { recursive: true });

    const result = runGsdTools('phase insert 1 Another Fix', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '01.2', 'should be 01.2');
  });

  test('rejects missing phase', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Test\n**Goal:** Test\n`
    );

    const result = runGsdTools('phase insert 99 Fix Something', tmpDir);
    assert.ok(!result.success, 'should fail for missing phase');
    assert.ok(result.error.includes('not found'), 'error mentions not found');
  });

  test('handles padding mismatch between input and roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

## Phase 09.05: Existing Decimal Phase
**Goal:** Test padding

## Phase 09.1: Next Phase
**Goal:** Test
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '09.05-existing'), { recursive: true });

    // Pass unpadded "9.05" but roadmap has "09.05"
    const result = runGsdTools('phase insert 9.05 Padding Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.after_phase, '9.05');

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('(INSERTED)'), 'roadmap should include inserted phase');
  });

  test('phase insert includes **Requirements**: TBD in new ROADMAP entry', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n### Phase 2: API\n**Goal:** Build API\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phase insert 1 Fix Critical Bug', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('**Requirements**: TBD'), 'inserted phase entry should include Requirements TBD');
  });

  test('reports actionable error for summary-only placeholder phase without detail section (#3098)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n- [ ] **Phase 5: Placeholder**\n`
    );

    const result = runGsdTools('phase insert 5 Hotfix', tmpDir);
    assert.ok(!result.success, 'should fail when phase is summary-only placeholder');
    assert.ok(result.error.includes('missing a detail section'));
  });

  test('phase insert rejects unsupported --dry-run flag explicitly (#3098)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );

    const result = runGsdTools('phase insert 1 Hotfix --dry-run', tmpDir);
    assert.ok(!result.success, 'phase insert should reject unsupported --dry-run');
    assert.ok(result.error.includes('does not support --dry-run'));
  });

  test('handles #### heading depth from multi-milestone roadmaps', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### v1.1 Milestone

#### Phase 5: Feature Work
**Goal:** Build features

#### Phase 6: Polish
**Goal:** Polish
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '05-feature-work'), { recursive: true });

    const result = runGsdTools('phase insert 5 Hotfix', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '05.1');

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Phase 05.1: Hotfix (INSERTED)'), 'roadmap should include inserted phase');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase remove command
// ─────────────────────────────────────────────────────────────────────────────


describe('phase remove command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('removes phase directory and renumbers subsequent', () => {
    // Setup 3 phases
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup
**Depends on:** Nothing

### Phase 2: Auth
**Goal:** Authentication
**Depends on:** Phase 1

### Phase 3: Features
**Goal:** Core features
**Depends on:** Phase 2
`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    const p2 = path.join(tmpDir, '.planning', 'phases', '02-auth');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');
    const p3 = path.join(tmpDir, '.planning', 'phases', '03-features');
    fs.mkdirSync(p3, { recursive: true });
    fs.writeFileSync(path.join(p3, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p3, '03-02-PLAN.md'), '# Plan 2');

    // Remove phase 2
    const result = runGsdTools('phase remove 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.removed, '2');
    assert.strictEqual(output.directory_deleted, '02-auth');

    // Phase 3 should be renumbered to 02
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features')),
      'phase 3 should be renumbered to 02-features'
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-features')),
      'old 03-features should not exist'
    );

    // Files inside should be renamed
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features', '02-01-PLAN.md')),
      'plan file should be renumbered to 02-01'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features', '02-02-PLAN.md')),
      'plan 2 should be renumbered to 02-02'
    );

    // ROADMAP should be updated
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(!roadmap.includes('Phase 2: Auth'), 'removed phase should not be in roadmap');
    assert.ok(roadmap.includes('Phase 2: Features'), 'phase 3 should be renumbered to 2');
  });

  test('rejects removal of phase with summaries unless --force', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Test\n**Goal:** Test\n`
    );

    // Should fail without --force
    const result = runGsdTools('phase remove 1', tmpDir);
    assert.ok(!result.success, 'should fail without --force');
    assert.ok(result.error.includes('executed plan'), 'error mentions executed plans');

    // Should succeed with --force
    const forceResult = runGsdTools('phase remove 1 --force', tmpDir);
    assert.ok(forceResult.success, `Force remove failed: ${forceResult.error}`);
  });

  test('bug-3409: supports --force before phase id', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n**Goal:** A\n### Phase 2: B\n**Goal:** B\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 1\n**Total Phases:** 2\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-b'), { recursive: true });

    const result = runGsdTools('phase remove --force 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.removed, '2');
    assert.strictEqual(output.directory_deleted, '02-b');
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-b')));

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('**Total Phases:** 1'), 'total phases should be decremented after real removal');
  });

  test('removes decimal phase and renumbers siblings', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 6: Main\n**Goal:** Main\n### Phase 6.1: Fix A\n**Goal:** Fix A\n### Phase 6.2: Fix B\n**Goal:** Fix B\n### Phase 6.3: Fix C\n**Goal:** Fix C\n`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-main'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-fix-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.2-fix-b'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.3-fix-c'), { recursive: true });

    const result = runGsdTools('phase remove 6.2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // 06.3 should become 06.2
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '06.2-fix-c')),
      '06.3 should be renumbered to 06.2'
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'phases', '06.3-fix-c')),
      'old 06.3 should not exist'
    );
  });

  test('updates STATE.md phase count', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n**Goal:** A\n### Phase 2: B\n**Goal:** B\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 1\n**Total Phases:** 2\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-b'), { recursive: true });

    runGsdTools('phase remove 2', tmpDir);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('**Total Phases:** 1'), 'total phases should be decremented');
  });

  test('bug-2434: integer phase remove does not rename 999.x backlog directory', () => {
    // Setup: an active integer phase 4 and a backlog phase 999.1
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: Auth
**Goal:** Authentication

### Phase 3: Features
**Goal:** Core features

### Phase 4: Extras
**Goal:** Extra stuff

### Phase 999.1: Backlog item
**Goal:** Parked backlog task
`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-auth'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-features'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '04-extras'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '999.1-backlog-item'), { recursive: true });

    const result = runGsdTools('phase remove 4', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Backlog directory must remain at 999.1, not be decremented to 998.1
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '999.1-backlog-item')),
      'backlog directory 999.1-backlog-item must not be renamed'
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'phases', '998.1-backlog-item')),
      'backlog directory must not be incorrectly renamed to 998.1'
    );
  });

  test('bug-2435: integer phase remove does not corrupt YYYY-MM-DD dates in ROADMAP.md', () => {
    // Setup: removing phase 4 from a roadmap containing 2026-04-14 date strings
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup
**Completed:** 2026-01-15

### Phase 2: Auth
**Goal:** Authentication
**Completed:** 2026-02-20

### Phase 3: Features
**Goal:** Core features
**Completed:** 2026-04-14

### Phase 4: Extras
**Goal:** Extra stuff

### Phase 5: Final
**Goal:** Final phase
`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-auth'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-features'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '04-extras'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '05-final'), { recursive: true });

    const result = runGsdTools('phase remove 4', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');

    // Dates must be preserved exactly
    assert.ok(roadmap.includes('2026-01-15'), 'date 2026-01-15 must not be corrupted');
    assert.ok(roadmap.includes('2026-02-20'), 'date 2026-02-20 must not be corrupted');
    assert.ok(roadmap.includes('2026-04-14'), 'date 2026-04-14 must not be corrupted');

    // Phase 5 should be renumbered to 4
    assert.ok(roadmap.includes('Phase 4: Final'), 'Phase 5 should be renumbered to Phase 4');
  });

  test('bug-2435: integer phase remove does not corrupt date whose month matches removed phase number', () => {
    // Setup: removing phase 4 from a roadmap containing 2026-05-14
    // When renumbering phase 5→4, the regex must not replace "05-14" in the date "2026-05-14"
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup
**Completed:** 2026-01-15

### Phase 2: Auth
**Goal:** Authentication
**Completed:** 2026-02-20

### Phase 3: Features
**Goal:** Core features
**Completed:** 2026-03-10

### Phase 4: Extras
**Goal:** Extra stuff

### Phase 5: Final
**Goal:** Final phase
**Due:** 2026-05-14
`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-auth'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-features'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '04-extras'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '05-final'), { recursive: true });

    const result = runGsdTools('phase remove 4', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');

    // Date "2026-05-14" must not be corrupted to "2026-04-14" when phase 5 is renumbered to 4
    assert.ok(roadmap.includes('2026-05-14'), 'date 2026-05-14 must not be corrupted when renumbering phase 5→4');
    assert.ok(!roadmap.includes('2026-04-14'), 'date must not be incorrectly mutated to 2026-04-14');

    // Phase 5 should be renumbered to 4
    assert.ok(roadmap.includes('Phase 4: Final'), 'Phase 5 should be renumbered to Phase 4');
  });

  test('bug-3355: integer phase remove renumbers roadmap once without collapsing later phases', () => {
    const lines = ['# Roadmap', '', '## Progress', '', '| Phase | Plans | Status | Notes |', '|---|---:|---|---|'];
    for (let n = 26; n <= 35; n++) {
      lines.push(`| ${n}. Phase ${n} | 0/1 | Planned | - |`);
    }
    lines.push('');
	    for (let n = 26; n <= 35; n++) {
	      lines.push(`### Phase ${n}: Phase ${n}`);
	      lines.push(`#### Phase ${n}.1: Phase ${n}.1 follow-up`);
	      lines.push(`**Goal:** Build phase ${n}`);
	      lines.push(n % 2 === 0 ? `**Depends on**: Phase ${n - 1}` : `**Depends on:** Phase ${n - 1}`);
	      lines.push(`Plans: ${String(n).padStart(2, '0')}-01-PLAN.md`);
	      lines.push('');

      const phaseDir = path.join(tmpDir, '.planning', 'phases', `${String(n).padStart(2, '0')}-phase-${n}`);
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, `${String(n).padStart(2, '0')}-01-PLAN.md`), '# Plan');
    }
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), lines.join('\n'));

    const result = runGsdTools('phase remove 27 --force', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.equal((roadmap.match(/\|\s*27\.\s/g) || []).length, 1, 'progress row 27 appears once');
    assert.equal((roadmap.match(/\|\s*28\.\s/g) || []).length, 1, 'progress row 28 appears once');
    assert.equal((roadmap.match(/\|\s*34\.\s/g) || []).length, 1, 'progress row 34 appears once');
    assert.equal((roadmap.match(/\|\s*35\.\s/g) || []).length, 0, 'old progress row 35 removed by renumber');
	    assert.equal((roadmap.match(/^### Phase 27:/gm) || []).length, 1, 'heading 27 appears once');
	    assert.equal((roadmap.match(/^### Phase 34:/gm) || []).length, 1, 'heading 34 appears once');
	    assert.equal((roadmap.match(/^### Phase 35:/gm) || []).length, 0, 'old heading 35 removed by renumber');
	    assert.equal((roadmap.match(/^#### Phase 27\.1:/gm) || []).length, 1, 'decimal heading 27.1 appears once');
	    assert.equal((roadmap.match(/^#### Phase 34\.1:/gm) || []).length, 1, 'decimal heading 34.1 appears once');
	    assert.equal((roadmap.match(/^#### Phase 35\.1:/gm) || []).length, 0, 'old decimal heading 35.1 removed by renumber');
	    assert.equal((roadmap.match(/\*\*Depends on\*\*:\s*Phase\s+28\b/g) || []).length, 1, 'bold depends-on with outside colon is decremented');
	    assert.equal((roadmap.match(/\*\*Depends on:\*\*\s*Phase\s+29\b/g) || []).length, 1, 'legacy bold depends-on with inside colon is decremented');
	    assert.equal((roadmap.match(/\*\*Depends on:\*\*\s*Phase\s+35\b/g) || []).length, 0, 'old depends-on 35 removed by renumber');
	    assert.equal((roadmap.match(/\b27-01-PLAN\.md\b/g) || []).length, 1, 'plan id 27-01 appears once');
	    assert.equal((roadmap.match(/\b34-01-PLAN\.md\b/g) || []).length, 1, 'plan id 34-01 appears once');
	    assert.equal((roadmap.match(/\b35-01-PLAN\.md\b/g) || []).length, 0, 'old plan id 35-01 removed by renumber');

	    for (let n = 27; n <= 34; n++) {
      assert.ok(
        fs.existsSync(path.join(tmpDir, '.planning', 'phases', `${String(n).padStart(2, '0')}-phase-${n + 1}`)),
        `phase directory ${n} should preserve original phase slug ${n + 1}`,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase complete command
// ─────────────────────────────────────────────────────────────────────────────


describe('phase complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('marks phase complete and transitions to next', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation
- [ ] Phase 2: API

### Phase 1: Foundation
**Goal:** Setup
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Foundation\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working on phase 1\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_phase, '1');
    assert.strictEqual(output.plans_executed, '1/1');
    assert.strictEqual(output.next_phase, '02');
    assert.strictEqual(output.is_last_phase, false);

    // Verify STATE.md updated
    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('**Current Phase:** 02'), 'should advance to phase 02');
    assert.ok(state.includes('**Status:** Ready to plan'), 'status should be ready to plan');
    assert.ok(state.includes('**Current Plan:** Not started'), 'plan should be reset');

    // Verify ROADMAP checkbox
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('[x]'), 'phase should be checked off');
    assert.ok(roadmap.includes('completed'), 'completion date should be added');
  });

  test('detects last phase in milestone', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Only Phase\n**Goal:** Everything\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-only-phase');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.is_last_phase, true, 'should detect last phase');
    assert.strictEqual(output.next_phase, null, 'no next phase');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('Milestone complete'), 'status should be milestone complete');
  });

  test('updates REQUIREMENTS.md traceability when phase completes', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Auth

### Phase 1: Auth
**Goal:** User authentication
**Requirements:** AUTH-01, AUTH-02
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API
**Requirements:** API-01
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up with email
- [ ] **AUTH-02**: User can log in
- [ ] **AUTH-03**: User can reset password

### API

- [ ] **API-01**: REST endpoints

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 2 | Pending |
| API-01 | Phase 2 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-auth');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');

    // Checkboxes updated for phase 1 requirements
    assert.ok(req.includes('- [x] **AUTH-01**'), 'AUTH-01 checkbox should be checked');
    assert.ok(req.includes('- [x] **AUTH-02**'), 'AUTH-02 checkbox should be checked');
    // Other requirements unchanged
    assert.ok(req.includes('- [ ] **AUTH-03**'), 'AUTH-03 should remain unchecked');
    assert.ok(req.includes('- [ ] **API-01**'), 'API-01 should remain unchecked');

    // Traceability table updated
    assert.ok(req.includes('| AUTH-01 | Phase 1 | Complete |'), 'AUTH-01 status should be Complete');
    assert.ok(req.includes('| AUTH-02 | Phase 1 | Complete |'), 'AUTH-02 status should be Complete');
    assert.ok(req.includes('| AUTH-03 | Phase 2 | Pending |'), 'AUTH-03 should remain Pending');
    assert.ok(req.includes('| API-01 | Phase 2 | Pending |'), 'API-01 should remain Pending');
  });

  test('handles requirements with bracket format [REQ-01, REQ-02]', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Auth

### Phase 1: Auth
**Goal:** User authentication
**Requirements:** [AUTH-01, AUTH-02]
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API
**Requirements:** [API-01]
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up with email
- [ ] **AUTH-02**: User can log in
- [ ] **AUTH-03**: User can reset password

### API

- [ ] **API-01**: REST endpoints

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 2 | Pending |
| API-01 | Phase 2 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-auth');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');

    // Checkboxes updated for phase 1 requirements (brackets stripped)
    assert.ok(req.includes('- [x] **AUTH-01**'), 'AUTH-01 checkbox should be checked');
    assert.ok(req.includes('- [x] **AUTH-02**'), 'AUTH-02 checkbox should be checked');
    // Other requirements unchanged
    assert.ok(req.includes('- [ ] **AUTH-03**'), 'AUTH-03 should remain unchecked');
    assert.ok(req.includes('- [ ] **API-01**'), 'API-01 should remain unchecked');

    // Traceability table updated
    assert.ok(req.includes('| AUTH-01 | Phase 1 | Complete |'), 'AUTH-01 status should be Complete');
    assert.ok(req.includes('| AUTH-02 | Phase 1 | Complete |'), 'AUTH-02 status should be Complete');
    assert.ok(req.includes('| AUTH-03 | Phase 2 | Pending |'), 'AUTH-03 should remain Pending');
    assert.ok(req.includes('| API-01 | Phase 2 | Pending |'), 'API-01 should remain Pending');
  });

  test('handles phase with no requirements mapping', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Setup

### Phase 1: Setup
**Goal:** Project setup (no requirements)
**Plans:** 1 plans
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

- [ ] **REQ-01**: Some requirement

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 | Phase 2 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // REQUIREMENTS.md should be unchanged
    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    assert.ok(req.includes('- [ ] **REQ-01**'), 'REQ-01 should remain unchecked');
    assert.ok(req.includes('| REQ-01 | Phase 2 | Pending |'), 'REQ-01 should remain Pending');
  });

  test('handles missing REQUIREMENTS.md gracefully', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation
**Requirements:** REQ-01

### Phase 1: Foundation
**Goal:** Setup
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command should succeed even without REQUIREMENTS.md: ${result.error}`);
  });

  test('returns requirements_updated field in result', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Auth

### Phase 1: Auth
**Goal:** User authentication
**Requirements:** AUTH-01
**Plans:** 1 plans
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

- [ ] **AUTH-01**: User can sign up

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-auth');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.requirements_updated, true, 'requirements_updated should be true');
  });

  test('handles In Progress status in traceability table', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Auth

### Phase 1: Auth
**Goal:** User authentication
**Requirements:** AUTH-01, AUTH-02
**Plans:** 1 plans
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

- [ ] **AUTH-01**: User can sign up
- [ ] **AUTH-02**: User can log in

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | In Progress |
| AUTH-02 | Phase 1 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-auth');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    assert.ok(req.includes('| AUTH-01 | Phase 1 | Complete |'), 'In Progress should become Complete');
    assert.ok(req.includes('| AUTH-02 | Phase 1 | Complete |'), 'Pending should become Complete');
  });

  test('scoped regex does not cross phase boundaries', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Setup
- [ ] Phase 2: Auth

### Phase 1: Setup
**Goal:** Project setup
**Plans:** 1 plans

### Phase 2: Auth
**Goal:** User authentication
**Requirements:** AUTH-01
**Plans:** 0 plans
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

- [ ] **AUTH-01**: User can sign up

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Setup\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-auth'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Phase 1 has no Requirements field, so Phase 2's AUTH-01 should NOT be updated
    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    assert.ok(req.includes('- [ ] **AUTH-01**'), 'AUTH-01 should remain unchecked (belongs to Phase 2)');
    assert.ok(req.includes('| AUTH-01 | Phase 2 | Pending |'), 'AUTH-01 should remain Pending (belongs to Phase 2)');
  });

  test('handles multi-level decimal phase without regex crash', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [x] Phase 3: Lorem
- [x] Phase 3.2: Ipsum
- [ ] Phase 3.2.1: Dolor Sit
- [ ] Phase 4: Amet

### Phase 3: Lorem
**Goal:** Setup
**Plans:** 1/1 plans complete
**Requirements:** LOR-01

### Phase 3.2: Ipsum
**Goal:** Build
**Plans:** 1/1 plans complete
**Requirements:** IPS-01

### Phase 03.2.1: Dolor Sit Polish (INSERTED)
**Goal:** Polish
**Plans:** 1/1 plans complete

### Phase 4: Amet
**Goal:** Deliver
**Requirements:** AMT-01: Filter items by category with AND logic (items matching ALL selected categories)
`
    );

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

- [ ] **LOR-01**: Lorem database schema
- [ ] **IPS-01**: Ipsum rendering engine
- [ ] **AMT-01**: Filter items by category
`
    );

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State

**Current Phase:** 03.2.1
**Current Phase Name:** Dolor Sit Polish
**Status:** Execution complete
**Current Plan:** 03.2.1-01
**Last Activity:** 2025-01-01
**Last Activity Description:** Working
`
    );

    const p32 = path.join(tmpDir, '.planning', 'phases', '03.2-ipsum');
    const p321 = path.join(tmpDir, '.planning', 'phases', '03.2.1-dolor-sit');
    const p4 = path.join(tmpDir, '.planning', 'phases', '04-amet');
    fs.mkdirSync(p32, { recursive: true });
    fs.mkdirSync(p321, { recursive: true });
    fs.mkdirSync(p4, { recursive: true });
    fs.writeFileSync(path.join(p321, '03.2.1-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p321, '03.2.1-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 03.2.1', tmpDir);
    assert.ok(result.success, `Command should not crash on regex metacharacters: ${result.error}`);

    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    assert.ok(req.includes('- [ ] **AMT-01**'), 'AMT-01 should remain unchanged');
  });

  test('preserves Milestone column in 5-column progress table', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Setup
**Plans:** 1 plans

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 0/1 | Planned |  |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    const rowMatch = roadmap.match(/^\|[^\n]*1\. Foundation[^\n]*$/m);
    assert.ok(rowMatch, 'table row should exist');
    const cells = rowMatch[0].split('|').slice(1, -1).map(c => c.trim());
    assert.strictEqual(cells.length, 5, 'should have 5 columns');
    assert.strictEqual(cells[1], 'v1.0', 'Milestone column should be preserved');
    assert.ok(cells[3].includes('Complete'), 'Status column should be Complete');
  });

  test('updates STATE.md with plain format fields (no bold)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Only\n**Goal:** Test\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\nPhase: 1 of 1 (Only)\nStatus: In progress\nPlan: 01-01\nLast Activity: 2025-01-01\nLast Activity Description: Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-only');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('Milestone complete'), 'plain Status field should be updated');
    assert.ok(state.includes('Not started'), 'plain Plan field should be updated');
    // Verify compound format preserved
    assert.ok(state.match(/Phase:.*of\s+1/), 'should preserve "of N" in compound Phase format');
  });

  test('updates Plans Complete column in 4-column progress table', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation
- [ ] Phase 2: API

### Phase 1: Foundation
**Goal:** Setup
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/1 | Not started | - |
| 2. API | 0/1 | Not started | - |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    const rowMatch = roadmap.match(/^\|[^\n]*1\. Foundation[^\n]*$/m);
    assert.ok(rowMatch, 'table row should exist');
    const cells = rowMatch[0].split('|').slice(1, -1).map(c => c.trim());
    assert.strictEqual(cells.length, 4, 'should have 4 columns');
    assert.strictEqual(cells[1], '1/1', 'Plans Complete column should be updated to 1/1');
    assert.ok(cells[2].includes('Complete'), 'Status column should be Complete');
  });

  test('updates Plans Complete column in 5-column progress table', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Setup
**Plans:** 1 plans

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 0/1 | Planned |  |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    const rowMatch = roadmap.match(/^\|[^\n]*1\. Foundation[^\n]*$/m);
    assert.ok(rowMatch, 'table row should exist');
    const cells = rowMatch[0].split('|').slice(1, -1).map(c => c.trim());
    assert.strictEqual(cells.length, 5, 'should have 5 columns');
    assert.strictEqual(cells[2], '1/1', 'Plans Complete column should be updated to 1/1');
    assert.ok(cells[3].includes('Complete'), 'Status column should be Complete');
  });

  test('marks plan-level checkboxes on phase complete', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Setup
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md \u2014 Schema migration
- [ ] 01-02-PLAN.md \u2014 Auth setup
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-02\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(p1, '01-02-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-02-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('[x] 01-01-PLAN.md'), 'plan 01-01 checkbox should be checked');
    assert.ok(roadmap.includes('[x] 01-02-PLAN.md'), 'plan 01-02 checkbox should be checked');
    assert.ok(!roadmap.includes('[ ] 01-01-PLAN.md'), 'plan 01-01 should not remain unchecked');
    assert.ok(!roadmap.includes('[ ] 01-02-PLAN.md'), 'plan 01-02 should not remain unchecked');
  });

  test('marks bold-wrapped plan-level checkboxes on phase complete', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation

### Phase 1: Foundation
**Goal:** Setup
**Plans:** 2 plans

Plans:
- [ ] **01-01**: Schema migration
- [ ] **01-02**: Auth setup
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-02\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(p1, '01-02-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-02-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('[x] **01-01**'), 'bold plan 01-01 checkbox should be checked');
    assert.ok(roadmap.includes('[x] **01-02**'), 'bold plan 01-02 checkbox should be checked');
    assert.ok(!roadmap.includes('[ ] **01-01**'), 'bold plan 01-01 should not remain unchecked');
    assert.ok(!roadmap.includes('[ ] **01-02**'), 'bold plan 01-02 should not remain unchecked');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// comparePhaseNum and normalizePhaseName (imported directly)
// ─────────────────────────────────────────────────────────────────────────────

const { comparePhaseNum, normalizePhaseName } = require('../get-shit-done/bin/lib/core.cjs');

describe('comparePhaseNum', () => {
  test('sorts integer phases numerically', () => {
    assert.ok(comparePhaseNum('2', '10') < 0);
    assert.ok(comparePhaseNum('10', '2') > 0);
    assert.strictEqual(comparePhaseNum('5', '5'), 0);
  });

  test('sorts decimal phases correctly', () => {
    assert.ok(comparePhaseNum('12', '12.1') < 0);
    assert.ok(comparePhaseNum('12.1', '12.2') < 0);
    assert.ok(comparePhaseNum('12.2', '13') < 0);
  });

  test('sorts letter-suffix phases correctly', () => {
    assert.ok(comparePhaseNum('12', '12A') < 0);
    assert.ok(comparePhaseNum('12A', '12B') < 0);
    assert.ok(comparePhaseNum('12B', '13') < 0);
  });

  test('sorts hybrid phases correctly', () => {
    assert.ok(comparePhaseNum('12A', '12A.1') < 0);
    assert.ok(comparePhaseNum('12A.1', '12A.2') < 0);
    assert.ok(comparePhaseNum('12A.2', '12B') < 0);
  });

  test('handles full sort order', () => {
    const phases = ['13', '12B', '12A.2', '12', '12.1', '12A', '12A.1', '12.2'];
    phases.sort(comparePhaseNum);
    assert.deepStrictEqual(phases, ['12', '12.1', '12.2', '12A', '12A.1', '12A.2', '12B', '13']);
  });

  test('handles directory names with slugs', () => {
    const dirs = ['13-deploy', '12B-hotfix', '12A.1-bugfix', '12-foundation', '12.1-inserted', '12A-split'];
    dirs.sort(comparePhaseNum);
    assert.deepStrictEqual(dirs, [
      '12-foundation', '12.1-inserted', '12A-split', '12A.1-bugfix', '12B-hotfix', '13-deploy'
    ]);
  });

  test('case insensitive letter matching', () => {
    assert.ok(comparePhaseNum('12a', '12B') < 0);
    assert.ok(comparePhaseNum('12A', '12b') < 0);
    assert.strictEqual(comparePhaseNum('12a', '12A'), 0);
  });

  test('sorts multi-level decimal phases correctly', () => {
    assert.ok(comparePhaseNum('3.2', '3.2.1') < 0);
    assert.ok(comparePhaseNum('3.2.1', '3.2.2') < 0);
    assert.ok(comparePhaseNum('3.2.1', '3.3') < 0);
    assert.ok(comparePhaseNum('3.2.1', '4') < 0);
    assert.strictEqual(comparePhaseNum('3.2.1', '3.2.1'), 0);
  });

  test('falls back to localeCompare for non-phase strings', () => {
    const result = comparePhaseNum('abc', 'def');
    assert.strictEqual(typeof result, 'number');
  });
});

describe('normalizePhaseName', () => {
  test('pads single-digit integers', () => {
    assert.strictEqual(normalizePhaseName('3'), '03');
    assert.strictEqual(normalizePhaseName('12'), '12');
  });

  test('handles decimal phases', () => {
    assert.strictEqual(normalizePhaseName('3.1'), '03.1');
    assert.strictEqual(normalizePhaseName('12.2'), '12.2');
  });

  test('handles letter-suffix phases', () => {
    assert.strictEqual(normalizePhaseName('3A'), '03A');
    assert.strictEqual(normalizePhaseName('12B'), '12B');
  });

  test('handles hybrid phases', () => {
    assert.strictEqual(normalizePhaseName('3A.1'), '03A.1');
    assert.strictEqual(normalizePhaseName('12A.2'), '12A.2');
  });

  test('preserves letter case', () => {
    assert.strictEqual(normalizePhaseName('3a'), '03a');
    assert.strictEqual(normalizePhaseName('12b.1'), '12b.1');
  });

  test('handles multi-level decimal phases', () => {
    assert.strictEqual(normalizePhaseName('3.2.1'), '03.2.1');
    assert.strictEqual(normalizePhaseName('12.3.4'), '12.3.4');
  });

  test('returns non-matching input unchanged', () => {
    assert.strictEqual(normalizePhaseName('abc'), 'abc');
  });
});

describe('letter-suffix phase sorting', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('lists letter-suffix phases in correct order', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '12-foundation'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '12.1-inserted'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '12A-split'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '12A.1-bugfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '12B-hotfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '13-deploy'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.directories,
      ['12-foundation', '12.1-inserted', '12A-split', '12A.1-bugfix', '12B-hotfix', '13-deploy'],
      'letter-suffix phases should sort correctly'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone-scoped next-phase in phase complete
// ─────────────────────────────────────────────────────────────────────────────

describe('phase complete milestone-scoped next-phase', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('finds next phase within milestone, ignoring prior milestone dirs', () => {
    // ROADMAP lists phases 5-6 (current milestone v2.0)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '## Roadmap v2.0: Release',
        '',
        '- [ ] Phase 5: Auth',
        '- [ ] Phase 6: Dashboard',
        '',
        '### Phase 5: Auth',
        '**Goal:** Add authentication',
        '**Plans:** 1 plans',
        '',
        '### Phase 6: Dashboard',
        '**Goal:** Build dashboard',
      ].join('\n')
    );

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Current Phase:** 05\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 05-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n'
    );

    // Disk has dirs 01-06 (01-04 completed from prior milestone)
    for (let i = 1; i <= 4; i++) {
      const padded = String(i).padStart(2, '0');
      const phaseDir = path.join(tmpDir, '.planning', 'phases', `${padded}-old-phase`);
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-PLAN.md`), '# Plan');
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-SUMMARY.md`), '# Summary');
    }

    // Phase 5 — completing this one
    const p5 = path.join(tmpDir, '.planning', 'phases', '05-auth');
    fs.mkdirSync(p5, { recursive: true });
    fs.writeFileSync(path.join(p5, '05-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p5, '05-01-SUMMARY.md'), '# Summary');

    // Phase 6 — next phase in milestone
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-dashboard'), { recursive: true });

    const result = runGsdTools('phase complete 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.is_last_phase, false, 'should NOT be last phase — phase 6 is in milestone');
    assert.strictEqual(output.next_phase, '06', 'next phase should be 06');
  });

  test('detects last phase when only milestone phases are considered', () => {
    // ROADMAP lists only phase 5 (current milestone)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '## Roadmap v2.0: Release',
        '',
        '### Phase 5: Auth',
        '**Goal:** Add authentication',
        '**Plans:** 1 plans',
      ].join('\n')
    );

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Current Phase:** 05\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 05-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n'
    );

    // Disk has dirs 01-06 but only 5 is in ROADMAP
    for (let i = 1; i <= 6; i++) {
      const padded = String(i).padStart(2, '0');
      const phaseDir = path.join(tmpDir, '.planning', 'phases', `${padded}-phase-${i}`);
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-PLAN.md`), '# Plan');
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-SUMMARY.md`), '# Summary');
    }

    const result = runGsdTools('phase complete 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Without the fix, dirs 06 on disk would make is_last_phase=false
    // With the fix, only phase 5 is in milestone, so it IS the last phase
    assert.strictEqual(output.is_last_phase, true, 'should be last phase — only phase 5 is in milestone');
    assert.strictEqual(output.next_phase, null, 'no next phase in milestone');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// exact token matching (no prefix collisions)
// ─────────────────────────────────────────────────────────────────────────────

describe('phase resolution uses exact token matching', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('1009 must NOT match 1009A-feature-consistency when 1009 dir is absent', () => {
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    fs.mkdirSync(path.join(phasesDir, '1009A-feature-consistency'));
    fs.writeFileSync(path.join(phasesDir, '1009A-feature-consistency', 'PLAN.md'), '# Plan');

    const result = runGsdTools('find-phase 1009', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'should NOT find phase 1009 when only 1009A exists');
  });

  test('1009 matches 1009-pipeline-accuracy-fix when both exist', () => {
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    fs.mkdirSync(path.join(phasesDir, '1009-pipeline-accuracy-fix'));
    fs.mkdirSync(path.join(phasesDir, '1009A-feature-consistency'));
    fs.writeFileSync(path.join(phasesDir, '1009-pipeline-accuracy-fix', 'PLAN.md'), '# Plan');

    const result = runGsdTools('find-phase 1009', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'should find phase 1009');
    assert.ok(
      output.directory.includes('1009-pipeline-accuracy-fix'),
      `should match 1009-pipeline-accuracy-fix, got: ${output.directory}`
    );
  });

  test('999.6 must NOT match 999.60-episode-processing when 999.6 dir is absent', () => {
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    fs.mkdirSync(path.join(phasesDir, '999.60-episode-processing'));
    fs.writeFileSync(path.join(phasesDir, '999.60-episode-processing', 'PLAN.md'), '# Plan');

    const result = runGsdTools('find-phase 999.6', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'should NOT find phase 999.6 when only 999.60 exists');
  });

  test('999.6 matches 999.6-ground-truth-dataset when both exist', () => {
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    fs.mkdirSync(path.join(phasesDir, '999.6-ground-truth-dataset'));
    fs.mkdirSync(path.join(phasesDir, '999.60-episode-processing'));
    fs.writeFileSync(path.join(phasesDir, '999.6-ground-truth-dataset', 'PLAN.md'), '# Plan');

    const result = runGsdTools('find-phase 999.6', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'should find phase 999.6');
    assert.ok(
      output.directory.includes('999.6-ground-truth-dataset'),
      `should match 999.6-ground-truth-dataset, got: ${output.directory}`
    );
  });

  test('normal non-colliding phases still resolve', () => {
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    fs.mkdirSync(path.join(phasesDir, '01-foundation'));
    fs.mkdirSync(path.join(phasesDir, '02-implementation'));
    fs.writeFileSync(path.join(phasesDir, '01-foundation', 'PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phasesDir, '02-implementation', 'PLAN.md'), '# Plan');

    const r1 = runGsdTools('find-phase 1', tmpDir);
    assert.ok(r1.success, `Command failed for phase 1: ${r1.error}`);
    const o1 = JSON.parse(r1.output);
    assert.strictEqual(o1.found, true, 'should find phase 1');
    assert.ok(o1.directory.includes('01-foundation'), `should match 01-foundation, got: ${o1.directory}`);

    const r2 = runGsdTools('find-phase 2', tmpDir);
    assert.ok(r2.success, `Command failed for phase 2: ${r2.error}`);
    const o2 = JSON.parse(r2.output);
    assert.strictEqual(o2.found, true, 'should find phase 2');
    assert.ok(o2.directory.includes('02-implementation'), `should match 02-implementation, got: ${o2.directory}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase complete — Performance Metrics gate (Step 2 — Gate 4)
// ─────────────────────────────────────────────────────────────────────────────

describe('phase complete updates Performance Metrics', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('after cmdPhaseComplete: Performance Metrics has updated total plans count', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 2\n**Status:** Executing Phase 2\n**Total Plans in Phase:** 3\n**Current Plan:** 3\n**Completed Phases:** 0\n**Total Phases:** 3\n**Progress:** 0%\n\n## Performance Metrics\n\n**Velocity:**\n- Total plans completed: 0\n- Average duration: N/A\n- Total execution time: 0 hours\n\n**By Phase:**\n\n| Phase | Plans | Total | Avg/Plan |\n|-------|-------|-------|----------|\n\n## Accumulated Context\n`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '02-core');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '02-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '02-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '02-03-PLAN.md'), '# Plan 3\n');
    fs.writeFileSync(path.join(phaseDir, '02-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phaseDir, '02-02-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phaseDir, '02-03-SUMMARY.md'), '# Summary\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## Phase 2: Core\n\n- [ ] Phase 2: Core Systems\n`
    );

    const result = runGsdTools('phase complete 2', tmpDir);
    assert.ok(result.success, `phase complete failed: ${result.error}`);

    const stateAfter = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(stateAfter.match(/Total plans completed:\s*3/), 'Total plans completed should be 3');
  });

  test('after cmdPhaseComplete: By Phase table has row for completed phase', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 1\n**Status:** Executing Phase 1\n**Total Plans in Phase:** 2\n**Current Plan:** 2\n**Completed Phases:** 0\n**Total Phases:** 2\n**Progress:** 0%\n\n## Performance Metrics\n\n**Velocity:**\n- Total plans completed: 0\n- Average duration: N/A\n- Total execution time: 0 hours\n\n**By Phase:**\n\n| Phase | Plans | Total | Avg/Plan |\n|-------|-------|-------|----------|\n\n## Accumulated Context\n`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## Phase 1: Setup\n\n- [ ] Phase 1: Setup\n`
    );

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `phase complete failed: ${result.error}`);

    const stateAfter = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(stateAfter.match(/\|\s*1\s*\|\s*2\s*\|/), 'By Phase table should have row for phase 1 with 2 plans');
    // Row must appear BEFORE the next section, not after it (regression: empty table body regex)
    const rowIdx = stateAfter.indexOf('| 1 |');
    const accIdx = stateAfter.indexOf('## Accumulated Context');
    if (accIdx !== -1) {
      assert.ok(rowIdx < accIdx, 'By Phase row must appear before ## Accumulated Context section');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase complete — backlog phase (999.x) exclusion (#2129)
// ─────────────────────────────────────────────────────────────────────────────

describe('phase complete excludes 999.x backlog from next-phase (#2129)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('next phase skips 999.x backlog dirs and falls back to roadmap', () => {
    // ROADMAP defines phases 1, 2, 3 and a backlog 999.1
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '',
        '- [ ] Phase 1: Setup',
        '- [ ] Phase 2: Core',
        '- [ ] Phase 3: Polish',
        '- [ ] Phase 999.1: Backlog idea',
        '',
        '### Phase 1: Setup',
        '**Goal:** Initial setup',
        '',
        '### Phase 2: Core',
        '**Goal:** Build core',
        '',
        '### Phase 3: Polish',
        '**Goal:** Polish everything',
        '',
        '### Phase 999.1: Backlog idea',
        '**Goal:** Parked idea',
      ].join('\n')
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      [
        '# State',
        '',
        '**Current Phase:** 02',
        '**Status:** In progress',
        '**Current Plan:** 02-01',
        '**Last Activity:** 2025-01-01',
        '**Last Activity Description:** Working',
      ].join('\n')
    );

    // Phase 1 and 2 exist on disk, phase 3 does NOT exist yet, 999.1 DOES exist
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const p2 = path.join(tmpDir, '.planning', 'phases', '02-core');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p2, '02-01-SUMMARY.md'), '# Summary');

    // Backlog stub on disk — this is what triggers the bug
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '999.1-backlog-idea'), { recursive: true });

    const result = runGsdTools('phase complete 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Should find phase 3 from roadmap, NOT 999.1 from filesystem
    assert.strictEqual(output.next_phase, '3', 'next_phase should be 3, not 999.1');
    assert.strictEqual(output.is_last_phase, false, 'should not be last phase');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// regression: bug #1962 — normalizePhaseName preserves letter suffix case
// (consolidated from tests/bug-1962-phase-suffix-case.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

describe('bug #1962: normalizePhaseName preserves letter suffix case', () => {
  test('lowercase suffix preserved: 16c → 16c', () => {
    assert.equal(normalizePhaseName('16c'), '16c');
  });

  test('uppercase suffix preserved: 16C → 16C', () => {
    assert.equal(normalizePhaseName('16C'), '16C');
  });

  test('single digit padded with lowercase suffix: 1a → 01a', () => {
    assert.equal(normalizePhaseName('1a'), '01a');
  });

  test('single digit padded with uppercase suffix: 1A → 01A', () => {
    assert.equal(normalizePhaseName('1A'), '01A');
  });

  test('no suffix unchanged: 16 → 16', () => {
    assert.equal(normalizePhaseName('16'), '16');
  });

  test('decimal suffix preserved: 16.1 → 16.1', () => {
    assert.equal(normalizePhaseName('16.1'), '16.1');
  });

  test('letter + decimal preserved: 16c.2 → 16c.2', () => {
    assert.equal(normalizePhaseName('16c.2'), '16c.2');
  });

  test('project code prefix stripped, suffix case preserved: CK-01a → 01a', () => {
    assert.equal(normalizePhaseName('CK-01a'), '01a');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// regression: bug #1998 — phase complete updates overview checkbox
// (consolidated from tests/bug-1998-phase-complete-checkbox.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

describe('bug #1998: phase complete updates overview checkbox', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-1998-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // Minimal config
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ project_code: 'TEST' })
    );

    // Minimal STATE.md
    fs.writeFileSync(
      path.join(planningDir, 'STATE.md'),
      '---\ncurrent_phase: 1\nstatus: executing\n---\n# State\n'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('checkbox updated when no archived milestones exist', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-foundation');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '## Phases',
      '',
      '- [ ] **Phase 1: Foundation** - core setup',
      '- [ ] **Phase 2: Features** - add features',
      '',
      '## Progress',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Foundation | 0/1 | Pending | - |',
      '| 2. Features | 0/1 | Pending | - |',
    ].join('\n'));

    try {
      execFileSync('node', [GSD_TOOLS_BIN, 'phase', 'complete', '1'], { cwd: tmpDir, timeout: 10000 });
    } catch {
      // Command may exit non-zero if STATE.md update fails, but ROADMAP.md update happens first
    }

    const result = fs.readFileSync(roadmapPath, 'utf-8');
    assert.match(result, /- \[x\] \*\*Phase 1: Foundation\*\*/, 'overview checkbox should be checked');
    assert.match(result, /- \[ \] \*\*Phase 2: Features\*\*/, 'phase 2 checkbox should remain unchecked');
  });

  test('checkbox updated when archived milestones exist in <details>', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-setup');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap v2.0',
      '',
      '## Phases',
      '',
      '- [ ] **Phase 1: Setup** - initial setup',
      '- [ ] **Phase 2: Build** - build features',
      '',
      '## Progress',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Setup | 0/1 | Pending | - |',
      '| 2. Build | 0/1 | Pending | - |',
      '',
      '<details>',
      '<summary>v1.0 (Archived)</summary>',
      '',
      '## v1.0 Phases',
      '- [x] **Phase 1: Init** - initialization',
      '- [x] **Phase 2: Deploy** - deployment',
      '',
      '</details>',
    ].join('\n'));

    try {
      execFileSync('node', [GSD_TOOLS_BIN, 'phase', 'complete', '1'], { cwd: tmpDir, timeout: 10000 });
    } catch {
      // May exit non-zero
    }

    const result = fs.readFileSync(roadmapPath, 'utf-8');
    assert.match(result, /- \[x\] \*\*Phase 1: Setup\*\*/, 'current milestone checkbox should be checked');
    assert.match(result, /- \[ \] \*\*Phase 2: Build\*\*/, 'phase 2 checkbox should remain unchecked');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// regression: bug #2005 — phase complete inside <details> updates plan count
// (consolidated from tests/bug-2005-phase-complete-details.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

describe('bug #2005: phase complete updates plan count when milestone is inside <details>', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2005-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ project_code: 'TEST' })
    );

    fs.writeFileSync(
      path.join(planningDir, 'STATE.md'),
      '---\ncurrent_phase: 1\nstatus: executing\nmilestone: v2.0\n---\n# State\n'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('plan count is updated when current milestone is wrapped in <details>', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-setup');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '<details>',
      '<summary>v1.0 (shipped)</summary>',
      '',
      '## v1.0 Phases',
      '- [x] **Phase 0: Bootstrap** - shipped',
      '',
      '</details>',
      '',
      '<details open>',
      '<summary>v2.0 (in progress)</summary>',
      '',
      '## v2.0 Phases',
      '',
      '- [ ] **Phase 1: Setup** - initial setup',
      '- [ ] **Phase 2: Build** - build features',
      '',
      '## Progress',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Setup | 0/1 | Pending | - |',
      '| 2. Build | 0/1 | Pending | - |',
      '',
      '### Phase 1: Setup',
      '',
      '**Plans:** 0/1 plans complete',
      '',
      '### Phase 2: Build',
      '',
      '**Plans:** 0/1 plans complete',
      '',
      '</details>',
    ].join('\n'));

    try {
      execFileSync('node', [GSD_TOOLS_BIN, 'phase', 'complete', '1'], { cwd: tmpDir, timeout: 10000 });
    } catch {
      // May exit non-zero if STATE.md update fails, but ROADMAP.md update is the target
    }

    const result = fs.readFileSync(roadmapPath, 'utf-8');

    assert.match(
      result,
      /\*\*Plans:\*\*\s*1\/1 plans complete/,
      'plan count in Phase 1 section must be updated to 1/1 plans complete'
    );
    assert.match(
      result,
      /- \[x\] \*\*Phase 1: Setup\*\*/,
      'Phase 1 checkbox must be checked after completion'
    );
    assert.match(
      result,
      /- \[ \] \*\*Phase 2: Build\*\*/,
      'Phase 2 checkbox must remain unchecked'
    );
  });

  test('phase complete with all milestones in <details> does not corrupt phase 2 plan count', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-setup');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '<details open>',
      '<summary>v2.0 (in progress)</summary>',
      '',
      '## v2.0 Phases',
      '',
      '- [ ] **Phase 1: Setup** - initial setup',
      '- [ ] **Phase 2: Build** - build features',
      '',
      '### Phase 1: Setup',
      '',
      '**Plans:** 0/1 plans complete',
      '',
      '### Phase 2: Build',
      '',
      '**Plans:** 0/2 plans complete',
      '',
      '</details>',
    ].join('\n'));

    try {
      execFileSync('node', [GSD_TOOLS_BIN, 'phase', 'complete', '1'], { cwd: tmpDir, timeout: 10000 });
    } catch {}

    const result = fs.readFileSync(roadmapPath, 'utf-8');

    assert.match(
      result,
      /Phase 2: Build[\s\S]*?\*\*Plans:\*\*\s*0\/2 plans complete/,
      'Phase 2 plan count must remain 0/2 (untouched)'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// regression: bug #2526 — phase complete warns about unregistered REQ-IDs
// (consolidated from tests/bug-2526-phase-complete-req-discovery.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

describe('bug #2526: phase complete warns about unregistered REQ-IDs', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2526-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ project_code: '' })
    );

    fs.writeFileSync(
      path.join(planningDir, 'STATE.md'),
      '---\ncurrent_phase: 1\nstatus: executing\n---\n# State\n'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('emits warning for REQ-IDs in body but missing from Traceability table', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-foundation');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      '**Goal:** Build core',
      '**Requirements:** REQ-001',
      '**Plans:** 1 plans',
      '',
      'Plans:',
      '- [x] 01-1-PLAN.md',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Foundation | 0/1 | Pending | - |',
    ].join('\n'));

    const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
    fs.writeFileSync(reqPath, [
      '# Requirements',
      '',
      '## Functional Requirements',
      '',
      '- [x] **REQ-001**: Core data model',
      '- [ ] **REQ-002**: User authentication',
      '- [ ] **REQ-003**: API endpoints',
      '',
      '## Traceability',
      '',
      '| REQ-ID | Phase | Status |',
      '|--------|-------|--------|',
      '| REQ-001 | 1 | Pending |',
    ].join('\n'));

    let stdout = '';
    let stderr = '';
    try {
      const result = execFileSync('node', [GSD_TOOLS_BIN, 'phase', 'complete', '1'], {
        cwd: tmpDir,
        timeout: 10000,
        encoding: 'utf-8',
      });
      stdout = result;
    } catch (err) {
      stdout = err.stdout || '';
      stderr = err.stderr || '';
      throw err;
    }

    const combined = stdout + stderr;
    assert.match(combined, /REQ-002/, 'output should mention REQ-002 as missing from Traceability table');
    assert.match(combined, /REQ-003/, 'output should mention REQ-003 as missing from Traceability table');
  });

  test('no warning when all body REQ-IDs are present in Traceability table', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-foundation');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      '**Goal:** Build core',
      '**Requirements:** REQ-001, REQ-002',
      '**Plans:** 1 plans',
      '',
      'Plans:',
      '- [x] 01-1-PLAN.md',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Foundation | 0/1 | Pending | - |',
    ].join('\n'));

    const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
    fs.writeFileSync(reqPath, [
      '# Requirements',
      '',
      '## Functional Requirements',
      '',
      '- [x] **REQ-001**: Core data model',
      '- [x] **REQ-002**: User authentication',
      '',
      '## Traceability',
      '',
      '| REQ-ID | Phase | Status |',
      '|--------|-------|--------|',
      '| REQ-001 | 1 | Pending |',
      '| REQ-002 | 1 | Pending |',
    ].join('\n'));

    let stdout = '';
    let stderr = '';
    try {
      const result = execFileSync('node', [GSD_TOOLS_BIN, 'phase', 'complete', '1'], {
        cwd: tmpDir,
        timeout: 10000,
        encoding: 'utf-8',
      });
      stdout = result;
    } catch (err) {
      stdout = err.stdout || '';
      stderr = err.stderr || '';
      throw err;
    }

    const combined = stdout + stderr;
    assert.doesNotMatch(
      combined,
      /unregistered|missing.*traceability|not in.*traceability/i,
      'no warning should appear when all REQ-IDs are in the table'
    );
  });

  test('warning includes all missing REQ-IDs, not just the first', () => {
    const phasesDir = path.join(planningDir, 'phases', '01-foundation');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(
      path.join(phasesDir, '01-1-PLAN.md'),
      '---\nphase: 1\nplan: 1\n---\n# Plan 1\n'
    );
    fs.writeFileSync(
      path.join(phasesDir, '01-1-SUMMARY.md'),
      '---\nstatus: complete\n---\n# Summary\nDone.'
    );

    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, [
      '# Roadmap',
      '',
      '### Phase 1: Foundation',
      '',
      '**Goal:** Build core',
      '**Requirements:** REQ-001',
      '**Plans:** 1 plans',
      '',
      'Plans:',
      '- [x] 01-1-PLAN.md',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 1. Foundation | 0/1 | Pending | - |',
    ].join('\n'));

    const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
    fs.writeFileSync(reqPath, [
      '# Requirements',
      '',
      '- [x] **REQ-001**: Core data model',
      '- [ ] **REQ-002**: User auth',
      '- [ ] **REQ-003**: API',
      '- [ ] **REQ-004**: Reports',
      '',
      '## Traceability',
      '',
      '| REQ-ID | Phase | Status |',
      '|--------|-------|--------|',
      '| REQ-001 | 1 | Pending |',
    ].join('\n'));

    let stdout = '';
    let stderr = '';
    try {
      const result = execFileSync('node', [GSD_TOOLS_BIN, 'phase', 'complete', '1'], {
        cwd: tmpDir,
        timeout: 10000,
        encoding: 'utf-8',
      });
      stdout = result;
    } catch (err) {
      stdout = err.stdout || '';
      stderr = err.stderr || '';
      throw err;
    }

    const combined = stdout + stderr;
    assert.match(combined, /REQ-002/, 'should warn about REQ-002');
    assert.match(combined, /REQ-003/, 'should warn about REQ-003');
    assert.match(combined, /REQ-004/, 'should warn about REQ-004');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// regression: bug #3287 — phase-dir prefix parity across creation paths
// (consolidated from tests/bug-3287-phase-dir-prefix-parity.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

// ─── shared fixture for bug-3287 ─────────────────────────────────────────────
function makeXRProject(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ project_code: 'XR' }),
  );
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    [
      '# Roadmap v1.0',
      '',
      '### Phase 1: Foundation',
      '**Goal:** Setup project',
      '**Plans:** 0 plans',
      '',
      '---',
      '',
    ].join('\n'),
  );
}

describe('bug-3287 — phase.add emits project_code prefix (sanity)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('phase.add creates XR-02-<slug> when project_code is XR', () => {
    makeXRProject(tmpDir);

    const result = runGsdTools('phase add auth service', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `phase.add failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 2, 'phase number should be 2');

    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    const dirs = fs.readdirSync(phasesDir);
    const prefixedDirs = dirs.filter(d => d.startsWith('XR-'));
    assert.ok(
      prefixedDirs.length > 0,
      `Expected at least one XR- prefixed dir, got: ${JSON.stringify(dirs)}`,
    );
    assert.ok(
      dirs.some(d => d === 'XR-02-auth-service'),
      `Expected XR-02-auth-service, got: ${JSON.stringify(dirs)}`,
    );
  });
});

describe('bug-3287 — init phase-op exposes expected_phase_dir with project_code prefix', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('returns expected_phase_dir with XR- prefix when phase directory does not exist', () => {
    makeXRProject(tmpDir);

    const result = runGsdTools('init phase-op 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init phase-op failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true, 'phase should be found in roadmap');
    assert.strictEqual(output.phase_dir, null, 'phase_dir should be null (no dir yet)');

    assert.ok(
      typeof output.expected_phase_dir === 'string',
      `expected_phase_dir should be a string, got: ${JSON.stringify(output.expected_phase_dir)}`,
    );
    assert.ok(
      output.expected_phase_dir.includes('XR-'),
      `expected_phase_dir should contain XR- prefix, got: "${output.expected_phase_dir}"`,
    );
    assert.ok(
      output.expected_phase_dir.includes('foundation'),
      `expected_phase_dir should contain the phase slug, got: "${output.expected_phase_dir}"`,
    );
  });

  test('expected_phase_dir is null when no project_code is set', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n',
    );

    const result = runGsdTools('init phase-op 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init phase-op failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_dir, null);
    assert.ok(
      typeof output.expected_phase_dir === 'string',
      `expected_phase_dir should be a string even without project_code, got: ${JSON.stringify(output.expected_phase_dir)}`,
    );
    assert.ok(
      !output.expected_phase_dir.match(/^[A-Z][A-Z0-9]*-/),
      `expected_phase_dir should have NO prefix without project_code, got: "${output.expected_phase_dir}"`,
    );
  });
});

describe('bug-3287 — init plan-phase exposes expected_phase_dir with project_code prefix', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('returns expected_phase_dir with XR- prefix when phase directory does not exist', () => {
    makeXRProject(tmpDir);

    const result = runGsdTools('init plan-phase 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true, 'phase should be found in roadmap');
    assert.strictEqual(output.phase_dir, null, 'phase_dir should be null (no dir yet)');

    assert.ok(
      typeof output.expected_phase_dir === 'string',
      `expected_phase_dir should be a string, got: ${JSON.stringify(output.expected_phase_dir)}`,
    );
    assert.ok(
      output.expected_phase_dir.includes('XR-'),
      `expected_phase_dir should contain XR- prefix, got: "${output.expected_phase_dir}"`,
    );
    assert.ok(
      output.expected_phase_dir.includes('foundation'),
      `expected_phase_dir should contain the phase slug, got: "${output.expected_phase_dir}"`,
    );
  });

  test('expected_phase_dir omits prefix when project_code is not set', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n',
    );

    const result = runGsdTools('init plan-phase 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_dir, null);
    assert.ok(
      typeof output.expected_phase_dir === 'string',
      `expected_phase_dir should be a string, got: ${JSON.stringify(output.expected_phase_dir)}`,
    );
    assert.ok(
      !output.expected_phase_dir.match(/^[A-Z][A-Z0-9]*-/),
      `expected_phase_dir should have NO prefix without project_code, got: "${output.expected_phase_dir}"`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// regression: bug #3298 — phase-dir prefix drift in workflows
// (consolidated from tests/bug-3298-phase-dir-prefix-drift-in-workflows.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

{
  const PMG_WF = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-milestone-gaps.md');
  const IMPORT_WF = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'import.md');
  const BACKLOG_WF = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'add-backlog.md');

  function readWorkflow(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      throw new Error(`Cannot read workflow file ${filePath}: ${err.message}`);
    }
  }

  function containsBareTemplateMkdir(content) {
    return /mkdir[^`\n]*\.planning\/phases\/\{[A-Z0-9]+\}-\{/.test(content);
  }

  function containsBareShellVarMkdir(content) {
    return /mkdir[^`\n]*\.planning\/phases\/"\$\{(?:NEXT|NN|PHASE)[^}]*\}-/.test(content)
      || /mkdir[^`\n]*\.planning\/phases\/\$\{(?:NEXT|NN|PHASE)[^}]*\}-/.test(content);
  }

  describe('bug-3298 — plan-milestone-gaps.md must not construct bare {NN}-{name} phase dirs', () => {
    test('workflow file exists', () => {
      assert.ok(fs.existsSync(PMG_WF), `plan-milestone-gaps.md must exist at ${PMG_WF}`);
    });

    test('step 8 must not use bare {NN}-{name} mkdir pattern', () => {
      const content = readWorkflow(PMG_WF);
      assert.ok(
        !containsBareTemplateMkdir(content),
        'plan-milestone-gaps.md must not contain bare mkdir .planning/phases/{NN}-{name} pattern — use phase.add or expected_phase_dir',
      );
    });

    test('step 8 must use expected_phase_dir or phase.add for directory creation', () => {
      const content = readWorkflow(PMG_WF);
      const usesExpectedPhaseDir = content.includes('expected_phase_dir');
      const usesPhaseAdd = content.includes('phase.add');
      assert.ok(
        usesExpectedPhaseDir || usesPhaseAdd,
        'plan-milestone-gaps.md must use expected_phase_dir (from init.phase-op) or phase.add to create phase directories with project_code prefix',
      );
    });
  });

  describe('bug-3298 — import.md must not construct bare {NN}-{slug} phase dirs', () => {
    test('workflow file exists', () => {
      assert.ok(fs.existsSync(IMPORT_WF), `import.md must exist at ${IMPORT_WF}`);
    });

    test('plan_convert step must not use bare {NN}-{slug} mkdir pattern', () => {
      const content = readWorkflow(IMPORT_WF);
      assert.ok(
        !containsBareTemplateMkdir(content),
        'import.md must not contain bare mkdir .planning/phases/{NN}-{slug} pattern — use expected_phase_dir from init.phase-op',
      );
    });

    test('plan_convert step must use expected_phase_dir for directory creation', () => {
      const content = readWorkflow(IMPORT_WF);
      assert.ok(
        content.includes('expected_phase_dir'),
        'import.md must use expected_phase_dir (from init.phase-op) to create phase directory with project_code prefix',
      );
    });

    test('plan_convert step must call init.phase-op to resolve the prefixed dir', () => {
      const content = readWorkflow(IMPORT_WF);
      assert.ok(
        content.includes('init.phase-op') || content.includes('init phase-op'),
        'import.md must call gsd-sdk query init.phase-op to get expected_phase_dir with project_code prefix',
      );
    });
  });

  describe('bug-3298 — add-backlog.md must apply project_code prefix when creating 999.x dirs', () => {
    test('workflow file exists', () => {
      assert.ok(fs.existsSync(BACKLOG_WF), `add-backlog.md must exist at ${BACKLOG_WF}`);
    });

    test('step 4 must not use bare ${NEXT}-${SLUG} mkdir without project_code prefix', () => {
      const content = readWorkflow(BACKLOG_WF);
      assert.ok(
        !containsBareShellVarMkdir(content),
        'add-backlog.md must not create .planning/phases/${NEXT}-${SLUG} without a project_code prefix variable — apply ${PREFIX} (or equivalent) before ${NEXT}',
      );
    });

    test('step 4 must reference project_code or a prefix variable before the phase number', () => {
      const content = readWorkflow(BACKLOG_WF);
      const hasProjectCodeRef = content.includes('project_code') || content.includes('PROJECT_CODE');
      const hasPrefixVar = content.includes('${PREFIX}') || content.includes('${PHASE_PREFIX}') || content.includes('${CODE}');
      assert.ok(
        hasProjectCodeRef || hasPrefixVar,
        'add-backlog.md must read project_code (or use a PREFIX variable) to apply the project_code prefix to the 999.x phase directory name',
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// regression: bug #3517 — phase.complete leaves STATE.md with stale fields
// (consolidated from tests/bug-3517-phase-complete-state-md-staleness.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

{
  function runSdkQuery(args, cwd) {
    try {
      const result = execFileSync(process.execPath, [SDK_CLI, 'query', ...args], {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const parsed = JSON.parse(result.trim());
      return { success: true, data: parsed };
    } catch (err) {
      const stderr = err.stderr?.toString().trim() || '';
      const stdout = err.stdout?.toString().trim() || '';
      try {
        const parsed = JSON.parse(stdout);
        return { success: true, data: parsed };
      } catch { /* not JSON */ }
      return { success: false, error: stderr || err.message };
    }
  }

  function setupPhase3517Project(tmpDir) {
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.mkdirSync(phasesDir, { recursive: true });

    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ project_code: 'TEST' }),
    );

    const roadmap = [
      '# Roadmap',
      '',
      '## Current Milestone: v3.0',
      '',
      '| Phase | Plans | Status | Completed |',
      '|-------|-------|--------|-----------|',
      '| 4.    | 3/3   | Complete | 2026-04-01 |',
      '| 5.    | 7/7   | In Progress |  |',
      '| 6.    | 0/5   | Not Started |  |',
      '',
      '- [x] Phase 4: Foundation (completed 2026-04-01)',
      '- [ ] Phase 5: Core API',
      '- [ ] Phase 6: Integration',
      '',
      '### Phase 4: Foundation',
      '',
      '**Goal:** Foundation work',
      '**Plans:** 3/3 plans complete',
      '',
      '### Phase 5: Core API',
      '',
      '**Goal:** Build core API layer',
      '**Plans:** 7 plans',
      '',
      'Plans:',
      '- [ ] 05-01 plan',
      '- [ ] 05-02 plan',
      '- [ ] 05-03 plan',
      '- [ ] 05-04 plan',
      '- [ ] 05-05 plan',
      '- [ ] 05-06 plan',
      '- [ ] 05-07 plan',
      '',
      '### Phase 6: Integration',
      '',
      '**Goal:** Integration work',
      '**Plans:** 5 plans',
      '',
      '---',
      '*Last updated: 2026-05-14*',
    ].join('\n');

    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmap);

    const state = [
      '---',
      'gsd_state_version: 1.0',
      'milestone: v3.0',
      'milestone_name: Core Platform',
      'status: executing',
      'stopped_at: Completed 05-03-PLAN.md',
      'last_updated: 2026-05-10T08:00:00.000Z',
      'progress:',
      '  total_phases: 3',
      '  completed_phases: 1',
      '  total_plans: 15',
      '  completed_plans: 6',
      '  percent: 33',
      '---',
      '',
      '# Project State',
      '',
      '## Current Position',
      '',
      '**Current focus:** Phase 5 — Core API',
      'Phase: 5 of 3 (Core API) — EXECUTING',
      'Plan: 7 of 7',
      'Status: Executing Phase 5',
      'Last activity: 2026-05-10',
      '',
      '## Progress',
      '',
      'Progress: [████████████░░░░] 40% (1/3 phases complete before Phase 5 closeout)',
      '',
      '## Performance Metrics',
      '',
      '**Velocity:**',
      '',
      '- Total plans completed: 6',
      '- Average duration: 2h',
      '- Total execution time: 14 hours',
      '- Window: 2026-04-01 to 2026-05-10',
      '',
      '**By Phase:**',
      '',
      '| Phase | Plans | Total | Avg/Plan |',
      '|-------|-------|-------|----------|',
      '| 4 | 3 | - | - |',
      '',
      '## Session Continuity',
      '',
      'Last session: 2026-05-10T08:00:00.000Z',
      'Stopped at: Completed 05-07-PLAN.md',
    ].join('\n');

    fs.writeFileSync(path.join(planningDir, 'STATE.md'), state);

    const phase5Dir = path.join(phasesDir, '05-core-api');
    fs.mkdirSync(phase5Dir, { recursive: true });
    for (let i = 1; i <= 7; i++) {
      const padded = String(i).padStart(2, '0');
      fs.writeFileSync(path.join(phase5Dir, `05-${padded}-PLAN.md`), `plan ${i}`, 'utf8');
      fs.writeFileSync(path.join(phase5Dir, `05-${padded}-SUMMARY.md`), `summary ${i}`, 'utf8');
    }

    const phase4Dir = path.join(phasesDir, '04-foundation');
    fs.mkdirSync(phase4Dir, { recursive: true });
    for (let i = 1; i <= 3; i++) {
      const padded = String(i).padStart(2, '0');
      fs.writeFileSync(path.join(phase4Dir, `04-${padded}-PLAN.md`), `plan ${i}`, 'utf8');
      fs.writeFileSync(path.join(phase4Dir, `04-${padded}-SUMMARY.md`), `summary ${i}`, 'utf8');
    }

    const phase6Dir = path.join(phasesDir, '06-integration');
    fs.mkdirSync(phase6Dir, { recursive: true });

    return { planningDir, phase5Dir };
  }

  describe('bug #3517: phase.complete leaves STATE.md with stale fields', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3517-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('completed_phases is derived from ROADMAP, not blindly incremented (idempotency)', () => {
      setupPhase3517Project(tmpDir);
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');

      const r1 = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r1.success, `first call failed: ${r1.error}`);

      const stateAfter1 = fs.readFileSync(statePath, 'utf8');
      const match1 = stateAfter1.match(/completed_phases:\s*(\d+)/);
      assert.ok(match1, 'completed_phases not found in frontmatter after first call');
      assert.equal(
        Number(match1[1]),
        2,
        `After first call: completed_phases should be 2 (derived from ROADMAP: phases 4 and 5 complete), got ${match1[1]}`,
      );

      const r2 = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r2.success, `second call failed: ${r2.error}`);

      const stateAfter2 = fs.readFileSync(statePath, 'utf8');
      const match2 = stateAfter2.match(/completed_phases:\s*(\d+)/);
      assert.ok(match2, 'completed_phases not found in frontmatter after second call');
      assert.equal(
        Number(match2[1]),
        2,
        `After second call (same phase): completed_phases must remain 2 (idempotent), got ${match2[1]}`,
      );
    });

    test('frontmatter stopped_at is updated after phase.complete', () => {
      setupPhase3517Project(tmpDir);
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');

      const r = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r.success, `call failed: ${r.error}`);

      const state = fs.readFileSync(statePath, 'utf8');
      const stoppedMatch = state.match(/stopped_at:\s*(.+)/);
      assert.ok(stoppedMatch, 'stopped_at not found in frontmatter');
      assert.ok(
        !stoppedMatch[1].includes('05-03-PLAN.md'),
        `stopped_at should not still say "Completed 05-03-PLAN.md" — got: ${stoppedMatch[1]}`,
      );
      assert.ok(
        stoppedMatch[1].toLowerCase().includes('phase 5') ||
        stoppedMatch[1].toLowerCase().includes('complete'),
        `stopped_at should reference phase 5 completion, got: ${stoppedMatch[1]}`,
      );
    });

    test('frontmatter last_updated is refreshed to today after phase.complete', () => {
      setupPhase3517Project(tmpDir);
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');

      const r = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r.success, `call failed: ${r.error}`);

      const state = fs.readFileSync(statePath, 'utf8');
      const lastUpdatedMatch = state.match(/last_updated:\s*(.+)/);
      assert.ok(lastUpdatedMatch, 'last_updated not found in frontmatter');
      assert.notEqual(
        lastUpdatedMatch[1].trim(),
        '2026-05-10T08:00:00.000Z',
        `last_updated must be refreshed, but it is still the stale value: ${lastUpdatedMatch[1]}`,
      );
      const updatedAt = new Date(lastUpdatedMatch[1].trim());
      const now = new Date();
      const diffMs = Math.abs(now - updatedAt);
      assert.ok(
        diffMs < 60_000,
        `last_updated should be approximately now (within 60s), got: ${lastUpdatedMatch[1]} (diff: ${diffMs}ms)`,
      );
    });

    test('frontmatter total_plans is updated from ROADMAP plan counts after phase.complete', () => {
      setupPhase3517Project(tmpDir);
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');

      const r = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r.success, `call failed: ${r.error}`);

      const state = fs.readFileSync(statePath, 'utf8');
      const match = state.match(/total_plans:\s*(\d+)/);
      assert.ok(match, 'total_plans not found in frontmatter');
      const totalPlans = Number(match[1]);
      assert.ok(Number.isFinite(totalPlans) && totalPlans > 0, `total_plans must be a positive number, got: ${match[1]}`);
    });

    test('frontmatter completed_plans is updated from SUMMARY file count after phase.complete', () => {
      setupPhase3517Project(tmpDir);
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');

      const r = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r.success, `call failed: ${r.error}`);

      const state = fs.readFileSync(statePath, 'utf8');
      const match = state.match(/completed_plans:\s*(\d+)/);
      assert.ok(match, 'completed_plans not found in frontmatter');
      const completedPlans = Number(match[1]);
      assert.equal(
        completedPlans,
        10,
        `completed_plans should be 10 (3 phase-4 summaries + 7 phase-5 summaries), got: ${completedPlans}`,
      );
    });

    test('frontmatter percent is recomputed from fresh derived counts', () => {
      setupPhase3517Project(tmpDir);
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');

      const r = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r.success, `call failed: ${r.error}`);

      const state = fs.readFileSync(statePath, 'utf8');
      const match = state.match(/percent:\s*(\d+)/);
      assert.ok(match, 'percent not found in frontmatter');
      assert.equal(Number(match[1]), 67, `percent should be 67 (2/3 phases), got: ${match[1]}`);
    });

    test('body Current focus is updated to next phase after phase.complete', () => {
      setupPhase3517Project(tmpDir);
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');

      const r = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r.success, `call failed: ${r.error}`);

      const state = fs.readFileSync(statePath, 'utf8');
      assert.ok(
        !state.includes('Current focus:** Phase 5') && !state.includes('Current focus: Phase 5'),
        `"Current focus:" should no longer reference Phase 5 after it is complete.\nState:\n${state}`,
      );
    });

    test('body By Phase table row for completed phase shows correct plan count', () => {
      setupPhase3517Project(tmpDir);
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');

      const r = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r.success, `call failed: ${r.error}`);

      const state = fs.readFileSync(statePath, 'utf8');
      assert.match(
        state,
        /\|\s*5\s*\|\s*7\s*\|/,
        `By Phase table should have a row for phase 5 with 7 summaries.\nState:\n${state}`,
      );
    });

    test('full consistency check: all STATE.md fields are coherent after phase.complete', () => {
      setupPhase3517Project(tmpDir);
      const statePath = path.join(tmpDir, '.planning', 'STATE.md');

      const r = runSdkQuery(['phase.complete', '5'], tmpDir);
      assert.ok(r.success, `call failed: ${r.error}`);
      assert.equal(r.data?.state_updated, true, 'state_updated must be true');

      const state = fs.readFileSync(statePath, 'utf8');

      assert.match(state, /completed_phases:\s*2/, 'completed_phases must be 2 (4 and 5 complete)');
      assert.match(state, /percent:\s*67/, 'percent must be 67%');
      assert.match(state, /Status:\s*Ready to plan/, 'Status must be "Ready to plan" (next phase exists)');

      const hasPhase6 = /Phase:\s*0?6/.test(state) || /current_phase:\s*0?6/.test(state);
      assert.ok(hasPhase6, `STATE.md must reference Phase 6 as current after completing Phase 5.\nState:\n${state}`);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// regression: bug #3601 — phase remove preserves peer-depth decimal sections
// (consolidated from tests/bug-3601-phase-remove-preserves-decimal-sections.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

{
  process.env.GSD_TEST_MODE = '1';

  function writeRoadmapForRemove(tmpDir, body) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), body);
  }
  function writeStateForRemove(tmpDir, version) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `---\nmilestone: ${version}\n---\n`,
    );
  }
  function ensurePhaseDir(tmpDir, name) {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', name), { recursive: true });
  }
  function getPhase(tmpDir, phaseNum) {
    const r = runGsdTools(['roadmap', 'get-phase', phaseNum, '--json'], tmpDir);
    if (!r.success) return { found: false, error: r.error };
    return JSON.parse(r.output);
  }

  describe('bug #3601: phase remove preserves peer-depth decimal sections', () => {
    let tmpDir;
    beforeEach(() => {
      tmpDir = createTempProject('bug-3601-');
    });
    afterEach(() => {
      cleanup(tmpDir);
    });

    test('removing Phase 2 preserves peer-depth Phase 2.1 and renumbers Phase 3 → 2', () => {
      writeStateForRemove(tmpDir, 'v1.0.0');
      writeRoadmapForRemove(
        tmpDir,
        [
          '# Roadmap',
          '',
          '## Current Milestone: v1.0.0 - Test',
          '',
          '### Phase 2: Parent',
          '**Goal:** RemoveMeGoal',
          '',
          '### Phase 2.1: Follow-up',
          '**Goal:** PreserveDecimalGoal',
          '',
          '### Phase 3: Trailing',
          '**Goal:** PreserveTrailingGoal',
          '',
        ].join('\n'),
      );
      ensurePhaseDir(tmpDir, '02-parent');
      ensurePhaseDir(tmpDir, '02.1-follow-up');
      ensurePhaseDir(tmpDir, '03-trailing');

      const r = runGsdTools(['phase', 'remove', '2'], tmpDir);
      assert.ok(r.success, `phase remove failed: ${r.error || r.output}`);

      const decimal = getPhase(tmpDir, '2.1');
      assert.strictEqual(decimal.found, true, 'Phase 2.1 deleted alongside Phase 2');
      assert.strictEqual(decimal.phase_name, 'Follow-up');
      assert.strictEqual(decimal.goal, 'PreserveDecimalGoal');

      const renumbered = getPhase(tmpDir, '2');
      assert.strictEqual(renumbered.found, true);
      assert.strictEqual(renumbered.phase_name, 'Trailing');
      assert.strictEqual(
        renumbered.goal,
        'PreserveTrailingGoal',
        'Phase 3 → Phase 2 renumber did not carry the right section content',
      );

      const parentLookup = getPhase(tmpDir, '3');
      assert.notStrictEqual(
        parentLookup.goal,
        'RemoveMeGoal',
        'removed parent goal reappeared under a phase header',
      );
    });

    test('removing Phase 5 preserves Phase 5.1 and Phase 5.2 (multiple peer decimals)', () => {
      writeStateForRemove(tmpDir, 'v1.0.0');
      writeRoadmapForRemove(
        tmpDir,
        [
          '# Roadmap',
          '',
          '## Current Milestone: v1.0.0 - Test',
          '',
          '### Phase 5: Parent',
          '**Goal:** RemoveParent',
          '',
          '### Phase 5.1: First child',
          '**Goal:** ChildAGoal',
          '',
          '### Phase 5.2: Second child',
          '**Goal:** ChildBGoal',
          '',
          '### Phase 6: Tail',
          '**Goal:** TailGoal',
          '',
        ].join('\n'),
      );
      ensurePhaseDir(tmpDir, '05-parent');
      ensurePhaseDir(tmpDir, '05.1-first-child');
      ensurePhaseDir(tmpDir, '05.2-second-child');
      ensurePhaseDir(tmpDir, '06-tail');

      const r = runGsdTools(['phase', 'remove', '5'], tmpDir);
      assert.ok(r.success);

      const decimalA = getPhase(tmpDir, '5.1');
      assert.strictEqual(decimalA.found, true, 'Phase 5.1 deleted');
      assert.strictEqual(decimalA.goal, 'ChildAGoal');

      const decimalB = getPhase(tmpDir, '5.2');
      assert.strictEqual(decimalB.found, true, 'Phase 5.2 deleted');
      assert.strictEqual(decimalB.goal, 'ChildBGoal');

      const tail = getPhase(tmpDir, '5');
      assert.strictEqual(tail.found, true);
      assert.strictEqual(tail.goal, 'TailGoal', 'Phase 6 → Phase 5 renumber misfired');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // regression: bug #3602 — phase remove renumbers slugged plan references
  // (consolidated from tests/bug-3602-phase-remove-renumbers-slugged-plan-refs.test.cjs)
  // ─────────────────────────────────────────────────────────────────────────────

  function ensurePlanFile(tmpDir, phaseDirName, planName) {
    const p = path.join(tmpDir, '.planning', 'phases', phaseDirName, planName);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '# Plan\n');
  }

  describe('bug #3602: phase remove renumbers slugged plan references in ROADMAP', () => {
    let tmpDir;
    beforeEach(() => {
      tmpDir = createTempProject('bug-3602-');
    });
    afterEach(() => {
      cleanup(tmpDir);
    });

    test('slugged PLAN reference (07-01-cherry-pick-foundation-PLAN.md) is renumbered to 06-01-…', () => {
      writeStateForRemove(tmpDir, 'v1.0.0');
      writeRoadmapForRemove(
        tmpDir,
        [
          '# Roadmap',
          '',
          '## Current Milestone: v1.0.0',
          '',
          '### Phase 6: Old Work',
          '**Goal:** RemoveThisGoal',
          '',
          '### Phase 7: New Work',
          '**Goal:** Plans: 07-01-cherry-pick-foundation-PLAN.md and 07-02-finish-it-SUMMARY.md',
          '',
        ].join('\n'),
      );
      ensurePhaseDir(tmpDir, '06-old');
      ensurePhaseDir(tmpDir, '07-new');
      ensurePlanFile(tmpDir, '07-new', '07-01-cherry-pick-foundation-PLAN.md');
      ensurePlanFile(tmpDir, '07-new', '07-02-finish-it-SUMMARY.md');

      const r = runGsdTools(['phase', 'remove', '6'], tmpDir);
      assert.ok(r.success, `phase remove failed: ${r.error || r.output}`);

      const phase6 = getPhase(tmpDir, '6');
      assert.strictEqual(phase6.found, true);
      assert.strictEqual(phase6.phase_name, 'New Work');
      assert.ok(
        phase6.goal.includes('06-01-cherry-pick-foundation-PLAN.md'),
        `Plans reference for slugged PLAN was not renumbered. Goal: ${phase6.goal}`,
      );
      assert.ok(
        phase6.goal.includes('06-02-finish-it-SUMMARY.md'),
        `Plans reference for slugged SUMMARY was not renumbered. Goal: ${phase6.goal}`,
      );
      assert.ok(
        !phase6.goal.includes('07-01'),
        `stale 07-01 prefix remains in ROADMAP. Goal: ${phase6.goal}`,
      );
      assert.ok(
        !phase6.goal.includes('07-02'),
        `stale 07-02 prefix remains in ROADMAP. Goal: ${phase6.goal}`,
      );
    });

    test('compact PLAN/SUMMARY reference (07-01-PLAN.md) still renumbers (#3601 contract preserved)', () => {
      writeStateForRemove(tmpDir, 'v1.0.0');
      writeRoadmapForRemove(
        tmpDir,
        [
          '# Roadmap',
          '',
          '## Current Milestone: v1.0.0',
          '',
          '### Phase 6: Old',
          '**Goal:** RemoveGoal',
          '',
          '### Phase 7: New',
          '**Goal:** Plans: 07-01-PLAN.md and 07-02-SUMMARY.md',
          '',
        ].join('\n'),
      );
      ensurePhaseDir(tmpDir, '06-old');
      ensurePhaseDir(tmpDir, '07-new');
      ensurePlanFile(tmpDir, '07-new', '07-01-PLAN.md');
      ensurePlanFile(tmpDir, '07-new', '07-02-SUMMARY.md');

      const r = runGsdTools(['phase', 'remove', '6'], tmpDir);
      assert.ok(r.success);

      const phase6 = getPhase(tmpDir, '6');
      assert.strictEqual(phase6.found, true);
      assert.ok(phase6.goal.includes('06-01-PLAN.md'));
      assert.ok(phase6.goal.includes('06-02-SUMMARY.md'));
      assert.ok(!phase6.goal.includes('07-01-PLAN.md'));
      assert.ok(!phase6.goal.includes('07-02-SUMMARY.md'));
    });

    test('does NOT renumber values that look like phase-plan tokens but are not (e.g. 2026-01-01 dates)', () => {
      writeStateForRemove(tmpDir, 'v1.0.0');
      writeRoadmapForRemove(
        tmpDir,
        [
          '# Roadmap',
          '',
          '## Current Milestone: v1.0.0',
          '',
          '### Phase 6: Old',
          '**Goal:** RemoveGoal',
          '',
          '### Phase 7: Date safety',
          '**Goal:** Created 2026-01-01 and tagged v1-2-3 — must not renumber',
          '',
        ].join('\n'),
      );
      ensurePhaseDir(tmpDir, '06-old');
      ensurePhaseDir(tmpDir, '07-new');

      const r = runGsdTools(['phase', 'remove', '6'], tmpDir);
      assert.ok(r.success);

      const phase6 = getPhase(tmpDir, '6');
      assert.strictEqual(phase6.found, true);
      assert.ok(
        phase6.goal.includes('2026-01-01'),
        `ISO date 2026-01-01 was wrongly modified. Goal: ${phase6.goal}`,
      );
      assert.ok(
        phase6.goal.includes('v1-2-3'),
        `version-tag v1-2-3 was wrongly modified. Goal: ${phase6.goal}`,
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// feature: phase complete auto-prune (#2087)
// (consolidated from tests/phase-complete-auto-prune.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

{
  function writeConfigForAutoPrune(tmpDir, config) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(config, null, 2));
  }

  function writeStateMdForAutoPrune(tmpDir, content) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), content);
  }

  function readStateMdForAutoPrune(tmpDir) {
    return fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
  }

  function writeRoadmapForAutoPrune(tmpDir, content) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);
  }

  function setupPhaseForAutoPrune(tmpDir, phaseNum, planCount) {
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    const phaseDir = path.join(phasesDir, `${String(phaseNum).padStart(2, '0')}-test-phase`);
    fs.mkdirSync(phaseDir, { recursive: true });

    for (let i = 1; i <= planCount; i++) {
      const planId = `${String(phaseNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      fs.writeFileSync(path.join(phaseDir, `${planId}-PLAN.md`), `# Plan ${planId}\n`);
      fs.writeFileSync(path.join(phaseDir, `${planId}-SUMMARY.md`), `# Summary ${planId}\n`);
    }
  }

  describe('phase complete auto-prune (#2087)', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = createTempProject();
    });

    afterEach(() => {
      cleanup(tmpDir);
    });

    test('prunes STATE.md automatically when auto_prune_state is true', () => {
      writeConfigForAutoPrune(tmpDir, {
        workflow: { auto_prune_state: true },
      });

      writeStateMdForAutoPrune(tmpDir, [
        '# Session State',
        '',
        '**Current Phase:** 6',
        '**Status:** Executing',
        '',
        '## Decisions',
        '',
        '- [Phase 1]: Old decision from phase 1',
        '- [Phase 2]: Old decision from phase 2',
        '- [Phase 5]: Recent decision',
        '- [Phase 6]: Current decision',
        '',
      ].join('\n'));

      writeRoadmapForAutoPrune(tmpDir, [
        '# Roadmap',
        '',
        '## Phase 6: Test Phase',
        '',
        '**Plans:** 0/2',
        '',
      ].join('\n'));

      setupPhaseForAutoPrune(tmpDir, 6, 2);

      const result = runGsdTools('phase complete 6', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const newState = readStateMdForAutoPrune(tmpDir);
      assert.doesNotMatch(newState, /\[Phase 1\]: Old decision/);
      assert.doesNotMatch(newState, /\[Phase 2\]: Old decision/);
      assert.match(newState, /\[Phase 5\]: Recent decision/);
      assert.match(newState, /\[Phase 6\]: Current decision/);
    });

    test('does NOT prune when auto_prune_state is false (default)', () => {
      writeConfigForAutoPrune(tmpDir, {
        workflow: { auto_prune_state: false },
      });

      writeStateMdForAutoPrune(tmpDir, [
        '# Session State',
        '',
        '**Current Phase:** 6',
        '**Status:** Executing',
        '',
        '## Decisions',
        '',
        '- [Phase 1]: Old decision from phase 1',
        '- [Phase 5]: Recent decision',
        '- [Phase 6]: Current decision',
        '',
      ].join('\n'));

      writeRoadmapForAutoPrune(tmpDir, [
        '# Roadmap',
        '',
        '## Phase 6: Test Phase',
        '',
        '**Plans:** 0/2',
        '',
      ].join('\n'));

      setupPhaseForAutoPrune(tmpDir, 6, 2);

      const result = runGsdTools('phase complete 6', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const newState = readStateMdForAutoPrune(tmpDir);
      assert.match(newState, /\[Phase 1\]: Old decision/);
    });

    test('does NOT prune when auto_prune_state is absent from config', () => {
      writeConfigForAutoPrune(tmpDir, {
        workflow: {},
      });

      writeStateMdForAutoPrune(tmpDir, [
        '# Session State',
        '',
        '**Current Phase:** 6',
        '**Status:** Executing',
        '',
        '## Decisions',
        '',
        '- [Phase 1]: Old decision from phase 1',
        '- [Phase 6]: Current decision',
        '',
      ].join('\n'));

      writeRoadmapForAutoPrune(tmpDir, [
        '# Roadmap',
        '',
        '## Phase 6: Test Phase',
        '',
        '**Plans:** 0/2',
        '',
      ].join('\n'));

      setupPhaseForAutoPrune(tmpDir, 6, 2);

      const result = runGsdTools('phase complete 6', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const newState = readStateMdForAutoPrune(tmpDir);
      assert.match(newState, /\[Phase 1\]: Old decision/);
    });
  });
}
