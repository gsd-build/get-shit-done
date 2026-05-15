'use strict';

const { VERIFY_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
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
 * Manifest-backed verify subcommand router.
 * Keeps gsd-tools.cjs thin while preserving existing command semantics.
 *
 * Phase 6: all verify.* subcommands have SDK equivalents and are dispatched
 * via executeForCjs (the sync bridge). CJS fallback retained when:
 * - GSD_WORKSTREAM is active (workstream-scoped requests fall through to CJS).
 * - SDK is unavailable (build not present).
 *
 * CJS-only subcommands: none.
 * SDK-only (unsupported in CJS router): none.
 */
function routeVerifyCommand({ verify, args, cwd, raw, error }) {
  const activeWorkstream = process.env.GSD_WORKSTREAM;
  const sdkAvailable = !activeWorkstream && tryLoadSdk();

  function sdkHandler(registryCommand, registryArgs, legacyArgs, cjsFallback) {
    if (!sdkAvailable) return cjsFallback;
    return () => {
      const result = _executeForCjs({
        registryCommand,
        registryArgs,
        legacyCommand: 'verify',
        legacyArgs,
        mode: raw ? 'raw' : 'json',
        projectDir: cwd,
      });
      if (!result.ok) {
        error(result.errorDetails && result.errorDetails.message
          ? result.errorDetails.message
          : `verify ${registryCommand} failed (${result.errorKind})`);
        return;
      }
      output(result.data);
    };
  }

  routeCjsCommandFamily({
    args,
    subcommands: VERIFY_SUBCOMMANDS,
    unsupported: {},
    error,
    unknownMessage: (_subcommand, available) => `Unknown verify subcommand. Available: ${available.join(', ')}`,
    handlers: {
      'plan-structure': sdkHandler(
        'verify.plan-structure',
        args.slice(2),
        args.slice(1),
        () => verify.cmdVerifyPlanStructure(cwd, args[2], raw),
      ),
      'phase-completeness': sdkHandler(
        'verify.phase-completeness',
        args.slice(2),
        args.slice(1),
        () => verify.cmdVerifyPhaseCompleteness(cwd, args[2], raw),
      ),
      references: sdkHandler(
        'verify.references',
        args.slice(2),
        args.slice(1),
        () => verify.cmdVerifyReferences(cwd, args[2], raw),
      ),
      commits: sdkHandler(
        'verify.commits',
        args.slice(2),
        args.slice(1),
        () => verify.cmdVerifyCommits(cwd, args.slice(2), raw),
      ),
      artifacts: sdkHandler(
        'verify.artifacts',
        args.slice(2),
        args.slice(1),
        () => verify.cmdVerifyArtifacts(cwd, args[2], raw),
      ),
      'key-links': sdkHandler(
        'verify.key-links',
        args.slice(2),
        args.slice(1),
        () => verify.cmdVerifyKeyLinks(cwd, args[2], raw),
      ),
      'schema-drift': sdkHandler(
        'verify.schema-drift',
        args.slice(2),
        args.slice(1),
        () => {
          const rest = args.slice(2);
          const skipFlag = rest.includes('--skip');
          const phaseArg = rest.find((arg) => !arg.startsWith('-'));
          verify.cmdVerifySchemaDrift(cwd, phaseArg, skipFlag, raw);
        },
      ),
      'codebase-drift': sdkHandler(
        'verify.codebase-drift',
        args.slice(2),
        args.slice(1),
        () => verify.cmdVerifyCodebaseDrift(cwd, raw),
      ),
    },
  });
}

module.exports = {
  routeVerifyCommand,
};
