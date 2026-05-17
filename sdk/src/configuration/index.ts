/**
 * Configuration Module — single source of truth for config loading,
 * legacy-key normalization, defaults merge, and explicit on-disk migration.
 *
 * Source of truth for both the SDK and (via generator) the CJS side.
 * Manifests are read from sdk/shared/*.manifest.json.
 *
 * Public API:
 *   loadConfig(cwd, options?) → MergedConfig       — pure read, never writes disk
 *   normalizeLegacyKeys(parsed) → { parsed, normalizations[] }  — pure transform
 *   mergeDefaults(parsed) → MergedConfig            — fills in defaults
 *   migrateOnDisk(cwd) → MigrationReport           — explicit, opt-in disk writeback
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Manifest imports ─────────────────────────────────────────────────────────

const DEFAULTS_PATH = new URL('../../shared/config-defaults.manifest.json', import.meta.url);
export const CONFIG_DEFAULTS: Record<string, unknown> = JSON.parse(
  readFileSync(fileURLToPath(DEFAULTS_PATH), 'utf-8'),
);

const SCHEMA_PATH = new URL('../../shared/config-schema.manifest.json', import.meta.url);
const _schemaManifest: {
  validKeys: string[];
  runtimeStateKeys: string[];
  dynamicKeyPatterns: Array<{ topLevel: string; source: string; description: string }>;
} = JSON.parse(readFileSync(fileURLToPath(SCHEMA_PATH), 'utf-8'));

export const VALID_CONFIG_KEYS: ReadonlySet<string> = new Set(_schemaManifest.validKeys);
export const RUNTIME_STATE_KEYS: ReadonlySet<string> = new Set(_schemaManifest.runtimeStateKeys);

export interface DynamicKeyPattern {
  readonly topLevel: string;
  readonly source: string;
  readonly description: string;
  readonly test: (key: string) => boolean;
}

export const DYNAMIC_KEY_PATTERNS: readonly DynamicKeyPattern[] = _schemaManifest.dynamicKeyPatterns.map(
  (p) => {
    const pattern = new RegExp(p.source);
    return {
      ...p,
      test: (key: string) => {
        pattern.lastIndex = 0;
        return pattern.test(key);
      },
    };
  },
);

// ─── Types ───────────────────────────────────────────────────────────────────

/** Broad merged config type — consumers narrow as needed. */
export type MergedConfig = Record<string, unknown>;

export interface Normalization {
  from: string;
  to: string;
  value: unknown;
  requiresFilesystem?: true;
}

export interface NormalizationResult {
  parsed: MergedConfig;
  normalizations: Normalization[];
}

export interface MigrationReport {
  migrated: boolean;
  normalizations: Normalization[];
  wrote: string | null;
}

export interface LoadConfigOptions {
  /** Optional workstream name — routes to .planning/workstreams/<name>/config.json */
  workstream?: string;
  /** Optional callback to observe normalizations applied during load */
  onNormalizations?: (normalizations: Normalization[]) => void;
}

// ─── Depth → Granularity mapping ─────────────────────────────────────────────

