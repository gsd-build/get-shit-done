'use strict';

const { VERIFY_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');
const { output } = require('./core.cjs');

// ─── SDK bridge (Phase 6) — shared loader via cjs-sdk-bridge.cjs ──────────────
const { tryLoadSdk, getExecuteForCjs } = require('./cjs-sdk-bridge.cjs');

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
      const result = getExecuteForCjs()({
        registryCommand,
        registryArgs,
        legacyCommand: 'verify',
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
          : `verify ${registryCommand} failed (${result.errorKind})`);
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
      // verify codebase-drift dispatches direct to CJS — drift is out-of-seam
      // per ADR/PRD 3524 §3 / L160 (CJS-only by design). Routing through
      // sdkHandler would re-enter the SDK bridge, and Phase 6's removed
      // verifyCodebaseDrift stub used to execFileSync back to the CLI,
      // creating an infinite spawn loop.
      'codebase-drift': () => verify.cmdVerifyCodebaseDrift(cwd, raw),
    },
  });
}

module.exports = {
  routeVerifyCommand,
};
