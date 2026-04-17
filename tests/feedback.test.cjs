const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const commandPath = path.join(repoRoot, 'commands', 'gsd', 'feedback.md');
const workflowPath = path.join(repoRoot, 'get-shit-done', 'workflows', 'feedback.md');

describe('feedback command', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(commandPath), 'commands/gsd/feedback.md should exist');
  });

  test('command frontmatter includes expected fields', () => {
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(content.includes('name: gsd:feedback'), 'should have correct command name');
    assert.ok(content.includes('description:'), 'should have description');
    assert.ok(content.includes('argument-hint:'), 'should have argument hint');
    assert.ok(content.includes('AskUserQuestion'), 'should allow AskUserQuestion');
    assert.ok(content.includes('workflows/feedback.md'), 'should reference feedback workflow');
  });
});

describe('feedback workflow', () => {
  test('workflow file exists', () => {
    assert.ok(fs.existsSync(workflowPath), 'get-shit-done/workflows/feedback.md should exist');
  });

  test('workflow collects diagnostics from existing gsd helpers', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('gsd-sdk query state.json'), 'should read state json');
    assert.ok(content.includes('gsd-sdk query state-snapshot'), 'should read state snapshot');
    assert.ok(content.includes('gsd-sdk query config-get'), 'should read config via gsd-sdk query');
    assert.ok(content.includes('VERSION'), 'should check VERSION file');
    assert.ok(content.includes('package.json'), 'should fall back to package.json version');
  });

  test('workflow delegates issue filing to shared file-issue workflow', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('workflows/file-issue.md'),
      'should delegate to file-issue.md workflow'
    );
    assert.ok(
      content.includes('DIAGNOSTICS_MARKDOWN'),
      'should set DIAGNOSTICS_MARKDOWN before delegation'
    );
    assert.ok(
      content.includes('INVESTIGATION_FINDINGS'),
      'should set INVESTIGATION_FINDINGS before delegation'
    );
  });

  test('workflow offers optional forensics enrichment on bug type', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('forensics investigation'),
      'should offer forensics enrichment for bug reports'
    );
    assert.ok(
      content.includes('workflows/forensics.md'),
      'should reference forensics workflow for enrichment'
    );
  });
});

describe('feedback discoverability docs', () => {
  test('README references /gsd-feedback', () => {
    const content = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
    assert.ok(content.includes('/gsd-feedback'), 'README.md should mention /gsd-feedback');
  });

  test('COMMANDS.md references /gsd-feedback', () => {
    const content = fs.readFileSync(path.join(repoRoot, 'docs', 'COMMANDS.md'), 'utf8');
    assert.ok(content.includes('/gsd-feedback'), 'docs/COMMANDS.md should mention /gsd-feedback');
  });

  test('help reference mentions /gsd-feedback', () => {
    const content = fs.readFileSync(path.join(repoRoot, 'get-shit-done', 'workflows', 'help.md'), 'utf8');
    assert.ok(content.includes('/gsd-feedback'), 'help workflow should mention /gsd-feedback');
  });

  test('high-value failure surfaces point to /gsd-feedback', () => {
    const review = fs.readFileSync(path.join(repoRoot, 'get-shit-done', 'workflows', 'review.md'), 'utf8');
    const ship = fs.readFileSync(path.join(repoRoot, 'get-shit-done', 'workflows', 'ship.md'), 'utf8');
    const update = fs.readFileSync(path.join(repoRoot, 'get-shit-done', 'workflows', 'update.md'), 'utf8');

    assert.ok(review.includes('/gsd-feedback'), 'review workflow should mention /gsd-feedback');
    assert.ok(ship.includes('/gsd-feedback'), 'ship workflow should mention /gsd-feedback');
    assert.ok(update.includes('/gsd-feedback'), 'update workflow should mention /gsd-feedback');
  });
});
