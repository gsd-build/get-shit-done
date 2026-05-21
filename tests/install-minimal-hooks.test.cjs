// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Installer Module — Sections 9–11 + 13.
 *
 * Covers: install-profiles unit tests (MINIMAL_SKILL_ALLOWLIST, isMinimalMode,
 * shouldInstallSkill, stageSkillsForMode, cleanupStagedSkills),
 * --minimal per-runtime E2E (spawned), --minimal manifest mode + downgrade,
 * and hooks copy / manifest / uninstall settings cleanup.
 *
 * Consolidates (original sources from #3758):
 *   install-minimal.test.cjs
 *   install-minimal-all-runtimes.test.cjs
 *   install-minimal-backcompat.test.cjs
 *   install-hooks-copy.test.cjs
 *
 * Closes #3758
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');

const { createTempDir, cleanup } = require('./helpers.cjs');

const {
  writeManifest,
} = require('../bin/install.js');

const {
  MINIMAL_SKILL_ALLOWLIST,
  PROFILES,
  isMinimalMode,
  shouldInstallSkill,
  stageSkillsForMode,
  cleanupStagedSkills,
  loadSkillsManifest,
  resolveProfile,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

const {
  INSTALL_SCRIPT,
  MANIFEST_NAME,
  BUILD_SCRIPT,
  HOOKS_DIST,
  EXPECTED_SH_HOOKS,
  EXPECTED_ALL_HOOKS,
  SKILL_RUNTIMES,
  simulateHookCopy,
  installerEnv,
  runMinimalInstall,
  manifestSkillSet,
  manifestAgentCount,
  collectSkillBasenamesOnDisk,
} = require('./helpers/install-shared.cjs');

// ─── Section 9: install-profiles — MINIMAL_SKILL_ALLOWLIST ───────────────────

describe('install-profiles: MINIMAL_SKILL_ALLOWLIST', () => {
  test('contains exactly the main-loop core (frozen)', () => {
    assert.deepStrictEqual(
      [...MINIMAL_SKILL_ALLOWLIST].sort(),
      ['discuss-phase', 'execute-phase', 'help', 'new-project', 'phase', 'plan-phase', 'surface', 'update'],
    );
    assert.ok(Object.isFrozen(MINIMAL_SKILL_ALLOWLIST));
  });

  test('every allowlisted skill exists in commands/gsd/', () => {
    const commandsDir = path.join(__dirname, '..', 'commands', 'gsd');
    for (const name of MINIMAL_SKILL_ALLOWLIST) {
      assert.ok(
        fs.existsSync(path.join(commandsDir, `${name}.md`)),
        `${name} is allowlisted but commands/gsd/${name}.md does not exist`,
      );
    }
  });
});

describe('install-profiles: isMinimalMode', () => {
  test('returns true only for "minimal"', () => {
    assert.strictEqual(isMinimalMode('minimal'), true);
    assert.strictEqual(isMinimalMode('full'), false);
    assert.strictEqual(isMinimalMode(''), false);
    assert.strictEqual(isMinimalMode(undefined), false);
    assert.strictEqual(isMinimalMode(null), false);
    assert.strictEqual(isMinimalMode('MINIMAL'), false);
  });
});

describe('install-profiles: shouldInstallSkill', () => {
  test('full mode admits every skill', () => {
    assert.strictEqual(shouldInstallSkill('plan-phase', 'full'), true);
    assert.strictEqual(shouldInstallSkill('autonomous', 'full'), true);
    assert.strictEqual(shouldInstallSkill('arbitrary-future-name', 'full'), true);
  });

  test('minimal mode admits only allowlisted skills', () => {
    for (const name of MINIMAL_SKILL_ALLOWLIST) {
      assert.strictEqual(shouldInstallSkill(name, 'minimal'), true, name);
    }
    for (const denied of ['autonomous', 'do', 'progress', 'next', 'fast', 'quick']) {
      assert.strictEqual(shouldInstallSkill(denied, 'minimal'), false, denied);
    }
  });

  test('minimal mode rejects .md-suffixed names (callers must strip)', () => {
    assert.strictEqual(shouldInstallSkill('plan-phase.md', 'minimal'), false);
  });

  test('unknown mode falls through to full behavior', () => {
    for (const unknownMode of ['compact', 'tier2', 'CORE', 'Minimal', 'mini']) {
      assert.ok(shouldInstallSkill('autonomous', unknownMode),
        `unknown mode "${unknownMode}" should admit all skills`);
    }
  });
});

describe('install-profiles: stageSkillsForMode', () => {
  function createFixtureSkillsDir() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-fixture-'));
    for (const name of ['plan-phase', 'execute-phase', 'autonomous', 'do', 'help',
      'new-project', 'phase', 'discuss-phase', 'update', 'progress', 'surface']) {
      fs.writeFileSync(path.join(tmp, `${name}.md`), `# ${name}\n`);
    }
    return tmp;
  }

  test('full mode returns original src dir unchanged', () => {
    const src = createFixtureSkillsDir();
    try {
      assert.strictEqual(stageSkillsForMode(src, 'full'), src);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('minimal mode returns new dir with only allowlisted skills', () => {
    const src = createFixtureSkillsDir();
    let staged;
    try {
      staged = stageSkillsForMode(src, 'minimal');
      assert.notStrictEqual(staged, src);
      assert.deepStrictEqual(
        fs.readdirSync(staged).sort(),
        ['discuss-phase.md', 'execute-phase.md', 'help.md', 'new-project.md',
          'phase.md', 'plan-phase.md', 'surface.md', 'update.md'],
      );
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });

  test('minimal mode preserves file content byte-for-byte', () => {
    const src = createFixtureSkillsDir();
    let staged;
    try {
      staged = stageSkillsForMode(src, 'minimal');
      const original = fs.readFileSync(path.join(src, 'plan-phase.md'), 'utf8');
      const copied = fs.readFileSync(path.join(staged, 'plan-phase.md'), 'utf8');
      assert.strictEqual(copied, original);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });

  test('minimal mode against non-existent source returns source path', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-stage-does-not-exist-' + Date.now());
    assert.strictEqual(stageSkillsForMode(ghost, 'minimal'), ghost);
  });

  test('minimal mode skips non-md files and subdirectories', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-mixed-'));
    let staged;
    try {
      fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
      fs.writeFileSync(path.join(src, 'README.txt'), 'not a skill\n');
      fs.mkdirSync(path.join(src, 'nested-dir'));
      fs.writeFileSync(path.join(src, 'nested-dir', 'plan-phase.md'), '# nested\n');
      staged = stageSkillsForMode(src, 'minimal');
      assert.deepStrictEqual(fs.readdirSync(staged), ['plan-phase.md']);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });
});

describe('install-profiles: cleanupStagedSkills', () => {
  test('removes staged dirs created during process', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-cleanup-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    try {
      const a = stageSkillsForMode(src, 'minimal');
      const b = stageSkillsForMode(src, 'minimal');
      assert.notStrictEqual(a, b);
      assert.ok(fs.existsSync(a));
      assert.ok(fs.existsSync(b));
      cleanupStagedSkills();
      assert.ok(!fs.existsSync(a));
      assert.ok(!fs.existsSync(b));
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('is idempotent', () => {
    cleanupStagedSkills();
    cleanupStagedSkills();
  });

  test('exit handler registers at most once across many calls', () => {
    cleanupStagedSkills();
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-exit-handler-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    try {
      const before = process.listenerCount('exit');
      for (let i = 0; i < 5; i++) stageSkillsForMode(src, 'minimal');
      const after = process.listenerCount('exit');
      assert.ok(after - before <= 1, `expected <=1 new exit listener, got ${after - before}`);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      cleanupStagedSkills();
    }
  });

  test('mid-copy failure removes partial staged dir and re-throws', () => {
    cleanupStagedSkills();
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-fail-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    fs.writeFileSync(path.join(src, 'execute-phase.md'), '# x\n');
    const realCopy = fs.copyFileSync;
    const realMkdtemp = fs.mkdtempSync;
    let stagedDir = null;
    fs.mkdtempSync = (prefix, ...rest) => {
      const out = realMkdtemp(prefix, ...rest);
      if (typeof prefix === 'string' && prefix.endsWith('gsd-minimal-skills-')) stagedDir = out;
      return out;
    };
    let copyCount = 0;
    fs.copyFileSync = (s, d) => {
      copyCount++;
      if (copyCount === 2) throw new Error('synthetic disk full');
      return realCopy(s, d);
    };
    try {
      assert.throws(() => stageSkillsForMode(src, 'minimal'), /synthetic disk full/);
      assert.notStrictEqual(stagedDir, null);
      assert.equal(fs.existsSync(stagedDir), false);
    } finally {
      fs.copyFileSync = realCopy;
      fs.mkdtempSync = realMkdtemp;
      fs.rmSync(src, { recursive: true, force: true });
      cleanupStagedSkills();
    }
  });
});

describe('install-profiles: allowlist scope guards', () => {
  test('every main-loop command is in the allowlist', () => {
    for (const required of ['new-project', 'discuss-phase', 'plan-phase', 'execute-phase']) {
      assert.ok(shouldInstallSkill(required, 'minimal'), `"${required}" must be in allowlist`);
    }
  });

  test('off-loop commands are NOT in the allowlist', () => {
    for (const offLoop of ['autonomous', 'ship', 'do', 'progress', 'next', 'fast', 'quick', 'debug', 'code-review', 'verify-work']) {
      assert.ok(!shouldInstallSkill(offLoop, 'minimal'), `"${offLoop}" must NOT be in allowlist`);
    }
  });
});

// ─── Section 10: --minimal install — per-runtime E2E (spawned) ───────────────

describe('install: --minimal honoured for every runtime in --global mode', () => {
  for (const runtime of SKILL_RUNTIMES) {
    test(`${runtime} --global --minimal: mode=minimal, correct skills, zero agents`, () => {
      const { manifest, root } = runMinimalInstall({ runtime, scope: 'global', extraArgs: ['--minimal'] });
      try {
        assert.ok(manifest, `${runtime} global must produce manifest`);
        assert.strictEqual(manifest.mode, 'minimal');
        assert.deepStrictEqual(
          [...manifestSkillSet(manifest)].sort(),
          [...MINIMAL_SKILL_ALLOWLIST].sort(),
        );
        assert.strictEqual(manifestAgentCount(manifest), 0);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('install: --minimal honoured for every runtime in --local mode', () => {
  for (const runtime of SKILL_RUNTIMES) {
    test(`${runtime} --local --minimal: mode=minimal, correct skills, zero agents`, () => {
      const { manifest, root } = runMinimalInstall({ runtime, scope: 'local', extraArgs: ['--minimal'] });
      try {
        assert.ok(manifest, `${runtime} local must produce manifest`);
        assert.strictEqual(manifest.mode, 'minimal');
        assert.deepStrictEqual(
          [...manifestSkillSet(manifest)].sort(),
          [...MINIMAL_SKILL_ALLOWLIST].sort(),
        );
        assert.strictEqual(manifestAgentCount(manifest), 0);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('install: Cline --minimal (rules-based, no skills/ dir)', () => {
  for (const scope of ['global', 'local']) {
    test(`cline --${scope} --minimal: mode=minimal, zero agents, .clinerules present`, () => {
      const { manifest, configDir, root } = runMinimalInstall({
        runtime: 'cline', scope, extraArgs: ['--minimal'],
      });
      try {
        assert.ok(manifest, 'cline must produce manifest');
        assert.strictEqual(manifest.mode, 'minimal');
        assert.strictEqual(manifestAgentCount(manifest), 0);
        assert.ok(fs.existsSync(path.join(configDir, '.clinerules')));
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('install: on-disk skill files match manifest for --minimal', () => {
  for (const runtime of SKILL_RUNTIMES) {
    for (const scope of ['global', 'local']) {
      test(`${runtime} --${scope} --minimal: on-disk matches manifest`, () => {
        const { manifest, configDir, root } = runMinimalInstall({
          runtime, scope, extraArgs: ['--minimal'],
        });
        try {
          assert.ok(manifest);
          const onDisk = collectSkillBasenamesOnDisk(configDir);
          const inManifest = manifestSkillSet(manifest);
          assert.deepStrictEqual([...onDisk].sort(), [...inManifest].sort());
          const agentsDir = path.join(configDir, 'agents');
          if (fs.existsSync(agentsDir)) {
            const gsdAgents = fs.readdirSync(agentsDir)
              .filter(f => f.startsWith('gsd-') && f.endsWith('.md'));
            assert.deepStrictEqual(gsdAgents, []);
          }
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      });
    }
  }
});

// ─── Section 11: --minimal manifest mode + downgrade ─────────────────────────

describe('install: manifest records mode for both profiles', () => {
  function manifestModeAfterInstall(extraArgs) {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-manifest-mode-'));
    try {
      spawnSync(
        process.execPath,
        [INSTALL_SCRIPT, '--claude', '--global', '--config-dir', targetDir, ...extraArgs],
        { encoding: 'utf8', env: installerEnv() },
      );
      const manifestPath = path.join(targetDir, MANIFEST_NAME);
      if (!fs.existsSync(manifestPath)) return { mode: '<no manifest>', skillCount: 0, agentCount: 0 };
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const skillCount = new Set(
        Object.keys(m.files || {}).filter(k => k.startsWith('skills/')).map(k => k.split('/')[1]),
      ).size;
      const agentCount = Object.keys(m.files || {}).filter(k => k.startsWith('agents/')).length;
      return { mode: m.mode, skillCount, agentCount };
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  test('default install records mode: "full" with full skill+agent count', () => {
    const r = manifestModeAfterInstall([]);
    assert.strictEqual(r.mode, 'full');
    assert.ok(r.skillCount > 7);
    assert.ok(r.agentCount > 0);
  });

  test('--minimal records mode: "minimal" with exactly 8 skills and 0 agents', () => {
    const r = manifestModeAfterInstall(['--minimal']);
    assert.strictEqual(r.mode, 'minimal');
    assert.strictEqual(r.skillCount, 8);
    assert.strictEqual(r.agentCount, 0);
  });

  test('--core-only is an alias for --minimal', () => {
    const r = manifestModeAfterInstall(['--core-only']);
    assert.strictEqual(r.mode, 'minimal');
    assert.strictEqual(r.skillCount, 8);
    assert.strictEqual(r.agentCount, 0);
  });
});

describe('install-minimal-backcompat: PROFILES.core matches MINIMAL_SKILL_ALLOWLIST', () => {
  test('PROFILES.core contains the same 8 skills as MINIMAL_SKILL_ALLOWLIST', () => {
    assert.deepStrictEqual(
      [...PROFILES.core].sort(),
      [...MINIMAL_SKILL_ALLOWLIST].sort(),
    );
  });
});

describe('install-minimal-backcompat: --minimal and --profile=core produce same manifest', () => {
  function installAndGetManifest(extraArgs) {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-backcompat-'));
    try {
      spawnSync(
        process.execPath,
        [INSTALL_SCRIPT, '--claude', '--global', '--config-dir', targetDir, ...extraArgs],
        { encoding: 'utf8', env: installerEnv() },
      );
      const manifestPath = path.join(targetDir, MANIFEST_NAME);
      if (!fs.existsSync(manifestPath)) return { mode: null, skillCount: 0, profileMarker: null };
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const skillCount = new Set(
        Object.keys(m.files || {}).filter(k => k.startsWith('skills/')).map(k => k.split('/')[1]),
      ).size;
      const markerPath = path.join(targetDir, '.gsd-profile');
      const profileMarker = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8').trim() : null;
      return { mode: m.mode, skillCount, profileMarker };
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  test('--minimal produces mode "minimal" with exactly 8 skills', () => {
    const r = installAndGetManifest(['--minimal']);
    assert.strictEqual(r.mode, 'minimal');
    assert.strictEqual(r.skillCount, 8);
  });

  test('--minimal writes .gsd-profile marker "core"', () => {
    const r = installAndGetManifest(['--minimal']);
    assert.strictEqual(r.profileMarker, 'core');
  });

  test('default install writes .gsd-profile marker "full"', () => {
    const r = installAndGetManifest([]);
    assert.strictEqual(r.profileMarker, 'full');
  });

  test('--profile=core writes .gsd-profile marker "core"', () => {
    const r = installAndGetManifest(['--profile=core']);
    assert.strictEqual(r.profileMarker, 'core');
  });

  test('--profile=standard writes .gsd-profile marker "standard"', () => {
    const r = installAndGetManifest(['--profile=standard']);
    assert.strictEqual(r.profileMarker, 'standard');
  });
});

describe('install: Codex full → minimal downgrade cleans stale agent state', () => {
  test('--minimal removes stale .toml agents and strips [agents.gsd-*] from config.toml', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-codex-downgrade-'));
    try {
      const agentsDir = path.join(targetDir, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, 'gsd-executor.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'gsd-planner.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'gsd-executor.toml'), 'name = "gsd-executor"\n');
      fs.writeFileSync(path.join(agentsDir, 'gsd-planner.toml'), 'name = "gsd-planner"\n');
      fs.writeFileSync(path.join(agentsDir, 'my-custom-agent.md'), 'user owns this\n');
      const codexConfig = [
        '# user-owned setting',
        'model = "gpt-5"',
        '',
        '# GSD Agent Configuration — managed by get-shit-done installer',
        '[agents.gsd-executor]',
        'cmd = "stale"',
        '',
        '[agents.gsd-planner]',
        'cmd = "stale"',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(targetDir, 'config.toml'), codexConfig);

      const result = spawnSync(
        process.execPath,
        [INSTALL_SCRIPT, '--codex', '--global', '--config-dir', targetDir, '--minimal'],
        { encoding: 'utf8', env: installerEnv() },
      );
      assert.ok(result.stdout || result.stderr);

      const remaining = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir) : [];
      assert.ok(!remaining.includes('gsd-executor.md'));
      assert.ok(!remaining.includes('gsd-planner.md'));
      assert.ok(!remaining.includes('gsd-executor.toml'));
      assert.ok(!remaining.includes('gsd-planner.toml'));
      assert.ok(remaining.includes('my-custom-agent.md'));

      const configPath = path.join(targetDir, 'config.toml');
      if (fs.existsSync(configPath)) {
        const config = fs.readFileSync(configPath, 'utf8');
        assert.ok(!config.includes('[agents.gsd-executor]'));
        assert.ok(!config.includes('[agents.gsd-planner]'));
        assert.ok(config.includes('model = "gpt-5"'));
      }
      assert.ok(fs.existsSync(configPath));
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});

describe('install: Claude full → minimal downgrade removes stale agents', () => {
  test('--minimal removes stale gsd-*.md agents but preserves user-owned agents', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-claude-downgrade-'));
    try {
      const agentsDir = path.join(targetDir, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, 'gsd-executor.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'gsd-planner.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'my-custom-agent.md'), 'user owns this\n');

      spawnSync(
        process.execPath,
        [INSTALL_SCRIPT, '--claude', '--global', '--config-dir', targetDir, '--minimal'],
        { encoding: 'utf8', env: installerEnv() },
      );

      const remaining = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir) : [];
      assert.ok(!remaining.includes('gsd-executor.md'));
      assert.ok(!remaining.includes('gsd-planner.md'));
      assert.ok(remaining.includes('my-custom-agent.md'));
      assert.deepStrictEqual(remaining.filter(f => f.startsWith('gsd-')), []);
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});

// ─── Section 13: Hooks copy, manifest, uninstall settings cleanup ─────────────

before(() => {
  execFileSync(process.execPath, [BUILD_SCRIPT], { encoding: 'utf-8', stdio: 'pipe' });
});

const isWindows = process.platform === 'win32';

describe('#1755: .sh hooks are copied and executable after install', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir('gsd-hook-copy-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('all expected hooks are copied from hooks/dist/ to target', () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);
    for (const hook of EXPECTED_ALL_HOOKS) {
      assert.ok(fs.existsSync(path.join(hooksDest, hook)), `${hook} should exist`);
    }
  });

  test('.sh hooks are executable after copy', {
    skip: isWindows ? 'Windows has no POSIX file permissions' : false,
  }, () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);
    for (const sh of EXPECTED_SH_HOOKS) {
      const stat = fs.statSync(path.join(hooksDest, sh));
      assert.ok((stat.mode & 0o111) !== 0, `${sh} should be executable`);
    }
  });

  test('.js hooks are executable after copy', {
    skip: isWindows ? 'Windows has no POSIX file permissions' : false,
  }, () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);
    for (const js of EXPECTED_ALL_HOOKS.filter(h => h.endsWith('.js'))) {
      const stat = fs.statSync(path.join(hooksDest, js));
      assert.ok((stat.mode & 0o111) !== 0, `${js} should be executable`);
    }
  });
});

describe('install.js source correctness', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');

  test('.sh files get chmod after copyFileSync', () => {
    assert.ok(src.includes("if (entry.endsWith('.sh'))"));
  });

  test('Codex hook uses correct filename gsd-check-update.js', () => {
    assert.ok(!src.match(/['"]gsd-update-check\.js['"]/));
  });

  test('Codex hook path does not use get-shit-done/hooks/ subdirectory', () => {
    assert.ok(!src.includes("'get-shit-done', 'hooks', 'gsd-check-update"));
  });

  test('cache invalidation uses ~/.cache/gsd/ path', () => {
    assert.ok(src.includes("os.homedir(), '.cache', 'gsd'"));
  });

  test('manifest tracks .sh hook files', () => {
    assert.ok(src.includes("file.endsWith('.sh')"));
  });

  test('gsd-workflow-guard.js is in uninstall hook list', () => {
    const m = src.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(m, 'gsdHooks array must exist');
    assert.ok(m[1].includes('gsd-workflow-guard.js'));
  });

  test('phantom gsd-check-update.sh is not in uninstall hook list', () => {
    const m = src.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(m);
    assert.ok(!m[1].includes('gsd-check-update.sh'));
  });

  test('isGsdHookCommand covers all GSD hook names', () => {
    const names = [
      'gsd-check-update', 'gsd-statusline', 'gsd-session-state',
      'gsd-context-monitor', 'gsd-phase-boundary', 'gsd-prompt-guard',
      'gsd-read-guard', 'gsd-validate-commit', 'gsd-workflow-guard',
    ];
    for (const name of names) {
      assert.ok(src.includes(`'${name}'`) || src.includes(`"${name}"`));
    }
  });

  test('no duplicate isCursor or isWindsurf branches in uninstall', () => {
    const uninstallStart = src.indexOf('function uninstall(');
    const uninstallEnd = src.indexOf('function verifyInstalled(');
    assert.ok(uninstallStart !== -1);
    assert.ok(uninstallEnd !== -1);
    const block = src.substring(uninstallStart, uninstallEnd);
    assert.strictEqual((block.match(/else if \(isCursor\)/g) || []).length, 0);
    assert.strictEqual((block.match(/else if \(isWindsurf\)/g) || []).length, 0);
  });
});

describe('writeManifest includes .sh hooks', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempDir('gsd-manifest-');
    const hooksDir = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDir);
  });
  afterEach(() => { cleanup(tmpDir); });

  test('manifest contains .sh hook entries', () => {
    writeManifest(tmpDir, 'claude');
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'gsd-file-manifest.json'), 'utf8'));
    for (const sh of EXPECTED_SH_HOOKS) {
      assert.ok(manifest.files['hooks/' + sh], `manifest should contain hash for ${sh}`);
    }
  });

  test('manifest contains .js hook entries', () => {
    writeManifest(tmpDir, 'claude');
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'gsd-file-manifest.json'), 'utf8'));
    for (const js of EXPECTED_ALL_HOOKS.filter(h => h.endsWith('.js'))) {
      assert.ok(manifest.files['hooks/' + js], `manifest should contain hash for ${js}`);
    }
  });
});

describe('uninstall settings cleanup preserves user hooks', () => {
  const isGsdHook = (cmd) =>
    cmd && (cmd.includes('gsd-check-update') || cmd.includes('gsd-statusline') ||
      cmd.includes('gsd-session-state') || cmd.includes('gsd-context-monitor') ||
      cmd.includes('gsd-phase-boundary') || cmd.includes('gsd-prompt-guard') ||
      cmd.includes('gsd-read-guard') || cmd.includes('gsd-validate-commit') ||
      cmd.includes('gsd-workflow-guard'));

  function filterGsdHooks(entries) {
    return entries
      .map(e => {
        if (!e.hooks || !Array.isArray(e.hooks)) return e;
        e.hooks = e.hooks.filter(h => !isGsdHook(h.command));
        return e.hooks.length > 0 ? e : null;
      })
      .filter(Boolean);
  }

  test('mixed entry preserves user hooks', () => {
    const entries = [{
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: 'node /path/gsd-prompt-guard.js' },
        { type: 'command', command: 'bash /my/custom-lint.sh' },
      ],
    }];
    const result = filterGsdHooks(entries);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].hooks.length, 1);
    assert.ok(result[0].hooks[0].command.includes('custom-lint'));
  });

  test('entry with only GSD hooks is fully removed', () => {
    const entries = [{
      hooks: [
        { type: 'command', command: 'node /path/gsd-check-update.js' },
        { type: 'command', command: 'node /path/gsd-statusline.js' },
      ],
    }];
    assert.strictEqual(filterGsdHooks(entries).length, 0);
  });

  test('entry with only user hooks is untouched', () => {
    const entries = [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash /my/pre-check.sh' }] }];
    const result = filterGsdHooks(entries);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].hooks.length, 1);
  });

  test('non-array hook entries are preserved (#1825)', () => {
    const entries = [
      { type: 'custom', command: 'echo hello' },
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'node /path/gsd-prompt-guard.js' }] },
      { url: 'https://example.com/webhook' },
    ];
    const result = filterGsdHooks(JSON.parse(JSON.stringify(entries)));
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0], { type: 'custom', command: 'echo hello' });
    assert.deepStrictEqual(result[1], { url: 'https://example.com/webhook' });
  });

  test('all GSD hook names are recognised', () => {
    const cmds = [
      'node /path/gsd-check-update.js', 'node /path/gsd-statusline.js',
      'bash /path/gsd-session-state.sh', 'node /path/gsd-context-monitor.js',
      'bash /path/gsd-phase-boundary.sh', 'node /path/gsd-prompt-guard.js',
      'node /path/gsd-read-guard.js', 'bash /path/gsd-validate-commit.sh',
      'node /path/gsd-workflow-guard.js',
    ];
    for (const cmd of cmds) {
      assert.ok(isGsdHook(cmd), `should recognise: ${cmd}`);
    }
  });
});

describe('Codex legacy gsd-update-check migration', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');

  test('install.js strips legacy gsd-update-check hook blocks', () => {
    assert.ok(src.includes('gsd-update-check') && src.includes('replace('));
  });

  test('migration regex removes LF legacy hook block', () => {
    const legacyBlock = ['[features]', 'codex_hooks = true', '',
      '# GSD Hooks', '[[hooks]]', 'event = "SessionStart"',
      'command = "node /old/path/gsd-update-check.js"', ''].join('\n');
    let content = legacyBlock.replace(
      /\n# GSD Hooks\n\[\[hooks\]\]\nevent = "SessionStart"\ncommand = "node [^\n]*gsd-update-check\.js"\n/g, '\n',
    );
    assert.ok(!content.includes('gsd-update-check'));
    assert.ok(content.includes('[features]'));
  });

  test('migration regex removes CRLF legacy hook block', () => {
    const legacyBlock = ['[features]', 'codex_hooks = true', '',
      '# GSD Hooks', '[[hooks]]', 'event = "SessionStart"',
      'command = "node /old/path/gsd-update-check.js"', ''].join('\r\n');
    let content = legacyBlock.replace(
      /\r\n# GSD Hooks\r\n\[\[hooks\]\]\r\nevent = "SessionStart"\r\ncommand = "node [^\r\n]*gsd-update-check\.js"\r\n/g, '\r\n',
    );
    assert.ok(!content.includes('gsd-update-check'));
    assert.ok(content.includes('[features]'));
  });
});
