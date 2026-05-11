const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { evaluatePrTemplate } = require('../scripts/pr-template-policy.cjs');

const fixBody = [
  '## Fix PR',
  '',
  '## Linked Issue',
  'Fixes #123',
  '',
  '## What was broken',
  'The thing was broken.',
  '',
  '## What this fix does',
  'The thing now works.',
  '',
  '## Root cause',
  'A missing guard.',
  '',
  '## Testing',
  'node --test tests/example.test.cjs',
  '',
  '## Checklist',
  '- [x] Issue linked above with `Fixes #NNN`',
].join('\n');

const enhancementBody = [
  '## Enhancement PR',
  '',
  '## Linked Issue',
  'Closes #123',
  '',
  '## What this enhancement improves',
  'Existing output.',
  '',
  '## Before / After',
  '**Before:** noisy',
  '**After:** clear',
  '',
  '## How it was implemented',
  'Small refactor.',
  '',
  '## Testing',
  'node --test tests/example.test.cjs',
  '',
  '## Scope confirmation',
  '- [x] Matches approved issue.',
  '',
  '## Checklist',
  '- [x] Tests pass',
].join('\n');

const featureBody = [
  '## Feature PR',
  '',
  '## Linked Issue',
  'Closes #123',
  '',
  '## Feature summary',
  'Adds a new thing.',
  '',
  '## What changed',
  '### New files',
  'None.',
  '### Modified files',
  'One file.',
  '',
  '## Implementation notes',
  'Implemented as approved.',
  '',
  '## Spec compliance',
  '- [x] Criterion met',
  '',
  '## Testing',
  'node --test tests/example.test.cjs',
  '',
  '## Scope confirmation',
  '- [x] Exact scope.',
  '',
  '## Checklist',
  '- [x] Tests pass',
].join('\n');

describe('pr-template-policy', () => {
  test('passes PR bodies that use the fix template', () => {
    const result = evaluatePrTemplate(fixBody, 'NONE');

    assert.equal(result.valid, true);
    assert.equal(result.action, 'pass');
    assert.equal(result.template, 'fix');
  });

  test('passes PR bodies that use the enhancement template', () => {
    const result = evaluatePrTemplate(enhancementBody, 'FIRST_TIMER');

    assert.equal(result.valid, true);
    assert.equal(result.action, 'pass');
    assert.equal(result.template, 'enhancement');
  });

  test('passes PR bodies that use the feature template', () => {
    const result = evaluatePrTemplate(featureBody, 'FIRST_TIME_CONTRIBUTOR');

    assert.equal(result.valid, true);
    assert.equal(result.action, 'pass');
    assert.equal(result.template, 'feature');
  });

  test('closes first-time PRs that keep the default template', () => {
    const result = evaluatePrTemplate([
      '## Wrong template - please use the correct one for your PR type',
      '',
      'Every PR must use a typed template.',
    ].join('\n'), 'FIRST_TIMER');

    assert.equal(result.valid, false);
    assert.equal(result.action, 'close');
    assert.equal(result.trusted, false);
    assert.match(result.reason, /default wrong-template guidance/);
  });

  test('warns contributors instead of closing when the template is missing', () => {
    const result = evaluatePrTemplate('This is a free-form PR body.', 'CONTRIBUTOR');

    assert.equal(result.valid, false);
    assert.equal(result.action, 'warn');
    assert.equal(result.trusted, true);
  });

  test('warns collaborators, members, and owners instead of closing', () => {
    for (const association of ['COLLABORATOR', 'MEMBER', 'OWNER']) {
      const result = evaluatePrTemplate('This is a free-form PR body.', association);

      assert.equal(result.valid, false);
      assert.equal(result.action, 'warn');
      assert.equal(result.trusted, true);
    }
  });

  test('does not close for an unfilled issue slug when the template is present', () => {
    const body = fixBody.replace('Fixes #123', 'Fixes #');
    const result = evaluatePrTemplate(body, 'FIRST_TIMER');

    assert.equal(result.valid, true);
    assert.equal(result.action, 'pass');
    assert.equal(result.template, 'fix');
  });

  test('closes first-time PRs that remove required template sections', () => {
    const result = evaluatePrTemplate(fixBody.replace('## What was broken', '## Background'), 'NONE');

    assert.equal(result.valid, false);
    assert.equal(result.action, 'close');
    assert.deepEqual(result.missingHeadings, ['What was broken']);
  });

  test('closes first-time PRs with empty body', () => {
    const result = evaluatePrTemplate('', 'FIRST_TIMER');

    assert.equal(result.valid, false);
    assert.equal(result.action, 'close');
    assert.match(result.reason, /PR body is empty; a typed pull request template is required\./);
  });

  test('warns trusted contributors with empty body', () => {
    const result = evaluatePrTemplate('', 'CONTRIBUTOR');

    assert.equal(result.valid, false);
    assert.equal(result.action, 'warn');
    assert.equal(result.trusted, true);
    assert.match(result.reason, /PR body is empty; a typed pull request template is required\./);
  });
});
