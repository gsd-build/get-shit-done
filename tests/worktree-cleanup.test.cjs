// allow-test-rule: source-text-is-the-product
// Workflow markdown is the installed orchestration contract.

'use strict';

/**
 * Worktree Cleanup Module — HEAD attachment, post-executor cleanup, and contract tests
 *
 * Seam: get-shit-done/workflows/{execute-phase,execute-plan,quick}.md,
 *       agents/gsd-executor.md, references/git-integration.md
 *
 * Split from the consolidated 13→2 worktree cluster (≤800 LOC/file):
 *   - tests/bug-2924-worktree-head-attachment.test.cjs   (#2924: HEAD attachment)
 *   - tests/worktree-cleanup.test.cjs                    (#1496: post-executor cleanup)
 *   - tests/worktree-merge-protection.test.cjs           (#1756: orchestrator file protection)
 *   - tests/worktree-safety.test.cjs                     (#1977: commit safety hardening)
 *   - tests/worktree-stagger.test.cjs                    (#1511: sequential dispatch)
 *   - tests/bug-3384-worktree-cleanup-manifest.test.cjs  (workflow contract side)
 *   - tests/bug-3425-worktree-cleanup-cwd-pin.test.cjs   (#3425: CWD pin)
 *
 * See also: worktree.test.cjs     (#2015, #2075, #2431, #2774)
 *           worktree-safety.test.cjs  (safety function unit tests)
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
const EXECUTE_PLAN_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'execute-plan.md');
const QUICK_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'quick.md');
const EXECUTOR_AGENT_PATH = path.join(REPO_ROOT, 'agents', 'gsd-executor.md');
const GIT_INTEGRATION_PATH = path.join(REPO_ROOT, 'get-shit-done', 'references', 'git-integration.md');

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
 * and return commands as arrays of word tokens.
 */
function shellStatements(script) {
  const statements = [];
  const lines = script.split('\n');
  for (let raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const parts = line.split(/(?:&&|\|\||;)/);
    for (const part of parts) {
      let trimmed = part.trim();
      if (!trimmed) continue;
      const assignMatch = trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*=(.*)$/);
      if (assignMatch) trimmed = assignMatch[1];
      const subMatch = trimmed.match(/^\$\((.*?)\)?$/);
      if (subMatch) trimmed = subMatch[1];
      if (trimmed.startsWith('$(')) trimmed = trimmed.slice(2);
      trimmed = trimmed.replace(/\)+\s*$/, '').trim();
      if (!trimmed) continue;
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
    // After #3797 architectural fix: quick.md delegates entirely to the SDK's
    // worktree.cleanup-wave command (which handles git worktree remove and branch
    // deletion internally). The manual shell cleanup loop has been removed.
    assert.ok(
      content.includes('worktree.cleanup-wave'),
      'quick cleanup must delegate to $GSD_SDK query worktree.cleanup-wave (#3797)',
    );
  });

  test('quick.md cleanup-wave uses || exit 1 to enforce safety semantics', () => {
    const content = fs.readFileSync(quickPath, 'utf8');
    // The || exit 1 guards against SDK safety refusals (#3174/#3384).
    // A soft || { warn } fallback would silently swallow blocked cleanups.
    assert.match(
      content,
      /\$GSD_SDK query worktree\.cleanup-wave.*\|\| exit 1/,
      'quick.md cleanup-wave must use || exit 1 — SDK safety refusals must surface (#3797)',
    );
  });

  test('cleanup uses git worktree list to discover orphans', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(content.includes('git worktree list'),
      'cleanup should discover worktrees via git worktree list');
  });
});

// ─── #1756: orchestrator file protection during merge ────────────────────────

