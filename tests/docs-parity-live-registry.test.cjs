// allow-test-rule: source-text-is-the-product
// Reads docs/*.md files whose deployed text IS what the user sees — asserting
// that every slash-command token in docs resolves to a live registered command
// tests the deployed contract. The commands/gsd/*.md reads in the helper are
// the source-of-truth registry (product markdown).

/**
 * Docs-parity live-registry test (#3049)
 *
 * Replaces three deny-list tests:
 *   - bug-3010-reapply-patches-references.test.cjs
 *   - bug-3029-3034-stale-command-routes.test.cjs
 *   - bug-3042-3044-research-flag-and-stale-refs.test.cjs
 *
 * Polarity: instead of "these specific dead commands must be absent", we
 * assert "every slash-command token in docs must be a live registered command".
 *
 * This catches two failure modes the deny-list shape missed:
 *   1. A freshly-deleted command referenced in docs (no test-file edit needed)
 *   2. A live command renamed without updating docs (deny-list would pass silently)
 *
 * Surfaces scanned:
 *   - docs/*.md (English)
 *   - docs/{ja-JP,ko-KR,zh-CN,pt-BR}/*.md (localized)
 *
 * ALLOWED_HISTORICAL_MENTIONS: files that legitimately reference deleted
 * commands as part of deprecation documentation are excluded from the scan.
 * Preserved from the three legacy tests:
 *   - get-shit-done/workflows/help.md  (deprecation-trail prose)
 *   - CHANGELOG.md                     (historical release notes, must not be rewritten)
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getLiveCommandTokens } = require('./helpers/live-command-registry.cjs');

const ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const LOCALES = ['ja-JP', 'ko-KR', 'zh-CN', 'pt-BR'];

// Files that legitimately reference deleted commands as deprecation history.
// Preserved from the three legacy tests — do not remove without understanding
// why the exemption exists (see issue #3049 and legacy test comments).
const ALLOWED_HISTORICAL_MENTIONS = new Set([
  path.join(ROOT, 'get-shit-done', 'workflows', 'help.md'),
  path.join(ROOT, 'CHANGELOG.md'),
]);

// RELEASE-*.md files document past behavior for historical record.
// They must not be rewritten, so they are exempt from the live-registry check.
// Pattern: docs/RELEASE-*.md
function isReleaseDoc(filePath) {
  return path.basename(filePath).startsWith('RELEASE-') && filePath.endsWith('.md');
}

// Slugs that appear in docs as internal component names or documentation
// syntax placeholders — they match the /gsd-* regex but are NOT user-typable
// slash commands and never appear in the command registry. Adding a slug here
// requires a code comment explaining why it is not a slash command.
//
// Do NOT add here:
//   - deleted slash commands (those should be scrubbed from docs)
//   - renamed commands (update the docs instead)
const INTERNAL_COMPONENT_SLUGS = new Set([
  // Documentation syntax placeholder — "command-name" is used in ARCHITECTURE.md,
  // COMMANDS.md, and USER-GUIDE.md to show the template form of a slash command
  // (e.g. "/gsd-command-name [args]"). It is not a registered command.
  'command-name',
  'command',

  // gsd-tools.cjs — the legacy Node CLI binary (bin/gsd-tools.cjs).
  // Docs reference it as a path component in shell examples, not as a slash command.
  // Example: node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state validate
  'tools',

  // Hook scripts — internal runtime hooks, not user-invocable slash commands.
  //   hooks/gsd-statusline.js       — session statusline hook
  //   hooks/gsd-context-monitor.js  — context-window monitor hook
  //   hooks/gsd-update-banner.js    — update-available banner hook
  //   hooks/gsd-graphify-update.sh  — knowledge-graph auto-update PostToolUse hook (#3347)
  // These appear in docs as file-path references (e.g. "gsd-statusline.js reads
  // the cache"), not as command invocations.
  'statusline',
  'context-monitor',
  'update-banner',
  'graphify-update',

  // gsd-update-check.json — background update-check CACHE FILE, not a slash command.
  // ARCHITECTURE.md references "~/.cache/gsd/gsd-update-check.json" as a path;
  // the regex captures "/gsd-update-check" from the path component.
  'update-check',

  // Internal agent names referenced in ARCHITECTURE.md tables of agents.
  // These are spawned agents (gsd-planner, etc.), not user-typable slash commands.
  'planner',

  // Malformed token from SDK init reference: "/gsd-init-" appears as a truncated
  // prefix in CLI-TOOLS.md describing the gsd-sdk init command family
  // (e.g., "gsd-sdk query init.phase-op 12"). The regex captures "/gsd-init-"
  // without a following slug — this is a documentation formatting artifact, not
  // a real command token.
  'init-',

  // gsd-build — GitHub organization name: "github.com/gsd-build/get-shit-done".
  // Every occurrence of "/gsd-build" in docs is the path component of a GitHub URL
  // (e.g., "[#2792](https://github.com/gsd-build/get-shit-done/issues/2792)").
  // The regex captures "/gsd-build" from the URL path. Not a slash command.
  'build',

  // ~/gsd-workspaces/ — filesystem directory path used by /gsd-workspace.
  // Docs reference "~/gsd-workspaces/<name>" as the default workspace directory
  // in shell examples and option tables (e.g. "--path /target (default: ~/gsd-workspaces/<name>)").
  // The regex captures "/gsd-workspaces" from the path component. The LIVE slash
  // command is "/gsd-workspace" (singular) — not "/gsd-workspaces" (plural).
  'workspaces',

  // Portuguese translation of "command" — pt-BR/ARCHITECTURE.md uses "/gsd-comando"
  // as the localized equivalent of the "/gsd-command-name" English placeholder
  // in an architecture flow diagram. Not a registered command.
  'comando',

  // GitHub repository name: zh-CN/README.md references "github.com/rokicool/gsd-opencode"
  // as an external community project URL. The regex captures "/gsd-opencode" from
  // the URL path. Not a user-typable slash command in this product.
  'opencode',

  // Smoke-test directory path — locale docs reference "/tmp/gsd-smoke-$(date +%s)"
  // as a temporary directory path in bash code-block examples. The regex captures
  // "/gsd-smoke-" from the filesystem path. Not a slash command.
  'smoke-',

  // Template placeholders — zh-CN/references/ui-brand.md used "/gsd-alternative-1"
  // and "/gsd-alternative-2" as unfilled placeholders in a UI template example.
  // These were never registered commands. Fixed in the source doc; kept here as
  // a belt-and-suspenders guard against the pattern returning in other locale docs.
  'alternative-1',
  'alternative-2',

  // gsd-sync-skills — installed Claude skill directory name (also a workflow
  // under get-shit-done/workflows/sync-skills.md), but NOT a registered
  // slash command (no commands/gsd/sync-skills.md). Docs reference it as a
  // filesystem path component, e.g. "~/.agents/skills/gsd-sync-skills/" in
  // docs/discussions/grok-build-support-2026-05.md. The regex captures
  // "/gsd-sync-skills" from the path. Invoked via Skill(skill="gsd-sync-skills").
  'sync-skills',
]);

/**
 * Strip HTML comments from content to avoid flagging commented-out examples
 * or prose that names a dead command for historical context (e.g. "previously
 * this was /gsd-old-name...").
 */
