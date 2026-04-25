/**
 * Execute-phase wave filter tests
 *
 * Validates the /gsd-execute-phase --wave feature contract:
 * - Command frontmatter advertises --wave
 * - Workflow parses WAVE_FILTER
 * - Workflow enforces lower-wave safety
 * - Partial wave runs do not mark the phase complete
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const COMMAND_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'execute-phase.md');
const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const COMMANDS_DOC_PATH = path.join(__dirname, '..', 'docs', 'COMMANDS.md');
const HELP_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'help.md');

// allow-test-rule: source-text-is-the-product
// The workflow and command .md files are the installed AI instructions — their text content
// IS what executes. String presence tests guard against accidental deletion of critical clauses.
// See #2692 for the missing behavioral test for --wave N argument parsing.
describe('execute-phase command: --wave flag', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(COMMAND_PATH), 'commands/gsd/execute-phase.md should exist');
  });

  test('argument-hint includes --wave, --gaps-only, and --interactive', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    const hintLine = content.split('\n').find(l => l.includes('argument-hint'));
    assert.ok(hintLine, 'should have argument-hint line');
    assert.ok(hintLine.includes('--wave N'), 'argument-hint should include --wave N');
    assert.ok(hintLine.includes('--gaps-only'), 'argument-hint should keep --gaps-only');
    assert.ok(hintLine.includes('--interactive'), 'argument-hint should preserve --interactive');
  });

  test('objective describes wave-filter execution', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    const objectiveMatch = content.match(/<objective>([\s\S]*?)<\/objective>/);
    assert.ok(objectiveMatch, 'should have <objective> section');
    assert.ok(objectiveMatch[1].includes('--wave N'), 'objective should mention --wave N');
    assert.ok(
      objectiveMatch[1].includes('no incomplete plans remain'),
      'objective should mention phase completion guardrail'
    );
  });
});

describe('execute-phase workflow: wave filtering', () => {
  test('workflow file exists', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'workflows/execute-phase.md should exist');
  });

  test('workflow parses WAVE_FILTER from arguments', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('WAVE_FILTER'), 'workflow should reference WAVE_FILTER');
    assert.ok(content.includes('Optional `--wave N`'), 'workflow should parse --wave N');
  });

  test('workflow enforces lower-wave safety', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('Wave safety check'),
      'workflow should contain a wave safety check section'
    );
    assert.ok(
      content.includes('finish earlier waves first'),
      'workflow should block later-wave execution when lower waves are incomplete'
    );
  });

  test('workflow has partial-wave completion guardrail', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('<step name="handle_partial_wave_execution">'),
      'workflow should have a partial wave handling step'
    );
    assert.ok(
      content.includes('Do NOT run phase verification'),
      'partial wave step should skip phase verification'
    );
    assert.ok(
      content.includes('Do NOT mark the phase complete'),
      'partial wave step should skip phase completion'
    );
  });
});

describe('execute-phase docs: user-facing wave flag', () => {
  test('COMMANDS.md documents --wave usage', () => {
    const content = fs.readFileSync(COMMANDS_DOC_PATH, 'utf-8');
    assert.ok(content.includes('`--wave N`'), 'COMMANDS.md should mention --wave N');
    assert.ok(
      content.includes('/gsd-execute-phase 1 --wave 2'),
      'COMMANDS.md should include a wave-filter example'
    );
  });

  test('help workflow documents --wave behavior', () => {
    const content = fs.readFileSync(HELP_PATH, 'utf-8');
    assert.ok(
      content.includes('Optional `--wave N` flag executes only Wave `N`'),
      'help.md should describe wave-specific execution'
    );
    assert.ok(
      content.includes('Usage: `/gsd:execute-phase 5 --wave 2`') || content.includes('Usage: `/gsd-execute-phase 5 --wave 2`'),
      'help.md should include wave-filter usage'
    );
  });

  test('workflow supports use_worktrees config toggle', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('USE_WORKTREES'),
      'workflow should reference USE_WORKTREES variable'
    );
    assert.ok(
      content.includes('config-get workflow.use_worktrees'),
      'workflow should read use_worktrees from config'
    );
    assert.ok(
      content.includes('Sequential mode'),
      'workflow should document sequential mode when worktrees disabled'
    );
  });
});

describe('phase-plan-index: wave grouping behavior', () => {
  test('phase-plan-index groups plans by wave frontmatter field', () => {
    // allow-test-rule: behavioral — calls gsd-tools and asserts structured output
    const fs = require('fs');
    const path = require('path');
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-alpha');
      fs.mkdirSync(phaseDir, { recursive: true });

      // Wave 1 plan
      fs.writeFileSync(path.join(phaseDir, 'P001-PLAN.md'), [
        '---',
        'wave: 1',
        'objective: First wave task',
        'autonomous: true',
        '---',
        '',
        '# Plan 001',
        '',
        '<objective>First wave task</objective>',
        '',
        '<task>Do the thing</task>',
      ].join('\n'));

      // Wave 2 plan
      fs.writeFileSync(path.join(phaseDir, 'P002-PLAN.md'), [
        '---',
        'wave: 2',
        'objective: Second wave task',
        'autonomous: true',
        '---',
        '',
        '# Plan 002',
        '',
        '<objective>Second wave task</objective>',
        '',
        '<task>Do the other thing</task>',
      ].join('\n'));

      const result = runGsdTools(['phase-plan-index', '1', '--raw'], tmpDir);
      assert.ok(result.success, `phase-plan-index should succeed: ${result.error}`);

      const data = JSON.parse(result.output);

      // Wave grouping must be present
      assert.ok(data.waves, 'output should have a waves property');
      assert.deepEqual(data.waves['1'], ['P001'], 'wave 1 should contain P001');
      assert.deepEqual(data.waves['2'], ['P002'], 'wave 2 should contain P002');

      // Individual plan records must carry their wave numbers
      const p001 = data.plans.find(p => p.id === 'P001');
      const p002 = data.plans.find(p => p.id === 'P002');
      assert.ok(p001, 'P001 should be in plans array');
      assert.ok(p002, 'P002 should be in plans array');
      assert.equal(p001.wave, 1, 'P001 should have wave=1');
      assert.equal(p002.wave, 2, 'P002 should have wave=2');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('phase-plan-index defaults missing wave frontmatter to wave 1', () => {
    // allow-test-rule: behavioral — exercises gsd-tools wave-defaulting logic
    const fs = require('fs');
    const path = require('path');
    const tmpDir = createTempProject();
    try {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-alpha');
      fs.mkdirSync(phaseDir, { recursive: true });

      // Plan with no wave field in frontmatter
      fs.writeFileSync(path.join(phaseDir, 'P001-PLAN.md'), [
        '---',
        'objective: No wave specified',
        'autonomous: true',
        '---',
        '',
        '# Plan 001',
        '',
        '<task>Some work</task>',
      ].join('\n'));

      const result = runGsdTools(['phase-plan-index', '1', '--raw'], tmpDir);
      assert.ok(result.success, `phase-plan-index should succeed: ${result.error}`);

      const data = JSON.parse(result.output);
      const p001 = data.plans.find(p => p.id === 'P001');
      assert.ok(p001, 'P001 should appear in plans');
      assert.equal(p001.wave, 1, 'plan with no wave frontmatter should default to wave 1');
      assert.deepEqual(data.waves['1'], ['P001'], 'defaulted plan should land in wave 1 group');
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe('use_worktrees config: cross-workflow structural coverage', () => {
  const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');
  const DIAGNOSE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'diagnose-issues.md');
  const EXECUTE_PLAN_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-plan.md');
  const PLANNING_CONFIG_PATH = path.join(__dirname, '..', 'get-shit-done', 'references', 'planning-config.md');

  test('quick workflow reads USE_WORKTREES from config', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    assert.ok(
      content.includes('config-get workflow.use_worktrees'),
      'quick.md should read use_worktrees from config'
    );
    assert.ok(
      content.includes('USE_WORKTREES'),
      'quick.md should reference USE_WORKTREES variable'
    );
  });

  test('diagnose-issues workflow reads USE_WORKTREES from config', () => {
    const content = fs.readFileSync(DIAGNOSE_PATH, 'utf-8');
    assert.ok(
      content.includes('config-get workflow.use_worktrees'),
      'diagnose-issues.md should read use_worktrees from config'
    );
    assert.ok(
      content.includes('USE_WORKTREES'),
      'diagnose-issues.md should reference USE_WORKTREES variable'
    );
  });

  test('execute-plan workflow references use_worktrees config', () => {
    const content = fs.readFileSync(EXECUTE_PLAN_PATH, 'utf-8');
    assert.ok(
      content.includes('workflow.use_worktrees'),
      'execute-plan.md should reference workflow.use_worktrees'
    );
  });

  test('planning-config reference documents use_worktrees', () => {
    const content = fs.readFileSync(PLANNING_CONFIG_PATH, 'utf-8');
    assert.ok(
      content.includes('workflow.use_worktrees'),
      'planning-config.md should document workflow.use_worktrees'
    );
    assert.ok(
      content.includes('worktree'),
      'planning-config.md should describe worktree behavior'
    );
  });

  test('config-set accepts workflow.use_worktrees', () => {
    // allow-test-rule: behavioral — exercises config-set validation, not source text
    const tmpDir = createTempProject();
    try {
      const result = runGsdTools('config-set workflow.use_worktrees true', tmpDir);
      assert.ok(result.success, `config-set should accept workflow.use_worktrees: ${result.error}`);
    } finally {
      cleanup(tmpDir);
    }
  });
});
