/**
 * plan-parser.ts — Parse GSD-1 PLAN.md files into structured data.
 *
 * Extracts YAML frontmatter, XML task bodies, and markdown sections
 * (<objective>, <execution_context>, <context>) from plan files.
 *
 * Ported from get-shit-done/bin/lib/frontmatter.cjs with TypeScript types.
 */

import { readFile } from 'node:fs/promises';
import type {
  PlanFrontmatter,
  PlanTask,
  ParsedPlan,
  MustHaves,
  MustHaveArtifact,
  MustHaveKeyLink,
} from './types.js';

// ─── YAML frontmatter extraction ─────────────────────────────────────────────

/**
 * Extract frontmatter from a PLAN.md content string.
 *
 * Uses a stack-based parser that handles nested objects, inline arrays,
 * multi-line arrays, and boolean/numeric coercion. Ported from the CJS
 * reference implementation with the same edge-case coverage.
 */
export function extractFrontmatter(content: string): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};

  // Find ALL frontmatter blocks — if multiple exist (corruption), use the last one
  const allBlocks = [...content.matchAll(/(?:^|\n)\s*---\r?\n([\s\S]+?)\r?\n---/g)];
  const match = allBlocks.length > 0 ? allBlocks[allBlocks.length - 1] : null;
  if (!match) return frontmatter;

  const yaml = match[1];
  const lines = yaml.split(/\r?\n/);

  // Stack tracks nested objects: [{obj, key, indent}]
  const stack: Array<{ obj: Record<string, unknown> | unknown[]; key: string | null; indent: number }> = [
    { obj: frontmatter, key: null, indent: -1 },
  ];

  for (const line of lines) {
    if (line.trim() === '') continue;

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // Pop stack back to appropriate level
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];
    const currentObj = current.obj as Record<string, unknown>;

    // Key: value pattern
    const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();

      if (value === '' || value === '[') {
        // Key with no value or opening bracket — nested object or array (TBD)
        currentObj[key] = value === '[' ? [] : {};
        current.key = null;
        stack.push({ obj: currentObj[key] as Record<string, unknown>, key: null, indent });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array: key: [a, b, c]
        currentObj[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
        current.key = null;
      } else {
        // Simple key: value — coerce booleans and numbers
        const cleanValue = value.replace(/^["']|["']$/g, '');
        currentObj[key] = coerceValue(cleanValue);
        current.key = null;
      }
    } else if (line.trim().startsWith('- ')) {
      // Array item — could be a plain string or "- key: value" (start of mapping item)
      const afterDash = line.trim().slice(2);
      const dashKvMatch = afterDash.match(/^([a-zA-Z0-9_-]+):\s*(.*)/);

      // Determine the value to push
      let itemToPush: unknown;
      if (dashKvMatch) {
        // "- key: value" → start of a mapping item (object in array)
        const obj: Record<string, unknown> = {};
        const val = dashKvMatch[2].trim().replace(/^["']|["']$/g, '');
        obj[dashKvMatch[1]] = coerceValue(val);
        itemToPush = obj;
      } else {
        const itemValue = afterDash.replace(/^["']|["']$/g, '');
        itemToPush = coerceValue(itemValue);
      }

      // If current context is an empty object, convert to array
      if (
        typeof current.obj === 'object' &&
        !Array.isArray(current.obj) &&
        Object.keys(current.obj).length === 0
      ) {
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent && typeof parent.obj === 'object' && !Array.isArray(parent.obj)) {
          const parentObj = parent.obj as Record<string, unknown>;
          for (const k of Object.keys(parentObj)) {
            if (parentObj[k] === current.obj) {
              parentObj[k] = [itemToPush];
              current.obj = parentObj[k] as unknown[];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(itemToPush);
      }

      // If we pushed a mapping object, push it onto the stack so subsequent
      // indented key-value lines populate the same object
      if (dashKvMatch && typeof itemToPush === 'object') {
        stack.push({
          obj: itemToPush as Record<string, unknown>,
          key: null,
          indent, // use dash indent so sub-keys (more indented) populate this object
        });
      }
    }
  }

  return frontmatter;
}

/**
 * Coerce string values to appropriate JS types.
 * Preserves leading-zero strings (e.g., "01") as strings.
 */
function coerceValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  // Only coerce numbers without leading zeros (01, 007 stay as strings)
  if (/^[1-9]\d*$/.test(value) || value === '0') return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value) && !value.startsWith('0')) return parseFloat(value);
  return value;
}

// ─── must_haves block parsing ────────────────────────────────────────────────

/**
 * Parse the must_haves nested structure from raw frontmatter.
 *
 * The must_haves field has three sub-keys: truths (string[]),
 * artifacts (object[]), and key_links (object[]).
 * The stack-based parser above produces these as nested objects
 * which need further normalization.
 */
function parseMustHaves(raw: unknown): MustHaves {
  const defaults: MustHaves = { truths: [], artifacts: [], key_links: [] };
  if (!raw || typeof raw !== 'object') return defaults;

  const obj = raw as Record<string, unknown>;

  return {
    truths: normalizeStringArray(obj.truths),
    artifacts: normalizeArtifacts(obj.artifacts),
    key_links: normalizeKeyLinks(obj.key_links),
  };
}

function normalizeStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

function normalizeArtifacts(val: unknown): MustHaveArtifact[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => {
      const obj = item as Record<string, unknown>;
      return {
        path: String(obj.path ?? ''),
        provides: String(obj.provides ?? ''),
        ...(obj.min_lines !== undefined ? { min_lines: Number(obj.min_lines) } : {}),
        ...(obj.exports !== undefined ? { exports: normalizeStringArray(obj.exports) } : {}),
        ...(obj.contains !== undefined ? { contains: String(obj.contains) } : {}),
      };
    });
}

function normalizeKeyLinks(val: unknown): MustHaveKeyLink[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => {
      const obj = item as Record<string, unknown>;
      return {
        from: String(obj.from ?? ''),
        to: String(obj.to ?? ''),
        via: String(obj.via ?? ''),
        ...(obj.pattern !== undefined ? { pattern: String(obj.pattern) } : {}),
      };
    });
}

// ─── XML task extraction ─────────────────────────────────────────────────────

/**
 * Extract inner text of an XML element from a task body.
 * Handles multiline content and trims whitespace.
 */
function extractElement(taskBody: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = taskBody.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extract the type attribute from a <task> opening tag.
 */
function extractTaskType(taskTag: string): string {
  const match = taskTag.match(/type\s*=\s*["']([^"']+)["']/);
  return match ? match[1] : 'auto';
}

/**
 * Parse XML task blocks from the <tasks> section.
 *
 * Uses a regex to match <task ...>...</task> blocks, then extracts
 * inner elements (name, files, read_first, action, verify,
 * acceptance_criteria, done).
 *
 * Handles:
 * - Multiline <action> blocks (including code snippets with angle brackets)
 * - Optional elements (missing elements → empty string/array)
 * - Both auto and checkpoint task types
 */
export function parseTasks(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];

  // Extract the <tasks>...</tasks> section first
  const tasksSection = content.match(/<tasks>([\s\S]*?)<\/tasks>/i);
  const taskContent = tasksSection ? tasksSection[1] : content;

  // Match individual task blocks — use a greedy-enough approach
  // that handles nested angle brackets in action blocks
  const taskRegex = /<task\b([^>]*)>([\s\S]*?)<\/task>/gi;
  let taskMatch: RegExpExecArray | null;

  while ((taskMatch = taskRegex.exec(taskContent)) !== null) {
    const attrs = taskMatch[1];
    const body = taskMatch[2];

    const type = extractTaskType(attrs);
    const name = extractElement(body, 'name');
    const filesStr = extractElement(body, 'files');
    const readFirstStr = extractElement(body, 'read_first');
    const action = extractElement(body, 'action');
    const verify = extractElement(body, 'verify');
    const done = extractElement(body, 'done');

    // Parse acceptance_criteria — can be a block with "- " list items
    const acRaw = extractElement(body, 'acceptance_criteria');
    const acceptance_criteria = acRaw
      ? acRaw
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('- '))
          .map((line) => line.slice(2).trim())
      : [];

    // Parse file lists (comma-separated)
    const files = filesStr
      ? filesStr
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
      : [];
    const read_first = readFirstStr
      ? readFirstStr
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean)
      : [];

    tasks.push({
      type,
      name,
      files,
      read_first,
      action,
      verify,
      acceptance_criteria,
      done,
    });
  }

  return tasks;
}

