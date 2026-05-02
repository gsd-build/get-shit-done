/**
 * Mapping of GSD agent to model for each profile.
 *
 * Should be in sync with the profiles table in `get-shit-done/references/model-profiles.md`. But
 * possibly worth making this the single source of truth at some point, and removing the markdown
 * reference table in favor of programmatically determining the model to use for an agent (which
 * would be faster, use fewer tokens, and be less error-prone).
 */
const MODEL_PROFILES = {
  'gsd-planner': { quality: 'opus', balanced: 'opus', budget: 'sonnet', adaptive: 'opus' },
  'gsd-roadmapper': { quality: 'opus', balanced: 'sonnet', budget: 'sonnet', adaptive: 'sonnet' },
  'gsd-executor': { quality: 'opus', balanced: 'sonnet', budget: 'sonnet', adaptive: 'sonnet' },
  'gsd-phase-researcher': { quality: 'opus', balanced: 'sonnet', budget: 'haiku', adaptive: 'sonnet' },
  'gsd-project-researcher': { quality: 'opus', balanced: 'sonnet', budget: 'haiku', adaptive: 'sonnet' },
  'gsd-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', adaptive: 'haiku' },
  'gsd-debugger': { quality: 'opus', balanced: 'sonnet', budget: 'sonnet', adaptive: 'opus' },
  'gsd-codebase-mapper': { quality: 'sonnet', balanced: 'haiku', budget: 'haiku', adaptive: 'haiku' },
  'gsd-verifier': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', adaptive: 'sonnet' },
  'gsd-plan-checker': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', adaptive: 'haiku' },
  'gsd-integration-checker': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', adaptive: 'haiku' },
  'gsd-nyquist-auditor': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', adaptive: 'haiku' },
  'gsd-pattern-mapper': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', adaptive: 'haiku' },
  'gsd-ui-researcher': { quality: 'opus', balanced: 'sonnet', budget: 'haiku', adaptive: 'sonnet' },
  'gsd-ui-checker': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', adaptive: 'haiku' },
  'gsd-ui-auditor': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', adaptive: 'haiku' },
  'gsd-doc-writer': { quality: 'opus', balanced: 'sonnet', budget: 'haiku', adaptive: 'sonnet' },
  'gsd-doc-verifier': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', adaptive: 'haiku' },
};
const VALID_PROFILES = [...Object.keys(MODEL_PROFILES['gsd-planner']), 'inherit'];

/**
 * #3023 — Phase-type → agent mapping table.
 *
 * Lets users tune model selection at the *phase-type* level (planning,
 * research, execution, verification, ...) instead of per-agent. Maps
 * each agent in MODEL_PROFILES to exactly one phase-type so resolution
 * is deterministic.
 *
 * Adding a new agent to MODEL_PROFILES requires adding an entry here too;
 * tests/feat-3023-phase-type-models.test.cjs asserts coverage.
 *
 * Phase-type semantics:
 *   - planning:     produces the plan (PLAN.md, ROADMAP.md, patterns)
 *   - discuss:      collaborative scoping (no subagent today; reserved
 *                   for orchestrators that may spawn one)
 *   - research:     gathers external/codebase context (RESEARCH.md)
 *   - execution:    implements the plan or writes user-facing artifacts
 *   - verification: checks correctness (VERIFICATION.md, audits)
 *   - completion:   post-execution wrap-up (no subagent today; reserved)
 */
const AGENT_TO_PHASE_TYPE = {
  // Planning — produces the plan / roadmap / pattern map
  'gsd-planner':                'planning',
  'gsd-roadmapper':             'planning',
  'gsd-pattern-mapper':         'planning',
  // Research — external/codebase information gathering
  'gsd-phase-researcher':       'research',
  'gsd-project-researcher':     'research',
  'gsd-research-synthesizer':   'research',
  'gsd-codebase-mapper':        'research',
  'gsd-ui-researcher':          'research',
  // Execution — implementation, debugging, doc writing
  'gsd-executor':               'execution',
  'gsd-debugger':               'execution',
  'gsd-doc-writer':             'execution',
  // Verification — correctness checks, audits, gap analysis
  'gsd-verifier':               'verification',
  'gsd-plan-checker':           'verification',
  'gsd-integration-checker':    'verification',
  'gsd-nyquist-auditor':        'verification',
  'gsd-ui-checker':             'verification',
  'gsd-ui-auditor':             'verification',
  'gsd-doc-verifier':           'verification',
};

/**
 * The six phase-type slots accepted in `.planning/config.json` `models`
 * block. `discuss` and `completion` are reserved — no current agent maps
 * to them today — so users can pre-configure those slots without
 * breaking validation when an orchestrator starts honoring them.
 */
const VALID_PHASE_TYPES = new Set([
  'planning', 'discuss', 'research', 'execution', 'verification', 'completion',
]);

