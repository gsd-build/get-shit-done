/**
 * Regression test for #2772: worktree isolation is unconditionally disabled
 * when `.gitmodules` exists in the repo, even when the plan does not touch
 * any submodule path.
 *
 * Behavioral test: the bash decision pipeline from
 * get-shit-done/workflows/execute-phase.md is extracted verbatim into an
 * executable snippet here, then run via execFileSync('bash', ...) against
 * real fixture projects built with `createTempGitProject()`. We assert
 * the resulting USE_WORKTREES_FOR_PLAN value (printed on the final line
 * of stdout) and the presence/absence of the [worktree] log line for each
 * scenario:
 *
 *   1. .gitmodules lists vendor/foo, plan touches only src/ paths
 *      → USE_WORKTREES_FOR_PLAN stays true, no [worktree] log.
 *   2. Same repo, plan touches vendor/foo/bar.ts
 *      → USE_WORKTREES_FOR_PLAN flips to false, log mentions intersect.
 *   3. .gitmodules present, files_modified missing/unparseable
 *      → USE_WORKTREES_FOR_PLAN=false, log mentions safety fallback.
 *   4. No .gitmodules at all → USE_WORKTREES_FOR_PLAN stays true.
 *
 * If execute-phase.md's bash gate is ever rewritten so the extracted
 * snippet stops matching real behavior, this test must be updated to
 * track the new pipeline — never replaced with a source grep.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createTempGitProject, cleanup } = require('./helpers.cjs');

// Bash snippet extracted from execute-phase.md (the SUBMODULE_PATHS parse +
// per-plan intersection logic). Inputs come from env vars: PLAN_FILES
// (whitespace-separated) and plan_id. Output: log lines on stdout, then
// a final line `USE_WORKTREES_FOR_PLAN=<true|false>` for the test to parse.
const GATE_SNIPPET = [
  'set -e',
  'USE_WORKTREES="${USE_WORKTREES:-true}"',
  'if [ -f .gitmodules ]; then',
  "  SUBMODULE_PATHS=$(git config --file .gitmodules --get-regexp '^submodule\\..*\\.path$' 2>/dev/null | awk '{print $2}')",
  'else',
  '  SUBMODULE_PATHS=""',
  'fi',
  'USE_WORKTREES_FOR_PLAN="$USE_WORKTREES"',
  'if [ -n "$SUBMODULE_PATHS" ]; then',
  '  if [ -z "$PLAN_FILES" ]; then',
  '    echo "[worktree] Plan ${plan_id}: files_modified missing/unparseable — disabling worktree isolation as a safety fallback (submodule project)"',
  '    USE_WORKTREES_FOR_PLAN=false',
  '  else',
  '    INTERSECT=""',
  '    for sm in $SUBMODULE_PATHS; do',
  '      for pf in $PLAN_FILES; do',
  '        case "$pf" in',
  '          "$sm"|"$sm"/*) INTERSECT="$INTERSECT $pf" ;;',
  '        esac',
  '      done',
  '    done',
  '    if [ -n "$INTERSECT" ]; then',
  '      echo "[worktree] Plan ${plan_id}: planned paths intersect submodule paths (${INTERSECT# }) — disabling worktree isolation for this plan"',
  '      USE_WORKTREES_FOR_PLAN=false',
  '    fi',
  '  fi',
  'fi',
  'echo "USE_WORKTREES_FOR_PLAN=$USE_WORKTREES_FOR_PLAN"',
].join('\n');

function runGate(cwd, env) {
  const out = execFileSync('bash', ['-c', GATE_SNIPPET], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  });
  const lines = out.trim().split('\n');
  const last = lines[lines.length - 1];
  const m = last.match(/^USE_WORKTREES_FOR_PLAN=(true|false)$/);
  assert.ok(
    m,
    `expected final line to be USE_WORKTREES_FOR_PLAN=<bool>, got: ${last}\nfull stdout:\n${out}`
  );
  return { decision: m[1], stdout: out, logLines: lines.slice(0, -1) };
}

function writeGitmodulesWithSubmodule(repo, submodulePath) {
  const content = [
    `[submodule "${submodulePath}"]`,
    `\tpath = ${submodulePath}`,
    `\turl = https://example.invalid/${submodulePath}.git`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(repo, '.gitmodules'), content);
}

describe('Submodule worktree-isolation gate intersects planned paths (#2772)', () => {
  let repo;

  beforeEach(() => {
    repo = createTempGitProject('gsd-test-2772-');
  });

  afterEach(() => {
    cleanup(repo);
  });

  test('plan touching only src/ in a submodule project keeps worktree isolation ENABLED', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, logLines } = runGate(repo, {
      PLAN_FILES: 'src/index.ts src/lib/util.ts',
      plan_id: 'plan-001',
    });

    assert.equal(
      decision,
      'true',
      'worktree isolation must remain enabled when planned paths do not touch any submodule'
    );
    assert.equal(
      logLines.filter((l) => l.startsWith('[worktree]')).length,
      0,
      'no [worktree] disable log should be emitted when planned paths are submodule-free'
    );
  });

  test('plan touching vendor/foo/bar.ts in a submodule project DISABLES worktree isolation', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, stdout } = runGate(repo, {
      PLAN_FILES: 'src/index.ts vendor/foo/bar.ts',
      plan_id: 'plan-002',
    });

    assert.equal(
      decision,
      'false',
      'worktree isolation must be disabled when planned paths intersect a submodule path'
    );
    assert.match(stdout, /\[worktree\] Plan plan-002: planned paths intersect submodule paths/);
    assert.match(stdout, /vendor\/foo\/bar\.ts/);
  });

  test('plan whose path equals the submodule root (vendor/foo) DISABLES worktree isolation', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, stdout } = runGate(repo, {
      PLAN_FILES: 'vendor/foo',
      plan_id: 'plan-003',
    });

    assert.equal(
      decision,
      'false',
      'an exact match on the submodule root path must also count as intersection'
    );
    assert.match(stdout, /\[worktree\] Plan plan-003: planned paths intersect submodule paths/);
  });

  test('missing files_modified in a submodule project falls back to DISABLE with a logged reason', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, stdout } = runGate(repo, {
      PLAN_FILES: '',
      plan_id: 'plan-004',
    });

    assert.equal(
      decision,
      'false',
      'missing/unparseable files_modified must trigger the safe fallback (disable)'
    );
    assert.match(stdout, /\[worktree\] Plan plan-004: files_modified missing\/unparseable/);
    assert.match(stdout, /safety fallback/);
  });

  test('repo with no .gitmodules at all keeps worktree isolation ENABLED regardless of plan paths', () => {
    // No .gitmodules written.
    const { decision, logLines } = runGate(repo, {
      PLAN_FILES: 'vendor/foo/bar.ts src/index.ts',
      plan_id: 'plan-005',
    });

    assert.equal(decision, 'true', 'absence of .gitmodules must leave worktree isolation enabled');
    assert.equal(
      logLines.filter((l) => l.startsWith('[worktree]')).length,
      0,
      'no [worktree] log expected when there is no .gitmodules'
    );
  });

  test('multiple submodules, plan touches only one of them — DISABLE with that path in the log', () => {
    const gitmodules = [
      '[submodule "vendor/foo"]',
      '\tpath = vendor/foo',
      '\turl = https://example.invalid/foo.git',
      '[submodule "third_party/bar"]',
      '\tpath = third_party/bar',
      '\turl = https://example.invalid/bar.git',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(repo, '.gitmodules'), gitmodules);

    const { decision, stdout } = runGate(repo, {
      PLAN_FILES: 'src/a.ts third_party/bar/b.ts',
      plan_id: 'plan-006',
    });

    assert.equal(decision, 'false');
    assert.match(stdout, /third_party\/bar\/b\.ts/);
  });

  test('planned path that merely shares a prefix with a submodule (vendor/foobar) does NOT count as intersection', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, logLines } = runGate(repo, {
      PLAN_FILES: 'vendor/foobar/x.ts',
      plan_id: 'plan-007',
    });

    assert.equal(
      decision,
      'true',
      'vendor/foobar must not match submodule vendor/foo — only exact path or path/* counts'
    );
    assert.equal(logLines.filter((l) => l.startsWith('[worktree]')).length, 0);
  });
});
