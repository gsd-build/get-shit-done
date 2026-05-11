const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const {
  applyInstallerMigrationPlan,
  classifyArtifact,
  discoverInstallerMigrations,
  INSTALL_STATE_NAME,
  planInstallerMigrations,
  readInstallState,
  runInstallerMigrations,
  writeInstallState,
} = require('../get-shit-done/bin/lib/installer-migrations.cjs');
const firstTimeBaselineMigration = require('../get-shit-done/bin/lib/installer-migrations/000-first-time-baseline.cjs');

function createTempInstall() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-installer-migrations-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function writeFile(root, relPath, content) {
  const fullPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function writeManifest(root, files) {
  fs.writeFileSync(
    path.join(root, 'gsd-file-manifest.json'),
    JSON.stringify({
      version: '1.49.0',
      timestamp: '2026-05-10T00:00:00.000Z',
      mode: 'full',
      files,
    }, null, 2),
    'utf8'
  );
}

function migrationRecord(overrides = {}) {
  return {
    id: '2026-05-11-remove-old-hook',
    title: 'Remove retired hook',
    description: 'Remove retired hook',
    introducedIn: '1.50.0',
    scopes: ['global', 'local'],
    destructive: true,
    plan: () => [
      {
        type: 'remove-managed',
        relPath: 'hooks/old-hook.js',
        reason: 'retired hook',
        ownershipEvidence: 'test fixture manifest-managed hook',
      },
    ],
    ...overrides,
  };
}

function legacyCodexHook(configDir) {
  return {
    hooks: [
      {
        type: 'command',
        command: `node "${path.join(configDir, 'hooks', 'gsd-check-update.js')}"`,
      },
    ],
  };
}

function userHook(command) {
  return {
    hooks: [
      {
        type: 'command',
        command,
      },
    ],
  };
}

test('records a first-time baseline while preserving user-owned artifacts', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'get-shit-done/workflows/plan.md', 'managed workflow\n');
    writeFile(configDir, 'get-shit-done/USER-PROFILE.md', 'user profile\n');
    writeManifest(configDir, {
      'get-shit-done/workflows/plan.md': sha256('managed workflow\n'),
    });

    const result = runInstallerMigrations({
      configDir,
      runtime: 'claude',
      scope: 'global',
      migrations: [firstTimeBaselineMigration],
      baselineScan: true,
      now: () => '2026-05-11T00:00:00.000Z',
    });

    assert.deepEqual(result.appliedMigrationIds, ['2026-05-11-first-time-baseline-scan']);
    assert.equal(fs.readFileSync(path.join(configDir, 'get-shit-done/workflows/plan.md'), 'utf8'), 'managed workflow\n');
    assert.equal(fs.readFileSync(path.join(configDir, 'get-shit-done/USER-PROFILE.md'), 'utf8'), 'user profile\n');

    assert.deepEqual(
      result.plan.actions.map((action) => ({
        type: action.type,
        relPath: action.relPath,
        classification: action.classification,
      })),
      [
        {
          type: 'record-baseline',
          relPath: 'get-shit-done/workflows/plan.md',
          classification: 'managed-pristine',
        },
        {
          type: 'baseline-preserve-user',
          relPath: 'get-shit-done/USER-PROFILE.md',
          classification: 'user-owned',
        },
      ]
    );
    assert.deepEqual(readInstallState(configDir).appliedMigrations.map((entry) => entry.id), [
      '2026-05-11-first-time-baseline-scan',
    ]);
  } finally {
    cleanup(configDir);
  }
});

test('preserves unknown files discovered in known install surfaces by default', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/custom-user-hook.js', 'user hook\n');
    writeManifest(configDir, {});

    const result = runInstallerMigrations({
      configDir,
      runtime: 'claude',
      scope: 'global',
      migrations: [firstTimeBaselineMigration],
      baselineScan: true,
      now: () => '2026-05-11T00:00:01.000Z',
    });

    assert.deepEqual(result.blocked, undefined);
    assert.deepEqual(
      result.plan.actions.map((action) => ({
        type: action.type,
        relPath: action.relPath,
        classification: action.classification,
      })),
      [
        {
          type: 'baseline-preserve-user',
          relPath: 'hooks/custom-user-hook.js',
          classification: 'unknown',
        },
      ]
    );
    assert.equal(fs.readFileSync(path.join(configDir, 'hooks/custom-user-hook.js'), 'utf8'), 'user hook\n');
    assert.deepEqual(readInstallState(configDir).appliedMigrations.map((entry) => entry.id), [
      '2026-05-11-first-time-baseline-scan',
    ]);
  } finally {
    cleanup(configDir);
  }
});

