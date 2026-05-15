'use strict';

const { VALIDATE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { formatGsdSlash, resolveRuntime } = require('./runtime-slash.cjs');
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
 * Manifest-backed validate subcommand router.
 * Keeps gsd-tools.cjs thin while preserving existing command semantics.
 *
 * Phase 6: validate.consistency, validate.health, validate.agents are
 * dispatched via executeForCjs when the SDK is available. CJS fallback
 * retained when:
 * - GSD_WORKSTREAM is active (workstream-scoped requests fall through to CJS).
 * - SDK is unavailable (build not present).
 *
 * CJS-only subcommands:
 * - context: complex inline logic using classifyContextUtilization and
 *   output formatting that has no direct SDK counterpart. Remains CJS-native.
 *
 * SDK-only (unsupported in CJS router): none.
 */
function routeValidateCommand({ verify, args, cwd, raw, parseNamedArgs, output: outputFn, error }) {
  const activeWorkstream = process.env.GSD_WORKSTREAM;
  const sdkAvailable = !activeWorkstream && tryLoadSdk();

  function sdkHandler(registryCommand, registryArgs, legacyArgs, cjsFallback) {
    if (!sdkAvailable) return cjsFallback;
    return () => {
      const result = _executeForCjs({
        registryCommand,
        registryArgs,
        legacyCommand: 'validate',
        legacyArgs,
        mode: raw ? 'raw' : 'json',
        projectDir: cwd,
      });
      if (!result.ok) {
        error(result.errorDetails && result.errorDetails.message
          ? result.errorDetails.message
          : `validate ${registryCommand} failed (${result.errorKind})`);
        return;
      }
      output(result.data);
    };
  }

  routeCjsCommandFamily({
    args,
    subcommands: VALIDATE_SUBCOMMANDS,
    unsupported: {},
    error,
    unknownMessage: (_subcommand, available) => `Unknown validate subcommand. Available: ${available.join(', ')}`,
    handlers: {
      consistency: sdkHandler(
        'validate.consistency',
        args.slice(2),
        args.slice(1),
        () => verify.cmdValidateConsistency(cwd, raw),
      ),
      health: sdkHandler(
        'validate.health',
        args.slice(2),
        args.slice(1),
        () => {
          const repairFlag = args.includes('--repair');
          const backfillFlag = args.includes('--backfill');
          verify.cmdValidateHealth(cwd, { repair: repairFlag, backfill: backfillFlag }, raw);
        },
      ),
      agents: sdkHandler(
        'validate.agents',
        args.slice(2),
        args.slice(1),
        () => verify.cmdValidateAgents(cwd, raw),
      ),
      // context: CJS-only — complex inline logic using classifyContextUtilization
      // with custom output formatting that has no direct SDK counterpart.
      context: () => {
        const opts = parseNamedArgs(args, ['tokens-used', 'context-window']);
        if (opts['tokens-used'] === null) {
          error('--tokens-used <integer> is required for `validate context`');
          return;
        }
        if (opts['context-window'] === null) {
          error('--context-window <integer> is required for `validate context`');
          return;
        }
        const { classifyContextUtilization, STATES } = require('./context-utilization.cjs');
        const threadCmd = formatGsdSlash('thread', resolveRuntime(cwd));
        const RECOMMENDATIONS = {
          [STATES.HEALTHY]: null,
          [STATES.WARNING]: `Context is approaching the fracture zone — consider ${threadCmd} to continue in a fresh window.`,
          [STATES.CRITICAL]: `Reasoning quality may degrade past 70% utilization (fracture point). Run ${threadCmd} now to preserve output quality.`,
        };
        let classified;
        try {
          classified = classifyContextUtilization(Number(opts['tokens-used']), Number(opts['context-window']));
        } catch (e) {
          const flag = /tokensUsed/.test(e.message) ? '--tokens-used' : '--context-window';
          error(`${flag} must be a non-negative integer (window > 0), got the values supplied`);
          return;
        }
        const result = { ...classified, recommendation: RECOMMENDATIONS[classified.state] };
        if (args.includes('--json')) {
          outputFn(result, raw);
        } else {
          const lines = [`Context utilization: ${result.percent}% (${result.state})`];
          if (result.recommendation) lines.push(result.recommendation);
          outputFn(result, true, lines.join('\n'));
        }
      },
    },
  });
}

module.exports = {
  routeValidateCommand,
};
