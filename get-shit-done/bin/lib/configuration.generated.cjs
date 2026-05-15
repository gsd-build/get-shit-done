'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/configuration/index.ts
 * Regenerate: cd sdk && npm run gen:configuration
 *
 * Configuration Module — single source of truth for config loading,
 * legacy-key normalization, defaults merge, and explicit on-disk migration.
 */

const { readFileSync, writeFileSync, existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

// ─── Manifest requires ───────────────────────────────────────────────────────
function loadConfigurationManifest(fileName) {
  const candidates = [
    // Installed runtime layout: get-shit-done/bin/shared/*.manifest.json
    join(__dirname, '..', 'shared', fileName),
    // Source-repo dev layout: sdk/shared/*.manifest.json
    join(__dirname, '..', '..', '..', 'sdk', 'shared', fileName),
  ];
  let lastErr = null;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      const isMissingCandidate =
        err && err.code === 'MODULE_NOT_FOUND' && String(err.message || '').includes(candidate);
      if (!isMissingCandidate) throw err;
      lastErr = err;
    }
  }
  throw new Error(
    `${fileName} not found. Tried:\n${candidates.map((p) => `  ${p}`).join('\n')}\nLast error: ${lastErr?.message}`
  );
}

const CONFIG_DEFAULTS = loadConfigurationManifest('config-defaults.manifest.json');
const SCHEMA_MANIFEST = loadConfigurationManifest('config-schema.manifest.json');
const VALID_CONFIG_KEYS = new Set(SCHEMA_MANIFEST.validKeys);
const RUNTIME_STATE_KEYS = new Set(SCHEMA_MANIFEST.runtimeStateKeys);
const DYNAMIC_KEY_PATTERNS = SCHEMA_MANIFEST.dynamicKeyPatterns.map((p) => {
  const pattern = new RegExp(p.source);
  return {
    ...p,
    test: (key) => {
      pattern.lastIndex = 0;
      return pattern.test(key);
    },
  };
});

// ─── Depth → Granularity mapping ─────────────────────────────────────────────
const DEPTH_TO_GRANULARITY = {
    quick: 'coarse',
    standard: 'standard',
    comprehensive: 'fine',
};

// ─── Internal helpers ─────────────────────────────────────────────────────────
function planningDir(cwd, workstream) {
    if (!workstream)
        return join(cwd, '.planning');
    return join(cwd, '.planning', 'workstreams', workstream);
}

function detectSubRepos(cwd) {
    const results = [];
    try {
        const entries = readdirSync(cwd, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (entry.name.startsWith('.') || entry.name === 'node_modules')
                continue;
            const gitPath = join(cwd, entry.name, '.git');
            try {
                if (existsSync(gitPath)) {
                    results.push(entry.name);
                }
            }
            catch { /* ignore */ }
        }
    }
    catch { /* ignore */ }
    return results.sort();
}

function deepMergeConfig(base, overlay) {
    const result = { ...base };
    for (const key of Object.keys(overlay)) {
        const ov = overlay[key];
        if (ov !== null && ov !== undefined && typeof ov === 'object' && !Array.isArray(ov)) {
            const bv = base[key];
            if (bv !== null && bv !== undefined && typeof bv === 'object' && !Array.isArray(bv)) {
                result[key] = deepMergeConfig(bv, ov);
            }
            else {
                result[key] = deepMergeConfig({}, ov);
            }
        }
        else {
            result[key] = ov;
        }
    }
    return result;
}

