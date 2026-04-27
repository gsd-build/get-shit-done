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

  test('full mode does not register a staged dir (no leak source for default install)', () => {
    cleanupStagedSkills();
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-fullmode-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    try {
      const before = listTmpStageDirs();
      const result = stageSkillsForMode(src, 'full');
      assert.strictEqual(result, src, 'full mode returns original src unchanged');
      cleanupStagedSkills();
      const after = listTmpStageDirs();
      // No new gsd-minimal-skills- dirs should have been created.
      assert.deepStrictEqual(after, before);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('exit handler registers exactly once across many stageSkillsForMode calls', () => {
    cleanupStagedSkills();
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-exit-handler-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    try {
      const before = process.listenerCount('exit');
      // Call 5x — install.js has 13 dispatch sites, so this matters.
      for (let i = 0; i < 5; i++) stageSkillsForMode(src, 'minimal');
      const after = process.listenerCount('exit');
      // Either 0 (handler was already registered by an earlier test) or +1.
      // Never +5.
      assert.ok(after - before <= 1, `expected <=1 new exit listener, got ${after - before}`);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      cleanupStagedSkills();
    }
  });

  test('SIGINT triggers cleanup and re-raises the signal (Ctrl+C path)', () => {
    // Run a child process that calls stageSkillsForMode then sleeps; send it
    // SIGINT and assert (a) the child exits with the SIGINT-induced status
    // (signal: 'SIGINT' OR exit code 130 depending on platform), and (b) the
    // staged tmp dir is gone afterwards. Skipping on Windows where signal
    // semantics differ — the unit test for natural `exit` covers Linux/macOS
    // CI matrix, and signal handling is a Unix concern in practice.
    if (process.platform === 'win32') return;

    const { spawnSync } = require('child_process');
    const probe = `
      const { stageSkillsForMode } = require(${JSON.stringify(
        path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'install-profiles.cjs'),
      )});
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-sig-src-'));
      fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\\n');
      const staged = stageSkillsForMode(src, 'minimal');
      // Print the staged path so the parent knows what to look for, then
      // signal readiness and block until SIGINT.
      process.stdout.write(staged + '\\n');
      setInterval(() => {}, 1000);
    `;
    // Spawn detached so we control the signal cleanly.
    const child = require('child_process').spawn(process.execPath, ['-e', probe], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let staged = '';
    child.stdout.on('data', (chunk) => {
      staged += chunk.toString();
      if (!staged.includes('\n')) return;
      // Once we have the staged path, send SIGINT and check on exit.
      child.kill('SIGINT');
    });

    return new Promise((resolve, reject) => {
      child.on('exit', (code, signal) => {
        try {
          const stagedPath = staged.split('\n')[0];
          assert.ok(
            stagedPath && stagedPath.startsWith(os.tmpdir()),
            `child should have printed a staged path under tmpdir, got: ${JSON.stringify(stagedPath)}`,
          );
          assert.ok(
            !fs.existsSync(stagedPath),
            `staged dir should have been cleaned up on SIGINT, but ${stagedPath} still exists`,
          );
          // The child should have exited *because* of the signal, not 0.
          assert.ok(
            signal === 'SIGINT' || code === 130 || code === null,
            `child should exit via SIGINT, got code=${code} signal=${signal}`,
          );
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      child.on('error', reject);
    });
  });

  test('mid-copy failure removes the partial staged dir and re-throws', () => {
    cleanupStagedSkills();
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-fail-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    try {
      // Force a failure mid-loop by making fs.copyFileSync throw on the
      // second allowlisted file. Capture the staged dir from the first
      // successful call (we can't see it directly, so we count tmp dirs).
      const before = listTmpStageDirs();
      const realCopy = fs.copyFileSync;
      let copyCount = 0;
      fs.copyFileSync = (s, d) => {
        copyCount++;
        if (copyCount === 2) throw new Error('synthetic disk full');
        return realCopy(s, d);
      };
      // Need at least 2 allowlisted files in src for the second copy to fire.
      fs.writeFileSync(path.join(src, 'execute-phase.md'), '# x\n');
      try {
        assert.throws(() => stageSkillsForMode(src, 'minimal'), /synthetic disk full/);
      } finally {
        fs.copyFileSync = realCopy;
      }
      const after = listTmpStageDirs();
      // Partial dir must have been cleaned up by stageSkillsForMode itself
      // before re-throwing — so the count is unchanged.
      assert.deepStrictEqual(after, before, 'partial staged dir should be removed on throw');
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      cleanupStagedSkills();
    }
  });
});

// Helper for the cleanup tests above. Listed as a sibling so the describe
// block stays focused on the contract assertions.
function listTmpStageDirs() {
  try {
    return fs
      .readdirSync(os.tmpdir())
      .filter((n) => n.startsWith('gsd-minimal-skills-'))
      .sort();
  } catch {
    return [];
  }
}

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

// ─── Claude full → minimal downgrade ────────────────────────────────────────
//
// Mirrors the Codex test for the most common runtime. The Codex test pins
// the .toml + config.toml cleanup; this one pins the .md-only path that
// every non-Codex runtime shares.
describe('install: Claude full → minimal downgrade removes stale agents', () => {
  const { spawnSync } = require('child_process');
  const installScript = path.join(__dirname, '..', 'bin', 'install.js');

  test('--minimal removes stale gsd-*.md agents but preserves user-owned agents', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-claude-downgrade-'));
    try {
      const agentsDir = path.join(targetDir, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });
      // Fake a previous full install + a user-owned agent:
      fs.writeFileSync(path.join(agentsDir, 'gsd-executor.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'gsd-planner.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'my-custom-agent.md'), 'user owns this\n');

      spawnSync(
        process.execPath,
        [installScript, '--claude', '--global', '--config-dir', targetDir, '--minimal'],
        { encoding: 'utf8' },
      );

      const remaining = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir) : [];
      assert.ok(!remaining.includes('gsd-executor.md'), 'stale gsd-executor.md removed');
      assert.ok(!remaining.includes('gsd-planner.md'), 'stale gsd-planner.md removed');
      assert.ok(remaining.includes('my-custom-agent.md'), 'user agent preserved');

      // No `gsd-*` files at all should remain:
      const stragglers = remaining.filter((f) => f.startsWith('gsd-'));
      assert.deepStrictEqual(stragglers, [], 'no gsd-* files should remain in agents/');
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});

// ─── Manifest mode field round-trip ─────────────────────────────────────────
//
// Locks in the contract that downstream tooling (uninstaller, drift detector,
// future profile-aware commands) can rely on the `mode` field being present
// and accurate after every install. Catches regressions in writeManifest's
// options threading.
describe('install: manifest records mode for both profiles', () => {
  const { spawnSync } = require('child_process');
  const installScript = path.join(__dirname, '..', 'bin', 'install.js');

  function manifestModeAfterInstall(extraArgs) {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-manifest-mode-'));
    try {
      spawnSync(
        process.execPath,
        [installScript, '--claude', '--global', '--config-dir', targetDir, ...extraArgs],
        { encoding: 'utf8' },
      );
      const manifestPath = path.join(targetDir, 'gsd-file-manifest.json');
      if (!fs.existsSync(manifestPath)) {
        return { mode: '<no manifest>', skillCount: 0, agentCount: 0 };
      }
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const skillCount = new Set(
        Object.keys(m.files || {})
          .filter((k) => k.startsWith('skills/'))
          .map((k) => k.split('/')[1]),
      ).size;
      const agentCount = Object.keys(m.files || {}).filter((k) => k.startsWith('agents/')).length;
      return { mode: m.mode, skillCount, agentCount };
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  test('default install records mode: "full" with the full skill+agent count', () => {
    const r = manifestModeAfterInstall([]);
    assert.strictEqual(r.mode, 'full');
    assert.ok(r.skillCount > 6, `full install should have >6 skills, got ${r.skillCount}`);
    assert.ok(r.agentCount > 0, `full install should have agents, got ${r.agentCount}`);
  });

  test('--minimal records mode: "minimal" with exactly 6 skills and 0 agents', () => {
    const r = manifestModeAfterInstall(['--minimal']);
    assert.strictEqual(r.mode, 'minimal');
    assert.strictEqual(r.skillCount, 6);
    assert.strictEqual(r.agentCount, 0);
  });

  test('--core-only is an alias for --minimal', () => {
    const r = manifestModeAfterInstall(['--core-only']);
    assert.strictEqual(r.mode, 'minimal');
    assert.strictEqual(r.skillCount, 6);
    assert.strictEqual(r.agentCount, 0);
  });
});

// ─── Allowlist scope guard ─────────────────────────────────────────────────
//
// Catches drift in the opposite direction: someone adds an off-loop command
// to the allowlist, or removes a main-loop command. The first test in this
// file asserts the exact set; these add semantic guard rails so the failure
// mode is clear ("autonomous shouldn't be in core") rather than just a diff.
describe('install-profiles: allowlist scope guards', () => {
  test('every main-loop command is in the allowlist', () => {
    for (const required of ['new-project', 'discuss-phase', 'plan-phase', 'execute-phase']) {
      assert.ok(
        shouldInstallSkill(required, 'minimal'),
        `main-loop command "${required}" must be in MINIMAL_SKILL_ALLOWLIST`,
      );
    }
  });

  test('off-loop convenience commands are NOT in the allowlist', () => {
    // These exist in commands/gsd/ and are valid skills, but they're not part
    // of the core main loop. If any of these slip into the allowlist the
    // floor erodes.
    for (const offLoop of [
      'autonomous',
      'ship',
      'do',
      'progress',
      'next',
      'fast',
      'quick',
      'debug',
      'code-review',
      'verify-work',
    ]) {
      assert.ok(
        !shouldInstallSkill(offLoop, 'minimal'),
        `off-loop command "${offLoop}" must NOT be in MINIMAL_SKILL_ALLOWLIST`,
      );
    }
  });

  test('mode is required to be a known string — defensive against typos', () => {
    // Any non-'minimal' mode should admit everything (full-mode behavior).
    // This catches a future bug where someone adds a 'compact' or 'tier2'
    // mode and forgets to wire up the predicate.
    for (const unknownMode of ['compact', 'tier2', 'CORE', 'Minimal', 'mini']) {
      assert.ok(
        shouldInstallSkill('autonomous', unknownMode),
        `unknown mode "${unknownMode}" should fall through to full behavior`,
      );
    }
  });
});
