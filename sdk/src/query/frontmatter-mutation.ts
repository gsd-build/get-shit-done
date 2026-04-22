/**
 * Frontmatter mutation handlers — write operations for YAML frontmatter.
 *
 * Ported from get-shit-done/bin/lib/frontmatter.cjs.
 * Provides reconstructFrontmatter (serialization), spliceFrontmatter (replacement),
 * and query handlers for frontmatter.set, frontmatter.merge, frontmatter.validate.
 *
 * @example
 * ```typescript
 * import { reconstructFrontmatter, spliceFrontmatter } from './frontmatter-mutation.js';
 *
 * const yaml = reconstructFrontmatter({ phase: '10', tags: ['a', 'b'] });
 * // 'phase: 10\ntags: [a, b]'
 *
 * const updated = spliceFrontmatter('---\nold: val\n---\nbody', { new: 'val' });
 * // '---\nnew: val\n---\nbody'
 * ```
 */

import { readFile, writeFile } from 'node:fs/promises';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import { normalizeMd, resolvePathUnderProject } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── FRONTMATTER_SCHEMAS ──────────────────────────────────────────────────

/** Schema definitions for frontmatter validation. */
export const FRONTMATTER_SCHEMAS: Record<string, { required: string[] }> = {
  plan: { required: ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'] },
  summary: { required: ['phase', 'plan', 'subsystem', 'tags', 'duration', 'completed'] },
  verification: { required: ['phase', 'verified', 'status', 'score'] },
};

// ─── reconstructFrontmatter ────────────────────────────────────────────────

/**
 * Serialize a flat/nested object into YAML frontmatter lines.
 *
 * Port of `reconstructFrontmatter` from frontmatter.cjs lines 122-183.
 * Handles arrays (inline/dash), nested objects (2 levels), and quoting.
 *
 * @param obj - Object to serialize
 * @returns YAML string (without --- delimiters)
 */
export function reconstructFrontmatter(obj: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      serializeArray(lines, key, value, '');
    } else if (typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subkey, subval] of Object.entries(value as Record<string, unknown>)) {
        if (subval === null || subval === undefined) continue;
        if (Array.isArray(subval)) {
          serializeArray(lines, subkey, subval, '  ');
        } else if (typeof subval === 'object') {
          lines.push(`  ${subkey}:`);
          for (const [subsubkey, subsubval] of Object.entries(subval as Record<string, unknown>)) {
            if (subsubval === null || subsubval === undefined) continue;
            if (Array.isArray(subsubval)) {
              if (subsubval.length === 0) {
                lines.push(`    ${subsubkey}: []`);
              } else {
                lines.push(`    ${subsubkey}:`);
                for (const item of subsubval) {
                  lines.push(`      - ${item}`);
                }
              }
            } else {
              lines.push(`    ${subsubkey}: ${subsubval}`);
            }
          }
        } else {
          const sv = String(subval);
          lines.push(`  ${subkey}: ${needsQuoting(sv) ? `"${sv}"` : sv}`);
        }
      }
    } else {
      const sv = String(value);
      if (sv.includes(':') || sv.includes('#') || sv.startsWith('[') || sv.startsWith('{')) {
        lines.push(`${key}: "${sv}"`);
      } else {
        lines.push(`${key}: ${sv}`);
      }
    }
  }

  return lines.join('\n');
}

/** Serialize an array at the given indent level. */
function serializeArray(lines: string[], key: string, arr: unknown[], indent: string): void {
  if (arr.length === 0) {
    lines.push(`${indent}${key}: []`);
  } else if (
    arr.every(v => typeof v === 'string') &&
    arr.length <= 3 &&
    (arr as string[]).join(', ').length < 60
  ) {
    lines.push(`${indent}${key}: [${(arr as string[]).join(', ')}]`);
  } else {
    lines.push(`${indent}${key}:`);
    for (const item of arr) {
      const s = String(item);
      lines.push(`${indent}  - ${typeof item === 'string' && needsQuoting(s) ? `"${s}"` : s}`);
    }
  }
}

/** Check if a string value needs quoting in YAML. */
function needsQuoting(s: string): boolean {
  return s.includes(':') || s.includes('#');
}

// ─── spliceFrontmatter ─────────────────────────────────────────────────────

/**
 * Replace or prepend frontmatter in content.
 *
 * Port of `spliceFrontmatter` from frontmatter.cjs lines 186-193.
 *
 * @param content - File content with potential existing frontmatter
 * @param newObj - New frontmatter object to serialize
 * @returns Content with updated frontmatter
 */
export function spliceFrontmatter(content: string, newObj: Record<string, unknown>): string {
  const yamlStr = reconstructFrontmatter(newObj);
  const match = content.match(/^---\r?\n[\s\S]+?\r?\n---/);
  if (match) {
    return `---\n${yamlStr}\n---` + content.slice(match[0].length);
  }
  return `---\n${yamlStr}\n---\n\n` + content;
}

// ─── parseSimpleValue ──────────────────────────────────────────────────────

/**
 * Parse a simple CLI value string into a typed value.
 * Tries JSON.parse first (handles booleans, numbers, arrays, objects).
 * Falls back to raw string.
 */
function parseSimpleValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// ─── frontmatterSet ────────────────────────────────────────────────────────

/**
 * Query handler for frontmatter.set command.
 *
 * Reads a file, sets a single frontmatter field, writes back with normalization.
 * Port of `cmdFrontmatterSet` from frontmatter.cjs lines 328-342.
 *
 * @param args - args[0]: file path, args[1]: field name, args[2]: value
 * @param projectDir - Project root directory
 * @returns QueryResult with { updated: true, field, value }
 */
