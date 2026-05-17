'use strict';

const { INIT_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');
const { output } = require('./core.cjs');

// ─── SDK bridge (Phase 6) — shared loader via cjs-sdk-bridge.cjs ──────────────
const { tryLoadSdk, getExecuteForCjs } = require('./cjs-sdk-bridge.cjs');

/**
 * Manifest-backed init subcommand router.
 * Keeps gsd-tools.cjs thin while preserving existing command semantics.
 *
 * Phase 6: all init.* subcommands have SDK equivalents and are dispatched
 * via executeForCjs (the sync bridge). CJS fallback retained when:
 * - GSD_WORKSTREAM is active (workstream-scoped requests fall through to CJS).
 * - SDK is unavailable (build not present).
 *
 * CJS-only subcommands: none.
 * SDK-only (unsupported in CJS router): none.
 */
function routeInitCommand({ init, args, cwd, raw, parseNamedArgs, error }) {
  const activeWorkstream = process.env.GSD_WORKSTREAM;
  const sdkAvailable = !activeWorkstream && tryLoadSdk();

  function sdkHandler(registryCommand, registryArgs, legacyArgs, cjsFallback) {
    if (!sdkAvailable) return cjsFallback;
    return () => {
      const result = getExecuteForCjs()({
        registryCommand,
        registryArgs,
        legacyCommand: 'init',
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
          : `init ${registryCommand} failed (${result.errorKind})`);
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
    subcommands: INIT_SUBCOMMANDS,
    unsupported: {},
    error,
    unknownMessage: (_subcommand, available) => `Unknown init workflow: ${_subcommand}\nAvailable: ${available.join(', ')}`,
    handlers: {
      'execute-phase': sdkHandler(
        'init.execute-phase',
        args.slice(2),
        args.slice(1),
        () => {
          const { validate: epValidate, tdd: epTdd } = parseNamedArgs(args, [], ['validate', 'tdd']);
          init.cmdInitExecutePhase(cwd, args[2], raw, { validate: epValidate, tdd: epTdd });
        },
      ),
      'plan-phase': sdkHandler(
        'init.plan-phase',
        args.slice(2),
        args.slice(1),
        () => {
          const { validate: ppValidate, tdd: ppTdd } = parseNamedArgs(args, [], ['validate', 'tdd']);
          init.cmdInitPlanPhase(cwd, args[2], raw, { validate: ppValidate, tdd: ppTdd });
        },
      ),
      'new-project': sdkHandler(
        'init.new-project',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitNewProject(cwd, raw),
      ),
      'new-milestone': sdkHandler(
        'init.new-milestone',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitNewMilestone(cwd, raw),
      ),
      quick: sdkHandler(
        'init.quick',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitQuick(cwd, args.slice(2).join(' '), raw),
      ),
      'ingest-docs': sdkHandler(
        'init.ingest-docs',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitIngestDocs(cwd, raw),
      ),
      resume: sdkHandler(
        'init.resume',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitResume(cwd, raw),
      ),
      'verify-work': sdkHandler(
        'init.verify-work',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitVerifyWork(cwd, args[2], raw),
      ),
      'phase-op': sdkHandler(
        'init.phase-op',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitPhaseOp(cwd, args[2], raw),
      ),
      todos: sdkHandler(
        'init.todos',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitTodos(cwd, args[2], raw),
      ),
      'milestone-op': sdkHandler(
        'init.milestone-op',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitMilestoneOp(cwd, raw),
      ),
      'map-codebase': sdkHandler(
        'init.map-codebase',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitMapCodebase(cwd, raw),
      ),
      progress: sdkHandler(
        'init.progress',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitProgress(cwd, raw),
      ),
      // Keep manager on CJS for now so runtime-specific command rendering
      // (e.g. $gsd-* for codex) stays consistent with runtime-slash helpers.
      manager: () => init.cmdInitManager(cwd, raw),
      'new-workspace': sdkHandler(
        'init.new-workspace',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitNewWorkspace(cwd, raw),
      ),
      'list-workspaces': sdkHandler(
        'init.list-workspaces',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitListWorkspaces(cwd, raw),
      ),
      'remove-workspace': sdkHandler(
        'init.remove-workspace',
        args.slice(2),
        args.slice(1),
        () => init.cmdInitRemoveWorkspace(cwd, args[2], raw),
      ),
    },
  });
}

module.exports = {
  routeInitCommand,
};
