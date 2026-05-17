'use strict';

/**
 * Parity test: configuration.generated.cjs (CJS) vs sdk/dist/configuration/index.js (ESM).
 *
 * For every fixture in the vitest pinning tests, asserts that both sides produce
 * identical output. This ensures the generator faithfully replicates the TS source.
 *
 * Uses node:test + dynamic import() for the ESM side.
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ─── CJS side (synchronous require) ──────────────────────────────────────────

const cjs = require('../get-shit-done/bin/lib/configuration.generated.cjs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-parity-'));
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  return dir;
}

function writeConfig(dir, data) {
  fs.writeFileSync(path.join(dir, '.planning', 'config.json'), JSON.stringify(data, null, 2));
}

function readConfigRaw(dir) {
  return fs.readFileSync(path.join(dir, '.planning', 'config.json'), 'utf-8');
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── ESM side (loaded once via before()) ─────────────────────────────────────

let esm;

before(async () => {
  esm = await import('../sdk/dist/configuration/index.js');
});

// ─── Parity helper ────────────────────────────────────────────────────────────

/**
 * Deep-equal assertion that normalizes Sets to arrays for comparison.
 */
function assertDeepEqual(label, actual, expected) {
  const normalize = (v) => JSON.parse(JSON.stringify(v, (_k, val) =>
    val instanceof Set ? [...val].sort() : val
  ));
  assert.deepStrictEqual(normalize(actual), normalize(expected), `${label} mismatch`);
}

// ─── CONFIG_DEFAULTS parity ───────────────────────────────────────────────────

describe('CONFIG_DEFAULTS parity', () => {
  test('model_profile matches', () => {
    assert.strictEqual(cjs.CONFIG_DEFAULTS.model_profile, esm.CONFIG_DEFAULTS.model_profile);
  });

  test('git section matches', () => {
    assertDeepEqual('git', cjs.CONFIG_DEFAULTS.git, esm.CONFIG_DEFAULTS.git);
  });

  test('workflow section matches', () => {
    assertDeepEqual('workflow', cjs.CONFIG_DEFAULTS.workflow, esm.CONFIG_DEFAULTS.workflow);
  });

  test('hooks section matches', () => {
    assertDeepEqual('hooks', cjs.CONFIG_DEFAULTS.hooks, esm.CONFIG_DEFAULTS.hooks);
  });
});

// ─── VALID_CONFIG_KEYS parity ─────────────────────────────────────────────────

describe('VALID_CONFIG_KEYS parity', () => {
  test('same size', () => {
    assert.strictEqual(cjs.VALID_CONFIG_KEYS.size, esm.VALID_CONFIG_KEYS.size);
  });

  test('same entries', () => {
    for (const key of esm.VALID_CONFIG_KEYS) {
      assert.ok(cjs.VALID_CONFIG_KEYS.has(key), `CJS missing key: ${key}`);
    }
    for (const key of cjs.VALID_CONFIG_KEYS) {
      assert.ok(esm.VALID_CONFIG_KEYS.has(key), `ESM missing key: ${key}`);
    }
  });
});

// ─── DYNAMIC_KEY_PATTERNS parity ─────────────────────────────────────────────

describe('DYNAMIC_KEY_PATTERNS parity', () => {
  test('same length', () => {
    assert.strictEqual(cjs.DYNAMIC_KEY_PATTERNS.length, esm.DYNAMIC_KEY_PATTERNS.length);
  });

  test('same topLevel and source strings', () => {
    for (let i = 0; i < esm.DYNAMIC_KEY_PATTERNS.length; i++) {
      assert.strictEqual(cjs.DYNAMIC_KEY_PATTERNS[i].topLevel, esm.DYNAMIC_KEY_PATTERNS[i].topLevel, `topLevel[${i}]`);
      assert.strictEqual(cjs.DYNAMIC_KEY_PATTERNS[i].source, esm.DYNAMIC_KEY_PATTERNS[i].source, `source[${i}]`);
    }
  });

  test('test functions produce same results', () => {
    const sampleKeys = [
      'agent_skills.planner',
      'agent_skills.executor',
      'review.models.ollama',
      'features.thinking_partner',
      'claude_md_assembly.blocks.intro',
      'model_profile_overrides.openai.opus',
      'models.planning',
      'dynamic_routing.enabled',
      'model_overrides.my-agent',
      'workflow.research',
      'unknown_key',
    ];
    for (const key of sampleKeys) {
      for (let i = 0; i < esm.DYNAMIC_KEY_PATTERNS.length; i++) {
        const esmResult = esm.DYNAMIC_KEY_PATTERNS[i].test(key);
        const cjsResult = cjs.DYNAMIC_KEY_PATTERNS[i].test(key);
        assert.strictEqual(cjsResult, esmResult, `pattern[${i}].test('${key}')`);
      }
    }
  });
});