// ─── Exported functions ───────────────────────────────────────────────────────
function normalizeLegacyKeys(parsed) {
    const result = { ...parsed };
    const normalizations = [];
    // 1. branching_strategy → git.branching_strategy
    if (Object.prototype.hasOwnProperty.call(result, 'branching_strategy')) {
        const value = result.branching_strategy;
        const git = result.git ?? {};
        if (git.branching_strategy === undefined) {
            result.git = { ...git, branching_strategy: value };
        }
        else {
            // canonical nested wins — just delete the stale top-level
            result.git = { ...git };
        }
        delete result.branching_strategy;
        normalizations.push({ from: 'branching_strategy', to: 'git.branching_strategy', value });
    }
    // 2. top-level sub_repos → planning.sub_repos
    if (Object.prototype.hasOwnProperty.call(result, 'sub_repos')) {
        const value = result.sub_repos;
        const planning = result.planning ?? {};
        if (planning.sub_repos === undefined) {
            result.planning = { ...planning, sub_repos: value };
        }
        else {
            // canonical nested wins — just drop the stale top-level
            result.planning = { ...planning };
        }
        delete result.sub_repos;
        normalizations.push({ from: 'sub_repos', to: 'planning.sub_repos', value });
    }
    // 3. multiRepo: true → marker (filesystem detection deferred to migrateOnDisk / caller)
    if (result.multiRepo === true) {
        delete result.multiRepo;
        normalizations.push({ from: 'multiRepo', to: 'planning.sub_repos', value: true, requiresFilesystem: true });
    }
    // 4. top-level depth → granularity
    if (Object.prototype.hasOwnProperty.call(result, 'depth') && !Object.prototype.hasOwnProperty.call(result, 'granularity')) {
        const rawDepth = result.depth;
        const mapped = DEPTH_TO_GRANULARITY[rawDepth] ?? rawDepth;
        result.granularity = mapped;
        delete result.depth;
        normalizations.push({ from: 'depth', to: 'granularity', value: mapped });
    }
    return { parsed: result, normalizations };
}

function mergeDefaults(parsed) {
    // Start with a deep clone of defaults, then overlay parsed
    const defaults = JSON.parse(JSON.stringify(CONFIG_DEFAULTS));
    return deepMergeConfig(defaults, parsed);
}

async function loadConfig(cwd, options) {
    const configPath = join(planningDir(cwd, options?.workstream), 'config.json');
    let raw;
    try {
        raw = readFileSync(configPath, 'utf-8');
    }
    catch {
        // File missing — return defaults
        return mergeDefaults({});
    }
    const trimmed = raw.trim();
    if (trimmed === '') {
        return mergeDefaults({});
    }
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to parse config at ${configPath}: ${msg}`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Config at ${configPath} must be a JSON object`);
    }
    const { parsed: normalized, normalizations } = normalizeLegacyKeys(parsed);
    if (options?.onNormalizations && normalizations.length > 0) {
        options.onNormalizations(normalizations);
    }
    return mergeDefaults(normalized);
}

async function migrateOnDisk(cwd, workstream) {
    const configPath = join(planningDir(cwd, workstream), 'config.json');
    let raw;
    try {
        raw = readFileSync(configPath, 'utf-8');
    }
    catch {
        // File missing — nothing to migrate
        return { migrated: false, normalizations: [], wrote: null };
    }
    const trimmed = raw.trim();
    if (trimmed === '') {
        return { migrated: false, normalizations: [], wrote: null };
    }
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    }
    catch {
        // Malformed — can't migrate
        return { migrated: false, normalizations: [], wrote: null };
    }
    const { parsed: normalized, normalizations } = normalizeLegacyKeys(parsed);
    if (normalizations.length === 0) {
        return { migrated: false, normalizations: [], wrote: null };
    }
    // Resolve multiRepo filesystem detection
    const result = { ...normalized };
    for (const norm of normalizations) {
        if (norm.requiresFilesystem) {
            const detected = detectSubRepos(cwd);
            if (detected.length > 0) {
                const planning = result.planning ?? {};
                result.planning = { ...planning, sub_repos: detected, commit_docs: false };
            }
        }
    }
    try {
        writeFileSync(configPath, JSON.stringify(result, null, 2));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to write migrated config at ${configPath}: ${msg}`);
    }
    return { migrated: true, normalizations, wrote: configPath };
}

module.exports = {
  loadConfig,
  normalizeLegacyKeys,
  mergeDefaults,
  migrateOnDisk,
  CONFIG_DEFAULTS,
  VALID_CONFIG_KEYS,
  RUNTIME_STATE_KEYS,
  DYNAMIC_KEY_PATTERNS,
};
