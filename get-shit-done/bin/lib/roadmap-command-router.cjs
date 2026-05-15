'use strict';

const { ROADMAP_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');
const { output } = require('./core.cjs');

// ─── SDK bridge (Phase 6) ────────────────────────────────────────────────────
let _executeForCjs = null;

function tryLoadSdk() {
  if (_executeForCjs !== null) return true;
  try {
    const bridgeModule = require('@gsd-build/sdk/dist/runtime-bridge-sync/index.js');
    _executeForCjs = bridgeModule.executeForCjs;
    return true;
  } catch {
    return false;
  }
}

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
  const sdkAvailable = !activeWorkstream && tryLoadSdk();

  function sdkHandler(registryCommand, registryArgs, legacyArgs, cjsFallback) {
    if (!sdkAvailable) return cjsFallback;
    return () => {
      const result = _executeForCjs({
        registryCommand,
        registryArgs,
        legacyCommand: 'roadmap',
        legacyArgs,
        mode: raw ? 'raw' : 'json',
        projectDir: cwd,
      });
      if (!result.ok) {
        error(result.errorDetails && result.errorDetails.message
          ? result.errorDetails.message
          : `roadmap ${registryCommand} failed (${result.errorKind})`);
        return;
      }
      output(result.data);
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