test('preserves user-owned skill files during baseline without hashing their content', (t) => {
  const configDir = createTempInstall();
  const originalOpenSync = fs.openSync;
  t.after(() => {
    fs.openSync = originalOpenSync;
    cleanup(configDir);
  });

  writeFile(configDir, 'skills/custom-user-skill/SKILL.md', 'user skill\n');
  writeManifest(configDir, {});
  const userSkillPath = path.join(configDir, 'skills/custom-user-skill/SKILL.md');
  fs.openSync = (filePath, ...args) => {
    if (path.resolve(String(filePath)) === path.resolve(userSkillPath)) {
      throw new Error('user-owned skill content should not be hashed during baseline');
    }
    return originalOpenSync.call(fs, filePath, ...args);
  };

  const result = runInstallerMigrations({
    configDir,
    runtime: 'claude',
    scope: 'global',
    migrations: [firstTimeBaselineMigration],
    baselineScan: true,
    now: () => '2026-05-11T00:00:01.000Z',
  });

  assert.deepEqual(
    result.plan.actions.map((action) => ({
      type: action.type,
      relPath: action.relPath,
      classification: action.classification,
      currentHash: action.currentHash,
    })),
    [
      {
        type: 'baseline-preserve-user',
        relPath: 'skills/custom-user-skill/SKILL.md',
        classification: 'user-owned',
        currentHash: null,
      },
    ]
  );
});

test('blocks stale GSD-looking baseline artifacts for explicit user choice', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/gsd-retired-hook.js', 'old gsd hook\n');
    writeManifest(configDir, {});

    const result = runInstallerMigrations({
      configDir,
      runtime: 'claude',
      scope: 'global',
      migrations: [firstTimeBaselineMigration],
      baselineScan: true,
      now: () => '2026-05-11T00:00:02.000Z',
    });

    assert.deepEqual(result.appliedMigrationIds, []);
    assert.equal(result.journalRelPath, null);
    assert.equal(fs.existsSync(path.join(configDir, INSTALL_STATE_NAME)), false);
    assert.equal(fs.readFileSync(path.join(configDir, 'hooks/gsd-retired-hook.js'), 'utf8'), 'old gsd hook\n');
    assert.deepEqual(
      result.blocked.map((action) => ({
        type: action.type,
        relPath: action.relPath,
        classification: action.classification,
        choices: action.choices,
      })),
      [
        {
          type: 'prompt-user',
          relPath: 'hooks/gsd-retired-hook.js',
          classification: 'stale-gsd-looking',
          choices: ['keep', 'remove'],
        },
      ]
    );
  } finally {
    cleanup(configDir);
  }
});

test('records known generated agent artifacts so profile cleanup can remove them', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'agents/gsd-executor.md', 'old generated agent\n');
    writeFile(configDir, 'agents/gsd-executor.toml', 'old generated agent config\n');
    writeFile(configDir, 'agents/gsd-local-experiment.md', 'user experiment\n');
    writeManifest(configDir, {});

    const result = runInstallerMigrations({
      configDir,
      runtime: 'codex',
      scope: 'global',
      migrations: [firstTimeBaselineMigration],
      baselineScan: true,
      now: () => '2026-05-11T00:00:03.000Z',
    });

    assert.deepEqual(
      result.plan.actions.map((action) => ({
        type: action.type,
        relPath: action.relPath,
        classification: action.classification,
      })),
      [
        {
          type: 'record-baseline',
          relPath: 'agents/gsd-executor.md',
          classification: 'unknown',
        },
        {
          type: 'record-baseline',
          relPath: 'agents/gsd-executor.toml',
          classification: 'unknown',
        },
        {
          type: 'prompt-user',
          relPath: 'agents/gsd-local-experiment.md',
          classification: 'stale-gsd-looking',
        },
      ]
    );
    assert.deepEqual(result.blocked.map((action) => action.relPath), ['agents/gsd-local-experiment.md']);
    assert.equal(fs.readFileSync(path.join(configDir, 'agents/gsd-executor.md'), 'utf8'), 'old generated agent\n');
    assert.equal(fs.readFileSync(path.join(configDir, 'agents/gsd-executor.toml'), 'utf8'), 'old generated agent config\n');
    assert.equal(fs.readFileSync(path.join(configDir, 'agents/gsd-local-experiment.md'), 'utf8'), 'user experiment\n');
  } finally {
    cleanup(configDir);
  }
});

test('plans a pending migration against an unchanged managed file', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/old-hook.js', 'managed hook\n');
    writeManifest(configDir, {
      'hooks/old-hook.js': sha256('managed hook\n'),
    });

    const plan = planInstallerMigrations({
      configDir,
      migrations: [
        migrationRecord(),
      ],
      scope: 'global',
      now: () => '2026-05-11T00:00:00.000Z',
    });

    assert.deepEqual(plan.pendingMigrationIds, ['2026-05-11-remove-old-hook']);
    assert.equal(plan.blocked.length, 0);
    assert.equal(plan.actions.length, 1);
    assert.deepEqual(
      {
        migrationId: plan.actions[0].migrationId,
        type: plan.actions[0].type,
        relPath: plan.actions[0].relPath,
        reason: plan.actions[0].reason,
        classification: plan.actions[0].classification,
        originalHash: plan.actions[0].originalHash,
        currentHash: plan.actions[0].currentHash,
      },
      {
        migrationId: '2026-05-11-remove-old-hook',
        type: 'remove-managed',
        relPath: 'hooks/old-hook.js',
        reason: 'retired hook',
        classification: 'managed-pristine',
        originalHash: sha256('managed hook\n'),
        currentHash: sha256('managed hook\n'),
      }
    );
    assert.match(plan.actions[0].migrationChecksum, /^sha256:/);
  } finally {
    cleanup(configDir);
  }
});

