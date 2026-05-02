// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

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
 * scenario.
 *
 * If execute-phase.md's bash gate is ever rewritten so the extracted
 * snippet stops matching real behavior, this test must be updated to
 * track the new pipeline — never replaced with a source grep.
 *
 * In addition to the per-plan gate behavior, this file also asserts:
 *   - The workflow markdown actually wires USE_WORKTREES_FOR_PLAN into
 *     each of the four dispatch sites (worktree-mode gate, sequential-mode
 *     gate, "worktrees disabled" prose, post-wave cleanup gate). Without
 *     this, the per-plan computation would be dead code (the original
 *     #2772 fix shipped in this state — CodeRabbit caught it).
 *   - The quick.md executor prompt injects SUBMODULE_PATHS and a fail-loud
 *     pre-commit guard, and the guard actually aborts when staged paths
 *     fall inside a submodule.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createTempGitProject, cleanup } = require('./helpers.cjs');

// Bash snippet extracted from execute-phase.md (the SUBMODULE_PATHS parse +
// per-plan intersection logic with normalization + bidirectional matching).
// Inputs come from env vars: PLAN_FILES (whitespace-separated) and plan_id.
// Output: log lines on stdout, then a final line
// `USE_WORKTREES_FOR_PLAN=<true|false>` for the test to parse.
const GATE_SNIPPET = [
  'set -e',
  'USE_WORKTREES="${USE_WORKTREES:-true}"',
  'if [ -f .gitmodules ]; then',
  "  SUBMODULE_PATHS=$(git config --file .gitmodules --get-regexp '^submodule\\..*\\.path$' 2>/dev/null | awk '{print $2}')",
  'else',
  '  SUBMODULE_PATHS=""',
  'fi',
  'USE_WORKTREES_FOR_PLAN="$USE_WORKTREES"',
  'if [ -n "$SUBMODULE_PATHS" ] && [ "$USE_WORKTREES_FOR_PLAN" != "false" ]; then',
  '  if [ -z "$PLAN_FILES" ]; then',
  '    echo "[worktree] Plan ${plan_id}: files_modified missing/unparseable — disabling worktree isolation as a safety fallback (submodule project)"',
  '    USE_WORKTREES_FOR_PLAN=false',
  '  else',
  '    INTERSECT=""',
  '    set -f',
  '    for sm_raw in $SUBMODULE_PATHS; do',
  '      sm="${sm_raw#./}"',
  '      sm="${sm%/}"',
  '      [ -z "$sm" ] && continue',
  '      for pf_raw in $PLAN_FILES; do',
  '        pf="${pf_raw#./}"',
  '        pf="${pf%/}"',
  '        [ -z "$pf" ] && continue',
  '        matched=0',
  '        case "$pf" in',
  '          "$sm"|"$sm"/*) matched=1 ;;',
  '        esac',
  '        if [ "$matched" -eq 0 ]; then',
  '          case "$sm" in',
  '            "$pf"|"$pf"/*) matched=1 ;;',
  '          esac',
  '        fi',
  '        if [ "$matched" -eq 0 ]; then',
  '          case "$pf" in',
  "            *'*'*|*'?'*|*'['*)",
  '              prefix="${pf%%[*?[]*}"',
  '              prefix="${prefix%/}"',
  '              if [ -n "$prefix" ]; then',
  '                case "$sm" in',
  '                  "$prefix"|"$prefix"/*) matched=1 ;;',
  '                esac',
  '                if [ "$matched" -eq 0 ]; then',
  '                  case "$prefix" in',
  '                    "$sm"|"$sm"/*) matched=1 ;;',
  '                  esac',
  '                fi',
  '              fi',
  '              ;;',
  '        esac',
  '        fi',
  '        if [ "$matched" -eq 1 ]; then',
  '          INTERSECT="$INTERSECT $pf_raw"',
  '        fi',
  '      done',
  '    done',
  '    set +f',
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

    assert.equal(decision, 'true');
    assert.equal(logLines.filter((l) => l.startsWith('[worktree]')).length, 0);
  });

  test('plan touching vendor/foo/bar.ts in a submodule project DISABLES worktree isolation', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, stdout } = runGate(repo, {
      PLAN_FILES: 'src/index.ts vendor/foo/bar.ts',
      plan_id: 'plan-002',
    });

    assert.equal(decision, 'false');
    assert.match(stdout, /\[worktree\] Plan plan-002: planned paths intersect submodule paths/);
    assert.match(stdout, /vendor\/foo\/bar\.ts/);
  });

  test('plan whose path equals the submodule root (vendor/foo) DISABLES worktree isolation', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, stdout } = runGate(repo, {
      PLAN_FILES: 'vendor/foo',
      plan_id: 'plan-003',
    });

    assert.equal(decision, 'false');
    assert.match(stdout, /\[worktree\] Plan plan-003: planned paths intersect submodule paths/);
  });

  test('missing files_modified in a submodule project falls back to DISABLE with a logged reason', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, stdout } = runGate(repo, {
      PLAN_FILES: '',
      plan_id: 'plan-004',
    });

    assert.equal(decision, 'false');
    assert.match(stdout, /\[worktree\] Plan plan-004: files_modified missing\/unparseable/);
    assert.match(stdout, /safety fallback/);
  });

  test('repo with no .gitmodules at all keeps worktree isolation ENABLED regardless of plan paths', () => {
    const { decision, logLines } = runGate(repo, {
      PLAN_FILES: 'vendor/foo/bar.ts src/index.ts',
      plan_id: 'plan-005',
    });

    assert.equal(decision, 'true');
    assert.equal(logLines.filter((l) => l.startsWith('[worktree]')).length, 0);
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

    assert.equal(decision, 'true');
    assert.equal(logLines.filter((l) => l.startsWith('[worktree]')).length, 0);
  });

  // ---- Path-normalization & glob coverage (CodeRabbit MAJOR finding) ----

  test('planned path with leading "./" normalizes and DISABLES isolation when inside a submodule', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, stdout } = runGate(repo, {
      PLAN_FILES: './vendor/foo/bar.c',
      plan_id: 'plan-norm-1',
    });

    assert.equal(decision, 'false', './vendor/foo/bar.c must normalize and intersect vendor/foo');
    assert.match(stdout, /vendor\/foo\/bar\.c/);
  });

  test('planned path with trailing slash equal to submodule DISABLES isolation', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision } = runGate(repo, {
      PLAN_FILES: 'vendor/foo/',
      plan_id: 'plan-norm-2',
    });

    assert.equal(decision, 'false', 'trailing slash must not defeat the submodule-root match');
  });

  test('globby planned path "vendor/**/*.c" DISABLES isolation when submodule sits inside vendor/', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, stdout } = runGate(repo, {
      PLAN_FILES: 'vendor/**/*.c',
      plan_id: 'plan-norm-3',
    });

    assert.equal(
      decision,
      'false',
      'glob whose literal prefix "vendor" contains submodule vendor/foo must intersect'
    );
    assert.match(stdout, /vendor\/\*\*\/\*\.c/);
  });

  test('plan declares a parent directory of the submodule (e.g. "vendor") — DISABLES isolation', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision } = runGate(repo, {
      PLAN_FILES: 'vendor',
      plan_id: 'plan-norm-4',
    });

    assert.equal(
      decision,
      'false',
      'planned path that contains the submodule must intersect (bidirectional matching)'
    );
  });

  test('submodule path declared with leading "./" in .gitmodules still matches a plain planned path', () => {
    const gitmodules = [
      '[submodule "vendor/foo"]',
      '\tpath = ./vendor/foo',
      '\turl = https://example.invalid/foo.git',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(repo, '.gitmodules'), gitmodules);

    const { decision } = runGate(repo, {
      PLAN_FILES: 'vendor/foo/bar.ts',
      plan_id: 'plan-norm-5',
    });

    assert.equal(
      decision,
      'false',
      'submodule "./vendor/foo" must normalize and match plain planned path vendor/foo/bar.ts'
    );
  });

  test('globby planned path that does NOT overlap the submodule keeps isolation ENABLED', () => {
    writeGitmodulesWithSubmodule(repo, 'vendor/foo');

    const { decision, logLines } = runGate(repo, {
      PLAN_FILES: 'src/**/*.ts',
      plan_id: 'plan-norm-6',
    });

    assert.equal(decision, 'true');
    assert.equal(logLines.filter((l) => l.startsWith('[worktree]')).length, 0);
  });
});

