/**
 * Regression test for bug #3582 — Codex install must materialize the skill
 * surface under `~/.codex/skills/<name>/SKILL.md`.
 *
 * Background: GSD 1.42.2 reported the user-visible failure
 *   > Skipped Codex skill-copy generation (Codex discovers official skills directly)
 * which left users with a "successful" install but no routable `$gsd-*`
 * entrypoints in Codex CLI 0.130.0. Codex CLI does NOT auto-discover
 * commands from `~/.codex/get-shit-done/workflows/*.md` or `agents/*.md`;
 * it only registers slash commands derived from `~/.codex/skills/<name>/SKILL.md`.
 * The "Codex discovers official skills directly" assumption was wrong.
 *
 * The current installer (#3562 / current main) calls
 * `copyCommandsAsCodexSkills()` to materialize one SKILL.md per
 * commands/gsd/*.md, with Claude-flavored command frontmatter rewritten
 * into Codex skill frontmatter and the `<codex_skill_adapter>` body
 * produced by `getCodexSkillAdapterHeader()`.
 *
 * This test locks the install contract so the 1.42.2 regression cannot
 * silently come back. It asserts the full expected skill-name set
 * (deepStrictEqual, not just count), the full adapter block (using
 * the exported `getCodexSkillAdapterHeader` IR as the expected value,
 * not raw substring search), and the success/skip log invariant.
 */
// allow-test-rule: source-text-is-the-product
// This assertion validates the generated adapter block that is shipped to
// users in SKILL.md; matching exact emitted text is the contract under test.

'use strict';

// GSD_TEST_MODE neutralizes side-effecting branches (auto-detection, etc.).
// Must be set BEFORE requiring bin/install.js; scoped to module load only
// so downstream tests don't see it. Mirrors the bug-2760 codex harness.
const previousGsdTestMode = process.env.GSD_TEST_MODE;
process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { install, getCodexSkillAdapterHeader } = require('../bin/install.js');
const { parseFrontmatter, createTempDir, cleanup } = require('./helpers.cjs');

if (previousGsdTestMode === undefined) {
  delete process.env.GSD_TEST_MODE;
} else {
  process.env.GSD_TEST_MODE = previousGsdTestMode;
}

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');

// Strip ANSI color codes so log assertions don't depend on TTY detection.
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Walk commands/gsd/**\/*.md and return the set of skill names the installer
 * is contractually obligated to produce. Naming rule mirrors
 * `copyCommandsAsCodexSkills` in bin/install.js: nested dirs collapse to
 * `gsd-<dir>-<file>` with the .md stripped.
 */
function expectedSkillNames() {
  const names = new Set();
  function recurse(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        recurse(path.join(dir, entry.name), `${prefix}-${entry.name}`);
      } else if (entry.name.endsWith('.md')) {
        const base = entry.name.slice(0, -3);
        names.add(`${prefix}-${base}`);
      }
    }
  }
  recurse(COMMANDS_DIR, 'gsd');
  return names;
}

/**
 * Run a Codex global install into a temp CODEX_HOME and capture stdout/stderr.
 * Cleans up codexHome on throw so a partial-install failure never leaks
 * temp directories.
 */
function runCodexInstallCaptured() {
  const codexHome = createTempDir('gsd-3582-codex-');
  const logs = [];
  const warnings = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...a) => { logs.push(a.join(' ')); };
  console.warn = (...a) => { warnings.push(a.join(' ')); };

  const previousCodexHome = process.env.CODEX_HOME;
  const previousCwd = process.cwd();
  process.env.CODEX_HOME = codexHome;
  process.env.GSD_TEST_MODE = '1';
  try {
    process.chdir(ROOT);
    install(true, 'codex');
    return { codexHome, logs, warnings };
  } catch (err) {
    // Always reclaim the temp dir if install throws — otherwise the
    // describe-level afterEach can't see codexHome and it leaks.
    try { cleanup(codexHome); } catch { /* best-effort */ }
    throw err;
  } finally {
    process.chdir(previousCwd);
    console.log = origLog;
    console.warn = origWarn;
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    if (previousGsdTestMode === undefined) {
      delete process.env.GSD_TEST_MODE;
    } else {
      process.env.GSD_TEST_MODE = previousGsdTestMode;
    }
  }
}