test('plans backup before removal for a modified managed file', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/old-hook.js', 'user changed hook\n');
    writeManifest(configDir, {
      'hooks/old-hook.js': sha256('managed hook\n'),
    });

    const plan = planInstallerMigrations({
      configDir,
      migrations: [
        migrationRecord(),
      ],
      scope: 'global',
      now: () => '2026-05-11T00:00:00.000Z',
    });

    assert.equal(plan.blocked.length, 0);
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].type, 'backup-and-remove');
    assert.equal(plan.actions[0].classification, 'managed-modified');
    assert.equal(plan.actions[0].originalHash, sha256('managed hook\n'));
    assert.equal(plan.actions[0].currentHash, sha256('user changed hook\n'));
    assert.equal(plan.actions[0].backupRelPath, null);
  } finally {
    cleanup(configDir);
  }
});

test('blocks removal of unknown files by preserving them by default', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/custom-user-hook.js', 'user hook\n');
    writeManifest(configDir, {});

    const plan = planInstallerMigrations({
      configDir,
      migrations: [
        migrationRecord({
          plan: () => [
            {
              type: 'remove-managed',
              relPath: 'hooks/custom-user-hook.js',
              reason: 'retired hook',
              ownershipEvidence: 'test fixture asks to retire a matching hook path',
            },
          ],
        }),
      ],
      scope: 'global',
      now: () => '2026-05-11T00:00:00.000Z',
    });

    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].type, 'preserve-user');
    assert.equal(plan.actions[0].requestedType, 'remove-managed');
    assert.equal(plan.actions[0].classification, 'unknown');
    assert.deepEqual(plan.blocked, [plan.actions[0]]);
  } finally {
    cleanup(configDir);
  }
});

test('fails closed when install state JSON is malformed', (t) => {
  const configDir = createTempInstall();
  t.after(() => cleanup(configDir));

  fs.writeFileSync(path.join(configDir, INSTALL_STATE_NAME), '{ not json\n', 'utf8');

  assert.throws(
    () => readInstallState(configDir),
    /invalid installer migration state JSON/
  );
});

test('computes each migration checksum once per planned migration', (t) => {
  const configDir = createTempInstall();
  t.after(() => cleanup(configDir));

  writeFile(configDir, 'hooks/first.js', 'first hook\n');
  writeFile(configDir, 'hooks/second.js', 'second hook\n');
  writeManifest(configDir, {
    'hooks/first.js': sha256('first hook\n'),
    'hooks/second.js': sha256('second hook\n'),
  });
  let checksumReads = 0;
  const migration = {
    ...migrationRecord({
      id: '2026-05-11-remove-two-hooks',
      title: 'Remove two retired hooks',
      description: 'Remove retired hooks',
      plan: () => [
        {
          type: 'remove-managed',
          relPath: 'hooks/first.js',
          reason: 'retired hook',
          ownershipEvidence: 'test fixture manifest-managed hook',
        },
        {
          type: 'remove-managed',
          relPath: 'hooks/second.js',
          reason: 'retired hook',
          ownershipEvidence: 'test fixture manifest-managed hook',
        },
      ],
    }),
    get checksum() {
      checksumReads += 1;
      return 'sha256:precomputed';
    },
  };

  const plan = planInstallerMigrations({
    configDir,
    migrations: [migration],
    scope: 'global',
  });

  assert.equal(plan.actions.length, 2);
  assert.equal(checksumReads, 1);
});

test('classifies large files without loading the whole file through readFileSync', (t) => {
  const configDir = createTempInstall();
  const originalReadFileSync = fs.readFileSync;
  t.after(() => {
    fs.readFileSync = originalReadFileSync;
    cleanup(configDir);
  });

  const relPath = 'skills/gsd-large/SKILL.md';
  const fullPath = path.join(configDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, Buffer.alloc(1024 * 1024 + 1, 'a'));

  fs.readFileSync = (filePath, ...args) => {
    if (path.resolve(String(filePath)) === path.resolve(fullPath)) {
      throw new Error('large file should be streamed for hashing');
    }
    return originalReadFileSync.call(fs, filePath, ...args);
  };

  const artifact = classifyArtifact(configDir, relPath, { files: {} });

  assert.equal(artifact.classification, 'unknown');
  assert.match(artifact.currentHash, /^[0-9a-f]{64}$/);
});

test('applies an unblocked plan with a journal and install-state update', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/old-hook.js', 'managed hook\n');
    writeManifest(configDir, {
      'hooks/old-hook.js': sha256('managed hook\n'),
    });

    const plan = planInstallerMigrations({
      configDir,
      migrations: [
        migrationRecord(),
      ],
      scope: 'global',
      now: () => '2026-05-11T00:00:00.000Z',
    });

    const result = applyInstallerMigrationPlan({
      configDir,
      plan,
      now: () => '2026-05-11T00:00:01.000Z',
    });

    assert.equal(fs.existsSync(path.join(configDir, 'hooks/old-hook.js')), false);
    assert.deepEqual(result.appliedMigrationIds, ['2026-05-11-remove-old-hook']);
    assert.match(
      result.journalRelPath,
      /^gsd-migration-journal\/2026-05-11T00-00-01-000Z-[0-9a-f]+\.json$/
    );

    const journal = JSON.parse(fs.readFileSync(path.join(configDir, result.journalRelPath), 'utf8'));
    assert.deepEqual(journal.appliedMigrationIds, ['2026-05-11-remove-old-hook']);
    assert.equal(journal.actions[0].relPath, 'hooks/old-hook.js');

    const state = readInstallState(configDir);
    assert.deepEqual(state.appliedMigrations.map((entry) => entry.id), ['2026-05-11-remove-old-hook']);
    assert.match(state.appliedMigrations[0].checksum, /^sha256:/);
  } finally {
    cleanup(configDir);
  }
});

