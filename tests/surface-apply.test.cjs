'use strict';
/**
 * Tests for applySurface — file sync behavior.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { writeSurface, applySurface } = require('../get-shit-done/bin/lib/surface.cjs');
const { loadSkillsManifest, writeActiveProfile } = require('../get-shit-done/bin/lib/install-profiles.cjs');
const { CLUSTERS } = require('../get-shit-done/bin/lib/clusters.cjs');
const { resolveRuntimeArtifactLayout } = require('../get-shit-done/bin/lib/runtime-artifact-layout.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const REAL_AGENTS_DIR = path.join(__dirname, '..', 'agents');

/**
 * Create a minimal fixture install dir structure for claude/local layout.
 * runtimeConfigDir is the layout configDir.
 * commandsDir = runtimeConfigDir/commands/gsd
 * agentsDir   = runtimeConfigDir/agents
 */
function createFixtureRuntime() {
  const base = createTempDir('gsd-surface-apply-');
  const runtimeConfigDir = base;
  const commandsDir = path.join(runtimeConfigDir, 'commands', 'gsd');
  const agentsDir = path.join(runtimeConfigDir, 'agents');
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });
  return { base, runtimeConfigDir, commandsDir, agentsDir };
}

describe('applySurface', () => {
  test('core profile: only core skills appear in commandsDir', (t) => {
    const { base, runtimeConfigDir, commandsDir, agentsDir } = createFixtureRuntime();
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
    // Every file should be a real stem we know about
    for (const file of files) {
      assert.ok(fs.existsSync(path.join(REAL_COMMANDS_DIR, file)), `unexpected file: ${file}`);
    }
    // Core profile should materialize exactly the resolved core command set.
    const expectedCore = [...resolved.skills].map(stem => `${stem}.md`).sort();
    assert.deepStrictEqual(
      [...files].sort(),
      expectedCore,
      'commandsDir should contain exactly core commands'
    );
  });

  test('removes superseded files when profile shrinks', (t) => {
    const { base, runtimeConfigDir, commandsDir, agentsDir } = createFixtureRuntime();
    t.after(() => cleanup(base));
    // Start with standard: put some skill files in commandsDir
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

    // Now switch to core: skills not in core should be removed
    writeSurface(runtimeConfigDir, {
      baseProfile: 'core',
      disabledClusters: [],
      explicitAdds: [],
      explicitRemoves: [],
    });
    const resolvedCore = applySurface(runtimeConfigDir, layout, manifest, CLUSTERS);

    const afterCore = new Set(fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')));

    // core should be a subset of standard
    assert.ok(afterCore.size <= afterStandard.size, 'core should have fewer or equal files than standard');

    // Core profile should materialize exactly the resolved core command set.
    const expectedCore = [...resolvedCore.skills].map(stem => `${stem}.md`).sort();
    assert.deepStrictEqual(
      [...afterCore].sort(),
      expectedCore,
      'afterCore should contain exactly core commands'
    );

    // All files should still map to known real skills.
    for (const file of afterCore) {
      assert.ok(
        fs.existsSync(path.join(REAL_COMMANDS_DIR, file)),
        `file in commandsDir not a real skill: ${file}`
      );
    }
  });

  test('leaves non-gsd .md files alone in agentsDir', (t) => {
    const { base, runtimeConfigDir, commandsDir, agentsDir } = createFixtureRuntime();
    t.after(() => cleanup(base));
    // Place a non-gsd agent file in agentsDir
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

    // Non-gsd file should still be there
    assert.ok(fs.existsSync(foreignAgent), 'non-gsd agent file should not be touched');
  });

  test('adds missing skill files from install source', (t) => {
    const { base, runtimeConfigDir, commandsDir, agentsDir } = createFixtureRuntime();
    t.after(() => cleanup(base));
    // commandsDir starts empty
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

    // Core skills should now be present
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
    const { stageSkillsForRuntimeAsSkills } = require('../get-shit-done/bin/lib/install-profiles.cjs');
    const { findInstallSourceRoot } = require('../get-shit-done/bin/lib/runtime-artifact-layout.cjs');
    // Minimal converter that produces SKILL.md with given stem
    function converter(stem, content) {
      return [
        '---',
        `name: ${stem}`,
        '---',
        content,
      ].join('\n');
    }

    const base = createTempDir('gsd-surface-skills-');
    t.after(() => cleanup(base));
    const stagedDir = path.join(base, 'staged');
    const destDir = path.join(base, 'dest');
    fs.mkdirSync(destDir, { recursive: true });

    // Build a staged dir manually: gsd-help/SKILL.md and gsd-update/SKILL.md
    const stem1 = 'gsd-help';
    const stem2 = 'gsd-update';
    fs.mkdirSync(path.join(stagedDir, stem1), { recursive: true });
    fs.writeFileSync(path.join(stagedDir, stem1, 'SKILL.md'), '# help\n', 'utf8');
    fs.mkdirSync(path.join(stagedDir, stem2), { recursive: true });
    fs.writeFileSync(path.join(stagedDir, stem2, 'SKILL.md'), '# update\n', 'utf8');

    // In destDir: stale gsd- dir + foreign user dir
    const staleDir = path.join(destDir, 'gsd-old-skill');
    fs.mkdirSync(staleDir, { recursive: true });
    fs.writeFileSync(path.join(staleDir, 'SKILL.md'), '# old\n', 'utf8');

    const foreignDir = path.join(destDir, 'my-custom-skill');
    fs.mkdirSync(foreignDir, { recursive: true });
    fs.writeFileSync(path.join(foreignDir, 'SKILL.md'), '# custom\n', 'utf8');

    const skillsKind = { kind: 'skills', destSubpath: 'skills', prefix: 'gsd-', stage: () => stagedDir };

    _syncGsdDir(stagedDir, destDir, skillsKind);

    // staged dirs copied
    assert.ok(fs.existsSync(path.join(destDir, stem1, 'SKILL.md')), 'gsd-help/SKILL.md should be copied');
    assert.ok(fs.existsSync(path.join(destDir, stem2, 'SKILL.md')), 'gsd-update/SKILL.md should be copied');

    // stale gsd- dir removed
    assert.ok(!fs.existsSync(staleDir), 'stale gsd-old-skill dir should be removed');

    // foreign dir preserved
    assert.ok(fs.existsSync(foreignDir), 'my-custom-skill dir should be preserved');
  });

  test('applySurface recreates missing destination directories', (t) => {
    // Fixture: layout configDir exists but the dest subdirectory for the kinds does NOT.
    const base = createTempDir('gsd-surface-missing-dest-');
    t.after(() => cleanup(base));
    const runtimeConfigDir = base;
    // Do NOT pre-create commands/gsd or agents — they are intentionally absent.
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

    // commands/gsd must have been created and populated
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

    // Staged: only gsd-executor (profile shrunk — gsd-planner no longer in profile)
    fs.mkdirSync(path.join(stagedDir, 'gsd-executor'), { recursive: true });
    fs.writeFileSync(path.join(stagedDir, 'gsd-executor', 'SKILL.md'), '# executor\n', 'utf8');

    // Dest already has: gsd-executor (keep), gsd-planner (stale GSD), user-skill (user-owned)
    fs.mkdirSync(path.join(destDir, 'gsd-executor'), { recursive: true });
    fs.writeFileSync(path.join(destDir, 'gsd-executor', 'SKILL.md'), '# executor\n', 'utf8');
    fs.mkdirSync(path.join(destDir, 'gsd-planner'), { recursive: true });
    fs.writeFileSync(path.join(destDir, 'gsd-planner', 'SKILL.md'), '# planner\n', 'utf8');
    fs.mkdirSync(path.join(destDir, 'user-skill'), { recursive: true });
    fs.writeFileSync(path.join(destDir, 'user-skill', 'SKILL.md'), '# user\n', 'utf8');

    // Manifest contains gsd-executor and gsd-planner as canonical GSD skills.
    // user-skill is NOT in manifest (user-owned).
    const manifest = new Map([
      ['gsd-executor', []],
      ['gsd-planner', []],
    ]);

    // Hermes kind: empty prefix, destSubpath = skills/gsd
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

    // Staged contains a GSD skill named 'help' (no prefix under hermes skills/gsd/)
    const stem1 = 'help';
    fs.mkdirSync(path.join(stagedDir, stem1), { recursive: true });
    fs.writeFileSync(path.join(stagedDir, stem1, 'SKILL.md'), '# help\n', 'utf8');

    // Dest also has a user-owned custom skill dir (no gsd- prefix — Hermes namespace)
    const userDir = path.join(destDir, 'user-custom-skill');
    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(path.join(userDir, 'SKILL.md'), '# user custom\n', 'utf8');

    // kindPrefix === '' simulates Hermes (destSubpath = skills/gsd, prefix = '')
    const hermesKind = { kind: 'skills', destSubpath: 'skills/gsd', prefix: '', stage: () => stagedDir };

    _syncGsdDir(stagedDir, destDir, hermesKind);

    // The user's custom skill dir must be preserved — it's not in staged but should not be removed
    // (Fix 4: when kindPrefix === '', skip the startsWith guard and preserve ALL non-staged dirs)
    assert.ok(fs.existsSync(userDir), 'user-custom-skill dir must be preserved when kindPrefix is empty (Hermes)');

    // The staged skill must still be copied
    assert.ok(fs.existsSync(path.join(destDir, stem1, 'SKILL.md')), 'GSD help/SKILL.md must be copied');
  });
});
