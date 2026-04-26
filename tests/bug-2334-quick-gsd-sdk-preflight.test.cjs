/**
 * Regression test for bug #2334
 *
 * /gsd-quick crashed with `command not found: gsd-sdk` (exit code 127) when
 * the gsd-sdk binary was not installed or not in PATH. The workflow's Step 2
 * called `gsd-sdk query init.quick` directly with no pre-flight check and no
 * fallback, so missing gsd-sdk caused an immediate abort with no helpful message.
 *
 * Fix: Step 2 must check for gsd-sdk in PATH before invoking it. If absent,
 * emit a human-readable error pointing users to the install command.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

// allow-test-rule: source-text-is-the-product
// quick.md is the AI instruction workflow — the `command -v gsd-sdk` guard IS the fix.
// There is no behavioral equivalent: the check runs inside the AI agent, not in gsd-tools.
describe('bug #2334: quick workflow gsd-sdk pre-flight check', () => {
  let content;

  test('workflow file exists', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'workflows/quick.md should exist');
    content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
  });

  test('Step 2 checks for gsd-sdk before invoking it', () => {
    content = content || fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    // The check must appear before the first gsd-sdk invocation in Step 2
    const step2Start = content.indexOf('**Step 2:');
    assert.ok(step2Start !== -1, 'Step 2 must exist in quick workflow');

    const firstSdkCall = content.indexOf('gsd-sdk query init.quick', step2Start);
    assert.ok(firstSdkCall !== -1, 'gsd-sdk query init.quick must be present in Step 2');

    // Find any gsd-sdk availability check between the Step 2 heading and the first call
    const step2Section = content.slice(step2Start, firstSdkCall);
    const hasCommandCheck = step2Section.includes('command -v gsd-sdk') || step2Section.includes('which gsd-sdk');
    assert.ok(
      hasCommandCheck,
      'Step 2 must check for gsd-sdk in PATH (via `command -v gsd-sdk` or `which gsd-sdk`) ' +
      'before calling `gsd-sdk query init.quick`. Without this guard, the workflow crashes ' +
      'with exit code 127 when gsd-sdk is not installed (root cause of #2334).'
    );
  });

  test('pre-flight error message references the install command', () => {
    content = content || fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const step2Start = content.indexOf('**Step 2:');
    const firstSdkCall = content.indexOf('gsd-sdk query init.quick', step2Start);
    const step2Section = content.slice(step2Start, firstSdkCall);

    const hasInstallHint = step2Section.includes('@gsd-build/sdk') || step2Section.includes('gsd-update') || step2Section.includes('/gsd-update');
    assert.ok(
      hasInstallHint,
      'Pre-flight error must include a hint on how to install gsd-sdk (npm install -g @gsd-build/sdk or /gsd-update)'
    );
  });
});
