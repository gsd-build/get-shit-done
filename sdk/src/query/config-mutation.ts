/**
 * Config mutation handlers — write operations for .planning/config.json.
 *
 * Ported from get-shit-done/bin/lib/config.cjs.
 * Provides config-set (with key validation and value coercion),
 * config-set-model-profile, config-new-project, and config-ensure-section.
 *
 * @example
 * ```typescript
 * import { configSet, configNewProject } from './config-mutation.js';
 *
 * await configSet(['model_profile', 'quality'], '/project');
 * // { data: { updated: true, key: 'model_profile', value: 'quality', previousValue: 'balanced' } }
 *
 * await configNewProject([], '/project');
 * // { data: { created: true, path: '.planning/config.json' } }
 * ```
 */

import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { VALID_PROFILES, getAgentToModelMapForProfile } from './config-query.js';
import { VALID_CONFIG_KEYS, RUNTIME_STATE_KEYS, DYNAMIC_KEY_PATTERNS } from './config-schema.js';
import { planningPaths } from './helpers.js';
import { acquireStateLock, releaseStateLock } from './state-mutation.js';
import { maskIfSecret } from './secrets.js';
import type { QueryHandler } from './utils.js';

/**
 * Write config JSON atomically via temp file + rename to prevent
 * partial writes on process interruption.
 */
async function atomicWriteConfig(configPath: string, config: Record<string, unknown>): Promise<void> {
  const tmpPath = configPath + '.tmp.' + process.pid;
  const content = JSON.stringify(config, null, 2) + '\n';
  try {
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, configPath);
  } catch {
    // D5: Rename-failure fallback — clean up temp, fall back to direct write
    try { await unlink(tmpPath); } catch { /* already gone */ }
    await writeFile(configPath, content, 'utf-8');
  }
}

// ─── VALID_CONFIG_KEYS ────────────────────────────────────────────────────
// Imported from ./config-schema.js — single source of truth, kept in sync
// with get-shit-done/bin/lib/config-schema.cjs by a CI parity test (#2653).

// ─── CONFIG_KEY_SUGGESTIONS (D9 — match CJS config.cjs:57-67) ────────────

/**
 * Curated typo correction map for known config key mistakes.
 * Checked before the general LCP fallback for more precise suggestions.
 */
const CONFIG_KEY_SUGGESTIONS: Record<string, string> = {
  'workflow.nyquist_validation_enabled': 'workflow.nyquist_validation',
  'agents.nyquist_validation_enabled': 'workflow.nyquist_validation',
  'nyquist.validation_enabled': 'workflow.nyquist_validation',
  'hooks.research_questions': 'workflow.research_before_questions',
  'workflow.research_questions': 'workflow.research_before_questions',
  'workflow.codereview': 'workflow.code_review',
  'workflow.review_command': 'workflow.code_review_command',
  'workflow.review': 'workflow.code_review',
  'workflow.code_review_level': 'workflow.code_review_depth',
  'workflow.review_depth': 'workflow.code_review_depth',
  'review.model': 'review.models.<cli-name>',
  'sub_repos': 'planning.sub_repos',
  'plan_checker': 'workflow.plan_check',
};

// ─── isValidConfigKey ─────────────────────────────────────────────────────

/**
 * Check whether a config key path is valid.
 *
 * Supports exact matches from VALID_CONFIG_KEYS plus dynamic patterns
 * like `agent_skills.<agent-type>` and `features.<feature_name>`.
 * Uses curated CONFIG_KEY_SUGGESTIONS before LCP fallback for typo correction.
 *
 * @param keyPath - Dot-notation config key path
 * @returns Object with valid flag and optional suggestion for typos
 */
