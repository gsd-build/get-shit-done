/**
 * Shared query helpers — cross-cutting utility functions used across query modules.
 *
 * Ported from get-shit-done/bin/lib/core.cjs and state.cjs.
 * Provides phase name normalization, path handling, regex escaping,
 * and STATE.md field extraction.
 *
 * @example
 * ```typescript
 * import { normalizePhaseName, planningPaths } from './helpers.js';
 *
 * normalizePhaseName('9');     // '09'
 * normalizePhaseName('CK-01'); // '01'
 *
 * const paths = planningPaths('/project');
 * // { planning: '/project/.planning', state: '/project/.planning/STATE.md', ... }
 * ```
 */

import { join, dirname, relative, resolve, isAbsolute, normalize, parse as parsePath, sep as pathSep } from 'node:path';
import { realpath } from 'node:fs/promises';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { GSDError, ErrorClassification } from '../errors.js';
import { relPlanningPath } from '../workstream-utils.js';

// ─── Runtime-aware agents directory resolution ─────────────────────────────

/**
 * Supported GSD runtimes. Kept in sync with `bin/install.js:getGlobalDir()`.
 */
export const SUPPORTED_RUNTIMES = [
  'claude', 'opencode', 'kilo', 'gemini', 'codex', 'copilot', 'antigravity',
  'cursor', 'windsurf', 'augment', 'trae', 'qwen', 'codebuddy', 'cline',
] as const;

export type Runtime = (typeof SUPPORTED_RUNTIMES)[number];

function expandTilde(p: string): string {
  return p.startsWith('~/') || p === '~' ? join(homedir(), p.slice(1)) : p;
}

/**
 * Resolve the per-runtime config directory, mirroring
 * `bin/install.js:getGlobalDir()`. Agents live at `<configDir>/agents`.
 */
export function getRuntimeConfigDir(runtime: Runtime): string {
  switch (runtime) {
    case 'claude':
      return process.env.CLAUDE_CONFIG_DIR
        ? expandTilde(process.env.CLAUDE_CONFIG_DIR)
        : join(homedir(), '.claude');
    case 'opencode':
      if (process.env.OPENCODE_CONFIG_DIR) return expandTilde(process.env.OPENCODE_CONFIG_DIR);
      if (process.env.OPENCODE_CONFIG) return dirname(expandTilde(process.env.OPENCODE_CONFIG));
      if (process.env.XDG_CONFIG_HOME) return join(expandTilde(process.env.XDG_CONFIG_HOME), 'opencode');
      return join(homedir(), '.config', 'opencode');
    case 'kilo':
      if (process.env.KILO_CONFIG_DIR) return expandTilde(process.env.KILO_CONFIG_DIR);
      if (process.env.KILO_CONFIG) return dirname(expandTilde(process.env.KILO_CONFIG));
      if (process.env.XDG_CONFIG_HOME) return join(expandTilde(process.env.XDG_CONFIG_HOME), 'kilo');
      return join(homedir(), '.config', 'kilo');
    case 'gemini':
      return process.env.GEMINI_CONFIG_DIR ? expandTilde(process.env.GEMINI_CONFIG_DIR) : join(homedir(), '.gemini');
    case 'codex':
      return process.env.CODEX_HOME ? expandTilde(process.env.CODEX_HOME) : join(homedir(), '.codex');
    case 'copilot':
      return process.env.COPILOT_CONFIG_DIR ? expandTilde(process.env.COPILOT_CONFIG_DIR) : join(homedir(), '.copilot');
    case 'antigravity':
      return process.env.ANTIGRAVITY_CONFIG_DIR ? expandTilde(process.env.ANTIGRAVITY_CONFIG_DIR) : join(homedir(), '.gemini', 'antigravity');
    case 'cursor':
      return process.env.CURSOR_CONFIG_DIR ? expandTilde(process.env.CURSOR_CONFIG_DIR) : join(homedir(), '.cursor');
    case 'windsurf':
      return process.env.WINDSURF_CONFIG_DIR ? expandTilde(process.env.WINDSURF_CONFIG_DIR) : join(homedir(), '.codeium', 'windsurf');
    case 'augment':
      return process.env.AUGMENT_CONFIG_DIR ? expandTilde(process.env.AUGMENT_CONFIG_DIR) : join(homedir(), '.augment');
    case 'trae':
      return process.env.TRAE_CONFIG_DIR ? expandTilde(process.env.TRAE_CONFIG_DIR) : join(homedir(), '.trae');
    case 'qwen':
      return process.env.QWEN_CONFIG_DIR ? expandTilde(process.env.QWEN_CONFIG_DIR) : join(homedir(), '.qwen');
    case 'codebuddy':
      return process.env.CODEBUDDY_CONFIG_DIR ? expandTilde(process.env.CODEBUDDY_CONFIG_DIR) : join(homedir(), '.codebuddy');
    case 'cline':
      return process.env.CLINE_CONFIG_DIR ? expandTilde(process.env.CLINE_CONFIG_DIR) : join(homedir(), '.cline');
  }
}

