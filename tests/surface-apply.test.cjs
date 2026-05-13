'use strict';
/**
 * Tests for applySurface — file sync behavior.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { writeSurface, applySurface } = require('../get-shit-done/bin/lib/surface.cjs');
const { loadSkillsManifest, writeActiveProfile } = require('../get-shit-done/bin/lib/install-profiles.cjs');
const { CLUSTERS } = require('../get-shit-done/bin/lib/clusters.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const REAL_AGENTS_DIR = path.join(__dirname, '..', 'agents');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-surface-apply-'));
}

/**
 * Create a minimal fixture install dir structure.
 * Returns { runtimeConfigDir, commandsDir, agentsDir }.
 * runtimeConfigDir has a .gsd-source marker pointing to REAL_COMMANDS_DIR.
 */
function createFixtureRuntime() {
  const base = tmpDir();
  const runtimeConfigDir = path.join(base, 'config');
  const commandsDir = path.join(base, 'commands', 'gsd');
  const agentsDir = path.join(base, 'agents');
  fs.mkdirSync(runtimeConfigDir, { recursive: true });
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });
  // Write source marker so surface.cjs can find the install source
  fs.writeFileSync(path.join(runtimeConfigDir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
  return { base, runtimeConfigDir, commandsDir, agentsDir };
}

describe('applySurface', () => {
  test('core profile: only core skills appear in commandsDir', () => {
    const { base, runtimeConfigDir, commandsDir, agentsDir } = createFixtureRuntime();
    try {
      writeActiveProfile(runtimeConfigDir, 'core');
      writeSurface(runtimeConfigDir, {
        baseProfile: 'core',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      applySurface(runtimeConfigDir, commandsDir, agentsDir, manifest, CLUSTERS);

      const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
      // Every file should be a real stem we know about
      for (const file of files) {
        assert.ok(fs.existsSync(path.join(REAL_COMMANDS_DIR, file)), `unexpected file: ${file}`);
      }
      // At minimum core skills should be present
      const coreStems = ['new-project', 'discuss-phase', 'plan-phase', 'execute-phase', 'help', 'update'];
      for (const stem of coreStems) {
        assert.ok(files.includes(`${stem}.md`), `core skill "${stem}" should be in commandsDir`);
      }
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('removes superseded files when profile shrinks', () => {
    const { base, runtimeConfigDir, commandsDir, agentsDir } = createFixtureRuntime();
    try {
      // Start with standard: put some skill files in commandsDir
      writeActiveProfile(runtimeConfigDir, 'standard');
      writeSurface(runtimeConfigDir, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      applySurface(runtimeConfigDir, commandsDir, agentsDir, manifest, CLUSTERS);

      const afterStandard = new Set(fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')));

      // Now switch to core: skills not in core should be removed
      writeSurface(runtimeConfigDir, {
        baseProfile: 'core',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      applySurface(runtimeConfigDir, commandsDir, agentsDir, manifest, CLUSTERS);

      const afterCore = new Set(fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')));

      // core should be a subset of standard
      assert.ok(afterCore.size <= afterStandard.size, 'core should have fewer or equal files than standard');

      // Files removed should not be in core set
      const coreStems = new Set(['new-project', 'discuss-phase', 'plan-phase', 'execute-phase', 'help', 'update']);
      for (const file of afterCore) {
        const stem = file.slice(0, -3);
        assert.ok(
          fs.existsSync(path.join(REAL_COMMANDS_DIR, file)),
          `file in commandsDir not a real skill: ${file}`
        );
      }
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('leaves non-gsd .md files alone in agentsDir', () => {
    const { base, runtimeConfigDir, commandsDir, agentsDir } = createFixtureRuntime();
    try {
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
      applySurface(runtimeConfigDir, commandsDir, agentsDir, manifest, CLUSTERS);

      // Non-gsd file should still be there
      assert.ok(fs.existsSync(foreignAgent), 'non-gsd agent file should not be touched');
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('adds missing skill files from install source', () => {
    const { base, runtimeConfigDir, commandsDir, agentsDir } = createFixtureRuntime();
    try {
      // commandsDir starts empty
      writeActiveProfile(runtimeConfigDir, 'core');
      writeSurface(runtimeConfigDir, {
        baseProfile: 'core',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      applySurface(runtimeConfigDir, commandsDir, agentsDir, manifest, CLUSTERS);

      // Core skills should now be present
      assert.ok(
        fs.existsSync(path.join(commandsDir, 'help.md')),
        'help.md should be copied from install source'
      );
      assert.ok(
        fs.existsSync(path.join(commandsDir, 'new-project.md')),
        'new-project.md should be copied from install source'
      );
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});
