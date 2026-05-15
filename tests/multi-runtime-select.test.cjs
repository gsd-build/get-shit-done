/**
 * Tests for multi-runtime selection in the interactive installer prompt.
 * Verifies that promptRuntime accepts comma-separated, space-separated,
 * and single-choice inputs, deduplicates, and falls back to claude.
 * See issue #1281.
 *
 * Per CONTRIBUTING.md "no-source-grep" testing standard, prompt + parser
 * behavior is asserted via the install module's exported pure functions
 * (`runtimeMap`, `allRuntimes`, `parseRuntimeInput`, `buildRuntimePromptText`)
 * instead of regexing bin/install.js source text.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  runtimeMap,
  allRuntimes,
  parseRuntimeInput,
  buildRuntimePromptText,
} = require('../bin/install.js');

// Strip ANSI color codes for human-readable assertions on prompt text.
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
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
    assert.deepStrictEqual(parseRuntimeInput('8 11'), ['cursor', 'kilo']);
  });

  test('mixed comma and space separators work', () => {
    assert.deepStrictEqual(parseRuntimeInput('1, 7, 9'), ['claude', 'copilot', 'gemini']);
    assert.deepStrictEqual(parseRuntimeInput('2 , 8'), ['antigravity', 'cursor']);
  });

  test('single choice for hermes', () => {
    assert.deepStrictEqual(parseRuntimeInput('10'), ['hermes']);
  });

  test('single choice for kilo', () => {
    assert.deepStrictEqual(parseRuntimeInput('11'), ['kilo']);
  });

  test('single choice for opencode', () => {
    assert.deepStrictEqual(parseRuntimeInput('12'), ['opencode']);
  });

  test('single choice for qwen', () => {
    assert.deepStrictEqual(parseRuntimeInput('13'), ['qwen']);
  });

  test('single choice for trae', () => {
    assert.deepStrictEqual(parseRuntimeInput('14'), ['trae']);
  });

  test('single choice for windsurf', () => {
    assert.deepStrictEqual(parseRuntimeInput('15'), ['windsurf']);
  });

  test('single choice for grok', () => {
    assert.deepStrictEqual(parseRuntimeInput('16'), ['grok']);
  });

  test('choice 17 returns all runtimes', () => {
    assert.deepStrictEqual(parseRuntimeInput('17'), allRuntimes);
  });

  test('choice 17 returns all runtimes when mixed with separators or other tokens', () => {
    // CR feedback: tokenized inputs that include 17 (e.g. trailing comma, or
    // alongside other choices) must still expand to all-runtimes — previously
    // only the bare "17" matched, so "17," or "17 1" silently installed a
    // subset.
    assert.deepStrictEqual(parseRuntimeInput('17,'), allRuntimes);
    assert.deepStrictEqual(parseRuntimeInput('17 1'), allRuntimes);
    assert.deepStrictEqual(parseRuntimeInput('1,17'), allRuntimes);
    assert.deepStrictEqual(parseRuntimeInput('  17  '), allRuntimes);
  });

  test('empty input defaults to claude', () => {
    assert.deepStrictEqual(parseRuntimeInput(''), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('   '), ['claude']);
  });

  test('invalid choices are ignored, falls back to claude if all invalid', () => {
    assert.deepStrictEqual(parseRuntimeInput('99'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('0'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('abc'), ['claude']);
  });

  test('invalid choices mixed with valid are filtered out', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,99,7'), ['claude', 'copilot']);
    assert.deepStrictEqual(parseRuntimeInput('abc 3 xyz'), ['augment']);
  });

  test('duplicate choices are deduplicated', () => {
    assert.deepStrictEqual(parseRuntimeInput('1,1,1'), ['claude']);
    assert.deepStrictEqual(parseRuntimeInput('7,7,9,9'), ['copilot', 'gemini']);
  });

  test('preserves selection order', () => {
    assert.deepStrictEqual(parseRuntimeInput('9,1,7'), ['gemini', 'claude', 'copilot']);
    assert.deepStrictEqual(parseRuntimeInput('11,2,8'), ['kilo', 'antigravity', 'cursor']);
  });
});

describe('install.js exports multi-select runtime metadata', () => {
  const expectedRuntimeMap = {
    '1': 'claude',
    '2': 'antigravity',
    '3': 'augment',
    '4': 'cline',
    '5': 'codebuddy',
    '6': 'codex',
    '7': 'copilot',
    '8': 'cursor',
    '9': 'gemini',
    '10': 'hermes',
    '11': 'kilo',
    '12': 'opencode',
    '13': 'qwen',
    '14': 'trae',
    '15': 'windsurf',
    '16': 'grok',
  };
  const expectedRuntimes = [
    'claude', 'antigravity', 'augment', 'cline', 'codebuddy', 'codex',
    'copilot', 'cursor', 'gemini', 'hermes', 'kilo', 'opencode', 'qwen',
    'trae', 'windsurf', 'grok',
  ];

  test('runtimeMap exports every option key bound to the right runtime', () => {
    assert.deepStrictEqual(runtimeMap, expectedRuntimeMap,
      'exported runtimeMap matches the canonical option list');
  });

  test('allRuntimes contains every runtime exactly once', () => {
    assert.strictEqual(allRuntimes.length, expectedRuntimes.length);
    for (const rt of expectedRuntimes) {
      assert.ok(allRuntimes.includes(rt), `allRuntimes contains ${rt}`);
    }
    assert.strictEqual(new Set(allRuntimes).size, allRuntimes.length,
      'allRuntimes has no duplicates');
  });

  test('"All" shortcut (option 17) selects every runtime', () => {
    assert.deepStrictEqual(parseRuntimeInput('17'), allRuntimes);
  });

  test('prompt lists Hermes Agent (10), Qwen Code (13), Trae (14), Grok Build (16), and All (17)', () => {
    const prompt = stripAnsi(buildRuntimePromptText());
    assert.ok(/\b10\)\s*Hermes Agent\b/.test(prompt),
      'prompt lists Hermes Agent as option 10');
    assert.ok(/\b13\)\s*Qwen Code\b/.test(prompt),
      'prompt lists Qwen Code as option 13');
    assert.ok(/\b14\)\s*Trae\b/.test(prompt),
      'prompt lists Trae as option 14');
    assert.ok(/\b16\)\s*Grok Build\b/.test(prompt),
      'prompt lists Grok Build as option 16');
    assert.ok(/\b17\)\s*All\b/.test(prompt),
      'prompt lists All as option 17');
  });

  test('prompt text shows multi-select hint', () => {
    const prompt = stripAnsi(buildRuntimePromptText());
    assert.ok(/Select multiple/i.test(prompt),
      'prompt includes multi-select instructions');
  });

  test('parser splits on commas and whitespace and deduplicates', () => {
    // Behavioral assertion: same set of choices in different separators
    // produces the same selection, and duplicates collapse.
    assert.deepStrictEqual(
      parseRuntimeInput('1,7,9'),
      parseRuntimeInput('1 7 9'),
      'comma- and space-separated input yield identical selections'
    );
    assert.deepStrictEqual(parseRuntimeInput('1,1,7,7'), ['claude', 'copilot'],
      'duplicates collapsed in order');
  });
});
