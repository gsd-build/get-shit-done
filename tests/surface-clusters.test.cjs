'use strict';
/**
 * Tests for CLUSTERS data structure integrity.
 * Verifies every cluster member is a real skill stem and all skills are covered.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { CLUSTERS, allClusteredSkills } = require('../get-shit-done/bin/lib/clusters.cjs');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

function realSkillStems() {
  const entries = fs.readdirSync(COMMANDS_DIR, { withFileTypes: true });
  return new Set(
    entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name.slice(0, -3))
  );
}

describe('CLUSTERS data structure', () => {
  test('no cluster is empty', () => {
    for (const [name, members] of Object.entries(CLUSTERS)) {
      assert.ok(members.length > 0, `cluster ${name} must not be empty`);
    }
  });

  test('every cluster member is a real skill stem in commands/gsd/', () => {
    const realStems = realSkillStems();
    const mismatches = [];
    for (const [cluster, members] of Object.entries(CLUSTERS)) {
      for (const stem of members) {
        if (!realStems.has(stem)) {
          mismatches.push(`${cluster}: "${stem}" not found in commands/gsd/`);
        }
      }
    }
    assert.deepStrictEqual(mismatches, [], `Cluster members missing from disk:\n${mismatches.join('\n')}`);
  });

  test('union of all clusters covers every skill in commands/gsd/', () => {
    const realStems = realSkillStems();
    const clustered = allClusteredSkills();
    const uncategorized = [];
    for (const stem of realStems) {
      if (!clustered.has(stem)) uncategorized.push(stem);
    }
    assert.deepStrictEqual(
      uncategorized,
      [],
      `Uncategorized skills (not in any cluster):\n${uncategorized.sort().join('\n')}`
    );
  });

  test('CLUSTERS is frozen (immutable)', () => {
    assert.ok(Object.isFrozen(CLUSTERS), 'CLUSTERS must be frozen');
    for (const [name, members] of Object.entries(CLUSTERS)) {
      assert.ok(Object.isFrozen(members), `CLUSTERS.${name} must be frozen`);
    }
  });

  test('cluster names match expected set from research memo §3.2', () => {
    const expectedClusterNames = new Set([
      'core_loop',
      'audit_review',
      'milestone',
      'research_ideate',
      'workspace_state',
      'docs',
      'ui',
      'ai_eval',
      'ns_meta',
      'utility',
    ]);
    const actualClusterNames = new Set(Object.keys(CLUSTERS));
    for (const name of expectedClusterNames) {
      assert.ok(actualClusterNames.has(name), `expected cluster "${name}" missing from CLUSTERS`);
    }
  });

  test('allClusteredSkills returns a Set containing all cluster members', () => {
    const result = allClusteredSkills();
    assert.ok(result instanceof Set, 'allClusteredSkills() must return a Set');
    for (const members of Object.values(CLUSTERS)) {
      for (const stem of members) {
        assert.ok(result.has(stem), `allClusteredSkills() missing "${stem}"`);
      }
    }
  });
});
