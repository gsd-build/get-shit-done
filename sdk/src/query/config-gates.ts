/**
 * Batch workflow config for orchestration decisions (`check.config-gates`).
 *
 * Replaces many repeated `config-get workflow.*` calls with one JSON object.
 * See `.planning/research/decision-routing-audit.md` §3.3.
 */

import { CONFIG_DEFAULTS, loadConfig } from '../config.js';
import type { QueryHandler } from './utils.js';

/** Treat stringly YAML booleans safely (`Boolean('false')` is true — avoid that). */
function workflowBool(v: unknown, defaultVal: boolean): boolean {
  if (v === undefined || v === null) return defaultVal;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  }
  return Boolean(v);
}

/**
 * Merge workflow defaults with project config, then expose stable keys for workflows.
 */
export const checkConfigGates: QueryHandler = async (args, projectDir) => {
  const config = await loadConfig(projectDir);
  const wf: Record<string, unknown> = {
    ...(config.workflow as unknown as Record<string, unknown>),
  };
  const root = config as Record<string, unknown>;
  const contextWindow =
    typeof root.context_window === 'number' ? root.context_window : 200000;

  /** Prefer explicit `plan_checker` when present (alias); else `plan_check` (defaults include only the latter). */
  const w = wf as Record<string, unknown>;
  const planCheckFlag = w.plan_checker !== undefined ? w.plan_checker : w.plan_check;

  const data: Record<string, unknown> = {
    workflow: args[0] ?? null,
    research_enabled: workflowBool(wf.research, true),
    plan_checker_enabled: workflowBool(planCheckFlag, true),
    nyquist_validation: workflowBool(wf.nyquist_validation, true),
    security_enforcement: workflowBool(wf.security_enforcement, true),
    security_asvs_level: wf.security_asvs_level ?? 1,
    security_block_on: wf.security_block_on ?? 'high',
    ui_phase: workflowBool(wf.ui_phase, true),
    ui_safety_gate: workflowBool(wf.ui_safety_gate, true),
    ui_review: workflowBool(wf.ui_review, true),
    text_mode: workflowBool(wf.text_mode, false),
    auto_advance: workflowBool(wf.auto_advance, false),
    auto_chain_active: workflowBool(wf._auto_chain_active, false),
    code_review: workflowBool(wf.code_review, true),
    code_review_depth: wf.code_review_depth ?? 'standard',
    context_window: contextWindow,
    discuss_mode: String(wf.discuss_mode ?? 'discuss'),
    use_worktrees: workflowBool(wf.use_worktrees, true),
    skip_discuss: workflowBool(wf.skip_discuss, false),
    max_discuss_passes: wf.max_discuss_passes ?? 3,
    node_repair: workflowBool(wf.node_repair, true),
    research_before_questions: workflowBool(wf.research_before_questions, false),
    verifier: workflowBool(wf.verifier, true),
    plan_check: workflowBool(planCheckFlag, true),
    subagent_timeout: wf.subagent_timeout ?? CONFIG_DEFAULTS.workflow.subagent_timeout,
    context_coverage_gate: workflowBool(wf.context_coverage_gate, true),
  };

  return { data };
};
