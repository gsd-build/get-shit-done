/**
 * Worktree Safety Policy Module
 *
 * Owns worktree-root resolution and non-destructive prune policy decisions.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Default timeout for worktree-related git subprocess calls.
// 10 s is generous enough for normal git operations on large repos while still
// providing a deterministic failure path when git stalls (locked index, hung
// remote, stalled NFS mount, etc.).  Callers can override via deps.timeout.
const DEFAULT_GIT_TIMEOUT_MS = 10000;

/**
 * Execute a git command with a bounded timeout.
 *
 * Return shape: { exitCode, stdout, stderr, timedOut, error }
 *   - exitCode: process exit status (null when killed by signal)
 *   - timedOut: true when spawnSync reports SIGTERM + ETIMEDOUT — callers must
 *               branch on this to surface a structured warning instead of
 *               silently treating the empty output as success (PRED.k302)
 *   - error:    the Error object from spawnSync when the process could not start
 *               or was killed; null otherwise
 *
 * Backward-compatible: existing callers that only read exitCode/stdout/stderr
 * continue to work unchanged.
 */
function execGitDefault(cwd, args, options = {}) {
  const timeout = options.timeout ?? DEFAULT_GIT_TIMEOUT_MS;
  const result = spawnSync('git', args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
    },
  });
  // spawnSync sets signal='SIGTERM' and error.code='ETIMEDOUT' when the timeout
  // fires and the subprocess is killed.
  const timedOut = result.signal === 'SIGTERM' && result.error?.code === 'ETIMEDOUT';
  return {
    exitCode: result.status ?? 1,
    stdout: (result.stdout ?? '').toString().trim(),
    stderr: (result.stderr ?? '').toString().trim(),
    timedOut,
    error: result.error ?? null,
  };
}

function parseWorktreePorcelain(porcelain) {
  return parseWorktreeEntries(porcelain).filter((entry) => entry.branch).map((entry) => ({
    path: entry.path,
    branch: entry.branch,
  }));
}

function parseWorktreeEntries(porcelain) {
  const entries = [];
  const blocks = String(porcelain || '').split('\n\n').filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    const worktreeLine = lines.find((l) => l.startsWith('worktree '));
    if (!worktreeLine) continue;
    const worktreePath = worktreeLine.slice('worktree '.length).trim();
    if (!worktreePath) continue;
    const branchLine = lines.find((l) => l.startsWith('branch refs/heads/'));
    const branch = branchLine ? branchLine.slice('branch refs/heads/'.length).trim() : null;
    entries.push({ path: worktreePath, branch });
  }
  return entries;
}

function parseWorktreeListPaths(porcelain) {
  return parseWorktreeEntries(porcelain).map((entry) => entry.path);
}

