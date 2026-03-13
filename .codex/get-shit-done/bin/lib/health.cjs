/**
 * GSD Health Module
 *
 * Health check and repair operations for worktree isolation.
 * Detects orphaned worktrees, stale locks, and incomplete finalization.
 * Part of the GSD Worktree Isolation feature.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Import worktree module for registry access
const { loadRegistry, saveRegistry } = require('./worktree.cjs');

// Import upstream module for sync state access
const { loadUpstreamConfig, CONFIG_PATH } = require('./upstream.cjs');

// ─── Exit Codes (per CONTEXT.md decision) ─────────────────────────────────────

const HEALTH_EXIT_CODES = {
  HEALTHY: 0,
  ORPHANS_ONLY: 1,
  INCOMPLETE_ONLY: 2,
  ORPHANS_AND_INCOMPLETE: 3,
  RUNTIME_ERROR: 4,
};

// ─── Quick Health Check ───────────────────────────────────────────────────────

/**
 * Lightweight health check for auto-warnings during worktree operations.
 * Only checks registry vs filesystem (no age threshold check).
 */
function runQuickHealthCheck(cwd) {
  const registry = loadRegistry(cwd);
  if (!registry) {
    return { issues: [], hasOrphans: false };
  }

  const issues = [];

  // Check registry entries against filesystem
  for (const [key, entry] of Object.entries(registry.worktrees)) {
    if (entry.status === 'removed') continue;

    const pathExists = fs.existsSync(entry.path);
    if (!pathExists) {
      issues.push({
        type: 'path_missing',
        phase: entry.phase_number,
        path: entry.path,
        branch: entry.branch,
        suggested_action: 'Remove orphaned registry entry',
        repairable: true,
      });
    }
  }

  // Check for stale locks with dead PIDs
  for (const [key, lock] of Object.entries(registry.locks || {})) {
    let pidAlive = false;
    try {
      process.kill(lock.pid, 0);
      pidAlive = true;
    } catch {
      pidAlive = false;
    }

    // Only flag as stale if same hostname (cross-machine locks need manual intervention)
    if (!pidAlive && lock.hostname === os.hostname()) {
      issues.push({
        type: 'stale_lock',
        phase: key.replace('phase-', ''),
        path: null,
        branch: null,
        suggested_action: 'Release stale lock',
        repairable: true,
        metadata: { pid: lock.pid, hostname: lock.hostname },
      });
    }
  }

  return {
    issues,
    hasOrphans: issues.length > 0,
  };
}

// ─── Full Health Check ────────────────────────────────────────────────────────

/**
 * Full health check combining orphan detection, stale locks, and incomplete finalization.
 * Used by `gsd-tools health check` command.
 */