const DEPTH_TO_GRANULARITY: Record<string, string> = {
  quick: 'coarse',
  standard: 'standard',
  comprehensive: 'fine',
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function planningDir(cwd: string, workstream?: string): string {
  if (!workstream) return join(cwd, '.planning');
  return join(cwd, '.planning', 'workstreams', workstream);
}

function detectSubRepos(cwd: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(cwd, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const gitPath = join(cwd, entry.name, '.git');
      try {
        if (existsSync(gitPath)) {
          results.push(entry.name);
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return results.sort();
}

/**
 * Deep-merge two plain config objects. overlay wins on key conflict.
 * Explicit null in overlay overrides base (null means "unset this key").
 * Arrays are replaced, not merged. undefined in overlay falls back to base.
 */
function deepMergeConfig(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overlay)) {
    const ov = overlay[key];
    if (ov !== null && ov !== undefined && typeof ov === 'object' && !Array.isArray(ov)) {
      const bv = base[key];
      if (bv !== null && bv !== undefined && typeof bv === 'object' && !Array.isArray(bv)) {
        result[key] = deepMergeConfig(bv as Record<string, unknown>, ov as Record<string, unknown>);
      } else {
        result[key] = deepMergeConfig({}, ov as Record<string, unknown>);
      }
    } else {
      result[key] = ov;
    }
  }
  return result;
}

// ─── normalizeLegacyKeys ─────────────────────────────────────────────────────

/**
 * Pure transform: migrate legacy top-level config keys to their canonical nested locations.
 * Returns the normalized parsed object + a list of normalizations applied.
 * Idempotent: calling twice returns the same result with empty normalizations second time.
 *
 * Normalizations applied (in order):
 *   1. top-level branching_strategy → git.branching_strategy (canonical wins if both present)
 *   2. top-level sub_repos → planning.sub_repos (canonical wins if both present)
 *   3. multiRepo: true → planning.sub_repos marker (requiresFilesystem: true)
 *   4. top-level depth → granularity (top-level) with mapping quick→coarse/standard→standard/comprehensive→fine
 */
export function normalizeLegacyKeys(parsed: Record<string, unknown>): NormalizationResult {
  const result: Record<string, unknown> = { ...parsed };
  const normalizations: Normalization[] = [];

  // 1. branching_strategy → git.branching_strategy
  if (Object.prototype.hasOwnProperty.call(result, 'branching_strategy')) {
    const value = result.branching_strategy;
    const git = (result.git as Record<string, unknown> | undefined) ?? {};
    if (git.branching_strategy === undefined) {
      result.git = { ...git, branching_strategy: value };
    } else {
      // canonical nested wins — just delete the stale top-level
      result.git = { ...git };
    }
    delete result.branching_strategy;
    normalizations.push({ from: 'branching_strategy', to: 'git.branching_strategy', value });
  }

  // 2. top-level sub_repos → planning.sub_repos
  if (Object.prototype.hasOwnProperty.call(result, 'sub_repos')) {
    const value = result.sub_repos;
    const planning = (result.planning as Record<string, unknown> | undefined) ?? {};
    if (planning.sub_repos === undefined) {
      result.planning = { ...planning, sub_repos: value };
    } else {
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
    const rawDepth = result.depth as string;
    const mapped = DEPTH_TO_GRANULARITY[rawDepth] ?? rawDepth;
    result.granularity = mapped;
    delete result.depth;
    normalizations.push({ from: 'depth', to: 'granularity', value: mapped });
  }

  return { parsed: result, normalizations };
}

// ─── mergeDefaults ───────────────────────────────────────────────────────────

/**
 * Fill in CONFIG_DEFAULTS where the parsed object lacks values.
 * Deep-merges per-section (git, workflow, hooks, agent_skills, planning, ship).
 * Boolean false and explicit null are preserved — not overridden by truthy defaults.
 */
export function mergeDefaults(parsed: Record<string, unknown>): MergedConfig {
  // Start with a deep clone of defaults, then overlay parsed
  const defaults = JSON.parse(JSON.stringify(CONFIG_DEFAULTS)) as Record<string, unknown>;
  return deepMergeConfig(defaults, parsed);
}

// ─── loadConfig ──────────────────────────────────────────────────────────────

/**
 * Load project config from .planning/config.json (workstream-aware).
 * Pure read — never writes disk.
 *
 * Pipeline: parse JSON → normalizeLegacyKeys → mergeDefaults → return.
 *
 * Missing file → returns CONFIG_DEFAULTS verbatim.
 * Empty file → returns CONFIG_DEFAULTS verbatim.
 * Malformed JSON → throws with informative error.
 */
export async function loadConfig(cwd: string, options?: LoadConfigOptions): Promise<MergedConfig> {
  const configPath = join(planningDir(cwd, options?.workstream), 'config.json');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    // File missing — return defaults
    return mergeDefaults({});
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return mergeDefaults({});
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch (err) {
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

// ─── migrateOnDisk ───────────────────────────────────────────────────────────

/**
 * Explicit, opt-in disk writeback.
 * Reads raw config, runs normalizeLegacyKeys, writes back only if normalizations are non-empty.
 *
 * For multiRepo: true entries, also runs filesystem detection to populate planning.sub_repos.
 *
 * Returns MigrationReport: { migrated, normalizations, wrote }.
 */
export async function migrateOnDisk(cwd: string, workstream?: string): Promise<MigrationReport> {
  const configPath = join(planningDir(cwd, workstream), 'config.json');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    // File missing — nothing to migrate
    return { migrated: false, normalizations: [], wrote: null };
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return { migrated: false, normalizations: [], wrote: null };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
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
        const planning = (result.planning as Record<string, unknown> | undefined) ?? {};
        result.planning = { ...planning, sub_repos: detected, commit_docs: false };
      }
    }
  }

  try {
    writeFileSync(configPath, JSON.stringify(result, null, 2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to write migrated config at ${configPath}: ${msg}`);
  }
  return { migrated: true, normalizations, wrote: configPath };
}
