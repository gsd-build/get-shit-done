/**
 * Issue #2517 — runtime-aware model profile resolution.
 *
 * Today, profile tiers (opus/sonnet/haiku) only resolve to Claude IDs. On Codex /
 * other runtimes, users must use `inherit` or write large `model_overrides` blocks.
 *
 * This adds a `runtime` config key + `model_profile_overrides[runtime][tier]` map.
 * When `runtime` is set, profile tiers resolve to runtime-native model IDs.
 *
 *   Claude:  opus -> claude-opus-4-6, sonnet -> claude-sonnet-4-6, haiku -> claude-haiku-4-5
 *   Codex:   opus -> gpt-5.4 (xhigh), sonnet -> gpt-5.3-codex (medium), haiku -> gpt-5.4-mini (medium)
 *
 * `inherit` keeps current behavior. Unknown runtimes fall back safely (do NOT emit
 * provider-specific IDs the runtime can't accept).
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');

const {
  resolveModelInternal,
  resolveReasoningEffortInternal,
} = require('../get-shit-done/bin/lib/core.cjs');
const { isValidConfigKey } = require('../get-shit-done/bin/lib/config-schema.cjs');

function writeConfig(tmpDir, obj) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify(obj, null, 2)
  );
}

// ─── Backwards compatibility — no `runtime` set ─────────────────────────────
describe('issue #2517: backwards compat — no runtime key set', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('balanced profile returns Claude alias when runtime absent', () => {
    writeConfig(tmpDir, { model_profile: 'balanced' });
    // gsd-planner balanced -> opus
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'opus');
  });

  test('inherit profile still returns "inherit" with no runtime', () => {
    writeConfig(tmpDir, { model_profile: 'inherit' });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'inherit');
  });

  test('resolve_model_ids:true still maps alias -> full Claude ID with no runtime', () => {
    writeConfig(tmpDir, { model_profile: 'balanced', resolve_model_ids: true });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'claude-opus-4-6');
  });

  test('resolve_model_ids:"omit" still returns "" with no runtime', () => {
    writeConfig(tmpDir, { model_profile: 'balanced', resolve_model_ids: 'omit' });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), '');
  });

  test('reasoning_effort returns null when runtime absent', () => {
    writeConfig(tmpDir, { model_profile: 'balanced' });
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), null);
  });

  test('adaptive profile still works without runtime (#1713/#1806)', () => {
    writeConfig(tmpDir, { model_profile: 'adaptive' });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'opus');
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-codebase-mapper'), 'haiku');
  });
});

// ─── runtime: "claude" — resolves to full Claude IDs ─────────────────────────
describe('issue #2517: runtime "claude" — resolves tiers to Claude IDs', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('opus tier resolves to claude-opus-4-6', () => {
    writeConfig(tmpDir, { runtime: 'claude', model_profile: 'quality' });
    // gsd-planner quality -> opus -> claude-opus-4-6
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'claude-opus-4-6');
  });

  test('sonnet tier resolves to claude-sonnet-4-6', () => {
    writeConfig(tmpDir, { runtime: 'claude', model_profile: 'balanced' });
    // gsd-roadmapper balanced -> sonnet
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-roadmapper'), 'claude-sonnet-4-6');
  });

  test('haiku tier resolves to claude-haiku-4-5', () => {
    writeConfig(tmpDir, { runtime: 'claude', model_profile: 'budget' });
    // gsd-codebase-mapper budget -> haiku
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-codebase-mapper'), 'claude-haiku-4-5');
  });

  test('reasoning_effort is null on Claude (never leaks)', () => {
    writeConfig(tmpDir, { runtime: 'claude', model_profile: 'quality' });
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), null);
  });
});

// ─── runtime: "codex" — resolves tiers to Codex IDs + reasoning_effort ──────
describe('issue #2517: runtime "codex" — Codex tier resolution', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('opus tier -> gpt-5.4 with reasoning_effort xhigh', () => {
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'quality' });
    // gsd-planner quality -> opus -> gpt-5.4
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'gpt-5.4');
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), 'xhigh');
  });

  test('sonnet tier -> gpt-5.3-codex with reasoning_effort medium', () => {
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'balanced' });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-roadmapper'), 'gpt-5.3-codex');
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-roadmapper'), 'medium');
  });

  test('haiku tier -> gpt-5.4-mini with reasoning_effort medium', () => {
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'budget' });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-codebase-mapper'), 'gpt-5.4-mini');
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-codebase-mapper'), 'medium');
  });

  test('adaptive profile resolves on Codex (no #1713/#1806 regression)', () => {
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'adaptive' });
    // gsd-planner adaptive -> opus -> gpt-5.4
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'gpt-5.4');
    // gsd-codebase-mapper adaptive -> haiku -> gpt-5.4-mini
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-codebase-mapper'), 'gpt-5.4-mini');
  });

  test('inherit profile still returns "inherit" on Codex', () => {
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'inherit' });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'inherit');
    // No reasoning_effort when inherit
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), null);
  });

  test('runtime:"codex" beats resolve_model_ids:"omit" (explicit opt-in wins)', () => {
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile: 'quality',
      resolve_model_ids: 'omit',
    });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'gpt-5.4');
  });
});

// ─── Precedence chain ───────────────────────────────────────────────────────
describe('issue #2517: precedence chain', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('per-agent model_overrides wins over runtime tier resolution', () => {
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile: 'quality',
      model_overrides: { 'gsd-planner': 'gpt-5.4-mini' },
    });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'gpt-5.4-mini');
  });

  test('model_profile_overrides[runtime][tier] beats built-in defaults', () => {
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile: 'quality',
      model_profile_overrides: {
        codex: { opus: 'gpt-5-pro' },
      },
    });
    // gsd-planner quality -> opus -> overridden to gpt-5-pro
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'gpt-5-pro');
    // haiku not overridden — fall back to spec defaults
    // gsd-codebase-mapper quality -> sonnet -> gpt-5.3-codex
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-codebase-mapper'), 'gpt-5.3-codex');
  });

  test('partial profile_overrides — only opus overridden, sonnet uses default', () => {
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile: 'balanced',
      model_profile_overrides: {
        codex: { opus: 'gpt-5-pro' }, // only opus overridden
      },
    });
    // gsd-planner balanced -> opus -> overridden to gpt-5-pro
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'gpt-5-pro');
    // gsd-roadmapper balanced -> sonnet -> spec default
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-roadmapper'), 'gpt-5.3-codex');
  });

  test('per-agent override beats profile override beats default', () => {
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile: 'quality',
      model_profile_overrides: { codex: { opus: 'gpt-5-pro' } },
      model_overrides: { 'gsd-planner': 'custom-model' },
    });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'custom-model');
  });
});

// ─── Unknown runtime / unknown tier ─────────────────────────────────────────
describe('issue #2517: unknown runtime + safe fallback', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('unknown runtime falls back to Claude-alias safe default (no Codex IDs leaked)', () => {
    writeConfig(tmpDir, { runtime: 'mystery-runtime', model_profile: 'quality' });
    // Should NOT emit gpt-5.4 — should fall back to Claude alias
    const resolved = resolveModelInternal(tmpDir, 'gsd-planner');
    assert.notStrictEqual(resolved, 'gpt-5.4');
    assert.strictEqual(resolved, 'opus');
  });

  test('unknown runtime + user-provided overrides for that runtime — uses overrides', () => {
    writeConfig(tmpDir, {
      runtime: 'mystery-runtime',
      model_profile: 'quality',
      model_profile_overrides: {
        'mystery-runtime': { opus: 'mystery-opus' },
      },
    });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'mystery-opus');
  });

  test('runtime:"codex" but missing model_profile_overrides[codex] uses spec defaults', () => {
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'quality' });
    // No model_profile_overrides at all — built-in Codex defaults take over
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'gpt-5.4');
  });
});

// ─── Schema validation ──────────────────────────────────────────────────────
describe('issue #2517: VALID_CONFIG_KEYS schema', () => {
  test('"runtime" is a valid config key', () => {
    assert.strictEqual(isValidConfigKey('runtime'), true);
  });

  test('model_profile_overrides.codex.opus is valid', () => {
    assert.strictEqual(isValidConfigKey('model_profile_overrides.codex.opus'), true);
  });

  test('model_profile_overrides.codex.sonnet is valid', () => {
    assert.strictEqual(isValidConfigKey('model_profile_overrides.codex.sonnet'), true);
  });

  test('model_profile_overrides.codex.haiku is valid', () => {
    assert.strictEqual(isValidConfigKey('model_profile_overrides.codex.haiku'), true);
  });

  test('model_profile_overrides.claude.opus is valid', () => {
    assert.strictEqual(isValidConfigKey('model_profile_overrides.claude.opus'), true);
  });

  test('model_profile_overrides with unknown runtime is valid (free-string runtime)', () => {
    assert.strictEqual(isValidConfigKey('model_profile_overrides.acme.opus'), true);
  });

  test('model_profile_overrides with bogus tier is rejected', () => {
    assert.strictEqual(isValidConfigKey('model_profile_overrides.codex.banana'), false);
  });

  test('model_profile_overrides without tier is rejected', () => {
    assert.strictEqual(isValidConfigKey('model_profile_overrides.codex'), false);
  });

  test('model_profile_overrides root key alone is rejected (must include runtime+tier)', () => {
    assert.strictEqual(isValidConfigKey('model_profile_overrides'), false);
  });
});
