/**
 * Regression tests for #2924: worktree HEAD attaches to a protected branch
 * (master/main) so agent commits land there; the workflow then "self-recovers"
 * by force-rewinding the protected branch via `git update-ref refs/heads/master`,
 * destroying concurrent work in multi-active scenarios.
 *
 * Fixes asserted by these tests (parsed structurally — not via raw content
 * regex/includes — per project test policy):
 *
 *   1. The <worktree_branch_check> block in execute-phase.md and quick.md
 *      contains a HEAD-attachment assertion (symbolic-ref + protected-branch
 *      check) that runs BEFORE any `git reset --hard`.
 *   2. The parallel-execution prompt in execute-phase.md and execute-plan.md
 *      no longer mandates `--no-verify` as the default for worktree-mode commits.
 *   3. gsd-executor.md prohibits `git update-ref refs/heads/<protected>` as a
 *      "recovery" path and includes a pre-commit HEAD assertion in the task
 *      commit protocol.
 *   4. No workflow file in get-shit-done/workflows/ contains an unconditional
 *      `git update-ref refs/heads/master` (or main/develop/trunk) call.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
const EXECUTE_PLAN_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'execute-plan.md');
const QUICK_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'quick.md');
const EXECUTOR_AGENT_PATH = path.join(REPO_ROOT, 'agents', 'gsd-executor.md');
const GIT_INTEGRATION_PATH = path.join(REPO_ROOT, 'get-shit-done', 'references', 'git-integration.md');

/**
 * Extract the inner body of a named XML-like block (e.g. <worktree_branch_check>...</worktree_branch_check>)
 * from a markdown document. Returns null when not found.
 */
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
