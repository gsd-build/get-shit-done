'use strict';

// Resolution environment variable surface for #3541 — when the installer
// runs without a TTY (typical /gsd:update path via Claude Code or any
// scripted update), prompt-user migration actions cannot be answered
// interactively. We resolve them by classification:
//   - Stale SDK build artifacts (get-shit-done/sdk/{dist,src}/gsd-*):
//     default `remove`. Fresh install supplies replacements.
//   - User-facing skill anchors (skills/gsd-*/SKILL.md): default `keep`.
//     User-owned content is preserved.
// Anything else: fall through to the hard assertion with an improved,
// grouped, actionable error message.
//
// docs/installer-migrations.md#prompt-user-resolution for the spec.
const RESOLUTION_ENV_VAR = 'GSD_INSTALLER_MIGRATION_RESOLVE';
const VALID_CHOICES = ['keep', 'remove'];

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

// Classify a blocked prompt-user action into one of the safe-default
// categories. Returns null when no safe default applies — caller must
// fall back to the hard assertion / interactive prompt for those.
//
// Stale SDK build artifacts live under get-shit-done/sdk/{dist,src}/
// and are regenerated on every install, so removing them is lossless.
// User-facing skill anchors are the .md files that surface as commands
// to the user — these are user-owned and must be kept.
function classifyPromptUserAction(action) {
  const relPath = action && action.relPath;
  if (typeof relPath !== 'string' || !relPath) return null;
  if (/^get-shit-done\/sdk\/(dist|src)\//.test(relPath)) {
    return { category: 'stale-sdk-build-artifact', choice: 'remove' };
  }
  if (/^skills\/gsd-[^/]+\/SKILL\.md$/.test(relPath)) {
    return { category: 'user-facing-skill', choice: 'keep' };
  }
  // #3610: bundled GSD hooks at hooks/gsd-<name>.<ext>. These are part of
  // the npm distribution (`hooks/gsd-*.{js,sh,cjs,mjs}` shipped in the
  // package), NOT user-owned files. When a first-time-baseline scan finds
  // them on disk without manifest entries — the case for any upgrade from
  // a pre-manifest-baseline release — the safe default is to remove them
  // so the installer can write the fresh bundled versions in their place.
  // Restricted to top-level files (`hooks/gsd-X.ext`) so nested user
  // directories like `hooks/gsd-helpers/...` do NOT auto-classify.
  if (/^hooks\/gsd-[^/]+\.(?:js|sh|cjs|mjs)$/.test(relPath)) {
    return { category: 'bundled-gsd-hook', choice: 'remove' };
  }
  return null;
}

// Convert a blocked prompt-user action into a concrete plan action.
// `keep` → baseline-preserve-user (idempotent — already on disk).
// `remove` → backup-and-remove (safe: keeps a rollback copy in the
// migration journal under gsd-migration-journal/<runId>-backups/).
function materializeResolution(action, choice) {
  const base = {
    migrationId: action.migrationId,
    migrationChecksum: action.migrationChecksum,
    relPath: action.relPath,
    reason: action.reason,
    classification: action.classification,
    originalHash: action.originalHash || null,
    currentHash: action.currentHash || null,
    requestedType: 'prompt-user',
  };
  if (choice === 'keep') {
    return { ...base, type: 'baseline-preserve-user' };
  }
  // 'remove'
  return { ...base, type: 'backup-and-remove', backupRelPath: null };
}

function normalizeResolutionChoice(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const normalized = rawValue.trim().toLowerCase();
  return VALID_CHOICES.includes(normalized) ? normalized : null;
}

function actionSupportsChoice(action, choice) {
  if (!action || !choice) return false;
  if (!Array.isArray(action.choices) || action.choices.length === 0) {
    return VALID_CHOICES.includes(choice);
  }
  return action.choices.includes(choice);
}