test('uses unique journal paths for applies that share a timestamp', (t) => {
  const configDir = createTempInstall();
  t.after(() => cleanup(configDir));

  writeFile(configDir, 'hooks/first.js', 'first hook\n');
  writeFile(configDir, 'hooks/second.js', 'second hook\n');
  writeManifest(configDir, {
    'hooks/first.js': sha256('first hook\n'),
    'hooks/second.js': sha256('second hook\n'),
  });
  const now = () => '2026-05-11T00:00:09.000Z';

  const first = applyInstallerMigrationPlan({
    configDir,
    plan: {
      blocked: [],
      actions: [{
        migrationId: 'first-migration',
        migrationChecksum: 'sha256:first',
        type: 'remove-managed',
        relPath: 'hooks/first.js',
        reason: 'first',
        classification: 'managed-pristine',
        originalHash: sha256('first hook\n'),
        currentHash: sha256('first hook\n'),
      }],
    },
    now,
  });
  const second = applyInstallerMigrationPlan({
    configDir,
    plan: {
      blocked: [],
      actions: [{
        migrationId: 'second-migration',
        migrationChecksum: 'sha256:second',
        type: 'remove-managed',
        relPath: 'hooks/second.js',
        reason: 'second',
        classification: 'managed-pristine',
        originalHash: sha256('second hook\n'),
        currentHash: sha256('second hook\n'),
      }],
    },
    now,
  });

  assert.notEqual(first.journalRelPath, second.journalRelPath);
  assert.equal(fs.existsSync(path.join(configDir, first.journalRelPath)), true);
  assert.equal(fs.existsSync(path.join(configDir, second.journalRelPath)), true);
});

test('stores modified-file backups under the unique migration run journal', (t) => {
  const configDir = createTempInstall();
  t.after(() => cleanup(configDir));

  writeFile(configDir, 'hooks/old-hook.js', 'user changed hook\n');
  writeManifest(configDir, {
    'hooks/old-hook.js': sha256('managed hook\n'),
  });

  const plan = planInstallerMigrations({
    configDir,
    migrations: [
      migrationRecord(),
    ],
    scope: 'global',
    now: () => '2026-05-11T00:00:00.000Z',
  });

  const result = applyInstallerMigrationPlan({
    configDir,
    plan,
    now: () => '2026-05-11T00:00:10.000Z',
  });
  const journal = JSON.parse(fs.readFileSync(path.join(configDir, result.journalRelPath), 'utf8'));
  const backupRelPath = journal.actions[0].backupRelPath;

  assert.match(backupRelPath, /^gsd-migration-journal\/2026-05-11T00-00-10-000Z-[0-9a-f]+-backups\/hooks\/old-hook\.js$/);
  assert.equal(fs.readFileSync(path.join(configDir, backupRelPath), 'utf8'), 'user changed hook\n');
});

test('successful migration rollback removes run-scoped backup directories', (t) => {
  const configDir = createTempInstall();
  t.after(() => cleanup(configDir));

  writeFile(configDir, 'hooks/old-hook.js', 'user changed hook\n');
  writeManifest(configDir, {
    'hooks/old-hook.js': sha256('managed hook\n'),
  });

  const plan = planInstallerMigrations({
    configDir,
    migrations: [
      migrationRecord(),
    ],
    scope: 'global',
  });

  const result = applyInstallerMigrationPlan({
    configDir,
    plan,
    now: () => '2026-05-11T00:00:11.000Z',
  });

  result.rollback();

  assert.equal(fs.readFileSync(path.join(configDir, 'hooks/old-hook.js'), 'utf8'), 'user changed hook\n');
  assert.equal(fs.existsSync(path.join(configDir, result.journalRelPath)), false);
  assert.equal(
    fs.readdirSync(path.join(configDir, 'gsd-migration-journal')).some((name) => name.includes('backups')),
    false
  );
});

test('refuses to run migrations while another installer owns the migration lock', (t) => {
  const configDir = createTempInstall();
  t.after(() => cleanup(configDir));
  fs.writeFileSync(path.join(configDir, 'gsd-install-migration.lock'), 'held by test\n', 'utf8');

  assert.throws(
    () => runInstallerMigrations({
      configDir,
      migrations: [],
      lockTimeoutMs: 0,
    }),
    /installer migration lock is held/
  );
});

