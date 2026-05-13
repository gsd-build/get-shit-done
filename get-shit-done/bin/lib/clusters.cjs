'use strict';
/**
 * Skill cluster definitions for the runtime surface module (ADR-0011 Phase 2).
 *
 * Each cluster is a named group of skill stems. Clusters are used by /gsd:surface
 * to enable/disable a cohesive group of skills without reinstall.
 *
 * Cluster membership may overlap (a skill can live in two clusters). The union
 * of all clusters should cover every installed skill stem; uncategorized stems
 * are flagged by surface-clusters.test.cjs.
 *
 * Source: docs/research/2026-05-12-skill-surface-budget.md §3.2 (verified
 * against commands/gsd/ listing in surface-clusters.test.cjs).
 */

const CLUSTERS = Object.freeze({
  core_loop: Object.freeze([
    'new-project',
    'discuss-phase',
    'plan-phase',
    'execute-phase',
    'help',
    'update',
  ]),

  audit_review: Object.freeze([
    'code-review',
    'review',
    'audit-fix',
    'audit-milestone',
    'audit-uat',
    'verify-work',
    'validate-phase',
    'plan-review-convergence',
    'eval-review',
    'add-tests',
    'secure-phase',
  ]),

  milestone: Object.freeze([
    'new-milestone',
    'complete-milestone',
    'milestone-summary',
    'health',
  ]),

  research_ideate: Object.freeze([
    'sketch',
    'spike',
    'forensics',
    'explore',
    'graphify',
    'ns-ideate',
  ]),

  workspace_state: Object.freeze([
    'pause-work',
    'resume-work',
    'workspace',
    'workstreams',
    'thread',
    'capture',
    'inbox',
  ]),

  docs: Object.freeze([
    'docs-update',
    'ingest-docs',
  ]),

  ui: Object.freeze([
    'ui-phase',
    'ui-review',
  ]),

  ai_eval: Object.freeze([
    'ai-integration-phase',
    'eval-review',
  ]),

  ns_meta: Object.freeze([
    'ns-context',
    'ns-ideate',
    'ns-manage',
    'ns-project',
    'ns-review',
    'ns-workflow',
  ]),

  utility: Object.freeze([
    'health',
    'stats',
    'settings',
    'cleanup',
    'pr-branch',
    'ship',
    'undo',
    'fast',
    'quick',
    'autonomous',
    'config',
    'progress',
    'phase',
    'review',
    'update',
    'help',
    'code-review',
    'import',
    'manager',
    'map-codebase',
    'profile-user',
    'spec-phase',
    'ultraplan-phase',
    'mvp-phase',
    'execute-phase',
    'review-backlog',
    'debug',
    'extract-learnings',
    'surface',
  ]),
});

/**
 * Build a Set of all skill stems covered by at least one cluster.
 * @returns {Set<string>}
 */
function allClusteredSkills() {
  const result = new Set();
  for (const skills of Object.values(CLUSTERS)) {
    for (const s of skills) result.add(s);
  }
  return result;
}

module.exports = { CLUSTERS, allClusteredSkills };