// ─── normalizeLegacyKeys parity ───────────────────────────────────────────────

describe('normalizeLegacyKeys parity', () => {
  test('branching_strategy migration', () => {
    const input = { branching_strategy: 'phase' };
    const esmR = esm.normalizeLegacyKeys(input);
    const cjsR = cjs.normalizeLegacyKeys(input);
    assertDeepEqual('parsed', cjsR.parsed, esmR.parsed);
    assertDeepEqual('normalizations', cjsR.normalizations, esmR.normalizations);
  });

  test('sub_repos migration', () => {
    const input = { sub_repos: ['app1', 'app2'] };
    const esmR = esm.normalizeLegacyKeys(input);
    const cjsR = cjs.normalizeLegacyKeys(input);
    assertDeepEqual('parsed', cjsR.parsed, esmR.parsed);
    assertDeepEqual('normalizations', cjsR.normalizations, esmR.normalizations);
  });

  test('multiRepo migration', () => {
    const input = { multiRepo: true };
    const esmR = esm.normalizeLegacyKeys(input);
    const cjsR = cjs.normalizeLegacyKeys(input);
    assertDeepEqual('parsed', cjsR.parsed, esmR.parsed);
    assert.strictEqual(cjsR.normalizations.length, esmR.normalizations.length);
    assert.strictEqual(cjsR.normalizations[0].requiresFilesystem, esmR.normalizations[0].requiresFilesystem);
  });

  test('depth: comprehensive migration', () => {
    const input = { depth: 'comprehensive' };
    const esmR = esm.normalizeLegacyKeys(input);
    const cjsR = cjs.normalizeLegacyKeys(input);
    assertDeepEqual('parsed', cjsR.parsed, esmR.parsed);
  });

  test('already-normalized returns empty normalizations', () => {
    const input = { git: { branching_strategy: 'phase' } };
    const esmR = esm.normalizeLegacyKeys(input);
    const cjsR = cjs.normalizeLegacyKeys(input);
    assert.strictEqual(cjsR.normalizations.length, 0);
    assert.strictEqual(esmR.normalizations.length, 0);
  });

  test('idempotent — second call returns empty normalizations', () => {
    const input = { branching_strategy: 'milestone' };
    const first_cjs = cjs.normalizeLegacyKeys(input);
    const second_cjs = cjs.normalizeLegacyKeys(first_cjs.parsed);
    const first_esm = esm.normalizeLegacyKeys(input);
    const second_esm = esm.normalizeLegacyKeys(first_esm.parsed);
    assert.strictEqual(second_cjs.normalizations.length, 0);
    assert.strictEqual(second_esm.normalizations.length, 0);
    assertDeepEqual('second_parsed', second_cjs.parsed, second_esm.parsed);
  });
});

// ─── mergeDefaults parity ─────────────────────────────────────────────────────

describe('mergeDefaults parity', () => {
  test('empty input returns CONFIG_DEFAULTS shape', () => {
    const esmR = esm.mergeDefaults({});
    const cjsR = cjs.mergeDefaults({});
    assert.strictEqual(cjsR.model_profile, esmR.model_profile);
    assertDeepEqual('git', cjsR.git, esmR.git);
    assertDeepEqual('workflow', cjsR.workflow, esmR.workflow);
    assertDeepEqual('hooks', cjsR.hooks, esmR.hooks);
  });

  test('partial nested preserves siblings', () => {
    const input = { git: { base_branch: 'main' } };
    const esmR = esm.mergeDefaults(input);
    const cjsR = cjs.mergeDefaults(input);
    assert.strictEqual(cjsR.git.base_branch, esmR.git.base_branch);
    assert.strictEqual(cjsR.git.branching_strategy, esmR.git.branching_strategy);
  });

  test('boolean false preserved', () => {
    const input = { workflow: { research: false } };
    const esmR = esm.mergeDefaults(input);
    const cjsR = cjs.mergeDefaults(input);
    assert.strictEqual(cjsR.workflow.research, false);
    assert.strictEqual(esmR.workflow.research, false);
  });

  test('null preserved', () => {
    const input = { project_code: null };
    const esmR = esm.mergeDefaults(input);
    const cjsR = cjs.mergeDefaults(input);
    assert.strictEqual(cjsR.project_code, null);
    assert.strictEqual(esmR.project_code, null);
  });
});

// ─── loadConfig parity ────────────────────────────────────────────────────────

