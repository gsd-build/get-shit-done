'use strict';

/**
 * Enum validation for code_quality.fallow.scope and code_quality.fallow.profile.
 *
 * Fixes H5 from #3424 review: config-set silently accepted invalid enum values
 * (e.g. scope=fullrepo) and fell through to default behavior. This test asserts
 * that invalid values are rejected with a helpful error, and valid values pass.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

describe('feat-3210 / H5: enum validation for code_quality.fallow.scope and .profile', () => {
  // --- code_quality.fallow.scope ---

  test('config-set code_quality.fallow.scope=fullrepo is REJECTED with helpful error', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'code_quality.fallow.scope', 'fullrepo'],
      tmpDir
    );
    assert.ok(
      !result.success,
      'config-set code_quality.fallow.scope=fullrepo must fail, but it succeeded'
    );
    const combined = (result.output || '') + (result.error || '');
    assert.ok(
      combined.includes('phase') && combined.includes('repo'),
      `Error message must mention valid values "phase" and "repo", got: ${combined}`
    );
  });

  test('config-set code_quality.fallow.scope=phase is ACCEPTED', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'code_quality.fallow.scope', 'phase'],
      tmpDir
    );
    assert.ok(
      result.success,
      [
        'config-set code_quality.fallow.scope=phase must succeed,',
        'stdout: ' + result.output,
        'stderr: ' + result.error,
      ].join('\n')
    );
  });

  test('config-set code_quality.fallow.scope=repo is ACCEPTED', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'code_quality.fallow.scope', 'repo'],
      tmpDir
    );
    assert.ok(
      result.success,
      [
        'config-set code_quality.fallow.scope=repo must succeed,',
        'stdout: ' + result.output,
        'stderr: ' + result.error,
      ].join('\n')
    );
  });

  test('config-set code_quality.fallow.scope=PHASE (wrong case) is REJECTED', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'code_quality.fallow.scope', 'PHASE'],
      tmpDir
    );
    assert.ok(
      !result.success,
      'config-set code_quality.fallow.scope=PHASE must fail (values are case-sensitive)'
    );
  });

  // --- code_quality.fallow.profile ---

  test('config-set code_quality.fallow.profile=aggressive is REJECTED with helpful error', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'code_quality.fallow.profile', 'aggressive'],
      tmpDir
    );
    assert.ok(
      !result.success,
      'config-set code_quality.fallow.profile=aggressive must fail, but it succeeded'
    );
    const combined = (result.output || '') + (result.error || '');
    assert.ok(
      combined.includes('minimal') && combined.includes('standard') && combined.includes('strict'),
      `Error message must mention valid values "minimal", "standard", "strict", got: ${combined}`
    );
  });

  test('config-set code_quality.fallow.profile=minimal is ACCEPTED', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'code_quality.fallow.profile', 'minimal'],
      tmpDir
    );
    assert.ok(
      result.success,
      [
        'config-set code_quality.fallow.profile=minimal must succeed,',
        'stdout: ' + result.output,
        'stderr: ' + result.error,
      ].join('\n')
    );
  });

  test('config-set code_quality.fallow.profile=standard is ACCEPTED', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'code_quality.fallow.profile', 'standard'],
      tmpDir
    );
    assert.ok(
      result.success,
      [
        'config-set code_quality.fallow.profile=standard must succeed,',
        'stdout: ' + result.output,
        'stderr: ' + result.error,
      ].join('\n')
    );
  });

  test('config-set code_quality.fallow.profile=strict is ACCEPTED', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'code_quality.fallow.profile', 'strict'],
      tmpDir
    );
    assert.ok(
      result.success,
      [
        'config-set code_quality.fallow.profile=strict must succeed,',
        'stdout: ' + result.output,
        'stderr: ' + result.error,
      ].join('\n')
    );
  });

  test('config-set code_quality.fallow.profile=unknown is REJECTED', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'code_quality.fallow.profile', 'unknown'],
      tmpDir
    );
    assert.ok(
      !result.success,
      'config-set code_quality.fallow.profile=unknown must fail'
    );
  });
});
