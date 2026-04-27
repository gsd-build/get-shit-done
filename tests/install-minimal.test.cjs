/**
 * Tests for `--minimal` install profile (#2762).
 *
 * Verifies:
 *   1. The install-profiles allowlist contains exactly the documented core
 *      main-loop skills.
 *   2. stageSkillsForMode() filters source dir entries to the allowlist when
 *      mode === 'minimal' and is a no-op for mode === 'full'.
 *   3. Filtering is by basename (mirrors how copyCommandsAs*Skills derives
 *      skill names).
 *   4. shouldInstallSkill() agrees with stageSkillsForMode().
 *
 * Note: end-to-end install tests (spawning bin/install.js with --minimal) are
 * intentionally out of scope here — they require a fully-mocked runtime config
 * dir which would duplicate antigravity-install.test.cjs scaffolding. The unit
 * tests below pin the allowlist contract; the dispatch sites in install.js
 * call stageSkillsForMode unconditionally so any breakage there shows up as
 * a stage_dir/source_dir mismatch covered by these tests.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  MINIMAL_SKILL_ALLOWLIST,
  isMinimalMode,
  shouldInstallSkill,
  stageSkillsForMode,
  cleanupStagedSkills,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

describe('install-profiles: MINIMAL_SKILL_ALLOWLIST', () => {
  test('contains exactly the main-loop core (no drift without test update)', () => {
    assert.deepStrictEqual(
      [...MINIMAL_SKILL_ALLOWLIST].sort(),
      [
        'discuss-phase',
        'execute-phase',
        'help',
        'new-project',
        'plan-phase',
        'update',
      ],
    );
  });

  test('is frozen (mutations throw in strict mode)', () => {
    assert.ok(Object.isFrozen(MINIMAL_SKILL_ALLOWLIST));
  });

  test('every allowlisted skill exists in commands/gsd/', () => {
    const commandsDir = path.join(__dirname, '..', 'commands', 'gsd');
    for (const name of MINIMAL_SKILL_ALLOWLIST) {
      const file = path.join(commandsDir, `${name}.md`);
      assert.ok(
        fs.existsSync(file),
        `core skill ${name} is allowlisted but ${file} does not exist`,
      );
    }
  });
});

describe('install-profiles: isMinimalMode', () => {
  test('returns true only for the literal string "minimal"', () => {
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

  test('minimal mode rejects allowlist names with .md suffix (callers must strip)', () => {
    assert.strictEqual(shouldInstallSkill('plan-phase.md', 'minimal'), false);
  });
});

describe('install-profiles: stageSkillsForMode', () => {
  function createFixtureSkillsDir() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-fixture-'));
    fs.writeFileSync(path.join(tmp, 'plan-phase.md'), '# plan-phase\n');
    fs.writeFileSync(path.join(tmp, 'execute-phase.md'), '# execute-phase\n');
    fs.writeFileSync(path.join(tmp, 'autonomous.md'), '# autonomous\n');
    fs.writeFileSync(path.join(tmp, 'do.md'), '# do\n');
    fs.writeFileSync(path.join(tmp, 'help.md'), '# help\n');
    fs.writeFileSync(path.join(tmp, 'new-project.md'), '# new-project\n');
    fs.writeFileSync(path.join(tmp, 'discuss-phase.md'), '# discuss-phase\n');
    fs.writeFileSync(path.join(tmp, 'update.md'), '# update\n');
    fs.writeFileSync(path.join(tmp, 'progress.md'), '# progress\n');
    return tmp;
  }

  test('full mode returns the original src dir unchanged', () => {
    const src = createFixtureSkillsDir();
    try {
      const result = stageSkillsForMode(src, 'full');
      assert.strictEqual(result, src);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('minimal mode returns a new dir containing only allowlisted skills', () => {
    const src = createFixtureSkillsDir();
    let staged;
    try {
      staged = stageSkillsForMode(src, 'minimal');
      assert.notStrictEqual(staged, src);
      const stagedFiles = fs.readdirSync(staged).sort();
      assert.deepStrictEqual(stagedFiles, [
        'discuss-phase.md',
        'execute-phase.md',
        'help.md',
        'new-project.md',
        'plan-phase.md',
        'update.md',
      ]);
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

  test('minimal mode against non-existent source returns the source path (caller handles missing)', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-stage-does-not-exist-' + Date.now());
    const result = stageSkillsForMode(ghost, 'minimal');
    assert.strictEqual(result, ghost);
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
      const stagedFiles = fs.readdirSync(staged);
      assert.deepStrictEqual(stagedFiles, ['plan-phase.md']);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });
});

describe('install-profiles: cleanupStagedSkills', () => {
  test('removes every staged dir created during this process', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-cleanup-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    try {
      const a = stageSkillsForMode(src, 'minimal');
      const b = stageSkillsForMode(src, 'minimal');
      assert.notStrictEqual(a, b, 'each call should mkdtemp a fresh dir');
      assert.ok(fs.existsSync(a));
      assert.ok(fs.existsSync(b));
      cleanupStagedSkills();
      assert.ok(!fs.existsSync(a), 'first staged dir should be removed');
      assert.ok(!fs.existsSync(b), 'second staged dir should be removed');
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('is idempotent — calling twice does not throw', () => {
    cleanupStagedSkills();
    cleanupStagedSkills();
  });
});

// ─── End-to-end install regression: full → minimal Codex downgrade ─────────
//
// CodeRabbit (#2764) flagged that switching from full to minimal on Codex
// would leave stale `agents/gsd-*.toml` files plus `[agents.gsd-*]`
// sections in `config.toml`. This test simulates a previous full Codex
// install (a few stale agent files + an existing GSD-marked config.toml)
// and confirms that `--minimal` cleans them up.
describe('install: Codex full → minimal downgrade cleans stale agent state', () => {
  const { spawnSync } = require('child_process');
  const installScript = path.join(__dirname, '..', 'bin', 'install.js');

  function makeStaleCodexInstall(targetDir) {
    const agentsDir = path.join(targetDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    // Pretend a previous full install left these behind:
    fs.writeFileSync(path.join(agentsDir, 'gsd-executor.md'), 'stale\n');
    fs.writeFileSync(path.join(agentsDir, 'gsd-planner.md'), 'stale\n');
    fs.writeFileSync(path.join(agentsDir, 'gsd-executor.toml'), 'name = "gsd-executor"\n');
    fs.writeFileSync(path.join(agentsDir, 'gsd-planner.toml'), 'name = "gsd-planner"\n');
    // Also drop an unrelated user agent to confirm we don't touch it:
    fs.writeFileSync(path.join(agentsDir, 'my-custom-agent.md'), 'user owns this\n');

    // A previously-written codex config.toml with both GSD and user content,
    // matching the marker format produced by installCodexConfig.
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
  }

  test('--minimal removes stale .toml agents and strips [agents.gsd-*] from config.toml', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-codex-downgrade-'));
    try {
      makeStaleCodexInstall(targetDir);

      const result = spawnSync(
        process.execPath,
        [installScript, '--codex', '--global', '--config-dir', targetDir, '--minimal'],
        { encoding: 'utf8' },
      );
      // Install may print the SDK-not-found warning at the end (the worktree
      // doesn't always have sdk/dist built). That's a non-fatal post-step;
      // skill/agent staging happens before it. We assert state, not exit code.
      assert.ok(result.stdout || result.stderr, 'install should produce some output');

      const agentsDir = path.join(targetDir, 'agents');
      const remaining = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir) : [];

      // Stale gsd-* files (.md AND .toml) must be gone:
      assert.ok(!remaining.includes('gsd-executor.md'), 'stale gsd-executor.md should be removed');
      assert.ok(!remaining.includes('gsd-planner.md'), 'stale gsd-planner.md should be removed');
      assert.ok(!remaining.includes('gsd-executor.toml'), 'stale gsd-executor.toml should be removed');
      assert.ok(!remaining.includes('gsd-planner.toml'), 'stale gsd-planner.toml should be removed');

      // User-owned agent must survive:
      assert.ok(remaining.includes('my-custom-agent.md'), 'user agent should be preserved');

      // config.toml: GSD section gone, user content preserved
      const configPath = path.join(targetDir, 'config.toml');
      if (fs.existsSync(configPath)) {
        const config = fs.readFileSync(configPath, 'utf8');
        assert.ok(!config.includes('[agents.gsd-executor]'), 'gsd-executor section stripped');
        assert.ok(!config.includes('[agents.gsd-planner]'), 'gsd-planner section stripped');
        assert.ok(config.includes('model = "gpt-5"'), 'user setting preserved');
      }
      // (If config.toml was GSD-only it'd be removed entirely, which is also acceptable —
      //  in this fixture there's user content so the file should still exist.)
      assert.ok(fs.existsSync(configPath), 'config.toml with user content should remain');
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});
