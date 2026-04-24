/**
 * Config reader — loads `.planning/config.json` and merges with defaults.
 *
 * Mirrors the default structure from `get-shit-done/bin/lib/config.cjs`
 * `buildNewProjectConfig()`.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { relPlanningPath } from './workstream-utils.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GitConfig {
  branching_strategy: string;
  phase_branch_template: string;
  milestone_branch_template: string;
  quick_branch_template: string | null;
}

export interface WorkflowConfig {
  research: boolean;
  plan_check: boolean;
  verifier: boolean;
  nyquist_validation: boolean;
  /** Mirrors gsd-tools flat `config.tdd_mode` (from `workflow.tdd_mode`). */
  tdd_mode: boolean;
  auto_advance: boolean;
  node_repair: boolean;
  node_repair_budget: number;
  ui_phase: boolean;
  ui_safety_gate: boolean;
  text_mode: boolean;
  research_before_questions: boolean;
  discuss_mode: string;
  skip_discuss: boolean;
  /** Maximum self-discuss passes in auto/headless mode before forcing proceed. Default: 3. */
  max_discuss_passes: number;
  /** Subagent timeout in ms (matches `get-shit-done/bin/lib/core.cjs` default 300000). */
  subagent_timeout: number;
  /**
   * Issue #2492. When true (default), enforces that every trackable decision in
   * CONTEXT.md `<decisions>` is referenced by at least one plan (translation
   * gate, blocking) and reports decisions not honored by shipped artifacts at
   * verify-phase (validation gate, non-blocking). Set false to disable both.
   */
  context_coverage_gate: boolean;
}

export interface HooksConfig {
  context_warnings: boolean;
}

export interface LoadConfigOptions {
  /** Home directory used to resolve `.gsd/defaults.json`; injectable for tests. */
  homeDir?: string;
}

export interface GSDConfig {
  model_profile: string;
  commit_docs: boolean;
  parallelization: boolean;
  search_gitignored: boolean;
  brave_search: boolean;
  firecrawl: boolean;
  exa_search: boolean;
  git: GitConfig;
  workflow: WorkflowConfig;
  hooks: HooksConfig;
  agent_skills: Record<string, unknown>;
  features: Record<string, unknown>;
  /** Per-agent model override map, e.g. `{ 'gsd-planner': 'claude-opus-4-7' }`. */
  model_overrides: Record<string, string>;
  /** Project slug for branch templates; mirrors gsd-tools `config.project_code`. */
  project_code?: string | null;
  /** Interactive vs headless; mirrors gsd-tools flat `config.mode`. */
  mode?: string;
  /** Internal auto-chain flag; mirrors gsd-tools `config._auto_chain_active`. */
  _auto_chain_active?: boolean;
  [key: string]: unknown;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const CONFIG_DEFAULTS: GSDConfig = {
  model_profile: 'balanced',
  commit_docs: true,
  parallelization: true,
  search_gitignored: false,
  brave_search: false,
  firecrawl: false,
  exa_search: false,
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
    tdd_mode: false,
    auto_advance: false,
    node_repair: true,
    node_repair_budget: 2,
    ui_phase: true,
    ui_safety_gate: true,
    text_mode: false,
    research_before_questions: false,
    discuss_mode: 'discuss',
    skip_discuss: false,
    max_discuss_passes: 3,
    subagent_timeout: 300000,
    context_coverage_gate: true,
  },
  hooks: {
    context_warnings: true,
  },
  agent_skills: {},
  features: {},
  model_overrides: {},
  project_code: null,
  mode: 'interactive',
  _auto_chain_active: false,
};

// ─── Loader ──────────────────────────────────────────────────────────────────

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const NESTED_CONFIG_SECTIONS = [
  'git',
  'workflow',
  'hooks',
  'agent_skills',
  'features',
  'model_overrides',
] as const;

/**
 * Merge a config override onto a fully materialized base config.
 *
 * Top-level keys override directly while known nested sections retain defaults
 * for omitted fields. Shared by config loading and project config creation so
 * nested merge allowlists do not drift.
 */
export function mergeConfig<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const merged: Record<string, unknown> = {
    ...base,
    ...override,
  };

  for (const section of NESTED_CONFIG_SECTIONS) {
    const baseSection = base[section];
    const overrideSection = override[section];

    if (isPlainRecord(baseSection) || isPlainRecord(overrideSection)) {
      merged[section] = {
        ...(isPlainRecord(baseSection) ? baseSection : {}),
        ...(isPlainRecord(overrideSection) ? overrideSection : {}),
      };
    }
  }

  return merged as T;
}

/**
 * Read user-level defaults from `<homeDir>/.gsd/defaults.json`.
 *
 * Missing, empty, malformed, or non-object defaults are ignored because global
 * defaults must never block SDK query execution.
 */
export async function loadUserDefaults(homeDir = homedir()): Promise<Record<string, unknown>> {
  const defaultsPath = join(homeDir, '.gsd', 'defaults.json');

  try {
    const raw = await readFile(defaultsPath, 'utf-8');
    const trimmed = raw.trim();
    if (trimmed === '') return {};

    const parsed: unknown = JSON.parse(trimmed);
    return isPlainRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Load project config from `.planning/config.json`, merging with defaults and
 * optional user defaults from `~/.gsd/defaults.json`.
 * Returns merged defaults when file is missing or empty.
 * Throws on malformed JSON with a helpful error message.
 */
export async function loadConfig(
  projectDir: string,
  workstream?: string,
  options: LoadConfigOptions = {},
): Promise<GSDConfig> {
  const configPath = join(projectDir, relPlanningPath(workstream), 'config.json');
  const rootConfigPath = join(projectDir, '.planning', 'config.json');
  const baseConfig = mergeConfig(CONFIG_DEFAULTS, await loadUserDefaults(options.homeDir));

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    // If workstream config missing, fall back to root config
    if (workstream) {
      try {
        raw = await readFile(rootConfigPath, 'utf-8');
      } catch {
        return baseConfig;
      }
    } else {
      // File missing — normal for new projects
      return baseConfig;
    }
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return baseConfig;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse config at ${configPath}: ${msg}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Config at ${configPath} must be a JSON object`);
  }

  // Three-level deep merge: defaults <- global defaults <- project config
  return mergeConfig(baseConfig, parsed);
}
