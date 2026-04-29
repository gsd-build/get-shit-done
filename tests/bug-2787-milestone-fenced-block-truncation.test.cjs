'use strict';

/**
 * Regression test for #2787:
 * extractCurrentMilestone truncates ROADMAP.md at heading-like lines inside
 * fenced code blocks. The nextMilestonePattern regex runs against the raw
 * string with the `m` flag, which matches `^` at every newline — including
 * newlines inside ``` blocks. A line like `# Ops runbook (v1.0 compat)` inside
 * a fence matches the pattern and prematurely sets sectionEnd, hiding all
 * phases defined after the fenced block.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

describe('extractCurrentMilestone — fenced code block boundary (#2787)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('roadmap analyze returns all phases when a fenced block contains a heading-like line matching the milestone-end pattern', () => {
    // ROADMAP.md: milestone v1.1 with 4 phases. Between Phase 2 and Phase 3,
    // a fenced code block contains `# Ops runbook — v1.0 compat`, which
    // matches ^#{1,2}\s+.*v\d+\.\d+ (the nextMilestonePattern) and would
    // prematurely terminate the milestone slice before the fix.
    const roadmap = [
      '# Project Roadmap',
      '',
      '## ✅ v1.0: Foundation',
      '',
      '<details>',
      '<summary>✅ v1.0 Foundation — SHIPPED</summary>',
      '',
      '### Phase 1: Bootstrap',
      '**Goal:** Bootstrap the project',
      '',
      '</details>',
      '',
      '## Roadmap v1.1: New Work',
      '',
      '### Phase 1: Setup',
      '**Goal:** Set up the environment',
      '',
      '### Phase 2: Core Logic',
      '**Goal:** Implement core logic',
      '',
      'Deployment notes:',
      '',
      '```bash',
      '# Ops runbook — v1.0 compat',
      'echo "deploy complete"',
      '```',
      '',
      '### Phase 3: Testing',
      '**Goal:** Write regression tests',
      '',
      '### Phase 4: Deploy',
      '**Goal:** Ship to production',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v1.1\n---\n\n# GSD State\n'
    );

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `roadmap analyze should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(
      output.phase_count,
      4,
      [
        'All 4 phases in the v1.1 milestone section should be found.',
        `Got ${output.phase_count} phase(s): ${JSON.stringify(output.phases?.map(p => p.number))}`,
        'Phases 3 and 4 are likely being cut off by the fenced code block heading match.',
      ].join(' ')
    );
  });

  test('roadmap analyze returns all phases when a fenced block contains a backtick-tilde fence with milestone-like heading', () => {
    // Verify tilde fences (~~~) are also tracked correctly.
    const roadmap = [
      '## Roadmap v2.0: Feature Work',
      '',
      '### Phase 1: Alpha',
      '**Goal:** Alpha release',
      '',
      '~~~markdown',
      '## Prior art (v1.9 snapshot)',
      '~~~',
      '',
      '### Phase 2: Beta',
      '**Goal:** Beta release',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0\n---\n\n# GSD State\n'
    );

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `roadmap analyze should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(
      output.phase_count,
      2,
      [
        'Both phases in the v2.0 milestone section should be found.',
        `Got ${output.phase_count} phase(s).`,
        'Phase 2 is likely being cut off by the tilde-fenced heading match.',
      ].join(' ')
    );
  });

  test('fenced block with info string (e.g. ```js) is not closed by a nested info-string line', () => {
    // A closing fence MUST have only optional trailing spaces — an info string
    // like ```js inside an open fence must NOT close it. Before the fix the
    // regex matched any line starting with ``` regardless of what followed, so
    // a line like "```js" inside the fenced block would toggle fenceChar off
    // and expose the heading-like line that follows to the milestone-end check.
    const roadmap = [
      '## Roadmap v3.0: Info-String Edge Case',
      '',
      '### Phase 1: Setup',
      '**Goal:** First phase',
      '',
      '```text',
      '```js',
      '# This heading-like line (v3.0 compat) must NOT end the milestone',
      '```',
      '',
      '### Phase 2: Core',
      '**Goal:** Second phase',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v3.0\n---\n\n# GSD State\n'
    );

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `roadmap analyze should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(
      output.phase_count,
      2,
      [
        'Both phases should be found; the ```js line inside the fence must not close it.',
        `Got ${output.phase_count} phase(s).`,
      ].join(' ')
    );
  });

  test('roadmap get-phase finds a phase defined after a fenced code block', () => {
    const roadmap = [
      '## Roadmap v1.1: New Work',
      '',
      '### Phase 1: Setup',
      '**Goal:** Bootstrap',
      '',
      '```bash',
      '# Runbook for v1.0 deploy',
      '```',
      '',
      '### Phase 2: Core',
      '**Goal:** Core implementation',
    ].join('\n');

    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v1.1\n---\n\n# GSD State\n'
    );

    const result = runGsdTools('roadmap get-phase 2', tmpDir);
    assert.ok(result.success, `roadmap get-phase should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.found,
      [
        'Phase 2 should be found even though it comes after a fenced code block.',
        `Got: found=${output.found}`,
      ].join(' ')
    );
    assert.strictEqual(output.phase_number, '2', 'should return phase number 2');
  });
});
