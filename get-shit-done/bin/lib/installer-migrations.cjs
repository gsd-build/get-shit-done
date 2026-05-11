'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  validateInstallerMigrationActions,
  validateInstallerMigrationRecord,
} = require('./installer-migration-authoring.cjs');

const MANIFEST_NAME = 'gsd-file-manifest.json';
const INSTALL_STATE_NAME = 'gsd-install-state.json';
const INSTALL_MIGRATION_LOCK_NAME = 'gsd-install-migration.lock';
const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, 'installer-migrations');
const DEFAULT_LOCK_TIMEOUT_MS = 30_000;
const STRICT_JSON = Symbol('strict-json');

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = fs.openSync(filePath, 'r');
  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJsonIfPresent(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (fallback === STRICT_JSON) {
      throw new Error(`invalid installer migration state JSON: ${filePath}: ${error.message}`);
    }
    return fallback;
  }
}

function readInstallManifest(configDir) {
  const manifest = readJsonIfPresent(path.join(configDir, MANIFEST_NAME), null);
  if (!manifest || typeof manifest !== 'object') {
    return { version: null, timestamp: null, mode: null, files: {} };
  }
  return {
    version: manifest.version || null,
    timestamp: manifest.timestamp || null,
    mode: manifest.mode || null,
    files: manifest.files && typeof manifest.files === 'object' ? manifest.files : {},
  };
}

function readInstallState(configDir) {
  const state = readJsonIfPresent(path.join(configDir, INSTALL_STATE_NAME), STRICT_JSON);
  if (!state || typeof state !== 'object') {
    return { schemaVersion: 1, appliedMigrations: [] };
  }
  return {
    schemaVersion: state.schemaVersion || 1,
    appliedMigrations: Array.isArray(state.appliedMigrations) ? state.appliedMigrations : [],
  };
}

function writeInstallState(configDir, state) {
  fs.mkdirSync(configDir, { recursive: true });
  writeFileAtomicSync(path.join(configDir, INSTALL_STATE_NAME), JSON.stringify(state, null, 2) + '\n');
  return state;
}

function readJson(configDir, relPath) {
  const { fullPath } = ensureInsideConfig(configDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return { exists: false, value: null, error: null };
  }
  try {
    return { exists: true, value: JSON.parse(fs.readFileSync(fullPath, 'utf8')), error: null };
  } catch (error) {
    return { exists: true, value: null, error };
  }
}

function normalizeRelPath(relPath) {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    throw new Error('migration action relPath must be a non-empty string');
  }
  const normalized = relPath.replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || path.win32.isAbsolute(normalized)) {
    throw new Error(`migration action relPath must stay inside configDir: ${relPath}`);
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`migration action relPath must stay inside configDir: ${relPath}`);
  }
  return segments.join('/');
}

function classifyArtifact(configDir, relPath, manifest) {
  const normalized = normalizeRelPath(relPath);
  const originalHash = manifest.files[normalized] || null;
  const fullPath = path.join(configDir, normalized);
  if (!fs.existsSync(fullPath)) {
    return { classification: originalHash ? 'managed-missing' : 'missing', originalHash, currentHash: null };
  }
  const currentHash = sha256File(fullPath);
  if (!originalHash) {
    return { classification: 'unknown', originalHash: null, currentHash };
  }
  if (currentHash === originalHash) {
    return { classification: 'managed-pristine', originalHash, currentHash };
  }
  return { classification: 'managed-modified', originalHash, currentHash };
}

function appliedMigrationIds(state) {
  return new Set(
    state.appliedMigrations
      .filter((entry) => entry && typeof entry.id === 'string')
      .map((entry) => entry.id)
  );
}

function appliedMigrationEntries(state) {
  const entries = new Map();
  for (const entry of state.appliedMigrations) {
    if (entry && typeof entry.id === 'string' && !entries.has(entry.id)) {
      entries.set(entry.id, entry);
    }
  }
  return entries;
}

function migrationChecksum(migration) {
  const checksum = migration.checksum;
  if (typeof checksum === 'string' && checksum) return checksum;
  const serializable = {
    id: migration.id,
    title: migration.title || null,
    description: migration.description || null,
    introducedIn: migration.introducedIn || null,
    runtimes: migration.runtimes || null,
    scopes: migration.scopes || null,
    destructive: migration.destructive === true,
    runtimeContract: migration.runtimeContract || null,
    plan: typeof migration.plan === 'function' ? migration.plan.toString() : null,
  };
  return `sha256:${sha256Text(JSON.stringify(serializable))}`;
}

