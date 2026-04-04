const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('analyze-dependencies command', () => {
  test('command file exists', () => {
    const p = path.join(__dirname, '..', 'commands', 'gsd', 'analyze-dependencies.md');
    assert.ok(fs.existsSync(p), 'commands/gsd/analyze-dependencies.md should exist');
  });

  test('command file has description frontmatter', () => {
    const p = path.join(__dirname, '..', 'commands', 'gsd', 'analyze-dependencies.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(content.includes('description:'), 'Command file must have description frontmatter');
  });

  test('workflow file exists', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'analyze-dependencies.md');
    assert.ok(fs.existsSync(p), 'workflows/analyze-dependencies.md should exist');
  });

  test('workflow describes dependency analysis approach', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'analyze-dependencies.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(content.includes('ROADMAP') || content.includes('phase'),
      'workflow should reference ROADMAP.md/phases');
    assert.ok(
      content.includes('depends') || content.includes('Depends') || content.includes('dependency'),
      'workflow should reference dependency detection'
    );
  });

  test('workflow mentions file overlap detection', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'analyze-dependencies.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(
      content.includes('file') && (content.includes('overlap') || content.includes('conflict')),
      'workflow should mention file overlap/conflict detection'
    );
  });

  test('docs/COMMANDS.md references analyze-dependencies', () => {
    const p = path.join(__dirname, '..', 'docs', 'COMMANDS.md');
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('analyze-dependencies'),
        'COMMANDS.md should document the new command');
    }
  });
});
