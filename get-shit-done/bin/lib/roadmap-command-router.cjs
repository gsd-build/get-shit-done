'use strict';

const { ROADMAP_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');
const { output } = require('./core.cjs');

// ─── SDK bridge (Phase 6) — shared loader via cjs-sdk-bridge.cjs ──────────────
const { tryLoadSdk, getExecuteForCjs } = require('./cjs-sdk-bridge.cjs');

/**
 * Manifest-backed roadmap subcommand router.
 * Keeps gsd-tools.cjs thin while preserving existing command semantics.
 *
 * Phase 6: all roadmap.* subcommands have SDK equivalents and are dispatched
 * via executeForCjs (the sync bridge). CJS fallback retained when:
 * - GSD_WORKSTREAM is active (workstream-scoped requests fall through to CJS).
 * - SDK is unavailable (build not present).
 *
 * CJS-only subcommands: none.
 * SDK-only (unsupported in CJS router): none.
 */
function routeRoadmapCommand({ roadmap, args, cwd, raw, error }) {
  const activeWorkstream = process.env.GSD_WORKSTREAM;
  // GSD_SDK_NESTED is set by SDK handlers that spawn gsd-tools.cjs as a
  // child process (e.g. roadmapAnnotateDependencies).  Without this guard
  // the child process re-dispatches through the SDK bridge, which spawns
  // again, ad infinitum until the synckit 15s timeout fires.  Bug #3537
  // annotate-dependencies parity.
  const nested = process.env.GSD_SDK_NESTED === '1';
  const sdkAvailable = !activeWorkstream && !nested && tryLoadSdk();

  function sdkHandler(registryCommand, registryArgs, legacyArgs, cjsFallback) {
    if (!sdkAvailable) return cjsFallback;
    return () => {
      const result = getExecuteForCjs()({
        registryCommand,
        registryArgs,
        legacyCommand: 'roadmap',
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
          : `roadmap ${registryCommand} failed (${result.errorKind})`);
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
    subcommands: ROADMAP_SUBCOMMANDS,
    unsupported: {},
    error,
    unknownMessage: (_subcommand, available) => `Unknown roadmap subcommand. Available: ${available.join(', ')}`,
    handlers: {
      'get-phase': sdkHandler(
        'roadmap.get-phase',
        args.slice(2),
        args.slice(1),
        () => roadmap.cmdRoadmapGetPhase(cwd, args[2], raw),
      ),
      analyze: sdkHandler(
        'roadmap.analyze',
        args.slice(2),
        args.slice(1),
        () => roadmap.cmdRoadmapAnalyze(cwd, raw),
      ),
      'update-plan-progress': sdkHandler(
        'roadmap.update-plan-progress',
        args.slice(2),
        args.slice(1),
        () => roadmap.cmdRoadmapUpdatePlanProgress(cwd, args[2], raw),
      ),
      'annotate-dependencies': sdkHandler(
        'roadmap.annotate-dependencies',
        args.slice(2),
        args.slice(1),
        () => roadmap.cmdRoadmapAnnotateDependencies(cwd, args[2], raw),
      ),
    },
  });
}

module.exports = {
  routeRoadmapCommand,
};
