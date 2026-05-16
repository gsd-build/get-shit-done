'use strict';

const { STATE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');
const { output } = require('./core.cjs');
const {
  tryLoadSdk,
  getExecuteForCjs,
  getFormatStateLoadRawStdout,
} = require('./cjs-sdk-bridge.cjs');

// Subcommands whose CJS contract is exit-non-zero (stderr) ONLY when the
// underlying STATE.md is missing — not for in-state errors like
// "field not found". CJS `cmdStateGet` calls `error('STATE.md not found')` →
// exit 1 for the missing-file case but `output({ error: 'Section or field
// "X" not found' }, raw)` → exit 0 for the missing-field case. Mutation
// commands always use output() (exit 0) even when STATE.md is missing, so
// they are absent from this set entirely.
const EXIT_ON_STATE_MD_MISSING = new Set(['state.get']);
const STATE_MD_MISSING_MESSAGE = 'STATE.md not found';

// The bridge loader verifies both `executeForCjs` and `formatStateLoadRawStdout`
// are present before returning success, so this router can call `tryLoadSdk()`
// directly without an additional capability check.

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

  // When a CJS-side rawFormatter is supplied (e.g. state.load --raw → key=value
  // lines), always request 'json' from the bridge so the SDK returns the typed
  // data object. Passing mode: 'raw' would make the bridge pre-render to a
  // string and the formatter would no-op. For subcommands without a rawFormatter,
  // honor the user's --raw flag and let the bridge do default rendering.
  const bridgeMode = rawFormatter ? 'json' : (raw ? 'raw' : 'json');

  const result = getExecuteForCjs()({
    registryCommand,
    registryArgs,
    legacyCommand: 'state',
    legacyArgs,
    mode: bridgeMode,
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

  // Surface STATE.md-missing as a CJS-style fatal error (exit non-zero,
  // stderr) for the specific subcommands whose CJS contract uses error() not
  // output() for that case. The exact "STATE.md not found" message is the
  // canonical signal both CJS and SDK use — other "error" shapes (e.g.
  // "Section or field X not found" from state.get with present STATE.md)
  // stay as exit-0 JSON output so shell-script consumers JSON.parse the
  // output and branch on the error field without process-exit handling.
  if (
    EXIT_ON_STATE_MD_MISSING.has(registryCommand)
    && result.data
    && typeof result.data === 'object'
    && result.data.error === STATE_MD_MISSING_MESSAGE
  ) {
    error(result.data.error);
    return true;
  }

  if (raw && rawFormatter) {
    const rawText = rawFormatter(result.data);
    const fs = require('fs');
    fs.writeSync(1, rawText);
  } else if (raw) {
    // #3631: bridge was called with mode:'raw', so result.data is the scalar
    // string the CJS path would have printed. Bypass output()'s JSON path.
    output(null, true, typeof result.data === 'string' ? result.data : String(result.data ?? ''));
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
        // Resolved lazily — the formatter getter returns null until
        // tryLoadSdk() runs inside dispatchViaSdk. sdkHandler only invokes
        // this formatter when SDK dispatch succeeds, so by then the bridge
        // has cached the formatter and the getter returns the real function.
        (...formatterArgs) => getFormatStateLoadRawStdout()(...formatterArgs),
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
