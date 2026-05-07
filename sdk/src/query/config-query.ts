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
import { MODEL_PROFILES, VALID_PROFILES, getAgentToModelMapForProfile } from '../model-catalog.js';

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
    throw new GSDError(`No config.json found at ${paths.config}`, ErrorClassification.Validation);
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new GSDError(`Malformed config.json at ${paths.config}`, ErrorClassification.Validation);
  }

  const keys = keyPath.split('.');
  let current: unknown = config;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      // UNIX convention (cf. `git config --get`): missing key exits 1, not 10.
      // See issue #2544 — callers use `if ! gsd-sdk query config-get k; then` patterns.
      if (defaultValue !== undefined) return { data: defaultValue };
      throw new GSDError(`Key not found: ${keyPath}`, ErrorClassification.Execution);
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (current === undefined) {
    if (defaultValue !== undefined) return { data: defaultValue };
    throw new GSDError(`Key not found: ${keyPath}`, ErrorClassification.Execution);
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

  // No project config (or explicit omit policy) -> return empty model id (CJS parity)
  const resolveModelIds = (config as Record<string, unknown>).resolve_model_ids;
  if (!configExists || resolveModelIds === 'omit') {
    const agentModels = MODEL_PROFILES[agentType];
    const result = agentModels
      ? { model: '', profile }
      : { model: '', profile, unknown_agent: true };
    return { data: result };
  }

  // Fall back to profile lookup
  const agentModels = MODEL_PROFILES[agentType];
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
  return { data: { model: alias, profile } };
};