export function isValidConfigKey(keyPath: string): { valid: boolean; suggestion?: string } {
  if (VALID_CONFIG_KEYS.has(keyPath)) return { valid: true };
  if (RUNTIME_STATE_KEYS.has(keyPath)) return { valid: true };

  // Dynamic patterns — all sourced from shared config-schema (#2653).
  // Covers agent_skills.*, review.models.*, features.*,
  // claude_md_assembly.blocks.*, and model_profile_overrides.*.<tier>.
  if (DYNAMIC_KEY_PATTERNS.some((p) => p.test(keyPath))) return { valid: true };

  // D9: Check curated suggestions before LCP fallback
  if (CONFIG_KEY_SUGGESTIONS[keyPath]) {
    return { valid: false, suggestion: CONFIG_KEY_SUGGESTIONS[keyPath] };
  }

  // Find closest suggestion using longest common prefix
  const keys = [...VALID_CONFIG_KEYS];
  let bestMatch = '';
  let bestScore = 0;

  for (const candidate of keys) {
    let shared = 0;
    const maxLen = Math.min(keyPath.length, candidate.length);
    for (let i = 0; i < maxLen; i++) {
      if (keyPath[i] === candidate[i]) shared++;
      else break;
    }
    if (shared > bestScore) {
      bestScore = shared;
      bestMatch = candidate;
    }
  }

  return { valid: false, suggestion: bestScore > 2 ? bestMatch : undefined };
}

// ─── parseConfigValue ─────────────────────────────────────────────────────

/**
 * Coerce a CLI string value to its native type.
 *
 * Ported from config.cjs lines 344-351.
 *
 * @param value - String value from CLI
 * @returns Coerced value: boolean, number, parsed JSON, or original string
 */
export function parseConfigValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !isNaN(Number(value))) return Number(value);
  if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
    try { return JSON.parse(value); } catch { /* keep as string */ }
  }
  return value;
}

// ─── setConfigValue ───────────────────────────────────────────────────────

/**
 * Set a value at a dot-notation path in a config object.
 *
 * Creates nested objects as needed along the path.
 *
 * @param obj - Config object to mutate
 * @param dotPath - Dot-notation key path (e.g., 'workflow.auto_advance')
 * @param value - Value to set
 */