test('reports lock release failures after migration work completes', (t) => {
  const configDir = createTempInstall();
  const originalRmSync = fs.rmSync;
  t.after(() => {
    fs.rmSync = originalRmSync;
    cleanup(configDir);
  });

  fs.rmSync = (targetPath, ...args) => {
    if (path.basename(String(targetPath)) === 'gsd-install-migration.lock') {
      throw new Error('simulated lock unlink failure');
    }
    return originalRmSync.call(fs, targetPath, ...args);
  };

  assert.throws(
    () => runInstallerMigrations({
      configDir,
      migrations: [],
    }),
    /failed to release installer migration lock/
  );
});

test('rollback handle restores files and install state after a successful apply', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/old-hook.js', 'managed hook\n');
    writeManifest(configDir, {
      'hooks/old-hook.js': sha256('managed hook\n'),
    });
    writeInstallState(configDir, {
      schemaVersion: 1,
      appliedMigrations: [
        {
          id: 'already-applied',
          appliedAt: '2026-05-10T00:00:00.000Z',
          journal: 'gsd-migration-journal/prior.json',
        },
      ],
    });

    const plan = planInstallerMigrations({
      configDir,
      migrations: [
        migrationRecord({
          id: '2026-05-11-remove-old-hook',
          title: 'Remove retired hook',
          description: 'Remove retired hook',
          introducedIn: '1.50.0',
          scopes: ['global'],
          destructive: true,
          plan: () => [
            {
              type: 'remove-managed',
              relPath: 'hooks/old-hook.js',
              reason: 'retired hook',
              ownershipEvidence: 'test fixture manifest-managed hook',
            },
          ],
        }),
      ],
      scope: 'global',
      now: () => '2026-05-11T00:00:00.000Z',
    });

    const result = applyInstallerMigrationPlan({
      configDir,
      plan,
      now: () => '2026-05-11T00:00:01.000Z',
    });

    result.rollback();

    assert.equal(fs.readFileSync(path.join(configDir, 'hooks/old-hook.js'), 'utf8'), 'managed hook\n');
    assert.deepEqual(readInstallState(configDir).appliedMigrations.map((entry) => entry.id), ['already-applied']);
    assert.equal(fs.existsSync(path.join(configDir, result.journalRelPath)), false);
  } finally {
    cleanup(configDir);
  }
});

test('rolls back touched files and leaves state unchanged when apply fails', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/old-hook.js', 'managed hook\n');
    writeManifest(configDir, {
      'hooks/old-hook.js': sha256('managed hook\n'),
    });

    const plan = {
      pendingMigrationIds: ['2026-05-11-remove-old-hook'],
      blocked: [],
      actions: [
        {
          migrationId: '2026-05-11-remove-old-hook',
          type: 'remove-managed',
          relPath: 'hooks/old-hook.js',
          reason: 'retired hook',
          classification: 'managed-pristine',
          originalHash: sha256('managed hook\n'),
          currentHash: sha256('managed hook\n'),
        },
        {
          migrationId: '2026-05-11-remove-old-hook',
          type: 'unsupported-test-action',
          relPath: 'hooks/other.js',
          reason: 'force failure',
          classification: 'managed-pristine',
          originalHash: null,
          currentHash: null,
        },
      ],
    };

    assert.throws(
      () => applyInstallerMigrationPlan({
        configDir,
        plan,
        now: () => '2026-05-11T00:00:02.000Z',
      }),
      /unsupported migration action type/
    );

    assert.equal(fs.readFileSync(path.join(configDir, 'hooks/old-hook.js'), 'utf8'), 'managed hook\n');
    assert.deepEqual(readInstallState(configDir).appliedMigrations, []);
    assert.equal(
      fs.existsSync(path.join(configDir, 'gsd-migration-journal')) &&
        fs.readdirSync(path.join(configDir, 'gsd-migration-journal')).some((name) =>
          name.startsWith('2026-05-11T00-00-02-000Z')
        ),
      false
    );
  } finally {
    cleanup(configDir);
  }
});

test('cleans rollback and backup artifacts when migration apply fails', (t) => {
  const configDir = createTempInstall();
  t.after(() => cleanup(configDir));

  writeFile(configDir, 'hooks/old-hook.js', 'user changed hook\n');
  writeManifest(configDir, {
    'hooks/old-hook.js': sha256('managed hook\n'),
  });
  const plan = {
    blocked: [],
    actions: [
      {
        migrationId: '2026-05-11-remove-old-hook',
        migrationChecksum: 'sha256:remove',
        type: 'backup-and-remove',
        relPath: 'hooks/old-hook.js',
        reason: 'retired hook',
        classification: 'managed-modified',
        originalHash: sha256('managed hook\n'),
        currentHash: sha256('user changed hook\n'),
      },
      {
        migrationId: '2026-05-11-remove-old-hook',
        migrationChecksum: 'sha256:remove',
        type: 'unsupported-test-action',
        relPath: 'hooks/other.js',
        reason: 'force failure',
        classification: 'managed-pristine',
        originalHash: null,
        currentHash: null,
      },
    ],
  };

  assert.throws(
    () => applyInstallerMigrationPlan({
      configDir,
      plan,
      now: () => '2026-05-11T00:00:12.000Z',
    }),
    /unsupported migration action type/
  );

  assert.equal(fs.readFileSync(path.join(configDir, 'hooks/old-hook.js'), 'utf8'), 'user changed hook\n');
  assert.equal(
    fs.existsSync(path.join(configDir, 'gsd-migration-journal')) &&
      fs.readdirSync(path.join(configDir, 'gsd-migration-journal')).some((name) =>
        name.startsWith('2026-05-11T00-00-12-000Z')
      ),
    false
  );
});

