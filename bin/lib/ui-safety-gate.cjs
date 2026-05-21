'use strict';

/**
 * UI Safety Gate — shell-free implementation (#3706, #3718)
 *
 * Replaces the bash shell-based one-liner that silently degraded on Windows
 * PowerShell / cmd.exe because the locale env-var prefix was not recognised.
 * This module runs inside Node.js — no shell dependency, works identically
 * on bash, Git-Bash, PowerShell, and cmd.exe.
 *
 * Word-boundary anchoring:
 *   (^|[^a-zA-Z0-9])(TOKEN)([^a-zA-Z0-9]|$)
 * Equivalent to POSIX ERE [^[:alnum:]] — matches tokens only when they are not
 * interior substrings of alphanumeric compound words (e.g. "microfrontend" is NOT
 * matched; "micro-frontend" and "micro frontend" ARE matched).
 *
 * Public API:
 *   checkUiPresence(text: string): { hasUI: boolean, tokens: string[] }
 *
 * CLI usage — reads phase-section text from STDIN to avoid ARG_MAX limits:
 *   echo "$PHASE_SECTION" | node bin/lib/ui-safety-gate.cjs
 *   echo $?   → 0 if UI tokens found, 1 if not, 2 on usage error
 *
 * Exit codes mirror grep: 0 = match found, 1 = no match, 2 = usage error.
 */

const UI_TOKENS = [
  'UI',
  'interface',
  'frontend',
  'component',
  'layout',
  'page',
  'screen',
  'view',
  'form',
  'dashboard',
  'widget',
];

/**
 * Built once at module load — no per-call compilation overhead.
 * ASCII word boundaries — matches the original ASCII-grep intent of #3706.
 * Note: JS [a-zA-Z0-9] is ASCII-only and NOT equivalent to POSIX [[:alnum:]],
 * which is locale-sensitive and includes accented characters.
 */
const UI_GATE_PATTERN = new RegExp(
  '(^|[^a-zA-Z0-9])(' + UI_TOKENS.join('|') + ')([^a-zA-Z0-9]|$)',
  'i'
);

// Global-flagged variant for extracting ALL matches per line (matchAll).
const UI_GATE_PATTERN_GLOBAL = new RegExp(UI_GATE_PATTERN.source, 'gi');

/**
 * Check a roadmap phase section string for frontend UI indicators.
 *
 * @param {string} text - The roadmap phase section content (may be multi-line, CRLF or LF).
 * @returns {{ hasUI: boolean, tokens: string[] }}
 *   hasUI — true if any UI token was matched as a standalone word.
 *   tokens — matched token strings (lowercased), deduplicated.
 */
function checkUiPresence(text) {
  if (typeof text !== 'string') {
    return { hasUI: false, tokens: [] };
  }

  // Normalise CRLF so the pattern sees consistent line boundaries.
  const normalised = text.replace(/\r\n/g, '\n');

  const found = new Set();
  for (const line of normalised.split('\n')) {
    // Reset lastIndex before each line so the global pattern restarts from 0.
    UI_GATE_PATTERN_GLOBAL.lastIndex = 0;
    for (const m of line.matchAll(UI_GATE_PATTERN_GLOBAL)) {
      found.add(m[2].toLowerCase());
    }
  }

  return { hasUI: found.size > 0, tokens: [...found] };
}

module.exports = { checkUiPresence, UI_TOKENS };

// ── CLI entry point ─────────────────────────────────────────────────────────
// Reads phase-section text from STDIN (not argv) to avoid OS ARG_MAX limits.
// Invoked by workflow .md bash blocks as: echo "$PHASE_SECTION" | node bin/lib/ui-safety-gate.cjs
// Exit 0 = UI found, 1 = no UI, 2 = startup error.

if (require.main === module) {
  // Collect stdin chunks asynchronously.
  const chunks = [];
  process.stdin.setEncoding('utf-8');

  process.stdin.on('data', (chunk) => chunks.push(chunk));

  process.stdin.on('end', () => {
    const input = chunks.join('');
    const result = checkUiPresence(input);
    process.exit(result.hasUI ? 0 : 1);
  });

  process.stdin.on('error', (err) => {
    process.stderr.write(`ERROR: ui-safety-gate.cjs stdin read failed: ${err.message}\n`);
    process.exit(2);
  });
}
