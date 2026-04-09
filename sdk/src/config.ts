/**
 * Config reader — loads `.planning/config.json` and merges with defaults.
 *
 * Mirrors the default structure from `get-shit-done/bin/lib/config.cjs`
 * `buildNewProjectConfig()`.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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
  },
  hooks: {
    context_warnings: true,
  },
  agent_skills: {},
};

// ─── Loader ──────────────────────────────────────────────────────────────────

/**
 * Load project config from `.planning/config.json`, merging with defaults.
 * Returns full defaults when file is missing or empty.
 * Throws on malformed JSON with a helpful error message.
 */
export async function loadConfig(projectDir: string): Promise<GSDConfig> {
  const configPath = join(projectDir, '.planning', 'config.json');

  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    // File missing — normal for new projects
    return structuredClone(CONFIG_DEFAULTS);
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return structuredClone(CONFIG_DEFAULTS);
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

  // Three-level deep merge: defaults <- parsed
  return {
    ...structuredClone(CONFIG_DEFAULTS),
    ...parsed,
    git: {
      ...CONFIG_DEFAULTS.git,
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
