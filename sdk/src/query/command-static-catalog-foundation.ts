import type { QueryHandler } from './utils.js';
import { generateSlug, currentTimestamp } from './utils.js';
import { frontmatterGet } from './frontmatter.js';
import { configGet, configPath, resolveModel } from './config-query.js';
import { stateSnapshot } from './state.js';
import { findPhase, phasePlanIndex } from './phase.js';
import { planTaskStructure } from './plan-task-structure.js';
import { requirementsExtractFromPlans } from './requirements-extract-from-plans.js';
import { progressJson } from './progress.js';
import { frontmatterSet, frontmatterMerge, frontmatterValidate } from './frontmatter-mutation.js';
import { configSet, configSetModelProfile, configNewProject, configEnsureSection } from './config-mutation.js';
import { commit, checkCommit } from './commit.js';
import { templateFill, templateSelect } from './template.js';
import { verifySummary, verifyPathExists } from './verify.js';
import { decisionsParse } from './decisions.js';
import { checkDecisionCoveragePlan, checkDecisionCoverageVerify } from './check-decision-coverage.js';
import { commandsList } from './commands-list.js';
import { checkConfigGates } from './config-gates.js';
import { checkAutoMode } from './check-auto-mode.js';
import { checkPhaseReady } from './phase-ready.js';
import { routeNextAction } from './route-next-action.js';
import { detectPhaseType } from './detect-phase-type.js';
import { checkCompletion } from './check-completion.js';
import { checkGates } from './check-gates.js';
import { checkVerificationStatus } from './check-verification-status.js';
import { checkShipReady } from './check-ship-ready.js';

export const FOUNDATION_STATIC_CATALOG: ReadonlyArray<readonly [string, QueryHandler]> = [
  ['generate-slug', generateSlug],
  ['current-timestamp', currentTimestamp],
  ['frontmatter.get', frontmatterGet],
  ['config-get', configGet],
  ['config-path', configPath],
  ['resolve-model', resolveModel],
] as const;

export const STATE_SUPPORT_STATIC_CATALOG: ReadonlyArray<readonly [string, QueryHandler]> = [
  ['state-snapshot', stateSnapshot],
  ['find-phase', findPhase],
  ['phase-plan-index', phasePlanIndex],
  ['plan.task-structure', planTaskStructure],
  ['plan task-structure', planTaskStructure],
  ['requirements.extract-from-plans', requirementsExtractFromPlans],
  ['requirements extract-from-plans', requirementsExtractFromPlans],
] as const;

export const MUTATION_SURFACES_STATIC_CATALOG: ReadonlyArray<readonly [string, QueryHandler]> = [
  ['progress', progressJson],
  ['progress.json', progressJson],
  ['frontmatter.set', frontmatterSet],
  ['frontmatter.merge', frontmatterMerge],
  ['frontmatter.validate', frontmatterValidate],
  ['frontmatter validate', frontmatterValidate],
  ['config-set', configSet],
  ['config-set-model-profile', configSetModelProfile],
  ['config-new-project', configNewProject],
  ['config-ensure-section', configEnsureSection],
  ['commit', commit],
  ['check-commit', checkCommit],
  ['template.fill', templateFill],
  ['template.select', templateSelect],
  ['template select', templateSelect],
] as const;

export const VERIFY_DECISION_STATIC_CATALOG: ReadonlyArray<readonly [string, QueryHandler]> = [
  ['verify-summary', verifySummary],
  ['verify.summary', verifySummary],
  ['verify summary', verifySummary],
  ['verify-path-exists', verifyPathExists],
  ['verify.path-exists', verifyPathExists],
  ['verify path-exists', verifyPathExists],
  ['decisions.parse', decisionsParse],
  ['decisions parse', decisionsParse],
  ['check.decision-coverage-plan', checkDecisionCoveragePlan],
  ['check decision-coverage-plan', checkDecisionCoveragePlan],
  ['check.decision-coverage-verify', checkDecisionCoverageVerify],
  ['check decision-coverage-verify', checkDecisionCoverageVerify],
] as const;

export const DECISION_ROUTING_STATIC_CATALOG: ReadonlyArray<readonly [string, QueryHandler]> = [
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
  ['commands', commandsList],
] as const;
