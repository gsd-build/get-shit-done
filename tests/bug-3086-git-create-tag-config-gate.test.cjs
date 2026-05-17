// allow-test-rule: workflow-markdown-is-the-runtime-contract
// Justification: complete-milestone.md IS the runtime — the agent reads and
// follows it directly. Asserting the <config-check> block is present in the
// markdown is the only way to verify the gate is wired. Per CONTEXT.md L611.
'use strict';

/**
 * #3086 — git.create_tag config gate for milestone tagging.
 *
 * Tests:
 *   A. Default value: fresh project returns `true` for git.create_tag
 *   B. config-set false → config-get returns false
 *   C. Invalid value (e.g. "maybe") is rejected by schema validator
 *   D. complete-milestone.md workflow contains the <config-check> gate for git.create_tag
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  'get-shit-done',
  'workflows',
  'complete-milestone.md',
);

describe('#3086: git.create_tag config key', () => {
  test('A. fresh project: config-get git.create_tag returns true (default)', (t) => {
    const tmpDir = createTempProject('gsd-3086-default-');
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(['config-get', 'git.create_tag'], tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `config-get git.create_tag failed:\n${result.error}`);
    assert.strictEqual(
      result.output.trim(),
      'true',
      `Expected default value 'true', got: '${result.output.trim()}'`,
    );
  });

  test('B. config-set git.create_tag false → config-get returns false', (t) => {
    const tmpDir = createTempProject('gsd-3086-set-false-');
    t.after(() => cleanup(tmpDir));

    const setResult = runGsdTools(['config-set', 'git.create_tag', 'false'], tmpDir, {
      HOME: tmpDir,
    });
    assert.ok(setResult.success, `config-set git.create_tag false failed:\n${setResult.error}`);

    const getResult = runGsdTools(['config-get', 'git.create_tag'], tmpDir, { HOME: tmpDir });
    assert.ok(getResult.success, `config-get after set failed:\n${getResult.error}`);
    assert.strictEqual(
      getResult.output.trim(),
      'false',
      `Expected 'false' after set, got: '${getResult.output.trim()}'`,
    );
  });

  test('C. config-set git.create_tag with invalid value "maybe" is rejected', (t) => {
    const tmpDir = createTempProject('gsd-3086-invalid-');
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(['config-set', 'git.create_tag', 'maybe'], tmpDir, {
      HOME: tmpDir,
    });
    assert.ok(
      !result.success,
      `Expected config-set to fail for invalid value "maybe", but it succeeded`,
    );
  });

  test('D. complete-milestone.md contains <config-check> gate for git.create_tag', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.ok(
      content.includes('git.create_tag'),
      'complete-milestone.md must reference git.create_tag in a <config-check> block',
    );
    assert.ok(
      content.includes('<config-check>'),
      'complete-milestone.md must have a <config-check> block in the git_tag step',
    );
  });
});