function cmdHealthCheck(cwd, options, output, raw) {
  const registry = loadRegistry(cwd);
  const issues = [];
  const ageThreshold = options.ageThreshold || 7; // Default 7 days

  // ─── 1. Orphan detection (RECV-01) ───────────────────────────────────────────

  if (registry) {
    // Get git worktree list for comparison
    let gitWorktrees = [];
    try {
      const gitOutput = execSync('git worktree list --porcelain', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const blocks = gitOutput.trim().split('\n\n').filter(Boolean);
      for (const block of blocks) {
        const lines = block.split('\n');
        const wt = {};
        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            wt.path = line.slice(9);
          } else if (line.startsWith('branch ')) {
            wt.branch = line.slice(7);
          } else if (line === 'bare') {
            wt.bare = true;
          }
        }
        if (wt.path) {
          gitWorktrees.push(wt);
        }
      }
    } catch {
      gitWorktrees = [];
    }

    // Check registry entries against filesystem and git
    for (const [key, entry] of Object.entries(registry.worktrees)) {
      if (entry.status === 'removed') continue;

      const pathExists = fs.existsSync(entry.path);
      const inGit = gitWorktrees.some(gw => gw.path === entry.path);

      if (!pathExists) {
        issues.push({
          type: 'path_missing',
          phase: entry.phase_number,
          path: entry.path,
          branch: entry.branch,
          age_days: null,
          suggested_action: 'Remove orphaned registry entry',
          repairable: true,
          metadata: { registry_key: key },
        });
      } else if (!inGit) {
        issues.push({
          type: 'not_in_git',
          phase: entry.phase_number,
          path: entry.path,
          branch: entry.branch,
          age_days: null,
          suggested_action: 'Re-register with git worktree or clean up',
          repairable: true,
          metadata: { registry_key: key },
        });
      }

      // Check age threshold for active worktrees
      if (entry.created && entry.status === 'active') {
        const createdTime = new Date(entry.created).getTime();
        const now = Date.now();
        const ageDays = (now - createdTime) / (1000 * 60 * 60 * 24);
        if (ageDays > ageThreshold) {
          issues.push({
            type: 'age_exceeded',
            phase: entry.phase_number,
            path: entry.path,
            branch: entry.branch,
            age_days: Math.round(ageDays * 10) / 10,
            suggested_action: `Finalize or remove worktree (inactive ${Math.round(ageDays)} days)`,
            repairable: true,
            metadata: { created: entry.created, threshold_days: ageThreshold },
          });
        }
      }
    }

    // Check git worktrees not in registry (excluding main worktree)
    for (const gw of gitWorktrees) {
      if (gw.bare) continue;

      const inRegistry = Object.values(registry.worktrees).some(
        entry => entry.path === gw.path && entry.status === 'active'
      );

      // Skip the main worktree (it won't be in registry)
      const isMainWorktree = gw.path === cwd || gw.path === path.resolve(cwd);

      if (!inRegistry && !isMainWorktree) {
        issues.push({
          type: 'not_in_registry',
          phase: null,
          path: gw.path,
          branch: gw.branch,
          age_days: null,
          suggested_action: 'Add to registry or remove untracked worktree',
          repairable: true,
          metadata: { git_branch: gw.branch },
        });
      }
    }

    // ─── 2. Stale lock detection (RECV-02) ────────────────────────────────────────

    for (const [key, lock] of Object.entries(registry.locks || {})) {
      let pidAlive = false;
      try {
        process.kill(lock.pid, 0);
        pidAlive = true;
      } catch {
        pidAlive = false;
      }

      const isRemoteHost = lock.hostname !== os.hostname();

      if (!pidAlive) {
        issues.push({
          type: 'stale_lock',
          phase: key.replace('phase-', ''),
          path: null,
          branch: null,
          age_days: null,
          suggested_action: isRemoteHost
            ? `Stale lock from different host (${lock.hostname}). Verify process is dead before clearing.`
            : 'Release stale lock',
          repairable: !isRemoteHost, // Only auto-repairable if same host
          metadata: {
            pid: lock.pid,
            hostname: lock.hostname,
            acquired: lock.acquired,
            remote_host_warning: isRemoteHost,
          },
        });
      }
    }
  }

  // ─── 3. Incomplete finalization detection (RECV-03) ─────────────────────────

  const finalizationDir = path.join(cwd, '.planning', 'worktrees', 'finalization');
  if (fs.existsSync(finalizationDir)) {
    try {
      const markerFiles = fs.readdirSync(finalizationDir)
        .filter(f => f.startsWith('phase-') && f.endsWith('.json'));

      for (const markerFile of markerFiles) {
        const markerPath = path.join(finalizationDir, markerFile);
        try {
          const markerContent = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
          const completedSteps = Object.entries(markerContent.steps || {})
            .filter(([, status]) => status === true || status === 'complete')
            .map(([step]) => step);
          const pendingSteps = Object.entries(markerContent.steps || {})
            .filter(([, status]) => status === 'pending' || status === false)
            .map(([step]) => step);

          issues.push({
            type: 'incomplete_finalization',
            phase: markerContent.phase,
            path: markerContent.worktree_path,
            branch: markerContent.branch,
            age_days: null,
            suggested_action: `Resume finalization from step: ${pendingSteps[0] || 'cleanup'}`,
            repairable: true,
            metadata: {
              started: markerContent.started,
              completed_steps: completedSteps,
              pending_steps: pendingSteps,
              marker_file: markerFile,
            },
          });
        } catch {
          // Malformed marker file
          issues.push({
            type: 'incomplete_finalization',
            phase: markerFile.replace('phase-', '').replace('.json', ''),
            path: null,
            branch: null,
            age_days: null,
            suggested_action: 'Investigate malformed finalization marker',
            repairable: false,
            metadata: { marker_file: markerFile, parse_error: true },
          });
        }
      }
    } catch {
      // Directory read error, ignore
    }
  }

  // Check for merge-in-progress (git state)
  const gitDir = path.join(cwd, '.git');
  // Handle both regular repos and worktrees (where .git is a file pointing to main repo)
  let actualGitDir = gitDir;
  if (fs.existsSync(gitDir)) {
    const gitStat = fs.statSync(gitDir);
    if (gitStat.isFile()) {
      // It's a worktree, read the pointer
      const gitContent = fs.readFileSync(gitDir, 'utf-8').trim();
      const match = gitContent.match(/^gitdir:\s*(.+)$/);
      if (match) {
        actualGitDir = path.resolve(cwd, match[1]);
      }
    }
  }

  const mergeHeadPath = path.join(actualGitDir, 'MERGE_HEAD');
  if (fs.existsSync(mergeHeadPath)) {
    issues.push({
      type: 'merge_in_progress',
      phase: null,
      path: cwd,
      branch: null,
      age_days: null,
      suggested_action: 'Complete or abort merge: git merge --continue or git merge --abort',
      repairable: false, // Requires human decision
      metadata: { merge_head_file: mergeHeadPath },
    });
  }

  // ─── 4. Sync health checks (Phase 8 integration) ────────────────────────────
  const syncIssues = checkSyncHealth(cwd);
  for (const syncIssue of syncIssues) {
    issues.push({
      type: syncIssue.type,
      phase: null,
      path: null,
      branch: null,
      age_days: null,
      suggested_action: syncIssue.suggested_action,
      repairable: syncIssue.repairable,
      metadata: {
        ...syncIssue.metadata,
        message: syncIssue.message,
      },
    });
  }

  // ─── 5. Compute exit code and status ────────────────────────────────────────

  const orphanTypes = ['path_missing', 'not_in_git', 'not_in_registry', 'stale_lock', 'age_exceeded'];
  const incompleteTypes = ['incomplete_finalization', 'merge_in_progress'];

  const hasOrphans = issues.some(i => orphanTypes.includes(i.type));
  const hasIncomplete = issues.some(i => incompleteTypes.includes(i.type));

  let exitCode;
  if (!hasOrphans && !hasIncomplete) {
    exitCode = HEALTH_EXIT_CODES.HEALTHY;
  } else if (hasOrphans && !hasIncomplete) {
    exitCode = HEALTH_EXIT_CODES.ORPHANS_ONLY;
  } else if (!hasOrphans && hasIncomplete) {
    exitCode = HEALTH_EXIT_CODES.INCOMPLETE_ONLY;
  } else {
    exitCode = HEALTH_EXIT_CODES.ORPHANS_AND_INCOMPLETE;
  }

  const status = issues.length === 0 ? 'healthy' : (issues.some(i => !i.repairable) ? 'broken' : 'degraded');

  // Sync issue types for summary
  const syncIssueTypes = ['stale_analysis', 'analysis_outdated', 'sync_merge_incomplete', 'orphaned_analysis_state', 'binary_files_pending'];

  const result = {
    status,
    issues,
    exit_code: exitCode,
    summary: {
      orphan_count: issues.filter(i => ['path_missing', 'not_in_git', 'not_in_registry', 'age_exceeded'].includes(i.type)).length,
      stale_lock_count: issues.filter(i => i.type === 'stale_lock').length,
      incomplete_count: issues.filter(i => incompleteTypes.includes(i.type)).length,
      sync_issue_count: issues.filter(i => syncIssueTypes.includes(i.type)).length,
    },
  };

  output(result, raw);
}

