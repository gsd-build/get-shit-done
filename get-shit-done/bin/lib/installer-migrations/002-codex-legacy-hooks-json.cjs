'use strict';

const path = require('path');

function isStructurallyEmpty(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value !== 'object') return false;
  for (const _key in value) return false;
  return true;
}

function isManagedCodexHookCommand(command, configDir) {
  if (typeof command !== 'string') return false;
  if (typeof configDir !== 'string' || configDir.length === 0) return false;
  const normalizedCommand = command.replace(/\\/g, '/');
  const managedHooksDir = `${path.join(configDir, 'hooks').replace(/\\/g, '/')}/`;
  if (!normalizedCommand.includes(managedHooksDir)) return false;
  return /(^|[\\/\s"'])(gsd-check-update\.js|gsd-update-check\.js)(?=$|[\s"'])/.test(normalizedCommand);
}

function pruneLegacyCodexHooksJsonValue(value, configDir) {
  if (Array.isArray(value)) {
    let changed = false;
    const next = [];
    for (const item of value) {
      const pruned = pruneLegacyCodexHooksJsonValue(item, configDir);
      if (pruned.changed) changed = true;
      if (pruned.changed && isStructurallyEmpty(pruned.value)) changed = true;
      else next.push(pruned.value);
    }
    return { value: next, changed };
  }

  if (value && typeof value === 'object') {
    if (isManagedCodexHookCommand(value.command, configDir)) {
      return { value: null, changed: true };
    }

    let changed = false;
    const next = {};
    for (const [key, child] of Object.entries(value)) {
      const pruned = pruneLegacyCodexHooksJsonValue(child, configDir);
      if (pruned.changed) changed = true;
      if (pruned.changed && isStructurallyEmpty(pruned.value)) changed = true;
      else next[key] = pruned.value;
    }
    return { value: next, changed };
  }

  return { value, changed: false };
}

module.exports = {
  id: '2026-05-11-codex-legacy-hooks-json',
  title: 'Remove legacy Codex hooks.json GSD hook registrations',
  description: 'Remove legacy Codex hooks.json GSD hook registrations after config.toml migration.',
  introducedIn: '1.50.0',
  runtimes: ['codex'],
  scopes: ['global', 'local'],
  destructive: true,
  runtimeContract: 'docs/installer-migrations.md#runtime-configuration-contract-registry Codex row',
  plan: ({ configDir, readJson }) => {
    const hooksJson = readJson('hooks.json');
    if (!hooksJson.exists || hooksJson.error) return [];

    const pruned = pruneLegacyCodexHooksJsonValue(hooksJson.value, configDir);
    if (!pruned.changed) return [];

    return [
      {
        type: 'rewrite-json',
        relPath: 'hooks.json',
        value: pruned.value,
        deleteIfEmpty: true,
        reason: 'legacy Codex hooks.json GSD registration retired by installer migration',
        ownershipEvidence: 'pruned command matches generated GSD hook command under the install hooks directory',
      },
    ];
  },
};