function assertAppliedMigrationChecksums(applied, migrations) {
  for (const migration of migrations) {
    const entry = applied.get(migration.id);
    if (!entry || !entry.checksum) continue;
    const checksum = migrationChecksum(migration);
    if (entry.checksum !== checksum) {
      throw new Error(
        `applied migration checksum changed for ${migration.id}; create a new fix-forward migration id`
      );
    }
  }
}

function migrationMatchesContext(migration, { runtime, scope }) {
  if (Array.isArray(migration.runtimes) && migration.runtimes.length > 0) {
    if (!runtime || !migration.runtimes.includes(runtime)) return false;
  }
  if (Array.isArray(migration.scopes) && migration.scopes.length > 0) {
    if (!scope || !migration.scopes.includes(scope)) return false;
  }
  return true;
}

function discoverInstallerMigrations({ migrationsDir }) {
  if (!migrationsDir || !fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.cjs'))
    .map((entry) => entry.name)
    .sort()
    .flatMap((fileName) => {
      const source = path.join(migrationsDir, fileName);
      delete require.cache[require.resolve(source)];
      const exported = require(source);
      const records = Array.isArray(exported) ? exported : [exported];
      return records.map((record) => validateInstallerMigrationRecord(record, source));
    });
}

function journalTimestamp(now) {
  return now().replace(/[:.]/g, '-');
}

function migrationRunId(appliedAt) {
  return `${journalTimestamp(() => appliedAt)}-${crypto.randomBytes(8).toString('hex')}`;
}

function sleepSync(ms) {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, ms);
}

function acquireInstallMigrationLock(configDir, { timeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = {}) {
  fs.mkdirSync(configDir, { recursive: true });
  const lockPath = path.join(configDir, INSTALL_MIGRATION_LOCK_NAME);
  const started = Date.now();

  while (true) {
    let fd = null;
    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, JSON.stringify({
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
      }) + '\n');
      return () => {
        const failures = [];
        try { fs.closeSync(fd); } catch (error) { failures.push(error); }
        try { fs.rmSync(lockPath, { force: true }); } catch (error) { failures.push(error); }
        if (failures.length > 0) {
          const releaseError = new Error(`failed to release installer migration lock: ${lockPath}`);
          releaseError.failures = failures;
          throw releaseError;
        }
      };
    } catch (error) {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch { /* best-effort */ }
        try { fs.rmSync(lockPath, { force: true }); } catch { /* best-effort */ }
      }
      if (error && error.code === 'EEXIST') {
        if (Date.now() - started >= timeoutMs) {
          throw new Error(`installer migration lock is held: ${lockPath}`);
        }
        sleepSync(Math.min(50, Math.max(1, timeoutMs - (Date.now() - started))));
        continue;
      }
      throw error;
    }
  }
}

function ensureInsideConfig(configDir, relPath) {
  const normalized = normalizeRelPath(relPath);
  const fullPath = path.resolve(configDir, normalized);
  const root = path.resolve(configDir);
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new Error(`migration path escapes configDir: ${relPath}`);
  }
  return { normalized, fullPath };
}

function isStructurallyEmpty(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === 'object' && Object.keys(value).length === 0;
}

function writeFileAtomicSync(filePath, content) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {
      // best-effort cleanup only; preserve the original write failure
    }
    throw error;
  }
}

function journalAction(action, status, extras = {}) {
  const { value, ...safeAction } = action;
  return { ...safeAction, ...extras, status };
}

