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
  STATE_MUTATION_COMMANDS,
  VERIFY_COMMAND_ALIASES,
  INIT_COMMAND_ALIASES,
  PHASE_COMMAND_ALIASES,
  PHASE_MUTATION_COMMANDS,
  PHASES_COMMAND_ALIASES,
  PHASES_MUTATION_COMMANDS,
  VALIDATE_COMMAND_ALIASES,
  ROADMAP_COMMAND_ALIASES,
  ROADMAP_MUTATION_COMMANDS,
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
import {
  GSDEventType,
  type GSDEvent,
  type GSDStateMutationEvent,
  type GSDConfigMutationEvent,
  type GSDFrontmatterMutationEvent,
  type GSDGitCommitEvent,
  type GSDTemplateFillEvent,
} from '../types.js';
import type { QueryHandler, QueryResult } from './utils.js';
import { registerAliasCatalog, registerStaticCatalog } from './command-catalog.js';

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
export const QUERY_MUTATION_COMMANDS = new Set<string>([
  ...STATE_MUTATION_COMMANDS,
  'frontmatter.set', 'frontmatter.merge', 'frontmatter.validate', 'frontmatter validate',
  'config-set', 'config-set-model-profile', 'config-new-project', 'config-ensure-section',
  'commit', 'check-commit', 'commit-to-subrepo',
  'template.fill', 'template.select', 'template select',
  ...PHASE_MUTATION_COMMANDS,
  ...PHASES_MUTATION_COMMANDS,
  ...ROADMAP_MUTATION_COMMANDS,
  'requirements.mark-complete', 'requirements mark-complete',
  'todo.complete', 'todo complete',
  'milestone.complete', 'milestone complete',
  'workstream.create', 'workstream.set', 'workstream.complete', 'workstream.progress',
  'workstream create', 'workstream set', 'workstream complete', 'workstream progress',
  'docs-init',
  'learnings.copy', 'learnings copy',
  'learnings.prune', 'learnings prune',
  'learnings.delete', 'learnings delete',
  'intel.snapshot', 'intel.patch-meta', 'intel snapshot', 'intel patch-meta',
  'write-profile', 'generate-claude-profile', 'generate-dev-preferences', 'generate-claude-md',
]);

// ─── Event builder ────────────────────────────────────────────────────────

/**
 * Build a mutation event based on the command prefix and result.
 *
 * @param correlationSessionId - Optional session correlation id (from {@link createRegistry})
 */
