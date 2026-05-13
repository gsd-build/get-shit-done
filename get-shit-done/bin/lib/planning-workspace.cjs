/**
 * Planning Workspace — .planning path resolution + active workstream routing.
 *
 * This module owns the planning workspace seam:
 * - planningDir/planningRoot/planningPaths
 * - active workstream pointer policy (session-scoped > shared)
 * - pointer storage adapters (session/shared/memory)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { probeTty, platformWriteSync, platformReadSync, platformEnsureDir } = require('./shell-command-projection.cjs');
const { isValidActiveWorkstreamName } = require('./workstream-name-policy.cjs');

const WORKSTREAM_SESSION_ENV_KEYS = [
  'GSD_SESSION_KEY',
  'CODEX_THREAD_ID',
  'CLAUDE_SESSION_ID',
  'CLAUDE_CODE_SSE_PORT',
  'OPENCODE_SESSION_ID',
  'GEMINI_SESSION_ID',
  'CURSOR_SESSION_ID',
  'WINDSURF_SESSION_ID',
  'TERM_SESSION_ID',
  'WT_SESSION',
  'TMUX_PANE',
  'ZELLIJ_SESSION_NAME',
];

let cachedControllingTtyToken = null;
let didProbeControllingTtyToken = false;

// Track .planning/.lock files held by this process so they can be removed on exit.
const _heldPlanningLocks = new Set();
process.on('exit', () => {
  for (const lockPath of _heldPlanningLocks) {
    try { fs.unlinkSync(lockPath); } catch { /* already gone */ }
  }
});

function planningDir(cwd, ws, project) {
  if (project === undefined) project = process.env.GSD_PROJECT || null;
  if (ws === undefined) ws = process.env.GSD_WORKSTREAM || null;

  // Reject path separators and traversal components in project/workstream names
  const BAD_SEGMENT = /[/\\]|\.\./;
  if (project && BAD_SEGMENT.test(project)) {
    throw new Error(`GSD_PROJECT contains invalid path characters: ${project}`);
  }
  if (ws && BAD_SEGMENT.test(ws)) {
    throw new Error(`GSD_WORKSTREAM contains invalid path characters: ${ws}`);
  }

  let base = path.join(cwd, '.planning');
  if (project) base = path.join(base, project);
  if (ws) base = path.join(base, 'workstreams', ws);
  return base;
}

function planningRoot(cwd) {
  return path.join(cwd, '.planning');
}

function planningPaths(cwd, ws) {
  const base = planningDir(cwd, ws);
  return {
    planning: base,
    state: path.join(base, 'STATE.md'),
    roadmap: path.join(base, 'ROADMAP.md'),
    project: path.join(base, 'PROJECT.md'),
    config: path.join(base, 'config.json'),
    phases: path.join(base, 'phases'),
    requirements: path.join(base, 'REQUIREMENTS.md'),
  };
}

function sanitizeWorkstreamSessionToken(value) {
  if (value === null || value === undefined) return null;
  const token = String(value).trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return token ? token.slice(0, 160) : null;
}

