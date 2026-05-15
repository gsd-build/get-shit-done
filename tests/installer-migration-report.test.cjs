'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertInstallerMigrationsUnblocked,
  summarizeInstallerMigrationResult,
} = require('../get-shit-done/bin/lib/installer-migration-report.cjs');

test('summarizes every installer migration report category', () => {
  const blockedAction = {
    type: 'prompt-user',
    relPath: 'hooks/gsd-retired-hook.js',
    reason: 'needs a user choice',
  };
  const result = {
    blocked: [blockedAction],
    plan: {
      actions: [
        {
          type: 'remove-managed',
          relPath: 'hooks/statusline.js',
          reason: 'retired hook',
        },
        {
          type: 'backup-and-remove',
          relPath: 'hooks/modified.js',
          reason: 'modified managed hook retired',
        },
        {
          type: 'baseline-preserve-user',
          relPath: 'hooks/custom.js',
          reason: 'user-owned hook',
        },
        {
          type: 'unknown-action',
          relPath: 'hooks/unknown.js',
          reason: 'unsupported in this installer',
        },
        blockedAction,
      ],
    },
  };

  assert.deepEqual(
    summarizeInstallerMigrationResult(result).rows.map((row) => ({
      label: row.label,
      relPath: row.relPath,
      reason: row.reason,
    })),
    [
      {
        label: 'removed',
        relPath: 'hooks/statusline.js',
        reason: 'retired hook',
      },
      {
        label: 'backed up and removed',
        relPath: 'hooks/modified.js',
        reason: 'modified managed hook retired',
      },
      {
        label: 'preserved',
        relPath: '1 user baseline file',
        reason: 'first-time baseline scan',
      },
      {
        label: 'skipped',
        relPath: 'hooks/unknown.js',
        reason: 'unsupported in this installer',
      },
      {
        label: 'blocked',
        relPath: 'hooks/gsd-retired-hook.js',
        reason: 'needs a user choice',
      },
    ]
  );
});

test('collapses first-time baseline report rows without hiding destructive actions', () => {
  const blockedAction = {
    type: 'prompt-user',
    relPath: 'hooks/gsd-ambiguous.js',
    reason: 'needs a user choice',
  };
  const result = {
    blocked: [blockedAction],
    plan: {
      actions: [
        {
          type: 'record-baseline',
          relPath: 'hooks/statusline.js',
          reason: 'first-time baseline scan',
        },
        {
          type: 'record-baseline',
          relPath: 'hooks/workflow-guard.js',
          reason: 'first-time baseline scan',
        },
        {
          type: 'baseline-preserve-user',
          relPath: 'hooks/custom.js',
          reason: 'first-time baseline scan',
        },
        {
          type: 'remove-managed',
          relPath: 'hooks/retired.js',
          reason: 'retired hook',
        },
        blockedAction,
      ],
    },
  };

  assert.deepEqual(
    summarizeInstallerMigrationResult(result).rows.map((row) => ({
      label: row.label,
      relPath: row.relPath,
      reason: row.reason,
    })),
    [
      {
        label: 'recorded',
        relPath: '2 managed baseline files',
        reason: 'first-time baseline scan',
      },
      {
        label: 'preserved',
        relPath: '1 user baseline file',
        reason: 'first-time baseline scan',
      },
      {
        label: 'removed',
        relPath: 'hooks/retired.js',
        reason: 'retired hook',
      },
      {
        label: 'blocked',
        relPath: 'hooks/gsd-ambiguous.js',
        reason: 'needs a user choice',
      },
    ]
  );
});

test('throws when installer migrations require user choice', () => {
  // #3541: error message now groups paths by reason and names the
  // non-interactive resolution surface. The thrown error carries
  // structured `blockedByReason` data and the resolution env var
  // name so callers can render their own report.
  let captured = null;
  try {
    assertInstallerMigrationsUnblocked({
      blocked: [
        {
          relPath: 'hooks/gsd-retired-hook.js',
          reason: 'needs a user choice',
          choices: ['keep', 'remove'],
        },
      ],
    });
    assert.fail('expected throw');
  } catch (err) {
    captured = err;
  }
  assert.ok(captured instanceof Error);
  assert.match(captured.message, /installer migration blocked pending user choice/);
  assert.match(captured.message, /hooks\/gsd-retired-hook\.js/);
  assert.match(captured.message, /GSD_INSTALLER_MIGRATION_RESOLVE/);
  assert.ok(captured.blockedByReason, 'error exposes grouped-by-reason data');
  assert.equal(captured.resolutionEnvVar, 'GSD_INSTALLER_MIGRATION_RESOLVE');
});