export const frontmatterSet: QueryHandler = async (args, projectDir) => {
  let filePath: string;
  let field: string;
  let value: string;

  const fi = args.indexOf('--field');
  const vi = args.indexOf('--value');
  const hasNamedArgs = fi !== -1 || vi !== -1;
  if (hasNamedArgs) {
    if (fi === -1 || vi === -1 || !args[fi + 1] || args[vi + 1] === undefined) {
      throw new GSDError('file, --field, and --value required together', ErrorClassification.Validation);
    }
    filePath = args[0];
    field = args[fi + 1];
    value = args[vi + 1];
  } else {
    filePath = args[0];
    field = args[1];
    value = args[2];
  }

  if (!filePath || !field || value === undefined) {
    throw new GSDError('file, field, and value required', ErrorClassification.Validation);
  }

  // Path traversal guard: reject null bytes
  if (filePath.includes('\0')) {
    throw new GSDError('file path contains null bytes', ErrorClassification.Validation);
  }

  let fullPath: string;
  try {
    fullPath = await resolvePathUnderProject(projectDir, filePath);
  } catch (err) {
    if (err instanceof GSDError) {
      return { data: { error: err.message, path: filePath } };
    }
    throw err;
  }

  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return { data: { error: 'File not found', path: filePath } };
  }

  const fm = extractFrontmatter(content);
  const parsedValue = parseSimpleValue(value);
  fm[field] = parsedValue;
  const newContent = spliceFrontmatter(content, fm);
  await writeFile(fullPath, normalizeMd(newContent), 'utf-8');

  return { data: { updated: true, field, value: parsedValue } };
};

// ─── frontmatterMerge ──────────────────────────────────────────────────────

/**
 * Query handler for frontmatter.merge command.
 *
 * Reads a file, merges JSON object into existing frontmatter, writes back.
 * Port of `cmdFrontmatterMerge` from frontmatter.cjs lines 344-356.
 *
 * @param args - `file --data <json>` (gsd-tools) or `[file, jsonString]` (SDK)
 * @param projectDir - Project root directory
 * @returns QueryResult with { merged: true, fields: [...] }
 */
export const frontmatterMerge: QueryHandler = async (args, projectDir) => {
  const filePath = args[0];
  const dataIdx = args.indexOf('--data');
  const jsonString = dataIdx !== -1 ? args[dataIdx + 1] : args[1];

  if (!filePath || !jsonString) {
    throw new GSDError('file and data required', ErrorClassification.Validation);
  }

  // Path traversal guard: reject null bytes (consistent with frontmatterSet)
  if (filePath.includes('\0')) {
    throw new GSDError('file path contains null bytes', ErrorClassification.Validation);
  }

  let fullPath: string;
  try {
    fullPath = await resolvePathUnderProject(projectDir, filePath);
  } catch (err) {
    if (err instanceof GSDError) {
      return { data: { error: err.message, path: filePath } };
    }
    throw err;
  }

  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return { data: { error: 'File not found', path: filePath } };
  }

  let mergeData: Record<string, unknown>;
  try {
    mergeData = JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    throw new GSDError('Invalid JSON for merge data', ErrorClassification.Validation);
  }

  const fm = extractFrontmatter(content);
  Object.assign(fm, mergeData);
  const newContent = spliceFrontmatter(content, fm);
  await writeFile(fullPath, normalizeMd(newContent), 'utf-8');

  return { data: { merged: true, fields: Object.keys(mergeData) } };
};

// ─── frontmatterValidate ───────────────────────────────────────────────────

/**
 * Query handler for frontmatter.validate command.
 *
 * Reads a file and checks its frontmatter against a known schema.
 * Port of `cmdFrontmatterValidate` from frontmatter.cjs lines 358-369.
 *
 * @param args - args[0]: file path, args[1]: '--schema', args[2]: schema name
 * @param projectDir - Project root directory
 * @returns QueryResult with { valid, missing, present, schema }
 */
export const frontmatterValidate: QueryHandler = async (args, projectDir) => {
  const filePath = args[0];

  // Parse --schema flag from args
  let schemaName: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--schema' && args[i + 1]) {
      schemaName = args[i + 1];
      break;
    }
  }

  if (!filePath || !schemaName) {
    throw new GSDError('file and schema required', ErrorClassification.Validation);
  }

  // Path traversal guard: reject null bytes (consistent with frontmatterSet)
  if (filePath.includes('\0')) {
    throw new GSDError('file path contains null bytes', ErrorClassification.Validation);
  }

  const schema = FRONTMATTER_SCHEMAS[schemaName];
  if (!schema) {
    throw new GSDError(
      `Unknown schema: ${schemaName}. Available: ${Object.keys(FRONTMATTER_SCHEMAS).join(', ')}`,
      ErrorClassification.Validation
    );
  }

  let fullPath: string;
  try {
    fullPath = await resolvePathUnderProject(projectDir, filePath);
  } catch (err) {
    if (err instanceof GSDError) {
      return { data: { error: err.message, path: filePath } };
    }
    throw err;
  }

  let content: string;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return { data: { error: 'File not found', path: filePath } };
  }

  const fm = extractFrontmatter(content);
  const missing = schema.required.filter(f => fm[f] === undefined);
  const present = schema.required.filter(f => fm[f] !== undefined);

  return { data: { valid: missing.length === 0, missing, present, schema: schemaName } };
};
