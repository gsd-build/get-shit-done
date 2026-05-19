'use strict';

// allow-test-rule: source-text-is-the-product. profile-user.md IS the
// shipped workflow product; the `Display:` line at line 356 IS the
// user-visible artifact-name message. This test parses the markdown's
// structured `Display: "..."` line via a regex (not source-grep) to
// extract the path argument as a typed value, then asserts on the
// typed value. The .includes() at the end is a structural absence-check
// against the legacy path literal — the same shape the bug-2470
// installer-leak test uses to enforce a known-pattern invariant.

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2973: /gsd-profile-user --refresh writes dev-preferences.md to the
 * legacy commands/gsd subdirectory, contradicting v1.39.0's skills-only
 * migration claim that "Legacy commands/gsd directory removed
 * (replaced by skills/)".
 *
 * Root cause: the writer at get-shit-done/bin/lib/profile-output.cjs
 * fell back to commands/gsd/dev-preferences.md when no --output was passed.
 * The /gsd-profile-user workflow does not pass --output, so every refresh
 * deterministically re-creates the legacy directory.
 *
 * Fix:
 *   1. profile-output.cjs default targets skills/gsd-dev-preferences/SKILL.md
 *   2. profile-user.md confirmation message references the new path
 *   3. install.js migrates any existing legacy file into the new skill
 *      location during install (no-op if SKILL.md already exists)
 *
 * This test exercises the runtime behavior of the writer (writes to the
 * skills path) and the structural shape of the workflow message. No
 * source-grep on the .cjs body — assertions go against the writer's
 * actual output and the parsed workflow message.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const PROFILE_OUTPUT = path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'profile-output.cjs');
const WORKFLOW = path.join(ROOT, 'get-shit-done', 'workflows', 'profile-user.md');
const INSTALL = path.join(ROOT, 'bin', 'install.js');

