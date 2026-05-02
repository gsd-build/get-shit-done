/**
 * Per-runtime regression test for `--minimal` install profile (#2923).
 *
 * Background: #2923 reported that `--opencode --local --minimal` silently
 * installed the full surface. While auditing the central gate
 * (`stageSkillsForMode` in get-shit-done/bin/lib/install-profiles.cjs),
 * we found that:
 *   - Skills are correctly filtered for every runtime in both `--global`
 *     and `--local` modes (the dispatch sites in install.js all call
 *     stageSkillsForMode unconditionally).
 *   - Agents are correctly suppressed under --minimal.
 *   - HOWEVER, the install manifest only recorded `commands/gsd/` for
 *     Gemini, leaving Claude Code local installs with an incomplete
 *     manifest. saveLocalPatches() then couldn't detect user edits and
 *     a minimal-mode reinstall couldn't be verified manifest-side.
 *
 * This test pins per-runtime behavior end-to-end: spawn the installer
 * with --minimal for each runtime in each scope, parse the resulting
 * manifest JSON, assert that mode === 'minimal', the recorded skill set
 * equals MINIMAL_SKILL_ALLOWLIST, and zero gsd-* agents are present.
 *
 * Cline is rules-based and embeds the workflow in `.clinerules` rather
 * than emitting per-skill files. Asserted separately: mode === 'minimal',
 * zero agents, .clinerules exists.
 *
 * No regex / `.includes()` against file contents — every assertion
 * either parses JSON or walks a directory tree.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const {
  MINIMAL_SKILL_ALLOWLIST,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

const INSTALL_SCRIPT = path.join(__dirname, '..', 'bin', 'install.js');
const MANIFEST_NAME = 'gsd-file-manifest.json';

// Per-runtime config dir name for local installs. Mirrors getDirName() in
// bin/install.js; kept as a fixture to avoid coupling the test to that
// internal helper.
const LOCAL_DIR_NAME = {
  claude: '.claude',
  opencode: '.opencode',
  gemini: '.gemini',
  kilo: '.kilo',
  codex: '.codex',
  copilot: '.github',
  antigravity: '.agent',
  cursor: '.cursor',
  windsurf: '.windsurf',
  augment: '.augment',
  trae: '.trae',
  qwen: '.qwen',
  codebuddy: '.codebuddy',
  cline: '.', // Cline writes to project root
};

// Skill-emitting runtimes (everything except Cline, which is rules-based).
const SKILL_RUNTIMES = [
  'claude',
  'opencode',
  'gemini',
  'kilo',
  'codex',
  'copilot',
  'antigravity',
  'cursor',
  'windsurf',
  'augment',
  'trae',
  'qwen',
  'codebuddy',
];

const ALL_RUNTIMES = [...SKILL_RUNTIMES, 'cline'];

/**
 * Run the installer in either global or local mode and return the parsed
 * manifest (or null if no manifest was written).
 */