function probeControllingTtyToken() {
  if (didProbeControllingTtyToken) return cachedControllingTtyToken;
  didProbeControllingTtyToken = true;

  // `tty` reads stdin. When stdin is already non-interactive, spawning it only
  // adds avoidable failures on the routing hot path and cannot reveal a stable token.
  if (!(process.stdin && process.stdin.isTTY)) {
    return cachedControllingTtyToken;
  }

  const ttyPath = probeTty();
  if (ttyPath) {
    const token = sanitizeWorkstreamSessionToken(ttyPath.replace(/^\/dev\//, ''));
    if (token) cachedControllingTtyToken = `tty-${token}`;
  }

  return cachedControllingTtyToken;
}

function getControllingTtyToken() {
  for (const envKey of ['TTY', 'SSH_TTY']) {
    const token = sanitizeWorkstreamSessionToken(process.env[envKey]);
    if (token) return `tty-${token.replace(/^dev_/, '')}`;
  }

  return probeControllingTtyToken();
}

function getWorkstreamSessionKey() {
  for (const envKey of WORKSTREAM_SESSION_ENV_KEYS) {
    const raw = process.env[envKey];
    const token = sanitizeWorkstreamSessionToken(raw);
    if (token) return `${envKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${token}`;
  }

  return getControllingTtyToken();
}

function getSessionScopedWorkstreamFile(cwd, fixedSessionKey) {
  const sessionKey = fixedSessionKey || getWorkstreamSessionKey();
  if (!sessionKey) return null;

  // Use realpathSync.native so the hash is derived from the canonical filesystem
  // path. On Windows, path.resolve returns whatever case the caller supplied,
  // while realpathSync.native returns the case the OS recorded — they differ on
  // case-insensitive NTFS, producing different hashes and different tmpdir slots.
  // Fall back to path.resolve when the directory does not yet exist.
  let planningAbs;
  try {
    planningAbs = fs.realpathSync.native(planningRoot(cwd));
  } catch {
    planningAbs = path.resolve(planningRoot(cwd));
  }
  const projectId = crypto
    .createHash('sha1')
    .update(planningAbs)
    .digest('hex')
    .slice(0, 16);

  const dirPath = path.join(os.tmpdir(), 'gsd-workstream-sessions', projectId);
  return {
    sessionKey,
    dirPath,
    filePath: path.join(dirPath, sessionKey),
  };
}

function createSharedPointerAdapter(cwd) {
  const filePath = path.join(planningRoot(cwd), 'active-workstream');
  return {
    read() {
      const raw = platformReadSync(filePath);
      return raw ? raw.trim() || null : null;
    },
    write(name) {
      platformWriteSync(filePath, name + '\n');
    },
    clear() {
      try { fs.unlinkSync(filePath); } catch {}
    },
  };
}

function createSessionScopedPointerAdapter(cwd, fixedSessionKey) {
  const scoped = getSessionScopedWorkstreamFile(cwd, fixedSessionKey);
  if (!scoped) return null;

  return {
    read() {
      const raw = platformReadSync(scoped.filePath);
      return raw ? raw.trim() || null : null;
    },
    write(name) {
      platformEnsureDir(scoped.dirPath);
      platformWriteSync(scoped.filePath, name + '\n');
    },
    clear() {
      try { fs.unlinkSync(scoped.filePath); } catch {}
      try {
        const remaining = fs.readdirSync(scoped.dirPath);
        if (remaining.length === 0) {
          fs.rmdirSync(scoped.dirPath);
        }
      } catch {}
    },
  };
}

function createMemoryPointerAdapter(initialName = null) {
  let value = initialName;
  return {
    read() {
      return value;
    },
    write(name) {
      value = name;
    },
    clear() {
      value = null;
    },
  };
}

function pickActiveWorkstreamAdapter(cwd, opts = {}) {
  if (opts.activeWorkstreamAdapter) {
    return opts.activeWorkstreamAdapter;
  }

  const sessionKey = getWorkstreamSessionKey();
  if (sessionKey) {
    if (opts.activeWorkstreamAdapters && opts.activeWorkstreamAdapters.session) {
      return opts.activeWorkstreamAdapters.session;
    }
    return createSessionScopedPointerAdapter(cwd, sessionKey);
  }

  if (opts.activeWorkstreamAdapters && opts.activeWorkstreamAdapters.shared) {
    return opts.activeWorkstreamAdapters.shared;
  }
  return createSharedPointerAdapter(cwd);
}

function validateWorkstreamName(name) {
  return isValidActiveWorkstreamName(name);
}

function withPlanningLock(cwd, fn) {
  const lockPath = path.join(planningDir(cwd), '.lock');
  const lockTimeout = 10000; // 10 seconds
  const start = Date.now();

  // Ensure .planning/ exists
  try { platformEnsureDir(planningDir(cwd)); } catch { /* ok */ }

  function runWithHeldLock() {
    // Atomic create — fails if file exists
    fs.writeFileSync(lockPath, JSON.stringify({
      pid: process.pid,
      cwd,
      acquired: new Date().toISOString(),
    }), { flag: 'wx' });

    _heldPlanningLocks.add(lockPath);

    // Lock acquired — run the function
    try {
      return fn();
    } finally {
      _heldPlanningLocks.delete(lockPath);
      try { fs.unlinkSync(lockPath); } catch { /* already released */ }
    }
  }

  while (Date.now() - start < lockTimeout) {
    try {
      return runWithHeldLock();
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock exists — check if stale (>30s old)
        try {
          const stat = fs.statSync(lockPath);
          if (Date.now() - stat.mtimeMs > 30000) {
            fs.unlinkSync(lockPath);
            continue; // retry
          }
        } catch { continue; }

        // Wait and retry (cross-platform, no shell dependency)
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        continue;
      }
      throw err;
    }
  }

  // Timeout — stale-lock recovery, then re-acquire atomically before entering critical section.
  try { fs.unlinkSync(lockPath); } catch { /* ok */ }
  return runWithHeldLock();
}

function createPlanningWorkspace(cwd, opts = {}) {
  return {
    paths: {
      dir(ws, project) {
        return planningDir(cwd, ws, project);
      },
      root() {
        return planningRoot(cwd);
      },
      all(ws) {
        return planningPaths(cwd, ws);
      },
    },
    activeWorkstream: {
      get() {
        const adapter = pickActiveWorkstreamAdapter(cwd, opts);
        if (!adapter) return null;

        const name = adapter.read();
        if (!name || !validateWorkstreamName(name)) {
          adapter.clear();
          return null;
        }

        const wsDir = path.join(planningRoot(cwd), 'workstreams', name);
        if (!fs.existsSync(wsDir)) {
          adapter.clear();
          return null;
        }

        return name;
      },
      set(name) {
        const adapter = pickActiveWorkstreamAdapter(cwd, opts);
        if (!adapter) return;

        if (!name) {
          adapter.clear();
          return;
        }
        if (!validateWorkstreamName(name)) {
          throw new Error('Invalid workstream name: must be alphanumeric, hyphens, underscores, or dots');
        }

        const wsDir = path.join(planningRoot(cwd), 'workstreams', name);
        platformEnsureDir(wsDir);
        adapter.write(name);
      },
      clear() {
        const adapter = pickActiveWorkstreamAdapter(cwd, opts);
        if (!adapter) return;
        adapter.clear();
      },
    },
  };
}

function getActiveWorkstream(cwd) {
  return createPlanningWorkspace(cwd).activeWorkstream.get();
}

function setActiveWorkstream(cwd, name) {
  createPlanningWorkspace(cwd).activeWorkstream.set(name);
}

module.exports = {
  createPlanningWorkspace,
  createSharedPointerAdapter,
  createSessionScopedPointerAdapter,
  createMemoryPointerAdapter,
  planningDir,
  planningRoot,
  planningPaths,
  withPlanningLock,
  getActiveWorkstream,
  setActiveWorkstream,
};