function buildMutationEvent(
  correlationSessionId: string,
  cmd: string,
  args: string[],
  result: QueryResult,
): GSDEvent {
  const base = {
    timestamp: new Date().toISOString(),
    sessionId: correlationSessionId,
  };

  if (cmd.startsWith('template.') || cmd.startsWith('template ')) {
    const data = result.data as Record<string, unknown> | null;
    return {
      ...base,
      type: GSDEventType.TemplateFill,
      templateType: (data?.template as string) ?? args[0] ?? '',
      path: (data?.path as string) ?? args[1] ?? '',
      created: (data?.created as boolean) ?? false,
    } as GSDTemplateFillEvent;
  }

  if (cmd === 'commit' || cmd === 'check-commit' || cmd === 'commit-to-subrepo') {
    const data = result.data as Record<string, unknown> | null;
    return {
      ...base,
      type: GSDEventType.GitCommit,
      hash: (data?.hash as string) ?? null,
      committed: (data?.committed as boolean) ?? false,
      reason: (data?.reason as string) ?? '',
    } as GSDGitCommitEvent;
  }

  if (cmd.startsWith('frontmatter.') || cmd.startsWith('frontmatter ')) {
    return {
      ...base,
      type: GSDEventType.FrontmatterMutation,
      command: cmd,
      file: args[0] ?? '',
      fields: args.slice(1),
      success: true,
    } as GSDFrontmatterMutationEvent;
  }

  if (cmd.startsWith('config-')) {
    return {
      ...base,
      type: GSDEventType.ConfigMutation,
      command: cmd,
      key: args[0] ?? '',
      success: true,
    } as GSDConfigMutationEvent;
  }

  if (cmd.startsWith('validate.') || cmd.startsWith('validate ')) {
    return {
      ...base,
      type: GSDEventType.ConfigMutation,
      command: cmd,
      key: args[0] ?? '',
      success: true,
    } as GSDConfigMutationEvent;
  }

  if (cmd.startsWith('phase.') || cmd.startsWith('phase ') || cmd.startsWith('phases.') || cmd.startsWith('phases ')) {
    return {
      ...base,
      type: GSDEventType.StateMutation,
      command: cmd,
      fields: args.slice(0, 2),
      success: true,
    } as GSDStateMutationEvent;
  }

  if (cmd.startsWith('state.') || cmd.startsWith('state ')) {
    return {
      ...base,
      type: GSDEventType.StateMutation,
      command: cmd,
      fields: args.slice(0, 2),
      success: true,
    } as GSDStateMutationEvent;
  }

  // roadmap, requirements, todo, milestone, workstream, intel, profile, learnings, docs-init
  return {
    ...base,
    type: GSDEventType.StateMutation,
    command: cmd,
    fields: args.slice(0, 2),
    success: true,
  } as GSDStateMutationEvent;
}

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

  registerStaticCatalog(registry, [
    ['generate-slug', generateSlug],
    ['current-timestamp', currentTimestamp],
    ['frontmatter.get', frontmatterGet],
    ['config-get', configGet],
    ['config-path', configPath],
    ['resolve-model', resolveModel],
  ]);
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

  registerStaticCatalog(registry, [
    ['state-snapshot', stateSnapshot],
    ['find-phase', findPhase],
    ['phase-plan-index', phasePlanIndex],
    ['plan.task-structure', planTaskStructure],
    ['plan task-structure', planTaskStructure],
    ['requirements.extract-from-plans', requirementsExtractFromPlans],
    ['requirements extract-from-plans', requirementsExtractFromPlans],
  ]);
  const roadmapHandlers: Record<string, QueryHandler> = {
    'roadmap.analyze': roadmapAnalyze,
    'roadmap.get-phase': roadmapGetPhase,
    'roadmap.update-plan-progress': roadmapUpdatePlanProgress,
    'roadmap.annotate-dependencies': roadmapAnnotateDependencies,
  };

  registerAliasCatalog(registry, ROADMAP_COMMAND_ALIASES, roadmapHandlers);

  registerStaticCatalog(registry, [
    ['progress', progressJson],
    ['progress.json', progressJson],

    // Frontmatter mutation handlers
    ['frontmatter.set', frontmatterSet],
    ['frontmatter.merge', frontmatterMerge],
    ['frontmatter.validate', frontmatterValidate],
    ['frontmatter validate', frontmatterValidate],

    // Config mutation handlers
    ['config-set', configSet],
    ['config-set-model-profile', configSetModelProfile],
    ['config-new-project', configNewProject],
    ['config-ensure-section', configEnsureSection],

    // Git commit handlers
    ['commit', commit],
    ['check-commit', checkCommit],

    // Template handlers
    ['template.fill', templateFill],
    ['template.select', templateSelect],
    ['template select', templateSelect],
  ]);

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

  registerStaticCatalog(registry, [
    ['verify-summary', verifySummary],
    ['verify.summary', verifySummary],
    ['verify summary', verifySummary],
    ['verify-path-exists', verifyPathExists],
    ['verify.path-exists', verifyPathExists],
    ['verify path-exists', verifyPathExists],

    // Decision coverage gates (issue #2492)
    ['decisions.parse', decisionsParse],
    ['decisions parse', decisionsParse],
    ['check.decision-coverage-plan', checkDecisionCoveragePlan],
    ['check decision-coverage-plan', checkDecisionCoveragePlan],
    ['check.decision-coverage-verify', checkDecisionCoverageVerify],
    ['check decision-coverage-verify', checkDecisionCoverageVerify],
  ]);
  const validateHandlers: Record<string, QueryHandler> = {
    'validate.consistency': validateConsistency,
    'validate.health': validateHealth,
    'validate.agents': validateAgents,
    'validate.context': validateContext,
  };

  registerAliasCatalog(registry, VALIDATE_COMMAND_ALIASES, validateHandlers);

  // Decision routing (SDK-only — no `gsd-tools.cjs` mirror yet; see QUERY-HANDLERS.md)
  registerStaticCatalog(registry, [
    ['check.config-gates', checkConfigGates],
    ['check config-gates', checkConfigGates],
    ['check.auto-mode', checkAutoMode],
    ['check auto-mode', checkAutoMode],
    ['check.phase-ready', checkPhaseReady],
    ['check phase-ready', checkPhaseReady],
    ['route.next-action', routeNextAction],
    ['route next-action', routeNextAction],
    ['detect.phase-type', detectPhaseType],
    ['detect phase-type', detectPhaseType],
    ['check.completion', checkCompletion],
    ['check completion', checkCompletion],
    ['check.gates', checkGates],
    ['check gates', checkGates],
    ['check.verification-status', checkVerificationStatus],
    ['check verification-status', checkVerificationStatus],
    ['check.ship-ready', checkShipReady],
    ['check ship-ready', checkShipReady],
  ]);

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
  registerStaticCatalog(registry, [
    ['agent-skills', agentSkills],
    ['requirements.mark-complete', requirementsMarkComplete],
    ['requirements mark-complete', requirementsMarkComplete],
    ['todo.match-phase', todoMatchPhase],
    ['todo match-phase', todoMatchPhase],
    ['list-todos', listTodos],
    ['list.todos', listTodos],
    ['todo.complete', todoComplete],
    ['todo complete', todoComplete],
    ['milestone.complete', milestoneComplete],
    ['milestone complete', milestoneComplete],
    ['summary.extract', summaryExtract],
    ['summary extract', summaryExtract],
    ['summary-extract', summaryExtract],
    ['history.digest', historyDigest],
    ['history digest', historyDigest],
    ['history-digest', historyDigest],
    ['stats', statsJson],
    ['stats.json', statsJson],
    ['stats json', statsJson],
    ['stats.table', statsTable],
    ['stats table', statsTable],
    ['commit-to-subrepo', commitToSubrepo],
    ['progress.bar', progressBar],
    ['progress bar', progressBar],
    ['progress.table', progressTable],
    ['progress table', progressTable],
    ['workstream.get', workstreamGet],
    ['workstream get', workstreamGet],
    ['workstream.list', workstreamList],
    ['workstream list', workstreamList],
    ['workstream.create', workstreamCreate],
    ['workstream create', workstreamCreate],
    ['workstream.set', workstreamSet],
    ['workstream set', workstreamSet],
    ['workstream.status', workstreamStatus],
    ['workstream status', workstreamStatus],
    ['workstream.complete', workstreamComplete],
    ['workstream complete', workstreamComplete],
    ['workstream.progress', workstreamProgress],
    ['workstream progress', workstreamProgress],
    ['docs-init', docsInit],
    ['websearch', websearch],
    ['learnings.copy', learningsCopy],
    ['learnings copy', learningsCopy],
    ['learnings.query', learningsQuery],
    ['learnings query', learningsQuery],
    ['learnings.list', learningsListHandler],
    ['learnings list', learningsListHandler],
    ['learnings.prune', learningsPrune],
    ['learnings prune', learningsPrune],
    ['learnings.delete', learningsDelete],
    ['learnings delete', learningsDelete],
    ['skill-manifest', skillManifest],
    ['skill manifest', skillManifest],
    ['audit-open', auditOpen],
    ['audit open', auditOpen],
    ['detect-custom-files', detectCustomFiles],
    ['extract-messages', extractMessages],
    ['extract.messages', extractMessages],
    ['audit-uat', auditUat],
    ['uat.render-checkpoint', uatRenderCheckpoint],
    ['uat render-checkpoint', uatRenderCheckpoint],
    ['intel.diff', intelDiff],
    ['intel diff', intelDiff],
    ['intel.snapshot', intelSnapshot],
    ['intel snapshot', intelSnapshot],
    ['intel.validate', intelValidate],
    ['intel validate', intelValidate],
    ['intel.status', intelStatus],
    ['intel status', intelStatus],
    ['intel.query', intelQuery],
    ['intel query', intelQuery],
    ['intel.extract-exports', intelExtractExports],
    ['intel extract-exports', intelExtractExports],
    ['intel.patch-meta', intelPatchMeta],
    ['intel patch-meta', intelPatchMeta],
    ['intel.update', intelUpdate],
    ['intel update', intelUpdate],
    ['generate-claude-profile', generateClaudeProfile],
    ['generate-dev-preferences', generateDevPreferences],
    ['write-profile', writeProfile],
    ['profile-questionnaire', profileQuestionnaire],
    ['profile-sample', profileSample],
    ['scan-sessions', scanSessions],
    ['generate-claude-md', generateClaudeMd],
  ]);

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
