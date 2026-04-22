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
  '4': 'cline',
  '5': 'codebuddy',
  '6': 'codex',
  '7': 'copilot',
  '8': 'cursor',
  '9': 'gemini',
  '10': 'kilo',
  '11': 'opencode',
  '12': 'qwen',
  '13': 'trae',
  '14': 'windsurf'
};
const allRuntimes = ['claude', 'antigravity', 'augment', 'cline', 'codebuddy', 'codex', 'copilot', 'cursor', 'gemini', 'kilo', 'opencode', 'qwen', 'trae', 'windsurf'];

/**
 * Simulate the parsing logic from promptRuntime without requiring readline.
 * This mirrors the exact logic in the rl.question callback.
 */
function parseRuntimeInput(input) {
  input = input.trim() || '1';

  if (input === '15') {
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
    assert.deepStrictEqual(parseRuntimeInput('4'), ['cline']);
    assert.deepStrictEqual(parseRuntimeInput('5'), ['codebuddy']);
    assert.deepStrictEqual(parseRuntimeInput('6'), ['codex']);
    assert.deepStrictEqual(parseRuntimeInput('7'), ['copilot']);
    assert.deepStrictEqual(parseRuntimeInput('8'), ['cursor']);
  });

  test('comma-separated choices return multiple runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,7,9'), ['claude', 'copilot', 'gemini']);
    assert.deepStrictEqual(parseRuntimeInput('2,3'), ['antigravity', 'augment']);
    assert.deepStrictEqual(parseRuntimeInput('3,6'), ['augment', 'codex']);
  });

  test('space-separated choices return multiple runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('1 7 9'), ['claude', 'copilot', 'gemini']);
    assert.deepStrictEqual(parseRuntimeInput('8 10'), ['cursor', 'kilo']);
  });

  test('mixed comma and space separators work', () => {
    assert.deepStrictEqual(parseRuntimeInput('1, 7, 9'), ['claude', 'copilot', 'gemini']);
    assert.deepStrictEqual(parseRuntimeInput('2 , 8'), ['antigravity', 'cursor']);
  });

  test('single choice for opencode', () => {
    assert.deepStrictEqual(parseRuntimeInput('11'), ['opencode']);
  });

  test('single choice for qwen', () => {
    assert.deepStrictEqual(parseRuntimeInput('12'), ['qwen']);
  });

  test('single choice for trae', () => {
    assert.deepStrictEqual(parseRuntimeInput('13'), ['trae']);
  });

  test('single choice for windsurf', () => {
    assert.deepStrictEqual(parseRuntimeInput('14'), ['windsurf']);
  });

  test('choice 15 returns all runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('15'), allRuntimes);
  });

  test('empty input defaults to claude', () => {
    assert.deepStrictEqual(parseRuntimeInput(''), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('   '), ['claude']);
  });

  test('invalid choices are ignored, falls back to claude if all invalid', () => {
    assert.deepStrictEqual(parseRuntimeInput('16'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('0'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('abc'), ['claude']);
  });

  test('invalid choices mixed with valid are filtered out', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,16,7'), ['claude', 'copilot']);
    assert.deepStrictEqual(parseRuntimeInput('abc 3 xyz'), ['augment']);
  });

  test('duplicate choices are deduplicated', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,1,1'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('7,7,9,9'), ['copilot', 'gemini']);
  });

  test('preserves selection order', () => {
    assert.deepStrictEqual(parseRuntimeInput('9,1,7'), ['gemini', 'claude', 'copilot']);
    assert.deepStrictEqual(parseRuntimeInput('10,2,8'), ['kilo', 'antigravity', 'cursor']);
  });
});

describe('install.js source contains multi-select support', () => {
  test('runtimeMap is defined with all 14 runtimes', () => {
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

  test('all shortcut uses option 15', () => {
    assert.ok(
      installSrc.includes("if (input === '15')"),
      'all shortcut uses option 15'
    );
  });

  test('prompt lists Qwen Code as option 12, Trae as option 13 and All as option 15', () => {
    assert.ok(
      installSrc.includes('12${reset}) Qwen Code'),
      'prompt lists Qwen Code as option 12'
    );
    assert.ok(
      installSrc.includes('13${reset}) Trae'),
      'prompt lists Trae as option 13'
    );
    assert.ok(
      installSrc.includes('15${reset}) All'),
      'prompt lists All as option 15'
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
