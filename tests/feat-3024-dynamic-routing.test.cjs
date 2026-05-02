/**
 * Feature test for issue #3024 — dynamic routing with failure-tier escalation.
 *
 * Adds a `dynamic_routing` block to .planning/config.json:
 *
 *   {
 *     "dynamic_routing": {
 *       "enabled": true,
 *       "tier_models": {
 *         "light":    "haiku",
 *         "standard": "sonnet",
 *         "heavy":    "opus"
 *       },
 *       "escalate_on_failure": true,
 *       "max_escalations": 1
 *     }
 *   }
 *
 * Each agent has a default tier (light/standard/heavy). When dynamic
 * routing is enabled, the resolver picks `tier_models[default_tier]`
 * for the first attempt. On orchestrator-detected soft failure, the
 * orchestrator calls the resolver again with `attempt: 1`, which
 * returns the next tier up (capped at `max_escalations`).
 *
 * This PR delivers the JS-layer infrastructure: schema + tier map +
 * resolver + escalation helpers. Orchestrator adoption is incremental
 * follow-up — this PR's contract is the resolver function and the
 * config it consumes.
 *
 * Resolution precedence (highest → lowest):
 *   1. model_overrides[agent]              (full IDs accepted; targeted)
 *   2. dynamic_routing.tier_models[tier]   (NEW; escalation-aware)
 *   3. models[phase_type]                  (#3023; coarse phase-level)
 *   4. model_profile                       (per-agent column)
 *   5. Runtime default
 *
 * Tests are typed-IR / structural — assert on the value returned by
 * resolveModelForTier or isValidConfigKey, not stdout/grep.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  resolveModelInternal,
  resolveModelForTier,
} = require('../get-shit-done/bin/lib/core.cjs');
const {
  AGENT_DEFAULT_TIERS,
  VALID_AGENT_TIERS,
  MODEL_PROFILES,
  nextTier,
} = require('../get-shit-done/bin/lib/model-profiles.cjs');
const { isValidConfigKey } = require('../get-shit-done/bin/lib/config-schema.cjs');

function makeTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-3024-${prefix}-`));
}
function writeConfig(dir, config) {
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify(config, null, 2));
}
function rmr(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* noop */ } }

// ─── Schema: AGENT_DEFAULT_TIERS coverage + valid tier set ──────────────────

describe('#3024 schema: every agent has a default tier (light/standard/heavy)', () => {
  test('AGENT_DEFAULT_TIERS exported as a non-empty object', () => {
    assert.equal(typeof AGENT_DEFAULT_TIERS, 'object');
    assert.ok(AGENT_DEFAULT_TIERS !== null);
    assert.ok(Object.keys(AGENT_DEFAULT_TIERS).length > 0);
  });

  test('VALID_AGENT_TIERS exposes exactly {light, standard, heavy}', () => {
    assert.deepStrictEqual([...VALID_AGENT_TIERS].sort(), ['heavy', 'light', 'standard']);
  });

  test('every agent in MODEL_PROFILES has a default tier', () => {
    const missing = Object.keys(MODEL_PROFILES).filter((a) => !AGENT_DEFAULT_TIERS[a]);
    assert.deepStrictEqual(missing, []);
  });

  test('every assigned tier is one of the three valid tiers', () => {
    const invalid = Object.entries(AGENT_DEFAULT_TIERS).filter(
      ([, t]) => !VALID_AGENT_TIERS.has(t)
    );
    assert.deepStrictEqual(invalid, []);
  });
});

// ─── nextTier helper ────────────────────────────────────────────────────────

describe('#3024 nextTier helper', () => {
  test('exported as a function', () => {
    assert.equal(typeof nextTier, 'function');
  });

  test('light → standard → heavy → heavy (caps at heavy)', () => {
    assert.equal(nextTier('light'), 'standard');
    assert.equal(nextTier('standard'), 'heavy');
    assert.equal(nextTier('heavy'), 'heavy', 'already at top — stays at heavy');
  });

  test('returns null for invalid input', () => {
    assert.equal(nextTier('jumbo'), null);
    assert.equal(nextTier(null), null);
    assert.equal(nextTier(undefined), null);
  });
});