function runInstall({ runtime, scope, extraArgs = [] }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `gsd-${runtime}-${scope}-`));
  try {
    let configDir;
    let cwd = process.cwd();
    const args = [INSTALL_SCRIPT, `--${runtime}`];

    if (scope === 'global') {
      args.push('--global', '--config-dir', root);
      configDir = root;
    } else {
      args.push('--local');
      cwd = root;
      configDir = runtime === 'cline'
        ? root
        : path.join(root, LOCAL_DIR_NAME[runtime]);
    }
    args.push(...extraArgs);

    const result = spawnSync(process.execPath, args, {
      cwd,
      encoding: 'utf8',
      // #3037: isolate HOME so the developer's real ~/.gemini/commands/gsd/
      // doesn't leak into Gemini local-install conflict detection. The
      // installer reads os.homedir() to detect prior global GSD installs;
      // without this, the dev's existing global install causes the local
      // install to skip (correct behavior for end users, wrong for tests
      // that want to assert the local install path).
      env: { ...process.env, HOME: root, USERPROFILE: root },
    });

    assert.strictEqual(
      result.status,
      0,
      `installer exited with status ${result.status} for ${runtime} --${scope}` +
        `\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );

    const manifestPath = path.join(configDir, MANIFEST_NAME);
    let manifest = null;
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
    return { manifest, configDir, root, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    fs.rmSync(root, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Walk the manifest's `files` keys and project them onto a per-runtime
 * "skill set". Each runtime emits skills under one of three keyspaces:
 *   skills/<name>/...         (Claude global, Codex, Copilot, Antigravity,
 *                              Cursor, Windsurf, Augment, Trae, Qwen,
 *                              CodeBuddy)
 *   command/gsd-<name>.md     (OpenCode, Kilo)
 *   commands/gsd/<name>.md    (Gemini, Claude local — fixed in #2923)
 *
 * Returns the unique set of skill basenames recorded in the manifest.
 */
function manifestSkillSet(manifest) {
  if (!manifest || !manifest.files) return new Set();
  const out = new Set();
  for (const key of Object.keys(manifest.files)) {
    if (key.startsWith('skills/')) {
      // Strip both the optional `gsd-` prefix (used by Claude/Codex/etc as
      // a per-skill subdir name) and any trailing `.md` (Codex flat layout).
      const seg = key.split('/')[1].replace(/^gsd-/, '').replace(/\.md$/, '');
      out.add(seg);
    } else if (key.startsWith('command/')) {
      const file = key.split('/')[1];
      // Strip `gsd-` prefix and `.md` suffix. Subdirs flatten with `-`,
      // but our minimal allowlist is flat (top-level files only) so this
      // is safe here.
      const base = file.replace(/^gsd-/, '').replace(/\.md$/, '');
      out.add(base);
    } else if (key.startsWith('commands/gsd/')) {
      // Gemini transforms .md → .toml on emit; Claude local keeps .md.
      const file = key.split('/')[2];
      out.add(file.replace(/\.(md|toml)$/, ''));
    }
  }
  return out;
}

function manifestAgentCount(manifest) {
  if (!manifest || !manifest.files) return 0;
  return Object.keys(manifest.files).filter((k) => k.startsWith('agents/')).length;
}

function expectedSkillSet() {
  return new Set([...MINIMAL_SKILL_ALLOWLIST]);
}

describe('install: --minimal honoured for every runtime in --global mode', () => {
  for (const runtime of SKILL_RUNTIMES) {
    test(`${runtime} --global --minimal emits exactly the core skill set, zero agents`, () => {
      const { manifest, root } = runInstall({
        runtime,
        scope: 'global',
        extraArgs: ['--minimal'],
      });
      try {
        assert.ok(manifest, `${runtime} global install must produce a manifest`);
        assert.strictEqual(manifest.mode, 'minimal',
          `${runtime} global manifest.mode should be "minimal"`);
        assert.deepStrictEqual(
          [...manifestSkillSet(manifest)].sort(),
          [...expectedSkillSet()].sort(),
          `${runtime} global should record exactly the MINIMAL allowlist in the manifest`,
        );
        assert.strictEqual(manifestAgentCount(manifest), 0,
          `${runtime} global --minimal should record zero gsd-* agents`);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('install: --minimal honoured for every runtime in --local mode', () => {
  for (const runtime of SKILL_RUNTIMES) {
    test(`${runtime} --local --minimal emits exactly the core skill set, zero agents`, () => {
      const { manifest, root } = runInstall({
        runtime,
        scope: 'local',
        extraArgs: ['--minimal'],
      });
      try {
        assert.ok(manifest, `${runtime} local install must produce a manifest`);
        assert.strictEqual(manifest.mode, 'minimal',
          `${runtime} local manifest.mode should be "minimal"`);
        assert.deepStrictEqual(
          [...manifestSkillSet(manifest)].sort(),
          [...expectedSkillSet()].sort(),
          `${runtime} local should record exactly the MINIMAL allowlist in the manifest (regression guard for #2923)`,
        );
        assert.strictEqual(manifestAgentCount(manifest), 0,
          `${runtime} local --minimal should record zero gsd-* agents`);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('install: Cline --minimal (rules-based runtime — no skills/ dir)', () => {
  for (const scope of ['global', 'local']) {
    test(`cline --${scope} --minimal records mode=minimal and zero agents`, () => {
      const { manifest, configDir, root } = runInstall({
        runtime: 'cline',
        scope,
        extraArgs: ['--minimal'],
      });
      try {
        assert.ok(manifest, `cline ${scope} install must produce a manifest`);
        assert.strictEqual(manifest.mode, 'minimal');
        assert.strictEqual(manifestAgentCount(manifest), 0,
          `cline ${scope} --minimal should record zero gsd-* agents`);

        // .clinerules exists (Cline embeds the workflow there in lieu of
        // per-skill files).
        const clinerules = path.join(configDir, '.clinerules');
        assert.ok(fs.existsSync(clinerules),
          `cline install should emit .clinerules at ${clinerules}`);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('install: directory-on-disk matches manifest for --minimal', () => {
  // Cross-check that the manifest isn't lying — actually walk the install
  // dir and verify the gsd-* surface on disk equals what the manifest claims.
  // This catches the inverse of #2923: manifest says minimal, but disk has
  // full surface (or vice versa).
  for (const runtime of SKILL_RUNTIMES) {
    for (const scope of ['global', 'local']) {
      test(`${runtime} --${scope} --minimal: on-disk skill files match manifest`, () => {
        const { manifest, configDir, root } = runInstall({
          runtime,
          scope,
          extraArgs: ['--minimal'],
        });
        try {
          assert.ok(
            manifest,
            `${runtime} ${scope} --minimal: manifest must exist before parity check`,
          );
          const onDisk = collectSkillBasenamesOnDisk(configDir);
          const inManifest = manifestSkillSet(manifest);
          assert.deepStrictEqual(
            [...onDisk].sort(),
            [...inManifest].sort(),
            `${runtime} ${scope}: on-disk skills must match manifest record`,
          );
          // And no gsd-*.md agent file should exist on disk either:
          const agentsDir = path.join(configDir, 'agents');
          if (fs.existsSync(agentsDir)) {
            const gsdAgents = fs.readdirSync(agentsDir).filter(
              (f) => f.startsWith('gsd-') && f.endsWith('.md'),
            );
            assert.deepStrictEqual(gsdAgents, [],
              `${runtime} ${scope} --minimal should not write gsd-*.md agents on disk`);
          }
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      });
    }
  }
});

/**
 * Walk the per-runtime install destination and return the set of skill
 * basenames found on disk. Mirrors manifestSkillSet but reads the
 * filesystem, not the manifest — used to verify the two agree.
 */
function collectSkillBasenamesOnDisk(configDir) {
  const out = new Set();

  // skills/<name>/SKILL.md (or SKILL.toml/.md depending on runtime)
  const skillsDir = path.join(configDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
        out.add(entry.name.replace(/^gsd-/, ''));
      } else if (entry.isFile() && entry.name.startsWith('gsd-') && entry.name.endsWith('.md')) {
        // Codex flat skills/ layout: skills/gsd-<name>.md
        out.add(entry.name.replace(/^gsd-/, '').replace(/\.md$/, ''));
      }
    }
  }

  // command/gsd-<name>.md (OpenCode, Kilo)
  const commandDir = path.join(configDir, 'command');
  if (fs.existsSync(commandDir)) {
    for (const file of fs.readdirSync(commandDir)) {
      if (file.startsWith('gsd-') && file.endsWith('.md')) {
        out.add(file.replace(/^gsd-/, '').replace(/\.md$/, ''));
      }
    }
  }

  // commands/gsd/<name>.{md,toml} (Claude local emits .md; Gemini emits .toml)
  const commandsGsdDir = path.join(configDir, 'commands', 'gsd');
  if (fs.existsSync(commandsGsdDir)) {
    for (const file of fs.readdirSync(commandsGsdDir)) {
      if (file.endsWith('.md') || file.endsWith('.toml')) {
        out.add(file.replace(/\.(md|toml)$/, ''));
      }
    }
  }

  return out;
}