/**
 * Detect the invoking runtime using issue #2402 precedence:
 *   1. `GSD_RUNTIME` env var
 *   2. `config.runtime` field (from `.planning/config.json` when loaded)
 *   3. Fallback to `'claude'`
 *
 * Unknown values fall through to the next tier rather than throwing, so
 * stale env values don't hard-block workflows.
 */
export function detectRuntime(config?: { runtime?: unknown }): Runtime {
  const envValue = process.env.GSD_RUNTIME;
  if (envValue && (SUPPORTED_RUNTIMES as readonly string[]).includes(envValue)) {
    return envValue as Runtime;
  }
  const configValue = config?.runtime;
  if (typeof configValue === 'string' && (SUPPORTED_RUNTIMES as readonly string[]).includes(configValue)) {
    return configValue as Runtime;
  }
  return 'claude';
}

/**
 * Resolve the GSD agents directory for a given runtime.
 *
 * Precedence:
 *   1. `GSD_AGENTS_DIR` — explicit SDK override (wins over runtime selection)
 *   2. `<getRuntimeConfigDir(runtime)>/agents` — installer-parity default
 *
 * Defaults to Claude when no runtime is passed, matching prior behavior
 * (see `init-runner.ts`, which is Claude-only by design).
 */
export function resolveAgentsDir(runtime: Runtime = 'claude'): string {
  if (process.env.GSD_AGENTS_DIR) return process.env.GSD_AGENTS_DIR;
  return join(getRuntimeConfigDir(runtime), 'agents');
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** Paths to common .planning files. */
export interface PlanningPaths {
  planning: string;
  state: string;
  roadmap: string;
  project: string;
  config: string;
  phases: string;
  requirements: string;
}

// ─── escapeRegex ────────────────────────────────────────────────────────────

/**
 * Escape regex special characters in a string.
 *
 * @param value - String to escape
 * @returns String with regex special characters escaped
 */
export function escapeRegex(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── normalizePhaseName ─────────────────────────────────────────────────────

/**
 * Normalize a phase identifier to a canonical form.
 *
 * Strips optional project code prefix (e.g., 'CK-01' -> '01'),
 * pads numeric part to 2 digits, preserves letter suffix and decimal parts.
 *
 * @param phase - Phase identifier string
 * @returns Normalized phase name
 */
export function normalizePhaseName(phase: string): string {
  const str = String(phase);
  // Strip optional project_code prefix (e.g., 'CK-01' -> '01')
  const stripped = str.replace(/^[A-Z]{1,6}-(?=\d)/, '');
  // Standard numeric phases: 1, 01, 12A, 12.1
  const match = stripped.match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  if (match) {
    const padded = match[1].padStart(2, '0');
    const letter = match[2] ? match[2].toUpperCase() : '';
    const decimal = match[3] || '';
    return padded + letter + decimal;
  }
  // Custom phase IDs (e.g. PROJ-42, AUTH-101): return as-is
  return str;
}

// ─── comparePhaseNum ────────────────────────────────────────────────────────

/**
 * Compare two phase directory names for sorting.
 *
 * Handles numeric, letter-suffixed, and decimal phases.
 * Falls back to string comparison for custom IDs.
 *
 * @param a - First phase directory name
 * @param b - Second phase directory name
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function comparePhaseNum(a: string, b: string): number {
  // Strip optional project_code prefix before comparing
  const sa = String(a).replace(/^[A-Z]{1,6}-/, '');
  const sb = String(b).replace(/^[A-Z]{1,6}-/, '');
  const pa = sa.match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  const pb = sb.match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  // If either is non-numeric (custom ID), fall back to string comparison
  if (!pa || !pb) return String(a).localeCompare(String(b));
  const intDiff = parseInt(pa[1], 10) - parseInt(pb[1], 10);
  if (intDiff !== 0) return intDiff;
  // No letter sorts before letter: 12 < 12A < 12B
  const la = (pa[2] || '').toUpperCase();
  const lb = (pb[2] || '').toUpperCase();
  if (la !== lb) {
    if (!la) return -1;
    if (!lb) return 1;
    return la < lb ? -1 : 1;
  }
  // Segment-by-segment decimal comparison: 12A < 12A.1 < 12A.1.2 < 12A.2
  const aDecParts = pa[3] ? pa[3].slice(1).split('.').map(p => parseInt(p, 10)) : [];
  const bDecParts = pb[3] ? pb[3].slice(1).split('.').map(p => parseInt(p, 10)) : [];
  const maxLen = Math.max(aDecParts.length, bDecParts.length);
  if (aDecParts.length === 0 && bDecParts.length > 0) return -1;
  if (bDecParts.length === 0 && aDecParts.length > 0) return 1;
  for (let i = 0; i < maxLen; i++) {
    const av = Number.isFinite(aDecParts[i]) ? aDecParts[i] : 0;
    const bv = Number.isFinite(bDecParts[i]) ? bDecParts[i] : 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// ─── extractPhaseToken ──────────────────────────────────────────────────────

/**
 * Extract the phase token from a directory name.
 *
 * Supports: '01-name', '1009A-name', '999.6-name', 'CK-01-name', 'PROJ-42-name'.
 *
 * @param dirName - Directory name to extract token from
 * @returns The token portion (e.g. '01', '1009A', '999.6', 'PROJ-42')
 */
export function extractPhaseToken(dirName: string): string {
  // Try project-code-prefixed numeric: CK-01-name -> CK-01
  const codePrefixed = dirName.match(/^([A-Z]{1,6}-\d+[A-Z]?(?:\.\d+)*)(?:-|$)/i);
  if (codePrefixed) return codePrefixed[1];
  // Try plain numeric: 01-name, 1009A-name, 999.6-name
  const numeric = dirName.match(/^(\d+[A-Z]?(?:\.\d+)*)(?:-|$)/i);
  if (numeric) return numeric[1];
  // Custom IDs: PROJ-42-name -> everything before the last segment that looks like a name
  const custom = dirName.match(/^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)(?:-[a-z]|$)/i);
  if (custom) return custom[1];
  return dirName;
}

// ─── phaseTokenMatches ──────────────────────────────────────────────────────

/**
 * Check if a directory name's phase token matches the normalized phase exactly.
 *
 * Case-insensitive comparison for the token portion.
 *
 * @param dirName - Directory name to check
 * @param normalized - Normalized phase name to match against
 * @returns True if the directory matches the phase
 */
export function phaseTokenMatches(dirName: string, normalized: string): boolean {
  const token = extractPhaseToken(dirName);
  if (token.toUpperCase() === normalized.toUpperCase()) return true;
  // Strip optional project_code prefix from dir and retry
  const stripped = dirName.replace(/^[A-Z]{1,6}-(?=\d)/i, '');
  if (stripped !== dirName) {
    const strippedToken = extractPhaseToken(stripped);
    if (strippedToken.toUpperCase() === normalized.toUpperCase()) return true;
  }
  return false;
}

// ─── toPosixPath ────────────────────────────────────────────────────────────

/**
 * Convert a path to POSIX format (forward slashes).
 *
 * @param p - Path to convert
 * @returns Path with all separators as forward slashes
 */
export function toPosixPath(p: string): string {
  return p.split('\\').join('/');
}

// ─── stateExtractField ──────────────────────────────────────────────────────

/**
 * Extract a field value from STATE.md content.
 *
 * Supports both **bold:** and plain: formats, case-insensitive.
 *
 * @param content - STATE.md content string
 * @param fieldName - Field name to extract
 * @returns The field value, or null if not found
 */
export function stateExtractField(content: string, fieldName: string): string | null {
  const escaped = escapeRegex(fieldName);
  // Horizontal whitespace only after ':' so YAML blocks like `progress:\n  total:` do not
  // match as `Progress:` with a multi-line "value" (parity with STATE.md body fields).
  const boldPattern = new RegExp(`\\*\\*${escaped}:\\*\\*[ \\t]*(.+)`, 'i');
  const boldMatch = content.match(boldPattern);
  if (boldMatch) return boldMatch[1].trim();
  const plainPattern = new RegExp(`^${escaped}:[ \\t]*(.+)`, 'im');
  const plainMatch = content.match(plainPattern);
  return plainMatch ? plainMatch[1].trim() : null;
}

// ─── normalizeMd ───────────────────────────────────────────────────────────

/**
 * Normalize markdown content for consistent formatting.
 *
 * Port of `normalizeMd` from core.cjs lines 434-529.
 * Applies: CRLF normalization, blank lines around headings/fences/lists,
 * blank line collapsing (3+ to 2), terminal newline.
 *
 * @param content - Markdown content to normalize
 * @returns Normalized markdown string
 */
export function normalizeMd(content: string): string {
  if (!content || typeof content !== 'string') return content;

  // Normalize line endings to LF
  let text = content.replace(/\r\n/g, '\n');

  const lines = text.split('\n');
  const result: string[] = [];

  // Pre-compute fence state in a single O(n) pass
  const fenceRegex = /^```/;
  const insideFence = new Array<boolean>(lines.length);
  let fenceOpen = false;
  for (let i = 0; i < lines.length; i++) {
    if (fenceRegex.test(lines[i].trimEnd())) {
      if (fenceOpen) {
        insideFence[i] = false;
        fenceOpen = false;
      } else {
        insideFence[i] = false;
        fenceOpen = true;
      }
    } else {
      insideFence[i] = fenceOpen;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = i > 0 ? lines[i - 1] : '';
    const prevTrimmed = prev.trimEnd();
    const trimmed = line.trimEnd();
    const isFenceLine = fenceRegex.test(trimmed);

    // MD022: Blank line before headings (skip first line and frontmatter delimiters)
    if (/^#{1,6}\s/.test(trimmed) && i > 0 && prevTrimmed !== '' && prevTrimmed !== '---') {
      result.push('');
    }

    // MD031: Blank line before fenced code blocks (opening fences only)
    if (isFenceLine && i > 0 && prevTrimmed !== '' && !insideFence[i] && (i === 0 || !insideFence[i - 1] || isFenceLine)) {
      if (i === 0 || !insideFence[i - 1]) {
        result.push('');
      }
    }

    // MD032: Blank line before lists
    if (/^(\s*[-*+]\s|\s*\d+\.\s)/.test(line) && i > 0 &&
        prevTrimmed !== '' && !/^(\s*[-*+]\s|\s*\d+\.\s)/.test(prev) &&
        prevTrimmed !== '---') {
      result.push('');
    }

    result.push(line);

    // MD022: Blank line after headings
    if (/^#{1,6}\s/.test(trimmed) && i < lines.length - 1) {
      const next = lines[i + 1];
      if (next !== undefined && next.trimEnd() !== '') {
        result.push('');
      }
    }

    // MD031: Blank line after closing fenced code blocks
    if (/^```\s*$/.test(trimmed) && i > 0 && insideFence[i - 1] && i < lines.length - 1) {
      const next = lines[i + 1];
      if (next !== undefined && next.trimEnd() !== '') {
        result.push('');
      }
    }

    // MD032: Blank line after last list item in a block
    if (/^(\s*[-*+]\s|\s*\d+\.\s)/.test(line) && i < lines.length - 1) {
      const next = lines[i + 1];
      if (next !== undefined && next.trimEnd() !== '' &&
          !/^(\s*[-*+]\s|\s*\d+\.\s)/.test(next) &&
          !/^\s/.test(next)) {
        result.push('');
      }
    }
  }

  text = result.join('\n');

  // MD012: Collapse 3+ consecutive blank lines to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // MD047: Ensure file ends with exactly one newline
  text = text.replace(/\n*$/, '\n');

  return text;
}

