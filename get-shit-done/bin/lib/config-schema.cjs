'use strict';

/**
 * Single source of truth for valid config key paths.
 *
 * Imported by:
 *   - config.cjs (isValidConfigKey validator)
 *   - tests/config-schema-docs-parity.test.cjs (CI drift guard)
 *
 * Adding a key here without documenting it in docs/CONFIGURATION.md will
 * fail the parity test. Adding a key to docs/CONFIGURATION.md without
 * adding it here will cause config-set to reject it at runtime.
 */

/** Exact-match config key paths accepted by config-set. */
const VALID_CONFIG_KEYS = new Set([
  'mode', 'granularity', 'parallelization', 'commit_docs', 'model_profile',
  'search_gitignored', 'brave_search', 'firecrawl', 'exa_search',
  'workflow.research', 'workflow.plan_check', 'workflow.verifier',
  'workflow.nyquist_validation', 'workflow.ai_integration_phase', 'workflow.ui_phase', 'workflow.ui_safety_gate',
  'workflow.auto_advance', 'workflow.node_repair', 'workflow.node_repair_budget',
  'workflow.tdd_mode',
  'workflow.text_mode',
  'workflow.research_before_questions',
  'workflow.discuss_mode',
  'workflow.skip_discuss',
  'workflow.auto_prune_state',
  'workflow.use_worktrees',
  'workflow.worktree_skip_hooks',
  'workflow.code_review',
  'workflow.code_review_depth',
  'workflow.code_review_command',
  'workflow.pattern_mapper',
  'workflow.plan_bounce',
  'workflow.plan_bounce_script',
  'workflow.plan_bounce_passes',
  'workflow.plan_chunked',
  'workflow.plan_review_convergence',
  'workflow.post_planning_gaps',
  'workflow.security_enforcement',
  'workflow.security_asvs_level',
  'workflow.security_block_on',
  'workflow.drift_threshold',
  'workflow.drift_action',
  'git.branching_strategy', 'git.base_branch', 'git.phase_branch_template', 'git.milestone_branch_template', 'git.quick_branch_template',
  'planning.commit_docs', 'planning.search_gitignored', 'planning.sub_repos',
  'review.ollama_host', 'review.lm_studio_host', 'review.llama_cpp_host',
  'workflow.cross_ai_execution', 'workflow.cross_ai_command', 'workflow.cross_ai_timeout',
  'workflow.subagent_timeout',
  'workflow.inline_plan_threshold',
  'hooks.context_warnings',
  'hooks.workflow_guard',
  'workflow.context_coverage_gate',
  'statusline.show_last_command',
  'workflow.ui_review',
  'workflow.max_discuss_passes',
  'features.thinking_partner',
  'context',
  'features.global_learnings',
  'learnings.max_inject',
  'project_code', 'phase_naming',
  'manager.flags.discuss', 'manager.flags.plan', 'manager.flags.execute',
  'response_language',
  'context_window',
  'intel.enabled',
  'graphify.enabled',
  'graphify.build_timeout',
  'claude_md_path',
  'claude_md_assembly.mode',
  // #2517 — runtime-aware model profiles
  'runtime',
  // #3162 — documented top-level key: controls model ID resolution for non-Claude runtimes
  'resolve_model_ids',
]);

/**
 * Internal runtime-state keys — accepted by config-set (workflows write them) but not
 * exposed as user-settable options.  Excluded from VALID_CONFIG_KEYS so they stay out of
 * the public docs-parity check and the "Valid keys:" error message.
 * See: #3162 (workflow._auto_chain_active written by plan/execute/discuss workflows)
 */
const RUNTIME_STATE_KEYS = new Set([
  'workflow._auto_chain_active',
]);

/**
 * Dynamic-pattern validators — keys matching these regexes are also accepted.
 * Each entry has a `test` function and a human-readable `description`.
 */
const DYNAMIC_KEY_PATTERNS = [
  { topLevel: 'agent_skills',          test: (k) => /^agent_skills\.[a-zA-Z0-9_-]+$/.test(k),                   description: 'agent_skills.<agent-type>' },
  { topLevel: 'review',                test: (k) => /^review\.models\.[a-zA-Z0-9_-]+$/.test(k),                 description: 'review.models.<cli-name>' },
  { topLevel: 'features',              test: (k) => /^features\.[a-zA-Z0-9_]+$/.test(k),                        description: 'features.<feature_name>' },
  { topLevel: 'claude_md_assembly',    test: (k) => /^claude_md_assembly\.blocks\.[a-zA-Z0-9_]+$/.test(k),      description: 'claude_md_assembly.blocks.<section>' },
  // #2517 — runtime-aware model profile overrides: model_profile_overrides.<runtime>.<tier>
  // <runtime> is a free string (so users can map non-built-in runtimes); <tier> is enum-restricted.
  { topLevel: 'model_profile_overrides', test: (k) => /^model_profile_overrides\.[a-zA-Z0-9_-]+\.(opus|sonnet|haiku)$/.test(k),
    description: 'model_profile_overrides.<runtime>.<opus|sonnet|haiku>' },
  // #3023 — per-phase-type model map: models.<phase_type> = <tier>
  // Six named slots (planning/discuss/research/execution/verification/completion);
  // unknown phase-types are rejected. Per-agent model_overrides still take
  // precedence over phase-type at resolve time.
  { topLevel: 'models', test: (k) => /^models\.(planning|discuss|research|execution|verification|completion)$/.test(k),
    description: 'models.<planning|discuss|research|execution|verification|completion>' },
  // #3024 — dynamic routing block. Three top-level scalar settings
  // plus a tier_models sub-block keyed by light/standard/heavy.
  { topLevel: 'dynamic_routing',
    test: (k) => /^dynamic_routing\.(enabled|escalate_on_failure|max_escalations|tier_models\.(light|standard|heavy))$/.test(k),
    description: 'dynamic_routing.<enabled|escalate_on_failure|max_escalations|tier_models.<light|standard|heavy>>' },
];

/**
 * Returns true if keyPath is a valid config key (exact, dynamic pattern, or runtime state).
 */
function isValidConfigKey(keyPath) {
  if (VALID_CONFIG_KEYS.has(keyPath)) return true;
  if (RUNTIME_STATE_KEYS.has(keyPath)) return true;
  return DYNAMIC_KEY_PATTERNS.some((p) => p.test(keyPath));
}

module.exports = { VALID_CONFIG_KEYS, RUNTIME_STATE_KEYS, DYNAMIC_KEY_PATTERNS, isValidConfigKey };