test('reports rollback restore failures instead of swallowing them', () => {
  const configDir = createTempInstall();
  const originalCopyFileSync = fs.copyFileSync;
  try {
    writeFile(configDir, 'hooks/old-hook.js', 'managed hook\n');
    writeManifest(configDir, {
      'hooks/old-hook.js': sha256('managed hook\n'),
    });

    const plan = {
      blocked: [],
      actions: [
        {
          migrationId: '2026-05-11-remove-old-hook',
          type: 'remove-managed',
          relPath: 'hooks/old-hook.js',
          reason: 'retired hook',
          classification: 'managed-pristine',
          originalHash: sha256('managed hook\n'),
          currentHash: sha256('managed hook\n'),
        },
        {
          migrationId: '2026-05-11-remove-old-hook',
          type: 'unsupported-test-action',
          relPath: 'hooks/other.js',
          reason: 'force failure',
          classification: 'managed-pristine',
          originalHash: null,
          currentHash: null,
        },
      ],
    };

    fs.copyFileSync = (src, dest) => {
      if (/2026-05-11T00-00-04-000Z-[0-9a-f]+-rollback/.test(String(src))) {
        throw new Error('simulated rollback copy failure');
      }
      return originalCopyFileSync(src, dest);
    };

    assert.throws(
      () => applyInstallerMigrationPlan({
        configDir,
        plan,
        now: () => '2026-05-11T00:00:04.000Z',
      }),
      (error) => {
        assert.match(error.message, /rollback incomplete/);
        assert.equal(error.rollbackFailures.length, 1);
        assert.equal(error.rollbackFailures[0].relPath, 'hooks/old-hook.js');
        return true;
      }
    );
  } finally {
    fs.copyFileSync = originalCopyFileSync;
    cleanup(configDir);
  }
});

test('rejects executable preserve-user actions because preservation blocks non-interactive apply', () => {
  const configDir = createTempInstall();
  try {
    writeManifest(configDir, {});

    assert.throws(
      () => applyInstallerMigrationPlan({
        configDir,
        plan: {
          blocked: [],
          actions: [
            {
              migrationId: '2026-05-11-preserve-user',
              type: 'preserve-user',
              relPath: 'hooks/custom-user-hook.js',
              reason: 'unknown user hook',
              classification: 'unknown',
              originalHash: null,
              currentHash: sha256('user hook\n'),
            },
          ],
        },
      }),
      /unsupported migration action type: preserve-user/
    );
  } finally {
    cleanup(configDir);
  }
});

test('keeps prior install state intact when a state write fails mid-write', () => {
  const configDir = createTempInstall();
  const originalWriteFileSync = fs.writeFileSync;
  try {
    writeInstallState(configDir, {
      schemaVersion: 1,
      appliedMigrations: [{ id: 'already-safe', appliedAt: '2026-05-11T00:00:00.000Z' }],
    });

    fs.writeFileSync = (filePath, content, ...rest) => {
      if (path.basename(filePath).startsWith(`${INSTALL_STATE_NAME}.tmp-`)) {
        throw new Error('simulated temp state write failure');
      }
      return originalWriteFileSync(filePath, content, ...rest);
    };

    assert.throws(
      () => writeInstallState(configDir, {
        schemaVersion: 1,
        appliedMigrations: [{ id: 'new-migration', appliedAt: '2026-05-11T00:00:01.000Z' }],
      }),
      /simulated temp state write failure/
    );
  } finally {
    fs.writeFileSync = originalWriteFileSync;
  }

  try {
    assert.deepEqual(readInstallState(configDir).appliedMigrations.map((entry) => entry.id), ['already-safe']);
  } finally {
    cleanup(configDir);
  }
});

test('skips migration records already present in install state', () => {
  const configDir = createTempInstall();
  try {
    writeManifest(configDir, {});
    writeInstallState(configDir, {
      schemaVersion: 1,
      appliedMigrations: [
        {
          id: '2026-05-11-remove-old-hook',
          appliedAt: '2026-05-11T00:00:00.000Z',
          journal: 'gsd-migration-journal/prior.json',
        },
      ],
    });

    const plan = planInstallerMigrations({
      configDir,
      migrations: [
        migrationRecord({
          plan: () => {
            throw new Error('already-applied migration planner must not run');
          },
        }),
      ],
      scope: 'global',
      now: () => '2026-05-11T00:00:03.000Z',
    });

    assert.deepEqual(plan.pendingMigrationIds, []);
    assert.deepEqual(plan.actions, []);
    assert.deepEqual(plan.blocked, []);
  } finally {
    cleanup(configDir);
  }
});

