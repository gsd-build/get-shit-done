'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SDK_PROMPT_BUDGET = path.join(
  __dirname,
  '..',
  'sdk',
  'src',
  'query',
  'prompt-budget.ts'
);
const GSD_TOOLS = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

function between(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start);
  if (start === -1 || end === -1) return '';
  return text.slice(start, end);
}

describe('prompt-budget io optimizer guards', () => {
  test('sdk prompt-budget path uses async fs instead of sync read/write checks', () => {
    const src = fs.readFileSync(SDK_PROMPT_BUDGET, 'utf8');

    assert.ok(
      src.includes("from 'node:fs/promises'"),
      'expected sdk prompt-budget to import node:fs/promises'
    );
    assert.ok(!src.includes('readFileSync('), 'sdk should not use readFileSync in prompt-budget');
    assert.ok(!src.includes('writeFileSync('), 'sdk should not use writeFileSync in prompt-budget');
    assert.ok(!src.includes('existsSync('), 'sdk should not use existsSync in prompt-budget');
  });

  test('gsd-tools prompt-budget case avoids sync exists/read/write io', () => {
    const src = fs.readFileSync(GSD_TOOLS, 'utf8');
    const block = between(src, "case 'prompt-budget':", '\n\n    default: {');

    assert.ok(block.length > 0, 'expected prompt-budget case block');
    assert.ok(!block.includes('readFileSync('), 'prompt-budget case should not use readFileSync');
    assert.ok(!block.includes('writeFileSync('), 'prompt-budget case should not use writeFileSync');
    assert.ok(!block.includes('existsSync('), 'prompt-budget case should not use existsSync');
  });
});