// ─── Sync Health Check ────────────────────────────────────────────────────────

/**
 * Check sync-related health issues.
 * Detects: stale analysis state, outdated analysis (SHA mismatch),
 * incomplete merge, and orphaned suggestions.
 *
 * @param {string} cwd - Working directory
 * @returns {Array<{ type: string, message: string, suggested_action: string, repairable: boolean, metadata?: object }>}
 */
function checkSyncHealth(cwd) {
  const issues = [];
  const upstreamConfig = loadUpstreamConfig(cwd);

  // Skip if upstream is not configured
  if (!upstreamConfig.url) {
    return issues;
  }

  const analysis = upstreamConfig.analysis;

  // ─── 1. Stale analysis state (>24 hours) ────────────────────────────────────
  if (analysis && analysis.analyzed_at) {
    const analyzedTime = new Date(analysis.analyzed_at).getTime();
    const now = Date.now();
    const ageHours = (now - analyzedTime) / (1000 * 60 * 60);

    if (ageHours > 24) {
      issues.push({
        type: 'stale_analysis',
        message: `Sync analysis state is stale (${Math.round(ageHours)} hours old)`,
        suggested_action: 'Run sync status to refresh or clear with sync clear-state',
        repairable: true,
        metadata: {
          analyzed_at: analysis.analyzed_at,
          age_hours: Math.round(ageHours),
        },
      });
    }
  }

  // ─── 2. Analysis outdated (SHA mismatch) ────────────────────────────────────
  if (analysis && analysis.analyzed_sha && upstreamConfig.last_upstream_sha) {
    if (analysis.analyzed_sha !== upstreamConfig.last_upstream_sha) {
      issues.push({
        type: 'analysis_outdated',
        message: 'Sync analysis is for an older upstream state',
        suggested_action: 'Run sync preview to re-analyze with current upstream',
        repairable: true,
        metadata: {
          analyzed_sha: analysis.analyzed_sha,
          current_upstream_sha: upstreamConfig.last_upstream_sha,
        },
      });
    }
  }

  // ─── 3. Incomplete merge (MERGE_HEAD exists) ────────────────────────────────
  // Check for merge-in-progress in git state
  const gitDir = path.join(cwd, '.git');
  let actualGitDir = gitDir;

  if (fs.existsSync(gitDir)) {
    const gitStat = fs.statSync(gitDir);
    if (gitStat.isFile()) {
      // It's a worktree, read the pointer
      const gitContent = fs.readFileSync(gitDir, 'utf-8').trim();
      const match = gitContent.match(/^gitdir:\s*(.+)$/);
      if (match) {
        actualGitDir = path.resolve(cwd, match[1]);
      }
    }
  }

  const mergeHeadPath = path.join(actualGitDir, 'MERGE_HEAD');
  if (fs.existsSync(mergeHeadPath)) {
    // Read MERGE_HEAD to get the commit being merged
    let mergeHead = null;
    try {
      mergeHead = fs.readFileSync(mergeHeadPath, 'utf-8').trim().slice(0, 7);
    } catch {
      // Ignore read errors
    }

    issues.push({
      type: 'sync_merge_incomplete',
      message: 'A sync merge is in progress but not completed',
      suggested_action: 'Complete merge with git merge --continue or abort with git merge --abort',
      repairable: false,
      metadata: {
        merge_head: mergeHead,
        merge_head_file: mergeHeadPath,
      },
    });
  }

  // ─── 4. Orphaned suggestions (conflicts exist but analysis shows none) ──────
  if (analysis) {
    const hasStructuralConflicts = analysis.structural_conflicts && analysis.structural_conflicts.length > 0;
    const conflictCount = analysis.conflict_count || 0;

    // Check if all structural conflicts are acknowledged but there are still unresolved conflicts
    if (hasStructuralConflicts) {
      const allAcknowledged = analysis.structural_conflicts.every(c => c.acknowledged);
      if (allAcknowledged && conflictCount > 0) {
        // Structural conflicts acknowledged but content conflicts remain
        // This is normal - just informational
      }

      // Check for orphaned state: no upstream commits behind but analysis state exists
      if (upstreamConfig.commits_behind === 0 && !mergeHeadPath) {
        issues.push({
          type: 'orphaned_analysis_state',
          message: 'Analysis state exists but fork is up to date with upstream',
          suggested_action: 'Clear stale analysis state with sync clear-state',
          repairable: true,
          metadata: {
            structural_conflicts: analysis.structural_conflicts.length,
            commits_behind: upstreamConfig.commits_behind,
          },
        });
      }
    }

    // Check for binary files pending acknowledgment
    if (analysis.binary_files && analysis.binary_files.length > 0 && !analysis.binary_acknowledged) {
      issues.push({
        type: 'binary_files_pending',
        message: `${analysis.binary_files.length} binary file(s) pending acknowledgment`,
        suggested_action: 'Review binary changes and acknowledge before merge',
        repairable: false,
        metadata: {
          binary_count: analysis.binary_files.length,
          binary_files: analysis.binary_files.slice(0, 5), // Limit to first 5
        },
      });
    }
  }

  return issues;
}

