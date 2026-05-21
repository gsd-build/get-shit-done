'use strict';
/**
 * Runtime Artifact Layout Module (ADR-3660) — surface seam.
 * Consolidated from: surface-apply, surface-resolve, surface-state,
 *   surface-clusters, surface-list (5 files deleted).
 * See also: runtime-artifact-layout.test.cjs, runtime-artifact-layout-install-profiles.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { writeSurface, readSurface, resolveSurface, listSurface, applySurface } = require('../get-shit-done/bin/lib/surface.cjs');
const { loadSkillsManifest, writeActiveProfile, resolveProfile } = require('../get-shit-done/bin/lib/install-profiles.cjs');
const { resolveRuntimeArtifactLayout } = require('../get-shit-done/bin/lib/runtime-artifact-layout.cjs');
const { CLUSTERS, allClusteredSkills } = require('../get-shit-done/bin/lib/clusters.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

// ─── helpers ────────────────────────────────────────────────────────────────

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'gsd-ral-surf-'));
}

function createFixtureRuntime() {
  const base = createTempDir('gsd-surface-apply-');
  const runtimeConfigDir = base;
  const commandsDir = path.join(runtimeConfigDir, 'commands', 'gsd');
  const agentsDir = path.join(runtimeConfigDir, 'agents');
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });
  return { base, runtimeConfigDir, commandsDir, agentsDir };
}

function realManifest() {
  return loadSkillsManifest(REAL_COMMANDS_DIR);
}

function readFrontmatterDescription(markdown) {
  const lines = markdown.split('\n');
  if (lines[0].trim() !== '---') return '';
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    if (key !== 'description') continue;
    return line.slice(sep + 1).trim();
  }
  return '';
}

// ─── applySurface ────────────────────────────────────────────────────────────

describe('applySurface', () => {
  test('core profile: only core skills appear in commandsDir', (t) => {
    const { base, runtimeConfigDir, commandsDir } = createFixtureRuntime();
    t.after(() => cleanup(base));
    writeActiveProfile(runtimeConfigDir, 'core');
    writeSurface(runtimeConfigDir, {
      baseProfile: 'core',
      disabledClusters: [],
      explicitAdds: [],
      explicitRemoves: [],
    });
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const layout = resolveRuntimeArtifactLayout('claude', runtimeConfigDir, 'local');
    const resolved = applySurface(runtimeConfigDir, layout, manifest, CLUSTERS);

    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      assert.ok(fs.existsSync(path.join(REAL_COMMANDS_DIR, file)), `unexpected file: ${file}`);
    }
    const expectedCore = [...resolved.skills].map(stem => `${stem}.md`).sort();
    assert.deepStrictEqual(
      [...files].sort(),
      expectedCore,
      'commandsDir should contain exactly core commands'
    );
  });

  test('removes superseded files when profile shrinks', (t) => {
    const { base, runtimeConfigDir, commandsDir } = createFixtureRuntime();
    t.after(() => cleanup(base));
    writeActiveProfile(runtimeConfigDir, 'standard');
    writeSurface(runtimeConfigDir, {
      baseProfile: 'standard',
      disabledClusters: [],
      explicitAdds: [],
      explicitRemoves: [],
    });
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const layout = resolveRuntimeArtifactLayout('claude', runtimeConfigDir, 'local');
    applySurface(runtimeConfigDir, layout, manifest, CLUSTERS);

    const afterStandard = new Set(fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')));

    writeSurface(runtimeConfigDir, {
      baseProfile: 'core',
      disabledClusters: [],
      explicitAdds: [],
      explicitRemoves: [],
    });
    const resolvedCore = applySurface(runtimeConfigDir, layout, manifest, CLUSTERS);

    const afterCore = new Set(fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')));

    assert.ok(afterCore.size <= afterStandard.size, 'core should have fewer or equal files than standard');

    const expectedCore = [...resolvedCore.skills].map(stem => `${stem}.md`).sort();
    assert.deepStrictEqual(
      [...afterCore].sort(),
      expectedCore,
      'afterCore should contain exactly core commands'
    );

    for (const file of afterCore) {
      assert.ok(
        fs.existsSync(path.join(REAL_COMMANDS_DIR, file)),
        `file in commandsDir not a real skill: ${file}`
      );
    }
  });

  test('leaves non-gsd .md files alone in agentsDir', (t) => {
    const { base, runtimeConfigDir, agentsDir } = createFixtureRuntime();
    t.after(() => cleanup(base));
    const foreignAgent = path.join(agentsDir, 'my-custom-agent.md');
    fs.writeFileSync(foreignAgent, '# custom agent\n', 'utf8');

    writeActiveProfile(runtimeConfigDir, 'core');
    writeSurface(runtimeConfigDir, {
      baseProfile: 'core',
      disabledClusters: [],
      explicitAdds: [],
      explicitRemoves: [],
    });
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const layout = resolveRuntimeArtifactLayout('claude', runtimeConfigDir, 'local');
    applySurface(runtimeConfigDir, layout, manifest, CLUSTERS);

    assert.ok(fs.existsSync(foreignAgent), 'non-gsd agent file should not be touched');
  });

  test('adds missing skill files from install source', (t) => {
    const { base, runtimeConfigDir, commandsDir } = createFixtureRuntime();
    t.after(() => cleanup(base));
    writeActiveProfile(runtimeConfigDir, 'core');
    writeSurface(runtimeConfigDir, {
      baseProfile: 'core',
      disabledClusters: [],
      explicitAdds: [],
      explicitRemoves: [],
    });
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const layout = resolveRuntimeArtifactLayout('claude', runtimeConfigDir, 'local');
    applySurface(runtimeConfigDir, layout, manifest, CLUSTERS);

    assert.ok(
      fs.existsSync(path.join(commandsDir, 'help.md')),
      'help.md should be copied from install source'
    );
    assert.ok(
      fs.existsSync(path.join(commandsDir, 'new-project.md')),
      'new-project.md should be copied from install source'
    );
  });

  test('_syncGsdDir skills kind: adds missing skill dirs, removes stale prefix-matched dirs, preserves foreign dirs', (t) => {
    const { _syncGsdDir } = require('../get-shit-done/bin/lib/surface.cjs');

    const base = createTempDir('gsd-surface-skills-');
    t.after(() => cleanup(base));
    const stagedDir = path.join(base, 'staged');
    const destDir = path.join(base, 'dest');
    fs.mkdirSync(destDir, { recursive: true });

    const stem1 = 'gsd-help';
    const stem2 = 'gsd-update';
    fs.mkdirSync(path.join(stagedDir, stem1), { recursive: true });
    fs.writeFileSync(path.join(stagedDir, stem1, 'SKILL.md'), '# help\n', 'utf8');
    fs.mkdirSync(path.join(stagedDir, stem2), { recursive: true });
    fs.writeFileSync(path.join(stagedDir, stem2, 'SKILL.md'), '# update\n', 'utf8');

    const staleDir = path.join(destDir, 'gsd-old-skill');
    fs.mkdirSync(staleDir, { recursive: true });
    fs.writeFileSync(path.join(staleDir, 'SKILL.md'), '# old\n', 'utf8');

    const foreignDir = path.join(destDir, 'my-custom-skill');
    fs.mkdirSync(foreignDir, { recursive: true });
    fs.writeFileSync(path.join(foreignDir, 'SKILL.md'), '# custom\n', 'utf8');

    const skillsKind = { kind: 'skills', destSubpath: 'skills', prefix: 'gsd-', stage: () => stagedDir };

    // Build a minimal manifest that includes the GSD-owned stems so that the
    // manifest-membership gate (Finding 1 fix) correctly identifies gsd-old-skill
    // as GSD-owned and prunes it. Without a manifest the new code conservatively
    // preserves all gsd-* dirs it cannot confirm are GSD-owned.
    const manifest = new Map([
      ['help', []],
      ['update', []],
      ['old-skill', []],  // GSD-owned stale stem — must be pruned when not in staged set
    ]);

    _syncGsdDir(stagedDir, destDir, skillsKind, manifest);

    assert.ok(fs.existsSync(path.join(destDir, stem1, 'SKILL.md')), 'gsd-help/SKILL.md should be copied');
    assert.ok(fs.existsSync(path.join(destDir, stem2, 'SKILL.md')), 'gsd-update/SKILL.md should be copied');
    // stale gsd- dir removed (it's in the manifest so it is GSD-owned, but not in staged set)
    assert.ok(!fs.existsSync(staleDir), 'stale gsd-old-skill dir should be removed');
    assert.ok(fs.existsSync(foreignDir), 'my-custom-skill dir should be preserved');
  });

  test('applySurface recreates missing destination directories', (t) => {
    const base = createTempDir('gsd-surface-missing-dest-');
    t.after(() => cleanup(base));
    const runtimeConfigDir = base;
    writeActiveProfile(runtimeConfigDir, 'core');
    writeSurface(runtimeConfigDir, {
      baseProfile: 'core',
      disabledClusters: [],
      explicitAdds: [],
      explicitRemoves: [],
    });
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const layout = resolveRuntimeArtifactLayout('claude', runtimeConfigDir, 'local');
    applySurface(runtimeConfigDir, layout, manifest, CLUSTERS);

    const commandsDir = path.join(runtimeConfigDir, 'commands', 'gsd');
    assert.ok(fs.existsSync(commandsDir), 'commands/gsd dir should be created even if initially absent');
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
    assert.ok(files.length > 0, 'commands/gsd should contain staged skill files');
    assert.ok(files.includes('help.md'), 'help.md should be present after applySurface on missing dest');
  });

  test('Hermes profile shrink: stale GSD skill dirs are removed; user skills preserved', (t) => {
    const { _syncGsdDir } = require('../get-shit-done/bin/lib/surface.cjs');

    const base = createTempDir('gsd-surface-hermes-shrink-');
    t.after(() => cleanup(base));
    const stagedDir = path.join(base, 'staged');
    const destDir = path.join(base, 'dest');
    fs.mkdirSync(destDir, { recursive: true });

    fs.mkdirSync(path.join(stagedDir, 'gsd-executor'), { recursive: true });
    fs.writeFileSync(path.join(stagedDir, 'gsd-executor', 'SKILL.md'), '# executor\n', 'utf8');

    fs.mkdirSync(path.join(destDir, 'gsd-executor'), { recursive: true });
    fs.writeFileSync(path.join(destDir, 'gsd-executor', 'SKILL.md'), '# executor\n', 'utf8');
    fs.mkdirSync(path.join(destDir, 'gsd-planner'), { recursive: true });
    fs.writeFileSync(path.join(destDir, 'gsd-planner', 'SKILL.md'), '# planner\n', 'utf8');
    fs.mkdirSync(path.join(destDir, 'user-skill'), { recursive: true });
    fs.writeFileSync(path.join(destDir, 'user-skill', 'SKILL.md'), '# user\n', 'utf8');

    const manifest = new Map([
      ['gsd-executor', []],
      ['gsd-planner', []],
    ]);

    const hermesKind = { kind: 'skills', destSubpath: 'skills/gsd', prefix: '', stage: () => stagedDir };
    _syncGsdDir(stagedDir, destDir, hermesKind, manifest);

    assert.ok(
      fs.existsSync(path.join(destDir, 'gsd-executor', 'SKILL.md')),
      'gsd-executor should be kept (in staged set)'
    );
    assert.ok(
      !fs.existsSync(path.join(destDir, 'gsd-planner')),
      'gsd-planner should be removed (in manifest but not in staged set — stale GSD skill)'
    );
    assert.ok(
      fs.existsSync(path.join(destDir, 'user-skill', 'SKILL.md')),
      'user-skill should be preserved (not in manifest — user-owned)'
    );
  });

  test('_syncGsdDir skills kind (hermes): preserves non-GSD user dir under skills/gsd/ when kindPrefix is empty', (t) => {
    const { _syncGsdDir } = require('../get-shit-done/bin/lib/surface.cjs');

    const base = createTempDir('gsd-surface-hermes-');
    t.after(() => cleanup(base));
    const stagedDir = path.join(base, 'staged');
    const destDir = path.join(base, 'dest');
    fs.mkdirSync(destDir, { recursive: true });

    const stem1 = 'help';
    fs.mkdirSync(path.join(stagedDir, stem1), { recursive: true });
    fs.writeFileSync(path.join(stagedDir, stem1, 'SKILL.md'), '# help\n', 'utf8');

    const userDir = path.join(destDir, 'user-custom-skill');
    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(path.join(userDir, 'SKILL.md'), '# user custom\n', 'utf8');

    const hermesKind = { kind: 'skills', destSubpath: 'skills/gsd', prefix: '', stage: () => stagedDir };
    _syncGsdDir(stagedDir, destDir, hermesKind);

    assert.ok(fs.existsSync(userDir), 'user-custom-skill dir must be preserved when kindPrefix is empty (Hermes)');
    assert.ok(fs.existsSync(path.join(destDir, stem1, 'SKILL.md')), 'GSD help/SKILL.md must be copied');
  });
});

// ─── resolveSurface ──────────────────────────────────────────────────────────

describe('resolveSurface', () => {
  test('no surface state + core base profile → identical to resolveProfile core', () => {
    const dir = tmpDir('gsd-surface-resolve-');
    try {
      writeActiveProfile(dir, 'core');
      const manifest = realManifest();
      const surfaceResolved = resolveSurface(dir, manifest, CLUSTERS);
      const profileResolved = resolveProfile({ modes: ['core'], manifest });

      assert.ok(surfaceResolved.skills instanceof Set);
      assert.ok(profileResolved.skills instanceof Set);
      assert.deepStrictEqual(
        [...surfaceResolved.skills].sort(),
        [...profileResolved.skills].sort(),
        'surface with no state should equal profile resolution'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('standard base + disabledClusters:["utility"] removes utility skills', () => {
    const dir = tmpDir('gsd-surface-resolve-');
    try {
      writeActiveProfile(dir, 'standard');
      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: ['utility'],
        explicitAdds: [],
        explicitRemoves: [],
      });
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      assert.ok(resolved.skills instanceof Set);
      for (const stem of CLUSTERS.utility) {
        const standardResolved = resolveProfile({ modes: ['standard'], manifest });
        if (standardResolved.skills.has(stem)) {
          assert.ok(
            !resolved.skills.has(stem),
            `"${stem}" should be removed by disabling utility cluster`
          );
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('explicitAdds:["sketch"] adds sketch to a core install', () => {
    const dir = tmpDir('gsd-surface-resolve-');
    try {
      writeActiveProfile(dir, 'core');
      writeSurface(dir, {
        baseProfile: 'core',
        disabledClusters: [],
        explicitAdds: ['sketch'],
        explicitRemoves: [],
      });
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      assert.ok(resolved.skills instanceof Set);
      assert.ok(resolved.skills.has('sketch'), 'sketch must be in resolved skills');

      const sketchRequires = manifest.get('sketch') || [];
      for (const dep of sketchRequires) {
        assert.ok(resolved.skills.has(dep), `transitive dep "${dep}" of sketch must be present`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('explicitRemoves removes individual skill stems', () => {
    const dir = tmpDir('gsd-surface-resolve-');
    try {
      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: ['progress'],
      });
      writeActiveProfile(dir, 'standard');
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      assert.ok(!resolved.skills.has('progress'), '"progress" must be removed by explicitRemoves');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('result is a Set<string> with name property and agents Set', () => {
    const dir = tmpDir('gsd-surface-resolve-');
    try {
      writeActiveProfile(dir, 'core');
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      assert.ok(resolved.skills instanceof Set);
      assert.ok(typeof resolved.name === 'string');
      assert.ok(resolved.agents instanceof Set);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('surface with baseProfile overrides .gsd-profile marker', () => {
    const dir = tmpDir('gsd-surface-resolve-');
    try {
      writeActiveProfile(dir, 'core');
      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);
      const standardResolved = resolveProfile({ modes: ['standard'], manifest });

      assert.deepStrictEqual(
        [...resolved.skills].sort(),
        [...standardResolved.skills].sort(),
        'surface baseProfile takes precedence over marker'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('disabled cluster + explicitAdds can re-add specific skills from disabled cluster', () => {
    const dir = tmpDir('gsd-surface-resolve-');
    try {
      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: ['workspace_state'],
        explicitAdds: ['capture'],
        explicitRemoves: [],
      });
      writeActiveProfile(dir, 'standard');
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      assert.ok(resolved.skills.has('capture'), '"capture" must be present via explicitAdds');
      const standardResolved = resolveProfile({ modes: ['standard'], manifest });
      for (const stem of CLUSTERS.workspace_state) {
        if (stem === 'capture') continue;
        if (standardResolved.skills.has(stem)) {
          assert.ok(
            !resolved.skills.has(stem),
            `"${stem}" should be removed (workspace_state disabled, not explicitly re-added)`
          );
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── readSurface / writeSurface ──────────────────────────────────────────────

describe('readSurface / writeSurface', () => {
  test('round-trips a complete surface state', () => {
    const dir = tmpDir('gsd-surface-state-');
    try {
      const state = {
        baseProfile: 'standard',
        disabledClusters: ['utility'],
        explicitAdds: ['sketch'],
        explicitRemoves: [],
      };
      writeSurface(dir, state);
      const read = readSurface(dir);
      assert.deepStrictEqual(read, state);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('round-trips empty arrays', () => {
    const dir = tmpDir('gsd-surface-state-');
    try {
      const state = {
        baseProfile: 'core',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      };
      writeSurface(dir, state);
      assert.deepStrictEqual(readSurface(dir), state);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('round-trips composed base profile', () => {
    const dir = tmpDir('gsd-surface-state-');
    try {
      const state = {
        baseProfile: 'core,audit',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: ['health'],
      };
      writeSurface(dir, state);
      assert.deepStrictEqual(readSurface(dir), state);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('missing file returns null', () => {
    const dir = tmpDir('gsd-surface-state-');
    try {
      const result = readSurface(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('non-existent directory returns null', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-surface-no-exist-' + Date.now());
    const result = readSurface(ghost);
    assert.strictEqual(result, null);
  });

  test('corrupt JSON returns null', () => {
    const dir = tmpDir('gsd-surface-state-');
    try {
      fs.writeFileSync(path.join(dir, '.gsd-surface.json'), '{not valid json', 'utf8');
      const result = readSurface(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('JSON missing baseProfile field returns null', () => {
    const dir = tmpDir('gsd-surface-state-');
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const result = readSurface(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('JSON with non-array disabledClusters returns null', () => {
    const dir = tmpDir('gsd-surface-state-');
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 'standard', disabledClusters: 'utility', explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const result = readSurface(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('atomic write: result file is never a partial tmp file', () => {
    const dir = tmpDir('gsd-surface-state-');
    try {
      const state = { baseProfile: 'full', disabledClusters: [], explicitAdds: [], explicitRemoves: [] };
      writeSurface(dir, state);
      const files = fs.readdirSync(dir);
      const tmpFiles = files.filter(f => f.includes('.tmp.'));
      assert.deepStrictEqual(tmpFiles, [], 'no tmp files should remain after write');
      assert.ok(files.includes('.gsd-surface.json'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('second write overwrites first', () => {
    const dir = tmpDir('gsd-surface-state-');
    try {
      writeSurface(dir, { baseProfile: 'core', disabledClusters: [], explicitAdds: [], explicitRemoves: [] });
      writeSurface(dir, { baseProfile: 'standard', disabledClusters: ['utility'], explicitAdds: [], explicitRemoves: [] });
      const read = readSurface(dir);
      assert.strictEqual(read.baseProfile, 'standard');
      assert.deepStrictEqual(read.disabledClusters, ['utility']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('writeSurface creates directory if it does not exist', () => {
    const base = tmpDir('gsd-surface-state-');
    const nested = path.join(base, 'skills', 'subdir');
    try {
      writeSurface(nested, { baseProfile: 'full', disabledClusters: [], explicitAdds: [], explicitRemoves: [] });
      assert.ok(fs.existsSync(nested));
      assert.ok(readSurface(nested) !== null);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});

// ─── CLUSTERS data structure ─────────────────────────────────────────────────

describe('CLUSTERS data structure', () => {
  test('no cluster is empty', () => {
    for (const [name, members] of Object.entries(CLUSTERS)) {
      assert.ok(members.length > 0, `cluster ${name} must not be empty`);
    }
  });

  test('every cluster member is a real skill stem in commands/gsd/', () => {
    const entries = fs.readdirSync(REAL_COMMANDS_DIR, { withFileTypes: true });
    const realStems = new Set(
      entries
        .filter(e => e.isFile() && e.name.endsWith('.md'))
        .map(e => e.name.slice(0, -3))
    );
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
    const entries = fs.readdirSync(REAL_COMMANDS_DIR, { withFileTypes: true });
    const realStems = new Set(
      entries
        .filter(e => e.isFile() && e.name.endsWith('.md'))
        .map(e => e.name.slice(0, -3))
    );
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

  test('cluster names contain the expected set from research memo §3.2', () => {
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

// ─── listSurface ─────────────────────────────────────────────────────────────

describe('listSurface', () => {
  test('returns { enabled, disabled, tokenCost } structure', () => {
    const dir = tmpDir('gsd-surface-list-');
    try {
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'core');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const result = listSurface(dir, manifest, CLUSTERS);

      assert.ok(Array.isArray(result.enabled), 'enabled must be array');
      assert.ok(Array.isArray(result.disabled), 'disabled must be array');
      assert.ok(typeof result.tokenCost === 'number', 'tokenCost must be number');
      assert.ok(result.tokenCost >= 0, 'tokenCost must be non-negative');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('core profile: enabled has fewer skills than full; enabled + disabled = total stems', () => {
    const dir = tmpDir('gsd-surface-list-');
    try {
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'core');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const coreList = listSurface(dir, manifest, CLUSTERS);

      const totalStems = [...manifest.keys()].filter(k => !k.startsWith('_calls_agents_')).length;
      assert.ok(
        coreList.enabled.length < totalStems,
        'core should enable fewer skills than total'
      );
      assert.ok(coreList.disabled.length > 0, 'core should have some disabled skills');
      assert.ok(coreList.enabled.length + coreList.disabled.length === totalStems,
        'enabled + disabled must equal total stems');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('disabling utility cluster reduces enabled count', () => {
    const dir = tmpDir('gsd-surface-list-');
    try {
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'standard');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);

      const beforeList = listSurface(dir, manifest, CLUSTERS);

      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: ['utility'],
        explicitAdds: [],
        explicitRemoves: [],
      });
      const afterList = listSurface(dir, manifest, CLUSTERS);

      assert.ok(afterList.enabled.length <= beforeList.enabled.length,
        'disabling utility cluster should not increase enabled count');
      assert.ok(afterList.tokenCost <= beforeList.tokenCost,
        'disabling a cluster should not increase token cost');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('tokenCost is sum of description char lengths ÷ 4 for enabled skills', () => {
    const dir = tmpDir('gsd-surface-list-');
    try {
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'core');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const result = listSurface(dir, manifest, CLUSTERS);

      let expected = 0;
      for (const stem of result.enabled) {
        const filePath = path.join(REAL_COMMANDS_DIR, `${stem}.md`);
        if (!fs.existsSync(filePath)) continue;
        const markdown = fs.readFileSync(filePath, 'utf8');
        const description = readFrontmatterDescription(markdown);
        if (description) expected += Math.ceil(description.length / 4);
      }

      assert.strictEqual(result.tokenCost, expected, 'tokenCost must equal sum of description lengths ÷ 4');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('enabled and disabled arrays are sorted', () => {
    const dir = tmpDir('gsd-surface-list-');
    try {
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'standard');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const result = listSurface(dir, manifest, CLUSTERS);

      assert.deepStrictEqual(result.enabled, [...result.enabled].sort());
      assert.deepStrictEqual(result.disabled, [...result.disabled].sort());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