test('marks zero-action pending migrations as applied', () => {
  const configDir = createTempInstall();
  try {
    writeManifest(configDir, {});

    const result = runInstallerMigrations({
      configDir,
      migrations: [
        migrationRecord({
          id: '2026-05-11-noop-cleanup',
          title: 'No-op cleanup',
          description: 'No-op cleanup',
          destructive: false,
          plan: () => [],
        }),
      ],
      scope: 'global',
      now: () => '2026-05-11T00:00:06.000Z',
    });

    assert.deepEqual(result.appliedMigrationIds, ['2026-05-11-noop-cleanup']);
    assert.equal(result.journalRelPath, null);
    assert.deepEqual(readInstallState(configDir).appliedMigrations.map((entry) => entry.id), [
      '2026-05-11-noop-cleanup',
    ]);
  } finally {
    cleanup(configDir);
  }
});

test('refuses to plan an already-applied migration whose checksum changed', () => {
  const configDir = createTempInstall();
  try {
    writeManifest(configDir, {});
    writeInstallState(configDir, {
      schemaVersion: 1,
      appliedMigrations: [
        {
          id: '2026-05-11-remove-old-hook',
          checksum: 'sha256:old-definition',
          appliedAt: '2026-05-11T00:00:00.000Z',
          journal: 'gsd-migration-journal/prior.json',
        },
      ],
    });

    assert.throws(
      () => planInstallerMigrations({
        configDir,
        migrations: [
          migrationRecord({
            checksum: 'sha256:new-definition',
            plan: () => [],
          }),
        ],
        scope: 'global',
      }),
      /applied migration checksum changed/
    );
  } finally {
    cleanup(configDir);
  }
});

test('ignores checksum drift for applied migrations outside the active runtime scope', () => {
  const configDir = createTempInstall();
  try {
    writeManifest(configDir, {});
    writeInstallState(configDir, {
      schemaVersion: 1,
      appliedMigrations: [
        {
          id: '2026-05-11-codex-only',
          checksum: 'sha256:old-definition',
          appliedAt: '2026-05-11T00:00:00.000Z',
          journal: 'gsd-migration-journal/prior.json',
        },
      ],
    });

    const plan = planInstallerMigrations({
      configDir,
      runtime: 'claude',
      scope: 'global',
      migrations: [
        migrationRecord({
          id: '2026-05-11-codex-only',
          title: 'Codex-only migration',
          description: 'Codex-only migration',
          checksum: 'sha256:new-definition',
          runtimes: ['codex'],
          scopes: ['global'],
          plan: () => {
            throw new Error('out-of-scope migration planner must not run');
          },
        }),
      ],
    });

    assert.deepEqual(plan.pendingMigrationIds, []);
    assert.deepEqual(plan.actions, []);
    assert.deepEqual(plan.blocked, []);
  } finally {
    cleanup(configDir);
  }
});

test('discovers migration records from a directory in filename order', () => {
  const configDir = createTempInstall();
  try {
    const migrationsDir = path.join(configDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(
      path.join(migrationsDir, '002-second.cjs'),
      "module.exports = { id: 'second', title: 'Second', description: 'second', introducedIn: '1.50.0', scopes: ['global', 'local'], destructive: false, plan: () => [] };\n",
      'utf8'
    );
    fs.writeFileSync(
      path.join(migrationsDir, '001-first.cjs'),
      "module.exports = { id: 'first', title: 'First', description: 'first', introducedIn: '1.50.0', scopes: ['global', 'local'], destructive: false, plan: () => [] };\n",
      'utf8'
    );

    const migrations = discoverInstallerMigrations({ migrationsDir });

    assert.deepEqual(migrations.map((migration) => migration.id), ['first', 'second']);
  } finally {
    cleanup(configDir);
  }
});

test('rejects migration actions that escape the install root', () => {
  const configDir = createTempInstall();
  try {
    writeManifest(configDir, {});

    assert.throws(
      () => planInstallerMigrations({
        configDir,
        migrations: [
          migrationRecord({
            id: '2026-05-11-bad-path',
            title: 'Bad path',
            description: 'Bad path',
            plan: () => [
              {
                type: 'remove-managed',
                relPath: 'hooks/../../outside.js',
                reason: 'bad path',
                ownershipEvidence: 'test fixture manifest-managed hook',
              },
            ],
          }),
        ],
        scope: 'global',
      }),
      /relPath must stay inside configDir/
    );
  } finally {
    cleanup(configDir);
  }
});

test('rejects migration actions that normalize to the install root', () => {
  const configDir = createTempInstall();
  try {
    writeManifest(configDir, {});

    for (const relPath of ['.', 'hooks/..']) {
      assert.throws(
        () => planInstallerMigrations({
          configDir,
          migrations: [
            migrationRecord({
              id: `2026-05-11-bad-path-${relPath.replace(/[^a-z0-9]/gi, '-')}`,
              title: 'Bad path',
              description: 'Bad path',
              plan: () => [
                {
                  type: 'remove-managed',
                  relPath,
                  reason: 'bad path',
                  ownershipEvidence: 'test fixture manifest-managed hook',
                },
              ],
            }),
          ],
          scope: 'global',
        }),
        /relPath must stay inside configDir/
      );
    }
  } finally {
    cleanup(configDir);
  }
});

test('runs discovered installer migrations against manifest-managed legacy orphan files', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/statusline.js', 'legacy managed hook\n');
    writeFile(configDir, 'hooks/custom.js', 'custom hook\n');
    writeManifest(configDir, {
      'hooks/statusline.js': sha256('legacy managed hook\n'),
    });

    const result = runInstallerMigrations({
      configDir,
      scope: 'global',
      now: () => '2026-05-11T00:00:05.000Z',
    });

    assert.equal(fs.existsSync(path.join(configDir, 'hooks/statusline.js')), false);
    assert.equal(fs.readFileSync(path.join(configDir, 'hooks/custom.js'), 'utf8'), 'custom hook\n');
    assert.deepEqual(result.appliedMigrationIds, ['2026-05-11-legacy-orphan-files']);
    assert.deepEqual(readInstallState(configDir).appliedMigrations.map((entry) => entry.id), ['2026-05-11-legacy-orphan-files']);
  } finally {
    cleanup(configDir);
  }
});

