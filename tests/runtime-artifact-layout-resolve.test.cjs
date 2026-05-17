'use strict';
/**
 * Tests for resolveRuntimeArtifactLayout — structural shape per runtime.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { resolveRuntimeArtifactLayout } = require('../get-shit-done/bin/lib/runtime-artifact-layout.cjs');

const FAKE_DIR = '/tmp/fake-config-dir';

describe('resolveRuntimeArtifactLayout — claude local', () => {
  test('returns correct layout for claude scope=local', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_DIR, 'local');
    assert.strictEqual(layout.runtime, 'claude');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 2);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
    assert.strictEqual(layout.kinds[0].destSubpath, 'commands/gsd');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
    assert.strictEqual(layout.kinds[1].kind, 'agents');
    assert.strictEqual(layout.kinds[1].destSubpath, 'agents');
    assert.strictEqual(layout.kinds[1].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[1].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — claude global', () => {
  test('returns correct layout for claude scope=global', () => {
    const layout = resolveRuntimeArtifactLayout('claude', FAKE_DIR, 'global');
    assert.strictEqual(layout.runtime, 'claude');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — cursor', () => {
  test('returns correct layout for cursor', () => {
    const layout = resolveRuntimeArtifactLayout('cursor', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'cursor');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — gemini', () => {
  test('returns correct layout for gemini', () => {
    const layout = resolveRuntimeArtifactLayout('gemini', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'gemini');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
    assert.strictEqual(layout.kinds[0].destSubpath, 'commands/gsd');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — codex', () => {
  test('returns correct layout for codex', () => {
    const layout = resolveRuntimeArtifactLayout('codex', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'codex');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — copilot', () => {
  test('returns correct layout for copilot', () => {
    const layout = resolveRuntimeArtifactLayout('copilot', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'copilot');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — antigravity', () => {
  test('returns correct layout for antigravity', () => {
    const layout = resolveRuntimeArtifactLayout('antigravity', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'antigravity');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — windsurf', () => {
  test('returns correct layout for windsurf', () => {
    const layout = resolveRuntimeArtifactLayout('windsurf', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'windsurf');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — augment', () => {
  test('returns correct layout for augment', () => {
    const layout = resolveRuntimeArtifactLayout('augment', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'augment');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — trae', () => {
  test('returns correct layout for trae', () => {
    const layout = resolveRuntimeArtifactLayout('trae', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'trae');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — qwen', () => {
  test('returns correct layout for qwen', () => {
    const layout = resolveRuntimeArtifactLayout('qwen', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'qwen');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — hermes', () => {
  test('returns correct layout for hermes', () => {
    const layout = resolveRuntimeArtifactLayout('hermes', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'hermes');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills/gsd');
    assert.strictEqual(layout.kinds[0].prefix, '');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — codebuddy', () => {
  test('returns correct layout for codebuddy', () => {
    const layout = resolveRuntimeArtifactLayout('codebuddy', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'codebuddy');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'skills');
    assert.strictEqual(layout.kinds[0].destSubpath, 'skills');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — cline', () => {
  test('returns correct layout for cline', () => {
    const layout = resolveRuntimeArtifactLayout('cline', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'cline');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 0);
  });
});

describe('resolveRuntimeArtifactLayout — opencode', () => {
  test('returns correct layout for opencode', () => {
    const layout = resolveRuntimeArtifactLayout('opencode', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'opencode');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
    assert.strictEqual(layout.kinds[0].destSubpath, 'command');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});

describe('resolveRuntimeArtifactLayout — kilo', () => {
  test('returns correct layout for kilo', () => {
    const layout = resolveRuntimeArtifactLayout('kilo', FAKE_DIR);
    assert.strictEqual(layout.runtime, 'kilo');
    assert.strictEqual(layout.configDir, FAKE_DIR);
    assert.strictEqual(layout.kinds.length, 1);
    assert.strictEqual(layout.kinds[0].kind, 'commands');
    assert.strictEqual(layout.kinds[0].destSubpath, 'command');
    assert.strictEqual(layout.kinds[0].prefix, 'gsd-');
    assert.strictEqual(typeof layout.kinds[0].stage, 'function');
  });
});