// Resolve prompt-user actions when stdin is not a TTY. Mutates the
// passed result so:
//   - resolved actions are appended to plan.actions in their concrete
//     form (baseline-preserve-user / backup-and-remove);
//   - result.blocked and plan.blocked are filtered to actions that
//     could NOT be safely defaulted (caller must still handle those).
// Returns { result, resolutions } where `resolutions` is the structured
// log of every defaulted resolution.
function resolveInstallerMigrationPromptsForNonTty(result, options = {}) {
  if (!result || typeof result !== 'object') {
    return { result, resolutions: [] };
  }
  const blocked = blockedInstallerMigrationActions(result);
  if (blocked.length === 0) {
    return { result, resolutions: [] };
  }
  const isTty = options.isTty === true;
  if (isTty) {
    // Honour interactive prompting paths (not implemented yet — the
    // hard throw is still the right behaviour for TTY runs); resolver
    // only fires when the installer cannot interactively ask.
    return { result, resolutions: [] };
  }

  const env =
    options && options.env && typeof options.env === 'object'
      ? options.env
      : process.env;
  const envChoice = normalizeResolutionChoice(env && env[RESOLUTION_ENV_VAR]);
  const resolutions = [];
  const unresolved = [];

  for (const action of blocked) {
    if (action && action.type === 'prompt-user') {
      let category = null;
      let choice = null;
      let source = null;
      if (envChoice && actionSupportsChoice(action, envChoice)) {
        category = 'operator-override';
        choice = envChoice;
        source = RESOLUTION_ENV_VAR;
      } else {
        const classification = classifyPromptUserAction(action);
        if (classification) {
          category = classification.category;
          choice = classification.choice;
          source = 'non-tty-default';
        }
      }

      if (choice) {
        const resolved = materializeResolution(action, choice);
        // Replace the original prompt-user action in-place when present so
        // applyInstallerMigrationPlan never sees an unsupported action type.
        // Fallback to append only when the blocked action did not originate
        // from plan.actions (defensive).
        if (result.plan && Array.isArray(result.plan.actions)) {
          const idx = result.plan.actions.indexOf(action);
          if (idx >= 0) {
            result.plan.actions[idx] = resolved;
          } else {
            result.plan.actions.push(resolved);
          }
        }
        resolutions.push({
          relPath: action.relPath,
          category,
          choice,
          reason: action.reason,
          resolvedActionType: resolved.type,
          source,
        });
        continue;
      }
    }
    unresolved.push(action);
  }

  // Mutate both the top-level and plan.blocked surfaces so downstream
  // callers (assertInstallerMigrationsUnblocked, summarizers) see the
  // post-resolution state.
  if (Array.isArray(result.blocked)) {
    result.blocked = unresolved;
  }
  if (result.plan && Array.isArray(result.plan.blocked)) {
    result.plan.blocked = unresolved;
  }

  return { result, resolutions };
}

// Group blocked prompt-user actions by their `reason` so the operator
// sees one summary line per cause instead of N path lines for the
// same underlying issue.
function groupBlockedByReason(blocked) {
  const byReason = new Map();
  for (const action of blocked) {
    const reason = (action && action.reason) || 'no reason given';
    if (!byReason.has(reason)) byReason.set(reason, []);
    byReason.get(reason).push(action);
  }
  return byReason;
}

function describeChoicesForActions(blocked) {
  const choiceSet = new Set();
  for (const action of blocked) {
    if (action && Array.isArray(action.choices)) {
      for (const choice of action.choices) choiceSet.add(choice);
    }
  }
  if (choiceSet.size === 0) {
    for (const fallback of VALID_CHOICES) choiceSet.add(fallback);
  }
  return [...choiceSet];
}

function buildBlockedErrorMessage(blocked) {
  const byReason = groupBlockedByReason(blocked);
  const totalFiles = blocked.length;
  const choices = describeChoicesForActions(blocked);

  const lines = [
    `installer migration blocked pending user choice: ${totalFiles} file${totalFiles === 1 ? '' : 's'} need a decision`,
    `  choices: [${choices.join(', ')}]`,
  ];
  for (const [reason, actions] of byReason) {
    lines.push(`  - ${actions.length} file${actions.length === 1 ? '' : 's'}: ${reason}`);
    // Show up to 3 sample paths so operators can spot which files are
    // affected without dumping a thousand-line wall when SDK build
    // artifacts leak.
    const sample = actions.slice(0, 3).map((a) => a.relPath);
    if (sample.length > 0) {
      lines.push(`      e.g. ${sample.join(', ')}${actions.length > sample.length ? `, ... (+${actions.length - sample.length} more)` : ''}`);
    }
  }
  lines.push(
    `  resolve non-interactively by setting ${RESOLUTION_ENV_VAR}=<choice> ` +
    `(or run the installer in a TTY to be prompted per file).`
  );
  return lines.join('\n');
}

function assertInstallerMigrationsUnblocked(result) {
  const blocked = blockedInstallerMigrationActions(result);
  if (blocked.length === 0) return;
  const message = buildBlockedErrorMessage(blocked);
  const error = new Error(message);
  error.blocked = blocked;
  error.blockedByReason = Object.fromEntries(groupBlockedByReason(blocked));
  error.resolutionEnvVar = RESOLUTION_ENV_VAR;
  throw error;
}

module.exports = {
  RESOLUTION_ENV_VAR,
  assertInstallerMigrationsUnblocked,
  classifyPromptUserAction,
  resolveInstallerMigrationPromptsForNonTty,
  summarizeInstallerMigrationResult,
};