// ─── Resolver behavior: dynamic routing, disabled mode ──────────────────────

describe('#3024 resolveModelForTier: disabled mode is a no-op (acceptance criterion 1)', () => {
  let projectDir;
  beforeEach(() => { projectDir = makeTmp('disabled'); });
  afterEach(() => { rmr(projectDir); });

  test('exported as a function', () => {
    assert.equal(typeof resolveModelForTier, 'function');
  });

  test('with no dynamic_routing block, falls back to resolveModelInternal', () => {
    writeConfig(projectDir, { model_profile: 'balanced' });
    // resolveModelForTier with attempt=0 must match resolveModelInternal.
    const baseline = resolveModelInternal(projectDir, 'gsd-phase-researcher');
    assert.equal(resolveModelForTier(projectDir, 'gsd-phase-researcher', 0), baseline);
  });

  test('with dynamic_routing.enabled=false, attempt argument is ignored — same as resolveModelInternal', () => {
    writeConfig(projectDir, {
      model_profile: 'balanced',
      dynamic_routing: {
        enabled: false,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
      },
    });
    const baseline = resolveModelInternal(projectDir, 'gsd-phase-researcher');
    // attempt=0 and attempt=1 both ignored when disabled
    assert.equal(resolveModelForTier(projectDir, 'gsd-phase-researcher', 0), baseline);
    assert.equal(resolveModelForTier(projectDir, 'gsd-phase-researcher', 1), baseline);
  });
});

// ─── Resolver behavior: dynamic routing, enabled ────────────────────────────

