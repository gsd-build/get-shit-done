'use strict';
/**
 * Phase 2 TDD — red tests for installRuntimeArtifacts / uninstallRuntimeArtifacts.
 *
 * These tests MUST fail with "TypeError: installRuntimeArtifacts is not a function"
 * (or equivalent) until the production implementation is added to bin/install.js.
 *
 * Conventions:
 *   - node:test + node:assert/strict
 *   - helpers.cjs for createTempDir / cleanup
 *   - Filesystem assertions only — no source-grep, no .includes() on file content
 *   - Per-runtime parameterisation where applicable
 *   - t.after() for cleanup
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { createTempDir, cleanup } = require('./helpers.cjs');
const {
  resolveRuntimeArtifactLayout,
} = require('../get-shit-done/bin/lib/runtime-artifact-layout.cjs');
const {
  loadSkillsManifest,
  resolveProfile,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

// ---------------------------------------------------------------------------
// Load target exports — will be undefined until Phase 2 ships
// ---------------------------------------------------------------------------

// GSD_TEST_MODE prevents install.js from running its CLI main() on require.
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

// ---------------------------------------------------------------------------
// Shared resolved profile (core — deterministic small set)
// ---------------------------------------------------------------------------

// The real commands/gsd dir is used by the layout module's source-root walk.
// We load its manifest so resolveProfile gives us the correct transitive closure.
const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const MANIFEST = loadSkillsManifest(REAL_COMMANDS_DIR);
const RESOLVED_CORE = resolveProfile({ modes: ['core'], manifest: MANIFEST });

// ---------------------------------------------------------------------------
// Runtime lists
// ---------------------------------------------------------------------------

// Runtimes that use a "skills" kind at global scope
const SKILLS_RUNTIMES = [
  'claude', 'cursor', 'codex', 'copilot', 'antigravity',
  'windsurf', 'augment', 'trae', 'qwen', 'codebuddy',
];

// All 15 runtimes in the layout table
const ALL_RUNTIMES = [
  'claude', 'cursor', 'gemini', 'codex', 'copilot', 'antigravity',
  'windsurf', 'augment', 'trae', 'qwen', 'hermes', 'codebuddy',
  'cline', 'opencode', 'kilo',
];

// ---------------------------------------------------------------------------
// Helper: count entries in destDir whose name starts with prefix
// ---------------------------------------------------------------------------
function countPrefixedEntries(destDir, prefix) {
  if (!fs.existsSync(destDir)) return 0;
  return fs.readdirSync(destDir).filter((n) => n.startsWith(prefix)).length;
}

// ---------------------------------------------------------------------------
// Helper: write fixture skill entry in destDir
// For skills runtimes: creates <destDir>/<prefix><stem>/SKILL.md
// For commands runtimes: creates <destDir>/<prefix><stem>.md
// ---------------------------------------------------------------------------
function writeSkillEntry(destDir, prefix, stem) {
  const entryName = `${prefix}${stem}`;
  const entryDir = path.join(destDir, entryName);
  fs.mkdirSync(entryDir, { recursive: true });
  fs.writeFileSync(path.join(entryDir, 'SKILL.md'), `# ${stem}\n`);
}

function writeCommandEntry(destDir, prefix, stem) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, `${prefix}${stem}.md`), `# ${stem}\n`);
}

// ---------------------------------------------------------------------------
// describe 1 — installRuntimeArtifacts: layout-driven install loop
// ---------------------------------------------------------------------------

describe('installRuntimeArtifacts — layout-driven install loop', () => {
  // Standard skills runtimes: gsd-prefixed dirs in <configDir>/skills/
  for (const runtime of SKILLS_RUNTIMES) {
    test(`${runtime}: installs gsd-prefixed skill dirs into <configDir>/skills/`, (t) => {
      const configDir = createTempDir(`gsd-ial-${runtime}-`);
      t.after(() => cleanup(configDir));

      assert.strictEqual(
        typeof installRuntimeArtifacts,
        'function',
        'installRuntimeArtifacts must be exported from bin/install.js'
      );

      installRuntimeArtifacts(runtime, configDir, 'global', RESOLVED_CORE);

      const layout = resolveRuntimeArtifactLayout(runtime, configDir, 'global');
      const skillsKind = layout.kinds.find((k) => k.kind === 'skills');
      assert.ok(skillsKind, `${runtime} must have a skills kind in global scope`);

      const destDir = path.join(configDir, skillsKind.destSubpath);
      assert.ok(fs.existsSync(destDir), `destDir must exist after install: ${destDir}`);

      // At least one SKILL.md was written
      const helpDir = path.join(destDir, `${skillsKind.prefix}help`);
      assert.ok(
        fs.existsSync(path.join(helpDir, 'SKILL.md')),
        `${runtime}: skills/${skillsKind.prefix}help/SKILL.md must exist after install`
      );

      // Count of gsd-prefixed dirs matches resolved profile's skills size
      const prefixedCount = countPrefixedEntries(destDir, skillsKind.prefix || 'gsd-');
      const expectedCount = RESOLVED_CORE.skills === '*'
        ? prefixedCount // full profile: just check non-zero
        : RESOLVED_CORE.skills.size;
      assert.ok(
        prefixedCount >= 1,
        `${runtime}: at least one skill dir must be present, got ${prefixedCount}`
      );
      if (RESOLVED_CORE.skills !== '*') {
        assert.strictEqual(
          prefixedCount,
          expectedCount,
          `${runtime}: number of installed skill dirs must match profile skills count`
        );
      }
    });
  }

  // hermes: nested layout — skills/gsd/<stem>/SKILL.md, prefix is ''
  test('hermes: nested layout — skills/gsd/<stem>/SKILL.md, no gsd- prefix in name', (t) => {
    const configDir = createTempDir('gsd-ial-hermes-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(typeof installRuntimeArtifacts, 'function');

    installRuntimeArtifacts('hermes', configDir, 'global', RESOLVED_CORE);

    const nestedDir = path.join(configDir, 'skills', 'gsd');
    assert.ok(fs.existsSync(nestedDir), 'skills/gsd/ must exist after hermes install');

    // help skill: skills/gsd/help/SKILL.md (prefix is '', so no gsd- prefix on stem)
    const helpSkillMd = path.join(nestedDir, 'help', 'SKILL.md');
    assert.ok(
      fs.existsSync(helpSkillMd),
      'hermes: skills/gsd/help/SKILL.md must exist'
    );

    // Verify no gsd- prefixed entry at skills/gsd/gsd-help (prefix must be '')
    const wrongEntry = path.join(nestedDir, 'gsd-help');
    assert.ok(
      !fs.existsSync(wrongEntry),
      'hermes: skills/gsd/gsd-help must NOT exist (prefix should be empty)'
    );
  });

  // gemini: commands kind — commands/gsd/<stem>.md, no skills/ dir
  test('gemini: commands layout — commands/gsd/ is created, no skills/ dir', (t) => {
    const configDir = createTempDir('gsd-ial-gemini-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(typeof installRuntimeArtifacts, 'function');

    installRuntimeArtifacts('gemini', configDir, 'global', RESOLVED_CORE);

    const commandsGsdDir = path.join(configDir, 'commands', 'gsd');
    assert.ok(
      fs.existsSync(commandsGsdDir),
      'gemini: commands/gsd/ must exist after install'
    );

    // help.md should be present (part of core profile)
    assert.ok(
      fs.existsSync(path.join(commandsGsdDir, 'help.md')),
      'gemini: commands/gsd/help.md must exist'
    );

    // No skills/ directory should be created for gemini
    const skillsDir = path.join(configDir, 'skills');
    assert.ok(
      !fs.existsSync(skillsDir),
      'gemini: skills/ must NOT be created'
    );
  });

  // cline: kinds is [] — call must succeed, no dirs created
  test('cline: no kinds — call succeeds, no skills/ or commands/ created', (t) => {
    const configDir = createTempDir('gsd-ial-cline-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(typeof installRuntimeArtifacts, 'function');

    // Must not throw
    assert.doesNotThrow(() => {
      installRuntimeArtifacts('cline', configDir, 'global', RESOLVED_CORE);
    }, 'installRuntimeArtifacts must not throw for cline');

    const skillsDir = path.join(configDir, 'skills');
    const commandsDir = path.join(configDir, 'commands');
    assert.ok(!fs.existsSync(skillsDir), 'cline: skills/ must NOT be created');
    assert.ok(!fs.existsSync(commandsDir), 'cline: commands/ must NOT be created');
  });

  // opencode: flat commands — command/gsd-<stem>.md
  test('opencode: flat commands layout — command/gsd-help.md exists', (t) => {
    const configDir = createTempDir('gsd-ial-opencode-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(typeof installRuntimeArtifacts, 'function');

    installRuntimeArtifacts('opencode', configDir, 'global', RESOLVED_CORE);

    const commandDir = path.join(configDir, 'command');
    assert.ok(fs.existsSync(commandDir), 'opencode: command/ must exist');
    assert.ok(
      fs.existsSync(path.join(commandDir, 'gsd-help.md')),
      'opencode: command/gsd-help.md must exist'
    );
  });

  // kilo: same flat commands layout as opencode
  test('kilo: flat commands layout — command/gsd-help.md exists', (t) => {
    const configDir = createTempDir('gsd-ial-kilo-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(typeof installRuntimeArtifacts, 'function');

    installRuntimeArtifacts('kilo', configDir, 'global', RESOLVED_CORE);

    const commandDir = path.join(configDir, 'command');
    assert.ok(fs.existsSync(commandDir), 'kilo: command/ must exist');
    assert.ok(
      fs.existsSync(path.join(commandDir, 'gsd-help.md')),
      'kilo: command/gsd-help.md must exist'
    );
  });
});

// ---------------------------------------------------------------------------
// describe 2 — uninstallRuntimeArtifacts: layout-driven removal
// ---------------------------------------------------------------------------

describe('uninstallRuntimeArtifacts — layout-driven removal', () => {
  for (const runtime of ALL_RUNTIMES) {
    test(`${runtime}: removes gsd-owned entries, preserves foreign entries`, (t) => {
      const configDir = createTempDir(`gsd-ual-${runtime}-`);
      t.after(() => cleanup(configDir));

      assert.strictEqual(
        typeof uninstallRuntimeArtifacts,
        'function',
        'uninstallRuntimeArtifacts must be exported from bin/install.js'
      );

      const layout = resolveRuntimeArtifactLayout(runtime, configDir, 'global');

      if (layout.kinds.length === 0) {
        // cline: no kinds — call must succeed and not touch anything
        const foreignDir = path.join(configDir, 'foreign-dir');
        fs.mkdirSync(foreignDir, { recursive: true });
        fs.writeFileSync(path.join(foreignDir, 'keep.md'), '# keep\n');

        assert.doesNotThrow(() => {
          uninstallRuntimeArtifacts(runtime, configDir, 'global');
        }, `${runtime}: uninstallRuntimeArtifacts must not throw with empty kinds`);

        assert.ok(
          fs.existsSync(path.join(foreignDir, 'keep.md')),
          `${runtime}: foreign entries must not be touched`
        );
        return;
      }

      // For hermes: special handling — prefix is '', destSubpath is 'skills/gsd'
      // The "namespace IS the prefix": everything under skills/gsd/ is gsd-owned.
      // We pre-create a sibling skills/user-skill/ that must survive.
      if (runtime === 'hermes') {
        const kind = layout.kinds[0];
        const destDir = path.join(configDir, kind.destSubpath);
        fs.mkdirSync(destDir, { recursive: true });
        // Create nested skill entries (prefix is '' so names have no gsd- prefix)
        const helpDir = path.join(destDir, 'help');
        fs.mkdirSync(helpDir, { recursive: true });
        fs.writeFileSync(path.join(helpDir, 'SKILL.md'), '# help\n');
        const phaseDir = path.join(destDir, 'phase');
        fs.mkdirSync(phaseDir, { recursive: true });
        fs.writeFileSync(path.join(phaseDir, 'SKILL.md'), '# phase\n');

        // Sibling at skills/ level — must be preserved
        const siblingDir = path.join(configDir, 'skills', 'user-skill');
        fs.mkdirSync(siblingDir, { recursive: true });
        fs.writeFileSync(path.join(siblingDir, 'SKILL.md'), '# user skill\n');

        uninstallRuntimeArtifacts(runtime, configDir, 'global');

        // skills/gsd/ itself and its children should be removed
        assert.ok(
          !fs.existsSync(destDir),
          'hermes: skills/gsd/ must be removed by uninstall'
        );

        // Sibling skills/user-skill/ must survive
        assert.ok(
          fs.existsSync(path.join(siblingDir, 'SKILL.md')),
          'hermes: skills/user-skill/ must be preserved'
        );
        return;
      }

      // General case for all other runtimes
      for (const kind of layout.kinds) {
        const destDir = path.join(configDir, kind.destSubpath);
        fs.mkdirSync(destDir, { recursive: true });

        if (kind.kind === 'skills') {
          // Write two gsd-prefixed skill dirs and one foreign dir
          writeSkillEntry(destDir, kind.prefix, 'help');
          writeSkillEntry(destDir, kind.prefix, 'phase');
          // Foreign entry: no matching prefix
          const foreignDir = path.join(destDir, 'user-custom-skill');
          fs.mkdirSync(foreignDir, { recursive: true });
          fs.writeFileSync(path.join(foreignDir, 'SKILL.md'), '# user\n');
        } else if (kind.kind === 'commands' || kind.kind === 'agents') {
          // Write two gsd-prefixed command/agent files and one foreign file
          writeCommandEntry(destDir, kind.prefix, 'help');
          writeCommandEntry(destDir, kind.prefix, 'phase');
          // Foreign entry
          fs.writeFileSync(path.join(destDir, 'user-custom.md'), '# user\n');
        }
      }

      uninstallRuntimeArtifacts(runtime, configDir, 'global');

      for (const kind of layout.kinds) {
        const destDir = path.join(configDir, kind.destSubpath);

        if (kind.kind === 'skills') {
          // gsd-prefixed skill dirs must be gone
          const helpDir = path.join(destDir, `${kind.prefix}help`);
          const phaseDir = path.join(destDir, `${kind.prefix}phase`);
          assert.ok(
            !fs.existsSync(helpDir),
            `${runtime}: ${kind.prefix}help dir must be removed`
          );
          assert.ok(
            !fs.existsSync(phaseDir),
            `${runtime}: ${kind.prefix}phase dir must be removed`
          );
          // Foreign entry must survive
          const foreignDir = path.join(destDir, 'user-custom-skill');
          assert.ok(
            fs.existsSync(path.join(foreignDir, 'SKILL.md')),
            `${runtime}: user-custom-skill/SKILL.md must be preserved`
          );
        } else if (kind.kind === 'commands' || kind.kind === 'agents') {
          // gsd-prefixed files must be gone
          assert.ok(
            !fs.existsSync(path.join(destDir, `${kind.prefix}help.md`)),
            `${runtime}: ${kind.prefix}help.md must be removed`
          );
          assert.ok(
            !fs.existsSync(path.join(destDir, `${kind.prefix}phase.md`)),
            `${runtime}: ${kind.prefix}phase.md must be removed`
          );
          // Foreign file must survive
          assert.ok(
            fs.existsSync(path.join(destDir, 'user-custom.md')),
            `${runtime}: user-custom.md must be preserved`
          );
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// describe 3 — installRuntimeArtifacts: legacy migrations run before layout copy
// ---------------------------------------------------------------------------

describe('installRuntimeArtifacts — legacy migrations run before layout-driven copy', () => {
  test('claude: legacy commands/gsd/dev-preferences.md migrated AND new skills written', (t) => {
    const configDir = createTempDir('gsd-legacy-install-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(typeof installRuntimeArtifacts, 'function');

    // Pre-create the legacy state: commands/gsd/dev-preferences.md
    const legacyCommandsGsd = path.join(configDir, 'commands', 'gsd');
    fs.mkdirSync(legacyCommandsGsd, { recursive: true });
    fs.writeFileSync(
      path.join(legacyCommandsGsd, 'dev-preferences.md'),
      '# My dev preferences\n'
    );

    // Call the new unified function
    installRuntimeArtifacts('claude', configDir, 'global', RESOLVED_CORE);

    // Legacy migration side-effect: commands/gsd/ must be removed (legacy cleanup)
    assert.ok(
      !fs.existsSync(legacyCommandsGsd),
      'claude: legacy commands/gsd/ must be cleaned up by install migration'
    );

    // Migration side-effect: dev-preferences.md → skills/gsd-dev-preferences/SKILL.md
    const devPrefSkill = path.join(configDir, 'skills', 'gsd-dev-preferences', 'SKILL.md');
    assert.ok(
      fs.existsSync(devPrefSkill),
      'claude: skills/gsd-dev-preferences/SKILL.md must be written by legacy migration'
    );

    // New skills must also be present — layout-driven copy ran
    const helpSkill = path.join(configDir, 'skills', 'gsd-help', 'SKILL.md');
    assert.ok(
      fs.existsSync(helpSkill),
      'claude: skills/gsd-help/SKILL.md must be written by layout-driven install'
    );
  });

  test('hermes: legacy flat skills/gsd-*/ migrated AND new nested skills/gsd/<stem>/ written', (t) => {
    const configDir = createTempDir('gsd-legacy-hermes-install-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(typeof installRuntimeArtifacts, 'function');

    // Pre-create legacy flat layout (pre-#2841): skills/gsd-help/SKILL.md
    const flatSkillsDir = path.join(configDir, 'skills');
    const legacyFlatHelp = path.join(flatSkillsDir, 'gsd-help');
    fs.mkdirSync(legacyFlatHelp, { recursive: true });
    fs.writeFileSync(path.join(legacyFlatHelp, 'SKILL.md'), '# legacy help\n');

    installRuntimeArtifacts('hermes', configDir, 'global', RESOLVED_CORE);

    // Legacy flat entry must be removed
    assert.ok(
      !fs.existsSync(legacyFlatHelp),
      'hermes: legacy skills/gsd-help/ must be removed by install migration'
    );

    // New nested layout must exist: skills/gsd/help/SKILL.md
    const newNestedHelp = path.join(configDir, 'skills', 'gsd', 'help', 'SKILL.md');
    assert.ok(
      fs.existsSync(newNestedHelp),
      'hermes: skills/gsd/help/SKILL.md must be written by layout-driven install'
    );
  });
});

