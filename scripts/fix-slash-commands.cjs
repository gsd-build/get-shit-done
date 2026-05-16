'use strict';
/**
 * One-shot script + library: bidirectional GSD slash-command namespace
 * normalizer, scoped to known command names with word-boundary safety.
 *
 *   - transformContent       : retired /gsd-<cmd> → canonical /gsd:<cmd>
 *                              (the one-shot source/docs guard; CLI entrypoint)
 *   - transformColonToHyphen : canonical /gsd:<cmd> | gsd:<cmd> → gsd-<cmd>
 *                              (install-time, for hyphen-name skill/agent
 *                              runtimes where the colon namespace is
 *                              unroutable — see #2808 / #3583)
 *
 * Non-command identifiers (gsd-sdk, gsd-tools) are left untouched in both
 * directions. The transforms are pure and exported so they can be unit-tested
 * directly (see tests/bug-2543-gsd-slash-namespace.test.cjs and
 * tests/bug-3583-claude-agent-body-transform.test.cjs) without fixture files.
 */

const fs = require('node:fs');
const path = require('node:path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const SEARCH_DIRS = [
  path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib'),
  path.join(__dirname, '..', 'get-shit-done', 'workflows'),
  path.join(__dirname, '..', 'get-shit-done', 'references'),
  path.join(__dirname, '..', 'get-shit-done', 'templates'),
  path.join(__dirname, '..', 'get-shit-done', 'contexts'),
  path.join(__dirname, '..', 'commands', 'gsd'),
  path.join(__dirname, '..', 'agents'),
  path.join(__dirname, '..', 'hooks'),
];

const TOP_LEVEL_FILES = [
  path.join(__dirname, '..', '.clinerules'),
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo']);
const EXTENSIONS = new Set(['.md', '.cjs', '.js', '.ts', '.tsx']);

// Test files contain intentional fixture strings (e.g. inputs the sanitizer
// is expected to strip). Rewriting them changes test semantics.
function isTestFile(name) {
  return /\.test\.(c?js|tsx?)$/.test(name);
}

function buildPattern(cmdNames) {
  // Empty input would compile `/gsd-()(?=[^a-zA-Z0-9_-]|$)/g`, which the regex
  // engine still matches at any `/gsd-` token followed by a non-word boundary
  // (e.g. EOL, whitespace, punctuation) — rewriting it to a stray `/gsd:`.
  // Short-circuit so the caller can no-op on a missing/empty registry rather
  // than perform an unintended broad rewrite.
  if (!Array.isArray(cmdNames) || cmdNames.length === 0) return null;
  const sorted = [...cmdNames].sort((a, b) => b.length - a.length); // longest first to avoid partial matches
  return new RegExp(`/gsd-(${sorted.join('|')})(?=[^a-zA-Z0-9_-]|$)`, 'g');
}

/**
 * Pure transform: rewrite retired `/gsd-<cmd>` to `/gsd:<cmd>` for the given command names.
 * Returns the rewritten string. Identifiers not in `cmdNames` (e.g. `/gsd-sdk`,
 * `/gsd-tools`) are left untouched.
 */
function transformContent(src, cmdNames) {
  const pattern = buildPattern(cmdNames);
  if (!pattern) return src;
  return src.replace(pattern, (_, cmd) => `/gsd:${cmd}`);
}

/**
 * Build the reverse-direction pattern: canonical `/gsd:<cmd>` (and the bare
 * `gsd:<cmd>` shorthand) → hyphen form. The leading `/` is intentionally
 * outside the match so it round-trips untouched (`/gsd:plan` → `/gsd-plan`);
 * the negative lookbehind only rejects word characters so an identifier like
 * `mygsd:foo` is left alone, while still matching after `/`, space, or
 * backtick. Mirrors the boundary discipline of the forward `buildPattern`
 * (longest-first ordering, roster-gated, empty-roster short-circuit).
 */
function buildColonPattern(cmdNames) {
  if (!Array.isArray(cmdNames) || cmdNames.length === 0) return null;
  const sorted = [...cmdNames].sort((a, b) => b.length - a.length); // longest first
  return new RegExp(`(?<![a-zA-Z0-9_-])gsd:(${sorted.join('|')})(?=[^a-zA-Z0-9_-]|$)`, 'g');
}

/**
 * Pure transform (inverse of `transformContent`): rewrite canonical
 * `/gsd:<cmd>` / `gsd:<cmd>` to the hyphen form `gsd-<cmd>` for known
 * commands. Used by install-time adapters that materialize bodies for
 * runtimes whose slash-command surface is registered under the hyphen
 * `name:` form (#2808) — Claude global skills, Qwen, Hermes — where the
 * colon namespace is unroutable (#3583). Non-command identifiers
 * (`gsd-sdk`, `gsd-tools`) are left untouched.
 */
function transformColonToHyphen(src, cmdNames) {
  const pattern = buildColonPattern(cmdNames);
  if (!pattern) return src;
  return src.replace(pattern, (_, cmd) => `gsd-${cmd}`);
}

function readCmdNames() {
  return fs.readdirSync(COMMANDS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace(/\.md$/, ''));
}

function processFile(file, cmdNames) {
  const pattern = buildPattern(cmdNames);
  if (!pattern) return;
  let src;
  try { src = fs.readFileSync(file, 'utf-8'); } catch { return; }
  const replaced = transformContent(src, cmdNames);
  if (replaced !== src) {
    fs.writeFileSync(file, replaced, 'utf-8');
    const count = (src.match(pattern) || []).length;
    console.log(`  ${count} replacements: ${path.relative(path.join(__dirname, '..'), file)}`);
  }
}

function processDir(dir, cmdNames) {
  const pattern = buildPattern(cmdNames);
  if (!pattern) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      processDir(full, cmdNames);
    } else if (EXTENSIONS.has(path.extname(e.name)) && !isTestFile(e.name)) {
      processFile(full, cmdNames);
    }
  }
}

if (require.main === module) {
  const cmdNames = readCmdNames();
  for (const dir of SEARCH_DIRS) {
    processDir(dir, cmdNames);
  }
  for (const file of TOP_LEVEL_FILES) {
    processFile(file, cmdNames);
  }
  console.log('Done.');
}

module.exports = {
  transformContent,
  buildPattern,
  transformColonToHyphen,
  buildColonPattern,
  readCmdNames,
  SKIP_DIRS,
};
