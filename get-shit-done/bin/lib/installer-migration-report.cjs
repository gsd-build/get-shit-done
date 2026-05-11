'use strict';

function installerMigrationActionLabel(action) {
  if (!action || !action.type) return 'skipped';
  if (action.type === 'backup-and-remove') return 'backed up and removed';
  if (action.type === 'remove-managed') return 'removed';
  if (action.type === 'rewrite-json') return action.deleteIfEmpty ? 'rewrote or removed' : 'rewrote';
  if (action.type === 'record-baseline') return 'recorded';
  if (action.type === 'baseline-preserve-user') return 'preserved';
  if (action.type === 'preserve-user') return 'preserved';
  if (action.type === 'prompt-user') return 'blocked';
  return 'skipped';
}

function blockedInstallerMigrationActions(result) {
  if (result && Array.isArray(result.blocked)) return result.blocked;
  const plan = result && result.plan;
  if (plan && Array.isArray(plan.blocked)) return plan.blocked;
  return [];
}

function baselineSummaryLabel(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function baselineSummaryRow(type, actions) {
  const count = actions.length;
  if (type === 'record-baseline') {
    return {
      label: 'recorded',
      relPath: baselineSummaryLabel(count, 'managed baseline file'),
      reason: 'first-time baseline scan',
      action: { type: 'record-baseline-summary', count, actions },
    };
  }
  return {
    label: 'preserved',
    relPath: baselineSummaryLabel(count, 'user baseline file'),
    reason: 'first-time baseline scan',
    action: { type: 'baseline-preserve-user-summary', count, actions },
  };
}

function summarizeInstallerMigrationResult(result) {
  const plan = result && result.plan;
  const actions = plan && Array.isArray(plan.actions) ? plan.actions : [];
  const blocked = blockedInstallerMigrationActions(result);
  const blockedSet = new Set(blocked);
  const rows = [];
  const baselineIndexes = new Map();
  const baselineActions = new Map();

  for (const action of actions) {
    const type = action && action.type;
    if (type === 'record-baseline' || type === 'baseline-preserve-user') {
      if (!baselineActions.has(type)) {
        baselineActions.set(type, []);
        baselineIndexes.set(type, rows.length);
        rows.push(null);
      }
      baselineActions.get(type).push(action);
      continue;
    }

    rows.push({
      label: blockedSet.has(action) ? 'blocked' : installerMigrationActionLabel(action),
      relPath: action.relPath,
      reason: action.reason || '',
      action,
    });
  }

  // Phase 4 requires action reporting without flooding first-time baseline installs:
  // docs/installer-migrations.md#phase-4-installupdate-integration.
  for (const [type, baselineRows] of baselineActions) {
    rows[baselineIndexes.get(type)] = baselineSummaryRow(type, baselineRows);
  }

  return {
    hasReportableActions: actions.length > 0 || blocked.length > 0,
    blocked,
    rows,
  };
}

function assertInstallerMigrationsUnblocked(result) {
  const blocked = blockedInstallerMigrationActions(result);
  if (blocked.length === 0) return;
  const paths = blocked.map((action) => action.relPath).join(', ');
  throw new Error(`installer migration blocked pending user choice: ${paths}`);
}

module.exports = {
  assertInstallerMigrationsUnblocked,
  summarizeInstallerMigrationResult,
};
