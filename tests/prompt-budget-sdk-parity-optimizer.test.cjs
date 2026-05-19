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

describe('prompt-budget sdk parity (optimizer)', () => {
  test('trim order keeps plan truncation ahead of context/research drops', () => {
    const src = fs.readFileSync(SDK_PROMPT_BUDGET, 'utf8');

    const planIdx = src.indexOf('// Trim step 2: proportional plan truncation');
    const contextIdx = src.indexOf('// Trim step 3: drop context');
    const researchIdx = src.indexOf('// Trim step 4: drop research');

    assert.ok(planIdx > -1, 'expected step 2 proportional plan truncation marker');
    assert.ok(contextIdx > -1, 'expected step 3 context drop marker');
    assert.ok(researchIdx > -1, 'expected step 4 research drop marker');
    assert.ok(
      planIdx < contextIdx && contextIdx < researchIdx,
      'expected trim order: plan truncation -> context drop -> research drop'
    );
  });

  test('final over-budget hard-fail guard is present', () => {
    const src = fs.readFileSync(SDK_PROMPT_BUDGET, 'utf8');

    assert.match(
      src,
      /if\s*\(\s*estimatedTokens\s*>\s*effectiveBudget\s*\)/,
      'expected final estimatedTokens > effectiveBudget guard'
    );
  });
});