// ─── planningPaths ──────────────────────────────────────────────────────────

/**
 * Get common .planning file paths for a project directory.
 *
 * When `workstream` is provided, all paths are rooted under
 * `.planning/workstreams/<workstream>` instead of `.planning`.
 * All paths returned in POSIX format.
 *
 * @param projectDir - Root project directory
 * @param workstream - Optional workstream name (see relPlanningPath)
 * @returns Object with paths to common .planning files
 */
export function planningPaths(projectDir: string, workstream?: string): PlanningPaths {
  const base = join(projectDir, relPlanningPath(workstream));
  return {
    planning: toPosixPath(base),
    state: toPosixPath(join(base, 'STATE.md')),
    roadmap: toPosixPath(join(base, 'ROADMAP.md')),
    project: toPosixPath(join(base, 'PROJECT.md')),
    config: toPosixPath(join(base, 'config.json')),
    phases: toPosixPath(join(base, 'phases')),
    requirements: toPosixPath(join(base, 'REQUIREMENTS.md')),
  };
}

// ─── findProjectRoot (multi-repo .planning resolution) ─────────────────────

/**
 * Maximum number of parent directories to walk when searching for a
 * multi-repo `.planning/` root. Bounded to avoid scanning to the filesystem
 * root in pathological cases.
 */
