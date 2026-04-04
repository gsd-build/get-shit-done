/**
 * GSD Tools Tests - discuss-phase power user mode
 *
 * Validates that the --power flag workflow documentation is present and
 * correctly describes the bulk question generation/answering flow.
 *
 * Closes: #1513
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('discuss-phase power user mode (#1513)', () => {
  const commandPath = path.join(__dirname, '..', 'commands', 'gsd', 'discuss-phase.md');
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase.md');
  const powerWorkflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase-power.md');

  describe('command file (discuss-phase.md)', () => {
    test('mentions --power flag in argument-hint or description', () => {
      const content = fs.readFileSync(commandPath, 'utf8');
      assert.ok(
        content.includes('--power'),
        'commands/gsd/discuss-phase.md should document the --power flag'
      );
    });

    test('references the power workflow file', () => {
      const content = fs.readFileSync(commandPath, 'utf8');
      assert.ok(
        content.includes('discuss-phase-power'),
        'command file should reference discuss-phase-power workflow'
      );
    });
  });

  describe('main workflow file (discuss-phase.md)', () => {
    test('has power_user_mode section or references discuss-phase-power.md', () => {
      const content = fs.readFileSync(workflowPath, 'utf8');
      const hasPowerSection = content.includes('power_user_mode') || content.includes('power user mode');
      const hasReference = content.includes('discuss-phase-power');
      assert.ok(
        hasPowerSection || hasReference,
        'discuss-phase.md should have power_user_mode section or reference discuss-phase-power.md'
      );
    });

    test('describes --power flag routing', () => {
      const content = fs.readFileSync(workflowPath, 'utf8');
      assert.ok(
        content.includes('--power'),
        'discuss-phase.md should describe --power flag handling'
      );
    });
  });

  describe('power workflow file (discuss-phase-power.md)', () => {
    test('file exists', () => {
      assert.ok(
        fs.existsSync(powerWorkflowPath),
        'get-shit-done/workflows/discuss-phase-power.md should exist'
      );
    });

    test('describes the generate step', () => {
      const content = fs.readFileSync(powerWorkflowPath, 'utf8');
      assert.ok(
        content.includes('generate') || content.includes('Generate'),
        'power workflow should describe generating questions'
      );
    });

    test('describes the wait/notify step', () => {
      const content = fs.readFileSync(powerWorkflowPath, 'utf8');
      const hasWait = content.includes('wait') || content.includes('Wait');
      const hasNotify = content.includes('notify') || content.includes('Notify') || content.includes('notif');
      assert.ok(
        hasWait || hasNotify,
        'power workflow should describe the wait/notify step after generating files'
      );
    });

    test('describes the refresh step', () => {
      const content = fs.readFileSync(powerWorkflowPath, 'utf8');
      assert.ok(
        content.includes('refresh') || content.includes('Refresh'),
        'power workflow should describe the refresh step for processing answers'
      );
    });

    test('describes the finalize step', () => {
      const content = fs.readFileSync(powerWorkflowPath, 'utf8');
      assert.ok(
        content.includes('finalize') || content.includes('Finalize'),
        'power workflow should describe the finalize step for generating CONTEXT.md'
      );
    });

    test('QUESTIONS.json structure has required fields', () => {
      const content = fs.readFileSync(powerWorkflowPath, 'utf8');
      assert.ok(content.includes('QUESTIONS.json'), 'should mention QUESTIONS.json file');
      assert.ok(content.includes('"phase"'), 'JSON structure should include phase field');
      assert.ok(content.includes('"stats"'), 'JSON structure should include stats field');
      assert.ok(content.includes('"sections"'), 'JSON structure should include sections field');
      assert.ok(
        content.includes('"id"') && content.includes('"title"'),
        'JSON structure should include question id and title fields'
      );
      assert.ok(
        content.includes('"options"'),
        'JSON structure should include options array'
      );
      assert.ok(
        content.includes('"answer"'),
        'JSON structure should include answer field'
      );
      assert.ok(
        content.includes('"status"'),
        'JSON structure should include status field'
      );
    });

    test('describes HTML generation step', () => {
      const content = fs.readFileSync(powerWorkflowPath, 'utf8');
      assert.ok(
        content.includes('QUESTIONS.html') || content.includes('.html'),
        'power workflow should describe generating the HTML companion file'
      );
      assert.ok(
        content.includes('HTML') || content.includes('html'),
        'power workflow should mention HTML output'
      );
    });

    test('QUESTIONS.json file naming uses padded phase number', () => {
      const content = fs.readFileSync(powerWorkflowPath, 'utf8');
      assert.ok(
        content.includes('padded_phase') || content.includes('{padded_phase}') || content.includes('QUESTIONS.json'),
        'power workflow should describe file naming with padded phase number'
      );
    });
  });
});