function planInstallerMigrations({
  configDir,
  runtime = null,
  scope = null,
  migrations,
  baselineScan = false,
  now = () => new Date().toISOString(),
}) {
  if (!configDir) throw new Error('configDir is required');
  if (!Array.isArray(migrations)) throw new Error('migrations must be an array');

  const manifest = readInstallManifest(configDir);
  const state = readInstallState(configDir);
  const validatedMigrations = migrations.map((migration) =>
    validateInstallerMigrationRecord(migration)
  );
  const scopedMigrations = validatedMigrations.filter((migration) =>
    migrationMatchesContext(migration, { runtime, scope })
  );
  const applied = appliedMigrationEntries(state);
  assertAppliedMigrationChecksums(applied, scopedMigrations);
  const pending = scopedMigrations.filter((migration) => !applied.has(migration.id));
  const actions = [];
  const blocked = [];
  const classifications = new Map();
  const classify = (relPath) => {
    const normalized = normalizeRelPath(relPath);
    if (!classifications.has(normalized)) {
      classifications.set(normalized, classifyArtifact(configDir, normalized, manifest));
    }
    return classifications.get(normalized);
  };

  for (const migration of pending) {
    const plannedActions = migration.plan({
      configDir,
      runtime,
      scope,
      manifest,
      state,
      baselineScan,
      now,
      classifyArtifact: classify,
      readJson: (relPath) => readJson(configDir, relPath),
    });
    validateInstallerMigrationActions(plannedActions, migration);
    const checksum = migrationChecksum(migration);
    for (const rawAction of plannedActions) {
      const relPath = normalizeRelPath(rawAction.relPath);
      const classification = rawAction.classification
        ? {
            classification: rawAction.classification,
            originalHash: rawAction.originalHash || null,
            currentHash: rawAction.currentHash || null,
          }
        : classify(relPath);
      let protectedType = rawAction.type;
      if (rawAction.type === 'remove-managed' && classification.classification === 'managed-modified') {
        protectedType = 'backup-and-remove';
      }
      if (rawAction.type === 'remove-managed' && classification.classification === 'unknown') {
        protectedType = 'preserve-user';
      }
      const action = {
        migrationId: migration.id,
        migrationChecksum: checksum,
        type: protectedType,
        relPath,
        reason: rawAction.reason || migration.description || '',
        classification: classification.classification,
        originalHash: classification.originalHash,
        currentHash: classification.currentHash,
      };
      if (action.type !== rawAction.type) {
        action.requestedType = rawAction.type;
      }
      if (action.type === 'backup-and-remove') {
        action.backupRelPath = null;
      }
      if (action.type === 'rewrite-json') {
        action.value = rawAction.value;
        action.deleteIfEmpty = rawAction.deleteIfEmpty === true;
      }
      if (rawAction.prompt) action.prompt = rawAction.prompt;
      if (Array.isArray(rawAction.choices)) action.choices = rawAction.choices;
      if (action.type === 'prompt-user') {
        blocked.push(action);
      } else if (
        action.classification === 'unknown' &&
        action.type !== 'rewrite-json' &&
        action.type !== 'record-baseline' &&
        action.type !== 'baseline-preserve-user'
      ) {
        blocked.push(action);
      }
      actions.push(action);
    }
  }

  return {
    generatedAt: now(),
    manifest,
    state,
    pendingMigrationIds: pending.map((migration) => migration.id),
    pendingMigrations: pending,
    actions,
    blocked,
  };
}

function uniqueActionMigrationIds(actions) {
  return [...new Set(actions.map((action) => action.migrationId).filter(Boolean))];
}

function rollbackAppliedMigrationResult({ configDir, journal, journalPath, rollbackRoot, backupRoot, previousInstallStateBytes }) {
  const failures = [];
  for (const action of [...journal.actions].reverse()) {
    if (!action.rollbackRelPath) continue;
    const rollbackPath = path.join(configDir, action.rollbackRelPath);
    const dest = path.join(configDir, action.relPath);
    try {
      if (fs.existsSync(rollbackPath)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(rollbackPath, dest);
      }
    } catch (error) {
      failures.push({ relPath: action.relPath, error: error.message });
    }
    if (action.backupRelPath) {
      try {
        fs.rmSync(path.join(configDir, action.backupRelPath), { force: true });
      } catch {
        // backup cleanup is best-effort; preserve restore failures above
      }
    }
  }

  try {
    if (previousInstallStateBytes === null) {
      fs.rmSync(path.join(configDir, INSTALL_STATE_NAME), { force: true });
    } else {
      fs.mkdirSync(configDir, { recursive: true });
      writeFileAtomicSync(path.join(configDir, INSTALL_STATE_NAME), previousInstallStateBytes);
    }
  } catch (error) {
    failures.push({ relPath: INSTALL_STATE_NAME, error: error.message });
  }

  try {
    fs.rmSync(journalPath, { force: true });
    fs.rmSync(rollbackRoot, { recursive: true, force: true });
    fs.rmSync(backupRoot, { recursive: true, force: true });
  } catch {
    // journal cleanup is best-effort; the rollback above is the safety-critical part
  }

  if (failures.length > 0) {
    const error = new Error('migration rollback incomplete');
    error.rollbackFailures = failures;
    throw error;
  }
}

