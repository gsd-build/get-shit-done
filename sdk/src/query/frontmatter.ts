/**
 * Frontmatter parser and query handler.
 *
 * Ported from get-shit-done/bin/lib/frontmatter.cjs and state.cjs.
 * Provides YAML frontmatter extraction from .planning/ artifacts.
 *
 * @example
 * ```typescript
 * import { extractFrontmatter, frontmatterGet } from './frontmatter.js';
 *
 * const fm = extractFrontmatter('---\nphase: 10\nplan: 01\n---\nbody');
 * // { phase: '10', plan: '01' }
 *
 * const result = await frontmatterGet(['STATE.md'], '/project');
 * // { data: { gsd_state_version: '1.0', milestone: 'v3.0', ... } }
 * ```
 */

import { readFile } from 'node:fs/promises';
import { GSDError, ErrorClassification } from '../errors.js';
import type { QueryHandler } from './utils.js';
import { escapeRegex, resolvePathUnderProject } from './helpers.js';

// ─── splitInlineArray ───────────────────────────────────────────────────────

/**
 * Quote-aware CSV splitting for inline YAML arrays.
 *
 * Handles both single and double quotes, preserving commas inside quotes.
 *
 * @param body - The content inside brackets, e.g. 'a, "b, c", d'
 * @returns Array of trimmed values
 */
export function splitInlineArray(body: string): string[] {
  const items: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ',') {
      const trimmed = current.trim();
      if (trimmed) items.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) items.push(trimmed);
  return items;
}

// ─── parseFrontmatterYamlLines ───────────────────────────────────────────────

/**
 * Parse YAML frontmatter body (between `---` fences) using the GSD stack parser.
 * Shared by {@link extractFrontmatterLeading} and {@link extractFrontmatter}.
 */