// ---- Workflow-markdown wiring assertions (CodeRabbit CRITICAL finding) ----
//
// The original PR computed USE_WORKTREES_FOR_PLAN but never read it at the
// dispatch sites — the dispatch still branched on the project-level
// USE_WORKTREES, so the per-plan decision was dead code. Assert the markdown
// actually wires the variable into the four dispatch sites.

describe('execute-phase.md dispatch wires USE_WORKTREES_FOR_PLAN (#2772)', () => {
  const workflowPath = path.join(
    __dirname,
    '..',
    'get-shit-done',
    'workflows',
    'execute-phase.md'
  );
  const gatePath = path.join(
    __dirname,
    '..',
    'get-shit-done',
    'workflows',
    'execute-phase',
    'steps',
    'per-plan-worktree-gate.md'
  );

  test('workflow file exists and is readable', () => {
    assert.ok(fs.existsSync(workflowPath), `expected ${workflowPath} to exist`);
  });

  test('per-plan worktree gate steps file exists and is readable', () => {
    assert.ok(fs.existsSync(gatePath), `expected ${gatePath} to exist`);
  });

  test('Worktree-mode dispatch gate reads USE_WORKTREES_FOR_PLAN, not USE_WORKTREES', () => {
    const md = fs.readFileSync(workflowPath, 'utf-8');
    assert.match(
      md,
      /\*\*Worktree mode\*\*\s*\(`USE_WORKTREES_FOR_PLAN`/,
      'Worktree-mode header must gate on USE_WORKTREES_FOR_PLAN per-plan'
    );
  });

  test('Sequential-mode dispatch gate reads USE_WORKTREES_FOR_PLAN', () => {
    const md = fs.readFileSync(workflowPath, 'utf-8');
    assert.match(
      md,
      /\*\*Sequential mode\*\*\s*\(`USE_WORKTREES_FOR_PLAN`/,
      'Sequential-mode header must gate on USE_WORKTREES_FOR_PLAN per-plan'
    );
  });

  test('"Worktrees disabled" sequential rule is documented per-plan, not project-level', () => {
    const md = fs.readFileSync(workflowPath, 'utf-8');
    assert.match(
      md,
      /worktrees are disabled for a plan/i,
      'sequential-execution rule must be expressed per-plan'
    );
  });

  test('execute-phase.md hooks the per-plan gate steps file at sub-step 2.5', () => {
    const md = fs.readFileSync(workflowPath, 'utf-8');
    assert.match(md, /Per-plan worktree decision/, 'sub-step header must exist in execute_waves');
    assert.match(
      md,
      /execute-phase\/steps\/per-plan-worktree-gate\.md/,
      'execute-phase.md must reference the extracted gate file'
    );
  });

  test('per-plan gate file documents PLAN_FILES extraction from plan_json', () => {
    const md = fs.readFileSync(gatePath, 'utf-8');
    assert.match(
      md,
      /jq -r '\.files_modified \/\/ \[\] \| join\(" "\)' <<<"\$plan_json"/,
      'PLAN_FILES extraction from plan_json must be documented in the gate file'
    );
  });

  test('per-plan gate file uses bidirectional case + glob-prefix handling + set -f discipline', () => {
    const md = fs.readFileSync(gatePath, 'utf-8');
    assert.match(md, /set -f/, 'matcher must disable globbing while iterating');
    assert.match(md, /set \+f/, 'matcher must re-enable globbing after iteration');
    const pfFirst = md.match(/case "\$pf" in\s+"\$sm"\|"\$sm"\/\*\)/);
    const smFirst = md.match(/case "\$sm" in\s+"\$pf"\|"\$pf"\/\*\)/);
    assert.ok(pfFirst, 'matcher must check pf inside sm');
    assert.ok(smFirst, 'matcher must check sm inside pf (bidirectional)');
    assert.match(md, /sm="\$\{sm_raw#\.\/\}"/, 'submodule path must strip leading ./');
    assert.match(md, /pf="\$\{pf_raw#\.\/\}"/, 'planned path must strip leading ./');
    assert.match(md, /sm="\$\{sm%\/\}"/, 'submodule path must strip trailing /');
    assert.match(md, /pf="\$\{pf%\/\}"/, 'planned path must strip trailing /');
  });

  test('Post-wave worktree-cleanup gate is per-plan, not blanket project-level', () => {
    const md = fs.readFileSync(workflowPath, 'utf-8');
    assert.match(
      md,
      /WAVE_WORKTREE_PLANS/,
      'post-wave cleanup must track which plans actually used worktrees'
    );
  });
});

