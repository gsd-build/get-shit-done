/**
 * YAML frontmatter parsing and serialization
 * Uses simple regex-based approach (no external dependencies)
 */

import type { CommandFrontmatter, AgentFrontmatter } from './types.js';

interface ParseResult<T> {
  frontmatter: T | null;
  body: string;
}

/**
 * Parse YAML frontmatter from markdown content
 * Returns null frontmatter if not found or invalid
 */
export function parseFrontmatter<T = Record<string, unknown>>(content: string): ParseResult<T> {
  // Match frontmatter between --- delimiters
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!match) {
    return { frontmatter: null, body: content };
  }

  const yamlContent = match[1];
  const body = match[2];

  try {
    const frontmatter = parseSimpleYaml(yamlContent) as T;
    return { frontmatter, body };
  } catch {
    return { frontmatter: null, body: content };
  }
}

/**
 * Simple YAML parser for frontmatter
 * Handles: strings, numbers, booleans, arrays, nested objects (1 level)
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');

  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Check for array item
    const arrayMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (arrayMatch && currentKey && currentArray !== null) {
      const value = arrayMatch[2].trim();
      currentArray.push(parseYamlValue(value) as string);
      continue;
    }

    // Check for key-value pair
    const kvMatch = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (kvMatch) {
      const indent = kvMatch[1].length;
      const key = kvMatch[2].trim();
      const rawValue = kvMatch[3].trim();

      // Save previous array if exists
      if (currentKey && currentArray !== null) {
        result[currentKey] = currentArray;
        currentArray = null;
      }

      // Handle different cases
      if (rawValue === '' || rawValue === '|' || rawValue === '>') {
        // Could be start of array or multiline string
        currentKey = key;
        currentArray = [];
      } else if (indent === 0) {
        // Top-level key
        currentKey = key;
        currentArray = null;
        result[key] = parseYamlValue(rawValue);
      }
    }
  }

  // Don't forget the last array
  if (currentKey && currentArray !== null && currentArray.length > 0) {
    result[currentKey] = currentArray;
  }

  return result;
}

/**
 * Parse a single YAML value
 */
function parseYamlValue(value: string): string | number | boolean {
  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value);
  }

  return value;
}

/**
 * Parse command frontmatter specifically
 */
export function parseCommandFrontmatter(content: string): CommandFrontmatter | null {
  const { frontmatter } = parseFrontmatter<CommandFrontmatter>(content);
  if (!frontmatter) return null;

  // Validate required fields
  if (!frontmatter.name || !frontmatter.description) {
    return null;
  }

  return frontmatter;
}

/**
 * Parse agent frontmatter specifically
 */
export function parseAgentFrontmatter(content: string): AgentFrontmatter | null {
  const { frontmatter } = parseFrontmatter<AgentFrontmatter>(content);
  if (!frontmatter) return null;

  // Validate required fields
  if (!frontmatter.name || !frontmatter.description) {
    return null;
  }

  return frontmatter;
}

/**
 * Parse plan frontmatter (flexible structure)
 */
export function parsePlanFrontmatter(content: string): Record<string, unknown> | null {
  const { frontmatter } = parseFrontmatter(content);
  return frontmatter;
}

/**
 * Serialize object to YAML frontmatter string
 */
export function serializeFrontmatter(data: Record<string, unknown>): string {
  const lines: string[] = ['---'];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${serializeYamlValue(item)}`);
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (subValue !== undefined && subValue !== null) {
          lines.push(`  ${subKey}: ${serializeYamlValue(subValue)}`);
        }
      }
    } else {
      lines.push(`${key}: ${serializeYamlValue(value)}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Serialize a single value for YAML
 */
function serializeYamlValue(value: unknown): string {
  if (typeof value === 'string') {
    // Quote strings that need it
    if (value.includes(':') || value.includes('#') || value.includes('\n') ||
        value.startsWith(' ') || value.endsWith(' ')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return String(value);
}

/**
 * Extract body without frontmatter
 */
export function extractBody(content: string): string {
  const { body } = parseFrontmatter(content);
  return body;
}

/**
 * Check if content has frontmatter
 */
export function hasFrontmatter(content: string): boolean {
  return content.startsWith('---\n') || content.startsWith('---\r\n');
}
