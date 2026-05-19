'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REVIEW_WORKFLOW = path.join(
  __dirname,
  '..',
  'get-shit-done',
  'workflows',
  'review.md'
);

describe('review workflow prompt-budget dedup', () => {
  test('shared budget-trim helper exists and each local backend calls it', () => {
    const src = fs.readFileSync(REVIEW_WORKFLOW, 'utf8');

    assert.ok(
      src.includes('prepare_trimmed_prompt_for_reviewer()'),
      'expected shared prepare_trimmed_prompt_for_reviewer helper'
    );
    assert.ok(
      src.includes('prepare_trimmed_prompt_for_reviewer "ollama"'),
      'expected ollama to call shared trim helper'
    );
    assert.ok(
      src.includes('prepare_trimmed_prompt_for_reviewer "lm_studio"'),
      'expected lm_studio to call shared trim helper'
    );
    assert.ok(
      src.includes('prepare_trimmed_prompt_for_reviewer "llama_cpp"'),
      'expected llama_cpp to call shared trim helper'
    );
  });
});

