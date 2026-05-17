'use strict';
/**
 * Regression guard for issue #3251:
 * 14 commands used in workflows must be present in command-aliases.generated.cjs.
 *
 * Asserts structurally by requiring the manifest and checking each canonical
 * command appears in either the family arrays or the non-family array.
 * Never greps the source file — see feedback_no_source_grep_tests.md.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const COMMAND_ALIASES_FILE = path.join(
  REPO_ROOT,
  'get-shit-done',
  'bin',
  'lib',
  'command-aliases.generated.cjs',
);
const GSD_TOOLS = path.join(REPO_ROOT, 'get-shit-done', 'bin', 'gsd-tools.cjs');

const MISSING_14 = [
  'check.decision-coverage-plan',
  'check.decision-coverage-verify',
  'frontmatter.get',
  'frontmatter.set',
  'learnings.copy',
  'milestone.complete',
  'phase.mvp-mode',
  'progress.bar',
  'requirements.mark-complete',
  'stats.json',
  'task.is-behavior-adding',
  'todo.match-phase',
  'uat.render-checkpoint',
  'workstream.list',
];

describe('feat-3251: command-aliases.generated.cjs manifest coverage', () => {
  let manifest;

  test('manifest file can be required without error', () => {
    try {
      manifest = require(COMMAND_ALIASES_FILE);
    } catch (err) {
      assert.fail(`Failed to require manifest: ${err.message}`);
    }
    assert.ok(manifest, 'manifest should be truthy');
  });

  test('manifest exports NON_FAMILY_COMMAND_ALIASES array', () => {
    manifest = manifest ?? require(COMMAND_ALIASES_FILE);
    assert.ok(
      Array.isArray(manifest.NON_FAMILY_COMMAND_ALIASES),
      'NON_FAMILY_COMMAND_ALIASES must be an exported array in command-aliases.generated.cjs',
    );
  });

  test('all 14 missing commands are present in the manifest (family or non-family)', () => {
    manifest = manifest ?? require(COMMAND_ALIASES_FILE);

    const allCanonicalsInManifest = new Set();

    // Collect from all family arrays
    const familyArrayKeys = [
      'STATE_COMMAND_ALIASES',
      'VERIFY_COMMAND_ALIASES',
      'INIT_COMMAND_ALIASES',
      'PHASE_COMMAND_ALIASES',
      'PHASES_COMMAND_ALIASES',
      'VALIDATE_COMMAND_ALIASES',
      'ROADMAP_COMMAND_ALIASES',
    ];
    for (const key of familyArrayKeys) {
      const arr = manifest[key];
      if (!Array.isArray(arr)) continue;
      for (const entry of arr) {
        if (entry && entry.canonical) allCanonicalsInManifest.add(entry.canonical);
      }
    }

    // Collect from non-family array
    const nonFamily = manifest.NON_FAMILY_COMMAND_ALIASES;
    if (Array.isArray(nonFamily)) {
      for (const entry of nonFamily) {
        if (entry && entry.canonical) allCanonicalsInManifest.add(entry.canonical);
      }
    }

    const missing = MISSING_14.filter((cmd) => !allCanonicalsInManifest.has(cmd));
    assert.deepStrictEqual(
      missing,
      [],
      `${missing.length} command(s) still missing from manifest: ${missing.join(', ')}`,
    );
  });

  test('each non-family entry has required fields: canonical, aliases, mutation', () => {
    manifest = manifest ?? require(COMMAND_ALIASES_FILE);
    const nonFamily = manifest.NON_FAMILY_COMMAND_ALIASES;
    if (!Array.isArray(nonFamily)) return; // caught by earlier test

    for (const entry of nonFamily) {
      assert.ok(typeof entry.canonical === 'string' && entry.canonical.length > 0,
        `entry missing canonical: ${JSON.stringify(entry)}`);
      assert.ok(Array.isArray(entry.aliases),
        `entry missing aliases array for canonical=${entry.canonical}`);
      assert.ok(typeof entry.mutation === 'boolean',
        `entry missing mutation boolean for canonical=${entry.canonical}`);
    }
  });

  test('NON_FAMILY_COMMAND_ALIASES is sorted by canonical (deterministic output)', () => {
    manifest = manifest ?? require(COMMAND_ALIASES_FILE);
    const nonFamily = manifest.NON_FAMILY_COMMAND_ALIASES;
    if (!Array.isArray(nonFamily)) return; // caught by earlier test

    const canonicals = nonFamily.map((e) => e.canonical);
    const sorted = [...canonicals].sort((a, b) => a.localeCompare(b));
    assert.deepStrictEqual(
      canonicals,
      sorted,
      'NON_FAMILY_COMMAND_ALIASES must be sorted by canonical for deterministic regeneration',
    );
  });
});

function createProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3251-dispatch-'));
  fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
  return dir;
}

function runGsdTools(args, projectDir) {
  return spawnSync(process.execPath, [GSD_TOOLS, ...args], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: 30000,
    killSignal: 'SIGKILL',
  });
}

function snapshotProjectState(projectDir) {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(projectDir, full);
      if (entry.isDirectory()) walk(full);
      else {
        files.push({
          path: rel,
          sha256: crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'),
        });
      }
    }
  }
  walk(projectDir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

describe('feat-3251: generated aliases dispatch through real gsd-tools behavior', () => {
  test('phase.mvp-mode spaced alias resolves CLI flag precedence', () => {
    const projectDir = createProject();
    try {
      const result = runGsdTools(['phase', 'mvp-mode', '1', '--cli-flag'], projectDir);
      assert.equal(result.status, 0, result.stderr);

      const output = JSON.parse(result.stdout);
      assert.deepEqual(output, {
        active: true,
        source: 'cli_flag',
        roadmap_mode: null,
        config_mvp_mode: false,
        cli_flag_present: true,
      });
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('phase.mvp-mode spaced alias resolves ROADMAP mode without mutating files', () => {
    const projectDir = createProject();
    try {
      fs.writeFileSync(
        path.join(projectDir, '.planning', 'ROADMAP.md'),
        [
          '# Roadmap',
          '',
          '## v1.0.0',
          '',
          '### Phase 1: User Auth',
          '**Goal:** Users can sign in.',
          '**Mode:** mvp',
          '',
        ].join('\n'),
      );
      const beforeFiles = snapshotProjectState(projectDir);

      const result = runGsdTools(['phase', 'mvp-mode', '1'], projectDir);
      assert.equal(result.status, 0, result.stderr);

      const output = JSON.parse(result.stdout);
      assert.equal(output.active, true);
      assert.equal(output.source, 'roadmap');
      assert.equal(output.roadmap_mode, 'mvp');
      assert.equal(output.config_mvp_mode, false);
      assert.equal(output.cli_flag_present, false);
      assert.deepEqual(snapshotProjectState(projectDir), beforeFiles);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('phase.mvp-mode ROADMAP lookup stops before custom-id next phase', () => {
    const projectDir = createProject();
    try {
      fs.writeFileSync(
        path.join(projectDir, '.planning', 'ROADMAP.md'),
        [
          '# Roadmap',
          '',
          '## v1.0.0',
          '',
          '### Phase 1: Numeric Phase',
          '**Goal:** Users can sign in.',
          '',
          '### Phase custom-alpha: Custom Phase',
          '**Goal:** Custom work.',
          '**Mode:** mvp',
          '',
        ].join('\n'),
      );
      const beforeFiles = snapshotProjectState(projectDir);

      const result = runGsdTools(['phase', 'mvp-mode', '1'], projectDir);
      assert.equal(result.status, 0, result.stderr);

      const output = JSON.parse(result.stdout);
      assert.equal(output.active, false);
      assert.equal(output.source, 'none');
      assert.equal(output.roadmap_mode, null);
      assert.deepEqual(snapshotProjectState(projectDir), beforeFiles);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('phase.mvp-mode JSON error is typed and leaves project files untouched', () => {
    const projectDir = createProject();
    try {
      const beforeFiles = snapshotProjectState(projectDir);
      const result = runGsdTools(['--json-errors', 'phase', 'mvp-mode'], projectDir);
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, '');

      const error = JSON.parse(result.stderr);
      assert.deepEqual(Object.keys(error).sort(), ['message', 'ok', 'reason']);
      assert.equal(error.ok, false);
      assert.equal(error.reason, 'usage');
      assert.equal(typeof error.message, 'string');
      assert.equal(/\n\s*at\s/.test(result.stderr), false, 'non-debug failure must not print a stack trace');
      assert.deepEqual(snapshotProjectState(projectDir), beforeFiles);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
