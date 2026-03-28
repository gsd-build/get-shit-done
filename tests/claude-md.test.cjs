/**
 * CLAUDE.md generation and new-project workflow tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('generate-claude-md', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates CLAUDE.md with workflow enforcement section', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Test Project\n\n## What This Is\n\nA small test project.\n'
    );

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.action, 'created');
    assert.strictEqual(output.sections_total, 5);
    assert.ok(output.sections_generated.includes('workflow'));

    const claudePath = path.join(tmpDir, 'CLAUDE.md');
    const content = fs.readFileSync(claudePath, 'utf-8');
    assert.ok(content.includes('## GSD Workflow Enforcement'));
    assert.ok(content.includes('/gsd:quick'));
    assert.ok(content.includes('/gsd:debug'));
    assert.ok(content.includes('/gsd:execute-phase'));
    assert.ok(content.includes('Do not make direct repo edits outside a GSD workflow'));
  });

  test('adds workflow enforcement section when updating an existing CLAUDE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Test Project\n\n## What This Is\n\nA small test project.\n'
    );
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '## Local Notes\n\nKeep this intro.\n');

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.action, 'updated');

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('## Local Notes'));
    assert.ok(content.includes('## GSD Workflow Enforcement'));
  });
});

describe('new-project workflow includes CLAUDE.md generation', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-project.md');
  const commandsPath = path.join(__dirname, '..', 'docs', 'COMMANDS.md');

  test('new-project workflow generates CLAUDE.md before final commit', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('generate-claude-md'));
    assert.ok(content.includes('--files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md CLAUDE.md'));
  });

  test('new-project artifacts mention CLAUDE.md', () => {
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const commandsContent = fs.readFileSync(commandsPath, 'utf-8');

    assert.ok(workflowContent.includes('| Project guide  | `CLAUDE.md`'));
    assert.ok(workflowContent.includes('- `CLAUDE.md`'));
    assert.ok(commandsContent.includes('`CLAUDE.md`'));
  });
});
