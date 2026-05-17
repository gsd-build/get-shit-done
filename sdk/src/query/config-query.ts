/**
 * Config-get and resolve-model query handlers.
 *
 * Ported from get-shit-done/bin/lib/config.cjs and commands.cjs.
 * Provides raw config.json traversal and model profile resolution.
 *
 * @example
 * ```typescript
 * import { configGet, resolveModel } from './config-query.js';
 *
 * const result = await configGet(['workflow.auto_advance'], '/project');
 * // { data: true }
 *
 * const model = await resolveModel(['gsd-planner'], '/project');
 * // { data: { model: 'opus', profile: 'balanced' } }
 * ```
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { GSDError, ErrorClassification } from '../errors.js';
import { loadConfig } from '../config.js';
import { planningPaths } from './helpers.js';
import { maskIfSecret } from './secrets.js';
import type { QueryHandler } from './utils.js';
export { MODEL_PROFILES, VALID_PROFILES, getAgentToModelMapForProfile } from '../model-catalog.js';
import {
  AGENT_TO_PHASE_TYPE,
  MODEL_PROFILES,
  VALID_PROFILES,
  getAgentToModelMapForProfile,
  resolveRuntimeTierDefault,
  runtimesWithReasoningEffort,
} from '../model-catalog.js';

const RUNTIMES_WITH_REASONING_EFFORT = runtimesWithReasoningEffort();

/**
 * Schema-level defaults for well-known config keys.
 *
 * Mirrors the CJS table at get-shit-done/bin/lib/config.cjs:505-510 byte-for-
 * byte.  When `config-get` lookups fall off the dot path and no `--default`
 * was supplied, the handler consults this map before throwing
 * `Key not found`.  Without parity here, the SDK path emits
 * CONFIG_KEY_NOT_FOUND for keys the CJS path returns transparently — every
 * skill that reads `context_window`, `git.create_tag`, or executor stall
 * thresholds breaks under SDK dispatch.
 *
 * Bugs #2943, #3086, executor-stall-defaults tests — RED→GREEN via this
 * map. Keep this in lockstep with config.cjs:SCHEMA_DEFAULTS. Drift is
 * detected by the bug-2943 and #3086 behavioral suites: when the table
 * grows, both sides must grow together or those tests fail.
 */
const SCHEMA_DEFAULTS: Readonly<Record<string, string | number | boolean>> = Object.freeze({
  context_window: 200000,
  'executor.stall_detect_interval_minutes': 5,
  'executor.stall_threshold_minutes': 10,
  'git.create_tag': true,
});

// ─── configGet ──────────────────────────────────────────────────────────────

/**
 * Query handler for config-get command.
 *
 * Reads raw .planning/config.json and traverses dot-notation key paths.
 * Does NOT merge with defaults (matches gsd-tools.cjs behavior).
 *
 * @param args - args[0] is the dot-notation key path (e.g., 'workflow.auto_advance')
 * @param projectDir - Project root directory
 * @returns QueryResult with the config value at the given path
 * @throws GSDError with Validation classification if key missing or not found
 */
