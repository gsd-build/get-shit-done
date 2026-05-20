'use strict';
/**
 * Regression test for #3735: PROFILES.core must include 'surface' in its
 * resolved closure so that --profile=core users can expand via
 * /gsd:surface enable <cluster> — the advertised use-case from ADR-0011.
 *
 * Stage 2 (RED): This test must fail before the fix is applied.
 * Stage 3 (GREEN): This test must pass after 'surface' is added to PROFILES.core.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  PROFILES,
  resolveProfile,
  loadSkillsManifest,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

describe('PROFILES.core — ADR-0011 expand contract', () => {
  test("PROFILES.core includes 'surface' so users can expand via /gsd:surface enable", () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['core'], manifest });

    assert.ok(result.skills instanceof Set,
      'resolveProfile must return a skills Set for core profile');

    // The primary assertion: surface must be in the resolved closure.
    // ADR-0011 documents that --profile=core users expand via /gsd:surface enable <cluster>.
    // That sub-command is only available if surface.md is staged — which requires it to be
    // in the resolved set for the core profile.
    assert.ok(result.skills.has('surface'),
      `PROFILES.core resolved closure must include 'surface'; got: [${[...result.skills].sort().join(', ')}]`);
  });

  // Counter-test: 'forensics' is NOT in core — proves the assertion above is selective,
  // not vacuously true for all skills.
  test("PROFILES.core does NOT include 'forensics' (selective assertion counter-check)", () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['core'], manifest });

    assert.ok(result.skills instanceof Set);
    assert.ok(!result.skills.has('forensics'),
      `'forensics' should NOT be in core closure — it is a specialist skill, not a core loop skill`);
  });
});
