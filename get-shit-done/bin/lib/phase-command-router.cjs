'use strict';

const { PHASE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');
const { output } = require('./core.cjs');

// ─── SDK bridge (Phase 6) — shared loader via cjs-sdk-bridge.cjs ──────────────
const { tryLoadSdk, getExecuteForCjs } = require('./cjs-sdk-bridge.cjs');

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
 */
function routePhaseCommand({ phase, args, cwd, raw, error }) {
  const activeWorkstream = process.env.GSD_WORKSTREAM;
  const sdkAvailable = !activeWorkstream && tryLoadSdk();

  function sdkHandler(registryCommand, registryArgs, legacyArgs, cjsFallback) {
    if (!sdkAvailable) return cjsFallback;
    return () => {
      // #3631: under --raw, request mode:'raw' so the bridge runs the SDK's
      // raw projection (formatQueryRawOutput) and returns the scalar string
      // CJS callers used to print. We then bypass output()'s JSON-stringify
      // path by passing rawValue (the third positional). With mode:'json',
      // output() emits the JSON IR as before.
      const result = getExecuteForCjs()({
        registryCommand,
        registryArgs,
        legacyCommand: 'phase',
        legacyArgs,
        mode: raw ? 'raw' : 'json',
        projectDir: cwd,
      });
      if (!result.ok) {
        error(result.errorDetails && result.errorDetails.message
          ? result.errorDetails.message
          : `phase ${registryCommand} failed (${result.errorKind})`);
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
    subcommands: PHASE_SUBCOMMANDS,
    unsupported: {
      'list-plans': 'phase list-plans is SDK-only. Use: gsd-sdk query phase.list-plans ...',
      'list-artifacts': 'phase list-artifacts is SDK-only. Use: gsd-sdk query phase.list-artifacts ...',
      scaffold: 'phase scaffold is routed through the top-level scaffold command.',
    },
    error,
    unknownMessage: (_subcommand, available) => `Unknown phase subcommand. Available: ${available.join(', ')}`,
    handlers: {
      'mvp-mode': () => phase.cmdPhaseMvpMode(cwd, args.slice(2), raw),
      'next-decimal': sdkHandler(
        'phase.next-decimal',
        args.slice(2),
        args.slice(1),
        () => phase.cmdPhaseNextDecimal(cwd, args[2], raw),
      ),
      add: sdkHandler(
        'phase.add',
        args.slice(2),
        args.slice(1),
        () => {
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
                error('--id requires a value');
                return;
              }
              customId = id;
              i++;
            } else if (token.startsWith('--')) {
              error(`phase add does not support ${token}`);
              return;
            } else {
              descArgs.push(token);
            }
          }
          phase.cmdPhaseAdd(cwd, descArgs.join(' '), raw, customId);
        },
      ),
      'add-batch': sdkHandler(
        'phase.add-batch',
        args.slice(2),
        args.slice(1),
        () => {
          const descFlagIdx = args.indexOf('--descriptions');
          let descriptions;
          if (descFlagIdx !== -1) {
            const rawDescriptions = args[descFlagIdx + 1];
            if (!rawDescriptions || rawDescriptions.startsWith('--')) {
              error('--descriptions must be a JSON array');
              return;
            }
            try {
              descriptions = JSON.parse(rawDescriptions);
            } catch {
              error('--descriptions must be a JSON array');
              return;
            }
            if (!Array.isArray(descriptions)) {
              error('--descriptions must be a JSON array');
              return;
            }
          } else {
            descriptions = args.slice(2).filter(a => a !== '--raw');
          }
          phase.cmdPhaseAddBatch(cwd, descriptions, raw);
        },
      ),
      insert: sdkHandler(
        'phase.insert',
        args.slice(2),
        args.slice(1),
        () => {
          if (args.includes('--dry-run')) {
            error('phase insert does not support --dry-run');
            return;
          }
          phase.cmdPhaseInsert(cwd, args[2], args.slice(3).join(' '), raw);
        },
      ),
      remove: sdkHandler(
        'phase.remove',
        args.slice(2),
        args.slice(1),
        () => {
          const removeArgs = args.slice(2).filter(token => token !== '--raw');
          let forceFlag = false;
          const positional = [];
          for (const token of removeArgs) {
            if (token === '--force') {
              forceFlag = true;
              continue;
            }
            if (token.startsWith('--')) {
              error(`phase remove does not support ${token}`);
              return;
            }
            positional.push(token);
          }
          if (positional.length !== 1) {
            error('phase remove accepts exactly one phase number');
            return;
          }
          phase.cmdPhaseRemove(cwd, positional[0], { force: forceFlag }, raw);
        },
      ),
      complete: sdkHandler(
        'phase.complete',
        args.slice(2),
        args.slice(1),
        () => phase.cmdPhaseComplete(cwd, args[2], raw),
      ),
    },
  });
}

module.exports = {
  routePhaseCommand,
};