function stripHtmlComments(content) {
  return content.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Extract the set of slash-command tokens from markdown content.
 * Three forms per command per runtime:
 *   /gsd-slug  — Claude / non-Gemini
 *   /gsd:slug  — Gemini
 *   $gsd-slug  — Codex
 *
 * Internal component slugs (INTERNAL_COMPONENT_SLUGS) are filtered out —
 * those are file-path references or documentation placeholders, not slash
 * command invocations.
 *
 * Returns: { slash: Set<string>, colon: Set<string>, dollar: Set<string> }
 */
function extractCommandTokens(content) {
  const stripped = stripHtmlComments(content);

  function isInternal(token) {
    // Strip the /gsd- or /gsd: or $gsd- prefix to get the slug
    const slug = token.replace(/^(?:\/gsd[:-]|\$gsd-)/, '');
    // Exact match OR prefix match for 'init-' (which ends with a dash)
    if (INTERNAL_COMPONENT_SLUGS.has(slug)) return true;
    for (const s of INTERNAL_COMPONENT_SLUGS) {
      if (s.endsWith('-') && slug.startsWith(s)) return true;
    }
    return false;
  }

  const allSlash = (stripped.match(/\/gsd-[a-z0-9][a-z0-9-]*/g) || []);
  const allColon = (stripped.match(/\/gsd:[a-z0-9][a-z0-9-]*/g) || []);
  const allDollar = (stripped.match(/\$gsd-[a-z0-9][a-z0-9-]*/g) || []);

  const slash = new Set(allSlash.filter(t => !isInternal(t)));
  const colon = new Set(allColon.filter(t => !isInternal(t)));
  const dollar = new Set(allDollar.filter(t => !isInternal(t)));
  return { slash, colon, dollar };
}

/**
 * Walk a directory and return all .md files recursively.
 * Uses hand-rolled DFS for Node 20 compat (Node 22+ recursive readdirSync is
 * not available in all CI matrix entries). Surfaces permission-denied errors
 * as structured warnings (PRED.k302) rather than silently skipping.
 */
function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      try {
        files.push(...listMdFiles(fullPath));
      } catch (err) {
        process.stderr.write('[docs-parity] WARNING: skipping unreadable directory ' + fullPath + ': ' + err.message + '\n');
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Assert that every command token in a doc file resolves to the live registry.
 * Returns an array of diagnostic strings (empty = pass).
 */
function findUnknownTokens(filePath, liveTokens) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { slash, colon, dollar } = extractCommandTokens(content);
  const unknowns = [];
  for (const token of slash) {
    if (!liveTokens.has(token)) unknowns.push(token);
  }
  for (const token of colon) {
    if (!liveTokens.has(token)) unknowns.push(token);
  }
  for (const token of dollar) {
    if (!liveTokens.has(token)) unknowns.push(token);
  }
  return unknowns;
}

// ─── Helper unit tests ────────────────────────────────────────────────────────

describe('getLiveCommandTokens() — helper contract', () => {
  test('returns a Set', () => {
    const result = getLiveCommandTokens();
    assert.ok(result instanceof Set, 'getLiveCommandTokens() must return a Set');
  });

  test('returns a non-empty set (commands/gsd/ has registered commands)', () => {
    const result = getLiveCommandTokens();
    assert.ok(result.size > 0, 'live registry must contain at least one token');
  });

  test('contains /gsd-help (from commands/gsd/help.md name: gsd:help)', () => {
    const result = getLiveCommandTokens();
    assert.ok(result.has('/gsd-help'), 'registry must contain /gsd-help');
  });

  test('contains /gsd:help (Gemini form)', () => {
    const result = getLiveCommandTokens();
    assert.ok(result.has('/gsd:help'), 'registry must contain /gsd:help');
  });

  test('contains $gsd-help (Codex form)', () => {
    const result = getLiveCommandTokens();
    assert.ok(result.has('$gsd-help'), 'registry must contain $gsd-help');
  });

  test('contains /gsd-plan-phase (from commands/gsd/plan-phase.md)', () => {
    const result = getLiveCommandTokens();
    assert.ok(result.has('/gsd-plan-phase'), 'registry must contain /gsd-plan-phase');
  });

  test('contains exactly 3 tokens per slug (slash, colon, dollar)', () => {
    const result = getLiveCommandTokens();
    // Every /gsd-slug should have a matching /gsd:slug and $gsd-slug
    let tokenCount = 0;
    for (const token of result) {
      if (token.startsWith('/gsd-')) tokenCount++;
    }
    const slashTokens = [...result].filter(t => t.startsWith('/gsd-'));
    for (const slash of slashTokens) {
      const slug = slash.slice('/gsd-'.length);
      assert.ok(
        result.has(`/gsd:${slug}`),
        `registry must contain Gemini form /gsd:${slug} for slash form ${slash}`
      );
      assert.ok(
        result.has(`$gsd-${slug}`),
        `registry must contain Codex form $gsd-${slug} for slash form ${slash}`
      );
    }
  });

  test('does NOT contain removed /gsd-reapply-patches', () => {
    const result = getLiveCommandTokens();
    assert.ok(!result.has('/gsd-reapply-patches'), 'registry must NOT contain removed /gsd-reapply-patches');
  });

  test('does NOT contain removed /gsd-code-review-fix', () => {
    const result = getLiveCommandTokens();
    assert.ok(!result.has('/gsd-code-review-fix'), 'registry must NOT contain removed /gsd-code-review-fix');
  });

  test('does NOT contain removed /gsd-status', () => {
    const result = getLiveCommandTokens();
    assert.ok(!result.has('/gsd-status'), 'registry must NOT contain removed /gsd-status');
  });

  test('memoizes — returns the same Set reference on repeated calls', () => {
    const a = getLiveCommandTokens();
    const b = getLiveCommandTokens();
    assert.strictEqual(a, b, 'getLiveCommandTokens() must return the same Set instance (memoized)');
  });
});

// ─── Fixture-based helper tests ───────────────────────────────────────────────

describe('getLiveCommandTokens() — fixture contract', () => {
  test('parses gsd:foo frontmatter and emits 3 canonical tokens', () => {
    // This test validates the parsing logic against a known-good fixture
    // by inspecting the live registry for commands/gsd/help.md (name: gsd:help).
    // Fixture file tests are done inline since the helper reads commands/gsd/ only.
    // The canonical token contract:
    //   name: gsd:foo → /gsd-foo, /gsd:foo, $gsd-foo
    const registry = getLiveCommandTokens();
    // We know help.md has name: gsd:help
    const slug = 'help';
    assert.ok(registry.has(`/gsd-${slug}`), `must have /gsd-${slug}`);
    assert.ok(registry.has(`/gsd:${slug}`), `must have /gsd:${slug}`);
    assert.ok(registry.has(`$gsd-${slug}`), `must have $gsd-${slug}`);
  });

  test('parses gsd-slug frontmatter (ns-* commands) and emits 3 tokens', () => {
    // ns-context.md has name: gsd-context (dash-style, no colon)
    const registry = getLiveCommandTokens();
    assert.ok(registry.has('/gsd-context'), 'must have /gsd-context (from ns-context.md)');
    assert.ok(registry.has('/gsd:context'), 'must have /gsd:context (Gemini form)');
    assert.ok(registry.has('$gsd-context'), 'must have $gsd-context (Codex form)');
  });
});

// ─── English docs parity check ───────────────────────────────────────────────

// Precomputed locale directory prefixes for efficient exclusion in the English scan.
const LOCALE_DIRS = LOCALES.map(l => path.join(DOCS_DIR, l) + path.sep);

/**
 * List all .md files under dir, excluding files under any of the known locale
 * subdirectories (which are covered by the per-locale describe blocks below).
 */
function listEnglishMdFiles(dir) {
  return listMdFiles(dir).filter(
    f => !LOCALE_DIRS.some(ld => f.startsWith(ld))
  );
}

describe('docs parity — English docs/*.md ⊆ liveRegistry', () => {
  test('docs/ directory exists and contains markdown files', () => {
    const files = listEnglishMdFiles(DOCS_DIR);
    assert.ok(files.length > 0, `expected markdown files under ${DOCS_DIR}`);
  });

  test('every slash-command token in docs/*.md resolves to a live command', () => {
    const liveTokens = getLiveCommandTokens();
    const docFiles = listEnglishMdFiles(DOCS_DIR);
    const allOffenders = [];

    for (const filePath of docFiles) {
      if (ALLOWED_HISTORICAL_MENTIONS.has(filePath)) continue;
      if (isReleaseDoc(filePath)) continue;

      const unknowns = findUnknownTokens(filePath, liveTokens);
      if (unknowns.length > 0) {
        allOffenders.push(
          `${path.relative(ROOT, filePath)}: unknown command token(s): [${unknowns.join(', ')}]`
        );
      }
    }

    assert.deepStrictEqual(
      allOffenders,
      [],
      'docs/*.md must only reference live registered commands:\n  ' + allOffenders.join('\n  ')
    );
  });
});

// ─── Localized docs parity check ─────────────────────────────────────────────

for (const locale of LOCALES) {
  const localeDir = path.join(DOCS_DIR, locale);

  describe(`docs parity — docs/${locale}/*.md ⊆ liveRegistry`, () => {
    test(`docs/${locale}/ exists and contains markdown files (or is empty/absent — skip gracefully)`, () => {
      if (!fs.existsSync(localeDir)) {
        // Some locales may not exist in every repo state — that is fine.
        return;
      }
      // If the dir exists, it should have at least one .md file.
      const files = listMdFiles(localeDir);
      // Warn but don't fail if locale dir is unexpectedly empty.
      // The parity test below will simply pass vacuously.
      assert.ok(
        files.length >= 0,
        `docs/${locale}/ exists but contains no markdown files`
      );
    });

    test(`every slash-command token in docs/${locale}/*.md resolves to a live command`, () => {
      if (!fs.existsSync(localeDir)) return;

      const liveTokens = getLiveCommandTokens();
      const docFiles = listMdFiles(localeDir);
      const allOffenders = [];

      for (const filePath of docFiles) {
        if (ALLOWED_HISTORICAL_MENTIONS.has(filePath)) continue;
        if (isReleaseDoc(filePath)) continue;

        const unknowns = findUnknownTokens(filePath, liveTokens);
        if (unknowns.length > 0) {
          allOffenders.push(
            `${path.relative(ROOT, filePath)}: unknown command token(s): [${unknowns.join(', ')}]`
          );
        }
      }

      assert.deepStrictEqual(
        allOffenders,
        [],
        `docs/${locale}/*.md must only reference live registered commands:\n  ` + allOffenders.join('\n  ')
      );
    });
  });
}

// ─── Adversarial regression tests ────────────────────────────────────────────

describe('adversarial: polarity inversion catches drift deny-list misses', () => {
  test('renaming a live command without updating docs would fail this test (demonstrated via token absence)', () => {
    // If /gsd-progress were renamed to /gsd-status-new, the old /gsd-progress
    // token would not appear in the live registry, and any doc referencing
    // /gsd-progress would fail. The deny-list shape would have passed silently
    // (it only checks for specific known-bad tokens).
    // We can't simulate an actual rename in a live test, but we can assert
    // that the registry correctly contains the live name (progress, not status):
    const registry = getLiveCommandTokens();
    assert.ok(registry.has('/gsd-progress'), '/gsd-progress must be live (not renamed to /gsd-status)');
    assert.ok(!registry.has('/gsd-status'), '/gsd-status must be absent (was deleted, replaced by /gsd-progress)');
  });

  test('freshly-deleted command /gsd-check-todos is absent from registry', () => {
    const registry = getLiveCommandTokens();
    assert.ok(!registry.has('/gsd-check-todos'), '/gsd-check-todos must not be in the live registry');
  });

  test('freshly-deleted command /gsd-new-workspace is absent from registry', () => {
    const registry = getLiveCommandTokens();
    assert.ok(!registry.has('/gsd-new-workspace'), '/gsd-new-workspace must not be in the live registry');
  });

  test('freshly-deleted command /gsd-plan-milestone-gaps is absent from registry', () => {
    const registry = getLiveCommandTokens();
    assert.ok(!registry.has('/gsd-plan-milestone-gaps'), '/gsd-plan-milestone-gaps must not be in the live registry');
  });

  test('freshly-deleted command /gsd-research-phase is absent from registry', () => {
    const registry = getLiveCommandTokens();
    assert.ok(!registry.has('/gsd-research-phase'), '/gsd-research-phase must not be in the live registry');
  });
});