describe('#3024 resolveModelForTier: enabled mode picks tier_models[default_tier]', () => {
  let projectDir;
  beforeEach(() => { projectDir = makeTmp('enabled'); });
  afterEach(() => { rmr(projectDir); });

  test('attempt=0 returns tier_models[agent_default_tier] (acceptance criterion 2)', () => {
    writeConfig(projectDir, {
      model_profile: 'balanced',
      dynamic_routing: {
        enabled: true,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
      },
    });
    // gsd-codebase-mapper has light default tier per AGENT_DEFAULT_TIERS.
    // CR nitpick (#3031): assert preconditions explicitly so a tier
    // re-mapping in AGENT_DEFAULT_TIERS surfaces as a test failure
    // instead of a silent skip.
    assert.equal(AGENT_DEFAULT_TIERS['gsd-codebase-mapper'], 'light',
      'gsd-codebase-mapper expected to be light tier');
    assert.equal(resolveModelForTier(projectDir, 'gsd-codebase-mapper', 0), 'haiku');
    assert.equal(AGENT_DEFAULT_TIERS['gsd-planner'], 'heavy',
      'gsd-planner expected to be heavy tier');
    assert.equal(resolveModelForTier(projectDir, 'gsd-planner', 0), 'opus');
  });

  test('attempt=1 escalates to next tier up (acceptance criterion 3)', () => {
    writeConfig(projectDir, {
      model_profile: 'balanced',
      dynamic_routing: {
        enabled: true,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
        escalate_on_failure: true,
        max_escalations: 1,
      },
    });
    // For an agent with default tier 'light', attempt=1 should give 'standard' tier model.
    const lightAgent = Object.entries(AGENT_DEFAULT_TIERS).find(([, t]) => t === 'light')?.[0];
    assert.ok(lightAgent, 'AGENT_DEFAULT_TIERS must contain at least one light agent');
    assert.equal(resolveModelForTier(projectDir, lightAgent, 0), 'haiku');
    assert.equal(resolveModelForTier(projectDir, lightAgent, 1), 'sonnet');
    // For a 'standard' agent, attempt=1 should give 'heavy' model.
    const stdAgent = Object.entries(AGENT_DEFAULT_TIERS).find(([, t]) => t === 'standard')?.[0];
    assert.ok(stdAgent, 'AGENT_DEFAULT_TIERS must contain at least one standard agent');
    assert.equal(resolveModelForTier(projectDir, stdAgent, 0), 'sonnet');
    assert.equal(resolveModelForTier(projectDir, stdAgent, 1), 'opus');
  });

  test('attempts beyond max_escalations cap at the highest reachable tier (acceptance criterion 4)', () => {
    writeConfig(projectDir, {
      model_profile: 'balanced',
      dynamic_routing: {
        enabled: true,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
        escalate_on_failure: true,
        max_escalations: 1, // cap at 1 escalation total
      },
    });
    const lightAgent = Object.entries(AGENT_DEFAULT_TIERS).find(([, t]) => t === 'light')?.[0];
    assert.ok(lightAgent, 'AGENT_DEFAULT_TIERS must contain at least one light agent');
    // attempts beyond max_escalations should not exceed max_escalations'
    // tier — i.e. attempt=2 with max=1 = same as attempt=1.
    assert.equal(resolveModelForTier(projectDir, lightAgent, 2), 'sonnet',
      'attempt=2 with max_escalations=1 caps at attempt=1 tier');
    assert.equal(resolveModelForTier(projectDir, lightAgent, 5), 'sonnet');
  });

  test('"heavy" agents stay at heavy (no tier above)', () => {
    writeConfig(projectDir, {
      model_profile: 'balanced',
      dynamic_routing: {
        enabled: true,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
        escalate_on_failure: true,
        max_escalations: 2,
      },
    });
    const heavyAgent = Object.entries(AGENT_DEFAULT_TIERS).find(([, t]) => t === 'heavy')?.[0];
    assert.ok(heavyAgent, 'AGENT_DEFAULT_TIERS must contain at least one heavy agent');
    assert.equal(resolveModelForTier(projectDir, heavyAgent, 0), 'opus');
    // Already at heavy — escalation cannot go higher.
    assert.equal(resolveModelForTier(projectDir, heavyAgent, 1), 'opus');
    assert.equal(resolveModelForTier(projectDir, heavyAgent, 5), 'opus');
  });

  test('default max_escalations is 1 when omitted', () => {
    writeConfig(projectDir, {
      model_profile: 'balanced',
      dynamic_routing: {
        enabled: true,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
        // max_escalations omitted — default to 1
      },
    });
    const lightAgent = Object.entries(AGENT_DEFAULT_TIERS).find(([, t]) => t === 'light')?.[0];
    assert.ok(lightAgent, 'AGENT_DEFAULT_TIERS must contain at least one light agent');
    // attempt=1 escalates; attempt=2 should cap at attempt=1 (default max=1)
    assert.equal(resolveModelForTier(projectDir, lightAgent, 1), 'sonnet');
    assert.equal(resolveModelForTier(projectDir, lightAgent, 2), 'sonnet');
  });

  // ─── CR Major (#3031): escalate_on_failure: false honored ──────────────

  test('escalate_on_failure:false disables escalation even when attempt > 0 (CR Major)', () => {
    // Pre-fix bug: an orchestrator that always passes attempt+1 on retry
    // would silently escalate even though the user opted out via
    // escalate_on_failure:false. The kill-switch must short-circuit
    // every attempt back to the default tier.
    writeConfig(projectDir, {
      model_profile: 'balanced',
      dynamic_routing: {
        enabled: true,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
        escalate_on_failure: false, // ← kill-switch
        max_escalations: 5,
      },
    });
    const lightAgent = Object.entries(AGENT_DEFAULT_TIERS).find(([, t]) => t === 'light')?.[0];
    assert.ok(lightAgent, 'AGENT_DEFAULT_TIERS must contain at least one light agent');
    // Every attempt must resolve to the default (light → haiku),
    // regardless of how high the orchestrator bumped the counter.
    assert.equal(resolveModelForTier(projectDir, lightAgent, 0), 'haiku');
    assert.equal(resolveModelForTier(projectDir, lightAgent, 1), 'haiku',
      'escalate_on_failure:false must not escalate even at attempt=1');
    assert.equal(resolveModelForTier(projectDir, lightAgent, 5), 'haiku');
  });

  test('escalate_on_failure:true (explicit) escalates normally', () => {
    // Sanity: explicit true matches the default truthy behavior.
    writeConfig(projectDir, {
      model_profile: 'balanced',
      dynamic_routing: {
        enabled: true,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
        escalate_on_failure: true,
        max_escalations: 1,
      },
    });
    const lightAgent = Object.entries(AGENT_DEFAULT_TIERS).find(([, t]) => t === 'light')?.[0];
    assert.ok(lightAgent);
    assert.equal(resolveModelForTier(projectDir, lightAgent, 1), 'sonnet');
  });
});

