/**
 * Query command registry — routes commands to native SDK handlers.
 *
 * The registry is a flat `Map<string, QueryHandler>` that maps command names
 * to handler functions. Unknown keys passed to `dispatch()` throw `GSDError`.
 * The `gsd-sdk query` CLI resolves argv with `resolveQueryArgv()` before dispatch;
 * there is no automatic delegation to `gsd-tools.cjs`.
 *
 * Also exports `extractField` — a TypeScript port of the `--pick` field
 * extraction logic from gsd-tools.cjs (lines 365-382).
 *
 * @example
 * ```typescript
 * import { QueryRegistry, extractField } from './registry.js';
 *
 * const registry = new QueryRegistry();
 * registry.register('generate-slug', generateSlug);
 * const result = await registry.dispatch('generate-slug', ['My Phase'], '/project');
 * const slug = extractField(result.data, 'slug'); // 'my-phase'
 * ```
 */

import type { QueryResult, QueryHandler } from './utils.js';
import { GSDError, ErrorClassification } from '../errors.js';

// ─── extractField ──────────────────────────────────────────────────────────

/**
 * Extract a nested field from an object using dot-notation and bracket syntax.
 *
 * Direct port of `extractField()` from gsd-tools.cjs (lines 365-382).
 * Supports `a.b.c` dot paths, `items[0]` array indexing, and `items[-1]`
 * negative indexing.
 *
 * @param obj - The object to extract from
 * @param fieldPath - Dot-separated path with optional bracket notation
 * @returns The extracted value, or undefined if the path doesn't resolve
 */
export function extractField(obj: unknown, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const bracketMatch = part.match(/^(.+?)\[(-?\d+)]$/);
    if (bracketMatch) {
      const key = bracketMatch[1];
      const index = parseInt(bracketMatch[2], 10);
      current = (current as Record<string, unknown>)[key];
      if (!Array.isArray(current)) return undefined;
      current = index < 0 ? current[current.length + index] : current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

// ─── QueryRegistry ─────────────────────────────────────────────────────────

/**
 * Flat command registry that routes query commands to native handlers.
 *
 * `dispatch()` throws `GSDError` for unknown command keys. The `gsd-sdk query`
 * CLI uses `resolveQueryArgv()` first; when no handler matches, it may shell out
 * to `gsd-tools.cjs` (see `cli.ts` and `QUERY-HANDLERS.md` fallback policy).
 */
export class QueryRegistry {
  private handlers = new Map<string, QueryHandler>();

  /**
   * Register a native handler for a command name.
   *
   * @param command - The command name (e.g., 'generate-slug', 'state.load')
   * @param handler - The handler function to invoke
   */
  register(command: string, handler: QueryHandler): void {
    this.handlers.set(command, handler);
  }

  /**
   * Check if a command has a registered native handler.
   *
   * @param command - The command name to check
   * @returns True if the command has a native handler
   */
  has(command: string): boolean {
    return this.handlers.has(command);
  }

  /**
   * List all registered command names (for tooling, pipelines, and tests).
   */
  commands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get the handler for a command without dispatching.
   *
   * @param command - The command name to look up
   * @returns The handler function, or undefined if not registered
   */
  getHandler(command: string): QueryHandler | undefined {
    return this.handlers.get(command);
  }

  /**
   * Dispatch a command to its registered native handler.
   *
   * @param command - The command name to dispatch
   * @param args - Arguments to pass to the handler
   * @param projectDir - The project directory for context
   * @param workstream - Optional workstream name to scope .planning paths
   * @returns The query result from the handler
   * @throws GSDError if no handler is registered for the command
   */
  async dispatch(command: string, args: string[], projectDir: string, workstream?: string): Promise<QueryResult> {
    const handler = this.handlers.get(command);
    if (!handler) {
      throw new GSDError(
        `Unknown command: "${command}". No native handler registered.`,
        ErrorClassification.Validation,
      );
    }
    return handler(args, projectDir, workstream);
  }
}

/**
 * If the first token contains a dot (e.g. `init.execute-phase`), split it into
 * segments and prepend those segments in place of the original token. Args that
 * follow the dotted token are preserved.
 *
 * Examples:
 *   ['init.new-project']               -> ['init', 'new-project']
 *   ['init.execute-phase', '1']        -> ['init', 'execute-phase', '1']
 *   ['state.update', 'status', 'X']    -> ['state', 'update', 'status', 'X']
 *
 * Returns the original array (by reference) when no expansion applies so callers
 * can detect "nothing changed" via identity comparison.
 */
function expandFirstDottedToken(tokens: string[]): string[] {
  if (tokens.length === 0) {
    return tokens;
  }
  const first = tokens[0];
  if (first.startsWith('--') || !first.includes('.')) {
    return tokens;
  }
  return [...first.split('.'), ...tokens.slice(1)];
}

function matchRegisteredPrefix(
  tokens: string[],
  registry: QueryRegistry,
): { cmd: string; args: string[] } | null {
  for (let i = tokens.length; i >= 1; i--) {
    const head = tokens.slice(0, i);
    const dotted = head.join('.');
    const spaced = head.join(' ');
    if (registry.has(dotted)) {
      return { cmd: dotted, args: tokens.slice(i) };
    }
    if (registry.has(spaced)) {
      return { cmd: spaced, args: tokens.slice(i) };
    }
  }
  return null;
}

/**
 * Map argv after `gsd-sdk query` to a registered handler key and remaining args.
 * Longest-prefix match on dotted (`a.b.c`) and spaced (`a b c`) keys; if no match,
 * expands a single dotted token (`state.validate` → `state`, `validate`) and retries.
 */
export function resolveQueryArgv(
  tokens: string[],
  registry: QueryRegistry,
): { cmd: string; args: string[] } | null {
  let matched = matchRegisteredPrefix(tokens, registry);
  if (!matched) {
    const expanded = expandFirstDottedToken(tokens);
    if (expanded !== tokens) {
      matched = matchRegisteredPrefix(expanded, registry);
    }
  }
  return matched;
}
