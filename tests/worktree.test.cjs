// allow-test-rule: source-text-is-the-product
// Workflow markdown is the installed orchestration contract.

'use strict';

/**
 * Worktree Lifecycle Module — branch-check and workspace-safety tests
 *
 * Seam: get-shit-done/workflows/{execute-phase,execute-plan,quick}.md,
 *       agents/gsd-executor.md
 *
 * Split from the consolidated 13→2 worktree cluster (≤800 LOC/file):
 *   - tests/bug-2015-worktree-base-branch.test.cjs      (#2015: reset --hard)
 *   - tests/bug-2075-worktree-deletion-safeguards.test.cjs (#2075: git clean prohibition)
 *   - tests/bug-2431-worktree-locked-surfacing.test.cjs  (#2431: locked-worktree errors)
 *   - tests/bug-2774-worktree-cleanup-workspace-safety.test.cjs (#2774: discovery pipeline)
 *
 * See also: worktree-cleanup.test.cjs (#2924, #1496, #1756, #1977, #1511, #3384, #3425)
 *           worktree-safety.test.cjs  (safety function unit tests)
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
const EXECUTE_PLAN_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'execute-plan.md');
const QUICK_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'quick.md');
const EXECUTOR_AGENT_PATH = path.join(REPO_ROOT, 'agents', 'gsd-executor.md');
const DIAGNOSE_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'diagnose-issues.md');
const GIT_INTEGRATION_PATH = path.join(REPO_ROOT, 'get-shit-done', 'references', 'git-integration.md');

const isWindows = process.platform === 'win32';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractNamedBlock(markdown, blockName) {
  const open = `<${blockName}>`;
  const close = `</${blockName}>`;
  const start = markdown.indexOf(open);
  if (start === -1) return null;
  const end = markdown.indexOf(close, start + open.length);
  if (end === -1) return null;
  return markdown.slice(start + open.length, end);
}

/**
 * Extract all fenced code blocks (```...```) from a markdown chunk.
 * Returns array of { lang, body } objects.
 */
function extractFencedCodeBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split('\n');
  let inFence = false;
  let fenceLang = '';
  let buffer = [];
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```')) {
      if (!inFence) {
        inFence = true;
        fenceLang = trimmed.slice(3).trim();
        buffer = [];
      } else {
        blocks.push({ lang: fenceLang, body: buffer.join('\n') });
        inFence = false;
        fenceLang = '';
        buffer = [];
      }
    } else if (inFence) {
      buffer.push(line);
    }
  }
  return blocks;
}

/**
 * Tokenize a shell-like script into individual statements (split on `;`, `&&`, `||`, newlines)
 * and return commands as arrays of word tokens. Handles `$(cmd ...)` command substitution
 * and `VAR=$(cmd ...)` assignments by extracting the inner command. This is intentionally
 * simple — adequate for asserting on the presence of well-known git invocations.
 */
function shellStatements(script) {
  const statements = [];
  const lines = script.split('\n');
  for (let raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    // Split on shell statement separators
    const parts = line.split(/(?:&&|\|\||;)/);
    for (const part of parts) {
      let trimmed = part.trim();
      if (!trimmed) continue;
      // Strip leading `VAR=` assignments so the substituted command surfaces as cmd[0].
      // Then unwrap `$(...)` command substitution.
      const assignMatch = trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*=(.*)$/);
      if (assignMatch) trimmed = assignMatch[1];
      const subMatch = trimmed.match(/^\$\((.*?)\)?$/);
      if (subMatch) trimmed = subMatch[1];
      // Also handle leading `$(` without closing paren (paren may have been split off)
      if (trimmed.startsWith('$(')) trimmed = trimmed.slice(2);
      // Strip trailing closing parens left over from substitution
      trimmed = trimmed.replace(/\)+\s*$/, '').trim();
      if (!trimmed) continue;
      // Strip surrounding quotes on the leading word
      statements.push(trimmed.split(/\s+/).filter(Boolean));
    }
  }
  return statements;
}

/**
 * Find the line index of the first command matching a predicate.
 * Returns -1 when not found.
 */
function findCommandIndex(statements, predicate) {
  for (let i = 0; i < statements.length; i++) {
    if (predicate(statements[i])) return i;
  }
  return -1;
}


const DISCOVERY_PIPELINE =
  'grep "^worktree " | grep "\\.claude/worktrees/agent-" | sed \'s/^worktree //\'';

function runDiscoveryAgainstFixture(porcelain) {
  const out = execSync(DISCOVERY_PIPELINE, {
    input: porcelain,
    encoding: 'utf-8',
  });
  return out.split('\n').filter((l) => l.length > 0);
}

function runDiscoveryAgainstRepo(repoCwd) {
  const out = execSync(
    `git worktree list --porcelain | ${DISCOVERY_PIPELINE}`,
    { cwd: repoCwd, encoding: 'utf-8' }
  );
  return out.split('\n').filter((l) => l.length > 0);
}

function makeTempUpstreamRepo(prefix) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  execSync('git init -b main', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config commit.gpgsign false', { cwd: tmpDir, stdio: 'pipe' });
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# upstream\n');
  execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}

// ─── #2015: reset --hard not --soft ─────────────────────────────────────────

describe('worktree_branch_check must use reset --hard not reset --soft (#2015)', () => {

  test('execute-phase.md worktree_branch_check does not use reset --soft', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    // Extract the worktree_branch_check block
    const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
    assert.ok(blockMatch, 'execute-phase.md must contain a <worktree_branch_check> block');

    const block = blockMatch[1];
    assert.ok(
      !block.includes('reset --soft'),
      'worktree_branch_check must not use reset --soft (leaves working tree files unchanged). Use reset --hard instead.'
    );
  });

  test('execute-phase.md worktree_branch_check uses reset --hard for base correction', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
    assert.ok(blockMatch, 'execute-phase.md must contain a <worktree_branch_check> block');

    const block = blockMatch[1];
    assert.ok(
      block.includes('reset --hard'),
      'worktree_branch_check must use reset --hard to correctly reset both HEAD and working tree to the expected base'
    );
  });

  test('quick.md worktree_branch_check does not use reset --soft', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
    assert.ok(blockMatch, 'quick.md must contain a <worktree_branch_check> block');

    const block = blockMatch[1];
    assert.ok(
      !block.includes('reset --soft'),
      'quick.md worktree_branch_check must not use reset --soft. Use reset --hard instead.'
    );
  });

  test('quick.md worktree_branch_check uses reset --hard for base correction', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
    assert.ok(blockMatch, 'quick.md must contain a <worktree_branch_check> block');

    const block = blockMatch[1];
    assert.ok(
      block.includes('reset --hard'),
      'quick.md worktree_branch_check must use reset --hard to correctly reset both HEAD and working tree'
    );
  });
});

// ─── #2075: worktree deletion safeguards ────────────────────────────────────

describe('bug-2075: worktree deletion safeguards', () => {

  describe('Failure Mode B: git clean prohibition in executor agent', () => {
    test('gsd-executor.md explicitly prohibits git clean in worktree context', () => {
      const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');

      // Must have an explicit prohibition section mentioning git clean
      const prohibitsGitClean = (
        content.includes('git clean') &&
        (
          /NEVER.*git clean/i.test(content) ||
          /git clean.*NEVER/i.test(content) ||
          /do not.*git clean/i.test(content) ||
          /git clean.*prohibited/i.test(content) ||
          /prohibited.*git clean/i.test(content) ||
          /forbidden.*git clean/i.test(content) ||
          /git clean.*forbidden/i.test(content) ||
          /must not.*git clean/i.test(content) ||
          /git clean.*must not/i.test(content)
        )
      );

      assert.ok(
        prohibitsGitClean,
        'gsd-executor.md must explicitly prohibit git clean — running it inside a worktree deletes files committed on the feature branch (#2075 Failure Mode B)'
      );
    });

    test('gsd-executor.md git clean prohibition explains the worktree data-loss risk', () => {
      const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');

      // The prohibition must be accompanied by a reason — not just a bare rule
      // Look for the word "worktree" near the git clean prohibition
      const gitCleanIdx = content.indexOf('git clean');
      assert.ok(gitCleanIdx > -1, 'gsd-executor.md must mention git clean (to prohibit it)');

      // Extract context around the git clean mention (500 chars either side)
      const contextStart = Math.max(0, gitCleanIdx - 500);
      const contextEnd = Math.min(content.length, gitCleanIdx + 500);
      const context = content.slice(contextStart, contextEnd);

      const hasWorktreeRationale = (
        /worktree/i.test(context) ||
        /delete/i.test(context) ||
        /untracked/i.test(context)
      );

      assert.ok(
        hasWorktreeRationale,
        'The git clean prohibition in gsd-executor.md must explain why: git clean in a worktree deletes files that appear untracked but are committed on the feature branch'
      );
    });
  });

  describe('Failure Mode A: worktree_branch_check audit across all worktree-spawning workflows', () => {
    test('execute-phase.md has worktree_branch_check block with --hard reset', () => {
      const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

      const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
      assert.ok(
        blockMatch,
        'execute-phase.md must contain a <worktree_branch_check> block'
      );

      const block = blockMatch[1];
      assert.ok(
        block.includes('reset --hard'),
        'execute-phase.md worktree_branch_check must use git reset --hard (not --soft)'
      );
      assert.ok(
        !block.includes('reset --soft'),
        'execute-phase.md worktree_branch_check must not use git reset --soft'
      );
    });

    test('quick.md has worktree_branch_check block with --hard reset', () => {
      const content = fs.readFileSync(QUICK_PATH, 'utf-8');

      const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
      assert.ok(
        blockMatch,
        'quick.md must contain a <worktree_branch_check> block'
      );

      const block = blockMatch[1];
      assert.ok(
        block.includes('reset --hard'),
        'quick.md worktree_branch_check must use git reset --hard (not --soft)'
      );
      assert.ok(
        !block.includes('reset --soft'),
        'quick.md worktree_branch_check must not use git reset --soft'
      );
    });

    test('diagnose-issues.md has worktree_branch_check instruction for spawned agents', () => {
      const content = fs.readFileSync(DIAGNOSE_PATH, 'utf-8');

      assert.ok(
        content.includes('worktree_branch_check'),
        'diagnose-issues.md must include worktree_branch_check instruction for spawned debug agents'
      );

      assert.ok(
        content.includes('reset --hard'),
        'diagnose-issues.md worktree_branch_check must instruct agents to use git reset --hard'
      );
    });
  });

  describe('Defense-in-depth: post-commit deletion check (from #1977)', () => {
    test('gsd-executor.md task_commit_protocol has post-commit deletion verification', () => {
      const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');

      assert.ok(
        content.includes('--diff-filter=D'),
        'gsd-executor.md must include --diff-filter=D to detect accidental file deletions after each commit'
      );

      // Must have a warning about unexpected deletions
      assert.ok(
        content.includes('DELETIONS') || content.includes('WARNING'),
        'gsd-executor.md must emit a warning when a commit includes unexpected file deletions'
      );
    });
  });

  describe('Defense-in-depth: pre-merge deletion check (from #1977)', () => {
    test('execute-phase.md worktree merge section has pre-merge deletion check', () => {
      const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

      const worktreeCleanupStart = content.indexOf('Worktree cleanup');
      assert.ok(
        worktreeCleanupStart > -1,
        'execute-phase.md must have a worktree cleanup section'
      );

      const cleanupSection = content.slice(worktreeCleanupStart);

      assert.ok(
        cleanupSection.includes('--diff-filter=D'),
        'execute-phase.md worktree cleanup must use --diff-filter=D to block deletion-introducing merges'
      );

      // Deletion check must appear before git merge
      const deletionCheckIdx = cleanupSection.indexOf('--diff-filter=D');
      const gitMergeIdx = cleanupSection.indexOf('git merge');
      assert.ok(
        deletionCheckIdx < gitMergeIdx,
        '--diff-filter=D deletion check must appear before git merge in the worktree cleanup section'
      );

      assert.ok(
        cleanupSection.includes('BLOCKED') || cleanupSection.includes('deletion'),
        'execute-phase.md must block or warn when the worktree branch contains file deletions'
      );
    });

    test('quick.md worktree merge section has pre-merge deletion check', () => {
      const content = fs.readFileSync(QUICK_PATH, 'utf-8');

      const mergeIdx = content.indexOf('git merge');
      assert.ok(mergeIdx > -1, 'quick.md must contain a git merge operation');

      // Find the worktree cleanup block (starts after "Worktree cleanup")
      const worktreeCleanupStart = content.indexOf('Worktree cleanup');
      assert.ok(
        worktreeCleanupStart > -1,
        'quick.md must have a worktree cleanup section'
      );

      const cleanupSection = content.slice(worktreeCleanupStart);

      assert.ok(
        cleanupSection.includes('--diff-filter=D') || cleanupSection.includes('diff-filter'),
        'quick.md worktree cleanup must check for file deletions before merging'
      );
    });
  });

});

// ─── #2431: locked-worktree error surfacing ──────────────────────────────────

describe('bug-2431: worktree teardown must surface locked-worktree errors', () => {
  test('quick.md exists', () => {
    assert.ok(fs.existsSync(QUICK_PATH), 'quick.md should exist');
  });

  test('execute-phase.md exists', () => {
    assert.ok(fs.existsSync(EXECUTE_PHASE_PATH), 'execute-phase.md should exist');
  });

  test('quick.md: no silent worktree remove pattern', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const silentRemovePattern = /git worktree remove[^\n]*--force\s+2>\/dev\/null\s*\|\|\s*true/;
    assert.ok(!silentRemovePattern.test(content), 'quick.md: must not contain silent git worktree remove pattern');
  });

  test('execute-phase.md: no silent worktree remove pattern', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    const silentRemovePattern = /git worktree remove[^\n]*--force\s+2>\/dev\/null\s*\|\|\s*true/;
    assert.ok(!silentRemovePattern.test(content), 'execute-phase.md: must not contain silent git worktree remove pattern');
  });

  test('quick.md: has lock-aware detection block', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    assert.ok(
      content.includes('.git/worktrees/') && content.includes('locked'),
      'quick.md: must include lock-aware detection (.git/worktrees/.../locked check)'
    );
  });

  test('execute-phase.md: has lock-aware detection block', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    assert.ok(
      content.includes('.git/worktrees/') && content.includes('locked'),
      'execute-phase.md: must include lock-aware detection'
    );
  });

  test('quick.md: has git worktree unlock retry', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    assert.ok(content.includes('git worktree unlock'), 'quick.md: must include "git worktree unlock" retry attempt');
  });

  test('execute-phase.md: has git worktree unlock retry', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    assert.ok(content.includes('git worktree unlock'), 'execute-phase.md: must include "git worktree unlock" retry attempt');
  });

  test('quick.md: has user-visible warning on residual worktree', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    assert.ok(
      content.includes('Residual worktree') || content.includes('manual cleanup'),
      'quick.md: must include user-visible warning when worktree removal fails'
    );
  });

  test('execute-phase.md: has user-visible warning on residual worktree', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    assert.ok(
      content.includes('Residual worktree') || content.includes('manual cleanup'),
      'execute-phase.md: must include user-visible warning when worktree removal fails'
    );
  });
});

// ─── #2774: cleanup pipeline workspace safety ────────────────────────────────

describe('bug #2774 — worktree cleanup pipeline must not target the parent workspace', () => {
  describe('discovery pipeline (unit)', () => {
    test('selects only the agent worktree when workspace itself is a worktree', () => {
      // Fixture mirrors the multi-workspace setup: upstream main + sibling
      // workspace worktree + agent worktree under workspace's
      // `.claude/worktrees/agent-` namespace.
      const porcelain = [
        'worktree /Users/dev/upstream/get-shit-done',
        'HEAD abc123',
        'branch refs/heads/main',
        '',
        'worktree /Users/dev/workspaces/feature-x',
        'HEAD def456',
        'branch refs/heads/workspace/feature-x',
        '',
        'worktree /Users/dev/workspaces/feature-x/.claude/worktrees/agent-deadbeef',
        'HEAD 789abc',
        'branch refs/heads/worktree-agent-deadbeef',
        '',
      ].join('\n');

      const discovered = runDiscoveryAgainstFixture(porcelain);

      assert.deepEqual(
        discovered,
        ['/Users/dev/workspaces/feature-x/.claude/worktrees/agent-deadbeef'],
        'pipeline must select only the agent-spawned worktree, never the ' +
          'workspace or upstream main repo'
      );
    });

    test('selects nothing when no agent worktrees exist', () => {
      const porcelain = [
        'worktree /Users/dev/upstream/get-shit-done',
        'HEAD abc123',
        'branch refs/heads/main',
        '',
        'worktree /Users/dev/workspaces/feature-x',
        'HEAD def456',
        'branch refs/heads/workspace/feature-x',
        '',
      ].join('\n');

      const discovered = runDiscoveryAgainstFixture(porcelain);

      assert.deepEqual(discovered, []);
    });

    test('selects multiple agent worktrees and excludes non-agent paths', () => {
      const porcelain = [
        'worktree /repo/main',
        'HEAD a',
        'branch refs/heads/main',
        '',
        'worktree /repo/main/.claude/worktrees/agent-aaa',
        'HEAD b',
        'branch refs/heads/agent-aaa',
        '',
        'worktree /repo/main/.claude/worktrees/agent-bbb',
        'HEAD c',
        'branch refs/heads/agent-bbb',
        '',
        'worktree /repo/main/some-other-dir',
        'HEAD d',
        'branch refs/heads/feature',
        '',
      ].join('\n');

      const discovered = runDiscoveryAgainstFixture(porcelain);

      assert.deepEqual(discovered.sort(), [
        '/repo/main/.claude/worktrees/agent-aaa',
        '/repo/main/.claude/worktrees/agent-bbb',
      ]);
    });

    test('selects agent worktree even when path contains whitespace', () => {
      // Regression for CodeRabbit feedback on PR #2778: `for WT in $WORKTREES`
      // splits on whitespace and would emit broken half-paths like
      // "/Users/dev/My" and "Workspace/.claude/worktrees/agent-xyz". The
      // pipeline output itself is line-delimited and preserves the full path —
      // the workflow's loop must consume it line-by-line via `while IFS= read`.
      const porcelain = [
        'worktree /Users/dev/My Workspace',
        'HEAD def456',
        'branch refs/heads/workspace/feature-x',
        '',
        'worktree /Users/dev/My Workspace/.claude/worktrees/agent-deadbeef',
        'HEAD 789abc',
        'branch refs/heads/worktree-agent-deadbeef',
        '',
      ].join('\n');

      const discovered = runDiscoveryAgainstFixture(porcelain);

      assert.deepEqual(
        discovered,
        ['/Users/dev/My Workspace/.claude/worktrees/agent-deadbeef'],
        'pipeline output must preserve whitespace-bearing agent worktree path on a single line'
      );
    });

    test('while/read loop iterates each whitespace-bearing path exactly once',
      { skip: isWindows ? 'POSIX bash process-substitution `< <(...)` under test; not portable to cmd.exe / git-bash variance' : false },
      () => {
      // Verify the actual consumer pattern from quick.md / execute-phase.md:
      //   while IFS= read -r WT; do ...; done < <(<pipeline>)
      // Counts the lines yielded to the loop body. With the previous
      // `for WT in $WORKTREES` form, a path containing one space would yield
      // 2 iterations (broken halves). The `while/read` form yields exactly 1.
      const porcelain = [
        'worktree /tmp/has space/.claude/worktrees/agent-aaa',
        'HEAD a',
        'branch refs/heads/agent-aaa',
        '',
        'worktree /tmp/two  spaces/.claude/worktrees/agent-bbb',
        'HEAD b',
        'branch refs/heads/agent-bbb',
        '',
      ].join('\n');

      // Mirror the workflow's loop verbatim. Print one line per iteration with
      // a sentinel so we can count and inspect what the loop actually saw.
      const script = `
while IFS= read -r WT; do
  [ -z "$WT" ] && continue
  printf 'ITER:%s\\n' "$WT"
done < <(${DISCOVERY_PIPELINE})
`;
      // bash needed for process substitution `< <(...)`.
      const out = execSync(`bash -c '${script.replace(/'/g, `'\\''`)}'`, {
        input: porcelain,
        encoding: 'utf-8',
      });
      const iterations = out
        .split('\n')
        .filter((l) => l.startsWith('ITER:'))
        .map((l) => l.slice('ITER:'.length));

      assert.deepEqual(
        iterations,
        [
          '/tmp/has space/.claude/worktrees/agent-aaa',
          '/tmp/two  spaces/.claude/worktrees/agent-bbb',
        ],
        'while/read loop must yield exactly one iteration per worktree, with whitespace preserved'
      );
    });
  });

  describe('end-to-end against real git worktrees',
    { skip: isWindows ? 'POSIX shell discovery pipeline under test + Windows 8.3 short-name (RUNNER~1) vs long-name path mismatch in temp dirs' : false },
    () => {
    let upstream;
    let workspace;
    let agentWorktree;
    let workspacesParent;

    beforeEach(() => {
      // Build the multi-worktree scenario from #2774:
      //   upstream/         <- main repo
      //   workspace/        <- worktree of upstream (the "workspace")
      //   workspace/.claude/worktrees/agent-XXXX/  <- agent worktree
      upstream = makeTempUpstreamRepo('gsd-2774-upstream-');

      workspacesParent = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gsd-2774-workspaces-')
      );
      workspace = path.join(workspacesParent, 'feature-x');
      execSync(`git worktree add -b workspace/feature-x "${workspace}"`, {
        cwd: upstream,
        stdio: 'pipe',
      });

      const agentDir = path.join(workspace, '.claude', 'worktrees');
      fs.mkdirSync(agentDir, { recursive: true });
      agentWorktree = path.join(agentDir, 'agent-deadbeef');
      execSync(
        `git worktree add -b worktree-agent-deadbeef "${agentWorktree}"`,
        { cwd: upstream, stdio: 'pipe' }
      );
    });

    afterEach(() => {
      try {
        execSync('git worktree prune', { cwd: upstream, stdio: 'pipe' });
      } catch (_) {
        /* ignore */
      }
      cleanup(upstream);
      cleanup(workspacesParent);
    });

    test('discovery from inside workspace returns only the agent worktree', () => {
      const discovered = runDiscoveryAgainstRepo(workspace);

      // Resolve symlinks (macOS /var → /private/var) for stable comparison.
      const expected = fs.realpathSync(agentWorktree);
      const actual = discovered.map((p) => fs.realpathSync(p));

      assert.deepEqual(
        actual,
        [expected],
        'pipeline must list only the agent worktree, not the workspace or upstream'
      );
    });

    test('running cleanup loop on discovered paths preserves workspace .git', () => {
      const workspaceGitBefore = fs.readFileSync(
        path.join(workspace, '.git'),
        'utf-8'
      );
      assert.ok(
        fs.existsSync(path.join(upstream, '.git')),
        'precondition: upstream .git must exist'
      );

      const discovered = runDiscoveryAgainstRepo(workspace);
      assert.equal(
        discovered.length,
        1,
        'precondition: exactly one agent worktree should be discovered'
      );

      // Execute the cleanup behavior end-to-end: `git worktree remove --force`
      // each discovered path. This mirrors the workflow's cleanup loop.
      for (const wt of discovered) {
        execSync(`git worktree remove --force "${wt}"`, {
          cwd: workspace,
          stdio: 'pipe',
        });
      }

      // Agent worktree dir must be gone.
      assert.equal(
        fs.existsSync(agentWorktree),
        false,
        'agent worktree dir should be removed by cleanup'
      );

      // Workspace `.git` pointer file must still exist and be unchanged —
      // the regression we are guarding against.
      assert.ok(
        fs.existsSync(path.join(workspace, '.git')),
        'workspace .git pointer must survive cleanup (regression #2774)'
      );
      assert.equal(
        fs.readFileSync(path.join(workspace, '.git'), 'utf-8'),
        workspaceGitBefore,
        'workspace .git pointer contents must be unchanged'
      );

      // Upstream repo's .git directory must also be intact.
      assert.ok(
        fs.existsSync(path.join(upstream, '.git')),
        'upstream .git must survive cleanup'
      );

      // Workspace must still be a functional git worktree.
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspace,
        encoding: 'utf-8',
      }).trim();
      assert.equal(
        branch,
        'workspace/feature-x',
        'workspace must still be a functional worktree on its branch'
      );
    });
  });
});

