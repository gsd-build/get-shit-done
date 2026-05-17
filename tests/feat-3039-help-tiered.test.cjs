'use strict';

// allow-test-rule: source-text-is-the-product
// `workflows/help/modes/*.md` files ARE the help output — their text is what
// the runtime emits when the user runs `/gsd:help [--brief|--full|<topic>]`.
// Asserting on their structure tests the deployed contract directly.

/**
 * Feature #3039: tiered /gsd:help output.
 *
 * The legacy single-file 747-line help is replaced by:
 *   - workflows/help.md             — small dispatcher (progressive disclosure)
 *   - workflows/help/modes/brief.md   — ~one-liner refresher
 *   - workflows/help/modes/default.md — one-page newcomer tour
 *   - workflows/help/modes/full.md    — complete reference (former help.md body)
 *   - workflows/help/modes/topic.md   — section-extraction logic + alias table
 *
 * This test enforces the contract:
 *   1. All four mode files exist with a single `<reference>` block.
 *   2. brief and default fit a "one screen" budget; full stays under LARGE tier cap.
 *   3. The dispatcher routes on $ARGUMENTS to all four mode files (structural parse).
 *   4. Dispatcher conflict-resolution rules are documented:
 *      - `--brief` + `--full` without a topic → prefer `--full`
 *      - `--brief <topic>` → topic.md in compact scope (composable)
 *      - bare or `--full <topic>` → topic.md in full scope
 *   5. topic.md documents an explicit routing preamble + compact-scope rule.
 *   6. Every topic alias in topic.md resolves to a heading that exists in full.md.
 *   7. Every /gsd:* sub-block token in topic.md's alias table appears in full.md.
 *   8. Every full.md heading is either aliased or in the intentional-orphan allowlist.
 *   9. The `commands/gsd/help.md` shim passes `$ARGUMENTS` through and advertises
 *      the composable `--brief <topic>` form.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WORKFLOWS = path.join(ROOT, 'get-shit-done', 'workflows');
const MODES = path.join(WORKFLOWS, 'help', 'modes');
const DISPATCHER = path.join(WORKFLOWS, 'help.md');
const COMMAND_SHIM = path.join(ROOT, 'commands', 'gsd', 'help.md');

const MODE_FILES = ['brief.md', 'default.md', 'full.md', 'topic.md'];

// "One screen" budgets, including frontmatter/<purpose>/<reference> tags.
// These are conservative (one-page conceptual size of ~25 lines of usable
// content) but allow for the wrapping tags. Tighten as content stabilizes.
const BRIEF_BUDGET = 30;
const DEFAULT_BUDGET = 70;
// full.md is the LARGE tier (see workflow-size-budget.test.cjs — LARGE_BUDGET = 1500).
// The size-budget test is non-recursive so full.md is not covered there; cap it here.
const FULL_BUDGET = 1500;

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function lineCount(file) {
  const c = read(file);
  if (c.length === 0) return 0;
  const trail = c.endsWith('\n') ? 1 : 0;
  return c.split('\n').length - trail;
}

describe('feature #3039: tiered help — file structure', () => {
  for (const f of MODE_FILES) {
    test(`mode file exists: ${f}`, () => {
      assert.ok(fs.existsSync(path.join(MODES, f)), `missing ${path.join(MODES, f)}`);
    });
  }

  test('dispatcher exists and is small (≤ 40 lines)', () => {
    assert.ok(fs.existsSync(DISPATCHER));
    const n = lineCount(DISPATCHER);
    assert.ok(n <= 40, `dispatcher should be small; got ${n} lines`);
  });

  for (const f of MODE_FILES) {
    test(`${f} has exactly one <reference> block (line-anchored)`, () => {
      const content = read(path.join(MODES, f));
      // Anchor on start-of-line so prose mentions of `<reference>` inside
      // <purpose> blocks aren't counted.
      const opens = (content.match(/^<reference>$/gm) || []).length;
      const closes = (content.match(/^<\/reference>$/gm) || []).length;
      assert.equal(opens, 1, `${f}: expected 1 <reference> opening line, got ${opens}`);
      assert.equal(closes, 1, `${f}: expected 1 </reference> closing line, got ${closes}`);
    });
  }
});

describe('feature #3039: tiered help — size budgets', () => {
  test(`brief.md fits one screen (≤ ${BRIEF_BUDGET} lines)`, () => {
    const n = lineCount(path.join(MODES, 'brief.md'));
    assert.ok(n <= BRIEF_BUDGET, `brief.md is ${n} lines, budget ${BRIEF_BUDGET}`);
  });

  test(`default.md fits one screen (≤ ${DEFAULT_BUDGET} lines)`, () => {
    const n = lineCount(path.join(MODES, 'default.md'));
    assert.ok(n <= DEFAULT_BUDGET, `default.md is ${n} lines, budget ${DEFAULT_BUDGET}`);
  });

  test('full.md preserves the complete reference (≥ 600 lines)', () => {
    // The pre-#3039 reference was 747 lines. Guard against accidental shrinkage
    // that would amount to silently removing content from --full.
    const n = lineCount(path.join(MODES, 'full.md'));
    assert.ok(n >= 600, `full.md is ${n} lines — too small, content may have been lost`);
  });

  test(`full.md stays under LARGE workflow budget (≤ ${FULL_BUDGET} lines)`, () => {
    // full.md lives in a subdirectory and is not enumerated by the non-recursive
    // workflow-size-budget.test.cjs. Cap it here at the LARGE tier limit.
    const n = lineCount(path.join(MODES, 'full.md'));
    assert.ok(n <= FULL_BUDGET, `full.md grew to ${n} lines (LARGE budget: ${FULL_BUDGET})`);
  });
});

describe('feature #3039: tiered help — dispatcher routing (structural)', () => {
  const dispatcher = read(DISPATCHER);

  function extractDisclosureBlock(src) {
    const m = src.match(/<progressive_disclosure>([\s\S]*?)<\/progressive_disclosure>/);
    assert.ok(m, 'dispatcher must contain a <progressive_disclosure> block');
    return m[1];
  }

  test('dispatcher <progressive_disclosure> block has exactly 5 routing rows', () => {
    // 4 base tiers (brief, full, default, topic) + 1 composable row (--brief <topic>).
    const block = extractDisclosureBlock(dispatcher);
    // Table rows are lines starting with `|`, excluding the header and separator rows.
    const rows = block.split('\n')
      .filter(l => /^\|/.test(l))
      .filter(l => !/^\|\s*[-:]+\s*\|/.test(l))        // strip separator rows
      .filter(l => !/when.*arguments/i.test(l));         // strip header row
    assert.equal(rows.length, 5,
      `dispatcher routing table must have exactly 5 rows; got ${rows.length}:\n${rows.join('\n')}`);
  });

  test('dispatcher routes --brief to brief.md', () => {
    const block = extractDisclosureBlock(dispatcher);
    assert.match(block, /`--brief`[\s\S]*?brief\.md/);
  });

  test('dispatcher routes --full to full.md', () => {
    const block = extractDisclosureBlock(dispatcher);
    assert.match(block, /`--full`[\s\S]*?full\.md/);
  });

  test('dispatcher routes empty/no-flag args to default.md', () => {
    const block = extractDisclosureBlock(dispatcher);
    assert.match(block, /(empty|unset)[\s\S]*?default\.md/i);
  });

  test('dispatcher routes topic args to topic.md', () => {
    const block = extractDisclosureBlock(dispatcher);
    assert.match(block, /topic[\s\S]*?topic\.md/i);
  });
});

describe('feature #3039: tiered help — dispatcher conflict-resolution rules', () => {
  const dispatcher = read(DISPATCHER);

  test('dispatcher documents --brief + --full (without topic) conflict resolution (prefer --full)', () => {
    // help.md argument parsing rules: "if both appear *without* a topic, prefer `--full`"
    assert.match(dispatcher, /prefer.*--full/);
  });

  test('dispatcher routes --brief <topic> to topic.md in compact scope (composable)', () => {
    // help.md argument parsing rules: "--brief combined with a topic invokes topic.md
    // in compact scope" — the composable scoped-lookup form (trek-e review finding #4).
    assert.match(dispatcher, /--brief[^|]*<topic>[\s\S]*?topic\.md[\s\S]*?compact/i);
  });

  test('dispatcher routes --full <topic> (or bare topic) to topic.md in full scope', () => {
    // Bare topic, `--full <topic>`, or topic with leading `--` → full scope.
    assert.match(dispatcher, /(bare topic|--full <topic>)[\s\S]*?full scope/i);
  });

  test('dispatcher tells topic.md to retain --brief when delegating', () => {
    // The dispatcher passes $ARGUMENTS through; topic.md needs to see --brief to
    // choose compact scope. Guard against accidental flag-stripping.
    assert.match(dispatcher, /retain.*--brief|pass.*--brief/i);
  });
});

describe('feature #3039: tiered help — command shim passes $ARGUMENTS', () => {
  const shim = read(COMMAND_SHIM);

  test('shim references $ARGUMENTS', () => {
    assert.match(shim, /\$ARGUMENTS/);
  });

  test('shim declares argument-hint frontmatter', () => {
    assert.match(shim, /argument-hint:/);
  });

  test('shim argument-hint advertises composable --brief <topic>', () => {
    // Discoverability: users need to know the composable form is supported
    // (trek-e review finding #4).
    assert.match(shim, /argument-hint:[^\n]*--brief[^\n]*<topic>/);
  });

  test('shim references the help workflow', () => {
    assert.match(shim, /workflows\/help\.md/);
  });
});

describe('feature #3039: tiered help — topic.md routing visibility + compact scope', () => {
  const topicSrc = read(path.join(MODES, 'topic.md'));

  test('topic.md documents an explicit resolved-routing preamble', () => {
    // Trek-e review finding #3: routing must be explicit in output so the user
    // can see which alias matched which heading and at what scope.
    assert.match(topicSrc, /\*\*Topic:\*\*[\s\S]*<alias>[\s\S]*<heading>/);
    assert.match(topicSrc, /scope:.*full.*\|.*compact/i);
  });

  test('topic.md documents a compact scope distinct from full scope', () => {
    // Trek-e review finding #4: --brief <topic> must produce a compact
    // scoped lookup (signature + one-line summary), not the full section.
    assert.match(topicSrc, /compact scope/i);
    assert.match(topicSrc, /signature.*one-line summary|signature \+ one-line/i);
  });

  test('topic.md parses --brief flag and strips it before resolving the alias', () => {
    // Compact scope must trigger off the --brief flag in $ARGUMENTS; the
    // remaining token is the alias.
    assert.match(topicSrc, /--brief.*-b.*compact scope|compact scope[\s\S]*--brief/i);
  });

  test('topic.md closing "More:" line advertises the composable form', () => {
    assert.match(topicSrc, /More:[\s\S]*--brief <topic>/);
  });
});

describe('feature #3039: tiered help — topic alias coverage', () => {
  const topicSrc = read(path.join(MODES, 'topic.md'));
  const fullSrc = read(path.join(MODES, 'full.md'));

  // Extract the alias table portion of topic.md (before "**Output rules:**")
  function aliasTableSection(src) {
    return src.split('**Output rules:**')[0];
  }

  // Extract the canonical heading text referenced from each row of the
  // alias table. Rows look like: `| aliases | \`## Heading\` ... |`.
  // We accept either ## or ### and pull the literal heading text.
  function extractReferencedHeadings(src) {
    const headings = new Set();
    const re = /`(#{2,3} [^`]+?)`/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      headings.add(m[1].trim());
    }
    return headings;
  }

  function fullHeadings(src) {
    const set = new Set();
    for (const line of src.split('\n')) {
      const m = line.match(/^(#{2,3}) (.+?)\s*$/);
      if (m) set.add(`${m[1]} ${m[2]}`);
    }
    return set;
  }

  test('every heading referenced in topic.md exists in full.md', () => {
    const referenced = extractReferencedHeadings(aliasTableSection(topicSrc));
    const present = fullHeadings(fullSrc);
    const missing = [...referenced].filter((h) => !present.has(h)).sort();
    assert.deepEqual(missing, [],
      `topic.md references headings not present in full.md: ${missing.join(' | ')}`);
  });

  test('every /gsd:* sub-block token in topic.md alias table exists in full.md', () => {
    // Validates fix for review finding #2: sub-block aliases reference bold-line
    // anchors (**`/gsd:X`**) — assert each token actually appears in full.md.
    const tableSection = aliasTableSection(topicSrc);
    const tokens = [...tableSection.matchAll(/`(\/gsd:[a-z-]+(?:\s+--[a-z-]+)?)`/g)].map(m => m[1]);
    assert.ok(tokens.length > 0, 'expected at least one /gsd:* token in alias table');
    const missing = tokens.filter(t => !fullSrc.includes(t));
    assert.deepEqual(missing, [],
      `topic.md references /gsd:* tokens not present in full.md: ${missing.join(' | ')}`);
  });

  test('every full.md heading is either aliased or in the intentional-orphan allowlist', () => {
    // Catches newly added headings that have no alias (contributor must either
    // alias the section or explicitly add it to INTENTIONAL_ORPHANS below).
    const INTENTIONAL_ORPHANS = new Set([
      '## Quick Start',
      '## Staying Updated',
      '### Utility Commands',          // covered by cleanup/update sub-block aliases
      '## Additional Commands',
      '### Discovery & Specification',
      '### Planning & Execution',
      '### Quality, Review & Verification',
      '### Diagnostics & Maintenance',
      '### Knowledge & Context',
      '### Workflow & Orchestration',
      '### Repository Integration',
      '### Namespace Routers (model-facing meta-skills)',
    ]);

    const allHeadings = fullSrc.split('\n')
      .filter(l => /^#{2,3} /.test(l))
      .map(l => l.trim());

    const aliased = extractReferencedHeadings(aliasTableSection(topicSrc));

    const orphans = allHeadings.filter(h => !aliased.has(h) && !INTENTIONAL_ORPHANS.has(h));
    assert.deepEqual(orphans, [],
      `full.md headings not aliased in topic.md (add to INTENTIONAL_ORPHANS if intentional): ${orphans.join(' | ')}`);
  });

  test('topic.md covers the core topics promised in default.md', () => {
    // Surface contract: default.md advertises a "Topics:" line. Each alias
    // there must appear as a recognized topic in topic.md's alias table.
    const def = read(path.join(MODES, 'default.md'));
    const topicsLine = def.split('\n').find((l) => /^Topics:/i.test(l));
    assert.ok(topicsLine, 'default.md must advertise a "Topics:" line for users');
    // Strip the leading "Topics:" prefix, then pull every backticked token.
    const aliases = [...topicsLine.matchAll(/`([a-z][a-z0-9-]*)`/g)].map((m) => m[1]);
    assert.ok(aliases.length >= 5, `expected at least 5 promoted topic aliases; got ${aliases.length}`);
    const missing = aliases.filter((a) => !new RegExp(`\`${a}\``).test(topicSrc));
    assert.deepEqual(missing, [],
      `default.md promotes topic aliases that topic.md does not recognize: ${missing.join(', ')}`);
  });
});