function getValueAtPath(obj: Record<string, unknown>, dotPath: string): unknown {
  const keys = dotPath.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setConfigValue(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const keys = dotPath.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

// ─── configSet ────────────────────────────────────────────────────────────

/**
 * Write a validated key-value pair to config.json.
 *
 * Validates key against VALID_CONFIG_KEYS allowlist, coerces value
 * from CLI string to native type, and writes config.json.
 *
 * @param args - args[0]=key, args[1]=value
 * @param projectDir - Project root directory
 * @returns QueryResult matching gsd-tools `config-set` JSON: `{ updated, key, value, previousValue }`
 * @throws GSDError with Validation if key is invalid or args missing
 */
export const configSet: QueryHandler = async (args, projectDir, workstream) => {
  const keyPath = args[0];
  const rawValue = args[1];
  if (!keyPath) {
    throw new GSDError('Usage: config-set <key.path> <value>', ErrorClassification.Validation);
  }

  const validation = isValidConfigKey(keyPath);
  if (!validation.valid) {
    const suggestion = validation.suggestion ? `. Did you mean: ${validation.suggestion}?` : '';
    throw new GSDError(
      `Unknown config key: "${keyPath}"${suggestion}`,
      ErrorClassification.Validation,
    );
  }

  const parsedValue = rawValue !== undefined ? parseConfigValue(rawValue) : rawValue;

  // D8: Context value validation (match CJS config.cjs:357-359)
  const VALID_CONTEXT_VALUES = ['dev', 'research', 'review'];
  if (keyPath === 'context' && !VALID_CONTEXT_VALUES.includes(String(parsedValue))) {
    throw new GSDError(
      `Invalid context value '${rawValue}'. Valid values: ${VALID_CONTEXT_VALUES.join(', ')}`,
      ErrorClassification.Validation,
    );
  }

  // D6: Lock protection for read-modify-write (match CJS config.cjs:296)
  const paths = planningPaths(projectDir, workstream);
  const lockPath = await acquireStateLock(paths.config);
  let previousValue: unknown;
  try {
    let config: Record<string, unknown> = {};
    try {
      const raw = await readFile(paths.config, 'utf-8');
      config = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Start with empty config if file doesn't exist or is malformed
    }

    previousValue = getValueAtPath(config, keyPath);
    setConfigValue(config, keyPath, parsedValue);
    await atomicWriteConfig(paths.config, config);
  } finally {
    await releaseStateLock(lockPath);
  }

  // Mask plaintext for keys in SECRET_CONFIG_KEYS to match CJS behavior at
  // config.cjs:362-370 — without this, `gsd-sdk query config-set brave_search XXX`
  // would echo the plaintext credential into machine-readable output. (#2997)
  // The on-disk value is intentionally NOT masked — only the response.
  const data: Record<string, unknown> = {
    updated: true,
    key: keyPath,
    value: maskIfSecret(keyPath, parsedValue),
  };
  if (previousValue !== undefined) {
    data.previousValue = maskIfSecret(keyPath, previousValue);
  }
  return { data };
};

// ─── configSetModelProfile ────────────────────────────────────────────────

/**
 * Validate and set the model profile in config.json.
 *
 * @param args - args[0]=profileName
 * @param projectDir - Project root directory
 * @returns QueryResult with { set: true, profile, agents }
 * @throws GSDError with Validation if profile is invalid
 */
export const configSetModelProfile: QueryHandler = async (args, projectDir, workstream) => {
  const profileName = args[0];
  if (!profileName) {
    throw new GSDError(
      `Usage: config-set-model-profile <${VALID_PROFILES.join('|')}>`,
      ErrorClassification.Validation,
    );
  }

  const normalized = profileName.toLowerCase().trim();
  if (!VALID_PROFILES.includes(normalized)) {
    throw new GSDError(
      `Invalid profile '${profileName}'. Valid profiles: ${VALID_PROFILES.join(', ')}`,
      ErrorClassification.Validation,
    );
  }

  // D6: Lock protection for read-modify-write
  const paths = planningPaths(projectDir, workstream);
  const lockPath = await acquireStateLock(paths.config);
  let previousProfile = 'balanced';
  try {
    let config: Record<string, unknown> = {};
    try {
      const raw = await readFile(paths.config, 'utf-8');
      config = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Start with empty config
    }

    const prev =
      typeof config.model_profile === 'string' ? config.model_profile.toLowerCase().trim() : '';
    previousProfile = VALID_PROFILES.includes(prev) ? prev : 'balanced';
    config.model_profile = normalized;
    await atomicWriteConfig(paths.config, config);
  } finally {
    await releaseStateLock(lockPath);
  }

  const agentToModelMap = getAgentToModelMapForProfile(normalized);
  return {
    data: {
      updated: true,
      profile: normalized,
      previousProfile,
      agentToModelMap,
    },
  };
};

// ─── configNewProject ─────────────────────────────────────────────────────

/**
 * Create config.json with defaults and optional user choices.
 *
 * Idempotent: if config.json already exists, returns { created: false }.
 * Detects API key availability from environment variables.
 *
 * @param args - args[0]=optional JSON string of user choices
 * @param projectDir - Project root directory
 * @returns QueryResult with { created: true, path } or { created: false, reason }
 */
export const configNewProject: QueryHandler = async (args, projectDir, workstream) => {
  const paths = planningPaths(projectDir, workstream);

  // Idempotent: don't overwrite existing config
  if (existsSync(paths.config)) {
    return { data: { created: false, reason: 'already_exists' } };
  }

  // Parse user choices
  let userChoices: Record<string, unknown> = {};
  if (args[0] && args[0].trim() !== '') {
    try {
      userChoices = JSON.parse(args[0]) as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new GSDError(`Invalid JSON for config-new-project: ${msg}`, ErrorClassification.Validation);
    }
  }

  // Ensure .planning directory exists
  const planningDir = paths.planning;
  if (!existsSync(planningDir)) {
    await mkdir(planningDir, { recursive: true });
  }

  // D11: Load global defaults from ~/.gsd/defaults.json if present
  const homeDir = homedir();
  let globalDefaults: Record<string, unknown> = {};
  try {
    const defaultsPath = join(homeDir, '.gsd', 'defaults.json');
    const defaultsRaw = await readFile(defaultsPath, 'utf-8');
    globalDefaults = JSON.parse(defaultsRaw) as Record<string, unknown>;
  } catch {
    // No global defaults — continue with hardcoded defaults only
  }

  // Detect API key availability (boolean only, never store keys)
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || existsSync(join(homeDir, '.gsd', 'brave_api_key')));
  const hasFirecrawl = !!(process.env.FIRECRAWL_API_KEY || existsSync(join(homeDir, '.gsd', 'firecrawl_api_key')));
  const hasExaSearch = !!(process.env.EXA_API_KEY || existsSync(join(homeDir, '.gsd', 'exa_api_key')));

  // Build default config
  const defaults: Record<string, unknown> = {
    model_profile: 'balanced',
    commit_docs: false,
    parallelization: 1,
    search_gitignored: false,
    brave_search: hasBraveSearch,
    firecrawl: hasFirecrawl,
    exa_search: hasExaSearch,
    git: {
      branching_strategy: 'none',
      phase_branch_template: 'gsd/phase-{phase}-{slug}',
      milestone_branch_template: 'gsd/{milestone}-{slug}',
      quick_branch_template: null,
    },
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: true,
      auto_advance: false,
      node_repair: true,
      node_repair_budget: 2,
      ui_phase: true,
      ui_safety_gate: true,
      text_mode: false,
      research_before_questions: false,
      discuss_mode: 'discuss',
      skip_discuss: false,
      code_review: true,
      code_review_depth: 'standard',
    },
    hooks: {
      context_warnings: true,
    },
    project_code: null,
    phase_naming: 'sequential',
    agent_skills: {},
    features: {},
  };

  // Deep merge: hardcoded <- globalDefaults <- userChoices (D11)
  const config: Record<string, unknown> = {
    ...defaults,
    ...globalDefaults,
    ...userChoices,
    git: {
      ...(defaults.git as Record<string, unknown>),
      ...((globalDefaults.git as Record<string, unknown>) || {}),
      ...((userChoices.git as Record<string, unknown>) || {}),
    },
    workflow: {
      ...(defaults.workflow as Record<string, unknown>),
      ...((globalDefaults.workflow as Record<string, unknown>) || {}),
      ...((userChoices.workflow as Record<string, unknown>) || {}),
    },
    hooks: {
      ...(defaults.hooks as Record<string, unknown>),
      ...((globalDefaults.hooks as Record<string, unknown>) || {}),
      ...((userChoices.hooks as Record<string, unknown>) || {}),
    },
    agent_skills: {
      ...((defaults.agent_skills as Record<string, unknown>) || {}),
      ...((globalDefaults.agent_skills as Record<string, unknown>) || {}),
      ...((userChoices.agent_skills as Record<string, unknown>) || {}),
    },
    features: {
      ...((defaults.features as Record<string, unknown>) || {}),
      ...((globalDefaults.features as Record<string, unknown>) || {}),
      ...((userChoices.features as Record<string, unknown>) || {}),
    },
  };

  await atomicWriteConfig(paths.config, config);

  return { data: { created: true, path: paths.config } };
};

// ─── configEnsureSection ──────────────────────────────────────────────────

/**
 * Idempotently ensure a top-level section exists in config.json.
 *
 * If the section key doesn't exist, creates it as an empty object.
 * If it already exists, preserves its contents.
 *
 * @param args - args[0]=sectionName
 * @param projectDir - Project root directory
 * @returns QueryResult with { ensured: true, section }
 */
export const configEnsureSection: QueryHandler = async (args, projectDir, workstream) => {
  const sectionName = args[0];
  if (!sectionName) {
    throw new GSDError('Usage: config-ensure-section <section>', ErrorClassification.Validation);
  }

  const paths = planningPaths(projectDir, workstream);
  let config: Record<string, unknown> = {};
  try {
    const raw = await readFile(paths.config, 'utf-8');
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Start with empty config
  }

  if (!(sectionName in config)) {
    config[sectionName] = {};
  }

  await atomicWriteConfig(paths.config, config);

  return { data: { ensured: true, section: sectionName } };
};
