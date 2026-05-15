'use strict';

const { STATE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');
const { output } = require('./core.cjs');

// ─── SDK bridge (Phase 5.1) ─────────────────────────────────────────────────
// executeForCjs is loaded lazily from the SDK public package export so this
// router does not rely on private dist subpaths that are not exported.
let _executeForCjs = null;
let _formatStateLoadRawStdout = null;

function tryLoadSdk() {
  if (_executeForCjs !== null) return true;
  try {
    const sdkModule = require('@gsd-build/sdk');
    _executeForCjs = sdkModule.executeForCjs;
    _formatStateLoadRawStdout = sdkModule.formatStateLoadRawStdout;
    if (typeof _executeForCjs !== 'function' || typeof _formatStateLoadRawStdout !== 'function') {
      _executeForCjs = null;
      _formatStateLoadRawStdout = null;
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Dispatch a subcommand via the SDK sync bridge.
 *
 * Returns true if dispatched successfully, false if the SDK is unavailable.
 * The caller must still handle result.ok=false as a hard error.
 *
 * @param {string} registryCommand - Registry command name (e.g. 'state.json')
 * @param {string[]} registryArgs - Args for the registry handler
 * @param {string} cwd - Project directory
 * @param {boolean} raw - Raw output mode
 * @param {Function} error - Error reporter
 * @param {Function} [rawFormatter] - Optional raw output formatter (for state.load)
 * @returns {boolean} true if handled, false to fall through to CJS
 */
function dispatchViaSdk(registryCommand, registryArgs, legacyArgs, cwd, raw, error, rawFormatter) {
  if (!tryLoadSdk()) return false;

  const result = _executeForCjs({
    registryCommand,
    registryArgs,
    legacyCommand: 'state',
    legacyArgs,
    mode: raw ? 'raw' : 'json',
    projectDir: cwd,
    // Phase 6 fix: workstream is now threaded through to the native handler.
    // GSDTransport no longer forces subprocess for workstream-scoped requests —
    // the worker's dispatchNative closure correctly passes workstream to
    // registry.dispatch() (Phase 5.1 fix), enabling native workstream dispatch.
    workstream: process.env.GSD_WORKSTREAM || undefined,
  });

  if (!result.ok) {
    error(result.errorDetails && result.errorDetails.message
      ? result.errorDetails.message
      : `state ${registryCommand} failed (${result.errorKind})`);
    return true; // handled (error was reported)
  }

  if (raw && rawFormatter) {
    const rawText = rawFormatter(result.data);
    const fs = require('fs');
    fs.writeSync(1, rawText);
  } else {
    output(result.data);
  }
  return true;
}

/**
 * Manifest-backed state subcommand router.
 * Keeps gsd-tools.cjs thin while preserving existing command semantics.
 *
 * Phase 5.1: handlers that have SDK equivalents are dispatched via
 * executeForCjs (the sync bridge). CJS fallback is retained for:
 * - complete-phase: no SDK counterpart.
 * - Any command when GSD_WORKSTREAM is active (GSDTransport forces subprocess
 *   for workstream requests; subprocess is disabled in the sync bridge worker).
 * - Any command when the SDK is not available (build not present).
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

  // Phase 6 fix: workstream commands are now handled natively in the sync bridge
  // worker. GSDTransport no longer forces subprocess for workstream-scoped requests;
  // the worker threads workstream through to registry.dispatch() correctly.
  const sdkAvailable = tryLoadSdk();

  // Helper: build SDK-backed handler that falls through to CJS on SDK failure.
  // cjsFallback is called when SDK is unavailable or when the subcommand has no
  // SDK counterpart.
  function sdkHandler(registryCommand, registryArgs, legacyArgs, rawFormatter, cjsFallback) {
    if (!sdkAvailable) return cjsFallback;
    return () => {
      const handled = dispatchViaSdk(
        registryCommand, registryArgs, legacyArgs, cwd, raw, error, rawFormatter,
      );
      if (!handled) cjsFallback();
    };
  }

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
      load: sdkHandler(
        'state.load',
        [],
        args.slice(1),
        _formatStateLoadRawStdout,
        () => state.cmdStateLoad(cwd, raw),
      ),
      json: sdkHandler(
        'state.json',
        [],
        args.slice(1),
        null,
        () => state.cmdStateJson(cwd, raw),
      ),
      get: sdkHandler(
        'state.get',
        args.slice(2),
        args.slice(1),
        null,
        () => state.cmdStateGet(cwd, args[2], raw),
      ),
      update: sdkHandler(
        'state.update',
        args.slice(2),
        args.slice(1),
        null,
        () => state.cmdStateUpdate(cwd, args[2], args[3]),
      ),
      patch: sdkHandler(
        'state.patch',
        args.slice(2),
        args.slice(1),
        null,
        () => {
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
      ),
      'advance-plan': sdkHandler(
        'state.advance-plan',
        [],
        args.slice(1),
        null,
        () => state.cmdStateAdvancePlan(cwd, raw),
      ),
      'record-metric': sdkHandler(
        'state.record-metric',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { phase: p, plan, duration, tasks, files } = parseNamedArgs(args, ['phase', 'plan', 'duration', 'tasks', 'files']);
          state.cmdStateRecordMetric(cwd, { phase: p, plan, duration, tasks, files }, raw);
        },
      ),
      'update-progress': sdkHandler(
        'state.update-progress',
        [],
        args.slice(1),
        null,
        () => state.cmdStateUpdateProgress(cwd, raw),
      ),
      'add-decision': sdkHandler(
        'state.add-decision',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { phase: p, summary, 'summary-file': summary_file, rationale, 'rationale-file': rationale_file } = parseNamedArgs(args, ['phase', 'summary', 'summary-file', 'rationale', 'rationale-file']);
          state.cmdStateAddDecision(cwd, { phase: p, summary, summary_file, rationale: rationale || '', rationale_file }, raw);
        },
      ),
      'add-blocker': sdkHandler(
        'state.add-blocker',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { text, 'text-file': text_file } = parseNamedArgs(args, ['text', 'text-file']);
          state.cmdStateAddBlocker(cwd, { text, text_file }, raw);
        },
      ),
      'resolve-blocker': sdkHandler(
        'state.resolve-blocker',
        args.slice(2),
        args.slice(1),
        null,
        () => state.cmdStateResolveBlocker(cwd, parseNamedArgs(args, ['text']).text, raw),
      ),
      'record-session': sdkHandler(
        'state.record-session',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { 'stopped-at': stopped_at, 'resume-file': resume_file } = parseNamedArgs(args, ['stopped-at', 'resume-file']);
          state.cmdStateRecordSession(cwd, { stopped_at, resume_file: resume_file || 'None' }, raw);
        },
      ),
      'begin-phase': sdkHandler(
        'state.begin-phase',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { phase: p, name, plans } = parseNamedArgs(args, ['phase', 'name', 'plans']);
          state.cmdStateBeginPhase(cwd, p, name, parsePlans(plans), raw);
        },
      ),
      'signal-waiting': sdkHandler(
        'state.signal-waiting',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { type, question, options, phase: p } = parseNamedArgs(args, ['type', 'question', 'options', 'phase']);
          state.cmdSignalWaiting(cwd, type, question, options, p, raw);
        },
      ),
      'signal-resume': sdkHandler(
        'state.signal-resume',
        [],
        args.slice(1),
        null,
        () => state.cmdSignalResume(cwd, raw),
      ),
      'planned-phase': sdkHandler(
        'state.planned-phase',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { phase: p, plans } = parseNamedArgs(args, ['phase', 'name', 'plans']);
          state.cmdStatePlannedPhase(cwd, p, parsePlans(plans), raw);
        },
      ),
      validate: sdkHandler(
        'state.validate',
        [],
        args.slice(1),
        null,
        () => state.cmdStateValidate(cwd, raw),
      ),
      sync: sdkHandler(
        'state.sync',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { verify } = parseNamedArgs(args, [], ['verify']);
          state.cmdStateSync(cwd, { verify }, raw);
        },
      ),
      prune: sdkHandler(
        'state.prune',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { 'keep-recent': keepRecent, 'dry-run': dryRun } = parseNamedArgs(args, ['keep-recent'], ['dry-run']);
          state.cmdStatePrune(cwd, { keepRecent: keepRecent || '3', dryRun: !!dryRun }, raw);
        },
      ),
      // complete-phase: CJS-only — no SDK counterpart.
      'complete-phase': () => {
        const { phase: p } = parseNamedArgs(args, ['phase']);
        state.cmdStateCompletePhase(cwd, raw, p || args[2]);
      },
      'milestone-switch': sdkHandler(
        'state.milestone-switch',
        args.slice(2),
        args.slice(1),
        null,
        () => {
          const { milestone, name } = parseNamedArgs(args, ['milestone', 'name']);
          state.cmdStateMilestoneSwitch(cwd, milestone, name, raw);
        },
      ),
    },
  });
}

module.exports = {
  routeStateCommand,
};
