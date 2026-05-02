'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2986: Layer-3 fault-detection audit found 4.62% Stryker mutation
 * score on get-shit-done/bin/lib/config-schema.cjs (6 killed, 124 survived).
 * Surviving mutants document tests that "exercise paths" but don't
 * "verify outputs" -- a polarity flip or predicate swap inside the lib
 * passed every existing test.
 *
 * Sample surviving mutants from #2986:
 *   M1: `if (VALID_CONFIG_KEYS.has(keyPath)) return true;`
 *       -> `if (false) return true;`
 *       Killer: a test that asserts isValidConfigKey returns true for
 *       every member of VALID_CONFIG_KEYS. If VALID_CONFIG_KEYS.has is
 *       short-circuited to false, those keys would only be accepted if
 *       a DYNAMIC_KEY_PATTERN matches them -- and none of the static
 *       keys match any dynamic pattern by design.
 *
 *   M2: `return DYNAMIC_KEY_PATTERNS.some((p) => p.test(keyPath));`
 *       -> `return DYNAMIC_KEY_PATTERNS.every(p => p.test(keyPath));`
 *       Killer: a test that supplies a key matching ONE pattern but not
 *       every pattern. With `.every`, that key is rejected; with `.some`,
 *       accepted. The current dynamic-pattern set is mutually exclusive
 *       (e.g., `agent_skills.foo` matches the agent_skills regex but not
 *       review/features/claude_md_assembly/model_profile_overrides), so
 *       any single dynamic-key sample suffices.
 *
 *   M3: `return true` -> `return false` on the early-return line
 *       Killer: a test that uses a known-valid static key and asserts
 *       the boolean true (not just "non-falsy" or "no throw"). A
 *       polarity flip turns the true into false; the assertion catches it.
 *
 *   M4: `if (VALID_CONFIG_KEYS.has(keyPath)) return true;` -> remove the
 *       guard entirely (return DYNAMIC_KEY_PATTERNS.some(...) always).
 *       Killer: same as M1 -- static keys that don't match any dynamic
 *       pattern would be wrongly rejected.
 *
 * These tests exercise the lib's PUBLIC SURFACE (isValidConfigKey)
 * with structured inputs and assert on typed boolean outputs. No regex
 * on source code; no source-grep.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  VALID_CONFIG_KEYS,
  DYNAMIC_KEY_PATTERNS,
  isValidConfigKey,
} = require('../get-shit-done/bin/lib/config-schema.cjs');

describe('Bug #2986: M1/M4 -- isValidConfigKey returns true for EVERY static key in VALID_CONFIG_KEYS', () => {
  // Stryker mutants like `if (false) return true;` would silently flip
  // every static key to "rejected" because none of the static keys match
  // any dynamic pattern by design. This parameterized test is the
  // mutation-kill equivalent for that branch.
  for (const key of VALID_CONFIG_KEYS) {
    test(`isValidConfigKey('${key}') === true`, () => {
      assert.strictEqual(isValidConfigKey(key), true,
        `static config key '${key}' must be accepted (catches Stryker mutant on the static-key fast path)`);
    });
  }
});