function readWorktreeList(repoRoot, deps = {}) {
  const execGit = deps.execGit || execGitDefault;
  const listResult = execGit(repoRoot, ['worktree', 'list', '--porcelain']);
  if (listResult.timedOut) {
    // AC2 / AC4: surface timeout as a distinct reason so callers can emit a
    // structured warning rather than silently treating the failure as a generic
    // list error (PRED.k302 — error-swallowing-empty-sentinel).
    return {
      ok: false,
      reason: 'git_timed_out',
      porcelain: '',
      entries: [],
    };
  }
  if (listResult.exitCode !== 0) {
    const stderr = String(listResult.stderr || '');
    return {
      ok: false,
      reason: /not a git repository|not a git repo/i.test(stderr)
        ? 'not_a_git_repo'
        : 'git_list_failed',
      porcelain: '',
      entries: [],
    };
  }

  return {
    ok: true,
    reason: 'ok',
    porcelain: listResult.stdout,
    entries: parseWorktreeEntries(listResult.stdout),
  };
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
  const parsePorcelain = deps.parseWorktreePorcelain || parseWorktreePorcelain;
  const destructiveModeRequested = Boolean(options.allowDestructive);
  const listed = readWorktreeList(repoRoot, deps);
  if (!listed.ok) {
    return {
      repoRoot,
      action: 'skip',
      reason: listed.reason,
      destructiveModeRequested,
    };
  }

  let worktrees = [];
  try {
    worktrees = parsePorcelain(listed.porcelain);
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
  if (result.timedOut) {
    // AC4: surface timedOut as a first-class field so callers (e.g.
    // pruneOrphanedWorktrees in core.cjs) can log a structured WARNING rather
    // than silently ignoring it (PRED.k302 — error-swallowing-empty-sentinel).
    return {
      ok: false,
      action: plan.action,
      reason: 'git_timed_out',
      timedOut: true,
      pruned: [],
    };
  }
  return {
    ok: result.exitCode === 0,
    action: plan.action,
    reason: plan.reason,
    timedOut: false,
    pruned: [],
  };
}

function listLinkedWorktreePaths(repoRoot, deps = {}) {
  const listed = readWorktreeList(repoRoot, deps);
  if (!listed.ok) {
    return {
      ok: false,
      reason: listed.reason,
      paths: [],
    };
  }

  const allPaths = listed.entries.map((entry) => entry.path);
  // git worktree list always includes the current/main worktree first.
  return {
    ok: true,
    reason: 'ok',
    paths: allPaths.slice(1),
  };
}

function inspectWorktreeHealth(repoRoot, options = {}, deps = {}) {
  const inventory = snapshotWorktreeInventory(repoRoot, options, deps);
  if (!inventory.ok) {
    return {
      ok: false,
      reason: inventory.reason,
      findings: [],
    };
  }

  const findings = [];
  for (const entry of inventory.entries) {
    if (!entry.exists) {
      findings.push({
        kind: 'orphan',
        path: entry.path,
      });
      continue;
    }
    if (entry.isStale) {
      findings.push({
        kind: 'stale',
        path: entry.path,
        ageMinutes: entry.ageMinutes,
      });
    }
  }

  return {
    ok: true,
    reason: 'ok',
    findings,
  };
}

function snapshotWorktreeInventory(repoRoot, options = {}, deps = {}) {
  const existsSync = deps.existsSync || fs.existsSync;
  const statSync = deps.statSync || fs.statSync;
  const staleAfterMs = options.staleAfterMs ?? (60 * 60 * 1000);
  const nowMs = options.nowMs ?? Date.now();
  const listed = listLinkedWorktreePaths(repoRoot, { execGit: deps.execGit || execGitDefault });
  if (!listed.ok) {
    return {
      ok: false,
      reason: listed.reason,
      entries: [],
    };
  }

  const entries = [];
  for (const worktreePath of listed.paths) {
    let exists = false;
    let isStale = false;
    let ageMinutes = null;

    if (!existsSync(worktreePath)) {
      entries.push({
        path: worktreePath,
        exists,
        isStale,
        ageMinutes,
      });
      continue;
    }

    exists = true;
    try {
      const stat = statSync(worktreePath);
      const ageMs = nowMs - stat.mtimeMs;
      ageMinutes = Math.round(ageMs / 60000);
      if (ageMs > staleAfterMs) {
        isStale = true;
      }
    } catch {
      // Keep historical behavior: stat failures are ignored.
    }
    entries.push({
      path: worktreePath,
      exists,
      isStale,
      ageMinutes,
    });
  }

  return {
    ok: true,
    reason: 'ok',
    entries,
  };
}

function normalizeCleanupManifestEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const worktreePath = typeof entry.worktree_path === 'string'
    ? entry.worktree_path
    : (typeof entry.path === 'string' ? entry.path : '');
  const branch = typeof entry.branch === 'string' ? entry.branch : '';
  const expectedBase = typeof entry.expected_base === 'string' ? entry.expected_base : '';
  if (!worktreePath || !branch || !expectedBase) return null;
  if (!/^worktree-agent-[A-Za-z0-9._/-]+$/.test(branch)) return null;
  return {
    agent_id: typeof entry.agent_id === 'string' ? entry.agent_id : null,
    worktree_path: worktreePath,
    branch,
    expected_base: expectedBase,
  };
}

