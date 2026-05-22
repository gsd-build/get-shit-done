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

/**
 * Walk <worktreePath>/.planning/ recursively and collect absolute paths of
 * all files whose names match *SUMMARY.md.  Returns [] when the directory
 * does not exist or cannot be read.
 *
 * Mirrors the shell fallback in quick.md (#2296, #2070, #2838):
 *   find "$WT/.planning" -name "*SUMMARY.md"
 */
function defaultFindSummaryFiles(worktreePath) {
  const planningDir = path.join(worktreePath, '.planning');
  const results = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('SUMMARY.md')) {
        results.push(full);
      }
    }
  }
  walk(planningDir);
  return results;
}

/**
 * Rescue uncommitted SUMMARY.md artifacts from a worktree into the main repo
 * tree before the dirty-state check.  Mirrors the shell-fallback rescue block
 * in quick.md (lines 878–891, #2296/#2070/#2838).
 *
 * For each *SUMMARY.md found under <worktreePath>/.planning/:
 *   - compute relative path from worktree root  → .planning/<id>-SUMMARY.md
 *   - destination = <repoRoot>/<relPath>
 *   - copy when dest is absent or content differs
 *
 * Returns a Set of worktree-relative paths (e.g. ".planning/q1-SUMMARY.md")
 * that were eligible for rescue (regardless of whether a copy was needed).
 * These paths are filtered out of the git-status porcelain output so a
 * SUMMARY-only dirty worktree does not block cleanup.
 *
 * Injected deps (all optional — falls back to real FS):
 *   findSummaryFiles(worktreePath) → string[]
 *   existsSync(path) → boolean
 *   readFileSync(path) → string
 *   mkdirSync(dir, opts)
 *   copyFileSync(src, dest)
 */
