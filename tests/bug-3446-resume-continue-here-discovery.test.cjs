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

  test('check_incomplete_work scans .planning-root continue-here fallback', () => {
    const block = readCheckBlock();
    assert.match(
      block,
      /\.planning\/\.continue-here\*\.md/,
      'resume workflow must scan .planning/.continue-here*.md fallback path written by pause-work'
    );
  });

  test('check_incomplete_work scans sketch subdirectory continue-here checkpoints', () => {
    const block = readCheckBlock();
    assert.match(
      block,
      /\.planning\/sketches\/\*\/\.continue-here\*\.md/,
      'resume workflow must scan .planning/sketches/*/.continue-here*.md for sketch checkpoint handoffs'
    );
  });

  test('check_incomplete_work scans legacy repo-root continue-here fallback', () => {
    const block = readCheckBlock();
    assert.match(
      block,
      /\s\.continue-here\*\.md/,
      'resume workflow must scan legacy repo-root .continue-here*.md handoff path'
    );
  });
});
