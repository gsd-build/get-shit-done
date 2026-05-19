'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CJS_PROMPT_BUDGET = path.join(
  __dirname,
  '..',
  'get-shit-done',
  'bin',
  'lib',
  'prompt-budget.cjs'
);
const SDK_PROMPT_BUDGET = path.join(
  __dirname,
  '..',
  'sdk',
  'src',
  'query',
  'prompt-budget.ts'
);

function countOccurrences(haystack, needle) {
  const parts = haystack.split(needle);
  return parts.length - 1;
}

describe('prompt-budget hotpath optimizer guards', () => {
  test('headShrink avoids full text split arrays', () => {
    const cjsSrc = fs.readFileSync(CJS_PROMPT_BUDGET, 'utf8');
    const sdkSrc = fs.readFileSync(SDK_PROMPT_BUDGET, 'utf8');

    assert.equal(cjsSrc.includes("text.split('\\n')"), false, 'cjs headShrink should avoid split');
    assert.equal(sdkSrc.includes("text.split('\\n')"), false, 'sdk headShrink should avoid split');
  });

  test('budget accounting avoids repeated computeBaseTokens rescans', () => {
    const cjsSrc = fs.readFileSync(CJS_PROMPT_BUDGET, 'utf8');
    const sdkSrc = fs.readFileSync(SDK_PROMPT_BUDGET, 'utf8');

    assert.equal(
      countOccurrences(cjsSrc, 'computeBaseTokens()'),
      0,
      'cjs should use incremental token accounting instead of repeated computeBaseTokens()'
    );
    assert.equal(
      countOccurrences(sdkSrc, 'computeBaseTokens()'),
      0,
      'sdk should use incremental token accounting instead of repeated computeBaseTokens()'
    );
  });
});

