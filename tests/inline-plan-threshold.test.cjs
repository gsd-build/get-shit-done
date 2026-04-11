/**
 * Tests for workflow.inline_plan_threshold config key and routing logic (#1979).
 *
 * Verifies:
 * 1. The config key is accepted by config-set (VALID_CONFIG_KEYS contains it)
 * 2. The key is documented in planning-config.md
 * 3. The execute-plan.md routing instruction uses the correct grep pattern
 *    (matches <task at any indentation, since PLAN.md templates differ)
 * 4. The workflow guards threshold=0 to disable inline routing
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const repoRoot = path.resolve(__dirname, '..');
const executePlanPath = path.join(repoRoot, 'get-shit-done', 'workflows', 'execute-plan.md');
const planningConfigPath = path.join(repoRoot, 'get-shit-done', 'references', 'planning-config.md');
const configCjsPath = path.join(repoRoot, 'get-shit-done', 'bin', 'lib', 'config.cjs');

describe('inline_plan_threshold config key (#1979)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-set accepts workflow.inline_plan_threshold', () => {
    const result = runGsdTools('config-set workflow.inline_plan_threshold 3', tmpDir);
    assert.ok(result.success, `config-set should accept workflow.inline_plan_threshold: ${result.error}`);
  });

  test('config-set accepts threshold=0 to disable inline routing', () => {
    const result = runGsdTools('config-set workflow.inline_plan_threshold 0', tmpDir);
    assert.ok(result.success, `config-set should accept 0: ${result.error}`);
  });

  test('VALID_CONFIG_KEYS in config.cjs contains workflow.inline_plan_threshold', () => {
    const content = fs.readFileSync(configCjsPath, 'utf-8');
    assert.match(
      content,
      /['"]workflow\.inline_plan_threshold['"]/,
      'workflow.inline_plan_threshold must be in VALID_CONFIG_KEYS'
    );
  });

  test('planning-config.md documents workflow.inline_plan_threshold', () => {
    const content = fs.readFileSync(planningConfigPath, 'utf-8');
    assert.match(
      content,
      /workflow\.inline_plan_threshold/,
      'planning-config.md must document workflow.inline_plan_threshold'
    );
  });
});

describe('execute-plan.md routing instruction (#1979)', () => {
  test('grep pattern matches <task at any indentation level', () => {
    const content = fs.readFileSync(executePlanPath, 'utf-8');

    // The new pattern should use \s* for leading whitespace, not ^ anchor alone
    // Must match both "<task type=" (unindented) and "  <task type=" (indented)
    assert.match(
      content,
      /TASK_COUNT=\$\(grep -cE '\^\\s\*<task/,
      'grep pattern must allow any leading whitespace before <task'
    );
  });

  test('inline routing is guarded by INLINE_THRESHOLD > 0', () => {
    const content = fs.readFileSync(executePlanPath, 'utf-8');
    assert.match(
      content,
      /INLINE_THRESHOLD\s*>\s*0.*TASK_COUNT\s*<=\s*INLINE_THRESHOLD/s,
      'inline routing must be guarded by INLINE_THRESHOLD > 0 so threshold=0 disables it'
    );
  });

  test('grep pattern does NOT use ^<task alone (would miss indented tasks)', () => {
    const content = fs.readFileSync(executePlanPath, 'utf-8');
    // The old buggy pattern: grep -c "^<task" with no whitespace allowance
    const buggyPattern = /grep -c "\^<task"/;
    assert.doesNotMatch(
      content,
      buggyPattern,
      'must not use the buggy "^<task" pattern which misses indented tasks'
    );
  });

  test('grep pattern matches real-world indented task formats', () => {
    // Simulate how the grep pattern would behave against sample PLAN.md content
    // Extract the pattern from execute-plan.md
    const content = fs.readFileSync(executePlanPath, 'utf-8');
    const patternMatch = content.match(/TASK_COUNT=\$\(grep -cE '([^']+)'/);
    assert.ok(patternMatch, 'must find TASK_COUNT grep pattern');

    const regexSource = patternMatch[1].replace(/\\s/g, '\\s').replace(/\[\[:space:\]>\]/, '[\\s>]');
    const re = new RegExp(regexSource, 'gm');

    // Test cases: should match all of these as single tasks
    const samples = [
      '<task type="auto">',
      '  <task type="auto">',
      '    <task type="checkpoint:decision">',
      '\t<task type="auto">',
    ];
    for (const sample of samples) {
      const matches = sample.match(re);
      assert.ok(matches && matches.length > 0, `Pattern must match: ${JSON.stringify(sample)}`);
    }

    // Non-task lines should not match
    const nonMatches = [
      '<tasks>',
      '</task>',
      '// <task comment',
    ];
    for (const sample of nonMatches) {
      const matches = sample.match(re);
      assert.ok(!matches || matches.length === 0, `Pattern must NOT match: ${JSON.stringify(sample)}`);
    }
  });
});
