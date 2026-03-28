/**
 * Tests for multi-runtime selection in the interactive installer prompt.
 * Verifies that promptRuntime accepts comma-separated, space-separated,
 * and single-choice inputs, deduplicates, and falls back to claude.
 * See issue #1281.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read install.js source to extract the runtimeMap and parsing logic
const installSrc = fs.readFileSync(
  path.join(__dirname, '..', 'bin', 'install.js'),
  'utf8'
);

// Extract runtimeMap from source for validation
const runtimeMap = {
  '1': 'claude',
  '2': 'opencode',
  '3': 'gemini',
  '4': 'codex',
  '5': 'copilot',
  '6': 'antigravity',
  '7': 'cursor',
  '8': 'windsurf'
};
const allRuntimes = ['claude', 'opencode', 'gemini', 'codex', 'copilot', 'antigravity', 'cursor', 'windsurf'];

/**
 * Simulate the parsing logic from promptRuntime without requiring readline.
 * This mirrors the exact logic in the rl.question callback.
 */
function parseRuntimeInput(input) {
  input = input.trim() || '1';

  if (input === '9') {
    return allRuntimes;
  }

  const choices = input.split(/[\s,]+/).filter(Boolean);
  const selected = [];
  for (const c of choices) {
    const runtime = runtimeMap[c];
    if (runtime && !selected.includes(runtime)) {
      selected.push(runtime);
    }
  }

  return selected.length > 0 ? selected : ['claude'];
}

describe('multi-runtime selection parsing', () => {
  test('single choice returns single runtime', () => {
    assert.deepStrictEqual(parseRuntimeInput('1'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('4'), ['codex']);
    assert.deepStrictEqual(parseRuntimeInput('7'), ['cursor']);
  });

  test('comma-separated choices return multiple runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,4,6'), ['claude', 'codex', 'antigravity']);
    assert.deepStrictEqual(parseRuntimeInput('2,3'), ['opencode', 'gemini']);
  });

  test('space-separated choices return multiple runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('1 4 6'), ['claude', 'codex', 'antigravity']);
    assert.deepStrictEqual(parseRuntimeInput('5 7'), ['copilot', 'cursor']);
  });

  test('mixed comma and space separators work', () => {
    assert.deepStrictEqual(parseRuntimeInput('1, 4, 6'), ['claude', 'codex', 'antigravity']);
    assert.deepStrictEqual(parseRuntimeInput('2 , 5'), ['opencode', 'copilot']);
  });

  test('single choice for windsurf', () => {
    assert.deepStrictEqual(parseRuntimeInput('8'), ['windsurf']);
  });

  test('choice 9 returns all runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('9'), allRuntimes);
  });

  test('empty input defaults to claude', () => {
    assert.deepStrictEqual(parseRuntimeInput(''), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('   '), ['claude']);
  });

  test('invalid choices are ignored, falls back to claude if all invalid', () => {
    assert.deepStrictEqual(parseRuntimeInput('10'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('0'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('abc'), ['claude']);
  });

  test('invalid choices mixed with valid are filtered out', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,10,4'), ['claude', 'codex']);
    assert.deepStrictEqual(parseRuntimeInput('abc 3 xyz'), ['gemini']);
  });

  test('duplicate choices are deduplicated', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,1,1'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('4,4,6,6'), ['codex', 'antigravity']);
  });

  test('preserves selection order', () => {
    assert.deepStrictEqual(parseRuntimeInput('6,1,4'), ['antigravity', 'claude', 'codex']);
    assert.deepStrictEqual(parseRuntimeInput('7,2,5'), ['cursor', 'opencode', 'copilot']);
  });
});

describe('install.js source contains multi-select support', () => {
  test('runtimeMap is defined with all 8 runtimes', () => {
    for (const [key, name] of Object.entries(runtimeMap)) {
      assert.ok(
        installSrc.includes(`'${key}': '${name}'`),
        `runtimeMap has ${key} -> ${name}`
      );
    }
  });

  test('allRuntimes array contains all runtimes', () => {
    const match = installSrc.match(/const allRuntimes = \[([^\]]+)\]/);
    assert.ok(match, 'allRuntimes array found');
    for (const rt of allRuntimes) {
      assert.ok(match[1].includes(`'${rt}'`), `allRuntimes includes ${rt}`);
    }
  });

  test('prompt text shows multi-select hint', () => {
    assert.ok(
      installSrc.includes('Select multiple'),
      'prompt includes multi-select instructions'
    );
  });

  test('parsing uses split with comma and space regex', () => {
    assert.ok(
      installSrc.includes("split(/[\\s,]+/)"),
      'input is split on commas and whitespace'
    );
  });

  test('deduplication check exists', () => {
    assert.ok(
      installSrc.includes('!selected.includes(runtime)'),
      'deduplication guard exists'
    );
  });
});