// ─── Resolver precedence ────────────────────────────────────────────────────

describe('#3024 precedence: per-agent override > dynamic_routing > models > profile', () => {
  let projectDir;
  beforeEach(() => { projectDir = makeTmp('precedence'); });
  afterEach(() => { rmr(projectDir); });

  test('per-agent model_overrides beats dynamic_routing (acceptance criterion: override wins)', () => {
    writeConfig(projectDir, {
      model_profile: 'balanced',
      model_overrides: { 'gsd-codebase-mapper': 'openai/gpt-5' },
      dynamic_routing: {
        enabled: true,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
      },
    });
    // Per-agent override always wins, even at escalated attempt.
    assert.equal(resolveModelForTier(projectDir, 'gsd-codebase-mapper', 0), 'openai/gpt-5');
    assert.equal(resolveModelForTier(projectDir, 'gsd-codebase-mapper', 1), 'openai/gpt-5');
  });

  test('dynamic_routing beats phase-type models (#3023)', () => {
    writeConfig(projectDir, {
      model_profile: 'balanced',
      models: { research: 'opus' }, // phase-type would say opus
      dynamic_routing: {
        enabled: true,
        tier_models: { light: 'haiku', standard: 'sonnet', heavy: 'opus' },
      },
    });
    // gsd-codebase-mapper is research phase-type; phase-type would give 'opus',
    // but dynamic routing (light default → haiku) wins.
    if (AGENT_DEFAULT_TIERS['gsd-codebase-mapper'] === 'light') {
      assert.equal(resolveModelForTier(projectDir, 'gsd-codebase-mapper', 0), 'haiku');
    }
  });
});

// ─── Schema validation ──────────────────────────────────────────────────────

describe('#3024 config-schema: dynamic_routing.* validation', () => {
  test('dynamic_routing.enabled is a valid config key', () => {
    assert.equal(isValidConfigKey('dynamic_routing.enabled'), true);
  });

  test('dynamic_routing.escalate_on_failure is a valid config key', () => {
    assert.equal(isValidConfigKey('dynamic_routing.escalate_on_failure'), true);
  });

  test('dynamic_routing.max_escalations is a valid config key', () => {
    assert.equal(isValidConfigKey('dynamic_routing.max_escalations'), true);
  });

  test('dynamic_routing.tier_models.<tier> for each valid tier', () => {
    for (const t of ['light', 'standard', 'heavy']) {
      assert.equal(isValidConfigKey(`dynamic_routing.tier_models.${t}`), true);
    }
  });

  test('unknown tier in tier_models is rejected', () => {
    assert.equal(isValidConfigKey('dynamic_routing.tier_models.jumbo'), false);
    assert.equal(isValidConfigKey('dynamic_routing.tier_models.medium'), false);
  });

  test('unknown dynamic_routing.* keys are rejected', () => {
    assert.equal(isValidConfigKey('dynamic_routing.foo'), false);
    assert.equal(isValidConfigKey('dynamic_routing'), false,
      'bare dynamic_routing (no field) must not be a config-set target');
  });
});
