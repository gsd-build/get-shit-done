'use strict';
/**
 * Regression tests for two confirmed defects from commit 6c676dbc (#3664)
 * and three legacy-migration gaps caught in cc2ecb97 (#3664 Phase 2):
 *
 *   Defect #1 — Hermes upgrade leaves stale skills/gsd/gsd-<stem>/ dirs
 *     _runLegacyInstallMigrations only removed pre-#2841 flat skills/gsd-slash-star
 *     dirs; it did not remove the intermediate skills/gsd/gsd-slash-star layout that
 *     existed between #2841 and #3664.
 *
 *   Defect #2 — `--hermes --profile=core` falls through to wrong path
 *     The dispatcher's minimal-mode block had no `isHermes && _isCoreProfileAlias`
 *     branch, so Hermes + core fell to the terminal `else` (Claude local path),
 *     writing commands/gsd/<stem>.md instead of skills/gsd/.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { createTempDir, cleanup } = require('./helpers.cjs');
const {
  loadSkillsManifest,
  resolveProfile,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

// Load install exports via GSD_TEST_MODE to skip CLI main()
const savedTestMode = process.env.GSD_TEST_MODE;
process.env.GSD_TEST_MODE = '1';
let installExports;
try {
  installExports = require('../bin/install.js');
} finally {
  if (savedTestMode === undefined) delete process.env.GSD_TEST_MODE;
  else process.env.GSD_TEST_MODE = savedTestMode;
}

const { installRuntimeArtifacts, uninstallRuntimeArtifacts } = installExports || {};

const INSTALL_SCRIPT = path.join(__dirname, '..', 'bin', 'install.js');
const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const MANIFEST = loadSkillsManifest(REAL_COMMANDS_DIR);
const RESOLVED_CORE = resolveProfile({ modes: ['core'], manifest: MANIFEST });

// ---------------------------------------------------------------------------
// Test A1 — Defect #1 regression: stale skills/gsd/gsd-*/ dirs are removed
// ---------------------------------------------------------------------------

describe('Defect #1 regression: _runLegacyInstallMigrations removes skills/gsd/gsd-*/ layout', () => {
  test('installRuntimeArtifacts removes intermediate skills/gsd/gsd-*/ dirs and writes new bare-stem layout', (t) => {
    const configDir = createTempDir('gsd-hermes-reg1-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(
      typeof installRuntimeArtifacts,
      'function',
      'installRuntimeArtifacts must be exported from bin/install.js',
    );

    // Pre-create the intermediate Hermes layout (between #2841 and #3664):
    // skills/gsd/gsd-help/SKILL.md and skills/gsd/gsd-plan/SKILL.md
    const nestedGsdDir = path.join(configDir, 'skills', 'gsd');
    fs.mkdirSync(path.join(nestedGsdDir, 'gsd-help'), { recursive: true });
    fs.writeFileSync(path.join(nestedGsdDir, 'gsd-help', 'SKILL.md'), '# legacy help\n');
    fs.mkdirSync(path.join(nestedGsdDir, 'gsd-plan'), { recursive: true });
    fs.writeFileSync(path.join(nestedGsdDir, 'gsd-plan', 'SKILL.md'), '# legacy plan\n');

    // Create a sibling non-gsd dir inside skills/gsd/ that must survive
    const userContentDir = path.join(nestedGsdDir, 'user-content');
    fs.mkdirSync(userContentDir, { recursive: true });
    fs.writeFileSync(path.join(userContentDir, 'SKILL.md'), '# user content\n');

    // Run the unified install
    installRuntimeArtifacts('hermes', configDir, 'global', RESOLVED_CORE);

    // Stale intermediate dirs must be gone
    assert.ok(
      !fs.existsSync(path.join(nestedGsdDir, 'gsd-help')),
      'skills/gsd/gsd-help/ must be removed by install migration (Defect #1)',
    );
    assert.ok(
      !fs.existsSync(path.join(nestedGsdDir, 'gsd-plan')),
      'skills/gsd/gsd-plan/ must be removed by install migration (Defect #1)',
    );

    // New bare-stem layout must exist
    assert.ok(
      fs.existsSync(path.join(nestedGsdDir, 'help', 'SKILL.md')),
      'skills/gsd/help/SKILL.md must exist after install (new bare-stem layout)',
    );

    // User content in skills/gsd/ must be preserved (user-content has no gsd- prefix)
    assert.ok(
      fs.existsSync(path.join(userContentDir, 'SKILL.md')),
      'skills/gsd/user-content/SKILL.md must be preserved (user content)',
    );
  });
});

