'use strict';

const { PHASES_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');
const { output } = require('./core.cjs');

// ─── SDK bridge (Phase 6) — shared loader via cjs-sdk-bridge.cjs ──────────────
const { tryLoadSdk, getExecuteForCjs } = require('./cjs-sdk-bridge.cjs');

/**
 * Manifest-backed phases subcommand router.
 * Keeps gsd-tools.cjs thin while preserving current CJS semantics.
 *
 * Phase 6: phases.list and phases.clear are dispatched via executeForCjs when
 * the SDK is available. CJS fallback retained when:
 * - GSD_WORKSTREAM is active (workstream-scoped requests fall through to CJS).
 * - SDK is unavailable (build not present).
 *
 * SDK-only (not in CJS router, treated as unknown):
 * - archive: `phases archive` is SDK-only (`phases.archive` handler in SDK
 *   query registry). CJS `gsd-tools phases` intentionally supports list/clear only.
 *   `archive` is excluded from the subcommands list so it falls through to the
 *   "unknown subcommand" error path (matching pre-Phase 6 behavior).
 *
 * CJS-only subcommands: none.
 */
function routePhasesCommand({ phase, milestone, args, cwd, raw, error }) {
  const activeWorkstream = process.env.GSD_WORKSTREAM;
  const sdkAvailable = !activeWorkstream && tryLoadSdk();

  function sdkHandler(registryCommand, registryArgs, legacyArgs, cjsFallback) {
    if (!sdkAvailable) return cjsFallback;
    return () => {
      const result = getExecuteForCjs()({
        registryCommand,
        registryArgs,
        legacyCommand: 'phases',
        legacyArgs,
        // #3631: under --raw, request mode:'raw' so the bridge runs the SDK's
        // raw projection (formatQueryRawOutput) and returns the scalar string
        // CJS callers used to print. We then bypass output()'s JSON-stringify
        // path by passing rawValue (the third positional). With mode:'json',
        // output() emits the JSON IR as before.
        mode: raw ? 'raw' : 'json',
        projectDir: cwd,
      });
      if (!result.ok) {
        error(result.errorDetails && result.errorDetails.message
          ? result.errorDetails.message
          : `phases ${registryCommand} failed (${result.errorKind})`);
        return;
      }
      if (raw) {
        output(null, true, typeof result.data === 'string' ? result.data : String(result.data ?? ''));
      } else {
        output(result.data);
      }
    };
  }

  routeCjsCommandFamily({
    args,
    // Exclude 'archive' — it's SDK-only and not supported in CJS. Excluding
    // from this list causes it to hit the unknownMessage path, preserving the
    // pre-Phase 6 error message for callers that pass 'archive'.
    subcommands: PHASES_SUBCOMMANDS.filter((s) => s !== 'archive'),
    error,
    unknownMessage: (_subcommand, available) => `Unknown phases subcommand. Available: ${available.join(', ')}`,
    handlers: {
      list: sdkHandler(
        'phases.list',
        args.slice(2),
        args.slice(1),
        () => {
          const typeIndex = args.indexOf('--type');
          const phaseIndex = args.indexOf('--phase');
          const options = {
            type: typeIndex !== -1 ? args[typeIndex + 1] : null,
            phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
            includeArchived: args.includes('--include-archived'),
          };
          phase.cmdPhasesList(cwd, options, raw);
        },
      ),
      clear: sdkHandler(
        'phases.clear',
        args.slice(2),
        args.slice(1),
        () => milestone.cmdPhasesClear(cwd, raw, args.slice(2)),
      ),
    },
  });
}

module.exports = {
  routePhasesCommand,
};
