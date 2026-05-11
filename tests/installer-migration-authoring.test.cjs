'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  discoverInstallerMigrations,
  planInstallerMigrations,
} = require('../get-shit-done/bin/lib/installer-migrations.cjs');
const { cleanup, createTempDir } = require('./helpers.cjs');

function writeMigration(dir, fileName, source) {
  fs.writeFileSync(path.join(dir, fileName), source, 'utf8');
}

function completeMigrationRecord(overrides = {}) {
  return {
    id: '2026-05-11-authoring-guard-test',
    title: 'Authoring guard test migration',
    description: 'Exercise installer migration authoring guardrails.',
    introducedIn: '1.50.0',
    scopes: ['global', 'local'],
    destructive: true,
    plan: () => [],
    ...overrides,
  };
}

test('rejects discovered migration records missing required authoring metadata', (t) => {
  const migrationsDir = createTempDir('gsd-migration-authoring-');
  t.after(() => cleanup(migrationsDir));

  writeMigration(
    migrationsDir,
    '001-missing-title.cjs',
    `'use strict';
module.exports = {
  id: '2026-05-11-missing-title',
          description: 'Incomplete migration record.',
          introducedIn: '1.50.0',
          scopes: ['global', 'local'],
          destructive: false,
          plan: () => [],
};
`
  );

  assert.throws(
    () => discoverInstallerMigrations({ migrationsDir }),
    /migration record must include a non-empty title: .*001-missing-title\.cjs/
  );
});

test('rejects direct migration records missing required authoring metadata during planning', (t) => {
  const configDir = createTempDir('gsd-migration-authoring-plan-');
  t.after(() => cleanup(configDir));

  fs.writeFileSync(
    path.join(configDir, 'gsd-file-manifest.json'),
    JSON.stringify({ version: '1.50.0', timestamp: '2026-05-11T00:00:00.000Z', mode: 'full', files: {} }),
    'utf8'
  );

  assert.throws(
    () => planInstallerMigrations({
      configDir,
      migrations: [
        {
          id: '2026-05-11-incomplete-direct-record',
          title: 'Incomplete direct migration record',
          introducedIn: '1.50.0',
          scopes: ['global', 'local'],
          destructive: false,
          plan: () => [],
        },
      ],
    }),
    /migration record must include a non-empty description: 2026-05-11-incomplete-direct-record/
  );
});

test('rejects migration records without explicit install scopes', (t) => {
  const configDir = createTempDir('gsd-migration-authoring-scope-');
  t.after(() => cleanup(configDir));

  fs.writeFileSync(
    path.join(configDir, 'gsd-file-manifest.json'),
    JSON.stringify({ version: '1.50.0', timestamp: '2026-05-11T00:00:00.000Z', mode: 'full', files: {} }),
    'utf8'
  );

  assert.throws(
    () => planInstallerMigrations({
      configDir,
      migrations: [
        {
          id: '2026-05-11-missing-scopes',
          title: 'Missing scopes',
          description: 'Missing explicit install scope.',
          introducedIn: '1.50.0',
          destructive: false,
          plan: () => [],
        },
      ],
    }),
    /migration record scopes must be a non-empty string array: 2026-05-11-missing-scopes/
  );
});

test('rejects destructive migration actions without ownership evidence', (t) => {
  const configDir = createTempDir('gsd-migration-authoring-action-');
  t.after(() => cleanup(configDir));

  fs.writeFileSync(
    path.join(configDir, 'gsd-file-manifest.json'),
    JSON.stringify({
      version: '1.50.0',
      timestamp: '2026-05-11T00:00:00.000Z',
      mode: 'full',
      files: {},
    }),
    'utf8'
  );

  assert.throws(
    () => planInstallerMigrations({
      configDir,
      migrations: [
        completeMigrationRecord({
          plan: () => [
            {
              type: 'remove-managed',
              relPath: 'hooks/old-hook.js',
              reason: 'retired hook',
            },
          ],
        }),
      ],
      scope: 'global',
    }),
    /migration action remove-managed must include ownershipEvidence: 2026-05-11-authoring-guard-test hooks\/old-hook\.js/
  );
});

test('rejects migration actions with absolute or traversal relPaths', (t) => {
  const configDir = createTempDir('gsd-migration-authoring-relpath-');
  t.after(() => cleanup(configDir));

  fs.writeFileSync(
    path.join(configDir, 'gsd-file-manifest.json'),
    JSON.stringify({ version: '1.50.0', timestamp: '2026-05-11T00:00:00.000Z', mode: 'full', files: {} }),
    'utf8'
  );

  for (const relPath of ['/tmp/outside.js', 'hooks/../outside.js', 'hooks/..', '.']) {
    assert.throws(
      () => planInstallerMigrations({
        configDir,
        migrations: [
          completeMigrationRecord({
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
});

test('rejects runtime config rewrites without a runtime contract citation', (t) => {
  const configDir = createTempDir('gsd-migration-authoring-runtime-');
  t.after(() => cleanup(configDir));

  fs.writeFileSync(
    path.join(configDir, 'gsd-file-manifest.json'),
    JSON.stringify({ version: '1.50.0', timestamp: '2026-05-11T00:00:00.000Z', mode: 'full', files: {} }),
    'utf8'
  );
  fs.writeFileSync(path.join(configDir, 'hooks.json'), '{"hooks":[]}\n', 'utf8');

  assert.throws(
    () => planInstallerMigrations({
      configDir,
      migrations: [
        completeMigrationRecord({
          runtimes: ['codex'],
          scopes: ['global', 'local'],
          plan: () => [
            {
              type: 'rewrite-json',
              relPath: 'hooks.json',
              value: {},
              deleteIfEmpty: true,
              reason: 'retired generated Codex hook registration',
              ownershipEvidence: 'matches generated GSD hook command path',
            },
          ],
        }),
      ],
      runtime: 'codex',
      scope: 'global',
    }),
    /migration action rewrite-json requires migration runtimeContract: 2026-05-11-authoring-guard-test hooks\.json/
  );
});
