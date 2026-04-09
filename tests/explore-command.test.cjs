const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('explore command', () => {
  test('command file exists', () => {
    const p = path.join(__dirname, '..', 'commands', 'gsd', 'explore.md');
    assert.ok(fs.existsSync(p), 'commands/gsd/explore.md should exist');
  });

  test('command file has required frontmatter', () => {
    const p = path.join(__dirname, '..', 'commands', 'gsd', 'explore.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(content.includes('name: gsd:explore'), 'Command must have name frontmatter');
    assert.ok(content.includes('description:'), 'Command must have description frontmatter');
    assert.ok(content.includes('allowed-tools:'), 'Command must have allowed-tools frontmatter');
  });

  test('workflow file exists', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'explore.md');
    assert.ok(fs.existsSync(p), 'workflows/explore.md should exist');
  });

  test('workflow references questioning.md and domain-probes.md', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'explore.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(content.includes('questioning.md'), 'Workflow must reference questioning.md');
    assert.ok(content.includes('domain-probes.md'), 'Workflow must reference domain-probes.md');
  });

  test('workflow documents all 6 output types', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'explore.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(content.includes('Note'), 'Workflow must document Note output type');
    assert.ok(content.includes('Todo'), 'Workflow must document Todo output type');
    assert.ok(content.includes('Seed'), 'Workflow must document Seed output type');
    assert.ok(content.includes('Research question'), 'Workflow must document Research question output type');
    assert.ok(content.includes('Requirement'), 'Workflow must document Requirement output type');
    assert.ok(content.includes('New phase') || content.includes('phase'), 'Workflow must document New phase output type');
  });

  test('workflow enforces one question at a time principle', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'explore.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(content.includes('one question at a time'), 'Workflow must mention "one question at a time" principle');
  });

  test('workflow requires user confirmation before writing artifacts', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'explore.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(
      content.includes('explicit user selection') || content.includes('Never write artifacts without'),
      'Workflow must require user confirmation before writing artifacts'
    );
  });

  test('workflow respects commit_docs config', () => {
    const p = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'explore.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(content.includes('commit_docs'), 'Workflow must respect commit_docs configuration');
  });

  test('command references the workflow via execution_context', () => {
    const p = path.join(__dirname, '..', 'commands', 'gsd', 'explore.md');
    const content = fs.readFileSync(p, 'utf-8');
    assert.ok(
      content.includes('workflows/explore.md'),
      'Command must reference workflows/explore.md in execution_context'
    );
  });
});
