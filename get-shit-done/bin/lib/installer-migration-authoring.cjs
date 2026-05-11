'use strict';

const path = require('path');

function requireNonEmptyString(record, field, source) {
  if (typeof record[field] !== 'string' || record[field].trim() === '') {
    throw new Error(`migration record must include a non-empty ${field}: ${source}`);
  }
}

function validateStringArray(record, field, source) {
  if (record[field] === undefined) return;
  if (
    !Array.isArray(record[field]) ||
    record[field].length === 0 ||
    record[field].some((value) => typeof value !== 'string' || value.trim() === '')
  ) {
    throw new Error(`migration record ${field} must be a non-empty string array when provided: ${source}`);
  }
}

function requireStringArray(record, field, source) {
  if (
    !Array.isArray(record[field]) ||
    record[field].length === 0 ||
    record[field].some((value) => typeof value !== 'string' || value.trim() === '')
  ) {
    throw new Error(`migration record ${field} must be a non-empty string array: ${source}`);
  }
}

function recordSource(record, fallback) {
  return fallback || (record && typeof record.id === 'string' && record.id.trim() ? record.id : '<unknown>');
}

function validateInstallerMigrationRecord(record, source) {
  const displaySource = recordSource(record, source);
  if (!record || typeof record !== 'object') {
    throw new Error(`migration record must export an object: ${displaySource}`);
  }

  // Authoring contract follows docs/installer-migrations.md#authoring-workflow
  // and docs/adr/0008-installer-migration-module.md#decision.
  requireNonEmptyString(record, 'id', displaySource);
  requireNonEmptyString(record, 'title', displaySource);
  requireNonEmptyString(record, 'description', displaySource);
  requireNonEmptyString(record, 'introducedIn', displaySource);
  if (typeof record.destructive !== 'boolean') {
    throw new Error(`migration record must declare destructive as a boolean: ${displaySource}`);
  }
  validateStringArray(record, 'runtimes', displaySource);
  requireStringArray(record, 'scopes', displaySource);
  if (typeof record.plan !== 'function') {
    throw new Error(`migration record must include a plan function: ${displaySource}`);
  }

  return record;
}

function actionSource(migration, action) {
  const migrationId = migration && typeof migration.id === 'string' ? migration.id : '<unknown>';
  const relPath = action && typeof action.relPath === 'string' ? action.relPath : '<unknown>';
  return `${migrationId} ${relPath}`;
}

function requireActionEvidence(action, field, migration) {
  if (typeof action[field] !== 'string' || action[field].trim() === '') {
    throw new Error(`migration action ${action.type} must include ${field}: ${actionSource(migration, action)}`);
  }
}

function validateSafeRelPath(relPath, migration, actionType) {
  const source = actionSource(migration, { relPath });
  const normalized = relPath.replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || path.win32.isAbsolute(normalized)) {
    throw new Error(`migration action ${actionType} relPath must stay inside configDir: ${source}`);
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`migration action ${actionType} relPath must stay inside configDir: ${source}`);
  }
}

function validateInstallerMigrationActions(actions, migration) {
  if (!Array.isArray(actions)) {
    throw new Error(`migration ${migration.id} plan must return an array`);
  }

  for (const action of actions) {
    if (!action || typeof action !== 'object') {
      throw new Error(`migration action must be an object: ${migration.id}`);
    }
    if (typeof action.type !== 'string' || action.type.trim() === '') {
      throw new Error(`migration action must include a non-empty type: ${migration.id}`);
    }
    if (typeof action.relPath !== 'string' || action.relPath.trim() === '') {
      throw new Error(`migration action ${action.type} must include a non-empty relPath: ${migration.id}`);
    }
    validateSafeRelPath(action.relPath, migration, action.type);
    // Ownership and runtime-contract evidence are required by
    // docs/installer-migrations.md#action-types and
    // docs/adr/0008-installer-migration-module.md#runtime-contract-decision.
    if (action.type === 'remove-managed' || action.type === 'rewrite-json') {
      requireActionEvidence(action, 'ownershipEvidence', migration);
    }
    if (action.type === 'rewrite-json' && (typeof migration.runtimeContract !== 'string' || migration.runtimeContract.trim() === '')) {
      throw new Error(`migration action rewrite-json requires migration runtimeContract: ${actionSource(migration, action)}`);
    }
  }

  return actions;
}

module.exports = {
  validateInstallerMigrationActions,
  validateInstallerMigrationRecord,
};
