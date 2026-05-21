'use strict';

/**
 * Command Routing Hub — issue #3788.
 *
 * A pure-result dispatch hub that centralizes the mode decision (SDK vs CJS),
 * the error taxonomy, and the no-throw contract that all command-family routers
 * currently duplicate independently.
 *
 * Design:
 *   createHub({ mode, sdkLoader, cjsRegistry, manifest }) -> hub
 *   hub.dispatch({ family, subcommand, args, cwd, raw })  -> Result
 *
 *   Result = { ok: true, data }
 *           | { ok: false, errorKind, message, details? }
 *
 * Invariants:
 *   - `mode` is fixed at construction; never re-evaluated per dispatch.
 *   - Hub never prints to stdout/stderr, never calls process.exit.
 *   - Hub never throws — all internal throws are caught and converted to
 *     { ok: false, errorKind: 'HandlerFailure', message, details }.
 *   - No transparent fallback: an SDK-mode hub that encounters an SDK crash
 *     returns { ok: false, errorKind: 'SdkDispatchFailed' }; it does NOT
 *     silently retry via the CJS registry.
 *   - The errorKind taxonomy is closed. Callers switch on ERROR_KINDS values.
 */

/**
 * Closed errorKind enum. Export as a frozen object so callers can switch on
 * ERROR_KINDS.UnknownCommand etc. without relying on bare string literals.
 *
 * @readonly
 */
const ERROR_KINDS = Object.freeze({
  /** The requested family/subcommand combination is not present in the manifest. */
  UnknownCommand: 'UnknownCommand',
  /** The handler rejected the supplied arguments before executing. */
  InvalidArgs: 'InvalidArgs',
  /** A CJS handler returned an explicit refusal (e.g. unsupported subcommand). */
  HandlerRefusal: 'HandlerRefusal',
  /** A handler threw an unexpected exception. */
  HandlerFailure: 'HandlerFailure',
  /** The sdkLoader function threw or returned a falsy value at dispatch time. */
  SdkLoadFailed: 'SdkLoadFailed',
  /** The SDK was loaded but threw or returned ok:false during execution. */
  SdkDispatchFailed: 'SdkDispatchFailed',
});

/**
 * @typedef {{ ok: true, data: unknown }} OkResult
 * @typedef {{ ok: false, errorKind: string, message: string, details?: unknown }} ErrResult
 * @typedef {OkResult | ErrResult} HubResult
 */

/**
 * @typedef {object} HubOptions
 * @property {'sdk' | 'cjs'} mode - Dispatch mode, fixed at construction.
 * @property {() => unknown} [sdkLoader] - Callable that returns the SDK execute
 *   function (or throws). Only used when mode === 'sdk'.
 * @property {Record<string, Record<string, (ctx: object) => HubResult>>} [cjsRegistry] -
 *   Nested map of family -> subcommand -> handler. Only used when mode === 'cjs'.
 * @property {Record<string, string[]>} [manifest] - Map of family -> known subcommands.
 *   Used for UnknownCommand detection regardless of mode.
 */

/**
 * Construct a CommandRoutingHub.
 *
 * @param {HubOptions} options
 * @returns {{ dispatch: (req: object) => HubResult }}
 */
