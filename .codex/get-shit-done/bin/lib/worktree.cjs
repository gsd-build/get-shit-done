/**
 * GSD Worktree Module
 *
 * Worktree lifecycle management and lock operations for parallel phase execution.
 * Part of the GSD Worktree Isolation feature.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ─── Constants ────────────────────────────────────────────────────────────────

const REGISTRY_PATH = '.planning/worktrees/registry.json';

// ─── Registry Helpers ─────────────────────────────────────────────────────────

function getRegistryPath(cwd) {
  return path.join(cwd, REGISTRY_PATH);
}

function loadRegistry(cwd) {
  const registryPath = getRegistryPath(cwd);
  try {
    const content = fs.readFileSync(registryPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function saveRegistry(cwd, registry) {
  const registryPath = getRegistryPath(cwd);
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
}

// ─── Worktree Commands ────────────────────────────────────────────────────────

function cmdWorktreeInit(cwd, output, error, raw) {
  const worktreesDir = path.join(cwd, '.planning', 'worktrees');
  const registryPath = getRegistryPath(cwd);

  // Create directory if it doesn't exist
  fs.mkdirSync(worktreesDir, { recursive: true });

  // Check if registry already exists
  if (fs.existsSync(registryPath)) {
    const existing = loadRegistry(cwd);
    output({
      initialized: false,
      reason: 'already_exists',
      path: REGISTRY_PATH,
      registry: existing,
    }, raw, 'exists');
    return;
  }

  // Create initial registry
  const registry = {
    version: 1,
    worktrees: {},
    locks: {},
  };

  saveRegistry(cwd, registry);

  output({
    initialized: true,
    path: REGISTRY_PATH,
    registry,
  }, raw, 'initialized');
}

function cmdWorktreeAdd(cwd, phase, worktreePath, options, output, error, raw, runQuickHealthCheck) {
  if (!phase) {
    error('phase required for worktree add');
  }
  if (!worktreePath) {
    error('path required for worktree add');
  }

  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  const { branch, slug } = options;
  if (!branch) {
    error('--branch required for worktree add');
  }
  if (!slug) {
    error('--slug required for worktree add');
  }

  const key = `phase-${phase}`;
  const absolutePath = path.resolve(cwd, worktreePath);

  const entry = {
    phase_number: String(phase),
    phase_name: slug,
    branch,
    path: absolutePath,
    created: new Date().toISOString(),
    status: 'active',
  };

  registry.worktrees[key] = entry;
  saveRegistry(cwd, registry);

  // Auto-check for health issues after successful add
  if (runQuickHealthCheck) {
    const healthResult = runQuickHealthCheck(cwd);
    if (healthResult.issues.length > 0) {
      process.stderr.write(`\nWarning: ${healthResult.issues.length} worktree health issue(s) detected.\n`);
      process.stderr.write(`Run 'gsd-tools health check' for details.\n`);
    }
  }

  output({
    added: true,
    key,
    entry,
  }, raw, key);
}

function cmdWorktreeRemove(cwd, phase, output, error, raw, runQuickHealthCheck) {
  if (!phase) {
    error('phase required for worktree remove');
  }

  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  const key = `phase-${phase}`;

  if (!registry.worktrees[key]) {
    error(`Worktree not found: ${key}`);
  }

  // Mark as removed (keep history) or delete entirely
  registry.worktrees[key].status = 'removed';
  registry.worktrees[key].removed = new Date().toISOString();
  saveRegistry(cwd, registry);

  // Auto-check for health issues after successful remove
  if (runQuickHealthCheck) {
    const healthResult = runQuickHealthCheck(cwd);
    if (healthResult.issues.length > 0) {
      process.stderr.write(`\nWarning: ${healthResult.issues.length} worktree health issue(s) detected.\n`);
      process.stderr.write(`Run 'gsd-tools health check' for details.\n`);
    }
  }

  output({
    removed: true,
    key,
  }, raw, key);
}

function cmdWorktreeGet(cwd, phase, output, error, raw) {
  if (!phase) {
    error('phase required for worktree get');
  }

  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  const key = `phase-${phase}`;
  const entry = registry.worktrees[key];

  if (!entry || entry.status === 'removed') {
    process.stderr.write(`Error: Worktree not found: ${key}\n`);
    process.exit(1);
  }

  output(entry, raw, JSON.stringify(entry));
}

function cmdWorktreeList(cwd, output, error, raw, runQuickHealthCheck) {
  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  const worktrees = Object.entries(registry.worktrees).map(([key, value]) => ({
    key,
    ...value,
  }));

  // Auto-check for health issues after listing
  if (runQuickHealthCheck) {
    const healthResult = runQuickHealthCheck(cwd);
    if (healthResult.issues.length > 0) {
      process.stderr.write(`\nWarning: ${healthResult.issues.length} worktree health issue(s) detected.\n`);
      process.stderr.write(`Run 'gsd-tools health check' for details.\n`);
    }
  }

  output(worktrees, raw, JSON.stringify(worktrees));
}

function cmdWorktreeStatus(cwd, output, error, raw) {
  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  // Get git worktree list
  let gitWorktrees = [];
  try {
    const gitOutput = execSync('git worktree list --porcelain', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse porcelain output
    const blocks = gitOutput.trim().split('\n\n').filter(Boolean);
    for (const block of blocks) {
      const lines = block.split('\n');
      const wt = {};
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          wt.path = line.slice(9);
        } else if (line.startsWith('HEAD ')) {
          wt.head = line.slice(5);
        } else if (line.startsWith('branch ')) {
          wt.branch = line.slice(7);
        } else if (line === 'bare') {
          wt.bare = true;
        } else if (line === 'detached') {
          wt.detached = true;
        }
      }
      if (wt.path) {
        gitWorktrees.push(wt);
      }
    }
  } catch (err) {
    // Git worktree command failed, continue with empty list
    gitWorktrees = [];
  }

  // Compare registry with git
  const discrepancies = [];
  const registryWorktrees = registry.worktrees;

  // Check registry entries against filesystem and git
  for (const [key, entry] of Object.entries(registryWorktrees)) {
    if (entry.status === 'removed') continue;

    const pathExists = fs.existsSync(entry.path);
    const inGit = gitWorktrees.some(gw => gw.path === entry.path);

    if (!pathExists) {
      discrepancies.push({
        type: 'path_missing',
        key,
        registry_path: entry.path,
        message: `Registry entry ${key} points to non-existent path`,
      });
    } else if (!inGit) {
      discrepancies.push({
        type: 'not_in_git',
        key,
        registry_path: entry.path,
        message: `Registry entry ${key} path exists but not in git worktree list`,
      });
    }
  }

  // Check git worktrees not in registry (excluding main worktree)
  for (const gw of gitWorktrees) {
    if (gw.bare) continue;

    const inRegistry = Object.values(registryWorktrees).some(
      entry => entry.path === gw.path && entry.status === 'active'
    );

    // Skip the main worktree (it won't be in registry)
    const isMainWorktree = gw.path === cwd || gw.path === path.resolve(cwd);

    if (!inRegistry && !isMainWorktree) {
      discrepancies.push({
        type: 'not_in_registry',
        git_path: gw.path,
        git_branch: gw.branch,
        message: `Git worktree at ${gw.path} not tracked in registry`,
      });
    }
  }

  output({
    registry_count: Object.keys(registryWorktrees).filter(k => registryWorktrees[k].status === 'active').length,
    git_count: gitWorktrees.filter(gw => !gw.bare).length,
    discrepancies,
    synced: discrepancies.length === 0,
  }, raw);
}

// ─── Lock Commands ────────────────────────────────────────────────────────────

function cmdLockRecord(cwd, phase, output, error, raw) {
  if (!phase) {
    error('phase required for lock record');
  }

  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  const key = `phase-${phase}`;

  const lockEntry = {
    acquired: new Date().toISOString(),
    owner: process.env.USER || process.env.USERNAME || 'unknown',
    pid: process.pid,
    hostname: os.hostname(),
  };

  registry.locks[key] = lockEntry;
  saveRegistry(cwd, registry);

  output({
    recorded: true,
    key,
    lock: lockEntry,
  }, raw, key);
}

function cmdLockClear(cwd, phase, output, error, raw) {
  if (!phase) {
    error('phase required for lock clear');
  }

  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  const key = `phase-${phase}`;

  if (!registry.locks[key]) {
    output({
      cleared: false,
      reason: 'not_locked',
      key,
    }, raw, 'not_locked');
    return;
  }

  delete registry.locks[key];
  saveRegistry(cwd, registry);

  output({
    cleared: true,
    key,
  }, raw, key);
}

function cmdLockCheck(cwd, phase, output, error, raw) {
  if (!phase) {
    error('phase required for lock check');
  }

  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  const key = `phase-${phase}`;

  if (!registry.locks[key]) {
    process.stderr.write(`Error: Phase ${phase} is not locked\n`);
    process.exit(1);
  }

  const lock = registry.locks[key];
  output({
    locked: true,
    key,
    lock,
  }, raw, JSON.stringify(lock));
}

function cmdLockList(cwd, output, error, raw) {
  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  const locks = Object.entries(registry.locks).map(([key, value]) => ({
    key,
    ...value,
  }));

  output(locks, raw, JSON.stringify(locks));
}

function cmdLockStale(cwd, phase, output, error, raw) {
  if (!phase) {
    error('phase required for lock stale');
  }

  const registry = loadRegistry(cwd);
  if (!registry) {
    error('Registry not initialized. Run: gsd-tools worktree init');
  }

  const key = `phase-${phase}`;

  if (!registry.locks[key]) {
    output({
      stale: false,
      reason: 'not_locked',
      key,
    }, raw);
    return;
  }

  const lock = registry.locks[key];

  // Check if PID still exists
  let pidAlive = false;
  try {
    // process.kill with signal 0 tests if process exists without killing it
    process.kill(lock.pid, 0);
    pidAlive = true;
  } catch {
    // Process doesn't exist
    pidAlive = false;
  }

  // Check age (consider stale if older than 24 hours)
  const acquiredTime = new Date(lock.acquired).getTime();
  const now = Date.now();
  const ageHours = (now - acquiredTime) / (1000 * 60 * 60);
  const ageExceeded = ageHours > 24;

  let stale = false;
  let reason = 'active';

  if (!pidAlive) {
    stale = true;
    reason = 'pid_dead';
  } else if (ageExceeded) {
    stale = true;
    reason = 'age_exceeded';
  }

  output({
    stale,
    reason,
    key,
    lock,
    age_hours: Math.round(ageHours * 10) / 10,
  }, raw);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  REGISTRY_PATH,

  // Registry helpers
  getRegistryPath,
  loadRegistry,
  saveRegistry,

  // Worktree commands
  cmdWorktreeInit,
  cmdWorktreeAdd,
  cmdWorktreeRemove,
  cmdWorktreeGet,
  cmdWorktreeList,
  cmdWorktreeStatus,

  // Lock commands
  cmdLockRecord,
  cmdLockClear,
  cmdLockCheck,
  cmdLockList,
  cmdLockStale,
};