test('backs up modified legacy orphan files before removing them', () => {
  const configDir = createTempInstall();
  try {
    writeFile(configDir, 'hooks/statusline.js', 'user modified legacy hook\n');
    writeManifest(configDir, {
      'hooks/statusline.js': sha256('legacy managed hook\n'),
    });

    const plan = planInstallerMigrations({
      configDir,
      migrations: discoverInstallerMigrations({
        migrationsDir: path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'installer-migrations'),
      }),
      scope: 'global',
      now: () => '2026-05-11T00:00:05.000Z',
    });
    const action = plan.actions.find((item) => item.relPath === 'hooks/statusline.js');

    assert.equal(action.type, 'backup-and-remove');

    const result = runInstallerMigrations({
      configDir,
      scope: 'global',
      now: () => '2026-05-11T00:00:05.000Z',
    });
    const journal = JSON.parse(fs.readFileSync(path.join(configDir, result.journalRelPath), 'utf8'));
    const backupRelPath = journal.actions.find((item) => item.relPath === 'hooks/statusline.js').backupRelPath;

    assert.equal(fs.existsSync(path.join(configDir, 'hooks/statusline.js')), false);
    assert.equal(fs.readFileSync(path.join(configDir, backupRelPath), 'utf8'), 'user modified legacy hook\n');
  } finally {
    cleanup(configDir);
  }
});

test('runs a Codex legacy hooks.json cleanup migration without removing user hooks', () => {
  const configDir = createTempInstall();
  try {
    writeFile(
      configDir,
      'hooks.json',
      JSON.stringify({
        SessionStart: [
          legacyCodexHook(configDir),
          userHook('node "/Users/example/bin/user-hook.js"'),
          userHook('node "/Users/example/bin/gsd-check-update.js"'),
        ],
      }, null, 2)
    );
    writeManifest(configDir, {});

    const result = runInstallerMigrations({
      configDir,
      runtime: 'codex',
      scope: 'global',
      now: () => '2026-05-11T00:00:06.000Z',
    });

    const hooksJson = JSON.parse(fs.readFileSync(path.join(configDir, 'hooks.json'), 'utf8'));
    const commands = hooksJson.SessionStart.flatMap((entry) => entry.hooks).map((hook) => hook.command);

    assert.deepEqual(commands, [
      'node "/Users/example/bin/user-hook.js"',
      'node "/Users/example/bin/gsd-check-update.js"',
    ]);
    assert.ok(result.appliedMigrationIds.includes('2026-05-11-codex-legacy-hooks-json'));
  } finally {
    cleanup(configDir);
  }
});

test('preserves unrelated empty hooks.json structure while pruning legacy Codex hooks', () => {
  const configDir = createTempInstall();
  try {
    writeFile(
      configDir,
      'hooks.json',
      JSON.stringify({
        SessionStart: [
          legacyCodexHook(configDir),
          { hooks: [] },
          { metadata: null },
        ],
      }, null, 2)
    );
    writeManifest(configDir, {});

    runInstallerMigrations({
      configDir,
      runtime: 'codex',
      scope: 'global',
      now: () => '2026-05-11T00:00:06.000Z',
    });

    const hooksJson = JSON.parse(fs.readFileSync(path.join(configDir, 'hooks.json'), 'utf8'));

    assert.deepEqual(hooksJson.SessionStart, [
      { hooks: [] },
      { metadata: null },
    ]);
  } finally {
    cleanup(configDir);
  }
});

test('skips runtime-specific migration records for other runtimes', () => {
  const configDir = createTempInstall();
  try {
    writeFile(
      configDir,
      'hooks.json',
      JSON.stringify({
        SessionStart: [legacyCodexHook(configDir)],
      }, null, 2)
    );
    writeManifest(configDir, {});

    const result = runInstallerMigrations({
      configDir,
      runtime: 'claude',
      scope: 'global',
      now: () => '2026-05-11T00:00:07.000Z',
    });

    const hooksJson = JSON.parse(fs.readFileSync(path.join(configDir, 'hooks.json'), 'utf8'));
    assert.equal(hooksJson.SessionStart[0].hooks[0].command, `node "${path.join(configDir, 'hooks', 'gsd-check-update.js')}"`);
    assert.equal(result.appliedMigrationIds.includes('2026-05-11-codex-legacy-hooks-json'), false);
  } finally {
    cleanup(configDir);
  }
});