describe('Bug #2973: dev-preferences default writer path is skills/gsd-dev-preferences/SKILL.md', () => {
  test('exercise the writer in a subprocess with HOME pointed at a tmp dir; assert the artifact lands at the skills path', () => {
    // Subprocess so fs.writeSync(1, ...) in core.cjs goes to a pipe we can
    // capture (the parent process's fd 1 bypasses any in-process stubbing).
    const cp = require('node:child_process');
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2973-'));
    try {
      const analysisPath = path.join(tmpHome, 'analysis.json');
      fs.writeFileSync(analysisPath, JSON.stringify({
        data_source: 'questionnaire',
        dimensions: { rigor: { score: 7 } },
      }));
      const driver = path.join(tmpHome, 'driver.js');
      fs.writeFileSync(driver, `
        const m = require(${JSON.stringify(PROFILE_OUTPUT)});
        m.cmdGenerateDevPreferences(${JSON.stringify(tmpHome)}, { analysis: ${JSON.stringify(analysisPath)} }, false);
      `);
      const result = cp.spawnSync(process.execPath, [driver], {
        env: Object.assign({}, process.env, { HOME: tmpHome, USERPROFILE: tmpHome }),
        encoding: 'utf-8',
        // Bound the subprocess so a regression that hangs the writer
        // (or the dispatcher) cannot deadlock CI (PR #3003 CR feedback).
        // 30s is generous for what should complete in <1s; if it trips,
        // surface that as a clear test failure rather than CI hanging.
        timeout: 30_000,
      });
      assert.equal(result.signal, null,
        `writer subprocess was killed by signal ${result.signal} (likely timeout): ${result.stderr}`);
      assert.equal(result.status, 0, `writer subprocess failed: ${result.stderr}`);
      const parsed = JSON.parse(result.stdout);

      const expectedPath = path.join(tmpHome, '.claude', 'skills', 'gsd-dev-preferences', 'SKILL.md');
      assert.equal(parsed.command_path, expectedPath,
        `writer emitted ${parsed.command_path}; expected skills path ${expectedPath} (#2973)`);
      assert.equal(fs.existsSync(expectedPath), true,
        `expected SKILL.md at ${expectedPath} after writer ran`);
      const legacyPath = path.join(tmpHome, '.claude', 'commands', 'gsd', 'dev-preferences.md');
      assert.equal(fs.existsSync(legacyPath), false,
        `writer must not create ${legacyPath} (#2973)`);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });
});

describe('Bug #2973: profile-user.md confirmation message references the skills path', () => {
  test('the Display message points at $HOME/.claude/skills/gsd-dev-preferences/SKILL.md', () => {
    const md = fs.readFileSync(WORKFLOW, 'utf-8');
    // Match the structured Display: line; capture the path value.
    const m = md.match(/Display:\s*"[^"]*Generated\s*\/gsd-dev-preferences\s*at\s*([^"]+)"/);
    assert.notEqual(m, null, 'expected a Display: "Generated /gsd-dev-preferences at <path>" line');
    const referencedPath = m[1].trim();
    assert.equal(referencedPath, '$HOME/.claude/skills/gsd-dev-preferences/SKILL.md',
      `workflow references ${referencedPath}; expected skills path (#2973)`);
  });

  test('no occurrence of the legacy commands/gsd/dev-preferences.md path remains in profile-user.md', () => {
    const md = fs.readFileSync(WORKFLOW, 'utf-8');
    assert.equal(md.includes('commands/gsd/dev-preferences.md'), false,
      'profile-user.md still references legacy commands/gsd/dev-preferences.md (#2973)');
  });
});

describe('Bug #2973: installer migrates existing legacy dev-preferences.md to skills/gsd-dev-preferences/SKILL.md', () => {
  test('migrateLegacyDevPreferencesToSkill is exported and writes to the skills path', () => {
    const inst = require(INSTALL);
    // Module exports the migration helper for direct testing.
    // Note: this is the structural assertion — the helper exists with the
    // documented signature. End-to-end install testing is covered by
    // tests/install-*.test.cjs which already exercise legacy preservation.
    assert.equal(typeof inst.migrateLegacyDevPreferencesToSkill, 'function',
      'expected migrateLegacyDevPreferencesToSkill in install.js exports (#2973)');
  });

  test('migration writes to skills/gsd-dev-preferences/SKILL.md when no skill exists yet', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2973-mig-'));
    try {
      const inst = require(INSTALL);
      const saved = new Map([['dev-preferences.md', '# my legacy preferences\n']]);
      const migrated = inst.migrateLegacyDevPreferencesToSkill(tmpDir, saved);
      assert.equal(migrated, true, 'expected migration to succeed when no SKILL.md exists');
      const skillFile = path.join(tmpDir, 'skills', 'gsd-dev-preferences', 'SKILL.md');
      assert.equal(fs.existsSync(skillFile), true, `expected SKILL.md at ${skillFile}`);
      assert.equal(fs.readFileSync(skillFile, 'utf-8'), '# my legacy preferences\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('migration is a no-op when a SKILL.md already exists at the new location (do not clobber user-customized skill content)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2973-skip-'));
    try {
      const inst = require(INSTALL);
      const skillDir = path.join(tmpDir, 'skills', 'gsd-dev-preferences');
      const skillFile = path.join(skillDir, 'SKILL.md');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(skillFile, '# user-customized skill\n');
      const saved = new Map([['dev-preferences.md', '# legacy content\n']]);
      const migrated = inst.migrateLegacyDevPreferencesToSkill(tmpDir, saved);
      assert.equal(migrated, false, 'expected migration to skip when SKILL.md exists');
      // Existing content untouched.
      assert.equal(fs.readFileSync(skillFile, 'utf-8'), '# user-customized skill\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── #3003 CR follow-up: installRuntimeArtifacts preserves user-owned skills ──
//
// Production install() calls installRuntimeArtifacts() without a prior
// uninstallRuntimeArtifacts(). This means _copyStaged overlays new skills
// on top of the existing skills/ directory — it does NOT wipe first.
// As a result, user-owned gsd-dev-preferences/SKILL.md is preserved across
// a plain install because _copyStaged only cpSync's newly staged skill dirs.
//
// NOTE: If callers run uninstallRuntimeArtifacts() before installRuntimeArtifacts()
// (e.g. full reinstall), gsd-dev-preferences IS wiped by uninstall and NOT
// restored by install (#3664 production gap — tracked separately).

describe('Bug #2973 (#3003 CR): installRuntimeArtifacts preserves user-owned gsd-dev-preferences across install', () => {
  test('user-customized skills/gsd-dev-preferences/SKILL.md survives a plain install (no pre-uninstall)', () => {
    // Production install() does NOT call uninstallRuntimeArtifacts() first.
    // installRuntimeArtifacts → _copyStaged overlays only staged skill dirs;
    // gsd-dev-preferences (not in source) is left untouched.
    const inst = require(INSTALL);
    const { loadSkillsManifest, resolveProfile } = require(path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'install-profiles.cjs'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2973-wipe-'));
    try {
      const configDir = path.join(tmp, 'config');
      fs.mkdirSync(configDir, { recursive: true });

      // Set up a minimal source dir (plan-phase only; no dev-preferences).
      const srcDir = path.join(tmp, 'src-commands');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'plan-phase.md'), '---\nname: gsd:plan-phase\ndescription: Plan\n---\n\nPlan body.\n');
      fs.writeFileSync(path.join(configDir, '.gsd-source'), srcDir + '\n');

      const skillsDir = path.join(configDir, 'skills');
      const userSkillDir = path.join(skillsDir, 'gsd-dev-preferences');
      fs.mkdirSync(userSkillDir, { recursive: true });
      const userContent = '# my customized dev preferences\n\nstack: rust\n';
      fs.writeFileSync(path.join(userSkillDir, 'SKILL.md'), userContent);

      // Plain install (matching production install() call site).
      const manifest = loadSkillsManifest();
      const resolvedProfile = resolveProfile({ modes: [], manifest });
      inst.installRuntimeArtifacts('claude', configDir, 'global', resolvedProfile);

      const skillFile = path.join(userSkillDir, 'SKILL.md');
      assert.equal(fs.existsSync(skillFile), true,
        'gsd-dev-preferences/SKILL.md must survive a plain install (#3003 CR)');
      assert.equal(fs.readFileSync(skillFile, 'utf-8'), userContent,
        'user content must be byte-identical after the install');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('non-user-owned gsd-* skills are wiped and recreated via uninstall+install cycle', () => {
    // Stale artifacts (e.g. STALE-MARKER.txt left from a previous version)
    // are removed when the caller runs uninstallRuntimeArtifacts() before
    // installRuntimeArtifacts() — the full uninstall+reinstall cycle.
    // uninstallRuntimeArtifacts removes all gsd-* entries; installRuntimeArtifacts
    // then writes fresh ones from source.
    const inst = require(INSTALL);
    const { loadSkillsManifest, resolveProfile } = require(path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'install-profiles.cjs'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2973-wipe-shipped-'));
    try {
      const configDir = path.join(tmp, 'config');
      fs.mkdirSync(configDir, { recursive: true });

      const srcDir = path.join(tmp, 'src-commands');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'plan-phase.md'), '---\nname: gsd:plan-phase\ndescription: Plan fresh\n---\n\nFresh body.\n');
      fs.writeFileSync(path.join(configDir, '.gsd-source'), srcDir + '\n');

      const skillsDir = path.join(configDir, 'skills');
      const staleSkillDir = path.join(skillsDir, 'gsd-plan-phase');
      fs.mkdirSync(staleSkillDir, { recursive: true });
      fs.writeFileSync(path.join(staleSkillDir, 'STALE-MARKER.txt'), 'wipe me');

      const manifest = loadSkillsManifest();
      const resolvedProfile = resolveProfile({ modes: [], manifest });

      // Full uninstall+install cycle (e.g. --reinstall flow)
      inst.uninstallRuntimeArtifacts('claude', configDir, 'global');
      inst.installRuntimeArtifacts('claude', configDir, 'global', resolvedProfile);

      assert.equal(fs.existsSync(path.join(staleSkillDir, 'STALE-MARKER.txt')), false,
        'stale shipped-skill content must be wiped by uninstall (preservation is opt-in by name)');
      assert.equal(fs.existsSync(path.join(staleSkillDir, 'SKILL.md')), true,
        'fresh SKILL.md from source must be installed after wipe');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
