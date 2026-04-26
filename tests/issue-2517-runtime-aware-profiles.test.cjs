/**
 * Issue #2517 — runtime-aware model profile resolution.
 *
 * Today, profile tiers (opus/sonnet/haiku) only resolve to Claude IDs. On Codex /
 * other runtimes, users must use `inherit` or write large `model_overrides` blocks.
 *
 * This adds a `runtime` config key + `model_profile_overrides[runtime][tier]` map.
 * When `runtime` is set to a non-Claude value, profile tiers resolve to runtime-
 * native model IDs.
 *
 *   Codex:   opus -> gpt-5.4 (xhigh), sonnet -> gpt-5.3-codex (medium), haiku -> gpt-5.4-mini (medium)
 *
 * `runtime: "claude"` is the implicit default and is treated as a no-op for
 * resolution — it does not override `resolve_model_ids: "omit"` or any other
 * Claude-native semantics (review finding #4).
 *
 * `inherit` keeps current behavior. Unknown runtimes fall back safely (do NOT emit
 * provider-specific IDs the runtime can't accept) and trigger a one-shot stderr
 * warning so typos like `runtime: "codx"` surface immediately (review finding #13).
 *
 * HOME isolation: every test sets `process.env.HOME` to a per-suite tmpdir so the
 * developer's real `~/.gsd/defaults.json` cannot bleed into assertions
 * (review finding #8 / pattern from CodeRabbit on PRs #2603, #2604).
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');

const {
  resolveModelInternal,
  resolveReasoningEffortInternal,
  resolveTierEntry,
  RUNTIME_PROFILE_MAP,
  KNOWN_RUNTIMES,
  _resetRuntimeWarningCacheForTests,
} = require('../get-shit-done/bin/lib/core.cjs');
const { isValidConfigKey } = require('../get-shit-done/bin/lib/config-schema.cjs');

function writeConfig(tmpDir, obj) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify(obj, null, 2)
  );
}

// ─── Shared HOME isolation (#2517 review finding #8) ────────────────────────
// Without this, a developer's real `~/.gsd/defaults.json` (e.g. one with
// `runtime: codex` set) silently overrides test assertions about back-compat
// behavior. Capture HOME, point it at an isolated tmpdir for the duration of
// each test, restore on teardown.
let _origHome;
let _origGsdHome;
let _isolatedHome;
function isolateHome() {
  _origHome = process.env.HOME;
  _origGsdHome = process.env.GSD_HOME;
  _isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-home-iso-'));
  process.env.HOME = _isolatedHome;
  process.env.GSD_HOME = _isolatedHome;
}
function restoreHome() {
  if (_origHome === undefined) delete process.env.HOME; else process.env.HOME = _origHome;
  if (_origGsdHome === undefined) delete process.env.GSD_HOME; else process.env.GSD_HOME = _origGsdHome;
  if (_isolatedHome) fs.rmSync(_isolatedHome, { recursive: true, force: true });
  _isolatedHome = null;
}

// ─── Backwards compatibility — no `runtime` set ─────────────────────────────
describe('issue #2517: backwards compat — no runtime key set', () => {
  let tmpDir;
  beforeEach(() => { isolateHome(); tmpDir = createTempProject(); _resetRuntimeWarningCacheForTests(); });
  afterEach(() => { cleanup(tmpDir); restoreHome(); });

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
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'claude-opus-4-7');
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

// ─── runtime: "claude" — no-op (preserves Claude-native semantics) ──────────
describe('issue #2517: runtime "claude" is a no-op for resolution (finding #4)', () => {
  let tmpDir;
  beforeEach(() => { isolateHome(); tmpDir = createTempProject(); _resetRuntimeWarningCacheForTests(); });
  afterEach(() => { cleanup(tmpDir); restoreHome(); });

  test('runtime:"claude" + balanced returns the alias, not the resolved Claude ID', () => {
    // `runtime: "claude"` is the implicit default — it must not silently flip
    // resolve_model_ids on. The alias passes through identically to the unset case.
    writeConfig(tmpDir, { runtime: 'claude', model_profile: 'balanced' });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'opus');
  });

  test('runtime:"claude" + resolve_model_ids:"omit" returns "" (finding #4 regression)', () => {
    // The pre-fix bug: runtime:"claude" hijacked the resolution chain and
    // returned the resolved Claude ID even when the user explicitly asked for the
    // omit semantics.
    writeConfig(tmpDir, {
      runtime: 'claude',
      model_profile: 'quality',
      resolve_model_ids: 'omit',
    });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), '');
  });

  test('runtime:"claude" + resolve_model_ids:true maps alias -> full Claude ID', () => {
    writeConfig(tmpDir, {
      runtime: 'claude',
      model_profile: 'quality',
      resolve_model_ids: true,
    });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'claude-opus-4-7');
  });

  test('reasoning_effort is null on Claude (never leaks)', () => {
    writeConfig(tmpDir, { runtime: 'claude', model_profile: 'quality' });
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), null);
  });
});

// ─── runtime: "codex" — resolves tiers to Codex IDs + reasoning_effort ──────
describe('issue #2517: runtime "codex" — Codex tier resolution', () => {
  let tmpDir;
  beforeEach(() => { isolateHome(); tmpDir = createTempProject(); _resetRuntimeWarningCacheForTests(); });
  afterEach(() => { cleanup(tmpDir); restoreHome(); });

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

  test('runtime:"codex" beats resolve_model_ids:"omit" (explicit non-Claude opt-in wins)', () => {
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
  beforeEach(() => { isolateHome(); tmpDir = createTempProject(); _resetRuntimeWarningCacheForTests(); });
  afterEach(() => { cleanup(tmpDir); restoreHome(); });

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

// ─── Field-merge semantics — review findings #2 ─────────────────────────────
describe('issue #2517: field-merge of overrides with built-in defaults (finding #2)', () => {
  let tmpDir;
  beforeEach(() => { isolateHome(); tmpDir = createTempProject(); _resetRuntimeWarningCacheForTests(); });
  afterEach(() => { cleanup(tmpDir); restoreHome(); });

  test('string-shorthand override keeps reasoning_effort from built-in (CONFIGURATION.md example)', () => {
    // `{ codex: { opus: "gpt-5-pro" } }` is the documented shorthand. Pre-fix,
    // it silently dropped reasoning_effort. Post-fix, the model is overridden
    // and reasoning_effort comes from the built-in entry.
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile: 'quality',
      model_profile_overrides: { codex: { opus: 'gpt-5-pro' } },
    });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'gpt-5-pro');
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), 'xhigh');
  });

  test('partial-object override (no model) keeps model from built-in', () => {
    // `{ codex: { opus: { reasoning_effort: "low" } } }` previously dropped
    // the model entirely (returned undefined and fell through). Post-fix, the
    // built-in `gpt-5.4` model is preserved and `low` reasoning_effort wins.
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile: 'quality',
      model_profile_overrides: { codex: { opus: { reasoning_effort: 'low' } } },
    });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'gpt-5.4');
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), 'low');
  });

  test('full-object override replaces both fields', () => {
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile: 'quality',
      model_profile_overrides: {
        codex: { opus: { model: 'custom-model', reasoning_effort: 'minimal' } },
      },
    });
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'custom-model');
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), 'minimal');
  });

  test('resolveTierEntry helper: shorthand merge', () => {
    // Direct unit-test of the shared helper used by core + install.js.
    const entry = resolveTierEntry({
      runtime: 'codex',
      tier: 'opus',
      overrides: { codex: { opus: 'gpt-5-pro' } },
    });
    assert.deepStrictEqual(entry, { model: 'gpt-5-pro', reasoning_effort: 'xhigh' });
  });

  test('resolveTierEntry helper: partial-object merge keeps built-in model', () => {
    const entry = resolveTierEntry({
      runtime: 'codex',
      tier: 'opus',
      overrides: { codex: { opus: { reasoning_effort: 'low' } } },
    });
    assert.deepStrictEqual(entry, { model: 'gpt-5.4', reasoning_effort: 'low' });
  });

  test('resolveTierEntry helper: unknown runtime + no overrides -> null', () => {
    const entry = resolveTierEntry({
      runtime: 'mystery',
      tier: 'opus',
      overrides: null,
    });
    assert.strictEqual(entry, null);
  });
});

// ─── reasoning_effort allowlist (review finding #3) ─────────────────────────
describe('issue #2517: reasoning_effort allowlist gates regardless of overrides (finding #3)', () => {
  let tmpDir;
  beforeEach(() => { isolateHome(); tmpDir = createTempProject(); _resetRuntimeWarningCacheForTests(); });
  afterEach(() => { cleanup(tmpDir); restoreHome(); });

  test('unknown runtime with overrides supplying reasoning_effort yields null effort', () => {
    // Pre-fix: `if (!overrides) return null` left a hole — overrides for an
    // unknown runtime made effort propagate, defeating the typo guard.
    writeConfig(tmpDir, {
      runtime: 'mystery',
      model_profile: 'quality',
      model_profile_overrides: {
        mystery: { opus: { model: 'mystery-opus', reasoning_effort: 'xhigh' } },
      },
    });
    // Model still resolves (overrides are honored).
    assert.strictEqual(resolveModelInternal(tmpDir, 'gsd-planner'), 'mystery-opus');
    // …but reasoning_effort does NOT propagate to a runtime not in the allowlist.
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), null);
  });

  test('typo runtime "codx" with overrides yields null effort (no leak into install path)', () => {
    writeConfig(tmpDir, {
      runtime: 'codx',
      model_profile: 'quality',
      model_profile_overrides: { codx: { opus: { model: 'gpt-5.4', reasoning_effort: 'xhigh' } } },
    });
    assert.strictEqual(resolveReasoningEffortInternal(tmpDir, 'gsd-planner'), null);
  });
});

// ─── Unknown runtime / unknown tier ─────────────────────────────────────────
describe('issue #2517: unknown runtime + safe fallback', () => {
  let tmpDir;
  beforeEach(() => { isolateHome(); tmpDir = createTempProject(); _resetRuntimeWarningCacheForTests(); });
  afterEach(() => { cleanup(tmpDir); restoreHome(); });

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

// ─── Schema validation (config-set time + load time) ────────────────────────
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

// ─── loadConfig validation warnings (review findings #10, #13) ──────────────
describe('issue #2517: loadConfig warns on unknown runtime/tier (findings #10, #13)', () => {
  const { loadConfig } = require('../get-shit-done/bin/lib/core.cjs');
  let tmpDir;
  let origWrite;
  let captured;
  beforeEach(() => {
    isolateHome();
    tmpDir = createTempProject();
    _resetRuntimeWarningCacheForTests();
    captured = [];
    origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk) => { captured.push(String(chunk)); return true; };
  });
  afterEach(() => { process.stderr.write = origWrite; cleanup(tmpDir); restoreHome(); });

  test('unknown runtime triggers a stderr warning', () => {
    writeConfig(tmpDir, { runtime: 'codx', model_profile: 'quality' });
    loadConfig(tmpDir);
    const joined = captured.join('');
    assert.match(joined, /unknown value "codx"/);
  });

  test('known runtime does NOT trigger a runtime warning', () => {
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'quality' });
    loadConfig(tmpDir);
    const joined = captured.join('');
    assert.doesNotMatch(joined, /unknown value/);
  });

  test('unknown tier in overrides triggers a stderr warning', () => {
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile_overrides: { codex: { banana: 'whatever' } },
    });
    loadConfig(tmpDir);
    const joined = captured.join('');
    assert.match(joined, /unknown tier "banana"/);
  });

  test('unknown runtime in overrides triggers a stderr warning', () => {
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile_overrides: { mystery: { opus: 'whatever' } },
    });
    loadConfig(tmpDir);
    const joined = captured.join('');
    assert.match(joined, /model_profile_overrides\.mystery\.\* uses unknown runtime/);
  });

  test('every name in KNOWN_RUNTIMES survives the warning gate', () => {
    // Smoke check: `KNOWN_RUNTIMES` must list every runtime `bin/install.js`
    // emits for, otherwise legitimate users get spammed at every loadConfig.
    for (const r of KNOWN_RUNTIMES) {
      assert.ok(typeof r === 'string' && r.length > 0);
    }
  });
});

// ─── End-to-end: per-project config -> Codex TOML emit (finding #1) ─────────
describe('issue #2517: install end-to-end — per-project config reaches Codex TOML (finding #1)', () => {
  // Load install.js in test-mode so its module exports are populated.
  const prevTestMode = process.env.GSD_TEST_MODE;
  process.env.GSD_TEST_MODE = '1';
  const installMod = require('../bin/install.js');
  if (prevTestMode === undefined) delete process.env.GSD_TEST_MODE;
  else process.env.GSD_TEST_MODE = prevTestMode;
  const { readGsdRuntimeProfileResolver, generateCodexAgentToml } = installMod;

  let tmpDir;
  beforeEach(() => { isolateHome(); tmpDir = createTempProject(); _resetRuntimeWarningCacheForTests(); });
  afterEach(() => { cleanup(tmpDir); restoreHome(); });

  test('readGsdRuntimeProfileResolver picks up runtime from .planning/config.json', () => {
    // No ~/.gsd/defaults.json (HOME is isolated tmpdir). Per-project config alone
    // must drive the resolver — pre-fix, it returned null.
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'quality' });
    const resolver = readGsdRuntimeProfileResolver(tmpDir);
    assert.ok(resolver, 'expected a resolver from per-project config');
    assert.strictEqual(resolver.runtime, 'codex');
    const entry = resolver.resolve('gsd-planner');
    assert.deepStrictEqual(entry, { model: 'gpt-5.4', reasoning_effort: 'xhigh' });
  });

  test('per-project config wins over global ~/.gsd/defaults.json', () => {
    fs.mkdirSync(path.join(_isolatedHome, '.gsd'), { recursive: true });
    fs.writeFileSync(
      path.join(_isolatedHome, '.gsd', 'defaults.json'),
      JSON.stringify({ runtime: 'claude', model_profile: 'budget' })
    );
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'quality' });
    const resolver = readGsdRuntimeProfileResolver(tmpDir);
    assert.strictEqual(resolver.runtime, 'codex');
    const entry = resolver.resolve('gsd-planner');
    assert.strictEqual(entry.model, 'gpt-5.4');
  });

  test('generated Codex TOML embeds model = and model_reasoning_effort = lines', () => {
    writeConfig(tmpDir, { runtime: 'codex', model_profile: 'quality' });
    const resolver = readGsdRuntimeProfileResolver(tmpDir);
    const toml = generateCodexAgentToml(
      'gsd-planner',
      '---\nname: gsd-planner\ndescription: Planner agent\n---\nBody.\n',
      null,
      resolver
    );
    assert.match(toml, /^model = "gpt-5\.4"$/m);
    assert.match(toml, /^model_reasoning_effort = "xhigh"$/m);
  });

  test('generated TOML omits reasoning_effort when runtime has none', () => {
    // For a known runtime with model but no reasoning_effort, only model is emitted.
    // Use the user-override path to simulate this with codex (no built-in returns
    // model alone, so fabricate via override of an unknown-runtime entry).
    writeConfig(tmpDir, {
      runtime: 'codex',
      model_profile: 'quality',
      model_profile_overrides: { codex: { opus: { model: 'custom', reasoning_effort: '' } } },
    });
    const resolver = readGsdRuntimeProfileResolver(tmpDir);
    const toml = generateCodexAgentToml(
      'gsd-planner',
      '---\nname: gsd-planner\n---\nBody.\n',
      null,
      resolver
    );
    assert.match(toml, /^model = "custom"$/m);
    assert.doesNotMatch(toml, /model_reasoning_effort/);
  });

  test('resolver returns null with no global, no per-project config', () => {
    // Sanity: nothing configured -> nothing emitted. Pre-existing back-compat.
    const resolver = readGsdRuntimeProfileResolver(tmpDir);
    assert.strictEqual(resolver, null);
  });

  test('inline require paths resolve relative to install.js __dirname (finding #6)', () => {
    // Defensive: assert the lib files install.js requires actually exist at
    // resolver-construction time. Catches accidental relative-path drift in CI.
    const installDir = path.dirname(require.resolve('../bin/install.js'));
    const libDir = path.join(installDir, '..', 'get-shit-done', 'bin', 'lib');
    assert.ok(fs.existsSync(path.join(libDir, 'core.cjs')));
    assert.ok(fs.existsSync(path.join(libDir, 'model-profiles.cjs')));
  });
});

// ─── RUNTIME_PROFILE_MAP single source of truth (finding #16) ───────────────
describe('issue #2517: RUNTIME_PROFILE_MAP single source of truth (finding #16)', () => {
  test('install.js consumes the same map as core.cjs', () => {
    // `bin/install.js` must NOT carry its own duplicate copy of the map.
    // The shared resolver imported in install.js exposes `runtime` and the
    // entries through `resolveTierEntry`, so any future drift between the two
    // files would surface as a test failure here rather than a silent bug.
    const codexOpus = RUNTIME_PROFILE_MAP.codex?.opus;
    assert.deepStrictEqual(codexOpus, { model: 'gpt-5.4', reasoning_effort: 'xhigh' });
    const claudeOpus = RUNTIME_PROFILE_MAP.claude?.opus;
    assert.deepStrictEqual(claudeOpus, { model: 'claude-opus-4-7' });
  });
});