/**
 * #3024 — Per-agent default tier for dynamic routing.
 *
 * Each agent declares a default routing tier (light/standard/heavy)
 * that the dynamic-routing resolver uses to pick from
 * `dynamic_routing.tier_models[tier]` on the first attempt. On
 * orchestrator-detected soft failure, the resolver escalates to the
 * next tier up (capped at `max_escalations`).
 *
 * Tier semantics:
 *   - light:    cheap/fast — pure mappers/scanners, low-stakes verifiers
 *   - standard: default workhorse — most researchers/writers/checkers
 *   - heavy:    deep reasoning — planners/debuggers; can't escalate further
 *
 * Adding a new agent to MODEL_PROFILES requires adding an entry here too;
 * tests/feat-3024-dynamic-routing.test.cjs asserts coverage.
 */
const AGENT_DEFAULT_TIERS = {
  // Heavy — deep reasoning, planning, hard debugging
  'gsd-planner':                'heavy',
  'gsd-roadmapper':             'heavy',
  'gsd-debugger':               'heavy',
  // Standard — default workhorse: research, writing, primary verification
  'gsd-executor':               'standard',
  'gsd-phase-researcher':       'standard',
  'gsd-project-researcher':     'standard',
  'gsd-verifier':               'standard',
  'gsd-doc-writer':             'standard',
  'gsd-ui-researcher':          'standard',
  // Light — fast scanners, structural mappers, low-stakes audits
  'gsd-codebase-mapper':        'light',
  'gsd-pattern-mapper':         'light',
  'gsd-research-synthesizer':   'light',
  'gsd-plan-checker':           'light',
  'gsd-integration-checker':    'light',
  'gsd-nyquist-auditor':        'light',
  'gsd-ui-checker':             'light',
  'gsd-ui-auditor':             'light',
  'gsd-doc-verifier':           'light',
};

/**
 * The three valid agent tier slots for dynamic routing. Used to
 * validate `dynamic_routing.tier_models.<tier>` keys at config-set
 * time and the AGENT_DEFAULT_TIERS values at startup.
 */
const VALID_AGENT_TIERS = new Set(['light', 'standard', 'heavy']);

/**
 * Tier escalation order: light → standard → heavy.
 * `nextTier(currentTier)` returns the tier one step up. `heavy` stays
 * at heavy (no tier above). Returns null for invalid input so callers
 * can detect mis-config rather than silently degrade.
 */
const _TIER_ESCALATION = { light: 'standard', standard: 'heavy', heavy: 'heavy' };
function nextTier(currentTier) {
  if (typeof currentTier !== 'string') return null;
  return _TIER_ESCALATION[currentTier] || null;
}

/**
 * Formats the agent-to-model mapping as a human-readable table (in string format).
 *
 * @param {Object<string, string>} agentToModelMap - A mapping from agent to model
 * @returns {string} A formatted table string
 */
function formatAgentToModelMapAsTable(agentToModelMap) {
  const agentWidth = Math.max('Agent'.length, ...Object.keys(agentToModelMap).map((a) => a.length));
  const modelWidth = Math.max(
    'Model'.length,
    ...Object.values(agentToModelMap).map((m) => m.length)
  );
  const sep = '─'.repeat(agentWidth + 2) + '┼' + '─'.repeat(modelWidth + 2);
  const header = ' ' + 'Agent'.padEnd(agentWidth) + ' │ ' + 'Model'.padEnd(modelWidth);
  let agentToModelTable = header + '\n' + sep + '\n';
  for (const [agent, model] of Object.entries(agentToModelMap)) {
    agentToModelTable += ' ' + agent.padEnd(agentWidth) + ' │ ' + model.padEnd(modelWidth) + '\n';
  }
  return agentToModelTable;
}

/**
 * Returns a mapping from agent to model for the given model profile.
 *
 * @param {string} normalizedProfile - The normalized (lowercase and trimmed) profile name
 * @returns {Object<string, string>} A mapping from agent to model for the given profile
 */
function getAgentToModelMapForProfile(normalizedProfile) {
  const agentToModelMap = {};
  for (const [agent, profileToModelMap] of Object.entries(MODEL_PROFILES)) {
    agentToModelMap[agent] = normalizedProfile === 'inherit'
      ? 'inherit'
      : profileToModelMap[normalizedProfile];
  }
  return agentToModelMap;
}

module.exports = {
  MODEL_PROFILES,
  VALID_PROFILES,
  AGENT_TO_PHASE_TYPE,
  VALID_PHASE_TYPES,
  AGENT_DEFAULT_TIERS,
  VALID_AGENT_TIERS,
  nextTier,
  formatAgentToModelMapAsTable,
  getAgentToModelMapForProfile,
};
