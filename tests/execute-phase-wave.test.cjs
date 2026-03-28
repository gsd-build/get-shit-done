/**
 * Execute-phase wave filter tests
 *
 * Validates the /gsd:execute-phase --wave feature contract:
 * - Command frontmatter advertises --wave
 * - Workflow parses WAVE_FILTER
 * - Workflow enforces lower-wave safety
 * - Partial wave runs do not mark the phase complete
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const COMMAND_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'execute-phase.md');
const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const COMMANDS_DOC_PATH = path.join(__dirname, '..', 'docs', 'COMMANDS.md');
const HELP_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'help.md');

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
      content.includes('/gsd:execute-phase 1 --wave 2'),
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
      content.includes('Usage: `/gsd:execute-phase 5 --wave 2`'),
      'help.md should include wave-filter usage'
    );
  });
});