// concurrency:false — harness mutates console.* / process.env / process.cwd().
// Matches the convention used by tests/bug-3562-codex-install-skill-surface.test.cjs.
describe('bug-3582: Codex global install materializes the skill surface', { concurrency: false }, () => {
  let installRun;

  beforeEach(() => {
    installRun = runCodexInstallCaptured();
  });

  afterEach(() => {
    if (installRun && installRun.codexHome) {
      cleanup(installRun.codexHome);
    }
  });

  test('writes the exact expected set of gsd-*/SKILL.md skills (deepEqual on name set)', () => {
    const skillsDir = path.join(installRun.codexHome, 'skills');
    assert.ok(
      fs.existsSync(skillsDir),
      `Codex install must create ${skillsDir} (the 1.42.2 regression skipped this entirely)`,
    );

    const actualNames = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'))
      .map(e => e.name);

    // deepStrictEqual on the sorted full set — not just count — so a
    // partial install that drops a real command and substitutes a bogus
    // same-count `gsd-*` directory cannot pass.
    const expected = [...expectedSkillNames()].sort();
    assert.deepStrictEqual(
      [...actualNames].sort(),
      expected,
      `installed Codex skills must exactly match commands/gsd/**/*.md (one skill per command)`,
    );

    // Every skill dir contains a non-empty SKILL.md file. Empty dirs or
    // empty SKILL.md bodies would defeat Codex's slash-command
    // registration as silently as the 1.42.2 "skipped" branch did.
    for (const name of actualNames) {
      const skillMd = path.join(skillsDir, name, 'SKILL.md');
      const stat = fs.statSync(skillMd);
      assert.ok(stat.isFile(), `${skillMd} must be a regular file`);
      assert.ok(stat.size > 0, `${skillMd} must not be empty`);
    }
  });

  test('SKILL.md frontmatter declares hyphen-form name matching the directory', () => {
    const skillsDir = path.join(installRun.codexHome, 'skills');
    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'))
      .map(e => e.name);

    for (const name of skillDirs) {
      const content = fs.readFileSync(
        path.join(skillsDir, name, 'SKILL.md'),
        'utf-8',
      );
      // Uses the shared `parseFrontmatter` from tests/helpers.cjs per the
      // CONTRIBUTING.md "tests parse, never grep" convention.
      const fm = parseFrontmatter(content);
      assert.strictEqual(
        fm.name,
        name,
        `SKILL.md name field must match directory name for ${name} (got ${JSON.stringify(fm.name)})`,
      );
      assert.ok(
        typeof fm.description === 'string' && fm.description.length > 0,
        `SKILL.md description must be a non-empty string for ${name}`,
      );
    }
  });

  test('SKILL.md body contains the full <codex_skill_adapter> block produced by the exported builder', () => {
    // Structural check against the production builder's output — NOT a
    // raw substring grep on the rendered file. `getCodexSkillAdapterHeader`
    // is the typed IR exported by bin/install.js (#3582 PR #3609 codex
    // review); the file on disk must contain its full output verbatim
    // (open tag, body, closing `</codex_skill_adapter>`). A truncated,
    // empty, or missing-closing-tag adapter cannot satisfy this assertion.
    const skillsDir = path.join(installRun.codexHome, 'skills');
    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'))
      .map(e => e.name);

    for (const name of skillDirs) {
      const expectedAdapter = getCodexSkillAdapterHeader(name);
      // Sanity: the builder itself must produce a closed block for the
      // assertion below to be meaningful.
      assert.ok(
        expectedAdapter.startsWith('<codex_skill_adapter>'),
        `getCodexSkillAdapterHeader(${name}) must start with the opening tag`,
      );
      assert.ok(
        expectedAdapter.trimEnd().endsWith('</codex_skill_adapter>'),
        `getCodexSkillAdapterHeader(${name}) must end with the closing tag`,
      );

      const content = fs.readFileSync(
        path.join(skillsDir, name, 'SKILL.md'),
        'utf-8',
      );
      assert.ok(
        content.includes(expectedAdapter),
        `${name}/SKILL.md must contain the full adapter block produced by getCodexSkillAdapterHeader(${name}); Codex routes $${name} via this exact body`,
      );
    }
  });

  test('representative skills named in the issue report are present', () => {
    // The bug report and triage explicitly named these. Locking them as a
    // representative set so a future dispatch / filter / profile change
    // cannot drop just the commands the original user was trying to run.
    const representative = [
      'gsd-map-codebase',     // the literal command from the bug report
      'gsd-execute-phase',
      'gsd-plan-phase',
      'gsd-new-project',
      'gsd-health',
    ];
    const skillsDir = path.join(installRun.codexHome, 'skills');
    for (const name of representative) {
      const skillMd = path.join(skillsDir, name, 'SKILL.md');
      assert.ok(
        fs.existsSync(skillMd),
        `${name}/SKILL.md must exist after Codex install (was unrouteable in 1.42.2)`,
      );
    }
  });

  test('installer success log mentions skills/ — never claims success while skipping', () => {
    // The 1.42.2 user-visible failure mode was a successful install that
    // printed "Skipped Codex skill-copy generation (Codex discovers
    // official skills directly)" while leaving the user with no
    // entrypoints. Lock that the broken strings can NEVER coexist with a
    // success indicator. Current main prints "✓ Installed N skills".
    const cleanLogs = installRun.logs.map(stripAnsi);
    const cleanWarnings = installRun.warnings.map(stripAnsi);
    const allOutput = [...cleanLogs, ...cleanWarnings].join('\n');

    assert.ok(
      !/Skipped Codex skill-copy generation/i.test(allOutput),
      `installer must never print "Skipped Codex skill-copy generation" (1.42.2 failure). Output:\n${allOutput}`,
    );
    assert.ok(
      !/Codex discovers official skills directly/i.test(allOutput),
      `installer must never claim "Codex discovers official skills directly" (1.42.2 incorrect assumption). Output:\n${allOutput}`,
    );

    // Positive proof — at least one log line acknowledges the skills install.
    const hasSkillsInstalledLog = cleanLogs.some(line => /Installed\s+\d+\s+skills\s+to\s+skills\//.test(line));
    assert.ok(
      hasSkillsInstalledLog,
      `installer must print a success line of the form "Installed N skills to skills/". Logs:\n${cleanLogs.join('\n')}`,
    );
  });
});
