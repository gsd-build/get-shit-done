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
  'workflow.code_review',
  'workflow.code_review_depth',
  'workflow.code_review_command',
  'workflow.pattern_mapper',
  'workflow.plan_bounce',
  'workflow.plan_bounce_script',
  'workflow.plan_bounce_passes',
  'workflow.plan_chunked',
  'workflow.security_enforcement',
  'workflow.security_asvs_level',
  'workflow.security_block_on',
  'git.branching_strategy', 'git.base_branch', 'git.phase_branch_template', 'git.milestone_branch_template', 'git.quick_branch_template',
  'planning.commit_docs', 'planning.search_gitignored', 'planning.sub_repos',
  'workflow.cross_ai_execution', 'workflow.cross_ai_command', 'workflow.cross_ai_timeout',
  'workflow.subagent_timeout',
  'workflow.inline_plan_threshold',
  'hooks.context_warnings',
  'hooks.workflow_guard',
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
]);

/**
 * Dynamic-pattern validators — keys matching these regexes are also accepted.
 * Each entry has a `test` function and a human-readable `description`.
 */
const DYNAMIC_KEY_PATTERNS = [
  { test: (k) => /^agent_skills\.[a-zA-Z0-9_-]+$/.test(k),                   description: 'agent_skills.<agent-type>' },
  { test: (k) => /^review\.models\.[a-zA-Z0-9_-]+$/.test(k),                 description: 'review.models.<cli-name>' },
  { test: (k) => /^features\.[a-zA-Z0-9_]+$/.test(k),                        description: 'features.<feature_name>' },
  { test: (k) => /^claude_md_assembly\.blocks\.[a-zA-Z0-9_]+$/.test(k),      description: 'claude_md_assembly.blocks.<section>' },
];

/**
 * Returns true if keyPath is a valid config key (exact or dynamic pattern).
 */
function isValidConfigKey(keyPath) {
  if (VALID_CONFIG_KEYS.has(keyPath)) return true;
  return DYNAMIC_KEY_PATTERNS.some((p) => p.test(keyPath));
}

module.exports = { VALID_CONFIG_KEYS, DYNAMIC_KEY_PATTERNS, isValidConfigKey };