function cleanupMigrationRunArtifacts(journalPath, rollbackRoot, backupRoot) {
  try { fs.rmSync(journalPath, { force: true }); } catch { /* best-effort */ }
  try { fs.rmSync(rollbackRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
  try { fs.rmSync(backupRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
}

function applyInstallerMigrationPlan({ configDir, plan, now = () => new Date().toISOString() }) {
  if (!configDir) throw new Error('configDir is required');
  if (!plan || !Array.isArray(plan.actions)) throw new Error('plan with actions is required');
  if (Array.isArray(plan.blocked) && plan.blocked.length > 0) {
    throw new Error(`migration plan has ${plan.blocked.length} blocked action(s)`);
  }

  const appliedAt = now();
  const runId = migrationRunId(appliedAt);
  const journalRelPath = path.posix.join('gsd-migration-journal', `${runId}.json`);
  const journalPath = path.join(configDir, journalRelPath);
  const rollbackRootRelPath = path.posix.join('gsd-migration-journal', `${runId}-rollback`);
  const rollbackRoot = path.join(configDir, rollbackRootRelPath);
  const backupRootRelPath = path.posix.join('gsd-migration-journal', `${runId}-backups`);
  const backupRoot = path.join(configDir, backupRootRelPath);
  const journal = {
    schemaVersion: 1,
    appliedAt,
    appliedMigrationIds: uniqueActionMigrationIds(plan.actions),
    actions: [],
  };
  const rollback = [];
  const installStatePath = path.join(configDir, INSTALL_STATE_NAME);
  const previousInstallStateBytes = fs.existsSync(installStatePath)
    ? fs.readFileSync(installStatePath)
    : null;

  try {
    fs.mkdirSync(path.dirname(journalPath), { recursive: true });
    fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n', 'utf8');

    for (const action of plan.actions) {
      if (
        action.type !== 'remove-managed' &&
        action.type !== 'backup-and-remove' &&
        action.type !== 'rewrite-json' &&
        action.type !== 'record-baseline' &&
        action.type !== 'baseline-preserve-user'
      ) {
        throw new Error(`unsupported migration action type: ${action.type}`);
      }

      const { normalized, fullPath } = ensureInsideConfig(configDir, action.relPath);
      if (!fs.existsSync(fullPath)) {
        journal.actions.push(journalAction(action, 'missing'));
        continue;
      }

      if (action.type === 'record-baseline' || action.type === 'baseline-preserve-user') {
        journal.actions.push(journalAction(action, action.type === 'record-baseline' ? 'recorded' : 'preserved'));
        continue;
      }

      const rollbackPath = path.join(rollbackRoot, normalized);
      fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
      fs.copyFileSync(fullPath, rollbackPath);
      rollback.push({ relPath: normalized, rollbackPath });

      if (action.type === 'rewrite-json') {
        if (action.deleteIfEmpty && isStructurallyEmpty(action.value)) {
          fs.rmSync(fullPath, { force: true });
          journal.actions.push(journalAction(action, 'removed', {
            rollbackRelPath: path.posix.join(rollbackRootRelPath, normalized),
          }));
        } else {
          writeFileAtomicSync(fullPath, JSON.stringify(action.value, null, 2) + '\n');
          journal.actions.push(journalAction(action, 'rewritten', {
            rollbackRelPath: path.posix.join(rollbackRootRelPath, normalized),
          }));
        }
        continue;
      }

      if (action.type === 'backup-and-remove') {
        const backupRelPath = action.backupRelPath || path.posix.join(backupRootRelPath, normalized);
        const backupPath = path.join(configDir, backupRelPath);
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.copyFileSync(fullPath, backupPath);
        journal.actions.push(journalAction(action, 'removed', {
          backupRelPath,
          rollbackRelPath: path.posix.join(rollbackRootRelPath, normalized),
        }));
      } else {
        journal.actions.push(journalAction(action, 'removed', {
          rollbackRelPath: path.posix.join(rollbackRootRelPath, normalized),
        }));
      }
      fs.rmSync(fullPath, { force: true });
    }

    fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n', 'utf8');

    const state = readInstallState(configDir);
    const applied = appliedMigrationIds(state);
    const nextApplied = [...state.appliedMigrations];
    const actionsByMigrationId = new Map();
    for (const action of plan.actions) {
      if (action.migrationId && !actionsByMigrationId.has(action.migrationId)) {
        actionsByMigrationId.set(action.migrationId, action);
      }
    }
    for (const id of journal.appliedMigrationIds) {
      if (!applied.has(id)) {
        const action = actionsByMigrationId.get(id);
        nextApplied.push({
          id,
          appliedAt,
          journal: journalRelPath,
          checksum: action && action.migrationChecksum ? action.migrationChecksum : null,
        });
      }
    }
    writeInstallState(configDir, {
      schemaVersion: 1,
      appliedMigrations: nextApplied,
    });

    return {
      appliedMigrationIds: journal.appliedMigrationIds,
      journalRelPath,
      rollback: () => rollbackAppliedMigrationResult({ configDir, journal, journalPath, rollbackRoot, backupRoot, previousInstallStateBytes }),
    };
  } catch (error) {
    const rollbackFailures = [];
    for (const entry of rollback.reverse()) {
      const dest = path.join(configDir, entry.relPath);
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(entry.rollbackPath, dest);
      } catch (rollbackError) {
        rollbackFailures.push({
          relPath: entry.relPath,
          rollbackPath: entry.rollbackPath,
          error: rollbackError.message,
        });
      }
    }
    if (rollbackFailures.length > 0) {
      const rollbackError = new Error(`migration apply failed and rollback incomplete: ${error.message}`);
      rollbackError.cause = error;
      rollbackError.rollbackFailures = rollbackFailures;
      throw rollbackError;
    }
    cleanupMigrationRunArtifacts(journalPath, rollbackRoot, backupRoot);
    throw error;
  }
}

function markPendingMigrationsApplied({ configDir, plan, now = () => new Date().toISOString() }) {
  if (!plan || !Array.isArray(plan.pendingMigrationIds) || plan.pendingMigrationIds.length === 0) {
    return [];
  }
  const appliedAt = now();
  const state = readInstallState(configDir);
  const applied = appliedMigrationIds(state);
  const checksumsByMigrationId = new Map();
  for (const migration of plan.pendingMigrations || []) {
    checksumsByMigrationId.set(migration.id, migrationChecksum(migration));
  }
  const nextApplied = [...state.appliedMigrations];
  const newlyApplied = [];
  for (const id of plan.pendingMigrationIds) {
    if (applied.has(id)) continue;
    nextApplied.push({
      id,
      appliedAt,
      journal: null,
      checksum: checksumsByMigrationId.get(id) || null,
    });
    newlyApplied.push(id);
  }
  if (newlyApplied.length > 0) {
    writeInstallState(configDir, {
      schemaVersion: 1,
      appliedMigrations: nextApplied,
    });
  }
  return newlyApplied;
}

function runInstallerMigrations({
  configDir,
  runtime = null,
  scope = null,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  migrations = discoverInstallerMigrations({ migrationsDir }),
  baselineScan = false,
  now = () => new Date().toISOString(),
  lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
} = {}) {
  const releaseLock = acquireInstallMigrationLock(configDir, { timeoutMs: lockTimeoutMs });
  let primaryError = null;
  let completed = false;
  try {
    const plan = planInstallerMigrations({ configDir, runtime, scope, migrations, baselineScan, now });
    if (plan.actions.length === 0) {
      const appliedMigrationIds = markPendingMigrationsApplied({ configDir, plan, now });
      completed = true;
      return {
        appliedMigrationIds,
        journalRelPath: null,
        plan,
      };
    }
    if (plan.blocked.length > 0) {
      completed = true;
      return {
        appliedMigrationIds: [],
        journalRelPath: null,
        plan,
        blocked: plan.blocked,
      };
    }
    const result = applyInstallerMigrationPlan({ configDir, plan, now });
    completed = true;
    return { ...result, plan };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      releaseLock();
    } catch (releaseError) {
      if (primaryError) {
        primaryError.suppressed = [...(primaryError.suppressed || []), releaseError];
      } else if (completed) {
        throw releaseError;
      } else {
        throw releaseError;
      }
    }
  }
}

module.exports = {
  DEFAULT_MIGRATIONS_DIR,
  INSTALL_MIGRATION_LOCK_NAME,
  INSTALL_STATE_NAME,
  MANIFEST_NAME,
  applyInstallerMigrationPlan,
  classifyArtifact,
  discoverInstallerMigrations,
  planInstallerMigrations,
  readInstallManifest,
  readInstallState,
  runInstallerMigrations,
  writeInstallState,
};