// ─── Repair Helpers ───────────────────────────────────────────────────────────

/**
 * Check for uncommitted changes in a worktree path.
 * Returns true if there are uncommitted changes (dirty).
 */
function hasUncommittedChanges(worktreePath) {
  try {
    const output = execSync(`git -C "${worktreePath}" status --porcelain`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().length > 0;
  } catch {
    return true; // Assume dirty if check fails
  }
}

/**
 * Capture state before repair for rollback purposes.
 */
function captureRepairState(cwd, issue) {
  const registry = loadRegistry(cwd);
  return {
    registry: registry ? JSON.parse(JSON.stringify(registry)) : null,
    issue: JSON.parse(JSON.stringify(issue)),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Restore state from snapshot on repair failure.
 */
function restoreRepairState(cwd, snapshot) {
  if (snapshot.registry) {
    saveRegistry(cwd, snapshot.registry);
  }
}

// ─── Health Repair Command ────────────────────────────────────────────────────

/**
 * Repair a single health issue.
 * Called from the /gsd:health interactive workflow.
 *
 * @param {string} cwd - Current working directory
 * @param {string} issueJson - JSON string of the issue to repair
 * @param {object} options - { force: boolean }
 * @param {function} output - Output function
 * @param {boolean} raw - Output as JSON
 */
function cmdHealthRepair(cwd, issueJson, options, output, raw) {
  let issue;
  try {
    issue = JSON.parse(issueJson);
  } catch (err) {
    output({ repaired: false, reason: 'invalid_json', error: err.message }, raw);
    return;
  }

  const registry = loadRegistry(cwd);
  if (!registry) {
    output({ repaired: false, reason: 'no_registry', error: 'Registry not found' }, raw);
    return;
  }

  const snapshot = captureRepairState(cwd, issue);
  const force = options?.force || false;

  try {
    let result;

    switch (issue.type) {
      case 'path_missing': {
        // Registry entry points to deleted path - remove from registry
        const key = issue.metadata?.registry_key || `phase-${issue.phase}`;
        if (registry.worktrees[key]) {
          registry.worktrees[key].status = 'removed';
          registry.worktrees[key].removed = new Date().toISOString();
        }
        // Clear any associated lock
        if (registry.locks && registry.locks[key]) {
          delete registry.locks[key];
        }
        saveRegistry(cwd, registry);
        result = { repaired: true, issue_type: issue.type, details: `Removed registry entry for ${key}` };
        break;
      }

      case 'not_in_git': {
        // Path exists but not tracked by git - run git worktree prune then update registry
        try {
          execSync('git worktree prune', { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        } catch {
          // Prune may warn but not fail
        }
        // Mark as removed in registry since git doesn't know about it
        const key = issue.metadata?.registry_key || `phase-${issue.phase}`;
        if (registry.worktrees[key]) {
          registry.worktrees[key].status = 'removed';
          registry.worktrees[key].removed = new Date().toISOString();
          registry.worktrees[key].removal_reason = 'not_in_git';
        }
        saveRegistry(cwd, registry);
        result = { repaired: true, issue_type: issue.type, details: `Ran git worktree prune and marked ${key} as removed` };
        break;
      }

      case 'not_in_registry': {
        // Git worktree not in our registry - add it with status 'untracked'
        const worktreePath = issue.path;
        const branch = issue.branch || issue.metadata?.git_branch;

        // Try to extract phase number from branch name
        let phaseNum = null;
        if (branch) {
          const match = branch.match(/phase-(\d+)/);
          if (match) {
            phaseNum = match[1];
          }
        }

        const key = phaseNum ? `phase-${phaseNum}` : `untracked-${Date.now()}`;
        registry.worktrees[key] = {
          path: worktreePath,
          branch: branch,
          phase_number: phaseNum,
          status: 'untracked',
          created: new Date().toISOString(),
          note: 'Added by health repair - not originally in registry',
        };
        saveRegistry(cwd, registry);
        result = { repaired: true, issue_type: issue.type, details: `Added ${key} to registry as untracked` };
        break;
      }

      case 'stale_lock': {
        // Lock from dead process - check hostname first
        const key = `phase-${issue.phase}`;
        const lock = registry.locks?.[key];

        if (!lock) {
          result = { repaired: true, issue_type: issue.type, details: 'Lock already cleared' };
          break;
        }

        const isRemoteHost = lock.hostname !== os.hostname();

        if (isRemoteHost && !force) {
          result = {
            repaired: false,
            issue_type: issue.type,
            reason: 'remote_host_lock',
            error: `Lock is from different host (${lock.hostname}). Use --force to clear.`,
          };
          break;
        }

        // Release the lock
        delete registry.locks[key];

        // Also try to remove lock directory if it exists
        const lockDir = path.join(cwd, '.planning', 'worktrees', 'locks', key);
        if (fs.existsSync(lockDir)) {
          try {
            fs.rmSync(lockDir, { recursive: true });
          } catch {
            // Ignore removal errors
          }
        }

        saveRegistry(cwd, registry);
        result = { repaired: true, issue_type: issue.type, details: `Released stale lock for ${key}` };
        break;
      }

      case 'age_exceeded': {
        // Worktree older than threshold - check for uncommitted changes first
        const worktreePath = issue.path;

        if (!worktreePath || !fs.existsSync(worktreePath)) {
          result = { repaired: false, issue_type: issue.type, reason: 'path_not_found', error: 'Worktree path does not exist' };
          break;
        }

        if (hasUncommittedChanges(worktreePath)) {
          result = {
            repaired: false,
            issue_type: issue.type,
            reason: 'uncommitted_changes',
            path: worktreePath,
            error: 'Worktree has uncommitted changes. Commit or stash changes before cleanup.',
          };
          break;
        }

        // Safe to remove - use git worktree remove
        const key = issue.metadata?.registry_key || `phase-${issue.phase}`;

        try {
          // Unlock first if locked
          execSync(`git worktree unlock "${worktreePath}" 2>/dev/null || true`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          // Remove worktree
          execSync(`git worktree remove "${worktreePath}" --force`, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          // Update registry
          if (registry.worktrees[key]) {
            registry.worktrees[key].status = 'removed';
            registry.worktrees[key].removed = new Date().toISOString();
            registry.worktrees[key].removal_reason = 'age_exceeded';
          }

          // Release lock if exists
          if (registry.locks && registry.locks[key]) {
            delete registry.locks[key];
          }

          saveRegistry(cwd, registry);
          result = { repaired: true, issue_type: issue.type, details: `Removed aged worktree: ${worktreePath}` };
        } catch (err) {
          result = { repaired: false, issue_type: issue.type, reason: 'removal_failed', error: err.message };
        }
        break;
      }

      case 'incomplete_finalization': {
        // Marker file exists - resume from where it left off
        const markerFile = issue.metadata?.marker_file;
        const markerDir = path.join(cwd, '.planning', 'worktrees', 'finalization');
        const markerPath = path.join(markerDir, markerFile);

        if (!fs.existsSync(markerPath)) {
          result = { repaired: true, issue_type: issue.type, details: 'Marker file already removed' };
          break;
        }

        let marker;
        try {
          marker = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
        } catch {
          result = { repaired: false, issue_type: issue.type, reason: 'malformed_marker', error: 'Could not parse marker file' };
          break;
        }

        const pendingSteps = issue.metadata?.pending_steps || [];
        const worktreePath = marker.worktree_path;

        // Check for uncommitted changes if worktree still exists
        if (worktreePath && fs.existsSync(worktreePath)) {
          if (hasUncommittedChanges(worktreePath)) {
            result = {
              repaired: false,
              issue_type: issue.type,
              reason: 'uncommitted_changes',
              path: worktreePath,
              error: 'Worktree has uncommitted changes. Complete finalization manually.',
            };
            break;
          }
        }

        const key = `phase-${marker.phase}`;
        let repairDetails = [];

        try {
          // Resume each pending step
          if (pendingSteps.includes('worktree_removed') && worktreePath && fs.existsSync(worktreePath)) {
            execSync(`git worktree unlock "${worktreePath}" 2>/dev/null || true`, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
            execSync(`git worktree remove "${worktreePath}" --force`, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
            marker.steps.worktree_removed = true;
            repairDetails.push('worktree removed');
          }

          if (pendingSteps.includes('lock_released')) {
            if (registry.locks && registry.locks[key]) {
              delete registry.locks[key];
            }
            const lockDir = path.join(cwd, '.planning', 'worktrees', 'locks', key);
            if (fs.existsSync(lockDir)) {
              fs.rmSync(lockDir, { recursive: true });
            }
            marker.steps.lock_released = true;
            repairDetails.push('lock released');
          }

          if (pendingSteps.includes('registry_updated')) {
            if (registry.worktrees[key]) {
              registry.worktrees[key].status = 'removed';
              registry.worktrees[key].removed = new Date().toISOString();
            }
            marker.steps.registry_updated = true;
            repairDetails.push('registry updated');
          }

          saveRegistry(cwd, registry);

          // Mark as completed and remove marker
          marker.completed = new Date().toISOString();
          fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2));
          fs.unlinkSync(markerPath);

          // Clean up empty finalization directory
          const files = fs.readdirSync(markerDir);
          if (files.length === 0) {
            fs.rmdirSync(markerDir);
          }

          result = { repaired: true, issue_type: issue.type, details: `Completed finalization: ${repairDetails.join(', ')}` };
        } catch (err) {
          // Rollback on failure
          restoreRepairState(cwd, snapshot);
          result = { repaired: false, issue_type: issue.type, reason: 'repair_failed', error: err.message, rolled_back: true };
        }
        break;
      }

      case 'merge_in_progress': {
        // Requires human decision - cannot auto-fix
        result = {
          repaired: false,
          issue_type: issue.type,
          reason: 'requires_manual_intervention',
          suggestion: 'Run "git merge --abort" to cancel or resolve conflicts and run "git merge --continue"',
        };
        break;
      }

      default:
        result = { repaired: false, issue_type: issue.type, reason: 'unknown_type', error: `Unknown issue type: ${issue.type}` };
    }

    output(result, raw);
  } catch (err) {
    // Global error handler with rollback
    restoreRepairState(cwd, snapshot);
    output({
      repaired: false,
      issue_type: issue.type,
      reason: 'repair_exception',
      error: err.message,
      rolled_back: true,
    }, raw);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  HEALTH_EXIT_CODES,

  // Health check functions
  runQuickHealthCheck,
  cmdHealthCheck,

  // Sync health check
  checkSyncHealth,

  // Repair functions
  hasUncommittedChanges,
  captureRepairState,
  restoreRepairState,
  cmdHealthRepair,
};
