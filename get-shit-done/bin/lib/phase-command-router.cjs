'use strict';

const { PHASE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { output } = require('./core.cjs');

// ─── SDK bridge (Phase 6) — shared loader via cjs-sdk-bridge.cjs ──────────────
const { tryLoadSdk, getExecuteForCjs } = require('./cjs-sdk-bridge.cjs');

// ─── CommandRoutingHub (issue #3788) ──────────────────────────────────────────
const { createHub, ERROR_KINDS } = require('./command-routing-hub.cjs');

/**
 * Manifest-backed phase subcommand router.
 * Keeps gsd-tools.cjs thin while preserving existing command semantics.
 *
 * Phase 6: all CJS-handled phase subcommands are dispatched via executeForCjs
 * when the SDK is available. CJS fallback retained when:
 * - GSD_WORKSTREAM is active (workstream-scoped requests fall through to CJS).
 * - SDK is unavailable (build not present).
 *
 * SDK-only (unsupported in CJS router):
 * - list-plans: SDK-only.
 * - list-artifacts: SDK-only.
 * - scaffold: routed through top-level scaffold command.
 *
 * CJS-only subcommands: none.
 *
 * #3788: dispatch is now mediated by CommandRoutingHub. The public entry point
 * and observable CLI behaviour are unchanged.
 */
function routePhaseCommand({ phase, args, cwd, raw, error }) {
  const activeWorkstream = process.env.GSD_WORKSTREAM;
  const sdkAvailable = !activeWorkstream && tryLoadSdk();

  // ── Unsupported / SDK-only subcommands ─────────────────────────────────────
  // Resolved before dispatch so the error message matches the pre-#3788 text.
  const UNSUPPORTED = {
    'list-plans': 'phase list-plans is SDK-only. Use: gsd-sdk query phase.list-plans ...',
    'list-artifacts': 'phase list-artifacts is SDK-only. Use: gsd-sdk query phase.list-artifacts ...',
    scaffold: 'phase scaffold is routed through the top-level scaffold command.',
  };

  const subcommand = args[1];

  if (subcommand && UNSUPPORTED[subcommand]) {
    error(UNSUPPORTED[subcommand]);
    return;
  }

  // ── No subcommand → reject early with helpful error ────────────────────────
  // Pre-#3788 code resolved unknown subcommands via routeCjsCommandFamily which
  // fell through to error() when no handler matched (including undefined).
  // Post-#3788 the hub's manifest check is skipped for falsy subcommand, so we
  // must guard here to preserve the deterministic "Available: ..." error message.
  if (!subcommand) {
    const available = PHASE_SUBCOMMANDS.filter(s => !UNSUPPORTED[s]).join(', ');
    error(`Unknown phase subcommand. Available: ${available}`);
    return;
  }

  // ── CJS-only subcommands (always bypass SDK path) ──────────────────────────
  // `mvp-mode` has a CJS-native implementation in phase.cmdPhaseMvpMode that
  // differs from the SDK query layer (different ROADMAP scan + error codes).
  // Dispatch it early so the SDK hub path is never reached for this subcommand,
  // preserving the pre-migration observable behaviour (correct exit code,
  // correct JSON error reason code, correct ROADMAP scan).
  if (subcommand === 'mvp-mode') {
    phase.cmdPhaseMvpMode(cwd, args.slice(2), raw);
    return;
  }

  // ── Build the CJS registry ──────────────────────────────────────────────────
  // Each handler receives a ctx object from the hub and must return a HubResult.
  const cjsRegistry = {
    phase: {
      'next-decimal': (_ctx) => {
        phase.cmdPhaseNextDecimal(cwd, args[2], raw);
        return { ok: true, data: null };
      },
      add: (_ctx) => {
        let customId = null;
        const descArgs = [];
        for (let i = 2; i < args.length; i++) {
          const token = args[i];
          if (token === '--raw') {
            continue;
          }
          if (token === '--id') {
            const id = args[i + 1];
            if (!id || id.startsWith('--')) {
              return { ok: false, errorKind: 'InvalidArgs', message: '--id requires a value' };
            }
            customId = id;
            i++;
          } else if (token.startsWith('--')) {
            return { ok: false, errorKind: 'InvalidArgs', message: `phase add does not support ${token}` };
          } else {
            descArgs.push(token);
          }
        }
        phase.cmdPhaseAdd(cwd, descArgs.join(' '), raw, customId);
        return { ok: true, data: null };
      },
      'add-batch': (_ctx) => {
        const descFlagIdx = args.indexOf('--descriptions');
        let descriptions;
        if (descFlagIdx !== -1) {
          const rawDescriptions = args[descFlagIdx + 1];
          if (!rawDescriptions || rawDescriptions.startsWith('--')) {
            return { ok: false, errorKind: 'InvalidArgs', message: '--descriptions must be a JSON array' };
          }
          try {
            descriptions = JSON.parse(rawDescriptions);
          } catch {
            return { ok: false, errorKind: 'InvalidArgs', message: '--descriptions must be a JSON array' };
          }
          if (!Array.isArray(descriptions)) {
            return { ok: false, errorKind: 'InvalidArgs', message: '--descriptions must be a JSON array' };
          }
        } else {
          descriptions = args.slice(2).filter(a => a !== '--raw');
        }
        phase.cmdPhaseAddBatch(cwd, descriptions, raw);
        return { ok: true, data: null };
      },
      insert: (_ctx) => {
        if (args.includes('--dry-run')) {
          return { ok: false, errorKind: 'InvalidArgs', message: 'phase insert does not support --dry-run' };
        }
        phase.cmdPhaseInsert(cwd, args[2], args.slice(3).join(' '), raw);
        return { ok: true, data: null };
      },
      remove: (_ctx) => {
        const removeArgs = args.slice(2).filter(token => token !== '--raw');
        let forceFlag = false;
        const positional = [];
        for (const token of removeArgs) {
          if (token === '--force') {
            forceFlag = true;
            continue;
          }
          if (token.startsWith('--')) {
            return { ok: false, errorKind: 'InvalidArgs', message: `phase remove does not support ${token}` };
          }
          positional.push(token);
        }
        if (positional.length !== 1) {
          return { ok: false, errorKind: 'InvalidArgs', message: 'phase remove accepts exactly one phase number' };
        }
        phase.cmdPhaseRemove(cwd, positional[0], { force: forceFlag }, raw);
        return { ok: true, data: null };
      },
      complete: (_ctx) => {
        phase.cmdPhaseComplete(cwd, args[2], raw);
        return { ok: true, data: null };
      },
    },
  };

  // ── Build the SDK loader ────────────────────────────────────────────────────
  function sdkLoader() {
    const execute = getExecuteForCjs();
    if (!execute) return null;
    // Wrap executeForCjs to match the hub's sdkLoader contract:
    // hub calls sdkLoader() -> returns the execute function itself.
    return execute;
  }

  // ── Build manifest (available subcommands for UnknownCommand detection) ─────
  // `availableSubcommands` is what the error message shows. It excludes
  // SDK-only unsupported commands (already handled above) but does NOT include
  // 'mvp-mode' because it was absent from PHASE_SUBCOMMANDS in the original
  // and was not shown in the "Available:" list there either.
  //
  // `manifestSubcommands` is the full routing set for the hub — it includes
  // 'mvp-mode' (which the original code routed via a handler even without a
  // manifest entry) so the hub's UnknownCommand check passes for it.
  const availableSubcommands = PHASE_SUBCOMMANDS.filter(s => !UNSUPPORTED[s]);
  const manifestSubcommands = ['mvp-mode', ...availableSubcommands];
  const manifest = { phase: manifestSubcommands };

  // ── Construct hub (mode fixed at call time based on env + SDK availability) ─
  const mode = sdkAvailable ? 'sdk' : 'cjs';
  const hub = createHub({
    mode,
    sdkLoader: mode === 'sdk' ? sdkLoader : undefined,
    cjsRegistry: mode === 'cjs' ? cjsRegistry : undefined,
    manifest,
  });

  // ── Dispatch ────────────────────────────────────────────────────────────────
  const result = hub.dispatch({
    family: 'phase',
    subcommand,
    args: args.slice(2),
    cwd,
    raw,
  });

  // ── Translate result → CLI output / error (adapter responsibility) ──────────
  if (!result.ok) {
    if (result.errorKind === ERROR_KINDS.UnknownCommand) {
      const available = availableSubcommands.join(', ');
      error(`Unknown phase subcommand. Available: ${available}`);
      return;
    }
    // InvalidArgs, HandlerRefusal, HandlerFailure, SdkLoadFailed, SdkDispatchFailed
    error(result.message);
    return;
  }

  // SDK path: the hub wraps executeForCjs; data projection is the adapter's job.
  // CJS handlers call output() themselves (inside phase.cmdPhase*()), so no
  // further output call is needed for cjs mode.
  if (mode === 'sdk') {
    if (raw) {
      output(null, true, typeof result.data === 'string' ? result.data : String(result.data ?? ''));
    } else {
      output(result.data);
    }
  }
}

module.exports = {
  routePhaseCommand,
};
