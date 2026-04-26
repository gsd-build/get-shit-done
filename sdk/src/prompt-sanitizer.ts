/**
 * Prompt sanitizer — resolves @-file references and strips interactive CLI
 * patterns from GSD-1 prompts so they're safe for headless SDK use.
 *
 * @-file references (e.g., @~/.claude/get-shit-done/references/foo.md) are
 * resolved by reading the file and inlining the content. This preserves the
 * critical instructions that the real agent prompts depend on.
 *
 * Patterns removed (interactive-only, not useful headless):
 * - /gsd-... skill commands (can't invoke skills in Agent SDK)
 * - AskUserQuestion(...) calls
 * - STOP directives in interactive contexts
 * - SlashCommand() calls
 * - 'wait for user' / 'ask the user' instructions
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

// ─── @-reference resolution ──────────────────────────────────────────────────

/**
 * Matches @-file references in prompt text. Handles:
 * - @~/.claude/get-shit-done/references/foo.md
 * - @~/.claude/get-shit-done/workflows/bar.md
 * - @.planning/PROJECT.md (project-relative)
 *
 * Only resolves references that start a line or follow whitespace,
 * not email addresses or @ mentions in prose.
 */
const AT_REFERENCE_PATTERN = /^(\s*)@(~\/[^\s]+|\.planning\/[^\s]+)/gm;

/**
 * Resolve @-file references by reading the file and inlining the content.
 * References that can't be resolved (file not found) are removed silently.
 *
 * @param input - Prompt text with @-references
 * @param projectDir - Project directory for resolving relative paths
 * @returns Prompt with @-references replaced by file contents
 */
export function resolveAtReferences(input: string, projectDir?: string): string {
  if (!input) return input;

  return input.replace(AT_REFERENCE_PATTERN, (_match, indent: string, refPath: string) => {
    const resolvedPath = refPath.startsWith('~/')
      ? refPath.replace('~/', `${homedir()}/`)
      : projectDir
        ? `${projectDir}/${refPath}`
        : refPath;

    try {
      const content = readFileSync(resolvedPath, 'utf-8').trim();
      return `${indent}${content}`;
    } catch {
      // File not found — remove the reference silently
      return '';
    }
  });
}

// ─── Interactive pattern stripping ───────────────────────────────────────────

/**
 * Patterns that are interactive-only and should be stripped for headless use.
 * Note: @~/... file references are NOT stripped — they're resolved above.
 */
const LINE_PATTERNS: RegExp[] = [
  // @file:path/to/something references (explicit @file: directive, not @~/...)
  /^.*@file:\S+.*$/gm,

  // /gsd-command references — entire line containing a skill command
  /^.*\/gsd[:-]\S+.*$/gm,

  // AskUserQuestion(...) calls — entire line
  /^.*AskUserQuestion\s*\(.*$/gm,

  // SlashCommand() calls — entire line
  /^.*SlashCommand\s*\(.*$/gm,

  // STOP directives — lines that are primarily "STOP" instructions
  /^.*\bSTOP\b(?:\s+(?:and\s+)?(?:wait|ask|here|now)).*$/gm,
  /^\s*STOP\s*[.!]?\s*$/gm,

  // 'wait for user' / 'ask the user' instruction lines
  /^.*\bwait\s+for\s+(?:the\s+)?user\b.*$/gim,
  /^.*\bask\s+the\s+user\b.*$/gim,
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sanitize a prompt for headless SDK use:
 * 1. Resolve @-file references (inline the content)
 * 2. Strip interactive-only patterns
 *
 * @param input - Raw prompt string from agent/workflow files
 * @param projectDir - Project directory for resolving relative @-references
 * @returns Cleaned prompt ready for Agent SDK use
 */
export function sanitizePrompt(input: string, projectDir?: string): string {
  if (!input) return input;

  // Step 1: Resolve @-file references to inline content
  let result = resolveAtReferences(input, projectDir);

  // Step 2: Strip interactive-only patterns
  for (const pattern of LINE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, '');
  }

  // Collapse runs of 3+ blank lines down to 2 (preserve paragraph breaks)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}
