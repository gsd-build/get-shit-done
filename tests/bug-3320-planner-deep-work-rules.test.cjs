'use strict';

// allow-test-rule: source-text-is-product [#3320]
// The bug is a contradiction in prompt/workflow source text. These assertions
// intentionally pin the contract words that planner agents consume.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLANNER_AGENT = path.join(ROOT, 'agents', 'gsd-planner.md');
const PLAN_PHASE_WORKFLOW = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractDeepWorkRules() {
  const workflow = fs.readFileSync(PLAN_PHASE_WORKFLOW, 'utf8');
  const match = workflow.match(/<deep_work_rules>[\s\S]*?<\/deep_work_rules>/);
  assert.ok(match, 'plan-phase.md must contain a deep_work_rules block');
  return match[0];
}

describe('bug #3320 planner action contract', () => {
  test('planner agent explicitly keeps implementation code out of action blocks', () => {
    const planner = fs.readFileSync(PLANNER_AGENT, 'utf8');

    assert.match(
      planner,
      /NEVER place fenced code blocks \(```\) inside `<action>`/,
      'gsd-planner.md must explicitly forbid fenced implementation code in <action>'
    );
    assert.match(
      planner,
      /Code excerpts belong in `<read_first>` source files or referenced context/,
      'gsd-planner.md must route code excerpts to context/read-first material'
    );
  });

  test('plan-phase deep_work_rules no longer requires self-sufficient code dumps', () => {
    const deepWorkRules = extractDeepWorkRules();

    assert.doesNotMatch(
      deepWorkRules,
      /copy them into the action verbatim/,
      'deep_work_rules must not tell planners to copy source material verbatim into <action>'
    );
    assert.doesNotMatch(
      deepWorkRules,
      /complete the task from the action text alone/,
      'deep_work_rules must not make <action> self-sufficient without read_first/context'
    );
    assert.match(
      deepWorkRules,
      /Do not include full file contents, fenced code blocks, or complete implementations in `<action>`/,
      'deep_work_rules must explicitly bound concrete values to avoid code dumping'
    );
  });

  test('plan-phase acceptance criteria allow behavior and test assertions', () => {
    const deepWorkRules = extractDeepWorkRules();

    assert.match(
      deepWorkRules,
      /behavior assertion/,
      'acceptance criteria must allow behavior assertions, not just grep checks'
    );
    assert.match(
      deepWorkRules,
      /test command/,
      'acceptance criteria must allow test-command assertions'
    );
  });

  test('quality gate matches the reconciled planner contract', () => {
    const workflow = read('get-shit-done/workflows/plan-phase.md');

    assert.match(
      workflow,
      /Every task has `<acceptance_criteria>` with behavior, test-command, CLI, or source assertions/,
      'quality gate must not narrow acceptance criteria back to grep-only checks'
    );
    assert.match(
      workflow,
      /Every `<action>` contains concrete identifiers without fenced code blocks or full implementations/,
      'quality gate must enforce concrete prose without implementation dumps'
    );
  });
});
