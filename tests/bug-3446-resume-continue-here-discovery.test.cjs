'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('bug #3446: resume-project detects non-phase and legacy continue-here handoffs', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'resume-project.md');
  const workflowContent = fs.readFileSync(workflowPath, 'utf8');

  function readCheckBlock() {
    const stepStart = workflowContent.indexOf('<step name="check_incomplete_work">');
    const stepEnd = workflowContent.indexOf('</step>', stepStart);
    return workflowContent.slice(stepStart, stepEnd);
  }

  // Bug #3446 originally enforced three text invariants on a chained `ls` of
  // bare globs. Bug #3689 replaced that chain with two `find` invocations
  // because the chained ls aborted under zsh's default NOMATCH option,
  // silently dropping every pattern after the first miss. These tests now
  // assert that the same three discovery contracts are still satisfied by
  // the find-based scan.

  test('check_incomplete_work scans .planning-root continue-here fallback (depth 1 under .planning)', () => {
    const block = readCheckBlock();
    assert.match(
      block,
      /find \.planning -maxdepth 3 -name '\.continue-here\*\.md'/,
      'resume workflow must scan .planning/.continue-here*.md fallback path written by pause-work; the find .planning -maxdepth 3 invocation covers it at depth 1'
    );
  });

  test('check_incomplete_work scans sketch subdirectory continue-here checkpoints (depth 3 under .planning)', () => {
    const block = readCheckBlock();
    // .planning/sketches/SKETCH-NNN/.continue-here*.md sits at depth 3 from
    // the .planning starting point. The find call must use maxdepth >= 3.
    const findMatch = block.match(/find \.planning -maxdepth (\d+) -name '\.continue-here\*\.md'/);
    assert.ok(findMatch, 'resume workflow must use find .planning -maxdepth N -name .continue-here*.md');
    const depth = Number(findMatch[1]);
    assert.ok(
      depth >= 3,
      `resume workflow .planning find must use -maxdepth 3 or greater to reach sketch/spike/deliberation subdirectories; got -maxdepth ${depth}`
    );
  });

  test('check_incomplete_work scans legacy repo-root continue-here fallback', () => {
    const block = readCheckBlock();
    assert.match(
      block,
      /find \. -maxdepth 1 -name '\.continue-here\*\.md'/,
      'resume workflow must scan legacy repo-root .continue-here*.md handoff path via a separate find . -maxdepth 1 invocation'
    );
  });
});