// ---------------------------------------------------------------------------
// Test Q1 — Qwen variant of Defect #2: --qwen --profile=core uses skills/gsd-*/ path
// ---------------------------------------------------------------------------

describe('Qwen Defect #2 regression: --qwen --profile=core writes skills/gsd-*/, not commands/gsd/', () => {
  test('spawn node bin/install.js --qwen --global --profile=core: skills/gsd-*/ written, no commands/gsd/', (t) => {
    const root = createTempDir('gsd-qwen-reg2-');
    t.after(() => cleanup(root));

    const result = spawnSync(
      process.execPath,
      [INSTALL_SCRIPT, '--qwen', '--global', '--config-dir', root, '--profile=core'],
      {
        encoding: 'utf8',
        env: { ...process.env, HOME: root, USERPROFILE: root },
      },
    );

    assert.strictEqual(
      result.status,
      0,
      `installer exited with status ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    // skills/ must exist and contain at least one gsd-<stem>/ dir with SKILL.md
    const qwenSkillsDir = path.join(root, 'skills');
    assert.ok(
      fs.existsSync(qwenSkillsDir),
      `skills/ must exist after --qwen --profile=core install (got: ${result.stdout})`,
    );

    const skillDirs = fs.readdirSync(qwenSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('gsd-'));
    assert.ok(
      skillDirs.length >= 1,
      `skills/ must contain at least one gsd-* skill dir, got: ${
        fs.readdirSync(qwenSkillsDir, { withFileTypes: true }).map((e) => e.name).join(', ')
      }`,
    );

    // Verify at least one gsd-* dir has SKILL.md
    const hasSkillMd = skillDirs.some((e) =>
      fs.existsSync(path.join(qwenSkillsDir, e.name, 'SKILL.md')),
    );
    assert.ok(hasSkillMd, 'at least one skills/gsd-*/SKILL.md must exist');

    // commands/gsd/*.md must NOT exist (the regression path that Defect #2 causes for Qwen)
    const commandsGsd = path.join(root, 'commands', 'gsd');
    if (fs.existsSync(commandsGsd)) {
      const mdFiles = fs.readdirSync(commandsGsd).filter((f) => f.endsWith('.md'));
      assert.strictEqual(
        mdFiles.length,
        0,
        `commands/gsd/ must not contain .md files after qwen install (Qwen Defect #2). Found: ${mdFiles.join(', ')}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Test A2 — Defect #2 regression: --hermes --profile=core uses skills/gsd/ path
// ---------------------------------------------------------------------------

describe('Defect #2 regression: --hermes --profile=core writes skills/gsd/, not commands/gsd/', () => {
  test('spawn node bin/install.js --hermes --global --profile=core: skills/gsd/ written, no commands/gsd/', (t) => {
    const root = createTempDir('gsd-hermes-reg2-');
    t.after(() => cleanup(root));

    const result = spawnSync(
      process.execPath,
      [INSTALL_SCRIPT, '--hermes', '--global', '--config-dir', root, '--profile=core'],
      {
        encoding: 'utf8',
        env: { ...process.env, HOME: root, USERPROFILE: root },
      },
    );

    assert.strictEqual(
      result.status,
      0,
      `installer exited with status ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    // skills/gsd/ must exist and contain at least one <stem>/SKILL.md file
    const hermesSkillsGsd = path.join(root, 'skills', 'gsd');
    assert.ok(
      fs.existsSync(hermesSkillsGsd),
      `skills/gsd/ must exist after --hermes --profile=core install (got: ${result.stdout})`,
    );

    const skillDirs = fs.readdirSync(hermesSkillsGsd, { withFileTypes: true })
      .filter((e) => e.isDirectory());
    assert.ok(
      skillDirs.length >= 1,
      `skills/gsd/ must contain at least one skill dir, got: ${skillDirs.map((e) => e.name).join(', ')}`,
    );

    // Verify at least one skill dir has SKILL.md
    const hasSkillMd = skillDirs.some((e) =>
      fs.existsSync(path.join(hermesSkillsGsd, e.name, 'SKILL.md')),
    );
    assert.ok(hasSkillMd, 'at least one skills/gsd/<stem>/SKILL.md must exist');

    // commands/gsd/*.md must NOT exist (the regression path that Defect #2 caused)
    const commandsGsd = path.join(root, 'commands', 'gsd');
    if (fs.existsSync(commandsGsd)) {
      const mdFiles = fs.readdirSync(commandsGsd).filter((f) => f.endsWith('.md'));
      assert.strictEqual(
        mdFiles.length,
        0,
        `commands/gsd/ must not contain .md files after hermes install (Defect #2). Found: ${mdFiles.join(', ')}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Test M1 — Hermes minimal-mode migrates dev-preferences (#2973)
// Hermes uses nested layout (skills/gsd/<stem>/SKILL.md, prefix=''),
// so dev-preferences lands at skills/gsd/dev-preferences/SKILL.md NOT
// skills/gsd-dev-preferences/SKILL.md (the flat layout for qwen/claude-global).
// ---------------------------------------------------------------------------

describe('M1: --hermes --global --profile=core migrates dev-preferences.md → skills/gsd/dev-preferences/SKILL.md', () => {
  test('spawn node bin/install.js --hermes --global --profile=core: dev-preferences migrated, source gone', (t) => {
    const root = createTempDir('gsd-hermes-m1-');
    t.after(() => cleanup(root));

    // Pre-create legacy commands/gsd/dev-preferences.md
    const legacyDir = path.join(root, 'commands', 'gsd');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'dev-preferences.md'), '# my hermes prefs\n');

    const result = spawnSync(
      process.execPath,
      [INSTALL_SCRIPT, '--hermes', '--global', '--config-dir', root, '--profile=core'],
      {
        encoding: 'utf8',
        env: { ...process.env, HOME: root, USERPROFILE: root },
      },
    );

    assert.strictEqual(
      result.status,
      0,
      `installer exited with status ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    // Migration target must exist at the HERMES nested location (skills/gsd/dev-preferences/SKILL.md)
    // NOT the flat location skills/gsd-dev-preferences/SKILL.md used by qwen/claude-global.
    const skillFile = path.join(root, 'skills', 'gsd', 'dev-preferences', 'SKILL.md');
    assert.ok(
      fs.existsSync(skillFile),
      `skills/gsd/dev-preferences/SKILL.md must exist after migration (M1: Hermes nested layout, not flat)`,
    );
    const content = fs.readFileSync(skillFile, 'utf8');
    assert.strictEqual(
      content,
      '# my hermes prefs\n',
      `skills/gsd/dev-preferences/SKILL.md content must equal original, got: ${JSON.stringify(content)}`,
    );

    // Legacy source must be gone
    assert.ok(
      !fs.existsSync(path.join(legacyDir, 'dev-preferences.md')),
      'commands/gsd/dev-preferences.md must be removed after migration (M1)',
    );
  });
});

// ---------------------------------------------------------------------------
// Test M2 — Qwen minimal-mode migrates dev-preferences (#2973)
// ---------------------------------------------------------------------------

describe('M2: --qwen --global --profile=core migrates dev-preferences.md → skills/gsd-dev-preferences/SKILL.md', () => {
  test('spawn node bin/install.js --qwen --global --profile=core: dev-preferences migrated, source gone', (t) => {
    const root = createTempDir('gsd-qwen-m2-');
    t.after(() => cleanup(root));

    // Pre-create legacy commands/gsd/dev-preferences.md
    const legacyDir = path.join(root, 'commands', 'gsd');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'dev-preferences.md'), '# my qwen prefs\n');

    const result = spawnSync(
      process.execPath,
      [INSTALL_SCRIPT, '--qwen', '--global', '--config-dir', root, '--profile=core'],
      {
        encoding: 'utf8',
        env: { ...process.env, HOME: root, USERPROFILE: root },
      },
    );

    assert.strictEqual(
      result.status,
      0,
      `installer exited with status ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    // Migration target must exist and contain the original content
    const skillFile = path.join(root, 'skills', 'gsd-dev-preferences', 'SKILL.md');
    assert.ok(
      fs.existsSync(skillFile),
      `skills/gsd-dev-preferences/SKILL.md must exist after migration (M2: _runLegacyInstallMigrations missing in qwen minimal branch)`,
    );
    const content = fs.readFileSync(skillFile, 'utf8');
    assert.strictEqual(
      content,
      '# my qwen prefs\n',
      `skills/gsd-dev-preferences/SKILL.md content must equal original, got: ${JSON.stringify(content)}`,
    );

    // Legacy source must be gone
    assert.ok(
      !fs.existsSync(path.join(legacyDir, 'dev-preferences.md')),
      'commands/gsd/dev-preferences.md must be removed after migration (M2)',
    );
  });
});

// ---------------------------------------------------------------------------
// Test M3 — Claude global minimal-mode migrates dev-preferences (#2973)
// ---------------------------------------------------------------------------

describe('M3: --claude --global --profile=core migrates dev-preferences.md → skills/gsd-dev-preferences/SKILL.md', () => {
  test('spawn node bin/install.js --claude --global --profile=core: dev-preferences migrated, source gone', (t) => {
    const root = createTempDir('gsd-claude-m3-');
    t.after(() => cleanup(root));

    // Pre-create legacy commands/gsd/dev-preferences.md
    const legacyDir = path.join(root, 'commands', 'gsd');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'dev-preferences.md'), '# my claude prefs\n');

    const result = spawnSync(
      process.execPath,
      [INSTALL_SCRIPT, '--claude', '--global', '--config-dir', root, '--profile=core'],
      {
        encoding: 'utf8',
        env: { ...process.env, HOME: root, USERPROFILE: root },
      },
    );

    assert.strictEqual(
      result.status,
      0,
      `installer exited with status ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    // Migration target must exist and contain the original content
    const skillFile = path.join(root, 'skills', 'gsd-dev-preferences', 'SKILL.md');
    assert.ok(
      fs.existsSync(skillFile),
      `skills/gsd-dev-preferences/SKILL.md must exist after migration (M3: _runLegacyInstallMigrations missing in claude-global-minimal branch)`,
    );
    const content = fs.readFileSync(skillFile, 'utf8');
    assert.strictEqual(
      content,
      '# my claude prefs\n',
      `skills/gsd-dev-preferences/SKILL.md content must equal original, got: ${JSON.stringify(content)}`,
    );

    // Legacy source must be gone
    assert.ok(
      !fs.existsSync(path.join(legacyDir, 'dev-preferences.md')),
      'commands/gsd/dev-preferences.md must be removed after migration (M3)',
    );
  });
});

// ---------------------------------------------------------------------------
// Test U1 — Qwen uninstall preserves dev-preferences via migration to skill
// ---------------------------------------------------------------------------

describe('U1: uninstallRuntimeArtifacts qwen preserves dev-preferences.md via migration to skills/gsd-dev-preferences/SKILL.md', () => {
  test('uninstallRuntimeArtifacts("qwen"): commands/gsd/ removed, dev-preferences migrated to skills skill', (t) => {
    const configDir = createTempDir('gsd-qwen-uninstall-u1-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(
      typeof uninstallRuntimeArtifacts,
      'function',
      'uninstallRuntimeArtifacts must be exported from bin/install.js',
    );

    // Pre-create legacy commands/gsd/ with dev-preferences.md and a managed file
    const legacyDir = path.join(configDir, 'commands', 'gsd');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'dev-preferences.md'), '# my qwen prefs\n');
    fs.writeFileSync(path.join(legacyDir, 'help.md'), '# help content\n');

    uninstallRuntimeArtifacts('qwen', configDir, 'global');

    // Legacy managed file must be gone (whole commands/gsd/ removed)
    assert.ok(
      !fs.existsSync(path.join(legacyDir, 'help.md')),
      'commands/gsd/help.md must be removed by qwen uninstall (U1)',
    );

    // dev-preferences.md must NOT be left behind in the legacy dir
    assert.ok(
      !fs.existsSync(path.join(legacyDir, 'dev-preferences.md')),
      'commands/gsd/dev-preferences.md must not exist after qwen uninstall (U1)',
    );

    // dev-preferences.md must be migrated to skills/gsd-dev-preferences/SKILL.md
    const skillFile = path.join(configDir, 'skills', 'gsd-dev-preferences', 'SKILL.md');
    assert.ok(
      fs.existsSync(skillFile),
      'skills/gsd-dev-preferences/SKILL.md must exist after qwen uninstall (U1: #2973 migration)',
    );
    const content = fs.readFileSync(skillFile, 'utf8');
    assert.strictEqual(
      content,
      '# my qwen prefs\n',
      `skills/gsd-dev-preferences/SKILL.md content must equal original, got: ${JSON.stringify(content)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Test U2 — Claude-global uninstall preserves dev-preferences via migration to skill
// ---------------------------------------------------------------------------

describe('U2: uninstallRuntimeArtifacts claude/global preserves dev-preferences.md via migration to skills/gsd-dev-preferences/SKILL.md', () => {
  test('uninstallRuntimeArtifacts("claude", scope="global"): commands/gsd/ removed, dev-preferences migrated to skills skill', (t) => {
    const configDir = createTempDir('gsd-claude-uninstall-u2-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(
      typeof uninstallRuntimeArtifacts,
      'function',
      'uninstallRuntimeArtifacts must be exported from bin/install.js',
    );

    // Pre-create legacy commands/gsd/ with dev-preferences.md
    const legacyDir = path.join(configDir, 'commands', 'gsd');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'dev-preferences.md'), '# my claude prefs\n');

    uninstallRuntimeArtifacts('claude', configDir, 'global');

    // dev-preferences.md must NOT be left in the legacy dir
    assert.ok(
      !fs.existsSync(path.join(legacyDir, 'dev-preferences.md')),
      'commands/gsd/dev-preferences.md must not exist after claude-global uninstall (U2)',
    );

    // dev-preferences.md must be migrated to skills/gsd-dev-preferences/SKILL.md
    const skillFile = path.join(configDir, 'skills', 'gsd-dev-preferences', 'SKILL.md');
    assert.ok(
      fs.existsSync(skillFile),
      'skills/gsd-dev-preferences/SKILL.md must exist after claude-global uninstall (U2: #2973 migration)',
    );
    const content = fs.readFileSync(skillFile, 'utf8');
    assert.strictEqual(
      content,
      '# my claude prefs\n',
      `skills/gsd-dev-preferences/SKILL.md content must equal original, got: ${JSON.stringify(content)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Test U3 — Hermes uninstall migrates dev-preferences to NESTED location (#2973)
// Proves both Finding 1 (wrong target path) and Finding 2 (unconditional restore).
// ---------------------------------------------------------------------------

describe('U3: uninstallRuntimeArtifacts hermes migrates dev-preferences.md → skills/gsd/dev-preferences/SKILL.md', () => {
  test('uninstallRuntimeArtifacts("hermes"): commands/gsd/ NOT recreated, dev-preferences at nested Hermes location', (t) => {
    const configDir = createTempDir('gsd-hermes-uninstall-u3-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(
      typeof uninstallRuntimeArtifacts,
      'function',
      'uninstallRuntimeArtifacts must be exported from bin/install.js',
    );

    // Pre-create legacy commands/gsd/dev-preferences.md
    const legacyDir = path.join(configDir, 'commands', 'gsd');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'dev-preferences.md'), '# my hermes prefs (uninstall path)\n');

    uninstallRuntimeArtifacts('hermes', configDir, 'global');

    // commands/gsd/dev-preferences.md must be GONE — no recreation after rmSync
    assert.ok(
      !fs.existsSync(path.join(legacyDir, 'dev-preferences.md')),
      'commands/gsd/dev-preferences.md must not exist after hermes uninstall (U3: Finding 2 — no unconditional restore)',
    );

    // dev-preferences must be at the HERMES nested location (skills/gsd/dev-preferences/SKILL.md)
    // NOT the flat location skills/gsd-dev-preferences/SKILL.md (that is qwen/claude-global)
    const skillFile = path.join(configDir, 'skills', 'gsd', 'dev-preferences', 'SKILL.md');
    assert.ok(
      fs.existsSync(skillFile),
      'skills/gsd/dev-preferences/SKILL.md must exist after hermes uninstall (U3: Finding 1 — runtime-aware migration target)',
    );
    const content = fs.readFileSync(skillFile, 'utf8');
    assert.strictEqual(
      content,
      '# my hermes prefs (uninstall path)\n',
      `skills/gsd/dev-preferences/SKILL.md content must equal original, got: ${JSON.stringify(content)}`,
    );
  });
});
