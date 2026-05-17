'use strict';
/**
 * Edge-case tests for resolveRuntimeArtifactLayout.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { resolveRuntimeArtifactLayout } = require('../get-shit-done/bin/lib/runtime-artifact-layout.cjs');

describe('hermes nested layout', () => {
  test('hermes has destSubpath skills/gsd and empty prefix', () => {
    const layout = resolveRuntimeArtifactLayout('hermes', '/tmp/x');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills/gsd');
    assert.strictEqual(layout.kinds[0].prefix, '');
  });
});

describe('cline empty kinds', () => {
  test('cline has no kinds', () => {
    const layout = resolveRuntimeArtifactLayout('cline', '/tmp/x');
    assert.strictEqual(layout.kinds.length, 0);
  });
});

describe('gemini commands layout', () => {
  test('gemini has one commands kind', () => {
    const layout = resolveRuntimeArtifactLayout('gemini', '/tmp/x');
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
  });
});

describe('claude scope=local has commands and agents', () => {
  test('claude local has both commands and agents kinds', () => {
    const layout = resolveRuntimeArtifactLayout('claude', '/tmp/x', 'local');
    const kindNames = layout.kinds.map(k => k.kind);
    assert.ok(kindNames.includes('commands'), 'should have commands kind');
    assert.ok(kindNames.includes('agents'), 'should have agents kind');
  });
});

describe('claude scope=global has only skills', () => {
  test('claude global has only skills kind', () => {
    const layout = resolveRuntimeArtifactLayout('claude', '/tmp/x', 'global');
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
  });
});

describe('unknown runtime throws TypeError', () => {
  test('grok throws TypeError containing "grok"', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('grok', '/tmp/x'),
      (err) => {
        assert.ok(err instanceof TypeError);
        assert.ok(err.message.includes('grok'), 'error message must contain the runtime name');
        return true;
      }
    );
  });

  test('xyzunknown throws TypeError', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('xyzunknown', '/tmp/x'),
      TypeError
    );
  });
});

describe('invalid configDir throws TypeError', () => {
  test('empty configDir throws TypeError', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('claude', ''),
      TypeError
    );
  });

  test('non-string configDir throws TypeError', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('claude', null),
      TypeError
    );
  });
});

describe('invalid scope throws TypeError', () => {
  test('bad scope throws TypeError', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('claude', '/x', 'invalid'),
      TypeError
    );
  });
});
