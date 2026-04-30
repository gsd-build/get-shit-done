'use strict';

const { STATE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');

/**
 * Manifest-backed state subcommand router.
 * Keeps gsd-tools.cjs thin while preserving existing command semantics.
 */
function routeStateCommand({ state, args, cwd, raw, parseNamedArgs, error }) {
  const subcommand = args[1];

  if (subcommand === 'json') {
    state.cmdStateJson(cwd, raw);
  } else if (subcommand === 'update') {
    state.cmdStateUpdate(cwd, args[2], args[3]);
  } else if (subcommand === 'get') {
    state.cmdStateGet(cwd, args[2], raw);
  } else if (subcommand === 'patch') {
    const patches = {};
    for (let i = 2; i < args.length; i += 2) {
      const key = args[i].replace(/^--/, '');
      const value = args[i + 1];
      if (key && value !== undefined) {
        patches[key] = value;
      }
    }
    state.cmdStatePatch(cwd, patches, raw);
  } else if (subcommand === 'advance-plan') {
    state.cmdStateAdvancePlan(cwd, raw);
  } else if (subcommand === 'record-metric') {
    const { phase: p, plan, duration, tasks, files } = parseNamedArgs(args, ['phase', 'plan', 'duration', 'tasks', 'files']);
    state.cmdStateRecordMetric(cwd, { phase: p, plan, duration, tasks, files }, raw);
  } else if (subcommand === 'update-progress') {
    state.cmdStateUpdateProgress(cwd, raw);
  } else if (subcommand === 'add-decision') {
    const { phase: p, summary, 'summary-file': summary_file, rationale, 'rationale-file': rationale_file } = parseNamedArgs(args, ['phase', 'summary', 'summary-file', 'rationale', 'rationale-file']);
    state.cmdStateAddDecision(cwd, { phase: p, summary, summary_file, rationale: rationale || '', rationale_file }, raw);
  } else if (subcommand === 'add-blocker') {
    const { text, 'text-file': text_file } = parseNamedArgs(args, ['text', 'text-file']);
    state.cmdStateAddBlocker(cwd, { text, text_file }, raw);
  } else if (subcommand === 'resolve-blocker') {
    state.cmdStateResolveBlocker(cwd, parseNamedArgs(args, ['text']).text, raw);
  } else if (subcommand === 'record-session') {
    const { 'stopped-at': stopped_at, 'resume-file': resume_file } = parseNamedArgs(args, ['stopped-at', 'resume-file']);
    state.cmdStateRecordSession(cwd, { stopped_at, resume_file: resume_file || 'None' }, raw);
  } else if (subcommand === 'begin-phase') {
    const { phase: p, name, plans } = parseNamedArgs(args, ['phase', 'name', 'plans']);
    const parsedPlans = plans == null ? null : Number.parseInt(plans, 10);
    if (plans != null && Number.isNaN(parsedPlans)) {
      return error('Invalid --plans value. Expected an integer.');
    }
    state.cmdStateBeginPhase(cwd, p, name, parsedPlans, raw);
  } else if (subcommand === 'signal-waiting') {
    const { type, question, options, phase: p } = parseNamedArgs(args, ['type', 'question', 'options', 'phase']);
    state.cmdSignalWaiting(cwd, type, question, options, p, raw);
  } else if (subcommand === 'signal-resume') {
    state.cmdSignalResume(cwd, raw);
  } else if (subcommand === 'planned-phase') {
    const { phase: p, plans } = parseNamedArgs(args, ['phase', 'name', 'plans']);
    const parsedPlans = plans == null ? null : Number.parseInt(plans, 10);
    if (plans != null && Number.isNaN(parsedPlans)) {
      return error('Invalid --plans value. Expected an integer.');
    }
    state.cmdStatePlannedPhase(cwd, p, parsedPlans, raw);
  } else if (subcommand === 'validate') {
    state.cmdStateValidate(cwd, raw);
  } else if (subcommand === 'sync') {
    const { verify } = parseNamedArgs(args, [], ['verify']);
    state.cmdStateSync(cwd, { verify }, raw);
  } else if (subcommand === 'prune') {
    const { 'keep-recent': keepRecent, 'dry-run': dryRun } = parseNamedArgs(args, ['keep-recent'], ['dry-run']);
    state.cmdStatePrune(cwd, { keepRecent: keepRecent || '3', dryRun: !!dryRun }, raw);
  } else if (subcommand === 'complete-phase') {
    state.cmdStateCompletePhase(cwd, raw);
  } else if (subcommand === 'milestone-switch') {
    const { milestone, name } = parseNamedArgs(args, ['milestone', 'name']);
    state.cmdStateMilestoneSwitch(cwd, milestone, name, raw);
  } else if (subcommand === 'add-roadmap-evolution') {
    error('state add-roadmap-evolution is SDK-only. Use: gsd-sdk query state.add-roadmap-evolution ...');
  } else if (subcommand === undefined || subcommand === 'load') {
    state.cmdStateLoad(cwd, raw);
  } else {
    const available = ['load', 'complete-phase', ...STATE_SUBCOMMANDS.filter((s) => s !== 'load')];
    error(`Unknown state subcommand: "${subcommand}". Available: ${available.join(', ')}`);
  }
}

module.exports = {
  routeStateCommand,
};