const FIND_PROJECT_ROOT_MAX_DEPTH = 10;

/**
 * Walk up from `startDir` to find the project root that owns `.planning/`.
 *
 * Ported from `get-shit-done/bin/lib/core.cjs:findProjectRoot` so that
 * `gsd-sdk query` resolves the same parent `.planning/` root as the legacy
 * `gsd-tools.cjs` CLI when invoked inside a `sub_repos`-listed child repo.
 *
 * Detection strategy (checked in order for each ancestor, up to
 * `FIND_PROJECT_ROOT_MAX_DEPTH` levels):
 *   1. `startDir` itself has `.planning/` — return it unchanged (#1362).
 *   2. Parent has `.planning/config.json` with `sub_repos` listing the
 *      immediate child segment of the starting directory.
 *   3. Parent has `.planning/config.json` with `multiRepo: true` (legacy).
 *   4. Parent has `.planning/` AND an ancestor of `startDir` (up to the
 *      candidate parent) contains `.git` — heuristic fallback.
 *
 * Returns `startDir` unchanged when no ancestor `.planning/` is found
 * (first-run or single-repo projects). Never walks above the user's home
 * directory.
 *
 * All filesystem errors are swallowed — a missing or unparseable
 * `config.json` falls back to the `.git` heuristic, and unreadable
 * directories terminate the walk at that level.
 */