export const configGet: QueryHandler = async (args, projectDir, workstream) => {
  // Support --default <value> flag (#2803): return this value (exit 0) when the
  // key is absent, mirroring gsd-tools.cjs config-get behavior from #1893.
  const defaultIdx = args.indexOf('--default');
  let defaultValue: string | undefined;
  let filteredArgs = args;
  if (defaultIdx !== -1) {
    if (defaultIdx + 1 >= args.length) {
      throw new GSDError('Usage: config-get <key.path> [--default <value>]', ErrorClassification.Validation);
    }
    defaultValue = String(args[defaultIdx + 1]);
    filteredArgs = [...args.slice(0, defaultIdx), ...args.slice(defaultIdx + 2)];
  }

  const keyPath = filteredArgs[0];
  if (!keyPath) {
    throw new GSDError('Usage: config-get <key.path> [--default <value>]', ErrorClassification.Validation);
  }

  const paths = planningPaths(projectDir, workstream);
  let raw: string;
  try {
    raw = await readFile(paths.config, 'utf-8');
  } catch {
    // config.json missing — CJS parity (config.cjs:524-533):
    //   1. --default beats everything
    //   2. else SCHEMA_DEFAULTS supply a documented value (#2943)
    //   3. else CONFIG_NO_FILE error
    if (defaultValue !== undefined) return { data: defaultValue };
    if (Object.prototype.hasOwnProperty.call(SCHEMA_DEFAULTS, keyPath)) {
      return { data: SCHEMA_DEFAULTS[keyPath] };
    }
    const err = new GSDError(`No config.json found at ${paths.config}`, ErrorClassification.Validation);
    (err as GSDError & { reason?: string }).reason = 'config_no_file';
    throw err;
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Lead the message with "Failed to read config.json" — matches the CJS
    // `cmdConfigGet` / `setConfigValue` error vocabulary so tests written
    // against the legacy contract keep matching.
    const err = new GSDError(`Failed to read config.json: malformed JSON at ${paths.config}`, ErrorClassification.Validation);
    (err as GSDError & { reason?: string }).reason = 'config_parse_failed';
    throw err;
  }

  const keys = keyPath.split('.');
  let current: unknown = config;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      // UNIX convention (cf. `git config --get`): missing key exits 1, not 10.
      // See issue #2544 — callers use `if ! gsd-sdk query config-get k; then` patterns.
      // CJS parity ordering (config.cjs:543-551): --default first, then
      // SCHEMA_DEFAULTS, then CONFIG_KEY_NOT_FOUND.
      if (defaultValue !== undefined) return { data: defaultValue };
      if (Object.prototype.hasOwnProperty.call(SCHEMA_DEFAULTS, keyPath)) {
        return { data: SCHEMA_DEFAULTS[keyPath] };
      }
      const err = new GSDError(`Key not found: ${keyPath}`, ErrorClassification.Execution);
      (err as GSDError & { reason?: string }).reason = 'config_key_not_found';
      throw err;
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (current === undefined) {
    if (defaultValue !== undefined) return { data: defaultValue };
    if (Object.prototype.hasOwnProperty.call(SCHEMA_DEFAULTS, keyPath)) {
      return { data: SCHEMA_DEFAULTS[keyPath] };
    }
    const err = new GSDError(`Key not found: ${keyPath}`, ErrorClassification.Execution);
    (err as GSDError & { reason?: string }).reason = 'config_key_not_found';
    throw err;
  }

  // Mask plaintext for keys in SECRET_CONFIG_KEYS to match CJS behavior at
  // config.cjs:440-441 — without this, `gsd-sdk query config-get brave_search`
  // would echo the plaintext credential into machine-readable output. (#2997)
  return { data: maskIfSecret(keyPath, current) };
};

// ─── configPath ─────────────────────────────────────────────────────────────

/**
 * Query handler for config-path — resolved `.planning/config.json` path (workstream-aware via cwd).
 *
 * Port of `cmdConfigPath` from `config.cjs`. The JSON query API returns `{ path }`; the CJS CLI
 * emits the path as plain text for shell substitution.
 *
 * @param _args - Unused
 * @param projectDir - Project root directory
 * @returns QueryResult with `{ path: string }` absolute or project-relative resolution via planningPaths
 */
export const configPath: QueryHandler = async (_args, projectDir, workstream) => {
  const paths = planningPaths(projectDir, workstream);
  return { data: { path: paths.config } };
};

// ─── resolveModel ───────────────────────────────────────────────────────────

type RuntimeTierName = 'opus' | 'sonnet' | 'haiku';

interface RuntimeTierEntry {
  model?: string;
  reasoning_effort?: string;
}

function isRuntimeTierName(value: string): value is RuntimeTierName {
  return value === 'opus' || value === 'sonnet' || value === 'haiku';
}

function normalizeRuntimeTierEntry(entry: unknown): RuntimeTierEntry | null {
  if (typeof entry === 'string') return { model: entry };
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    return entry as RuntimeTierEntry;
  }
  return null;
}

function resolveRuntimeTier(config: Record<string, unknown>, tier: string): RuntimeTierEntry | null {
  if (!isRuntimeTierName(tier)) return null;

  const runtime = typeof config.runtime === 'string' ? config.runtime : '';
  if (!runtime || runtime === 'claude') return null;

  const builtin = resolveRuntimeTierDefault(runtime, tier);
  const profileOverrides = config.model_profile_overrides as Record<string, unknown> | undefined;
  const runtimeOverrides = profileOverrides?.[runtime] as Record<string, unknown> | undefined;
  const userEntry = normalizeRuntimeTierEntry(runtimeOverrides?.[tier]);

  if (!builtin && !userEntry) return null;
  const merged = { ...(builtin ?? {}), ...(userEntry ?? {}) };
  if (!RUNTIMES_WITH_REASONING_EFFORT.has(runtime)) {
    delete merged.reasoning_effort;
  }
  return merged;
}

