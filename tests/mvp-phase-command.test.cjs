/**
 * /gsd mvp-phase command — frontmatter contract test
 * Verifies the command exists, has required frontmatter fields, and
 * points to the workflow file.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CMD = path.join(__dirname, '..', 'commands', 'gsd', 'mvp-phase.md');

describe('/gsd mvp-phase command frontmatter', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(CMD), `${CMD} must exist`);
  });

  test('frontmatter declares correct command name', () => {
    const content = fs.readFileSync(CMD, 'utf-8');
    assert.match(content, /^name:\s*gsd:mvp-phase\b/m);
  });

  test('argument-hint mentions phase number', () => {
    const content = fs.readFileSync(CMD, 'utf-8');
    assert.match(content, /argument-hint:[^\n]*phase/i);
  });

  test('allowed-tools includes Read, Write, Bash, Task, AskUserQuestion', () => {
    const content = fs.readFileSync(CMD, 'utf-8');
    for (const tool of ['Read', 'Write', 'Bash', 'Task', 'AskUserQuestion']) {
      assert.match(content, new RegExp(`-\\s*${tool}\\b`), `allowed-tools must include ${tool}`);
    }
  });

  test('execution_context points to the workflow file', () => {
    const content = fs.readFileSync(CMD, 'utf-8');
    assert.match(content, /workflows\/mvp-phase\.md/);
  });
});
