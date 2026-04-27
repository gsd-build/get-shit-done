/**
 * Bug #2774 — Worktree cleanup destroys parent workspace .git
 *
 * The cleanup blocks in execute-phase.md and quick.md previously used an
 * EXCLUSION-based filter:
 *
 *   git worktree list --porcelain | grep "^worktree " | grep -v "$(pwd)$" | sed ...
 *
 * That filter only excludes the literal `$(pwd)`. When a GSD project is itself
 * a git worktree of an upstream main repo (the multi-workspace case, including
 * the cross-drive Windows case where `git worktree list` reports the registry
 * path as e.g. `E:/...` while `$(pwd)` resolves to `C:/...`), every other
 * worktree — including the workspace itself — is wiped, taking the
 * workspace's `.git` pointer file with it.
 *
 * The fix is INCLUSION-based: only target paths matching the agent worktree
 * convention (`.claude/worktrees/agent-`), the namespace under which Claude
 * Code's `isolation="worktree"` always creates executor worktrees.
 *
 * These tests assert the cleanup block in BOTH workflow files:
 *   1. Includes only paths matching `.claude/worktrees/agent-` (positive filter)
 *   2. Does NOT rely on `grep -v "$(pwd)$"` as the sole guard (negative filter)
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');
const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

/**
 * Extract the WORKTREES=... discovery line from a workflow file.
 * Returns the first matching line of shell that assigns the WORKTREES variable
 * via `git worktree list`.
 */
function extractWorktreeDiscoveryLine(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('WORKTREES=') && line.includes('git worktree list')) {
      return line;
    }
  }
  return null;
}

describe('bug #2774 — worktree cleanup must not target the parent workspace', () => {
  test('quick.md uses inclusion-based agent worktree filter', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf8');
    const line = extractWorktreeDiscoveryLine(content);

    assert.ok(line, 'quick.md must contain a WORKTREES discovery line backed by git worktree list');

    assert.ok(
      line.includes('.claude/worktrees/agent-'),
      `quick.md WORKTREES discovery must include only agent-spawned worktrees ` +
        `(matching '.claude/worktrees/agent-' prefix), got: ${line}`
    );

    assert.ok(
      !/grep\s+-v\s+["']?\$\(pwd\)\$/.test(line),
      `quick.md WORKTREES discovery must not rely on 'grep -v "$(pwd)$"' as the ` +
        `sole guard — that exclusion fails when the workspace itself is a worktree, ` +
        `got: ${line}`
    );
  });

  test('execute-phase.md uses inclusion-based agent worktree filter', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf8');
    const line = extractWorktreeDiscoveryLine(content);

    assert.ok(line, 'execute-phase.md must contain a WORKTREES discovery line backed by git worktree list');

    assert.ok(
      line.includes('.claude/worktrees/agent-'),
      `execute-phase.md WORKTREES discovery must include only agent-spawned worktrees ` +
        `(matching '.claude/worktrees/agent-' prefix), got: ${line}`
    );

    assert.ok(
      !/grep\s+-v\s+["']?\$\(pwd\)\$/.test(line),
      `execute-phase.md WORKTREES discovery must not rely on 'grep -v "$(pwd)$"' as ` +
        `the sole guard — that exclusion fails when the workspace itself is a worktree, ` +
        `got: ${line}`
    );
  });

  test('end-to-end: simulated git worktree list output yields only agent worktrees', () => {
    // Simulate `git worktree list --porcelain` output where the *current* worktree
    // is itself a workspace (a worktree of a main repo at a DIFFERENT path), and
    // an agent worktree exists alongside it.
    //
    // Exclusion-based filter ("grep -v '$(pwd)$'") would keep BOTH the upstream main
    // repo path AND the agent worktree, deleting the upstream main on cleanup.
    // Inclusion-based filter must keep ONLY the agent worktree.
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

    // The discovery filter, applied as text:
    //   grep "^worktree " | grep ".claude/worktrees/agent-" | sed 's/^worktree //'
    const discovered = porcelain
      .split('\n')
      .filter((l) => l.startsWith('worktree '))
      .filter((l) => l.includes('.claude/worktrees/agent-'))
      .map((l) => l.replace(/^worktree /, ''));

    assert.deepEqual(
      discovered,
      ['/Users/dev/workspaces/feature-x/.claude/worktrees/agent-deadbeef'],
      'inclusion-based filter must select only the agent-spawned worktree, ' +
        'never the workspace or upstream main repo'
    );
  });
});