// ---------------------------------------------------------------------------
// describe 4 — uninstallRuntimeArtifacts: legacy cleanup runs before layout removal
// ---------------------------------------------------------------------------

describe('uninstallRuntimeArtifacts — legacy cleanup runs before layout-driven removal', () => {
  test('hermes: both flat (pre-#2841 gsd-*/) and nested (gsd/<stem>/) layouts removed', (t) => {
    const configDir = createTempDir('gsd-legacy-uninstall-hermes-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(typeof uninstallRuntimeArtifacts, 'function');

    const skillsDir = path.join(configDir, 'skills');

    // Pre-create legacy flat layout (pre-#2841): skills/gsd-help/SKILL.md
    const flatHelpDir = path.join(skillsDir, 'gsd-help');
    fs.mkdirSync(flatHelpDir, { recursive: true });
    fs.writeFileSync(path.join(flatHelpDir, 'SKILL.md'), '# legacy flat help\n');

    const flatPhaseDir = path.join(skillsDir, 'gsd-phase');
    fs.mkdirSync(flatPhaseDir, { recursive: true });
    fs.writeFileSync(path.join(flatPhaseDir, 'SKILL.md'), '# legacy flat phase\n');

    // Pre-create nested layout (post-#2841): skills/gsd/help/SKILL.md
    const nestedGsd = path.join(skillsDir, 'gsd');
    const nestedHelpDir = path.join(nestedGsd, 'help');
    fs.mkdirSync(nestedHelpDir, { recursive: true });
    fs.writeFileSync(path.join(nestedHelpDir, 'SKILL.md'), '# nested help\n');

    const nestedPhaseDir = path.join(nestedGsd, 'phase');
    fs.mkdirSync(nestedPhaseDir, { recursive: true });
    fs.writeFileSync(path.join(nestedPhaseDir, 'SKILL.md'), '# nested phase\n');

    // Non-gsd sibling at skills/ level — must survive
    const userSkillDir = path.join(skillsDir, 'user-skill');
    fs.mkdirSync(userSkillDir, { recursive: true });
    fs.writeFileSync(path.join(userSkillDir, 'SKILL.md'), '# user skill\n');

    uninstallRuntimeArtifacts('hermes', configDir, 'global');

    // Flat legacy entries must be gone
    assert.ok(
      !fs.existsSync(flatHelpDir),
      'hermes uninstall: legacy skills/gsd-help/ must be removed'
    );
    assert.ok(
      !fs.existsSync(flatPhaseDir),
      'hermes uninstall: legacy skills/gsd-phase/ must be removed'
    );

    // Nested layout must be gone
    assert.ok(
      !fs.existsSync(nestedGsd),
      'hermes uninstall: skills/gsd/ (nested) must be removed'
    );

    // User skill must survive
    assert.ok(
      fs.existsSync(path.join(userSkillDir, 'SKILL.md')),
      'hermes uninstall: skills/user-skill/ must be preserved'
    );
  });

  test('claude: legacy commands/gsd/ cleaned up AND new skills/ entries removed by uninstall', (t) => {
    const configDir = createTempDir('gsd-legacy-uninstall-claude-');
    t.after(() => cleanup(configDir));

    assert.strictEqual(typeof uninstallRuntimeArtifacts, 'function');

    // Pre-create layout-driven gsd skills
    const skillsDir = path.join(configDir, 'skills');
    const gsdHelpDir = path.join(skillsDir, 'gsd-help');
    fs.mkdirSync(gsdHelpDir, { recursive: true });
    fs.writeFileSync(path.join(gsdHelpDir, 'SKILL.md'), '# help\n');

    // Pre-create legacy commands/gsd/ (should also be cleaned)
    const legacyCommandsGsd = path.join(configDir, 'commands', 'gsd');
    fs.mkdirSync(legacyCommandsGsd, { recursive: true });
    fs.writeFileSync(path.join(legacyCommandsGsd, 'help.md'), '# help legacy\n');

    // Foreign skill — must survive
    const userSkillDir = path.join(skillsDir, 'user-skill');
    fs.mkdirSync(userSkillDir, { recursive: true });
    fs.writeFileSync(path.join(userSkillDir, 'SKILL.md'), '# user\n');

    uninstallRuntimeArtifacts('claude', configDir, 'global');

    // gsd-help must be removed
    assert.ok(
      !fs.existsSync(gsdHelpDir),
      'claude uninstall: skills/gsd-help/ must be removed'
    );

    // Foreign skill must survive
    assert.ok(
      fs.existsSync(path.join(userSkillDir, 'SKILL.md')),
      'claude uninstall: user-skill/ must be preserved'
    );

    // Legacy commands/gsd/ must also be cleaned by legacy migration running first
    assert.ok(
      !fs.existsSync(legacyCommandsGsd),
      'claude uninstall: legacy commands/gsd/ must be cleaned up'
    );
  });
});