// ─── Section extraction ──────────────────────────────────────────────────────

/**
 * Extract content of a named XML section (e.g., <objective>...</objective>).
 */
function extractSection(content: string, sectionName: string): string {
  const regex = new RegExp(`<${sectionName}>([\\s\\S]*?)</${sectionName}>`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extract context references from the <context> block.
 * Returns an array of file paths (lines starting with @).
 */
function extractContextRefs(content: string): string[] {
  const contextBlock = extractSection(content, 'context');
  if (!contextBlock) return [];

  return contextBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('@'))
    .map((line) => line.slice(1).trim());
}

/**
 * Extract execution_context references.
 * Returns an array of file paths (lines starting with @).
 */
function extractExecutionContext(content: string): string[] {
  const block = extractSection(content, 'execution_context');
  if (!block) return [];

  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('@'))
    .map((line) => line.slice(1).trim());
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a GSD-1 PLAN.md content string into a structured ParsedPlan.
 *
 * Extracts:
 * - YAML frontmatter (phase, wave, depends_on, must_haves, etc.)
 * - <objective> section
 * - <execution_context> references
 * - <context> file references
 * - <task> blocks with all inner elements
 *
 * Handles edge cases:
 * - Empty input → empty frontmatter, no tasks
 * - Missing frontmatter → empty object with defaults
 * - Malformed XML → partial extraction, no crash
 */
export function parsePlan(content: string): ParsedPlan {
  if (!content || typeof content !== 'string') {
    return {
      frontmatter: createDefaultFrontmatter(),
      objective: '',
      execution_context: [],
      context_refs: [],
      tasks: [],
      raw: content ?? '',
    };
  }

  const rawFrontmatter = extractFrontmatter(content);

  // Build typed frontmatter with defaults
  const frontmatter: PlanFrontmatter = {
    phase: String(rawFrontmatter.phase ?? ''),
    plan: String(rawFrontmatter.plan ?? ''),
    type: String(rawFrontmatter.type ?? 'execute'),
    wave: Number(rawFrontmatter.wave ?? 1),
    depends_on: normalizeStringArray(rawFrontmatter.depends_on),
    files_modified: normalizeStringArray(rawFrontmatter.files_modified),
    autonomous: rawFrontmatter.autonomous !== false,
    requirements: normalizeStringArray(rawFrontmatter.requirements),
    must_haves: parseMustHaves(rawFrontmatter.must_haves),
  };

  // Preserve any extra frontmatter keys
  for (const [key, value] of Object.entries(rawFrontmatter)) {
    if (!(key in frontmatter)) {
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter,
    objective: extractSection(content, 'objective'),
    execution_context: extractExecutionContext(content),
    context_refs: extractContextRefs(content),
    tasks: parseTasks(content),
    raw: content,
  };
}

function createDefaultFrontmatter(): PlanFrontmatter {
  return {
    phase: '',
    plan: '',
    type: 'execute',
    wave: 1,
    depends_on: [],
    files_modified: [],
    autonomous: true,
    requirements: [],
    must_haves: { truths: [], artifacts: [], key_links: [] },
  };
}

/**
 * Convenience wrapper — reads a PLAN.md file from disk and parses it.
 */
export async function parsePlanFile(filePath: string): Promise<ParsedPlan> {
  const content = await readFile(filePath, 'utf-8');
  return parsePlan(content);
}
