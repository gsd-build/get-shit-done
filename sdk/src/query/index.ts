/**
 * Query module entry point — factory and re-exports.
 *
 * The `createRegistry()` factory creates a fully-wired `QueryRegistry`
 * with all native handlers registered. New handlers are added here
 * as they are migrated from gsd-tools.cjs.
 *
 * @example
 * ```typescript
 * import { createRegistry } from './query/index.js';
 *
 * const registry = createRegistry();
 * const result = await registry.dispatch('generate-slug', ['My Phase'], projectDir);
 * ```
 */

import { QueryRegistry } from './registry.js';
import { generateSlug, currentTimestamp } from './utils.js';
import { frontmatterGet } from './frontmatter.js';
import { configGet, configPath, resolveModel } from './config-query.js';
import { stateJson, stateGet, stateSnapshot } from './state.js';
import { stateProjectLoad } from './state-project-load.js';
import {
  STATE_COMMAND_ALIASES,
  VERIFY_COMMAND_ALIASES,
  INIT_COMMAND_ALIASES,
  PHASE_COMMAND_ALIASES,
  PHASES_COMMAND_ALIASES,
  VALIDATE_COMMAND_ALIASES,
  ROADMAP_COMMAND_ALIASES,
} from './command-aliases.generated.js';
import { findPhase, phasePlanIndex } from './phase.js';
import { phaseListPlans, phaseListArtifacts } from './phase-list-queries.js';
import { planTaskStructure } from './plan-task-structure.js';
import { requirementsExtractFromPlans } from './requirements-extract-from-plans.js';
import { roadmapAnalyze, roadmapGetPhase } from './roadmap.js';
import { progressJson } from './progress.js';
import { frontmatterSet, frontmatterMerge, frontmatterValidate } from './frontmatter-mutation.js';
import {
  stateUpdate, statePatch, stateBeginPhase, stateAdvancePlan,
  stateRecordMetric, stateUpdateProgress, stateAddDecision,
  stateAddBlocker, stateResolveBlocker, stateRecordSession,
  stateSignalWaiting, stateSignalResume, stateValidate, stateSync, statePrune,
  stateMilestoneSwitch, stateAddRoadmapEvolution,
} from './state-mutation.js';
import {
  configSet, configSetModelProfile, configNewProject, configEnsureSection,
} from './config-mutation.js';
import { commit, checkCommit } from './commit.js';
import { templateFill, templateSelect } from './template.js';
import { verifyPlanStructure, verifyPhaseCompleteness, verifyArtifacts, verifyCommits, verifyReferences, verifySummary, verifyPathExists } from './verify.js';
import { decisionsParse } from './decisions.js';
import { checkDecisionCoveragePlan, checkDecisionCoverageVerify } from './check-decision-coverage.js';
import { verifyKeyLinks, validateConsistency, validateHealth, validateAgents, validateContext } from './validate.js';
import {
  phaseAdd, phaseAddBatch, phaseInsert, phaseRemove, phaseComplete,
  phaseScaffold, phasesClear, phasesArchive,
  phasesList, phaseNextDecimal,
} from './phase-lifecycle.js';
import {
  initExecutePhase, initPlanPhase, initNewMilestone, initQuick,
  initResume, initVerifyWork, initPhaseOp, initTodos, initMilestoneOp,
  initMapCodebase, initNewWorkspace, initListWorkspaces, initRemoveWorkspace,
  initIngestDocs,
} from './init.js';
import { initNewProject, initProgress, initManager } from './init-complex.js';
import { agentSkills } from './skills.js';
import { requirementsMarkComplete, roadmapAnnotateDependencies } from './roadmap.js';
import { roadmapUpdatePlanProgress } from './roadmap-update-plan-progress.js';
import { statePlannedPhase } from './state-mutation.js';
import { verifySchemaDrift, verifyCodebaseDrift } from './verify.js';
import {
  todoMatchPhase, statsJson, statsTable, progressBar, progressTable, listTodos, todoComplete,
} from './progress.js';
import { milestoneComplete } from './phase-lifecycle.js';
import { summaryExtract, historyDigest } from './summary.js';
import { commitToSubrepo } from './commit.js';
import {
  workstreamGet, workstreamList, workstreamCreate, workstreamSet, workstreamStatus,
  workstreamComplete, workstreamProgress,
} from './workstream.js';
import { docsInit } from './docs-init.js';
import { uatRenderCheckpoint, auditUat } from './uat.js';
import { websearch } from './websearch.js';
import {
  intelStatus, intelDiff, intelSnapshot, intelValidate, intelQuery,
  intelExtractExports, intelPatchMeta, intelUpdate,
} from './intel.js';
import {
  learningsCopy, learningsQuery, learningsListHandler, learningsPrune, learningsDelete,
  extractMessages, scanSessions, profileSample, profileQuestionnaire,
} from './profile.js';
import {
  writeProfile, generateClaudeProfile, generateDevPreferences, generateClaudeMd,
} from './profile-output.js';
import { skillManifest } from './skill-manifest.js';
import { auditOpen } from './audit-open.js';
import { detectCustomFiles } from './detect-custom-files.js';
import { checkConfigGates } from './config-gates.js';
import { checkAutoMode } from './check-auto-mode.js';
import { checkPhaseReady } from './phase-ready.js';
import { routeNextAction } from './route-next-action.js';
import { detectPhaseType } from './detect-phase-type.js';
import { checkCompletion } from './check-completion.js';
import { checkGates } from './check-gates.js';
import { checkVerificationStatus } from './check-verification-status.js';
import { checkShipReady } from './check-ship-ready.js';
import { GSDEventStream } from '../event-stream.js';
import type { GSDEvent } from '../types.js';
import type { QueryHandler, QueryResult } from './utils.js';
import { registerAliasCatalog, registerStaticCatalog } from './command-catalog.js';
import {
  FOUNDATION_STATIC_CATALOG,
  STATE_SUPPORT_STATIC_CATALOG,
  MUTATION_SURFACES_STATIC_CATALOG,
  VERIFY_DECISION_STATIC_CATALOG,
  DECISION_ROUTING_STATIC_CATALOG,
} from './command-static-catalog-foundation.js';
import { DOMAIN_STATIC_CATALOG } from './command-static-catalog-domain.js';
import { buildMutationEvent } from './mutation-event-mapper.js';
import { QUERY_MUTATION_COMMAND_LIST } from './policy-convergence.js';