describe('loadConfig parity', () => {
  test('missing config.json returns defaults', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-parity-lc-'));
    try {
      const esmR = await esm.loadConfig(dir);
      const cjsR = await cjs.loadConfig(dir);
      assert.strictEqual(cjsR.model_profile, esmR.model_profile);
      assertDeepEqual('git', cjsR.git, esmR.git);
    } finally {
      cleanup(dir);
    }
  });

  test('empty {} config.json returns defaults', async () => {
    const dir = makeTmpProject();
    writeConfig(dir, {});
    try {
      const esmR = await esm.loadConfig(dir);
      const cjsR = await cjs.loadConfig(dir);
      assert.strictEqual(cjsR.model_profile, esmR.model_profile);
    } finally {
      cleanup(dir);
    }
  });

  test('nested git.branching_strategy preserved', async () => {
    const dir = makeTmpProject();
    writeConfig(dir, { git: { branching_strategy: 'phase' } });
    try {
      const esmR = await esm.loadConfig(dir);
      const cjsR = await cjs.loadConfig(dir);
      assert.strictEqual(cjsR.git.branching_strategy, 'phase');
      assert.strictEqual(esmR.git.branching_strategy, 'phase');
    } finally {
      cleanup(dir);
    }
  });

  test('legacy top-level branching_strategy normalized, disk unchanged', async () => {
    const dir = makeTmpProject();
    writeConfig(dir, { branching_strategy: 'phase' });
    const before = readConfigRaw(dir);
    try {
      const esmR = await esm.loadConfig(dir);
      const cjsR = await cjs.loadConfig(dir);
      assert.strictEqual(cjsR.git.branching_strategy, 'phase');
      assert.strictEqual(esmR.git.branching_strategy, 'phase');
      // Disk must be unchanged
      assert.strictEqual(readConfigRaw(dir), before);
    } finally {
      cleanup(dir);
    }
  });

  test('throws on malformed JSON', async () => {
    const dir = makeTmpProject();
    fs.writeFileSync(path.join(dir, '.planning', 'config.json'), '{bad json');
    try {
      await assert.rejects(() => cjs.loadConfig(dir), /parse|invalid|json/i);
      await assert.rejects(() => esm.loadConfig(dir), /parse|invalid|json/i);
    } finally {
      cleanup(dir);
    }
  });
});

// ─── migrateOnDisk parity ─────────────────────────────────────────────────────

describe('migrateOnDisk parity', () => {
  test('no-op for already-normalized config', async () => {
    const dir = makeTmpProject();
    writeConfig(dir, { git: { branching_strategy: 'phase' } });
    try {
      const esmR = await esm.migrateOnDisk(dir);
      // Reset file for CJS test
      writeConfig(dir, { git: { branching_strategy: 'phase' } });
      const cjsR = await cjs.migrateOnDisk(dir);
      assert.strictEqual(cjsR.migrated, false);
      assert.strictEqual(esmR.migrated, false);
      assert.strictEqual(cjsR.wrote, null);
      assert.strictEqual(esmR.wrote, null);
    } finally {
      cleanup(dir);
    }
  });

  test('migrates legacy key and writes disk', async () => {
    const dirEsm = makeTmpProject();
    const dirCjs = makeTmpProject();
    writeConfig(dirEsm, { branching_strategy: 'phase' });
    writeConfig(dirCjs, { branching_strategy: 'phase' });
    try {
      const esmR = await esm.migrateOnDisk(dirEsm);
      const cjsR = await cjs.migrateOnDisk(dirCjs);
      assert.strictEqual(cjsR.migrated, true);
      assert.strictEqual(esmR.migrated, true);
      assert.ok(cjsR.wrote !== null);
      assert.ok(esmR.wrote !== null);
      // Both should have normalized the disk file
      const cjsDisk = JSON.parse(readConfigRaw(dirCjs));
      const esmDisk = JSON.parse(readConfigRaw(dirEsm));
      assert.strictEqual(cjsDisk.branching_strategy, undefined);
      assert.strictEqual(esmDisk.branching_strategy, undefined);
      assert.strictEqual(cjsDisk.git?.branching_strategy, 'phase');
      assert.strictEqual(esmDisk.git?.branching_strategy, 'phase');
    } finally {
      cleanup(dirEsm);
      cleanup(dirCjs);
    }
  });

  test('missing file returns migrated:false, wrote:null', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-parity-md-'));
    try {
      const esmR = await esm.migrateOnDisk(dir);
      const cjsR = await cjs.migrateOnDisk(dir);
      assert.strictEqual(cjsR.migrated, false);
      assert.strictEqual(esmR.migrated, false);
      assert.strictEqual(cjsR.wrote, null);
      assert.strictEqual(esmR.wrote, null);
    } finally {
      cleanup(dir);
    }
  });
});
