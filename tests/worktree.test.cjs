// allow-test-rule: source-text-is-the-product
// Workflow markdown is the installed orchestration contract.

'use strict';

/**
 * Worktree Lifecycle Module — workflow contract tests
 *
 * Seam: get-shit-done/workflows/{execute-phase,execute-plan,quick}.md,
 *       agents/gsd-executor.md, references/git-integration.md
 *
 * Consolidated from (13 cluster files → 2):
 *   - tests/bug-2015-worktree-base-branch.test.cjs      (#2015: reset --hard)
 *   - tests/bug-2075-worktree-deletion-safeguards.test.cjs (#2075: git clean prohibition)
 *   - tests/bug-2431-worktree-locked-surfacing.test.cjs  (#2431: locked-worktree errors)
 *   - tests/bug-2774-worktree-cleanup-workspace-safety.test.cjs (#2774: discovery pipeline)
 *   - tests/bug-2924-worktree-head-attachment.test.cjs   (#2924: HEAD attachment)
 *   - tests/bug-3384-worktree-cleanup-manifest.test.cjs  (workflow contract side)
 *   - tests/bug-3425-worktree-cleanup-cwd-pin.test.cjs   (#3425: CWD pin)
 *   - tests/worktree-cleanup.test.cjs                    (#1496: post-executor cleanup)
 *   - tests/worktree-merge-protection.test.cjs           (#1756: orchestrator file protection)
 *   - tests/worktree-safety.test.cjs                     (#1977: commit safety hardening)
 *   - tests/worktree-stagger.test.cjs                    (#1511: sequential dispatch)
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

// ─── #2924: HEAD attachment + destructive recovery ──────────────────────────

describe('bug #2924: worktree HEAD attachment + destructive recovery', () => {
  describe('execute-phase.md worktree_branch_check', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    const block = extractNamedBlock(content, 'worktree_branch_check');

    test('block exists', () => {
      assert.ok(block, 'execute-phase.md must contain a <worktree_branch_check> block');
    });

    test('block invokes `git symbolic-ref` to inspect HEAD attachment', () => {
      const codeBlocks = extractFencedCodeBlocks(block);
      const allStatements = codeBlocks.flatMap(({ body }) => shellStatements(body));
      const idx = findCommandIndex(allStatements, (cmd) =>
        cmd[0] === 'git' && cmd[1] === 'symbolic-ref' && cmd.includes('HEAD')
      );
      assert.notStrictEqual(
        idx, -1,
        'worktree_branch_check must run `git symbolic-ref ... HEAD` to verify HEAD attachment before any reset'
      );
    });

    test('HEAD-attachment assertion runs BEFORE `git reset --hard`', () => {
      const codeBlocks = extractFencedCodeBlocks(block);
      const allStatements = codeBlocks.flatMap(({ body }) => shellStatements(body));
      const symbolicRefIdx = findCommandIndex(allStatements, (cmd) =>
        cmd[0] === 'git' && cmd[1] === 'symbolic-ref' && cmd.includes('HEAD')
      );
      const resetHardIdx = findCommandIndex(allStatements, (cmd) =>
        cmd[0] === 'git' && cmd[1] === 'reset' && cmd.includes('--hard')
      );
      assert.notStrictEqual(symbolicRefIdx, -1, 'symbolic-ref check must exist');
      assert.notStrictEqual(resetHardIdx, -1, 'reset --hard must exist');
      assert.ok(
        symbolicRefIdx < resetHardIdx,
        'HEAD attachment assertion (symbolic-ref) must precede `git reset --hard` so a stale HEAD never moves a protected branch'
      );
    });

    test('block names protected branches that must NOT be the agent branch', () => {
      // The protected-branch list must be enforced by name. Parse it out of the
      // shell scripts and verify required names are present.
      const codeBlocks = extractFencedCodeBlocks(block);
      const scripts = codeBlocks.map(({ body }) => body).join('\n');
      // Look for an assignment whose value is a regex/list naming protected refs.
      // Acceptable forms: PROTECTED_BRANCHES_RE='...' or grep -Eq '^(main|...)$'
      // Parse the alternation list out of the grep -E pattern so we assert
      // structurally on the protected-branch enumeration rather than via
      // raw substring matching (release/* contains regex-special chars and
      // can't be safely tested with `\b...\b`).
      const altMatch = scripts.match(/grep\s+-Eq?\s+'\^\(([^)]+)\)\$'/);
      assert.ok(
        altMatch,
        'worktree_branch_check must contain a `grep -Eq` protected-branch alternation pattern'
      );
      const branches = altMatch[1].split('|').map((b) => b.trim());
      const required = ['main', 'master', 'develop', 'trunk', 'release/.*'];
      for (const name of required) {
        assert.ok(
          branches.includes(name),
          `worktree_branch_check protected-branch alternation must include '${name}' (found: ${branches.join(', ')})`
        );
      }
    });

    test('block enforces positive worktree-agent-* allow-list (#2924 hardening)', () => {
      const codeBlocks = extractFencedCodeBlocks(block);
      const scripts = codeBlocks.map(({ body }) => body).join('\n');
      // Allow-list must reference the canonical Claude Code worktree-agent-<id>
      // namespace via a regex assertion (grep -Eq '^worktree-agent-...').
      const allowListRe = /grep\s+-Eq?\s+'\^worktree-agent-/;
      assert.ok(
        allowListRe.test(scripts),
        'worktree_branch_check must enforce a positive allow-list matching ^worktree-agent-* (#2924 hardening)'
      );
    });

    test('block forbids `git update-ref` self-recovery in its guidance text', () => {
      // The forbidding statement is documentation text, not a shell command,
      // so structural shell parsing does not apply. Verify the prohibition
      // appears as standalone guidance somewhere in the block.
      assert.ok(
        block.includes('update-ref'),
        'worktree_branch_check must explicitly forbid `git update-ref` self-recovery'
      );
    });
  });

  describe('execute-phase.md no longer defaults to --no-verify in parallel mode', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    const block = extractNamedBlock(content, 'parallel_execution');

    test('parallel_execution block exists', () => {
      assert.ok(block, 'execute-phase.md must contain a <parallel_execution> block');
    });

    test('parallel_execution does NOT instruct agents to use --no-verify by default', () => {
      // Tokenize the block as plain words and look for an unconditional
      // imperative naming `--no-verify`. The acceptable presence is in a
      // negated/opt-out context (e.g. "Do NOT pass --no-verify"); reject
      // any sentence whose first verb is "Use --no-verify".
      const sentences = block
        .replace(/\n+/g, ' ')
        .split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (!sentence.includes('--no-verify')) continue;
        const lower = sentence.toLowerCase();
        const isProhibition =
          /\b(do not|don't|never|no longer)\b/.test(lower) ||
          /\bopt[\s-]?out\b/.test(lower) ||
          /\bopt[\s-]?in\b/.test(lower) ||
          /\bif\b/.test(lower);
        assert.ok(
          isProhibition,
          `parallel_execution sentence appears to mandate --no-verify by default: "${sentence.trim()}"`
        );
      }
    });
  });

  describe('execute-plan.md no longer mandates --no-verify for parallel executor', () => {
    const content = fs.readFileSync(EXECUTE_PLAN_PATH, 'utf-8');
    const block = extractNamedBlock(content, 'precommit_failure_handling');
    test('precommit_failure_handling block exists', () => {
      assert.ok(block, 'execute-plan.md must contain a <precommit_failure_handling> block');
    });

    test('parallel-executor sub-section does not unconditionally mandate --no-verify', () => {
      // Locate the parallel-executor sub-section heading and parse the
      // sentences under it.
      const headingIdx = block.indexOf('parallel executor');
      assert.notStrictEqual(headingIdx, -1, 'must contain a parallel-executor sub-section');
      const endIdx = block.indexOf('**If running as the sole', headingIdx);
      assert.notStrictEqual(endIdx, -1, 'parallel-executor sub-section terminator must exist');
      const subBlock = block.slice(headingIdx, endIdx);
      assert.ok(subBlock.length > 0, 'sub-section must have content');
      const sentences = subBlock.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (!sentence.includes('--no-verify')) continue;
        const lower = sentence.toLowerCase();
        const isProhibition =
          /\b(do not|don't|never|no longer)\b/.test(lower) ||
          /\bopt[\s-]?out\b/.test(lower) ||
          /\bopt[\s-]?in\b/.test(lower) ||
          /\bif\b/.test(lower);
        assert.ok(
          isProhibition,
          `parallel-executor guidance sentence appears to mandate --no-verify: "${sentence.trim()}"`
        );
      }
    });
  });

  describe('quick.md worktree_branch_check', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const block = extractNamedBlock(content, 'worktree_branch_check');

    test('block exists', () => {
      assert.ok(block, 'quick.md must contain a <worktree_branch_check> block');
    });

    test('block references `git symbolic-ref` for HEAD attachment assertion', () => {
      // quick.md uses inline `git symbolic-ref ... HEAD` rather than a fenced
      // block, so search the block as a token stream of statements.
      const statements = shellStatements(block);
      const idx = findCommandIndex(statements, (cmd) =>
        cmd[0] === 'git' && cmd[1] === 'symbolic-ref' && cmd.includes('HEAD')
      );
      assert.notStrictEqual(
        idx, -1,
        'quick.md worktree_branch_check must run `git symbolic-ref ... HEAD`'
      );
    });

    test('HEAD assertion precedes `git reset --hard`', () => {
      const symbolicRefByteIdx = block.indexOf('symbolic-ref');
      const resetHardByteIdx = block.indexOf('reset --hard');
      assert.notStrictEqual(symbolicRefByteIdx, -1);
      assert.notStrictEqual(resetHardByteIdx, -1);
      assert.ok(
        symbolicRefByteIdx < resetHardByteIdx,
        'symbolic-ref HEAD assertion must appear before `git reset --hard` in quick.md worktree_branch_check'
      );
    });

    test('block forbids `git update-ref` self-recovery', () => {
      assert.ok(
        block.includes('update-ref'),
        'quick.md worktree_branch_check must explicitly forbid `git update-ref` self-recovery'
      );
    });

    test('block enforces positive worktree-agent-* allow-list (#2924 hardening)', () => {
      const allowListRe = /grep\s+-Eq?\s+'\^worktree-agent-/;
      assert.ok(
        allowListRe.test(block),
        'quick.md worktree_branch_check must enforce a positive allow-list matching ^worktree-agent-* (#2924 hardening)'
      );
    });
  });

  describe('quick.md pre-dispatch plan commit no longer hard-codes --no-verify', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const codeBlocks = extractFencedCodeBlocks(content);
    // Find the bash block containing the pre-dispatch plan commit
    const target = codeBlocks.find(({ body }) =>
      body.includes('pre-dispatch plan') && body.includes('git commit')
    );
    test('pre-dispatch plan commit block exists', () => {
      assert.ok(target, 'quick.md must contain the pre-dispatch plan commit block');
    });

    test('pre-dispatch plan commit gates --no-verify behind a config flag', () => {
      // The block must contain BOTH a `git commit` without --no-verify AND
      // gate any --no-verify variant inside an `if` block reading a config
      // value (workflow.worktree_skip_hooks).
      const statements = shellStatements(target.body);
      const noVerifyCommits = statements.filter((cmd) =>
        cmd[0] === 'git' && cmd[1] === 'commit' && cmd.includes('--no-verify')
      );
      const cleanCommits = statements.filter((cmd) =>
        cmd[0] === 'git' && cmd[1] === 'commit' && !cmd.includes('--no-verify')
      );
      assert.ok(
        cleanCommits.length >= 1,
        'must include at least one `git commit` without --no-verify (default path)'
      );
      // If --no-verify still appears, the block must reference the opt-in flag.
      if (noVerifyCommits.length > 0) {
        assert.ok(
          target.body.includes('worktree_skip_hooks'),
          '--no-verify commits must be gated behind workflow.worktree_skip_hooks config flag'
        );
      }
    });
  });

  describe('gsd-executor.md prohibits update-ref self-recovery', () => {
    const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');
    const block = extractNamedBlock(content, 'destructive_git_prohibition');

    test('destructive_git_prohibition block exists', () => {
      assert.ok(block, 'gsd-executor.md must contain a <destructive_git_prohibition> block');
    });

    test('block prohibits `git update-ref refs/heads/<protected>`', () => {
      assert.ok(
        block.includes('update-ref'),
        'destructive_git_prohibition must enumerate `git update-ref` as a prohibited command'
      );
      assert.ok(
        block.includes('protected') || block.includes('main') || block.includes('master'),
        'destructive_git_prohibition must call out protected branches in the update-ref prohibition'
      );
    });

    test('block references issue #2924', () => {
      assert.ok(
        block.includes('#2924'),
        'destructive_git_prohibition should cite #2924 as the source of the update-ref prohibition'
      );
    });
  });

  describe('gsd-executor.md task_commit_protocol enforces worktree-agent-* allow-list', () => {
    const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');
    const block = extractNamedBlock(content, 'task_commit_protocol');

    test('task_commit_protocol block exists', () => {
      assert.ok(block, 'gsd-executor.md must contain a <task_commit_protocol> block');
    });

    test('step 0 enforces positive worktree-agent-* allow-list (#2924 hardening)', () => {
      const codeBlocks = extractFencedCodeBlocks(block);
      const scripts = codeBlocks.map(({ body }) => body).join('\n');
      const allowListRe = /grep\s+-Eq?\s+'\^worktree-agent-/;
      assert.ok(
        allowListRe.test(scripts),
        'task_commit_protocol step 0 must enforce a positive allow-list matching ^worktree-agent-* in addition to the protected-ref deny-list (#2924 hardening)'
      );
    });
  });

  describe('no workflow file performs unconditional update-ref on a protected branch', () => {
    const workflowsDir = path.join(REPO_ROOT, 'get-shit-done', 'workflows');
    const workflowFiles = fs
      .readdirSync(workflowsDir, { recursive: true })
      .filter((f) => typeof f === 'string' && f.endsWith('.md'))
      .map((f) => path.join(workflowsDir, f));

    for (const filePath of workflowFiles) {
      test(`${path.basename(filePath)} contains no update-ref of a protected ref`, () => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const blocks = extractFencedCodeBlocks(content);
        for (const { body } of blocks) {
          const statements = shellStatements(body);
          for (const cmd of statements) {
            if (cmd[0] !== 'git') continue;
            if (cmd[1] !== 'update-ref') continue;
            // Reject any update-ref that targets a protected ref.
            const target = cmd[2] || '';
            const protectedRe = /^refs\/heads\/(main|master|develop|trunk|release\/.+)$/;
            assert.ok(
              !protectedRe.test(target),
              `${path.basename(filePath)} contains forbidden 'git update-ref ${target}' (#2924)`
            );
          }
        }
      });
    }
  });

  describe('git-integration.md guidance reflects new default', () => {
    const content = fs.readFileSync(GIT_INTEGRATION_PATH, 'utf-8');
    test('parallel-agents guidance no longer mandates --no-verify', () => {
      // Find the parallel-agents callout and parse its sentences.
      const idx = content.indexOf('Parallel agents');
      assert.notStrictEqual(idx, -1, 'must contain a "Parallel agents" callout');
      const section = content.slice(idx);
      const endMatch = section.slice(1).match(/\n#{1,6}\s/);
      assert.ok(endMatch, 'Parallel agents section must terminate at the next heading');
      const tail = section.slice(0, 1 + endMatch.index);
      const sentences = tail.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (!sentence.includes('--no-verify')) continue;
        const lower = sentence.toLowerCase();
        const isProhibition =
          /\b(do not|don't|never|no longer)\b/.test(lower) ||
          /\bopt[\s-]?out\b/.test(lower) ||
          /\bopt[\s-]?in\b/.test(lower) ||
          /\bif\b/.test(lower);
        assert.ok(
          isProhibition,
          `git-integration.md "Parallel agents" sentence appears to mandate --no-verify: "${sentence.trim()}"`
        );
      }
    });
  });
});

// ─── #1496: post-executor worktree cleanup ──────────────────────────────────

describe('worktree cleanup after executor completes (#1496)', () => {
  const executePhasePath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
  const quickPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

  test('execute-phase.md includes worktree cleanup step', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(content.includes('Worktree cleanup'),
      'execute-phase should have a worktree cleanup step');
    assert.ok(content.includes('git worktree remove'),
      'cleanup should remove worktrees');
    assert.ok(content.includes('git branch -D'),
      'cleanup should delete temporary branches');
  });

  test('execute-phase.md merges worktree branch before removing', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(content.includes('git merge'),
      'cleanup should merge worktree branch into current branch');
  });

  test('execute-phase.md handles merge conflicts gracefully', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(
      content.includes('Merge conflict') || content.includes('merge conflict'),
      'cleanup should handle merge conflicts gracefully'
    );
  });

  test('execute-phase.md skips cleanup when use_worktrees is false', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(content.includes('use_worktrees'),
      'cleanup should respect workflow.use_worktrees config');
  });

  test('quick.md includes worktree cleanup after executor returns', () => {
    const content = fs.readFileSync(quickPath, 'utf8');
    assert.ok(content.includes('Worktree cleanup') || content.includes('worktree cleanup'),
      'quick should have worktree cleanup');
    assert.ok(content.includes('git worktree remove'),
      'quick cleanup should remove worktrees');
    assert.ok(content.includes('git branch -D'),
      'quick cleanup should delete temporary branches');
  });

  test('quick.md merges worktree branch before removing', () => {
    const content = fs.readFileSync(quickPath, 'utf8');
    assert.ok(content.includes('git merge'),
      'quick cleanup should merge worktree branch');
  });

  test('cleanup uses git worktree list to discover orphans', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(content.includes('git worktree list'),
      'cleanup should discover worktrees via git worktree list');
  });
});

// ─── #1756: orchestrator file protection during merge ────────────────────────

describe('worktree merge: orchestrator file protection (#1756)', () => {
  test('execute-phase.md backs up STATE.md before worktree merge', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // The workflow must snapshot STATE.md from main before merging
    // to prevent stale worktree content from overwriting it
    const mergeIdx = content.indexOf('git merge');
    assert.ok(mergeIdx > -1, 'workflow should contain git merge');

    // Look for STATE.md backup/snapshot before the merge command
    const hasStateBackup = (
      content.includes('STATE.md') &&
      (content.includes('git show HEAD:.planning/STATE.md') ||
       content.includes('state-backup') ||
       content.includes('STATE_BACKUP'))
    );
    assert.ok(hasStateBackup,
      'execute-phase must backup STATE.md before worktree merge to prevent stale overwrite');
  });

  test('execute-phase.md backs up ROADMAP.md before worktree merge', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    const hasRoadmapBackup = (
      content.includes('ROADMAP.md') &&
      (content.includes('git show HEAD:.planning/ROADMAP.md') ||
       content.includes('roadmap-backup') ||
       content.includes('ROADMAP_BACKUP'))
    );
    assert.ok(hasRoadmapBackup,
      'execute-phase must backup ROADMAP.md before worktree merge to prevent stale overwrite');
  });

  test('execute-phase.md restores orchestrator files after worktree merge', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    // After merge, orchestrator files must be restored from backup
    const mergeIdx = content.indexOf('git merge');
    const restoreSection = content.slice(mergeIdx);

    const hasRestore = (
      restoreSection.includes('cp ') ||
      restoreSection.includes('git checkout HEAD') ||
      restoreSection.includes('restore') ||
      restoreSection.includes('BACKUP')
    );
    assert.ok(hasRestore,
      'execute-phase must restore orchestrator files after merge (main always wins)');
  });

  test('execute-phase.md detects files deleted on main but re-added by worktree', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    // The merge step should detect and remove resurrected files
    // (e.g., archived phase directories that main deleted)
    const hasResurrectionDetection = (
      content.includes('git diff') && content.includes('--diff-filter') ||
      content.includes('resurrect') ||
      content.includes('re-added') ||
      content.includes('deleted on main') ||
      content.includes('DELETED_FILES') ||
      content.includes('PRE_MERGE_FILES')
    );
    assert.ok(hasResurrectionDetection,
      'execute-phase must detect and remove files that main deleted but worktree re-added');
  });

  test('quick.md has the same orchestrator file protection', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');

    const hasProtection = (
      (content.includes('git show HEAD:.planning/STATE.md') ||
       content.includes('state-backup') ||
       content.includes('STATE_BACKUP')) &&
      (content.includes('git show HEAD:.planning/ROADMAP.md') ||
       content.includes('roadmap-backup') ||
       content.includes('ROADMAP_BACKUP'))
    );
    assert.ok(hasProtection,
      'quick.md must also protect orchestrator files during worktree merge');
  });
});

// ─── #1977: commit safety hardening ─────────────────────────────────────────

describe('worktree commit safety hardening (#1977)', () => {
  test('execute-plan worktree_branch_check has no Windows-only platform qualifier', () => {
    const content = fs.readFileSync(EXECUTE_PLAN_PATH, 'utf-8');
    assert.ok(content.includes('worktree_branch_check'), 'execute-plan.md must contain a worktree_branch_check block');
    const hasWindowsOnlyQualifier = (
      /Windows.only/i.test(content) ||
      /affects Windows only/i.test(content) ||
      /only on Windows/i.test(content) ||
      /Windows-specific/i.test(content)
    );
    assert.ok(!hasWindowsOnlyQualifier, 'worktree_branch_check must not be labeled as Windows-only');
    const isUniversal = (
      /affects all platforms/i.test(content) ||
      /all platforms/i.test(content) ||
      /cross.platform/i.test(content)
    );
    assert.ok(isUniversal, 'worktree_branch_check description must indicate the fix applies to all platforms');
  });

  test('gsd-executor.md task_commit_protocol includes post-commit deletion verification', () => {
    const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');
    assert.ok(content.includes('--diff-filter=D'), 'must include --diff-filter=D deletion verification');
    assert.ok(
      content.includes('WARNING') || content.includes('DELETIONS'),
      'must warn when a commit includes file deletions'
    );
  });

  test('execute-phase.md worktree merge section includes pre-merge deletion check', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    const mergeIdx = content.indexOf('git merge');
    assert.ok(mergeIdx > -1, 'must contain a git merge operation');
    const worktreeCleanupStart = content.indexOf('Worktree cleanup');
    assert.ok(worktreeCleanupStart > -1, 'must have a worktree cleanup section');
    const cleanupSection = content.slice(worktreeCleanupStart);
    assert.ok(cleanupSection.includes('--diff-filter=D'), 'must include --diff-filter=D to check for deletions before merge');
    const deletionCheckIdx = cleanupSection.indexOf('--diff-filter=D');
    const gitMergeIdx = cleanupSection.indexOf('git merge');
    assert.ok(deletionCheckIdx < gitMergeIdx, 'deletion check must appear before git merge');
    assert.ok(
      cleanupSection.includes('BLOCKED') || cleanupSection.includes('DELETIONS') || cleanupSection.includes('deletion'),
      'must warn or block when the worktree branch contains file deletions'
    );
  });
});


// ─── #1511: sequential dispatch ─────────────────────────────────────────────

describe('worktree sequential dispatch', () => {
  test('execute-phase.md exists', () => {
    assert.ok(fs.existsSync(EXECUTE_PHASE_PATH), 'execute-phase.md should exist');
  });

  test('execute-phase explains git config.lock contention', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    assert.ok(content.includes('config.lock'), 'should explain the git config.lock race condition');
  });

  test('execute-phase requires sequential dispatch with run_in_background', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    assert.ok(content.includes('run_in_background'), 'should instruct one-at-a-time dispatch with run_in_background');
  });

  test('execute-phase warns against multiple Task calls in single message', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    assert.ok(
      content.includes('WRONG') && content.includes('single message'),
      'should warn against sending multiple Task() calls simultaneously'
    );
  });
});


// ─── #3384: cleanup manifest workflow contracts ──────────────────────────────

describe('bug #3384: worktree cleanup workflow contracts', () => {
    test('execute-phase contract requires a cleanup manifest instead of global worktree discovery', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf8');
    assert.match(content, /WAVE_WORKTREE_MANIFEST/);
    assert.match(content, /worktree\.cleanup-wave/);
    assert.match(content, /atomically append `\{agent_id, worktree_path, branch, expected_base\}`/);
    assert.match(content, /try\{if\(!p\)throw new Error\("WAVE_WORKTREE_MANIFEST is unset"\)/);
    assert.match(content, /WT_PATHS_FILE=.*gsd-worktree-paths-/);
    assert.doesNotMatch(content, /done < <\(node -e 'const fs=require\("fs"\);const p=process\.env\.WAVE_WORKTREE_MANIFEST/);
    assert.doesNotMatch(content, /done < <\(git worktree list --porcelain \| grep "\^worktree " \| grep "\\\.claude\/worktrees\/agent-"/);
  });

  test('quick contract requires a cleanup manifest instead of global worktree discovery', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf8');
    assert.match(content, /WAVE_WORKTREE_MANIFEST|QUICK_WORKTREE_MANIFEST/);
    assert.match(content, /worktree\.cleanup-wave/);
    assert.match(content, /mktemp "\$\{TMPDIR:-\/tmp\}\/gsd-quick-worktree-/);
    assert.match(content, /append its returned `\{agent_id, worktree_path, branch, expected_base\}`/);
    assert.match(content, /try\{if\(!p\)throw new Error\("QUICK_WORKTREE_MANIFEST is unset"\)/);
    assert.match(content, /WT_PATHS_FILE=.*gsd-worktree-paths-/);
    assert.doesNotMatch(content, /done < <\(node -e 'const fs=require\("fs"\);const p=process\.env\.QUICK_WORKTREE_MANIFEST/);
    assert.doesNotMatch(content, /done < <\(git worktree list --porcelain \| grep "\^worktree " \| grep "\\\.claude\/worktrees\/agent-"/);
  });
});


// ─── #3425: CWD pin before cleanup ──────────────────────────────────────────

test('#3425: helper cleanup path pins orchestrator CWD to primary worktree and checks EXPECTED_BRANCH', () => {
  const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf8');

  assert.match(content, /PRIMARY_WT=\$\(git worktree list --porcelain \| awk '\/\^worktree \/\{print substr\(\$0,10\); exit\}'\)/);
  assert.match(content, /if \[ -z "\$PRIMARY_WT" \]; then\s+echo "FATAL: could not resolve primary worktree before cleanup" >&2\s+exit 1\s+fi/);
  assert.match(content, /cd "\$PRIMARY_WT" \|\| \{ echo "FATAL: cannot cd to primary worktree \$PRIMARY_WT" >&2; exit 1; \}/);
  assert.match(content, /ORCH_BRANCH=\$\(git rev-parse --abbrev-ref HEAD\)/);
  assert.match(content, /FATAL: orchestrator on '\$ORCH_BRANCH' but expected '\$EXPECTED_BRANCH' before worktree cleanup — refusing to merge \(#3174-class drift\)/);
  assert.match(content, /gsd-sdk query worktree\.cleanup-wave --manifest "\$WAVE_WORKTREE_MANIFEST" \|\| exit 1/);
});

test('#3425: cleanup-tail snippet carries the same primary-worktree pin before removal', () => {
  const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf8');

  assert.match(content, /Cleanup-tail: pin orchestrator CWD to primary worktree before cleanup-tail \(#3174\)\./);
  assert.match(content, /FATAL: cannot cd to primary worktree \$PRIMARY_WT/);
  assert.match(content, /# Cleanup-tail: remove residual agent worktrees after a cross-wave-dependency deviation\./);
});
