/**
 * Utility query handlers — pure SDK implementations of simple commands.
 *
 * These handlers are direct TypeScript ports of gsd-tools.cjs functions:
 * - `generateSlug` ← `cmdGenerateSlug` (commands.cjs lines 38-48)
 * - `currentTimestamp` ← `cmdCurrentTimestamp` (commands.cjs lines 50-71)
 *
 * @example
 * ```typescript
 * import { generateSlug, currentTimestamp } from './utils.js';
 *
 * const slug = await generateSlug(['My Phase Name'], '/path/to/project');
 * // { data: { slug: 'my-phase-name' } }
 *
 * const ts = await currentTimestamp(['date'], '/path/to/project');
 * // { data: { timestamp: '2026-04-08' } }
 * ```
 */

import { GSDError, ErrorClassification } from '../errors.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Structured result returned by all query handlers. */
export interface QueryResult<T = unknown> {
  data: T;
}

/** Signature for a query handler function. */
export type QueryHandler<T = unknown> = (
  args: string[],
  projectDir: string,
  workstream?: string,
) => Promise<QueryResult<T>>;

// ─── generateSlug ───────────────────────────────────────────────────────────

/**
 * Converts text into a URL-safe kebab-case slug.
 *
 * Port of `cmdGenerateSlug` from `get-shit-done/bin/lib/commands.cjs`.
 * Algorithm: lowercase, replace non-alphanumeric with hyphens,
 * strip leading/trailing hyphens, truncate to 60 characters.
 *
 * @param args - `args[0]` is the text to slugify
 * @param _projectDir - Unused (pure function)
 * @returns Query result with `{ slug: string }`
 * @throws GSDError with Validation classification if text is missing or empty
 */
export const generateSlug: QueryHandler = async (args, _projectDir) => {
  const text = args[0];
  if (!text) {
    throw new GSDError('text required for slug generation', ErrorClassification.Validation);
  }

  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);

  return { data: { slug } };
};

// ─── currentTimestamp ───────────────────────────────────────────────────────

/**
 * Returns the current timestamp in the requested format.
 *
 * Port of `cmdCurrentTimestamp` from `get-shit-done/bin/lib/commands.cjs`.
 * Formats: `'full'` (ISO 8601), `'date'` (YYYY-MM-DD), `'filename'` (colons replaced).
 *
 * @param args - `args[0]` is the format (`'full'` | `'date'` | `'filename'`), defaults to `'full'`
 * @param _projectDir - Unused (pure function)
 * @returns Query result with `{ timestamp: string }`
 */
export const currentTimestamp: QueryHandler = async (args, _projectDir) => {
  const format = args[0] || 'full';
  const now = new Date();
  let result: string;

  switch (format) {
    case 'date':
      result = now.toISOString().split('T')[0];
      break;
    case 'filename':
      result = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      break;
    case 'full':
    default:
      result = now.toISOString();
      break;
  }

  return { data: { timestamp: result } };
};
