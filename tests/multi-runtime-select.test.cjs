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
  '2': 'antigravity',
  '3': 'augment',
  '4': 'codex',
  '5': 'copilot',
  '6': 'cursor',
  '7': 'gemini',
  '8': 'kilo',
  '9': 'opencode',
  '10': 'trae',
  '11': 'windsurf'
};
const allRuntimes = ['claude', 'antigravity', 'augment', 'codex', 'copilot', 'cursor', 'gemini', 'kilo', 'opencode', 'trae', 'windsurf'];

/**
 * Simulate the parsing logic from promptRuntime without requiring readline.
 * This mirrors the exact logic in the rl.question callback.
 */
function parseRuntimeInput(input) {
  input = input.trim() || '1';

  if (input === '12') {
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
    assert.deepStrictEqual(parseRuntimeInput('2'), ['antigravity']);
    assert.deepStrictEqual(parseRuntimeInput('3'), ['augment']);
    assert.deepStrictEqual(parseRuntimeInput('4'), ['codex']);
    assert.deepStrictEqual(parseRuntimeInput('5'), ['copilot']);
    assert.deepStrictEqual(parseRuntimeInput('6'), ['cursor']);
  });

  test('comma-separated choices return multiple runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,5,7'), ['claude', 'copilot', 'gemini']);
    assert.deepStrictEqual(parseRuntimeInput('2,3'), ['antigravity', 'augment']);
    assert.deepStrictEqual(parseRuntimeInput('3,4'), ['augment', 'codex']);
  });

  test('space-separated choices return multiple runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('1 5 7'), ['claude', 'copilot', 'gemini']);
    assert.deepStrictEqual(parseRuntimeInput('6 8'), ['cursor', 'kilo']);
  });

  test('mixed comma and space separators work', () => {
    assert.deepStrictEqual(parseRuntimeInput('1, 5, 7'), ['claude', 'copilot', 'gemini']);
    assert.deepStrictEqual(parseRuntimeInput('2 , 6'), ['antigravity', 'cursor']);
  });

  test('single choice for opencode', () => {
    assert.deepStrictEqual(parseRuntimeInput('9'), ['opencode']);
  });

  test('single choice for trae', () => {
    assert.deepStrictEqual(parseRuntimeInput('10'), ['trae']);
  });

  test('single choice for windsurf', () => {
    assert.deepStrictEqual(parseRuntimeInput('11'), ['windsurf']);
  });

  test('choice 12 returns all runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('12'), allRuntimes);
  });

  test('empty input defaults to claude', () => {
    assert.deepStrictEqual(parseRuntimeInput(''), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('   '), ['claude']);
  });

  test('invalid choices are ignored, falls back to claude if all invalid', () => {
    assert.deepStrictEqual(parseRuntimeInput('13'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('0'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('abc'), ['claude']);
  });

  test('invalid choices mixed with valid are filtered out', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,13,5'), ['claude', 'copilot']);
    assert.deepStrictEqual(parseRuntimeInput('abc 3 xyz'), ['augment']);
  });

  test('duplicate choices are deduplicated', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,1,1'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('5,5,7,7'), ['copilot', 'gemini']);
  });

  test('preserves selection order', () => {
    assert.deepStrictEqual(parseRuntimeInput('7,1,5'), ['gemini', 'claude', 'copilot']);
    assert.deepStrictEqual(parseRuntimeInput('8,2,6'), ['kilo', 'antigravity', 'cursor']);
  });
});

describe('install.js source contains multi-select support', () => {
  test('runtimeMap is defined with all 11 runtimes', () => {
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

  test('all shortcut uses option 12', () => {
    assert.ok(
      installSrc.includes("if (input === '12')"),
      'all shortcut uses option 12'
    );
  });

  test('prompt lists Trae as option 10 and All as option 12', () => {
    assert.ok(
      installSrc.includes('10${reset}) Trae'),
      'prompt lists Trae as option 10'
    );
    assert.ok(
      installSrc.includes('12${reset}) All'),
      'prompt lists All as option 12'
    );
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
