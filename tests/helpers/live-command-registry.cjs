// allow-test-rule: source-text-is-the-product
// commands/gsd/*.md files ARE the deployed registry — reading their frontmatter
// validates the structural contract of the command surface, not application source.
'use strict';
/**
 * live-command-registry.cjs
 *
 * Derives the canonical set of live slash-command tokens from the source-of-truth
 * registry: commands/gsd/*.md (one file per registered command).
 *
 * Each command file has YAML frontmatter with a `name:` field:
 *   name: gsd:slug    (colon-style — most commands)
 *   name: gsd-slug    (dash-style — ns-* namespace commands)
 *
 * For each slug, three canonical token forms are emitted:
 *   /gsd-slug   — Claude / non-Gemini runtimes
 *   /gsd:slug   — Gemini runtime
 *   $gsd-slug   — Codex runtime
 *
 * The result is memoized per process — a single fs walk is amortized across
 * all test files that import this helper. The cache is intentionally not
 * exposed for invalidation: test processes are short-lived and the registry
 * does not change mid-run.
 *
 * Per CONTEXT.md k003: all readFileSync calls happen inside getLiveCommandTokens()
 * (i.e., inside a function call, not at module top-level) so that import-time
 * ENOENT errors are caught and reported with context rather than aborting the
 * test runner before any test registers.
 */

const fs = require('node:fs');
const path = require('node:path');

const COMMANDS_DIR = path.join(__dirname, '..', '..', 'commands', 'gsd');

// Module-level memoization — set on first call, reused thereafter.
let _cache = null;

/**
 * Parse the YAML frontmatter `name:` field from a command file's content.
 * Returns the slug (e.g. "help", "plan-phase", "context") or null if the
 * field is absent or the file has no frontmatter.
 *
 * The frontmatter is bounded by the first `---` line and the next `---` line.
 * We parse only the `name:` field — the full YAML spec is not needed and
 * introducing a YAML parser dependency would be disproportionate.
 *
 * Supported name forms:
 *   name: gsd:slug     → slug = "slug"
 *   name: gsd-slug     → slug = "slug"
 *   name: "gsd:slug"   → slug = "slug"  (quoted)
 *   name: "gsd-slug"   → slug = "slug"  (quoted)
 */
function parseSlug(content, filePath) {
  // Frontmatter must start with '---' on the very first line.
  if (!content.startsWith('---')) {
    throw new Error(
      `[live-command-registry] ${filePath}: missing YAML frontmatter — file must start with '---'`
    );
  }

  // Find the closing '---' delimiter.
  const closingIdx = content.indexOf('\n---', 3);
  if (closingIdx < 0) {
    throw new Error(
      `[live-command-registry] ${filePath}: unclosed YAML frontmatter — no closing '---' found`
    );
  }

  const frontmatter = content.slice(0, closingIdx);

  // Match `name:` line, allowing optional quotes around the value.
  // The value must be one of: gsd:<slug> or gsd-<slug>
  // where slug = [a-z0-9][a-z0-9-]*
  const nameMatch = frontmatter.match(/^name:\s*"?(gsd[:‑-])([a-z0-9][a-z0-9-]*)"?\s*$/m);
  if (!nameMatch) {
    throw new Error(
      `[live-command-registry] ${filePath}: could not extract slug from frontmatter ` +
      `(expected "name: gsd:<slug>" or "name: gsd-<slug>")`
    );
  }

  return nameMatch[2]; // the slug after "gsd:" or "gsd-"
}

/**
 * Returns the Set<string> of all canonical slash-command tokens derived from
 * commands/gsd/*.md. Memoized — safe to call repeatedly without extra fs I/O.
 *
 * Throws on the first malformed file (fail-loud per CONTEXT.md k302) so
 * registry drift is caught immediately rather than silently producing an
 * incomplete allow-list.
 */
function getLiveCommandTokens() {
  if (_cache !== null) return _cache;

  if (!fs.existsSync(COMMANDS_DIR)) {
    throw new Error(
      `[live-command-registry] commands directory not found: ${COMMANDS_DIR}`
    );
  }

  const entries = fs.readdirSync(COMMANDS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort(); // deterministic order for reproducible error messages

  const tokens = new Set();

  for (const fileName of entries) {
    const filePath = path.join(COMMANDS_DIR, fileName);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      throw new Error(
        `[live-command-registry] failed to read ${filePath}: ${err.message}`
      );
    }

    const slug = parseSlug(content, filePath);

    // Emit all three canonical token forms per slug.
    tokens.add(`/gsd-${slug}`);   // Claude / non-Gemini
    tokens.add(`/gsd:${slug}`);   // Gemini
    tokens.add(`$gsd-${slug}`);   // Codex
  }

  _cache = tokens;
  return _cache;
}

module.exports = { getLiveCommandTokens };