/**
 * Query handler for resolve-model command.
 *
 * Resolves the model alias for a given agent type based on the current profile.
 * Uses loadConfig (with defaults) and MODEL_PROFILES for lookup.
 *
 * @param args - args[0] is the agent type (e.g., 'gsd-planner')
 * @param projectDir - Project root directory
 * @param workstream - Optional workstream name; forwarded to loadConfig so per-workstream
 *   model_profile settings are respected (mirrors configGet/configPath behavior)
 * @returns QueryResult with { model, profile } or { model, profile, unknown_agent: true }
 * @throws GSDError with Validation classification if agent type not provided
 */
export const resolveModel: QueryHandler = async (args, projectDir, workstream) => {
  const agentType = args[0];
  if (!agentType) {
    throw new GSDError('agent-type required', ErrorClassification.Validation);
  }

  const configFilePath = planningPaths(projectDir, workstream).config;
  const configExists = existsSync(configFilePath);
  const config = await loadConfig(projectDir, workstream);
  const profile = String(config.model_profile || 'balanced').toLowerCase();

  // Check per-agent override first
  const overrides = (config as Record<string, unknown>).model_overrides as Record<string, string> | undefined;
  const override = overrides?.[agentType];
  if (override) {
    const agentModels = MODEL_PROFILES[agentType];
    const result = agentModels
      ? { model: override, profile }
      : { model: override, profile, unknown_agent: true };
    return { data: result };
  }

  const agentModels = MODEL_PROFILES[agentType];

  // No project config -> return empty model id (CJS parity)
  const resolveModelIds = (config as Record<string, unknown>).resolve_model_ids;
  if (!configExists) {
    const result = agentModels
      ? { model: '', profile }
      : { model: '', profile, unknown_agent: true };
    return { data: result };
  }

  // Fall back to profile lookup
  if (!agentModels) {
    const semanticFallback =
      profile === 'quality' ? 'opus'
      : profile === 'budget' ? 'haiku'
      : profile === 'inherit' ? 'inherit'
      : 'sonnet';
    return { data: { model: semanticFallback, profile, unknown_agent: true } };
  }

  if (profile === 'inherit') {
    return { data: { model: 'inherit', profile } };
  }

  const alias = agentModels[profile] || agentModels['balanced'] || 'sonnet';
  const phaseType = AGENT_TO_PHASE_TYPE[agentType];
  const phaseTier = phaseType && typeof (config as Record<string, unknown>).models === 'object'
    ? ((config as Record<string, unknown>).models as Record<string, unknown>)[phaseType]
    : undefined;
  const tier = typeof phaseTier === 'string' ? phaseTier : alias;
  const runtimeTier = resolveRuntimeTier(config as Record<string, unknown>, tier);
  if (runtimeTier?.model) {
    const result: Record<string, unknown> = { model: runtimeTier.model, profile };
    if (runtimeTier.reasoning_effort) {
      result.reasoning_effort = runtimeTier.reasoning_effort;
    }
    return { data: result };
  }

  if (resolveModelIds === 'omit') {
    return { data: { model: '', profile } };
  }

  // #3643: runtime:claude bails out of resolveRuntimeTier (line 149) because
  // Claude is the implicit/default runtime, but consumers that asked for
  // resolved model IDs still need the full ID (e.g. "claude-sonnet-4-6"), not
  // the tier alias. Mirror the CJS branch at get-shit-done/bin/lib/core.cjs
  // (`if (config.resolve_model_ids) return MODEL_ALIAS_MAP[alias] || alias;`)
  // by consulting the catalog's claude runtime defaults for the resolved tier.
  const runtime = typeof (config as Record<string, unknown>).runtime === 'string'
    ? ((config as Record<string, unknown>).runtime as string)
    : '';
  // Empty/missing runtime is implicit Claude (per the resolveRuntimeTier bail-out
  // at line ~149); without this branch the resolved-IDs path silently fell
  // through to the alias return for projects that never set `runtime` explicitly.
  const isClaudeRuntime = runtime === '' || runtime === 'claude';
  if (resolveModelIds === true && isClaudeRuntime && isRuntimeTierName(tier)) {
    const claudeDefault = resolveRuntimeTierDefault('claude', tier);
    if (claudeDefault?.model) {
      return { data: { model: claudeDefault.model, profile } };
    }
  }

  return { data: { model: alias, profile } };
};
