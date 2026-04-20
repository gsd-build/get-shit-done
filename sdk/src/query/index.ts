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
} from './state-mutation.js';
import {
  configSet, configSetModelProfile, configNewProject, configEnsureSection,
} from './config-mutation.js';
import { commit, checkCommit } from './commit.js';
import { templateFill, templateSelect } from './template.js';
import { verifyPlanStructure, verifyPhaseCompleteness, verifyArtifacts, verifyCommits, verifyReferences, verifySummary, verifyPathExists } from './verify.js';
import { verifyKeyLinks, validateConsistency, validateHealth, validateAgents } from './validate.js';
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
import { verifySchemaDrift } from './verify.js';
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
  'state.update', 'state.patch', 'state.begin-phase', 'state.advance-plan',
  'state.record-metric', 'state.update-progress', 'state.add-decision',
  'state.add-blocker', 'state.resolve-blocker', 'state.record-session',
  'state.planned-phase', 'state planned-phase',
  'state.signal-waiting', 'state signal-waiting',
  'state.signal-resume', 'state signal-resume',
  'state.sync', 'state sync',
  'state.prune', 'state prune',
  'frontmatter.set', 'frontmatter.merge', 'frontmatter.validate', 'frontmatter validate',
  'config-set', 'config-set-model-profile', 'config-new-project', 'config-ensure-section',
  'commit', 'check-commit', 'commit-to-subrepo',
  'template.fill', 'template.select', 'template select',
  'validate.health', 'validate health',
  'phase.add', 'phase.add-batch', 'phase.insert', 'phase.remove', 'phase.complete',
  'phase.scaffold', 'phases.clear', 'phases.archive',
  'phase add', 'phase add-batch', 'phase insert', 'phase remove', 'phase complete',
  'phase scaffold', 'phases clear', 'phases archive',
  'roadmap.update-plan-progress', 'roadmap update-plan-progress',
  'roadmap.annotate-dependencies', 'roadmap annotate-dependencies',
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

  registry.register('generate-slug', generateSlug);
  registry.register('current-timestamp', currentTimestamp);
  registry.register('frontmatter.get', frontmatterGet);
  registry.register('config-get', configGet);
  registry.register('config-path', configPath);
  registry.register('resolve-model', resolveModel);
  registry.register('state.load', stateProjectLoad);
  registry.register('state.json', stateJson);
  registry.register('state.get', stateGet);
  registry.register('state-snapshot', stateSnapshot);
  registry.register('find-phase', findPhase);
  registry.register('phase-plan-index', phasePlanIndex);
  registry.register('phase.list-plans', phaseListPlans);
  registry.register('phase list-plans', phaseListPlans);
  registry.register('phase.list-artifacts', phaseListArtifacts);
  registry.register('phase list-artifacts', phaseListArtifacts);
  registry.register('plan.task-structure', planTaskStructure);
  registry.register('plan task-structure', planTaskStructure);
  registry.register('requirements.extract-from-plans', requirementsExtractFromPlans);
  registry.register('requirements extract-from-plans', requirementsExtractFromPlans);
  registry.register('roadmap.analyze', roadmapAnalyze);
  registry.register('roadmap.get-phase', roadmapGetPhase);
  registry.register('progress', progressJson);
  registry.register('progress.json', progressJson);

  // Frontmatter mutation handlers
  registry.register('frontmatter.set', frontmatterSet);
  registry.register('frontmatter.merge', frontmatterMerge);
  registry.register('frontmatter.validate', frontmatterValidate);
  registry.register('frontmatter validate', frontmatterValidate);

  // State mutation handlers
  registry.register('state.update', stateUpdate);
  registry.register('state.patch', statePatch);
  registry.register('state.begin-phase', stateBeginPhase);
  registry.register('state.advance-plan', stateAdvancePlan);
  registry.register('state.record-metric', stateRecordMetric);
  registry.register('state.update-progress', stateUpdateProgress);
  registry.register('state.add-decision', stateAddDecision);
  registry.register('state.add-blocker', stateAddBlocker);
  registry.register('state.resolve-blocker', stateResolveBlocker);
  registry.register('state.record-session', stateRecordSession);
  registry.register('state.signal-waiting', stateSignalWaiting);
  registry.register('state.signal-resume', stateSignalResume);
  registry.register('state.validate', stateValidate);
  registry.register('state.sync', stateSync);
  registry.register('state.prune', statePrune);
  registry.register('state signal-waiting', stateSignalWaiting);
  registry.register('state signal-resume', stateSignalResume);
  registry.register('state validate', stateValidate);
  registry.register('state sync', stateSync);
  registry.register('state prune', statePrune);

  // Config mutation handlers
  registry.register('config-set', configSet);
  registry.register('config-set-model-profile', configSetModelProfile);
  registry.register('config-new-project', configNewProject);
  registry.register('config-ensure-section', configEnsureSection);

  // Git commit handlers
  registry.register('commit', commit);
  registry.register('check-commit', checkCommit);

  // Template handlers
  registry.register('template.fill', templateFill);
  registry.register('template.select', templateSelect);
  registry.register('template select', templateSelect);

  // Verification handlers
  registry.register('verify.plan-structure', verifyPlanStructure);
  registry.register('verify plan-structure', verifyPlanStructure);
  registry.register('verify.phase-completeness', verifyPhaseCompleteness);
  registry.register('verify phase-completeness', verifyPhaseCompleteness);
  registry.register('verify.artifacts', verifyArtifacts);
  registry.register('verify artifacts', verifyArtifacts);
  registry.register('verify.key-links', verifyKeyLinks);
  registry.register('verify key-links', verifyKeyLinks);
  registry.register('verify.commits', verifyCommits);
  registry.register('verify commits', verifyCommits);
  registry.register('verify.references', verifyReferences);
  registry.register('verify references', verifyReferences);
  registry.register('verify-summary', verifySummary);
  registry.register('verify.summary', verifySummary);
  registry.register('verify summary', verifySummary);
  registry.register('verify-path-exists', verifyPathExists);
  registry.register('verify.path-exists', verifyPathExists);
  registry.register('verify path-exists', verifyPathExists);
  registry.register('validate.consistency', validateConsistency);
  registry.register('validate consistency', validateConsistency);
  registry.register('validate.health', validateHealth);
  registry.register('validate health', validateHealth);
  registry.register('validate.agents', validateAgents);
  registry.register('validate agents', validateAgents);

  // Decision routing (SDK-only — no `gsd-tools.cjs` mirror yet; see QUERY-HANDLERS.md)
  registry.register('check.config-gates', checkConfigGates);
  registry.register('check config-gates', checkConfigGates);
  registry.register('check.auto-mode', checkAutoMode);
  registry.register('check auto-mode', checkAutoMode);
  registry.register('check.phase-ready', checkPhaseReady);
  registry.register('check phase-ready', checkPhaseReady);
  registry.register('route.next-action', routeNextAction);
  registry.register('route next-action', routeNextAction);
  registry.register('detect.phase-type', detectPhaseType);
  registry.register('detect phase-type', detectPhaseType);
  registry.register('check.completion', checkCompletion);
  registry.register('check completion', checkCompletion);
  registry.register('check.gates', checkGates);
  registry.register('check gates', checkGates);
  registry.register('check.verification-status', checkVerificationStatus);
  registry.register('check verification-status', checkVerificationStatus);
  registry.register('check.ship-ready', checkShipReady);
  registry.register('check ship-ready', checkShipReady);

  // Phase lifecycle handlers
  registry.register('phase.add', phaseAdd);
  registry.register('phase.add-batch', phaseAddBatch);
  registry.register('phase.insert', phaseInsert);
  registry.register('phase.remove', phaseRemove);
  registry.register('phase.complete', phaseComplete);
  registry.register('phase.scaffold', phaseScaffold);
  registry.register('phases.clear', phasesClear);
  registry.register('phases.archive', phasesArchive);
  registry.register('phases.list', phasesList);
  registry.register('phase.next-decimal', phaseNextDecimal);
  // Space-delimited aliases for CJS compatibility
  registry.register('phase add', phaseAdd);
  registry.register('phase add-batch', phaseAddBatch);
  registry.register('phase insert', phaseInsert);
  registry.register('phase remove', phaseRemove);
  registry.register('phase complete', phaseComplete);
  registry.register('phase scaffold', phaseScaffold);
  registry.register('phases clear', phasesClear);
  registry.register('phases archive', phasesArchive);
  registry.register('phases list', phasesList);
  registry.register('phase next-decimal', phaseNextDecimal);

  // Init composition handlers
  registry.register('init.execute-phase', initExecutePhase);
  registry.register('init.plan-phase', initPlanPhase);
  registry.register('init.new-milestone', initNewMilestone);
  registry.register('init.quick', initQuick);
  registry.register('init.resume', initResume);
  registry.register('init.verify-work', initVerifyWork);
  registry.register('init.phase-op', initPhaseOp);
  registry.register('init.todos', initTodos);
  registry.register('init.milestone-op', initMilestoneOp);
  registry.register('init.map-codebase', initMapCodebase);
  registry.register('init.new-workspace', initNewWorkspace);
  registry.register('init.list-workspaces', initListWorkspaces);
  registry.register('init.remove-workspace', initRemoveWorkspace);
  registry.register('init.ingest-docs', initIngestDocs);
  // Space-delimited aliases for CJS compatibility
  registry.register('init execute-phase', initExecutePhase);
  registry.register('init plan-phase', initPlanPhase);
  registry.register('init new-milestone', initNewMilestone);
  registry.register('init quick', initQuick);
  registry.register('init resume', initResume);
  registry.register('init verify-work', initVerifyWork);
  registry.register('init phase-op', initPhaseOp);
  registry.register('init todos', initTodos);
  registry.register('init milestone-op', initMilestoneOp);
  registry.register('init map-codebase', initMapCodebase);
  registry.register('init new-workspace', initNewWorkspace);
  registry.register('init list-workspaces', initListWorkspaces);
  registry.register('init remove-workspace', initRemoveWorkspace);
  registry.register('init ingest-docs', initIngestDocs);

  // Complex init handlers
  registry.register('init.new-project', initNewProject);
  registry.register('init.progress', initProgress);
  registry.register('init.manager', initManager);
  registry.register('init new-project', initNewProject);
  registry.register('init progress', initProgress);
  registry.register('init manager', initManager);

  // Domain-specific handlers (fully implemented)
  registry.register('agent-skills', agentSkills);
  registry.register('roadmap.update-plan-progress', roadmapUpdatePlanProgress);
  registry.register('roadmap update-plan-progress', roadmapUpdatePlanProgress);
  registry.register('roadmap.annotate-dependencies', roadmapAnnotateDependencies);
  registry.register('roadmap annotate-dependencies', roadmapAnnotateDependencies);
  registry.register('requirements.mark-complete', requirementsMarkComplete);
  registry.register('requirements mark-complete', requirementsMarkComplete);
  registry.register('state.planned-phase', statePlannedPhase);
  registry.register('state planned-phase', statePlannedPhase);
  registry.register('verify.schema-drift', verifySchemaDrift);
  registry.register('verify schema-drift', verifySchemaDrift);
  registry.register('todo.match-phase', todoMatchPhase);
  registry.register('todo match-phase', todoMatchPhase);
  registry.register('list-todos', listTodos);
  registry.register('list.todos', listTodos);
  registry.register('todo.complete', todoComplete);
  registry.register('todo complete', todoComplete);
  registry.register('milestone.complete', milestoneComplete);
  registry.register('milestone complete', milestoneComplete);
  registry.register('summary.extract', summaryExtract);
  registry.register('summary extract', summaryExtract);
  registry.register('summary-extract', summaryExtract);
  registry.register('history.digest', historyDigest);
  registry.register('history digest', historyDigest);
  registry.register('history-digest', historyDigest);
  registry.register('stats', statsJson);
  registry.register('stats.json', statsJson);
  registry.register('stats json', statsJson);
  registry.register('stats.table', statsTable);
  registry.register('stats table', statsTable);
  registry.register('commit-to-subrepo', commitToSubrepo);
  registry.register('progress.bar', progressBar);
  registry.register('progress bar', progressBar);
  registry.register('progress.table', progressTable);
  registry.register('progress table', progressTable);
  registry.register('workstream.get', workstreamGet);
  registry.register('workstream get', workstreamGet);
  registry.register('workstream.list', workstreamList);
  registry.register('workstream list', workstreamList);
  registry.register('workstream.create', workstreamCreate);
  registry.register('workstream create', workstreamCreate);
  registry.register('workstream.set', workstreamSet);
  registry.register('workstream set', workstreamSet);
  registry.register('workstream.status', workstreamStatus);
  registry.register('workstream status', workstreamStatus);
  registry.register('workstream.complete', workstreamComplete);
  registry.register('workstream complete', workstreamComplete);
  registry.register('workstream.progress', workstreamProgress);
  registry.register('workstream progress', workstreamProgress);
  registry.register('docs-init', docsInit);
  registry.register('websearch', websearch);
  registry.register('learnings.copy', learningsCopy);
  registry.register('learnings copy', learningsCopy);
  registry.register('learnings.query', learningsQuery);
  registry.register('learnings query', learningsQuery);
  registry.register('learnings.list', learningsListHandler);
  registry.register('learnings list', learningsListHandler);
  registry.register('learnings.prune', learningsPrune);
  registry.register('learnings prune', learningsPrune);
  registry.register('learnings.delete', learningsDelete);
  registry.register('learnings delete', learningsDelete);
  registry.register('skill-manifest', skillManifest);
  registry.register('skill manifest', skillManifest);
  registry.register('audit-open', auditOpen);
  registry.register('audit open', auditOpen);
  registry.register('detect-custom-files', detectCustomFiles);
  registry.register('extract-messages', extractMessages);
  registry.register('extract.messages', extractMessages);
  registry.register('audit-uat', auditUat);
  registry.register('uat.render-checkpoint', uatRenderCheckpoint);
  registry.register('uat render-checkpoint', uatRenderCheckpoint);
  registry.register('intel.diff', intelDiff);
  registry.register('intel diff', intelDiff);
  registry.register('intel.snapshot', intelSnapshot);
  registry.register('intel snapshot', intelSnapshot);
  registry.register('intel.validate', intelValidate);
  registry.register('intel validate', intelValidate);
  registry.register('intel.status', intelStatus);
  registry.register('intel status', intelStatus);
  registry.register('intel.query', intelQuery);
  registry.register('intel query', intelQuery);
  registry.register('intel.extract-exports', intelExtractExports);
  registry.register('intel extract-exports', intelExtractExports);
  registry.register('intel.patch-meta', intelPatchMeta);
  registry.register('intel patch-meta', intelPatchMeta);
  registry.register('intel.update', intelUpdate);
  registry.register('intel update', intelUpdate);
  registry.register('generate-claude-profile', generateClaudeProfile);
  registry.register('generate-dev-preferences', generateDevPreferences);
  registry.register('write-profile', writeProfile);
  registry.register('profile-questionnaire', profileQuestionnaire);
  registry.register('profile-sample', profileSample);
  registry.register('scan-sessions', scanSessions);
  registry.register('generate-claude-md', generateClaudeMd);

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