function parseFrontmatterYamlLines(yaml: string): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};
  const lines = yaml.split(/\r?\n/);

  // Stack to track nested objects: [{obj, key, indent}]
  const stack: Array<{ obj: Record<string, unknown> | unknown[]; key: string | null; indent: number }> = [
    { obj: frontmatter, key: null, indent: -1 },
  ];

  for (const line of lines) {
    // Skip empty lines
    if (line.trim() === '') continue;

    // Calculate indentation (number of leading spaces)
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // Pop stack back to appropriate level
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];

    // Check for key: value pattern
    const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();

      if (value === '' || value === '[') {
        // Key with no value or opening bracket -- could be nested object or array
        (current.obj as Record<string, unknown>)[key] = value === '[' ? [] : {};
        current.key = null;
        // Push new context for potential nested content
        stack.push({ obj: (current.obj as Record<string, unknown>)[key] as Record<string, unknown>, key: null, indent });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array: key: [a, b, c]
        (current.obj as Record<string, unknown>)[key] = splitInlineArray(value.slice(1, -1));
        current.key = null;
      } else {
        // Simple key: value -- strip surrounding quotes
        (current.obj as Record<string, unknown>)[key] = value.replace(/^["']|["']$/g, '');
        current.key = null;
      }
    } else if (line.trim().startsWith('- ')) {
      // Array item
      const afterDash = line.trim().slice(2).trim();
      let itemValue: unknown = afterDash.replace(/^["']|["']$/g, '');
      let isObjItem = false;

      // Extract key: value within the array item if present
      const kvMatch = afterDash.match(/^([a-zA-Z0-9_-]+):\s*(.*)/);
      if (kvMatch) {
        isObjItem = true;
        const k = kvMatch[1];
        const v = kvMatch[2].trim().replace(/^["']|["']$/g, '');
        itemValue = { [k]: v };
      }

      // If current context is an empty object, convert to array
      if (typeof current.obj === 'object' && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
        // Find the key in parent that points to this object and convert it
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent && !Array.isArray(parent.obj)) {
          for (const k of Object.keys(parent.obj as Record<string, unknown>)) {
            if ((parent.obj as Record<string, unknown>)[k] === current.obj) {
              (parent.obj as Record<string, unknown>)[k] = [itemValue];
              current.obj = (parent.obj as Record<string, unknown>)[k] as unknown[];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(itemValue);
      }

      // Push object context onto stack so subsequent indented properties map to this object
      if (isObjItem && Array.isArray(current.obj)) {
        stack.push({ obj: itemValue as Record<string, unknown>, key: null, indent });
      }
    }
  }

  return frontmatter;
}

// ─── extractFrontmatterLeading ──────────────────────────────────────────────

/**
 * First leading frontmatter block only — parity with `get-shit-done/bin/lib/frontmatter.cjs`
 * `extractFrontmatter` (used by `summary-extract` and `history-digest` in gsd-tools.cjs).
 */
export function extractFrontmatterLeading(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return {};
  return parseFrontmatterYamlLines(match[1]);
}

// ─── extractFrontmatter ─────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from file content.
 *
 * Full stack-based parser supporting:
 * - Simple key: value pairs
 * - Nested objects via indentation
 * - Inline arrays: key: [a, b, c]
 * - Dash arrays with auto-conversion from empty objects
 * - CRLF line endings
 * - Quoted value stripping
 *
 * Anchored at the start of the file — only the leading `---...---` block is
 * considered canonical frontmatter. Body `---` separators and embedded YAML
 * examples inside fenced code blocks are never picked up.
 *
 * @param content - File content potentially containing frontmatter
 * @returns Parsed frontmatter as a record, or empty object if none found
 */
export function extractFrontmatter(content: string): Record<string, unknown> {
  return extractFrontmatterLeading(content);
}

// ─── stripFrontmatter ───────────────────────────────────────────────────────

/**
 * Strip all frontmatter blocks from the start of content.
 *
 * Handles CRLF line endings and multiple stacked blocks (corruption recovery).
 * Greedy: keeps stripping ---...--- blocks separated by optional whitespace.
 *
 * @param content - File content with potential frontmatter
 * @returns Content with frontmatter removed
 */
export function stripFrontmatter(content: string): string {
  let result = content;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const stripped = result.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\s*/, '');
    if (stripped === result) break;
    result = stripped;
  }
  return result;
}

// ─── parseMustHavesBlock ────────────────────────────────────────────────────

/**
 * Result of parsing a must_haves block from frontmatter.
 */
export interface MustHavesBlockResult {
  items: unknown[];
  warnings: string[];
}

/**
 * Parse a named block from must_haves in raw frontmatter YAML.
 *
 * Port of `parseMustHavesBlock` from `get-shit-done/bin/lib/frontmatter.cjs` lines 195-301.
 * Handles 3-level nesting: `must_haves > blockName > [{key: value, ...}]`.
 * Supports simple string items, structured objects with key-value pairs,
 * and nested arrays within items.
 *
 * @param content - File content with frontmatter
 * @param blockName - Block name under must_haves (e.g. 'artifacts', 'key_links', 'truths')
 * @returns Structured result with items array and warnings
 */
export function parseMustHavesBlock(content: string, blockName: string): MustHavesBlockResult {
  const warnings: string[] = [];

  // Extract raw YAML from first ---\n...\n--- block
  const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!fmMatch) return { items: [], warnings };

  const yaml = fmMatch[1];

  // Find must_haves: at its indentation level
  const mustHavesMatch = yaml.match(/^(\s*)must_haves:\s*$/m);
  if (!mustHavesMatch) return { items: [], warnings };
  const mustHavesIndent = mustHavesMatch[1].length;

  // Find the block (e.g., "artifacts:", "key_links:") under must_haves
  const blockPattern = new RegExp(`^(\\s+)${escapeRegex(blockName)}:\\s*$`, 'm');
  const blockMatch = yaml.match(blockPattern);
  if (!blockMatch) return { items: [], warnings };

  const blockIndent = blockMatch[1].length;
  // The block must be nested under must_haves (more indented)
  if (blockIndent <= mustHavesIndent) return { items: [], warnings };

  // Find where the block starts in the yaml string
  const blockStart = yaml.indexOf(blockMatch[0]);
  if (blockStart === -1) return { items: [], warnings };

  const afterBlock = yaml.slice(blockStart);
  const blockLines = afterBlock.split(/\r?\n/).slice(1); // skip the header line

  // List items are indented one level deeper than blockIndent
  // Continuation KVs are indented one level deeper than list items
  const items: unknown[] = [];
  let current: Record<string, unknown> | string | null = null;
  let listItemIndent = -1; // detected from first "- " line

  for (const line of blockLines) {
    // Skip empty lines
    if (line.trim() === '') continue;
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    // Stop at same or lower indent level than the block header
    if (indent <= blockIndent && line.trim() !== '') break;

    const trimmed = line.trim();

    if (trimmed.startsWith('- ')) {
      // Detect list item indent from the first occurrence
      if (listItemIndent === -1) listItemIndent = indent;

      // Only treat as a top-level list item if at the expected indent
      if (indent === listItemIndent) {
        if (current !== null) items.push(current);
        const afterDash = trimmed.slice(2);
        // Check if it's a simple string item (no colon means not a key-value)
        if (!afterDash.includes(':')) {
          current = afterDash.replace(/^["']|["']$/g, '');
        } else {
          // Key-value on same line as dash: "- path: value"
          const kvMatch = afterDash.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
          if (kvMatch) {
            current = {} as Record<string, unknown>;
            current[kvMatch[1]] = kvMatch[2];
          } else {
            current = {} as Record<string, unknown>;
          }
        }
        continue;
      }
    }

    if (current !== null && typeof current === 'object' && indent > listItemIndent) {
      // Continuation key-value or nested array item
      if (trimmed.startsWith('- ')) {
        // Array item under a key
        const arrVal = trimmed.slice(2).replace(/^["']|["']$/g, '');
        const keys = Object.keys(current);
        const lastKey = keys[keys.length - 1];
        if (lastKey && !Array.isArray(current[lastKey])) {
          current[lastKey] = current[lastKey] ? [current[lastKey]] : [];
        }
        if (lastKey) (current[lastKey] as unknown[]).push(arrVal);
      } else {
        const kvMatch = trimmed.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
        if (kvMatch) {
          const val = kvMatch[2];
          // Try to parse as number
          current[kvMatch[1]] = /^\d+$/.test(val) ? parseInt(val, 10) : val;
        }
      }
    }
  }
  if (current !== null) items.push(current);

  // Diagnostic warning when block has content lines but parsed 0 items
  if (items.length === 0 && blockLines.length > 0) {
    const nonEmptyLines = blockLines.filter(l => l.trim() !== '').length;
    if (nonEmptyLines > 0) {
      warnings.push(
        `must_haves.${blockName} block has ${nonEmptyLines} content lines but parsed 0 items. ` +
        `Possible YAML formatting issue.`
      );
    }
  }

  return { items, warnings };
}

// ─── frontmatterGet ─────────────────────────────────────────────────────────

/**
 * Query handler for frontmatter.get command.
 *
 * Reads a file, extracts frontmatter, and optionally returns a single field.
 * Rejects null bytes in path (security: path traversal guard).
 *
 * @param args - args[0]: file path, args[1]: optional field name
 * @param projectDir - Project root directory
 * @returns QueryResult with parsed frontmatter or single field value
 */
export const frontmatterGet: QueryHandler = async (args, projectDir) => {
  const filePath = args[0];
  if (!filePath) {
    throw new GSDError('file path required', ErrorClassification.Validation);
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
  const field = args[1];

  if (field) {
    const value = fm[field];
    if (value === undefined) {
      return { data: { error: 'Field not found', field } };
    }
    return { data: { [field]: value } };
  }

  return { data: fm };
};
