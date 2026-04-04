/**
 * GSD Tools Tests - discuss-phase incremental checkpoint saves
 *
 * Validates that the discuss-phase workflow includes incremental
 * checkpoint logic to prevent answer loss on session interruption.
 *
 * Closes: #1485
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('discuss-phase incremental checkpoint saves (#1485)', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase.md');

  test('workflow writes checkpoint file after each area completes', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('DISCUSS-CHECKPOINT.json'),
      'workflow should reference checkpoint JSON file'
    );
    assert.ok(
      content.includes('Incremental checkpoint') || content.includes('incremental checkpoint'),
      'workflow should describe incremental checkpoint saves'
    );
  });

  test('checkpoint includes decisions, areas completed, and areas remaining', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('areas_completed'), 'checkpoint should track completed areas');
    assert.ok(content.includes('areas_remaining'), 'checkpoint should track remaining areas');
    assert.ok(content.includes('"decisions"'), 'checkpoint should include decisions object');
  });

  test('check_existing step detects checkpoint for session resume', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // The check_existing step should look for checkpoint files
    assert.ok(
      content.includes('DISCUSS-CHECKPOINT.json') && content.includes('Resume'),
      'check_existing should detect checkpoint and offer resume'
    );
  });

  test('checkpoint is cleaned up after successful CONTEXT.md write', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('rm -f') && content.includes('DISCUSS-CHECKPOINT'),
      'checkpoint file should be deleted after successful write_context'
    );
  });

  test('success criteria include checkpoint requirements', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const criteriaMatch = content.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/);
    const criteria = criteriaMatch ? criteriaMatch[1] : '';
    assert.ok(criteria.includes('checkpoint') || criteria.includes('Checkpoint'),
      'success criteria should mention checkpoints');
    assert.ok(criteria.includes('resume') || criteria.includes('Resume'),
      'success criteria should mention session resume capability');
  });

  test('auto mode also writes checkpoints', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // The checkpoint section should mention auto mode
    assert.ok(
      content.includes('auto-resolves') || content.includes('--auto'),
      'checkpoint logic should apply to both interactive and auto modes'
    );
  });
});