function createHub({ mode, sdkLoader, cjsRegistry, manifest }) {
  if (mode !== 'sdk' && mode !== 'cjs') {
    throw new TypeError(`CommandRoutingHub: mode must be 'sdk' or 'cjs', got ${JSON.stringify(mode)}`);
  }

  // Validate mode once at construction; never re-check per dispatch.
  const _mode = mode;
  const _sdkLoader = sdkLoader;
  const _cjsRegistry = cjsRegistry;
  const _manifest = manifest;

  /**
   * Dispatch a command through the hub.
   *
   * @param {{ family: string, subcommand: string, args?: unknown[], cwd?: string, raw?: boolean }} req
   * @returns {HubResult}
   */
  function dispatch(req) {
    try {
      return _dispatch(req);
    } catch (err) {
      return {
        ok: false,
        errorKind: ERROR_KINDS.HandlerFailure,
        message: err instanceof Error ? err.message : String(err),
        details: { originalError: err },
      };
    }
  }

  function _dispatch(req) {
    const { family, subcommand, args = [], cwd, raw } = req;

    // ── manifest check (applies to both modes) ──────────────────────────────
    if (_manifest) {
      const knownSubcommands = _manifest[family];
      if (!knownSubcommands) {
        return {
          ok: false,
          errorKind: ERROR_KINDS.UnknownCommand,
          message: `Unknown command family: ${family}`,
        };
      }
      if (subcommand && !knownSubcommands.includes(subcommand)) {
        return {
          ok: false,
          errorKind: ERROR_KINDS.UnknownCommand,
          message: `Unknown subcommand: ${family} ${subcommand}`,
        };
      }
    }

    if (_mode === 'sdk') {
      return _dispatchSdk({ family, subcommand, args, cwd, raw });
    }

    return _dispatchCjs({ family, subcommand, args, cwd, raw });
  }

  function _dispatchSdk({ family, subcommand, args, cwd, raw }) {
    // Load the SDK execute function (or return SdkLoadFailed).
    let executeForCjs;
    try {
      executeForCjs = _sdkLoader ? _sdkLoader() : null;
    } catch (err) {
      return {
        ok: false,
        errorKind: ERROR_KINDS.SdkLoadFailed,
        message: `SDK load failed: ${err instanceof Error ? err.message : String(err)}`,
        details: { originalError: err },
      };
    }

    if (!executeForCjs || typeof executeForCjs !== 'function') {
      return {
        ok: false,
        errorKind: ERROR_KINDS.SdkLoadFailed,
        message: 'SDK loader did not return a callable execute function',
      };
    }

    // Call the SDK. No transparent fallback — any error becomes SdkDispatchFailed.
    let result;
    try {
      result = executeForCjs({
        registryCommand: subcommand ? `${family}.${subcommand}` : family,
        registryArgs: args,
        legacyCommand: family,
        legacyArgs: [subcommand, ...args].filter(Boolean),
        mode: raw ? 'raw' : 'json',
        projectDir: cwd,
      });
    } catch (err) {
      return {
        ok: false,
        errorKind: ERROR_KINDS.SdkDispatchFailed,
        message: err instanceof Error ? err.message : String(err),
        details: { originalError: err },
      };
    }

    if (!result || !result.ok) {
      const message = (result && result.errorDetails && result.errorDetails.message)
        ? result.errorDetails.message
        : `${family}${subcommand ? ' ' + subcommand : ''} failed (${result && result.errorKind})`;
      return {
        ok: false,
        errorKind: ERROR_KINDS.SdkDispatchFailed,
        message,
        details: result || {},
      };
    }

    return { ok: true, data: result.data };
  }

  function _dispatchCjs({ family, subcommand, args, cwd, raw }) {
    if (!_cjsRegistry) {
      return {
        ok: false,
        errorKind: ERROR_KINDS.UnknownCommand,
        message: `No CJS registry provided for family: ${family}`,
      };
    }

    const familyHandlers = _cjsRegistry[family];
    if (!familyHandlers) {
      return {
        ok: false,
        errorKind: ERROR_KINDS.UnknownCommand,
        message: `Unknown command family: ${family}`,
      };
    }

    const handler = subcommand ? familyHandlers[subcommand] : familyHandlers[''];
    if (typeof handler !== 'function') {
      return {
        ok: false,
        errorKind: ERROR_KINDS.UnknownCommand,
        message: `Unknown subcommand: ${family} ${subcommand}`,
      };
    }

    // Invoke the handler. It must return a HubResult or throw.
    // If it throws, the outer try/catch in dispatch() catches it.
    const result = handler({ family, subcommand, args, cwd, raw });

    // If the handler returned a well-formed HubResult, pass it through.
    if (result && typeof result === 'object' && 'ok' in result) {
      return result;
    }

    // If the handler returned nothing (undefined), treat as success with no data.
    if (result === undefined || result === null) {
      return { ok: true, data: null };
    }

    // Any other return value is treated as the data payload.
    return { ok: true, data: result };
  }

  return { dispatch };
}

module.exports = {
  createHub,
  ERROR_KINDS,
};
