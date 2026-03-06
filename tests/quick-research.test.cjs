/**
 * GSD Quick Research Flag Tests
 *
 * Validates the --research flag for /gsd:quick:
 * - Command frontmatter advertises --research
 * - Workflow includes research step (Step 4.75)
 * - Research artifacts work within quick task directories
 * - Workflow spawns gsd-phase-researcher for research
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');

// ─────────────────────────────────────────────────────────────────────────────
// Command frontmatter: --research flag advertised
// ─────────────────────────────────────────────────────────────────────────────

describe('quick command: --research in frontmatter', () => {
  const commandPath = path.join(COMMANDS_DIR, 'quick.md');
  let content;

  test('quick.md exists', () => {
    assert.ok(fs.existsSync(commandPath), 'commands/gsd/quick.md should exist');
  });

  test('argument-hint includes --research', () => {
    content = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(
      content.includes('--research'),
      'quick.md argument-hint should mention --research'
    );
  });

  test('argument-hint includes all three flags', () => {
    content = fs.readFileSync(commandPath, 'utf-8');
    const hintLine = content.split('\n').find(l => l.includes('argument-hint'));
    assert.ok(hintLine, 'should have argument-hint line');
    assert.ok(hintLine.includes('--full'), 'argument-hint should include --full');
    assert.ok(hintLine.includes('--discuss'), 'argument-hint should include --discuss');
    assert.ok(hintLine.includes('--research'), 'argument-hint should include --research');
  });

  test('objective section describes --research flag', () => {
    content = fs.readFileSync(commandPath, 'utf-8');
    const objectiveMatch = content.match(/<objective>([\s\S]*?)<\/objective>/);
    assert.ok(objectiveMatch, 'should have <objective> section');
    assert.ok(
      objectiveMatch[1].includes('--research'),
      'objective should describe --research flag'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workflow: research step present and correct
// ─────────────────────────────────────────────────────────────────────────────

describe('quick workflow: research step', () => {
  const workflowPath = path.join(WORKFLOWS_DIR, 'quick.md');
  let content;

  test('workflow file exists', () => {
    assert.ok(fs.existsSync(workflowPath), 'workflows/quick.md should exist');
    content = fs.readFileSync(workflowPath, 'utf-8');
  });

  test('purpose mentions --research flag', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    const purposeMatch = content.match(/<purpose>([\s\S]*?)<\/purpose>/);
    assert.ok(purposeMatch, 'should have <purpose> section');
    assert.ok(
      purposeMatch[1].includes('--research'),
      'purpose should mention --research flag'
    );
  });

  test('step 1 parses --research flag', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('$RESEARCH_MODE'),
      'workflow should reference $RESEARCH_MODE variable'
    );
  });

  test('step 4.75 research phase exists', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('Step 4.75'),
      'workflow should contain Step 4.75 (research phase)'
    );
  });

  test('research step spawns gsd-phase-researcher', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    const researchSection = content.substring(
      content.indexOf('Step 4.75'),
      content.indexOf('Step 5:')
    );
    assert.ok(
      researchSection.includes('subagent_type="gsd-phase-researcher"'),
      'research step should spawn gsd-phase-researcher agent'
    );
  });

  test('research step writes RESEARCH.md', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    const researchSection = content.substring(
      content.indexOf('Step 4.75'),
      content.indexOf('Step 5:')
    );
    assert.ok(
      researchSection.includes('RESEARCH.md'),
      'research step should reference RESEARCH.md output file'
    );
  });

  test('planner context includes RESEARCH.md when research mode', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    const plannerSection = content.substring(
      content.indexOf('Step 5: Spawn planner'),
      content.indexOf('Step 5.5')
    );
    assert.ok(
      plannerSection.includes('RESEARCH_MODE') && plannerSection.includes('RESEARCH.md'),
      'planner should read RESEARCH.md when $RESEARCH_MODE is true'
    );
  });

  test('file commit list includes RESEARCH.md', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    const commitSection = content.substring(
      content.indexOf('Step 8:'),
      content.indexOf('</process>')
    );
    assert.ok(
      commitSection.includes('RESEARCH_MODE') && commitSection.includes('RESEARCH.md'),
      'commit step should include RESEARCH.md when research mode is active'
    );
  });

  test('success criteria includes research items', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    const criteriaMatch = content.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/);
    assert.ok(criteriaMatch, 'should have <success_criteria> section');
    assert.ok(
      criteriaMatch[1].includes('--research'),
      'success criteria should mention --research flag'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quick task directory: RESEARCH.md file management
// ─────────────────────────────────────────────────────────────────────────────

describe('quick task: research file in task directory', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init quick returns valid task_dir for research file placement', () => {
    const result = runGsdTools('init quick "Add caching layer"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.task_dir, 'task_dir should be non-null');
    assert.ok(
      output.task_dir.startsWith('.planning/quick/'),
      'task_dir should be under .planning/quick/'
    );

    const expectedResearchPath = path.join(
      output.task_dir,
      `${output.next_num}-RESEARCH.md`
    );
    assert.ok(
      expectedResearchPath.endsWith('-RESEARCH.md'),
      'research path should end with -RESEARCH.md'
    );
  });

  test('verify-path-exists detects RESEARCH.md in quick task directory', () => {
    const quickTaskDir = path.join(tmpDir, '.planning', 'quick', '1-test-task');
    fs.mkdirSync(quickTaskDir, { recursive: true });
    fs.writeFileSync(
      path.join(quickTaskDir, '1-RESEARCH.md'),
      '# Research\n\nFindings for test task.\n'
    );

    const result = runGsdTools(
      'verify-path-exists .planning/quick/1-test-task/1-RESEARCH.md',
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.exists, true, 'RESEARCH.md should be detected');
    assert.strictEqual(output.type, 'file', 'should be detected as file');
  });

  test('verify-path-exists returns false for missing RESEARCH.md', () => {
    const quickTaskDir = path.join(tmpDir, '.planning', 'quick', '1-test-task');
    fs.mkdirSync(quickTaskDir, { recursive: true });

    const result = runGsdTools(
      'verify-path-exists .planning/quick/1-test-task/1-RESEARCH.md',
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.exists, false, 'missing RESEARCH.md should return false');
  });

  test('quick task directory supports all research workflow artifacts', () => {
    const quickTaskDir = path.join(tmpDir, '.planning', 'quick', '1-add-caching');
    fs.mkdirSync(quickTaskDir, { recursive: true });

    const artifacts = [
      '1-CONTEXT.md',
      '1-RESEARCH.md',
      '1-PLAN.md',
      '1-SUMMARY.md',
      '1-VERIFICATION.md',
    ];

    for (const artifact of artifacts) {
      fs.writeFileSync(path.join(quickTaskDir, artifact), `# ${artifact}\n`);
    }

    for (const artifact of artifacts) {
      const result = runGsdTools(
        `verify-path-exists .planning/quick/1-add-caching/${artifact}`,
        tmpDir
      );
      assert.ok(result.success, `Command failed for ${artifact}: ${result.error}`);
      const output = JSON.parse(result.output);
      assert.strictEqual(
        output.exists,
        true,
        `${artifact} should exist in quick task directory`
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flag composability: banner variants in workflow
// ─────────────────────────────────────────────────────────────────────────────

describe('quick workflow: banner variants for flag combinations', () => {
  let content;

  test('has banner for research-only mode', () => {
    content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'quick.md'), 'utf-8');
    assert.ok(
      content.includes('QUICK TASK (RESEARCH)'),
      'should have banner for --research only'
    );
  });

  test('has banner for discuss + research mode', () => {
    content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'quick.md'), 'utf-8');
    assert.ok(
      content.includes('DISCUSS + RESEARCH)'),
      'should have banner for --discuss --research'
    );
  });

  test('has banner for research + full mode', () => {
    content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'quick.md'), 'utf-8');
    assert.ok(
      content.includes('RESEARCH + FULL)'),
      'should have banner for --research --full'
    );
  });

  test('has banner for all three flags', () => {
    content = fs.readFileSync(path.join(WORKFLOWS_DIR, 'quick.md'), 'utf-8');
    assert.ok(
      content.includes('DISCUSS + RESEARCH + FULL)'),
      'should have banner for --discuss --research --full'
    );
  });
});
