/**
 * SDK-side mirror of get-shit-done/bin/lib/config-schema.cjs.
 *
 * Single source of truth for valid config key paths accepted by
 * `config-set`. MUST stay in sync with the CJS schema — enforced
 * by tests/config-schema-sdk-parity.test.cjs (CI drift guard).
 *
 * If you add/remove a key here, make the identical change in
 * get-shit-done/bin/lib/config-schema.cjs (and vice versa). The
 * parity test asserts the two allowlists are set-equal and that
 * DYNAMIC_KEY_PATTERN_SOURCES produce identical regex source strings.
 *
 * See #2653 — CJS/SDK drift caused config-set to reject documented
 * keys. #2479 added CJS↔docs parity; #2653 adds CJS↔SDK parity.
 */

/** Exact-match config key paths accepted by config-set. */
export const VALID_CONFIG_KEYS: ReadonlySet<string> = new Set([
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
]);

/**
 * Dynamic-pattern validators — keys matching these regexes are also accepted.
 * Each entry's `source` MUST equal the corresponding CJS regex `.source`
 * (the parity test enforces this).
 */
export interface DynamicKeyPattern {
  readonly test: (k: string) => boolean;
  readonly description: string;
  readonly source: string;
}

export const DYNAMIC_KEY_PATTERNS: readonly DynamicKeyPattern[] = [
  {
    source: '^agent_skills\\.[a-zA-Z0-9_-]+$',
    description: 'agent_skills.<agent-type>',
    test: (k) => /^agent_skills\.[a-zA-Z0-9_-]+$/.test(k),
  },
  {
    source: '^review\\.models\\.[a-zA-Z0-9_-]+$',
    description: 'review.models.<cli-name>',
    test: (k) => /^review\.models\.[a-zA-Z0-9_-]+$/.test(k),
  },
  {
    source: '^features\\.[a-zA-Z0-9_]+$',
    description: 'features.<feature_name>',
    test: (k) => /^features\.[a-zA-Z0-9_]+$/.test(k),
  },
  {
    source: '^claude_md_assembly\\.blocks\\.[a-zA-Z0-9_]+$',
    description: 'claude_md_assembly.blocks.<section>',
    test: (k) => /^claude_md_assembly\.blocks\.[a-zA-Z0-9_]+$/.test(k),
  },
  // #2517 — runtime-aware model profile overrides: model_profile_overrides.<runtime>.<tier>
  {
    source: '^model_profile_overrides\\.[a-zA-Z0-9_-]+\\.(opus|sonnet|haiku)$',
    description: 'model_profile_overrides.<runtime>.<opus|sonnet|haiku>',
    test: (k) => /^model_profile_overrides\.[a-zA-Z0-9_-]+\.(opus|sonnet|haiku)$/.test(k),
  },
  // #3023 — per-phase-type model map: models.<phase_type> = <tier>
  {
    source: '^models\\.(planning|discuss|research|execution|verification|completion)$',
    description: 'models.<planning|discuss|research|execution|verification|completion>',
    test: (k) => /^models\.(planning|discuss|research|execution|verification|completion)$/.test(k),
  },
];

/** Returns true if keyPath is a valid config key (exact or dynamic pattern). */
export function isValidConfigKeyPath(keyPath: string): boolean {
  if (VALID_CONFIG_KEYS.has(keyPath)) return true;
  return DYNAMIC_KEY_PATTERNS.some((p) => p.test(keyPath));
}
