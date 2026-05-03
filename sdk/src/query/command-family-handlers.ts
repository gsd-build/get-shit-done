import type { QueryHandler } from './utils.js';

import { stateProjectLoad } from './state-project-load.js';
import { stateJson, stateGet } from './state.js';
import {
  stateUpdate, statePatch, stateBeginPhase, stateAdvancePlan,
  stateRecordMetric, stateUpdateProgress, stateAddDecision,
  stateAddBlocker, stateResolveBlocker, stateRecordSession,
  stateSignalWaiting, stateSignalResume, statePlannedPhase,
  stateValidate, stateSync, statePrune, stateMilestoneSwitch,
  stateAddRoadmapEvolution,
} from './state-mutation.js';
import { roadmapAnalyze, roadmapGetPhase, roadmapAnnotateDependencies } from './roadmap.js';
import { roadmapUpdatePlanProgress } from './roadmap-update-plan-progress.js';
import {
  verifyPlanStructure, verifyPhaseCompleteness, verifyReferences,
  verifyCommits, verifyArtifacts, verifySchemaDrift,
  verifyCodebaseDrift,
} from './verify.js';
import { verifyKeyLinks, validateConsistency, validateHealth, validateAgents, validateContext } from './validate.js';
import {
  phaseListPlans, phaseListArtifacts,
} from './phase-list-queries.js';
import {
  phaseAdd, phaseAddBatch, phaseInsert, phaseRemove, phaseComplete,
  phaseScaffold, phaseNextDecimal, phasesList, phasesClear, phasesArchive,
} from './phase-lifecycle.js';
import {
  initExecutePhase, initPlanPhase, initNewMilestone, initQuick,
  initIngestDocs, initResume, initVerifyWork, initPhaseOp, initTodos,
  initMilestoneOp, initMapCodebase, initNewWorkspace,
  initListWorkspaces, initRemoveWorkspace,
} from './init.js';
import { initNewProject, initProgress, initManager } from './init-complex.js';

export const FAMILY_HANDLERS: Record<string, Readonly<Record<string, QueryHandler>>> = {
  state: {
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
  },
  roadmap: {
    'roadmap.analyze': roadmapAnalyze,
    'roadmap.get-phase': roadmapGetPhase,
    'roadmap.update-plan-progress': roadmapUpdatePlanProgress,
    'roadmap.annotate-dependencies': roadmapAnnotateDependencies,
  },
  verify: {
    'verify.plan-structure': verifyPlanStructure,
    'verify.phase-completeness': verifyPhaseCompleteness,
    'verify.references': verifyReferences,
    'verify.commits': verifyCommits,
    'verify.artifacts': verifyArtifacts,
    'verify.key-links': verifyKeyLinks,
    'verify.schema-drift': verifySchemaDrift,
    'verify.codebase-drift': verifyCodebaseDrift,
  },
  validate: {
    'validate.consistency': validateConsistency,
    'validate.health': validateHealth,
    'validate.agents': validateAgents,
    'validate.context': validateContext,
  },
  phase: {
    'phase.list-plans': phaseListPlans,
    'phase.list-artifacts': phaseListArtifacts,
    'phase.add': phaseAdd,
    'phase.add-batch': phaseAddBatch,
    'phase.insert': phaseInsert,
    'phase.remove': phaseRemove,
    'phase.complete': phaseComplete,
    'phase.scaffold': phaseScaffold,
    'phase.next-decimal': phaseNextDecimal,
  },
  phases: {
    'phases.list': phasesList,
    'phases.clear': phasesClear,
    'phases.archive': phasesArchive,
  },
  init: {
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
  },
};
