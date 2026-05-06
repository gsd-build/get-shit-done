/**
 * Config reader — loads `.planning/config.json` and merges with defaults.
 *
 * Mirrors the default structure from `get-shit-done/bin/lib/config.cjs`
 * `buildNewProjectConfig()`.
 */

import { readFile } from 'node:fs/promises';
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
  /** Internal auto-chain flag used by workflow routing. */
  _auto_chain_active?: boolean;
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
  /** Project slug for branch templates; mirrors gsd-tools `config.project_code`. */
  project_code?: string | null;
  /** Interactive vs headless; mirrors gsd-tools flat `config.mode`. */
  mode?: string;
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
    _auto_chain_active: false,
  },
  hooks: {
    context_warnings: true,
  },
  agent_skills: {},
  project_code: null,
  mode: 'interactive',
};

// ─── Loader ──────────────────────────────────────────────────────────────────

/**
 * Load project config from `.planning/config.json`, merging with defaults.
 * When project config is missing or empty, this returns `mergeDefaults({})`
 * (built-in defaults only; no `~/.gsd/defaults.json` layering).
 * Throws on malformed JSON with a helpful error message.
 */
export async function loadConfig(projectDir: string, workstream?: string): Promise<GSDConfig> {
  const configPath = join(projectDir, relPlanningPath(workstream), 'config.json');
  const rootConfigPath = join(projectDir, '.planning', 'config.json');

  let raw: string;
  let projectConfigFound = false;
  try {
    raw = await readFile(configPath, 'utf-8');
    projectConfigFound = true;
  } catch {
    // If workstream config missing, fall back to root config
    if (workstream) {
      try {
        raw = await readFile(rootConfigPath, 'utf-8');
        projectConfigFound = true;
      } catch {
        raw = '';
      }
    } else {
      raw = '';
    }
  }

  // Pre-project context: no .planning/config.json exists.
  // Use built-in defaults only so SDK query parity stays stable across machines.
  if (!projectConfigFound) {
    return mergeDefaults({});
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    // Empty project config — treat as no project config.
    return mergeDefaults({});
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

  // Project config exists — user-level defaults are ignored (CJS parity).
  // `buildNewProjectConfig` already baked them into config.json at /gsd-new-project.
  return mergeDefaults(parsed);
}

function mergeDefaults(parsed: Record<string, unknown>): GSDConfig {
  const legacyBranchingStrategy = typeof parsed.branching_strategy === 'string'
    ? parsed.branching_strategy
    : undefined;

  return {
    ...structuredClone(CONFIG_DEFAULTS),
    ...parsed,
    git: {
      ...CONFIG_DEFAULTS.git,
      ...(legacyBranchingStrategy ? { branching_strategy: legacyBranchingStrategy } : {}),
      ...(parsed.git as Partial<GitConfig> ?? {}),
    },
    workflow: {
      ...CONFIG_DEFAULTS.workflow,
      ...(parsed.workflow as Partial<WorkflowConfig> ?? {}),
    },
    hooks: {
      ...CONFIG_DEFAULTS.hooks,
      ...(parsed.hooks as Partial<HooksConfig> ?? {}),
    },
    agent_skills: {
      ...CONFIG_DEFAULTS.agent_skills,
      ...(parsed.agent_skills as Record<string, unknown> ?? {}),
    },
  };
}
