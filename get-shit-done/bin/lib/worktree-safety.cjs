/**
 * Worktree Safety Policy Module
 *
 * Owns worktree-root resolution and non-destructive prune policy decisions.
 */

const fs = require('fs');
const path = require('path');
const { execGit: execGitSeam } = require('./shell-command-projection.cjs');

// Default timeout for worktree-related git subprocess calls.
// 10 s is generous enough for normal git operations on large repos while still
// providing a deterministic failure path when git stalls (locked index, hung
// remote, stalled NFS mount, etc.).  Callers can override via deps.timeout.
const DEFAULT_GIT_TIMEOUT_MS = 10000;

/**
 * Execute a git command via the shell-projection seam, with a derived
 * `timedOut` field. Tests inject mocks via deps.execGit using the new
 * (args, opts) shape — see worktree-safety-policy.test.cjs.
 *
 * Return shape: { exitCode, stdout, stderr, timedOut, error, signal }
 *   - timedOut: true when spawnSync reports SIGTERM + ETIMEDOUT
 */
function execGitDefault(args, opts = {}) {
  const result = execGitSeam(args, { ...opts, timeout: opts.timeout ?? DEFAULT_GIT_TIMEOUT_MS });
  const timedOut = result.signal === 'SIGTERM' && result.error?.code === 'ETIMEDOUT';
  return { ...result, timedOut };
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
  const listResult = execGit(['worktree', 'list', '--porcelain'], { cwd: repoRoot });
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

  const gitDir = execGit(['rev-parse', '--git-dir'], { cwd });
  const commonDir = execGit(['rev-parse', '--git-common-dir'], { cwd });
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

  const result = execGit(['worktree', 'prune'], { cwd: plan.repoRoot });
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

    const branchCheck = execGit(['-C', entry.worktree_path, 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd: plan.repoRoot });
    if (!gitResultOk(branchCheck) || branchCheck.stdout.trim() !== entry.branch) {
      result.status = 'blocked';
      result.reason = 'branch_mismatch';
      result.stderr = branchCheck?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const mergeBase = execGit(['merge-base', 'HEAD', entry.branch], { cwd: plan.repoRoot });
    if (!gitResultOk(mergeBase) || mergeBase.stdout.trim() !== entry.expected_base) {
      result.status = 'blocked';
      result.reason = 'base_mismatch';
      result.stderr = mergeBase?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const deletions = execGit(['diff', '--diff-filter=D', '--name-only', `HEAD...${entry.branch}`], { cwd: plan.repoRoot });
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

    const worktreeStatus = execGit(['-C', entry.worktree_path, 'status', '--porcelain', '--untracked-files=all'], { cwd: plan.repoRoot });
    if (!gitResultOk(worktreeStatus) || worktreeStatus.stdout) {
      result.status = 'blocked';
      result.reason = 'worktree_dirty';
      result.stderr = worktreeStatus?.stdout || worktreeStatus?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const merge = execGit(['merge', entry.branch, '--no-ff', '--no-edit', '-m', `chore: merge executor worktree (${entry.branch})`], { cwd: plan.repoRoot });
    if (!gitResultOk(merge)) {
      result.status = 'blocked';
      result.reason = 'merge_failed';
      result.stderr = merge?.stderr || merge?.stdout || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    let remove = execGit(['worktree', 'remove', entry.worktree_path, '--force'], { cwd: plan.repoRoot });
    if (!gitResultOk(remove)) {
      // Locked worktrees require unlock before remove (or --force --force).
      // Attempt: git worktree unlock <path> (ignore failure — already unlocked is ok)
      // then retry git worktree remove --force.  (#3707)
      execGit(['worktree', 'unlock', entry.worktree_path], { cwd: plan.repoRoot });
      remove = execGit(['worktree', 'remove', entry.worktree_path, '--force'], { cwd: plan.repoRoot });
    }
    if (!gitResultOk(remove)) {
      result.status = 'blocked';
      result.reason = 'worktree_remove_failed';
      result.stderr = remove?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }

    const branchDelete = execGit(['branch', '-D', entry.branch], { cwd: plan.repoRoot });
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

/**
 * Reap orphaned linked worktrees whose lock owner process is dead, whose
 * branch tip is fully merged into the default branch, and whose lock file
 * mtime is older than REAP_MTIME_GUARD_MS (race guard).
 *
 * Invariants (Fail-closed — skip on any doubt):
 *   Pre:  .git/worktrees/<id>/locked exists for a linked worktree
 *   Reap: pid dead (or unparseable) AND branch-tip ancestor of default branch
 *         AND lock mtime > REAP_MTIME_GUARD_MS old
 *   Action: worktree unlock → worktree remove --force → prune
 *   Post: worktree absent from git worktree list; no unmerged work lost
 *
 * @param {string} repoRoot  - Absolute path to the primary worktree root.
 * @param {object} [deps]    - Optional dependency overrides for testing.
 *   deps.execGit            - Replaces execGitDefault for all git calls.
 *   deps.isPidAlive         - Function(pid:number):boolean (default: kill -0).
 *   deps.readDirSafe        - Function(dir:string):string[] (default: fs.readdirSync).
 *   deps.readFileSafe       - Function(file:string):string (default: fs.readFileSync).
 *   deps.mtimeSafe          - Function(file:string):Date (default: fs.statSync).
 *   deps.reapMtimeGuardMs   - Override stale-lock age threshold (default 5 min).
 * @returns {Array<{path:string, status:'reaped'|'skipped', reason:string}>}
 */
const REAP_MTIME_GUARD_MS = 5 * 60 * 1000; // 5 minutes

function reapOrphanWorktrees(repoRoot, deps = {}) {
  const execGit = deps.execGit || execGitDefault;
  const isPidAlive = deps.isPidAlive || defaultIsPidAlive;
  const readDirSafe = deps.readDirSafe || defaultReadDirSafe;
  const readFileSafe = deps.readFileSafe || defaultReadFileSafe;
  const mtimeSafe = deps.mtimeSafe || defaultMtimeSafe;
  const reapMtimeGuardMs = deps.reapMtimeGuardMs !== undefined ? deps.reapMtimeGuardMs : REAP_MTIME_GUARD_MS;

  const results = [];

  // 1. Discover the .git/worktrees/ admin directory.
  const gitDir = execGit(['rev-parse', '--git-dir'], { cwd: repoRoot });
  if (!gitResultOk(gitDir)) return results;
  const gitDirPath = path.resolve(repoRoot, gitDir.stdout.trim());

  const worktreesAdminDir = path.join(gitDirPath, 'worktrees');
  const entries = readDirSafe(worktreesAdminDir);
  if (!entries) return results;

  // 2. Discover the default branch (main/master/etc) tip.
  // Try: remote origin/HEAD → local 'main' → local 'master'.
  // Intentionally excludes 'HEAD': using HEAD when detached or on a feature
  // branch would make every branch appear "merged" into it, causing false reaping.
  // This handles repos without a remote (test fixtures) and non-standard
  // default-branch names gracefully instead of bailing early.
  const defaultBranchResult = execGit(
    ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    { cwd: repoRoot }
  );
  const defaultBranch = gitResultOk(defaultBranchResult)
    ? defaultBranchResult.stdout.trim().replace(/^origin\//, '')
    : 'main';

  let mainTip;
  {
    const candidates = [defaultBranch, 'main', 'master'];
    // Deduplicate while preserving order.
    const seen = new Set();
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      const r = execGit(['rev-parse', candidate], { cwd: repoRoot });
      if (gitResultOk(r)) {
        mainTip = r.stdout.trim();
        break;
      }
    }
    if (!mainTip) return results;
  }

  // 3. Build a canonical-path → listed-path index from git worktree list.
  // git worktree list shows paths AS PROVIDED to git worktree add.
  // On macOS, os.tmpdir() may be /var/folders/... (symlink) while git writes
  // /private/var/folders/... (real path) in the gitdir file.  We need the
  // LISTED path for git worktree unlock/remove to find the worktree.
  const listedResult = execGit(['worktree', 'list', '--porcelain'], { cwd: repoRoot });
  const canonicalToListed = new Map();
  if (gitResultOk(listedResult)) {
    for (const block of listedResult.stdout.split('\n\n').filter(Boolean)) {
      const wtLine = block.split('\n').find((l) => l.startsWith('worktree '));
      if (!wtLine) continue;
      const listed = wtLine.slice('worktree '.length).trim();
      try {
        const canonical = fs.realpathSync.native(listed);
        canonicalToListed.set(canonical, listed);
      } catch {
        // If the path doesn't exist (already removed), skip silently.
      }
    }
  }

  // 4. Process each worktree admin entry that has a 'locked' file.
  for (const entryName of entries) {
    const adminDir = path.join(worktreesAdminDir, entryName);
    const lockedFile = path.join(adminDir, 'locked');
    const lockedContent = readFileSafe(lockedFile);
    if (lockedContent === null) continue; // no lock file — not our concern

    // Resolve the actual worktree path from the gitdir pointer.
    // The gitdir file contains a path like "../../<name>/.git" relative to adminDir.
    // Strip the trailing .git segment (cross-platform: handle both / and \).
    const gitdirFile = path.join(adminDir, 'gitdir');
    const gitdirContent = readFileSafe(gitdirFile);
    if (!gitdirContent) continue;
    const resolvedGitFile = path.resolve(adminDir, gitdirContent.trim());
    const worktreePath = path.basename(resolvedGitFile) === '.git'
      ? path.dirname(resolvedGitFile)
      : resolvedGitFile;

    // Look up the git-list path (the path git knows about) for use in
    // git worktree unlock/remove commands.  Falls back to worktreePath if
    // not found (e.g. already removed, or no symlink ambiguity).
    let gitKnownPath = worktreePath;
    try {
      const canonical = fs.realpathSync.native(worktreePath);
      gitKnownPath = canonicalToListed.get(canonical) || worktreePath;
    } catch {
      // worktreePath may not exist yet (already removed); use as-is.
    }

    // 4a. Stale-lock guard: skip if lock is too fresh (PID recycling / race).
    const lockMtime = mtimeSafe(lockedFile);
    if (!lockMtime || Date.now() - lockMtime.getTime() < reapMtimeGuardMs) {
      results.push({ path: worktreePath, status: 'skipped', reason: 'lock_too_fresh' });
      continue;
    }

    // 4b. PID liveness check.
    const pidStr = lockedContent.trim().match(/^\d+/)?.[0];
    if (pidStr) {
      const pid = parseInt(pidStr, 10);
      if (!Number.isNaN(pid) && isPidAlive(pid)) {
        results.push({ path: worktreePath, status: 'skipped', reason: 'pid_alive' });
        continue;
      }
    }
    // If no parseable PID, treat as dead (legacy lock written without PID).

    // 4c. Ancestry guard: branch-tip must be reachable from main (fail closed).
    // The admin HEAD file contains either "ref: refs/heads/<branch>" or a bare SHA.
    // We read the file directly (no non-standard git ref parsing).
    let branchTip;
    {
      const headContent = readFileSafe(path.join(adminDir, 'HEAD'));
      if (!headContent) {
        results.push({ path: worktreePath, status: 'skipped', reason: 'cannot_resolve_branch_tip' });
        continue;
      }
      const trimmed = headContent.trim();
      if (trimmed.startsWith('ref: refs/heads/')) {
        // Symbolic ref — resolve to commit SHA via git
        const branchName = trimmed.slice('ref: refs/heads/'.length);
        const resolveResult = execGit(['rev-parse', `refs/heads/${branchName}`], { cwd: repoRoot });
        if (!gitResultOk(resolveResult)) {
          results.push({ path: worktreePath, status: 'skipped', reason: 'cannot_resolve_branch_tip' });
          continue;
        }
        branchTip = resolveResult.stdout.trim();
      } else if (/^[0-9a-f]{40}$/i.test(trimmed)) {
        // Detached HEAD — bare SHA
        branchTip = trimmed;
      } else {
        results.push({ path: worktreePath, status: 'skipped', reason: 'cannot_resolve_branch_tip' });
        continue;
      }
    }

    const ancestorCheck = execGit(
      ['merge-base', '--is-ancestor', branchTip, mainTip],
      { cwd: repoRoot }
    );
    if (!gitResultOk(ancestorCheck)) {
      results.push({ path: worktreePath, status: 'skipped', reason: 'branch_not_merged' });
      continue;
    }

    // 4d. Reap: unlock → remove --force.
    // Use gitKnownPath (from git worktree list) so that git can locate the
    // worktree even when the path in the gitdir file differs due to symlinks
    // (e.g. macOS /var/folders vs /private/var/folders).
    execGit(['worktree', 'unlock', gitKnownPath], { cwd: repoRoot }); // ignore failure (already unlocked)
    const removeResult = execGit(['worktree', 'remove', gitKnownPath, '--force'], { cwd: repoRoot });
    if (!gitResultOk(removeResult)) {
      results.push({ path: worktreePath, status: 'skipped', reason: 'remove_failed' });
      continue;
    }

    results.push({ path: worktreePath, status: 'reaped', reason: 'pid_dead_and_merged' });
  }

  // 5. Always prune stale metadata (handles missing-on-disk entries).
  execGit(['worktree', 'prune'], { cwd: repoRoot });

  return results;
}

// ─── reapOrphanWorktrees deps helpers ─────────────────────────────────────────

function defaultIsPidAlive(pid) {
  // process.kill(pid, 0) probes process existence without sending a real signal.
  //   - Returns normally → process is alive.
  //   - Throws ESRCH → process does not exist → dead.
  //   - Throws EPERM → process exists but we lack permission (alive; fail-closed
  //     on Windows where cross-user processes throw EPERM, not ESRCH).
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but we cannot signal it.
    // Treat as alive (fail-closed: do not reap a process we cannot confirm dead).
    if (err && err.code === 'EPERM') return true;
    return false;
  }
}

function defaultReadDirSafe(dir) {
  try { return fs.readdirSync(dir); } catch { return null; }
}

function defaultReadFileSafe(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function defaultMtimeSafe(file) {
  try { return fs.statSync(file).mtime; } catch { return null; }
}

function cmdWorktreeReapOrphans(cwd) {
  const result = reapOrphanWorktrees(cwd);
  process.stdout.write(`${JSON.stringify({ ok: true, reaped: result.filter((r) => r.status === 'reaped').length, entries: result }, null, 2)}\n`);
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
  reapOrphanWorktrees,
  cmdWorktreeReapOrphans,
};
