/**
 * Worktree Safety Policy Module
 *
 * Owns worktree-root resolution and non-destructive prune policy decisions.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function execGitDefault(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  return {
    exitCode: result.status ?? 1,
    stdout: (result.stdout ?? '').toString().trim(),
    stderr: (result.stderr ?? '').toString().trim(),
  };
}

function parseWorktreePorcelain(porcelain) {
  const entries = [];
  let current = null;
  for (const line of String(porcelain || '').split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length).trim(), branch: null };
    } else if (line.startsWith('branch refs/heads/') && current) {
      current.branch = line.slice('branch refs/heads/'.length).trim();
    } else if (line === '' && current) {
      if (current.branch) entries.push(current);
      current = null;
    }
  }
  if (current && current.branch) entries.push(current);
  return entries;
}

function resolveWorktreeContext(cwd, deps = {}) {
  const execGit = deps.execGit || execGitDefault;
  const existsSync = deps.existsSync || fs.existsSync;

  // Local .planning takes precedence over linked-worktree remapping.
  if (existsSync(path.join(cwd, '.planning'))) {
    return {
      effectiveRoot: cwd,
      mode: 'current_directory',
      reason: 'has_local_planning',
    };
  }

  const gitDir = execGit(cwd, ['rev-parse', '--git-dir']);
  const commonDir = execGit(cwd, ['rev-parse', '--git-common-dir']);
  if (gitDir.exitCode !== 0 || commonDir.exitCode !== 0) {
    return {
      effectiveRoot: cwd,
      mode: 'current_directory',
      reason: 'not_git_repo',
    };
  }

  const gitDirResolved = path.resolve(cwd, gitDir.stdout);
  const commonDirResolved = path.resolve(cwd, commonDir.stdout);
  if (gitDirResolved !== commonDirResolved) {
    return {
      effectiveRoot: path.dirname(commonDirResolved),
      mode: 'linked_worktree_root',
      reason: 'linked_worktree',
    };
  }

  return {
    effectiveRoot: cwd,
    mode: 'current_directory',
    reason: 'main_worktree',
  };
}

function planWorktreePrune(repoRoot, options = {}, deps = {}) {
  const execGit = deps.execGit || execGitDefault;
  const parsePorcelain = deps.parseWorktreePorcelain || parseWorktreePorcelain;
  const destructiveModeRequested = Boolean(options.allowDestructive);

  const listResult = execGit(repoRoot, ['worktree', 'list', '--porcelain']);
  if (listResult.exitCode !== 0) {
    return {
      repoRoot,
      action: 'skip',
      reason: 'git_list_failed',
      destructiveModeRequested,
    };
  }

  let worktrees = [];
  try {
    worktrees = parsePorcelain(listResult.stdout);
  } catch {
    // Keep historical behavior: still run metadata prune when parsing fails.
    worktrees = [];
  }

  return {
    repoRoot,
    action: 'metadata_prune_only',
    reason: worktrees.length === 0 ? 'no_worktrees' : 'worktrees_present',
    destructiveModeRequested,
  };
}

function executeWorktreePrunePlan(plan, deps = {}) {
  const execGit = deps.execGit || execGitDefault;
  if (!plan || plan.action === 'skip') {
    return {
      ok: false,
      action: plan ? plan.action : 'skip',
      reason: plan ? plan.reason : 'missing_plan',
      pruned: [],
    };
  }

  if (plan.action !== 'metadata_prune_only') {
    return {
      ok: false,
      action: plan.action,
      reason: 'unsupported_action',
      pruned: [],
    };
  }

  const result = execGit(plan.repoRoot, ['worktree', 'prune']);
  return {
    ok: result.exitCode === 0,
    action: plan.action,
    reason: plan.reason,
    pruned: [],
  };
}

module.exports = {
  resolveWorktreeContext,
  parseWorktreePorcelain,
  planWorktreePrune,
  executeWorktreePrunePlan,
};

