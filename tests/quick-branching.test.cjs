/**
 * Quick task branching tests
 *
 * Validates that /gsd:quick exposes branch_name from init and that the
 * workflow checks out a dedicated quick-task branch when configured.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('quick workflow: branching support', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');
  let content;

  test('workflow file exists', () => {
    assert.ok(fs.existsSync(workflowPath), 'workflows/quick.md should exist');
  });

  test('init parse list includes branch_name', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('branch_name'), 'quick workflow should parse branch_name from init JSON');
  });

  test('workflow includes quick-task branching step', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('Step 2.5: Handle quick-task branching'));
    assert.ok(content.includes('git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"'));
  });

  test('branching step runs before task directory creation', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    const branchingIndex = content.indexOf('Step 2.5: Handle quick-task branching');
    const createDirIndex = content.indexOf('Step 3: Create task directory');
    assert.ok(branchingIndex !== -1 && createDirIndex !== -1, 'workflow should contain both branching and directory steps');
    assert.ok(branchingIndex < createDirIndex, 'branching should happen before quick task directories and commits');
  });
});