export function findProjectRoot(startDir: string): string {
  let resolvedStart: string;
  try {
    resolvedStart = resolve(startDir);
  } catch {
    return startDir;
  }
  const fsRoot = parsePath(resolvedStart).root;
  const home = homedir();

  // If startDir already contains .planning/, it IS the project root.
  try {
    const ownPlanning = join(resolvedStart, '.planning');
    if (existsSync(ownPlanning) && statSync(ownPlanning).isDirectory()) {
      return startDir;
    }
  } catch {
    // fall through
  }

  // Walk upward, mirroring isInsideGitRepo from the CJS reference.
  function isInsideGitRepo(candidateParent: string): boolean {
    let d = resolvedStart;
    while (d !== fsRoot) {
      try {
        if (existsSync(join(d, '.git'))) return true;
      } catch {
        // ignore
      }
      if (d === candidateParent) break;
      const next = dirname(d);
      if (next === d) break;
      d = next;
    }
    return false;
  }

  let dir = resolvedStart;
  let depth = 0;
  while (dir !== fsRoot && depth < FIND_PROJECT_ROOT_MAX_DEPTH) {
    const parent = dirname(dir);
    if (parent === dir) break;
    if (parent === home) break;

    const parentPlanning = join(parent, '.planning');
    let parentPlanningIsDir = false;
    try {
      parentPlanningIsDir = existsSync(parentPlanning) && statSync(parentPlanning).isDirectory();
    } catch {
      parentPlanningIsDir = false;
    }

    if (parentPlanningIsDir) {
      const configPath = join(parentPlanning, 'config.json');
      let matched = false;
      try {
        const raw = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(raw) as {
          sub_repos?: unknown;
          planning?: { sub_repos?: unknown };
          multiRepo?: unknown;
        };
        const subReposValue =
          (config.sub_repos as unknown) ?? (config.planning && config.planning.sub_repos);
        const subRepos = Array.isArray(subReposValue) ? (subReposValue as unknown[]) : [];

        if (subRepos.length > 0) {
          const relPath = relative(parent, resolvedStart);
          const topSegment = relPath.split(pathSep)[0];
          if (subRepos.includes(topSegment)) {
            return parent;
          }
        }

        if (config.multiRepo === true && isInsideGitRepo(parent)) {
          matched = true;
        }
      } catch {
        // config.json missing or unparseable — fall through to .git heuristic.
      }

      if (matched) return parent;

      // Heuristic: parent has .planning/ and we're inside a git repo.
      if (isInsideGitRepo(parent)) {
        return parent;
      }
    }

    dir = parent;
    depth += 1;
  }
  return startDir;
}