// ---- quick.md SUBMODULE_PATHS executor guard (CodeRabbit CRITICAL #3) ----
//
// Quick mode does NOT have a pre-declared files_modified list. The fail-loud
// guard must (a) be present in the markdown of the executor prompt, and
// (b) actually abort when run against a fixture that stages a submodule path.

describe('quick.md executor pre-commit submodule guard (#2772)', () => {
  const quickPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

  test('quick.md executor prompt injects SUBMODULE_PATHS', () => {
    const md = fs.readFileSync(quickPath, 'utf-8');
    assert.match(
      md,
      /SUBMODULE_PATHS for this project: \$\{SUBMODULE_PATHS\}/,
      'executor prompt must inline SUBMODULE_PATHS so the agent can run the guard'
    );
  });

  test('quick.md executor prompt contains a fail-loud pre-commit guard with ABORT message', () => {
    const md = fs.readFileSync(quickPath, 'utf-8');
    assert.match(md, /<submodule_commit_guard>/, 'guard block must exist');
    assert.match(
      md,
      /git diff --cached --name-only/,
      'guard must inspect staged paths before commit'
    );
    assert.match(
      md,
      /ABORT: staged path/,
      'guard must surface a fail-loud ABORT message on intersection'
    );
    assert.match(
      md,
      /workflow\.use_worktrees=false/,
      'guard must tell the user how to recover (re-run without worktrees)'
    );
  });

  // Behavioral: extract the guard logic and run it against a fixture repo.
  // We simulate the executor's commit-time guard and assert it aborts when a
  // staged path falls inside a SUBMODULE_PATHS entry, and passes otherwise.
  const QUICK_GUARD_SNIPPET = [
    'set +e',
    'STAGED=$(git diff --cached --name-only)',
    'if [ -n "$SUBMODULE_PATHS" ]; then',
    '  for sm_raw in $SUBMODULE_PATHS; do',
    '    sm="${sm_raw#./}"',
    '    sm="${sm%/}"',
    '    [ -z "$sm" ] && continue',
    '    for f_raw in $STAGED; do',
    '      f="${f_raw#./}"',
    '      f="${f%/}"',
    '      case "$f" in',
    '        "$sm"|"$sm"/*)',
    '          echo "ABORT: staged path $f_raw falls inside submodule $sm — re-run with workflow.use_worktrees=false" >&2',
    '          exit 1 ;;',
    '      esac',
    '    done',
    '  done',
    'fi',
    'echo "OK"',
  ].join('\n');

  test('guard ABORTs when a staged path falls inside a submodule', () => {
    const repo = createTempGitProject('gsd-test-2772-quick-abort-');
    try {
      // Create a file inside the submodule path and stage it.
      fs.mkdirSync(path.join(repo, 'vendor', 'foo'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'vendor', 'foo', 'bar.ts'), 'export {};\n');
      execFileSync('git', ['add', 'vendor/foo/bar.ts'], { cwd: repo });

      let err;
      try {
        execFileSync('bash', ['-c', QUICK_GUARD_SNIPPET], {
          cwd: repo,
          encoding: 'utf-8',
          env: { ...process.env, SUBMODULE_PATHS: 'vendor/foo' },
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'guard must exit non-zero when staged path is inside submodule');
      assert.equal(err.status, 1, 'guard must exit with status 1');
      const stderr = err.stderr ? err.stderr.toString() : '';
      assert.match(stderr, /ABORT: staged path vendor\/foo\/bar\.ts/);
      assert.match(stderr, /vendor\/foo/);
    } finally {
      cleanup(repo);
    }
  });

  test('guard passes when no staged path falls inside a submodule', () => {
    const repo = createTempGitProject('gsd-test-2772-quick-pass-');
    try {
      fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'src', 'index.ts'), 'export {};\n');
      execFileSync('git', ['add', 'src/index.ts'], { cwd: repo });

      const out = execFileSync('bash', ['-c', QUICK_GUARD_SNIPPET], {
        cwd: repo,
        encoding: 'utf-8',
        env: { ...process.env, SUBMODULE_PATHS: 'vendor/foo' },
      });
      assert.match(out, /OK/);
    } finally {
      cleanup(repo);
    }
  });

  test('guard normalizes leading "./" on staged paths and still ABORTs', () => {
    const repo = createTempGitProject('gsd-test-2772-quick-norm-');
    try {
      fs.mkdirSync(path.join(repo, 'vendor', 'foo'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'vendor', 'foo', 'bar.ts'), 'export {};\n');
      execFileSync('git', ['add', 'vendor/foo/bar.ts'], { cwd: repo });

      let err;
      try {
        // Submodule path declared with ./ prefix — must still match.
        execFileSync('bash', ['-c', QUICK_GUARD_SNIPPET], {
          cwd: repo,
          encoding: 'utf-8',
          env: { ...process.env, SUBMODULE_PATHS: './vendor/foo' },
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err, 'guard must abort even when SUBMODULE_PATHS uses ./ prefix');
      assert.equal(err.status, 1);
    } finally {
      cleanup(repo);
    }
  });
});
