const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { evaluatePrTemplate, allPathsAreTooling, hasExemptMarker, TOOLING_PATH_ALLOWLIST, EXEMPT_MARKER_REGEX } = require('../scripts/pr-template-policy.cjs');

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

describe('pr-template-policy carve-out', () => {
  // A. Path-scope auto-skip — CI-only PR is accepted
  test('auto-skips enforcement for CI-only changed files', () => {
    const result = evaluatePrTemplate('This is a CI change with no template.', 'NONE', ['.github/workflows/test.yml']);
    assert.equal(result.valid, true);
    assert.equal(result.action, 'pass');
    assert.equal(result.skipped, 'tooling-paths');
  });

  // B. Path-scope auto-skip — docs-only PR is accepted
  test('auto-skips enforcement for docs-only changed files', () => {
    const result = evaluatePrTemplate('Updated documentation.', 'NONE', ['docs/CONFIGURATION.md', 'README.md']);
    assert.equal(result.valid, true);
    assert.equal(result.action, 'pass');
    assert.equal(result.skipped, 'tooling-paths');
  });

  // C. Path-scope auto-skip — dependency-bump PR is accepted
  test('auto-skips enforcement for dependency-bump changed files', () => {
    const result = evaluatePrTemplate('Bump deps.', 'NONE', ['package.json', 'package-lock.json']);
    assert.equal(result.valid, true);
    assert.equal(result.action, 'pass');
    assert.equal(result.skipped, 'tooling-paths');
  });

  // D. Path-scope auto-skip is path-strict — mixed PR still enforced
  test('does NOT skip enforcement when any changed file is outside the tooling allowlist', () => {
    const result = evaluatePrTemplate('Mixed change.', 'NONE', ['.github/workflows/test.yml', 'src/feature.ts']);
    assert.equal(result.valid, false);
    assert.equal(result.action, 'close');
  });

  // E. Explicit marker accepted (non-empty reason)
  test('auto-skips enforcement when PR body contains a valid exempt marker with a reason', () => {
    const body = '<!-- pr-template-exempt: dropping node 26 lane -->\n\nThis removes the Node 26 CI lane.';
    const result = evaluatePrTemplate(body, 'NONE', ['src/anything.ts']);
    assert.equal(result.valid, true);
    assert.equal(result.action, 'pass');
    assert.equal(result.skipped, 'exempt-marker');
  });

  // F. Explicit marker requires non-empty reason
  test('does NOT skip enforcement when exempt marker has an empty reason', () => {
    const bodyEmpty = '<!-- pr-template-exempt:  -->\n\nSome description.';
    const bodyNoReason = '<!-- pr-template-exempt: -->\n\nSome description.';
    const r1 = evaluatePrTemplate(bodyEmpty, 'NONE', ['src/anything.ts']);
    const r2 = evaluatePrTemplate(bodyNoReason, 'NONE', ['src/anything.ts']);
    assert.equal(r1.valid, false);
    assert.equal(r2.valid, false);
  });

  // G. Regression — DEFAULT_TEMPLATE_MARKERS still rejected
  test('regression: DEFAULT_TEMPLATE_MARKERS body is still rejected when no carve-out applies', () => {
    const body = 'Wrong template — please use a typed template.\n\nEvery PR must use a typed template.';
    const result = evaluatePrTemplate(body, 'NONE', ['src/feature.ts']);
    assert.equal(result.valid, false);
    assert.match(result.reason, /default wrong-template guidance/);
  });

  // H. Regression — fix template still accepted
  test('regression: fix template PR body is still accepted', () => {
    const result = evaluatePrTemplate(fixBody, 'NONE', ['src/feature.ts']);
    assert.equal(result.valid, true);
    assert.equal(result.action, 'pass');
    assert.equal(result.template, 'fix');
  });
});

describe('pr-template-policy helper: allPathsAreTooling', () => {
  test('returns true when all paths match the allowlist', () => {
    assert.equal(allPathsAreTooling(['.github/workflows/ci.yml'], TOOLING_PATH_ALLOWLIST), true);
    assert.equal(allPathsAreTooling(['package.json', 'package-lock.json'], TOOLING_PATH_ALLOWLIST), true);
    assert.equal(allPathsAreTooling(['README.md'], TOOLING_PATH_ALLOWLIST), true);
  });

  test('returns false when any path does not match the allowlist', () => {
    assert.equal(allPathsAreTooling(['.github/workflows/ci.yml', 'src/index.ts'], TOOLING_PATH_ALLOWLIST), false);
  });

  test('returns false for an empty file list', () => {
    assert.equal(allPathsAreTooling([], TOOLING_PATH_ALLOWLIST), false);
  });
});

describe('pr-template-policy helper: hasExemptMarker', () => {
  test('matches a marker with a non-empty reason', () => {
    assert.equal(hasExemptMarker('<!-- pr-template-exempt: ci -->', EXEMPT_MARKER_REGEX), true);
    assert.equal(hasExemptMarker('<!-- pr-template-exempt: dropping node 26 lane -->', EXEMPT_MARKER_REGEX), true);
    assert.equal(hasExemptMarker('<!-- pr-template-exempt: drop node-26 lane -->', EXEMPT_MARKER_REGEX), true);
  });

  test('does not match a marker with empty or whitespace-only reason', () => {
    assert.equal(hasExemptMarker('<!-- pr-template-exempt:  -->', EXEMPT_MARKER_REGEX), false);
    assert.equal(hasExemptMarker('<!-- pr-template-exempt: -->', EXEMPT_MARKER_REGEX), false);
  });

  test('does not match a marker with no pr-template-exempt keyword', () => {
    assert.equal(hasExemptMarker('<!-- gsd-pr-template-policy -->', EXEMPT_MARKER_REGEX), false);
    assert.equal(hasExemptMarker('some random text', EXEMPT_MARKER_REGEX), false);
  });
});

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

  test('does not flag default-template marker phrase inside a valid enhancement template', () => {
    const body = enhancementBody.replace(
      '## Linked Issue',
      [
        '> **Using the wrong template?**',
        '> - Bug fix: use [fix.md](?template=fix.md)',
        '> - New feature: use [feature.md](?template=feature.md)',
        '',
        '## Linked Issue',
      ].join('\n'),
    );
    const result = evaluatePrTemplate(body, 'COLLABORATOR');

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
