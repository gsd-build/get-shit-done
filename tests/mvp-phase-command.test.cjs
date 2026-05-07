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

function parseCommandContract(content) {
  const lines = content.split(/\r?\n/);
  const firstFence = lines.indexOf('---');
  const secondFence = lines.indexOf('---', firstFence + 1);
  assert.ok(firstFence === 0 && secondFence > 0, 'command must start with YAML frontmatter');

  const frontmatterLines = lines.slice(firstFence + 1, secondFence);
  const frontmatter = {};
  const allowedTools = [];
  let inAllowedTools = false;

  for (const raw of frontmatterLines) {
    const line = raw.trim();
    if (line === 'allowed-tools:') {
      inAllowedTools = true;
      continue;
    }
    if (inAllowedTools) {
      if (line.startsWith('- ')) {
        allowedTools.push(line.slice(2).trim());
        continue;
      }
      inAllowedTools = false;
    }
    const sep = line.indexOf(':');
    if (sep > 0) {
      frontmatter[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
    }
  }

  const executionContextStart = lines.findIndex(line => line.trim() === '<execution_context>');
  const executionContextEnd = lines.findIndex(
    (line, idx) => idx > executionContextStart && line.trim() === '</execution_context>'
  );
  const executionContextRefs = executionContextStart >= 0 && executionContextEnd > executionContextStart
    ? lines.slice(executionContextStart + 1, executionContextEnd).map(line => line.trim()).filter(Boolean)
    : [];

  return {
    name: frontmatter.name || '',
    argumentHint: frontmatter['argument-hint'] || '',
    executionContextRefs,
    allowedTools,
  };
}

describe('/gsd mvp-phase command frontmatter', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(CMD), `${CMD} must exist`);
  });

  test('frontmatter declares correct command name', () => {
    const contract = parseCommandContract(fs.readFileSync(CMD, 'utf-8'));
    assert.equal(contract.name, 'gsd:mvp-phase');
  });

  test('argument-hint mentions phase number', () => {
    const contract = parseCommandContract(fs.readFileSync(CMD, 'utf-8'));
    assert.ok(contract.argumentHint.toLowerCase().includes('phase'));
  });

  test('allowed-tools includes Read, Write, Bash, (Task or Agent), AskUserQuestion', () => {
    const contract = parseCommandContract(fs.readFileSync(CMD, 'utf-8'));
    for (const tool of ['Read', 'Write', 'Bash', 'AskUserQuestion']) {
      assert.ok(contract.allowedTools.includes(tool), `allowed-tools must include ${tool}`);
    }
    assert.ok(
      contract.allowedTools.includes('Task') || contract.allowedTools.includes('Agent'),
      'allowed-tools must include Task or Agent for delegation'
    );
  });

  test('execution_context points to the workflow file', () => {
    const contract = parseCommandContract(fs.readFileSync(CMD, 'utf-8'));
    assert.ok(
      contract.executionContextRefs.some(ref => ref.endsWith('workflows/mvp-phase.md')),
      'execution_context must include workflows/mvp-phase.md'
    );
  });
});