// ─── Re-exports ────────────────────────────────────────────────────────────

export type { QueryResult, QueryHandler } from './utils.js';
export { extractField } from './registry.js';
/** Same argv normalization as `gsd-sdk query` — use when calling `registry.dispatch()` with CLI-style `command` + `args`. */
export { normalizeQueryCommand } from './normalize-query-command.js';

// ─── Mutation commands set ────────────────────────────────────────────────

/**
 * Command names that perform durable writes (disk, git, or global profile store).
 * Used to wire event emission after successful dispatch. Both dotted and
 * space-delimited aliases must be listed when both exist.
 *
 * See QUERY-HANDLERS.md for semantics. Init composition handlers are omitted
 * (they emit JSON for workflows; agents perform writes).
 */
export const QUERY_MUTATION_COMMANDS = new Set<string>(QUERY_MUTATION_COMMAND_LIST);

// ─── Factory ───────────────────────────────────────────────────────────────

/**
 * Create a fully-wired QueryRegistry with all native handlers registered.
 *
 * @param eventStream - Optional event stream for mutation event emission
 * @param correlationSessionId - Optional session id threaded into mutation-related events
 * @returns A QueryRegistry instance with all handlers registered
 */
export function createRegistry(
  eventStream?: GSDEventStream,
  correlationSessionId?: string,
): QueryRegistry {
  const mutationSessionId = correlationSessionId ?? '';
  const registry = new QueryRegistry();

  registerStaticCatalog(registry, FOUNDATION_STATIC_CATALOG);
  const stateHandlers: Record<string, QueryHandler> = {
    'state.load': stateProjectLoad,
    'state.json': stateJson,
    'state.get': stateGet,
    'state.update': stateUpdate,
    'state.patch': statePatch,
    'state.begin-phase': stateBeginPhase,
    'state.advance-plan': stateAdvancePlan,
    'state.record-metric': stateRecordMetric,
    'state.update-progress': stateUpdateProgress,
    'state.add-decision': stateAddDecision,
    'state.add-blocker': stateAddBlocker,
    'state.resolve-blocker': stateResolveBlocker,
    'state.record-session': stateRecordSession,
    'state.signal-waiting': stateSignalWaiting,
    'state.signal-resume': stateSignalResume,
    'state.planned-phase': statePlannedPhase,
    'state.validate': stateValidate,
    'state.sync': stateSync,
    'state.prune': statePrune,
    'state.milestone-switch': stateMilestoneSwitch,
    'state.add-roadmap-evolution': stateAddRoadmapEvolution,
  };

  registerAliasCatalog(registry, STATE_COMMAND_ALIASES, stateHandlers);

  registerStaticCatalog(registry, STATE_SUPPORT_STATIC_CATALOG);
  const roadmapHandlers: Record<string, QueryHandler> = {
    'roadmap.analyze': roadmapAnalyze,
    'roadmap.get-phase': roadmapGetPhase,
    'roadmap.update-plan-progress': roadmapUpdatePlanProgress,
    'roadmap.annotate-dependencies': roadmapAnnotateDependencies,
  };

  registerAliasCatalog(registry, ROADMAP_COMMAND_ALIASES, roadmapHandlers);

  registerStaticCatalog(registry, MUTATION_SURFACES_STATIC_CATALOG);

  const verifyHandlers: Record<string, QueryHandler> = {
    'verify.plan-structure': verifyPlanStructure,
    'verify.phase-completeness': verifyPhaseCompleteness,
    'verify.references': verifyReferences,
    'verify.commits': verifyCommits,
    'verify.artifacts': verifyArtifacts,
    'verify.key-links': verifyKeyLinks,
    'verify.schema-drift': verifySchemaDrift,
    'verify.codebase-drift': verifyCodebaseDrift,
  };

  registerAliasCatalog(registry, VERIFY_COMMAND_ALIASES, verifyHandlers);

  registerStaticCatalog(registry, VERIFY_DECISION_STATIC_CATALOG);
  const validateHandlers: Record<string, QueryHandler> = {
    'validate.consistency': validateConsistency,
    'validate.health': validateHealth,
    'validate.agents': validateAgents,
    'validate.context': validateContext,
  };

  registerAliasCatalog(registry, VALIDATE_COMMAND_ALIASES, validateHandlers);

  // Decision routing (SDK-only — no `gsd-tools.cjs` mirror yet; see QUERY-HANDLERS.md)
  registerStaticCatalog(registry, DECISION_ROUTING_STATIC_CATALOG);

  const phaseHandlers: Record<string, QueryHandler> = {
    'phase.list-plans': phaseListPlans,
    'phase.list-artifacts': phaseListArtifacts,
    'phase.add': phaseAdd,
    'phase.add-batch': phaseAddBatch,
    'phase.insert': phaseInsert,
    'phase.remove': phaseRemove,
    'phase.complete': phaseComplete,
    'phase.scaffold': phaseScaffold,
    'phase.next-decimal': phaseNextDecimal,
  };

  registerAliasCatalog(registry, PHASE_COMMAND_ALIASES, phaseHandlers);

  const phasesHandlers: Record<string, QueryHandler> = {
    'phases.list': phasesList,
    'phases.clear': phasesClear,
    'phases.archive': phasesArchive,
  };

  registerAliasCatalog(registry, PHASES_COMMAND_ALIASES, phasesHandlers);

  const initHandlers: Record<string, QueryHandler> = {
    'init.execute-phase': initExecutePhase,
    'init.plan-phase': initPlanPhase,
    'init.new-project': initNewProject,
    'init.new-milestone': initNewMilestone,
    'init.quick': initQuick,
    'init.ingest-docs': initIngestDocs,
    'init.resume': initResume,
    'init.verify-work': initVerifyWork,
    'init.phase-op': initPhaseOp,
    'init.todos': initTodos,
    'init.milestone-op': initMilestoneOp,
    'init.map-codebase': initMapCodebase,
    'init.progress': initProgress,
    'init.manager': initManager,
    'init.new-workspace': initNewWorkspace,
    'init.list-workspaces': initListWorkspaces,
    'init.remove-workspace': initRemoveWorkspace,
  };

  registerAliasCatalog(registry, INIT_COMMAND_ALIASES, initHandlers);

  // Domain-specific handlers (fully implemented)
  registerStaticCatalog(registry, DOMAIN_STATIC_CATALOG);

  // Wire event emission for mutation commands
  if (eventStream) {
    for (const cmd of QUERY_MUTATION_COMMANDS) {
      const original = registry.getHandler(cmd);
      if (original) {
        registry.register(cmd, async (args: string[], projectDir: string) => {
          const result = await original(args, projectDir);
          try {
            const event = buildMutationEvent(mutationSessionId, cmd, args, result);
            eventStream.emitEvent(event);
          } catch {
            // T-11-12: Event emission is fire-and-forget; never block mutation success
          }
          return result;
        });
      }
    }
  }

  return registry;
}
