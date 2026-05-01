'use strict';

/**
 * Extended detector for the no-source-grep rule (#2982).
 *
 * The base lint (scripts/lint-no-source-grep.cjs) only catches the
 * direct-chain form: readFileSync(...).includes(...). The much more common
 * var-binding form escapes it:
 *
 *   const src = fs.readFileSync(p, 'utf8');
 *   // ... 50 lines later ...
 *   assert.ok(src.includes('foo'));   // ← still source-grep, lint missed it
 *
 * This module exposes pure detectors that scan source text and return
 * structured violation records. The CLI wrapper (in the base lint) calls
 * these for each test file.
 *
 * Tests assert on the typed VIOLATION enum codes, not on prose messages.
 */

const VIOLATION = Object.freeze({
  VAR_FROM_READFILE_USED_IN_TEXT_MATCH: 'var_from_readfile_used_in_text_match',
  WRAPPED_ASSERT_OK_MATCH: 'wrapped_assert_ok_match',
});

const TEXT_MATCH_METHODS = ['includes', 'startsWith', 'endsWith', 'match', 'search'];

/**
 * Single-pass scanner. Tracks variables bound from a readFileSync call,
 * then flags any subsequent <var>.<method>( use where method is one of
 * TEXT_MATCH_METHODS.
 */
function detectVarBindingViolations(src) {
  // Pass 1: collect variables bound from readFileSync.
  // Matches:   const|let|var <name> = [fs.]readFileSync(
  const bindRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$.]*\.)?readFileSync\s*\(/g;
  const boundVars = new Set();
  let m;
  while ((m = bindRe.exec(src)) !== null) {
    boundVars.add(m[1]);
  }
  if (boundVars.size === 0) return [];

  // Pass 2: find <var>.<method>( on any bound var.
  const findings = [];
  // Build a regex alternation from the bound var names.
  const alt = [...boundVars].map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const useRe = new RegExp(
    `\\b(${alt})\\s*\\.\\s*(${TEXT_MATCH_METHODS.join('|')})\\s*\\(`,
    'g',
  );
  while ((m = useRe.exec(src)) !== null) {
    findings.push({
      kind: VIOLATION.VAR_FROM_READFILE_USED_IN_TEXT_MATCH,
      variable: m[1],
      method: m[2],
    });
  }
  return findings;
}

/**
 * Detects assert.ok(<expr>.match(/.../)) and assert.ok(<expr>.match(<expr>))
 * which is the same anti-pattern as assert.match but escapes the simpler
 * regex used by the base lint.
 */
function detectWrappedAssertOkMatch(src) {
  const re = /assert\.ok\s*\(\s*[A-Za-z_$][\w$.]*\.match\s*\(/g;
  const findings = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    findings.push({ kind: VIOLATION.WRAPPED_ASSERT_OK_MATCH });
  }
  return findings;
}

function detectAll(src) {
  return [...detectVarBindingViolations(src), ...detectWrappedAssertOkMatch(src)];
}

module.exports = { detectVarBindingViolations, detectWrappedAssertOkMatch, detectAll, VIOLATION };