describe('Bug #2986: M2 -- DYNAMIC_KEY_PATTERNS.some semantic, not .every', () => {
  // Each pattern has a representative key that matches ONLY that pattern
  // (mutually exclusive with the others by design) AND is NOT a member of
  // VALID_CONFIG_KEYS. The static-key fast-path returns true before
  // DYNAMIC_KEY_PATTERNS.some() ever runs, so any rep key that's also in
  // VALID_CONFIG_KEYS gives the M2 killer zero coverage for that pattern
  // (#3005 CR: this caught features.thinking_partner, which IS in static).
  // A reserved-prefix-style placeholder name is used for `features` so the
  // dynamic path is the only way to reach `true`.
  const patternRepresentatives = [
    { key: 'agent_skills.gsd-planner',                           topLevel: 'agent_skills' },
    { key: 'review.models.claude',                               topLevel: 'review' },
    { key: 'features.some_dynamic_feature',                      topLevel: 'features' },
    { key: 'claude_md_assembly.blocks.intro',                    topLevel: 'claude_md_assembly' },
    { key: 'model_profile_overrides.codex.opus',                 topLevel: 'model_profile_overrides' },
  ];

  for (const { key, topLevel } of patternRepresentatives) {
    test(`isValidConfigKey('${key}') === true (matches '${topLevel}' pattern via dynamic path)`, () => {
      // Invariant: the rep key MUST NOT be in the static set. Otherwise the
      // static fast-path short-circuits and the dynamic-pattern .some() is
      // never invoked, so a mutation removing this entry from
      // DYNAMIC_KEY_PATTERNS would survive.
      assert.strictEqual(VALID_CONFIG_KEYS.has(key), false,
        `representative key '${key}' must NOT be in VALID_CONFIG_KEYS — otherwise the static fast-path masks the dynamic-pattern test (#3005 CR)`);
      assert.strictEqual(isValidConfigKey(key), true,
        `dynamic key '${key}' must be accepted via DYNAMIC_KEY_PATTERNS.some`);
      // Verify mutual exclusivity: only one pattern matches this key.
      const matchCount = DYNAMIC_KEY_PATTERNS.filter((p) => p.test(key)).length;
      assert.strictEqual(matchCount, 1,
        `mutual-exclusivity invariant: '${key}' must match exactly 1 pattern, matched ${matchCount}. ` +
        `If this fails, dynamic-pattern overlap was introduced and the .some-vs-.every mutation killer breaks.`);
    });
  }
});

describe('Bug #2986: M3 -- polarity assertion (true is true, not just truthy)', () => {
  // Stryker mutants that flip `return true` to `return false` are killed
  // by strictEqual against the boolean true. assert.ok would tolerate any
  // truthy value (e.g., a non-empty string returned by a different mutation).
  test('isValidConfigKey returns the literal boolean true for static keys', () => {
    const result = isValidConfigKey('model_profile');
    assert.strictEqual(result, true);
    assert.strictEqual(typeof result, 'boolean');
  });

  test('isValidConfigKey returns the literal boolean false for unknown keys', () => {
    const result = isValidConfigKey('totally_unknown_key_xyz');
    assert.strictEqual(result, false);
    assert.strictEqual(typeof result, 'boolean');
  });

  test('isValidConfigKey returns false for a dynamic-pattern-shape key under a non-existent topLevel', () => {
    // E.g., `unrelated.models.claude` syntactically resembles a dynamic
    // pattern but no DYNAMIC_KEY_PATTERN owns the `unrelated` topLevel.
    // A mutant that loosens the regex anchors would falsely accept this.
    assert.strictEqual(isValidConfigKey('unrelated.models.claude'), false);
  });
});

describe('Bug #2986: anchor-tightening (catches mutants that loosen ^ or $ in regexes)', () => {
  // Each dynamic regex is anchored. Mutants that drop ^ or $ would
  // accept too much. These keys differ from a valid one by ONE character
  // beyond the documented shape; they must be rejected.
  const overshoot = [
    { key: 'agent_skills.gsd-planner.extra',                     reason: 'agent_skills regex must not allow trailing dot-segment' },
    { key: 'agent_skills.',                                      reason: 'agent_skills regex requires non-empty agent name' },
    { key: 'review.models.',                                     reason: 'review.models regex requires non-empty cli name' },
    { key: 'features.bad name with spaces',                      reason: 'features regex disallows spaces' },
    { key: 'model_profile_overrides.codex.gpt5',                 reason: 'model_profile_overrides tier is enum-restricted to opus|sonnet|haiku' },
    { key: 'model_profile_overrides.codex',                      reason: 'model_profile_overrides requires .<tier> suffix' },
  ];

  for (const { key, reason } of overshoot) {
    test(`isValidConfigKey('${key}') === false -- ${reason}`, () => {
      assert.strictEqual(isValidConfigKey(key), false,
        `'${key}' must be rejected (catches anchor/charset-loosening mutants)`);
    });
  }
});
