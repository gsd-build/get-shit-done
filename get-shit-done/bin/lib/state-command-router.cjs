'use strict';

const { STATE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');

/**
 * Manifest-backed state subcommand router.
 * Keeps gsd-tools.cjs thin while preserving existing command semantics.
 */
function routeStateCommand({ state, args, cwd, raw, parseNamedArgs, error }) {
  const parsePlans = (plans) => {
    const parsedPlans = plans == null ? null : Number.parseInt(plans, 10);
    if (plans != null && Number.isNaN(parsedPlans)) {
      error('Invalid --plans value. Expected an integer.');
      return null;
    }
    return parsedPlans;
  };

  routeCjsCommandFamily({
    args,
    subcommands: ['load', 'complete-phase', ...STATE_SUBCOMMANDS.filter((s) => s !== 'load')],
    defaultSubcommand: 'load',
    unsupported: {
      'add-roadmap-evolution': 'state add-roadmap-evolution is SDK-only. Use: gsd-sdk query state.add-roadmap-evolution ...',
    },
    error,
    unknownMessage: (subcommand, available) => `Unknown state subcommand: "${subcommand}". Available: ${available.join(', ')}`,
    handlers: {
      load: () => state.cmdStateLoad(cwd, raw),
      json: () => state.cmdStateJson(cwd, raw),
      update: () => state.cmdStateUpdate(cwd, args[2], args[3]),
      get: () => state.cmdStateGet(cwd, args[2], raw),
      patch: () => {
        const patches = {};
        for (let i = 2; i < args.length; i += 2) {
          const key = args[i].replace(/^--/, '');
          const value = args[i + 1];
          if (key && value !== undefined) {
            patches[key] = value;
          }
        }
        state.cmdStatePatch(cwd, patches, raw);
      },
      'advance-plan': () => state.cmdStateAdvancePlan(cwd, raw),
      'record-metric': () => {
        const { phase: p, plan, duration, tasks, files } = parseNamedArgs(args, ['phase', 'plan', 'duration', 'tasks', 'files']);
        state.cmdStateRecordMetric(cwd, { phase: p, plan, duration, tasks, files }, raw);
      },
      'update-progress': () => state.cmdStateUpdateProgress(cwd, raw),
      'add-decision': () => {
        const { phase: p, summary, 'summary-file': summary_file, rationale, 'rationale-file': rationale_file } = parseNamedArgs(args, ['phase', 'summary', 'summary-file', 'rationale', 'rationale-file']);
        state.cmdStateAddDecision(cwd, { phase: p, summary, summary_file, rationale: rationale || '', rationale_file }, raw);
      },
      'add-blocker': () => {
        const { text, 'text-file': text_file } = parseNamedArgs(args, ['text', 'text-file']);
        state.cmdStateAddBlocker(cwd, { text, text_file }, raw);
      },
      'resolve-blocker': () => state.cmdStateResolveBlocker(cwd, parseNamedArgs(args, ['text']).text, raw),
      'record-session': () => {
        const { 'stopped-at': stopped_at, 'resume-file': resume_file } = parseNamedArgs(args, ['stopped-at', 'resume-file']);
        state.cmdStateRecordSession(cwd, { stopped_at, resume_file: resume_file || 'None' }, raw);
      },
      'begin-phase': () => {
        const { phase: p, name, plans } = parseNamedArgs(args, ['phase', 'name', 'plans']);
        state.cmdStateBeginPhase(cwd, p, name, parsePlans(plans), raw);
      },
      'signal-waiting': () => {
        const { type, question, options, phase: p } = parseNamedArgs(args, ['type', 'question', 'options', 'phase']);
        state.cmdSignalWaiting(cwd, type, question, options, p, raw);
      },
      'signal-resume': () => state.cmdSignalResume(cwd, raw),
      'planned-phase': () => {
        const { phase: p, plans } = parseNamedArgs(args, ['phase', 'name', 'plans']);
        state.cmdStatePlannedPhase(cwd, p, parsePlans(plans), raw);
      },
      validate: () => state.cmdStateValidate(cwd, raw),
      sync: () => {
        const { verify } = parseNamedArgs(args, [], ['verify']);
        state.cmdStateSync(cwd, { verify }, raw);
      },
      prune: () => {
        const { 'keep-recent': keepRecent, 'dry-run': dryRun } = parseNamedArgs(args, ['keep-recent'], ['dry-run']);
        state.cmdStatePrune(cwd, { keepRecent: keepRecent || '3', dryRun: !!dryRun }, raw);
      },
      'complete-phase': () => {
        const { phase: p } = parseNamedArgs(args, ['phase']);
        state.cmdStateCompletePhase(cwd, raw, p || args[2]);
      },
      'milestone-switch': () => {
        const { milestone, name } = parseNamedArgs(args, ['milestone', 'name']);
        state.cmdStateMilestoneSwitch(cwd, milestone, name, raw);
      },
    },
  });
}

module.exports = {
  routeStateCommand,
};
