'use strict';

/**
 * Regression tests for config key bugs:
 * #2530 — workflow._auto_chain_active is internal state, must not be in VALID_CONFIG_KEYS
 * #2531 — hooks.workflow_guard is used by hook and documented but missing from VALID_CONFIG_KEYS
 * #2532 — workflow.ui_review is used in autonomous.md but missing from VALID_CONFIG_KEYS
 * #2533 — workflow.max_discuss_passes is used in discuss-phase.md but missing from VALID_CONFIG_KEYS
 * #2535 — sub_repos and plan_checker legacy keys need CONFIG_KEY_SUGGESTIONS migration hints
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config-schema.cjs');

describe('VALID_CONFIG_KEYS correctness', () => {
  test('#2530: workflow._auto_chain_active must not be in VALID_CONFIG_KEYS (internal state)', () => {
    assert.ok(
      !VALID_CONFIG_KEYS.has('workflow._auto_chain_active'),
      'workflow._auto_chain_active is internal runtime state and must not be user-settable'
    );
  });

  test('#2531: hooks.workflow_guard must be in VALID_CONFIG_KEYS (used by hook, documented)', () => {
    assert.ok(
      VALID_CONFIG_KEYS.has('hooks.workflow_guard'),
      'hooks.workflow_guard is read by gsd-workflow-guard.js hook and documented in CONFIGURATION.md'
    );
  });

  test('#2532: workflow.ui_review must be in VALID_CONFIG_KEYS (used in autonomous.md)', () => {
    assert.ok(
      VALID_CONFIG_KEYS.has('workflow.ui_review'),
      'workflow.ui_review is read in autonomous.md via gsd-sdk query config-get'
    );
  });

  test('#2533: workflow.max_discuss_passes must be in VALID_CONFIG_KEYS (used in discuss-phase.md)', () => {
    assert.ok(
      VALID_CONFIG_KEYS.has('workflow.max_discuss_passes'),
      'workflow.max_discuss_passes is read in discuss-phase.md via gsd-sdk query config-get'
    );
  });
});

describe('CONFIG_KEY_SUGGESTIONS migration hints (#2535)', () => {
  let tmpDir;

  test('config-set sub_repos emits "Did you mean planning.sub_repos?" suggestion', (t) => {
    tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(['config-set', 'sub_repos', '[]'], tmpDir);
    assert.ok(!result.success, 'config-set sub_repos should fail');
    const combined = result.error + result.output;
    assert.ok(
      combined.includes('Did you mean') && combined.includes('planning.sub_repos'),
      `Expected "Did you mean planning.sub_repos?" in error, got:\nstdout: ${result.output}\nstderr: ${result.error}`
    );
  });

  test('config-set plan_checker emits "Did you mean workflow.plan_check?" suggestion', (t) => {
    tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(['config-set', 'plan_checker', 'true'], tmpDir);
    assert.ok(!result.success, 'config-set plan_checker should fail');
    const combined = result.error + result.output;
    assert.ok(
      combined.includes('Did you mean') && combined.includes('workflow.plan_check'),
      `Expected "Did you mean workflow.plan_check?" in error, got:\nstdout: ${result.output}\nstderr: ${result.error}`
    );
  });
});