function rescueSummaryArtifacts(worktreePath, repoRoot, deps) {
  const findSummaryFiles = deps.findSummaryFiles || defaultFindSummaryFiles;
  const existsSync = deps.existsSync || fs.existsSync;
  const readFileSync = deps.readFileSync || ((p) => fs.readFileSync(p, 'utf8'));
  const mkdirSync = deps.mkdirSync || ((d, o) => fs.mkdirSync(d, o));
  const copyFileSync = deps.copyFileSync || fs.copyFileSync;

  const summaryPaths = findSummaryFiles(worktreePath);
  const rescuedRelPaths = new Set();

  for (const absPath of summaryPaths) {
    // relPath is the path relative to the worktree root (e.g. ".planning/q1-SUMMARY.md")
    // Normalize to forward slashes so the Set comparison against `git status --porcelain`
    // output works on Windows too (git always emits forward slashes in porcelain output).
    const relPath = absPath.slice(worktreePath.length).replace(/^[/\\]/, '').replace(/\\/g, '/');
    rescuedRelPaths.add(relPath);

    const dest = path.join(repoRoot, relPath);
    let needsCopy = !existsSync(dest);
    if (!needsCopy) {
      try {
        const srcContent = readFileSync(absPath);
        const destContent = readFileSync(dest);
        needsCopy = srcContent !== destContent;
      } catch {
        needsCopy = true;
      }
    }
    if (needsCopy) {
      try {
        mkdirSync(path.dirname(dest), { recursive: true });
        copyFileSync(absPath, dest);
      } catch {
        // Best-effort rescue — if it fails the dirty check below will decide fate
      }
    }
  }

  return rescuedRelPaths;
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

    // Safety net: rescue uncommitted SUMMARY.md artifacts before the dirty check.
    // The executor leaves <quick_id>-SUMMARY.md uncommitted by contract — the
    // orchestrator commits it.  Mirrors quick.md shell fallback (#2296, #2070, #2838, #3804).
    const rescuedRelPaths = rescueSummaryArtifacts(entry.worktree_path, plan.repoRoot, deps);

    const worktreeStatus = execGit(['-C', entry.worktree_path, 'status', '--porcelain', '--untracked-files=all'], { cwd: plan.repoRoot });
    if (!gitResultOk(worktreeStatus)) {
      result.status = 'blocked';
      result.reason = 'worktree_dirty';
      result.stderr = worktreeStatus?.stderr || '';
      results.push(result);
      pending.push(...entries.slice(i + 1));
      ok = false;
      break;
    }
    // Filter rescued SUMMARY paths out of the porcelain output before deciding dirty.
    // A line like "?? .planning/q1-SUMMARY.md" should not block when the SUMMARY
    // has already been rescued into the main tree.
    const dirtyLines = (worktreeStatus.stdout || '')
      .split('\n')
      .filter((line) => {
        if (!line.trim()) return false;
        // porcelain v1 format: "XY path" (3-char prefix + space + path)
        const filePath = line.slice(3).trim();
        return !rescuedRelPaths.has(filePath);
      });
    if (dirtyLines.length > 0) {
      result.status = 'blocked';
      result.reason = 'worktree_dirty';
      result.stderr = dirtyLines.join('\n');
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
  // Strategy (fail-closed):
  //   a. Prefer refs/remotes/origin/HEAD — the authoritative integration branch.
  //   b. Only fall back to 'main' / 'master' when origin/HEAD is absent AND the
  //      remote itself doesn't exist (i.e. local-only test fixtures).  In all other
  //      cases, bail out rather than guess: using a wrong branch tip would allow
  //      `merge-base --is-ancestor` to pass against a non-authoritative ref and
  //      reap a worktree whose branch is NOT merged into the real default.
  //
  // Intentionally excludes 'HEAD': using HEAD when detached or on a feature
  // branch would make every branch appear "merged" into it, causing false reaping.
  const defaultBranchResult = execGit(
    ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    { cwd: repoRoot }
  );

  let mainTip;
  if (gitResultOk(defaultBranchResult)) {
    // Remote default branch is known — use it exclusively.
    const branchName = defaultBranchResult.stdout.trim().replace(/^origin\//, '');
    const r = execGit(['rev-parse', `refs/remotes/origin/${branchName}`], { cwd: repoRoot });
    if (!gitResultOk(r)) return results; // remote ref unresolvable — fail closed
    mainTip = r.stdout.trim();
  } else {
    // No remote configured (local-only repo, e.g. test fixtures).
    // Fall back to 'main' then 'master' — only safe because there is no remote
    // integration branch to confuse with.  A remote that exists but lacks
    // origin/HEAD is treated as ambiguous and bails out (fail-closed).
    const hasRemote = execGit(['remote'], { cwd: repoRoot });
    if (gitResultOk(hasRemote) && hasRemote.stdout.trim()) {
      // Remote exists but origin/HEAD not set — ambiguous; fail closed.
      return results;
    }
    // Build candidate list: init.defaultBranch config, HEAD symref, then main, master.
    const candidateBranches = [];
    // Try git config init.defaultBranch first (user-configured default)
    const configResult = execGit(['config', '--get', 'init.defaultBranch'], { cwd: repoRoot });
    if (gitResultOk(configResult) && configResult.stdout.trim()) {
      candidateBranches.push(configResult.stdout.trim());
    }
    // Try HEAD symref (the branch the repo is currently on — valid for local repos
    // without detached HEAD; do not use when detached since it could be a feature branch)
    const headSymref = execGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: repoRoot });
    if (gitResultOk(headSymref) && headSymref.stdout.trim()) {
      const headBranch = headSymref.stdout.trim();
      if (!candidateBranches.includes(headBranch)) {
        candidateBranches.push(headBranch);
      }
    }
    // Always include main and master as universal fallbacks
    for (const b of ['main', 'master']) {
      if (!candidateBranches.includes(b)) candidateBranches.push(b);
    }
    for (const candidate of candidateBranches) {
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
    // Normalize CRLF → LF before splitting: git on Windows may emit CRLF in
    // porcelain output, which would break block splitting on '\n\n'.
    const normalizedListed = listedResult.stdout.replace(/\r\n/g, '\n');
    for (const block of normalizedListed.split('\n\n').filter(Boolean)) {
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
    // Fail-closed: any lock content that does not parse as a numeric PID (e.g.
    // "Locked by claude-code agent-xxxx") is treated as ALIVE — we cannot
    // confirm the owner is dead, so we must not reap.  This includes the real
    // Claude Code lock format which is non-numeric text.
    const pidStr = lockedContent.trim().match(/^\d+/)?.[0];
    if (!pidStr) {
      results.push({ path: worktreePath, status: 'skipped', reason: 'lock_owner_unknown' });
      continue;
    }
    const pid = parseInt(pidStr, 10);
    // Wrap isPidAlive in try/catch: any error (e.g. EPERM on Windows when the process
    // exists but is owned by another user) must be treated as ALIVE (fail-closed).
    let pidIsAlive;
    try {
      pidIsAlive = Number.isNaN(pid) || isPidAlive(pid);
    } catch {
      pidIsAlive = true; // Cannot determine liveness — treat as alive, do not reap.
    }
    if (pidIsAlive) {
      results.push({ path: worktreePath, status: 'skipped', reason: 'pid_alive' });
      continue;
    }

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

    // Use the git-listed path so the result is consistent with what callers see
    // from 'git worktree list', avoiding symlink vs real-path mismatches on macOS.
    results.push({ path: gitKnownPath, status: 'reaped', reason: 'pid_dead_and_merged' });
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
  let result;
  try {
    result = reapOrphanWorktrees(cwd);
  } catch (err) {
    // Surface failure as a one-line warning; keep exit-zero so workflows don't break.
    process.stderr.write(`[gsd] worktree.reap-orphans failed: ${err && err.message ? err.message : String(err)}\n`);
    result = [];
  }
  const skippedCount = result.filter((r) => r.status === 'skipped').length;
  if (skippedCount > 0) {
    // Surface skipped entries so operators are aware of unresolved orphans.
    process.stderr.write(`[gsd] worktree.reap-orphans: ${skippedCount} orphan(s) skipped (run with DEBUG=1 for details)\n`);
  }
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