function normalizeCleanupManifest(manifest) {
  let parsed = manifest;
  if (typeof manifest === 'string') {
    try {
      parsed = JSON.parse(manifest);
    } catch {
      return { ok: false, reason: 'invalid_manifest_json', entries: [] };
    }
  }

  const rawEntries = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed?.worktrees) ? parsed.worktrees : []);
  const seen = new Set();
  const entries = [];
  for (const raw of rawEntries) {
    const entry = normalizeCleanupManifestEntry(raw);
    if (!entry) continue;
    const key = `${entry.worktree_path}\0${entry.branch}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }

  if (entries.length === 0) {
    return { ok: false, reason: 'empty_manifest', entries: [] };
  }

  return { ok: true, reason: 'ok', entries };
}

function planWorktreeWaveCleanup(repoRoot, manifest) {
  const normalized = normalizeCleanupManifest(manifest);
  if (!normalized.ok) {
    return {
      ok: false,
      repoRoot,
      action: 'skip',
      discovery: 'manifest',
      reason: normalized.reason,
      entries: [],
    };
  }

  return {
    ok: true,
    repoRoot,
    action: 'cleanup_wave',
    discovery: 'manifest',
    reason: 'manifest_entries_present',
    entries: normalized.entries,
  };
}

function gitResultOk(result) {
  return result && result.exitCode === 0 && !result.timedOut;
}

function executeWorktreeWaveCleanupPlan(plan, deps = {}) {
  const execGit = deps.execGit || execGitDefault;
  const entries = Array.isArray(plan?.entries) ? plan.entries : [];
  if (!plan || plan.action !== 'cleanup_wave' || entries.length === 0) {
    return {
      ok: false,
      action: plan ? plan.action : 'skip',
      reason: plan ? (plan.reason || 'missing_entries') : 'missing_plan',
      entries: [],
      pending: entries,
    };
  }

  const results = [];
  const pending = [];
  let ok = true;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const result = {
      ...entry,
      status: 'pending',
      reason: null,
      stderr: '',
    };

    const branchCheck = execGit(plan.repoRoot, ['-C', entry.worktree_path, 'rev-parse', '--abbrev-ref', 'HEAD']);
    if (!gitResultOk(branchCheck) || branchCheck.stdout !== entry.branch) {
      result.status = 'blocked';
      result.reason = 'branch_mismatch';
      result.stderr = branchCheck?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const mergeBase = execGit(plan.repoRoot, ['merge-base', 'HEAD', entry.branch]);
    if (!gitResultOk(mergeBase) || mergeBase.stdout !== entry.expected_base) {
      result.status = 'blocked';
      result.reason = 'base_mismatch';
      result.stderr = mergeBase?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const deletions = execGit(plan.repoRoot, ['diff', '--diff-filter=D', '--name-only', `HEAD...${entry.branch}`]);
    if (!gitResultOk(deletions)) {
      result.status = 'blocked';
      result.reason = 'deletion_check_failed';
      result.stderr = deletions?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }
    if (deletions.stdout) {
      result.status = 'blocked';
      result.reason = 'branch_contains_deletions';
      result.stderr = deletions.stdout;
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const worktreeStatus = execGit(plan.repoRoot, ['-C', entry.worktree_path, 'status', '--porcelain', '--untracked-files=all']);
    if (!gitResultOk(worktreeStatus) || worktreeStatus.stdout) {
      result.status = 'blocked';
      result.reason = 'worktree_dirty';
      result.stderr = worktreeStatus?.stdout || worktreeStatus?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const merge = execGit(plan.repoRoot, ['merge', entry.branch, '--no-ff', '--no-edit', '-m', `chore: merge executor worktree (${entry.branch})`]);
    if (!gitResultOk(merge)) {
      result.status = 'blocked';
      result.reason = 'merge_failed';
      result.stderr = merge?.stderr || merge?.stdout || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const remove = execGit(plan.repoRoot, ['worktree', 'remove', entry.worktree_path, '--force']);
    if (!gitResultOk(remove)) {
      result.status = 'blocked';
      result.reason = 'worktree_remove_failed';
      result.stderr = remove?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const branchDelete = execGit(plan.repoRoot, ['branch', '-D', entry.branch]);
    if (!gitResultOk(branchDelete)) {
      result.status = 'warning';
      result.reason = 'branch_delete_failed';
      result.stderr = branchDelete?.stderr || '';
      ok = false;
    } else {
      result.status = 'merged_removed';
      result.reason = 'ok';
    }
    results.push(result);
  }

  return {
    ok,
    action: plan.action,
    reason: ok ? 'ok' : 'cleanup_blocked',
    entries: results,
    pending,
  };
}

function cmdWorktreeCleanupWave(cwd, args = []) {
  const manifestFlagIndex = args.indexOf('--manifest');
  const manifestPath = manifestFlagIndex >= 0 ? args[manifestFlagIndex + 1] : '';
  if (!manifestPath) {
    process.stderr.write('Usage: worktree cleanup-wave --manifest <path>\n');
    process.exitCode = 2;
    return;
  }

  let manifest;
  try {
    manifest = fs.readFileSync(path.resolve(cwd, manifestPath), 'utf8');
  } catch (err) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      reason: 'manifest_read_failed',
      error: err.message,
    }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const plan = planWorktreeWaveCleanup(cwd, manifest);
  const result = executeWorktreeWaveCleanupPlan(plan);
  const response = {
    ok: result.ok,
    plan: {
      action: plan.action,
      discovery: plan.discovery,
      reason: plan.reason,
      entries: plan.entries.length,
    },
    result,
  };
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

module.exports = {
  resolveWorktreeContext,
  parseWorktreePorcelain,
  planWorktreePrune,
  executeWorktreePrunePlan,
  listLinkedWorktreePaths,
  inspectWorktreeHealth,
  snapshotWorktreeInventory,
  normalizeCleanupManifest,
  planWorktreeWaveCleanup,
  executeWorktreeWaveCleanupPlan,
  cmdWorktreeCleanupWave,
};
