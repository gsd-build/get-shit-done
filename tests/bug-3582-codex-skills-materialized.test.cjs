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
 * into Codex skill frontmatter (name, description, and the
 * `<codex_skill_adapter>` body).
 *
 * This test locks the install contract so the 1.42.2 regression cannot
 * silently come back:
 *
 *   1. A Codex global install populates `<CODEX_HOME>/skills/` with one
 *      `gsd-<name>/SKILL.md` per shipped command.
 *   2. Each generated SKILL.md is non-empty, has YAML frontmatter, and
 *      declares the canonical hyphen-form `name:` matching its directory.
 *   3. The installer never prints "Skipped Codex skill-copy generation"
 *      while reporting a successful install.
 *   4. At least the commands the issue reporter and triage explicitly
 *      named (`gsd-map-codebase`, `gsd-execute-phase`, `gsd-plan-phase`,
 *      `gsd-new-project`) are present — proves the representative
 *      surface, not just an arbitrary count.
 *
 * Test invokes `install(isGlobal=true, runtime='codex')` directly with
 * `CODEX_HOME` pointing at a temp dir so no developer config is touched.
 */

'use strict';

// GSD_TEST_MODE neutralizes side-effecting branches (auto-detection,
// VS Code launches, etc.). Must be set BEFORE requiring bin/install.js;
// scoped to module load only so downstream tests in the same process
// don't see it. Mirrors the bug-2760 codex install harness.
const previousGsdTestMode = process.env.GSD_TEST_MODE;
process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { install } = require('../bin/install.js');

if (previousGsdTestMode === undefined) {
  delete process.env.GSD_TEST_MODE;
} else {
  process.env.GSD_TEST_MODE = previousGsdTestMode;
}

const ROOT = path.join(__dirname, '..');

/**
 * Run a Codex global install into a temp CODEX_HOME and capture stdout/stderr.
 * Returns { codexHome, logs, warnings }. Caller is responsible for cleanup.
 */
function runCodexInstallCaptured() {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3582-codex-'));
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
  return { codexHome, logs, warnings };
}

// Strip ANSI color codes so log assertions don't depend on TTY detection.
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

// Parse SKILL.md frontmatter into a flat key→value map. Mirrors the shape
// used by tests/helpers.cjs and the install.js converters (single-line
// scalars only; the Codex converter does not emit block scalars).
function parseFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0].trim() !== '---') {
    throw new Error('expected --- on first line');
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) {
    throw new Error('frontmatter not closed');
  }
  const fm = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (/^".*"$/.test(val)) {
      try { val = JSON.parse(val); } catch { /* fall through */ }
    } else if (/^'.*'$/.test(val)) {
      val = val.slice(1, -1);
    }
    fm[m[1]] = val;
  }
  return fm;
}

describe('bug-3582: Codex global install materializes the skill surface', () => {
  let installRun;

  beforeEach(() => {
    installRun = runCodexInstallCaptured();
  });

  afterEach(() => {
    if (installRun && installRun.codexHome) {
      fs.rmSync(installRun.codexHome, { recursive: true, force: true });
    }
  });

  test('writes ~/.codex/skills/gsd-*/SKILL.md for every shipped command', () => {
    const skillsDir = path.join(installRun.codexHome, 'skills');
    assert.ok(
      fs.existsSync(skillsDir),
      `Codex install must create ${skillsDir} (the 1.42.2 regression skipped this entirely)`,
    );

    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'))
      .map(e => e.name);

    assert.ok(
      skillDirs.length > 0,
      `expected at least one gsd-* skill directory under ${skillsDir}, got none`,
    );

    // Source-of-truth count: number of commands/gsd/*.md in the repo. Every
    // command must produce a corresponding skill (recursing into subdirs).
    const commandsDir = path.join(ROOT, 'commands', 'gsd');
    function countCommandMd(dir) {
      let n = 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          n += countCommandMd(path.join(dir, entry.name));
        } else if (entry.name.endsWith('.md')) {
          n += 1;
        }
      }
      return n;
    }
    const expectedCount = countCommandMd(commandsDir);
    assert.strictEqual(
      skillDirs.length,
      expectedCount,
      `expected one skill per commands/gsd/*.md (${expectedCount}), got ${skillDirs.length}`,
    );

    // Every skill dir contains a SKILL.md file. Empty dirs or skill bodies
    // would defeat Codex's slash-command registration as silently as the
    // 1.42.2 "skipped" branch did.
    for (const name of skillDirs) {
      const skillMd = path.join(skillsDir, name, 'SKILL.md');
      assert.ok(fs.existsSync(skillMd), `missing SKILL.md for ${name}`);
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
      // Codex 0.130.0+ skill body must include the adapter header so the
      // skill knows to map `$gsd-<cmd>` → workflow execution.
      assert.ok(
        content.includes('<codex_skill_adapter>'),
        `${name}/SKILL.md must contain the <codex_skill_adapter> body so Codex can route $gsd-<cmd>`,
      );
    }
  });

  test('representative skills named in the issue report are present', () => {
    // The bug report and triage explicitly named these. Locking them as a
    // representative set so a future regression that touches dispatch
    // logic (filtering, profile resolution, etc.) cannot drop just the
    // commands the original user was trying to run.
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
    // Lock the contract that the 1.42.2 user-visible failure mode
    // ("Skipped Codex skill-copy generation") can NEVER coexist with a
    // success indicator. The fix in main prints "✓ Installed N skills";
    // the broken 1.42.2 branch printed "Skipped Codex skill-copy
    // generation (Codex discovers official skills directly)" while
    // leaving the user with no entrypoints.
    const cleanLogs = installRun.logs.map(stripAnsi);
    const cleanWarnings = installRun.warnings.map(stripAnsi);
    const allOutput = [...cleanLogs, ...cleanWarnings].join('\n');

    assert.ok(
      !/Skipped Codex skill-copy generation/i.test(allOutput),
      `installer must never print "Skipped Codex skill-copy generation" (the 1.42.2 failure mode). Output:\n${allOutput}`,
    );
    assert.ok(
      !/Codex discovers official skills directly/i.test(allOutput),
      `installer must never claim "Codex discovers official skills directly" (the 1.42.2 incorrect assumption). Output:\n${allOutput}`,
    );

    // Positive proof — at least one log line acknowledges the skills install.
    const hasSkillsInstalledLog = cleanLogs.some(line => /Installed\s+\d+\s+skills\s+to\s+skills\//.test(line));
    assert.ok(
      hasSkillsInstalledLog,
      `installer must print a success line of the form "Installed N skills to skills/". Logs:\n${cleanLogs.join('\n')}`,
    );
  });

  test('every generated SKILL.md file is on a Codex-discoverable path', () => {
    // Codex 0.130.0 reads from CODEX_HOME/skills/<name>/SKILL.md. Any
    // other path (e.g. CODEX_HOME/get-shit-done/workflows/*.md) is
    // invisible to slash-command registration. Lock the literal layout
    // here so a future "skills root" refactor cannot accidentally
    // re-introduce the 1.42.2 "wrong directory" failure mode.
    const skillsDir = path.join(installRun.codexHome, 'skills');
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));

    for (const dirent of entries) {
      const expectedSkillMd = path.join(skillsDir, dirent.name, 'SKILL.md');
      const stat = fs.statSync(expectedSkillMd);
      assert.ok(
        stat.isFile() && stat.size > 0,
        `Codex requires SKILL.md at exact path ${expectedSkillMd}; got ${stat.isFile() ? 'file size ' + stat.size : 'non-file'}`,
      );
    }
  });
});