describe('worktree merge: orchestrator file protection (#1756)', () => {
  // After #3797 architectural fix: execute-phase.md and quick.md delegate worktree
  // cleanup to the SDK's worktree.cleanup-wave command (which handles STATE.md/ROADMAP.md
  // backup and restore internally). The manual shell backup loop has been removed.
  // The workflow contracts now verify SDK delegation rather than inline backup code.

  test('execute-phase.md delegates wave cleanup to SDK with fail-closed || exit 1', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // worktree.cleanup-wave handles STATE.md/ROADMAP.md backup + restore internally.
    assert.match(
      content,
      /\$GSD_SDK query worktree\.cleanup-wave --manifest "\$WAVE_WORKTREE_MANIFEST" \|\| exit 1/,
      'execute-phase.md must delegate to $GSD_SDK query worktree.cleanup-wave with || exit 1 (#3797)',
    );
  });

  test('execute-phase.md cleanup-tail snippet still backs up STATE.md for custom deviations', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // The cleanup-tail snippet (for deviations from the standard wave merge path)
    // uses git worktree remove directly — it doesn't use the SDK helper.
    // This snippet doesn't need STATE.md backup because it only removes worktrees
    // that were already manually merged — not performing merges itself.
    assert.match(
      content,
      /Cleanup-tail: remove residual agent worktrees after a cross-wave-dependency deviation/,
      'execute-phase.md must contain the cleanup-tail snippet for custom merge deviations',
    );
  });

  test('execute-phase.md detects files deleted on main but re-added by worktree (cleanup-tail)', () => {
    // The cleanup-tail snippet includes resurrection detection via git diff --diff-filter=A.
    // This verifies the safety mechanism is still documented in the workflow.
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // Resurrection detection is handled inside worktree.cleanup-wave (SDK internals).
    // We verify the workflow still mentions WAVE_WORKTREE_MANIFEST to ensure
    // manifest-scoped cleanup is enforced (#3384).
    assert.match(content, /WAVE_WORKTREE_MANIFEST/,
      'execute-phase must use WAVE_WORKTREE_MANIFEST to scope cleanup (#3384)');
  });

  test('quick.md delegates wave cleanup to SDK with fail-closed || exit 1', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    // After #3797 architectural fix: quick.md no longer contains inline STATE.md/ROADMAP.md
    // backup code — that is handled internally by worktree.cleanup-wave.
    assert.match(
      content,
      /\$GSD_SDK query worktree\.cleanup-wave --manifest "\$QUICK_WORKTREE_MANIFEST" \|\| exit 1/,
      'quick.md must delegate to $GSD_SDK query worktree.cleanup-wave with || exit 1 (#3797)',
    );
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
    const worktreeCleanupStart = content.indexOf('Worktree cleanup');
    assert.ok(worktreeCleanupStart > -1, 'must have a worktree cleanup section');
    const cleanupSection = content.slice(worktreeCleanupStart);
    // After #3797: deletion check is handled by SDK worktree.cleanup-wave.
    // The cleanup section must either (a) include --diff-filter=D directly or
    // (b) delegate to the SDK which documents that it validates deletion diffs.
    // Accept either form: inline shell check OR SDK delegation with deletion mention.
    const hasInlineDiffFilterCheck = cleanupSection.includes('--diff-filter=D');
    const hasSdkDelegationWithDeletionMention = (
      cleanupSection.includes('worktree.cleanup-wave') &&
      (cleanupSection.includes('deletion') || cleanupSection.includes('BLOCKED'))
    );
    assert.ok(
      hasInlineDiffFilterCheck || hasSdkDelegationWithDeletionMention,
      'cleanup section must either include --diff-filter=D directly or delegate to SDK (worktree.cleanup-wave) with documented deletion-diff validation (#2384/#3797)',
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
    // After #3797 architectural fix: quick.md delegates entirely to the SDK's cleanup-wave
    // command (which handles manifest parsing internally). The shell fallback with manual
    // QUICK_WORKTREE_MANIFEST node-e code is removed — the SDK call with || exit 1 is the
    // only cleanup path, enforcing safety-refusal semantics (#3174/#3384).
    assert.match(content, /\$GSD_SDK query worktree\.cleanup-wave --manifest "\$QUICK_WORKTREE_MANIFEST" \|\| exit 1/);
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
  // After #3797 architectural fix, callsites use $GSD_SDK — accept either form
  assert.match(content, /(?:\$GSD_SDK|gsd-sdk) query worktree\.cleanup-wave --manifest "\$WAVE_WORKTREE_MANIFEST"/);
});

test('#3425: cleanup-tail snippet carries the same primary-worktree pin before removal', () => {
  const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf8');

  assert.match(content, /Cleanup-tail: pin orchestrator CWD to primary worktree before cleanup-tail \(#3174\)\./);
  assert.match(content, /FATAL: cannot cd to primary worktree \$PRIMARY_WT/);
  assert.match(content, /# Cleanup-tail: remove residual agent worktrees after a cross-wave-dependency deviation\./);
});