// ─── resolvePathUnderProject ───────────────────────────────────────────────

/**
 * Resolve a user-supplied path against the project and ensure it cannot escape
 * the real project root (prefix checks are insufficient; symlinks are handled
 * via realpath).
 *
 * @param projectDir - Project root directory
 * @param userPath - Relative or absolute path from user input
 * @returns Canonical resolved path within the project
 */
export async function resolvePathUnderProject(projectDir: string, userPath: string): Promise<string> {
  const projectReal = await realpath(projectDir);
  const candidate = isAbsolute(userPath) ? normalize(userPath) : resolve(projectReal, userPath);
  let realCandidate: string;
  try {
    realCandidate = await realpath(candidate);
  } catch {
    realCandidate = candidate;
  }
  const rel = relative(projectReal, realCandidate);
  if (rel.startsWith('..') || (isAbsolute(rel) && rel.length > 0)) {
    throw new GSDError('path escapes project directory', ErrorClassification.Validation);
  }
  return realCandidate;
}

// ─── sanitizeForDisplay (security.cjs) ───────────────────────────────────────

/** Port of `sanitizeForPrompt` from `security.cjs`. */
export function sanitizeForPrompt(text: string): string {
  let sanitized = text;
  sanitized = sanitized.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, '');
  sanitized = sanitized.replace(
    /<(\/?)(?:system|assistant|human)>/gi,
    (_, slash: string) => `＜${slash || ''}system-text＞`,
  );
  sanitized = sanitized.replace(/\[(SYSTEM|INST)\]/gi, '[$1-TEXT]');
  sanitized = sanitized.replace(/<<\s*SYS\s*>>/gi, '«SYS-TEXT»');
  return sanitized;
}

/** Port of `sanitizeForDisplay` from `security.cjs` (matches CLI JSON). */
export function sanitizeForDisplay(text: string): string {
  let sanitized = sanitizeForPrompt(text);
  const protocolLeakPatterns = [
    /^\s*(?:assistant|user|system)\s+to=[^:\s]+:[^\n]+$/i,
    /^\s*<\|(?:assistant|user|system)[^|]*\|>\s*$/i,
  ];
  sanitized = sanitized
    .split('\n')
    .filter(line => !protocolLeakPatterns.some(pattern => pattern.test(line)))
    .join('\n');
  return sanitized;
}
