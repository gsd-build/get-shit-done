/**
 * Prompt sanitizer — strips interactive CLI patterns from GSD-1 prompts
 * so they're safe for headless SDK use.
 *
 * Patterns removed:
 * - @file:... references (file injection directives)
 * - /gsd:... slash commands
 * - AskUserQuestion(...) calls
 * - STOP directives in interactive contexts
 * - SlashCommand() calls
 * - 'wait for user' / 'ask the user' instructions
 */

// ─── Pattern definitions ─────────────────────────────────────────────────────

/**
 * Each pattern is a regex that matches a full line (or inline span) to remove.
 * We strip matching lines entirely to avoid leaving blank gaps that break
 * markdown structure.
 */
const LINE_PATTERNS: RegExp[] = [
  // @file:path/to/something references — entire line
  /^.*@file:\S+.*$/gm,

  // /gsd:command references — entire line containing a slash command
  /^.*\/gsd:\S+.*$/gm,

  // AskUserQuestion(...) calls — entire line
  /^.*AskUserQuestion\s*\(.*$/gm,

  // SlashCommand() calls — entire line
  /^.*SlashCommand\s*\(.*$/gm,

  // STOP directives — lines that are primarily "STOP" instructions
  // Match lines where STOP is used as an imperative (not as part of normal prose)
  /^.*\bSTOP\b(?:\s+(?:and\s+)?(?:wait|ask|here|now)).*$/gm,
  /^\s*STOP\s*[.!]?\s*$/gm,

  // 'wait for user' / 'ask the user' instruction lines
  /^.*\bwait\s+for\s+(?:the\s+)?user\b.*$/gim,
  /^.*\bask\s+the\s+user\b.*$/gim,
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Strip interactive CLI patterns from a prompt string.
 *
 * Removes lines matching known interactive patterns (file references,
 * slash commands, user-interaction directives) while preserving all
 * other content unchanged.
 *
 * @param input - Raw prompt string, possibly containing interactive patterns
 * @returns Cleaned prompt with interactive patterns removed
 */
export function sanitizePrompt(input: string): string {
  if (!input) return input;

  let result = input;

  for (const pattern of LINE_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, '');
  }

  // Collapse runs of 3+ blank lines down to 2 (preserve paragraph breaks)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}
