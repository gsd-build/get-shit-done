/**
 * Extract-Learnings Command & Workflow Tests
 *
 * Validates command file existence, frontmatter correctness, workflow content,
 * 4 learning categories, capture_thought handling, graceful degradation,
 * LEARNINGS.md output, and missing artifact handling.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMMAND_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'extract_learnings.md');
const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'extract_learnings.md');

describe('extract-learnings command', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(COMMAND_PATH), 'commands/gsd/extract_learnings.md should exist');
  });

  test('command file has correct name frontmatter', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(content.includes('name: gsd:extract-learnings'), 'Command must have name: gsd:extract-learnings');
  });

  test('command file has description frontmatter', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(content.includes('description:'), 'Command must have description frontmatter');
  });

  test('command file has argument-hint for phase-number', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(content.includes('argument-hint:'), 'Command must have argument-hint');
    assert.ok(content.includes('<phase-number>'), 'argument-hint must reference <phase-number>');
  });

  test('command file has allowed-tools list', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(content.includes('allowed-tools:'), 'Command must have allowed-tools');
    assert.ok(content.includes('Read'), 'allowed-tools must include Read');
    assert.ok(content.includes('Write'), 'allowed-tools must include Write');
    assert.ok(content.includes('Bash'), 'allowed-tools must include Bash');
    assert.ok(content.includes('Grep'), 'allowed-tools must include Grep');
    assert.ok(content.includes('Glob'), 'allowed-tools must include Glob');
    assert.ok(content.includes('Agent'), 'allowed-tools must include Agent');
  });

  test('command file has type: prompt', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(content.includes('type: prompt'), 'Command must have type: prompt');
  });

  test('command references the workflow via execution_context', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(
      content.includes('workflows/extract_learnings.md'),
      'Command must reference workflows/extract_learnings.md in execution_context'
    );
  });
});

describe('extract-learnings workflow', () => {
  test('workflow file exists', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'workflows/extract_learnings.md should exist');
  });

  test('workflow has objective tag', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('<objective>'), 'Workflow must have <objective> tag');
    assert.ok(content.includes('</objective>'), 'Workflow must close <objective> tag');
  });

  test('workflow has process tag', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('<process>'), 'Workflow must have <process> tag');
    assert.ok(content.includes('</process>'), 'Workflow must close <process> tag');
  });

  test('workflow has step tags', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('<step name='), 'Workflow must have named step tags');
    assert.ok(content.includes('</step>'), 'Workflow must close step tags');
  });

  test('workflow has success_criteria tag', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('<success_criteria>'), 'Workflow must have <success_criteria> tag');
    assert.ok(content.includes('</success_criteria>'), 'Workflow must close <success_criteria> tag');
  });

  test('workflow has critical_rules tag', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('<critical_rules>'), 'Workflow must have <critical_rules> tag');
    assert.ok(content.includes('</critical_rules>'), 'Workflow must close <critical_rules> tag');
  });

  test('workflow reads required artifacts (PLAN.md and SUMMARY.md)', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('PLAN.md'), 'Workflow must reference PLAN.md');
    assert.ok(content.includes('SUMMARY.md'), 'Workflow must reference SUMMARY.md');
  });

  test('workflow reads optional artifacts (VERIFICATION.md, UAT.md, STATE.md)', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('VERIFICATION.md'), 'Workflow must reference VERIFICATION.md');
    assert.ok(content.includes('UAT.md'), 'Workflow must reference UAT.md');
    assert.ok(content.includes('STATE.md'), 'Workflow must reference STATE.md');
  });

  test('workflow extracts all 4 learning categories', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.toLowerCase().includes('decision'), 'Workflow must extract decisions');
    assert.ok(content.toLowerCase().includes('lesson'), 'Workflow must extract lessons');
    assert.ok(content.toLowerCase().includes('pattern'), 'Workflow must extract patterns');
    assert.ok(content.toLowerCase().includes('surprise'), 'Workflow must extract surprises');
  });

  test('workflow handles capture_thought tool availability', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('capture_thought'), 'Workflow must reference capture_thought tool');
  });

  test('workflow degrades gracefully when capture_thought is unavailable', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('graceful') || content.includes('not available') || content.includes('unavailable') || content.includes('fallback'),
      'Workflow must handle graceful degradation when capture_thought is unavailable'
    );
  });

  test('workflow outputs LEARNINGS.md', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('LEARNINGS.md'), 'Workflow must output LEARNINGS.md');
  });

  test('workflow handles missing artifacts gracefully', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('missing') || content.includes('not found') || content.includes('optional'),
      'Workflow must handle missing artifacts'
    );
  });

  test('workflow includes source attribution for extracted items', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('source') || content.includes('attribution') || content.includes('Source:'),
      'Workflow must include source attribution for extracted items'
    );
  });

  test('workflow specifies LEARNINGS.md YAML frontmatter fields', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(content.includes('phase'), 'LEARNINGS.md frontmatter must include phase');
    assert.ok(content.includes('phase_name'), 'LEARNINGS.md frontmatter must include phase_name');
    assert.ok(content.includes('generated'), 'LEARNINGS.md frontmatter must include generated');
    assert.ok(content.includes('missing_artifacts'), 'LEARNINGS.md frontmatter must include missing_artifacts');
  });

  test('workflow supports overwriting previous LEARNINGS.md on re-run', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('overwrite') || content.includes('overwrit') || content.includes('replace'),
      'Workflow must support overwriting previous LEARNINGS.md'
    );
  });
});
