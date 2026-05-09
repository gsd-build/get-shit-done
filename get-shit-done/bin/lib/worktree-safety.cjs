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

function parseWorktreeListPaths(porcelain) {
  const paths = [];
  const blocks = String(porcelain || '').split('\n\n').filter(Boolean);
  for (const block of blocks) {
    const line = block.split('\n').find(l => l.startsWith('worktree '));
    if (!line) continue;
    const worktreePath = line.slice('worktree '.length).trim();
    if (worktreePath) paths.push(worktreePath);
  }
  return paths;
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

function listLinkedWorktreePaths(repoRoot, deps = {}) {
  const execGit = deps.execGit || execGitDefault;
  const listResult = execGit(repoRoot, ['worktree', 'list', '--porcelain']);
  if (listResult.exitCode !== 0) {
    return {
      ok: false,
      reason: 'git_list_failed',
      paths: [],
    };
  }

  const allPaths = parseWorktreeListPaths(listResult.stdout);
  // git worktree list always includes the current/main worktree first.
  return {
    ok: true,
    reason: 'ok',
    paths: allPaths.slice(1),
  };
}

function inspectWorktreeHealth(repoRoot, options = {}, deps = {}) {
  const existsSync = deps.existsSync || fs.existsSync;
  const statSync = deps.statSync || fs.statSync;
  const staleAfterMs = options.staleAfterMs ?? (60 * 60 * 1000);
  const nowMs = options.nowMs ?? Date.now();

  const listed = listLinkedWorktreePaths(repoRoot, { execGit: deps.execGit || execGitDefault });
  if (!listed.ok) {
    return {
      ok: false,
      reason: listed.reason,
      findings: [],
    };
  }

  const findings = [];
  for (const worktreePath of listed.paths) {
    if (!existsSync(worktreePath)) {
      findings.push({
        kind: 'orphan',
        path: worktreePath,
      });
      continue;
    }

    try {
      const stat = statSync(worktreePath);
      const ageMs = nowMs - stat.mtimeMs;
      if (ageMs > staleAfterMs) {
        findings.push({
          kind: 'stale',
          path: worktreePath,
          ageMinutes: Math.round(ageMs / 60000),
        });
      }
    } catch {
      // Keep historical behavior: stat failures are ignored.
    }
  }

  return {
    ok: true,
    reason: 'ok',
    findings,
  };
}

module.exports = {
  resolveWorktreeContext,
  parseWorktreePorcelain,
  planWorktreePrune,
  executeWorktreePrunePlan,
  listLinkedWorktreePaths,
  inspectWorktreeHealth,
};
