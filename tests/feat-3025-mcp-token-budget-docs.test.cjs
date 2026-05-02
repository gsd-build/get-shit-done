/**
 * Documentation regression test for issue #3025 — MCP token-budget guidance.
 *
 * Verifies that get-shit-done/references/context-budget.md contains the
 * structural elements the issue requires:
 *
 *   1. A section explaining MCP/tool schemas as a context-budget concern
 *   2. References to the harness-side toggles (enabledMcpjsonServers,
 *      disabledMcpjsonServers in .claude/settings.json)
 *   3. A pre-phase audit checklist (browser/playwright, platform-specific,
 *      project-specific)
 *   4. An explicit note that GSD does NOT manage MCP enablement — this is
 *      a Claude Code harness concern (with a cross-link)
 *   5. Note the interaction with model_profile (compounding levers)
 *
 * Tests parse the doc into a typed section record (parseMcpSection) and
 * assert on flag booleans, not raw text matches. Adheres to
 * CONTRIBUTING.md "no-source-grep" — describes invariants, not wording,
 * so the prose can be reworded freely as long as the semantics survive.
 *
 * Companion to docs/USER-GUIDE.md task section, which is exercised by the
 * same parser shape (separate test below).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CONTEXT_BUDGET_MD = path.join(ROOT, 'get-shit-done', 'references', 'context-budget.md');
const USER_GUIDE_MD = path.join(ROOT, 'docs', 'USER-GUIDE.md');

/**
 * Extract the MCP-budget section from a markdown file by header text.
 * Returns null if the section is missing. Section runs from the matching
 * `## ` header up to the next `## ` header (or EOF).
 */
function extractSection(filePath, headerSubstring) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let inSection = false;
  let startDepth = 0;
  const collected = [];
  for (const line of lines) {
    const headerMatch = /^(#+)\s/.exec(line);
    if (headerMatch) {
      const depth = headerMatch[1].length;
      if (inSection) {
        // Section ends at a header at the same or shallower depth.
        // Subsections at deeper depth are part of the section.
        if (depth <= startDepth) break;
      } else if (line.toLowerCase().includes(headerSubstring.toLowerCase())) {
        inSection = true;
        startDepth = depth;
      }
    }
    if (inSection) collected.push(line);
  }
  return collected.length > 0 ? collected.join('\n') : null;
}

/**
 * Parse the MCP-budget section into a typed semantic-flag record.
 * Each flag answers a single behavioral question that #3025 requires
 * the prose to encode.
 */
function parseMcpBudgetSection(section) {
  if (!section || typeof section !== 'string') {
    return {
      ok: false,
      sectionLength: 0,
      explainsMcpAsBudgetConcern: false,
      namesEnabledMcpjsonServers: false,
      namesDisabledMcpjsonServers: false,
      namesClaudeSettingsJson: false,
      includesPrePhaseAudit: false,
      auditMentionsBrowserOrPlaywright: false,
      auditMentionsPlatformSpecific: false,
      auditMentionsCrossProject: false,
      explainsHarnessNotGsd: false,
      mentionsModelProfileInteraction: false,
      crossLinksContextBudget: false,
    };
  }
  // CR follow-up: strip inline markdown emphasis (`**`, `*`, `~~`) and
  // backticks before phrase-matching so e.g. "GSD does **not** manage"
  // is caught by the primary `gsd does not manage` alternative below.
  // WITHOUT this, the markdown-bold breaks the contiguous match and the
  // test only passes via the fallback branch (silent dead code).
  // Underscores are intentionally NOT stripped — `model_profile` and
  // other snake_case identifiers must survive intact so the
  // model_profile interaction check still finds them.
  const stripped = section.replace(/\*{1,3}|~{2}|`/g, '');
  // (1) Explains MCP as budget concern — must mention BOTH "MCP" / "tool
  // schema" AND a token/cost framing.
  const explainsMcpAsBudgetConcern =
    /\bmcp\b|tool schema|tool schemas/i.test(stripped) &&
    /\btoken|context budget|per[- ]turn|cost\b/i.test(stripped);
  // (2) Names the harness keys verbatim
  const namesEnabledMcpjsonServers = /enabledMcpjsonServers/.test(stripped);
  const namesDisabledMcpjsonServers = /disabledMcpjsonServers/.test(stripped);
  // (3) Names the settings file location
  const namesClaudeSettingsJson = /\.claude\/settings\.json/.test(stripped);
  // (4) Audit checklist — must mention all three classes the issue
  // calls out, plus a "before this phase / pre-phase" framing
  const includesPrePhaseAudit =
    /audit|checklist|review (your )?mcp|before (starting|beginning) (a |the )?phase/i.test(stripped);
  const auditMentionsBrowserOrPlaywright = /\bbrowser\b|playwright/i.test(stripped);
  const auditMentionsPlatformSpecific = /platform[- ]specific|mac[- ]?tools|windows[- ]?tools|os[- ]specific/i.test(stripped);
  const auditMentionsCrossProject = /(other|different|cross[- ])\s*project|stale (project )?mcp/i.test(stripped);
  // (5) Harness vs GSD distinction — must explicitly state GSD doesn't
  // own this knob and point at the harness
  const explainsHarnessNotGsd =
    /(gsd does(?:n[''’]t| not) (own|manage|control)|harness (concern|setting|controlled)|not a gsd (setting|knob))/i.test(stripped);
  // (6) Compounding with model_profile
  const mentionsModelProfileInteraction =
    /model[_ ]profile/i.test(stripped) &&
    /compound|multiplier|stack|every[- ]turn|regardless of (which )?model|in addition/i.test(stripped);
  // (7) Cross-link to the canonical reference doc — task-guide section
  // must point readers at context-budget.md for the full audit. Encoded
  // as a named flag (CR follow-up) so the assertion sits alongside the
  // other parsed invariants rather than as a one-off inline regex.
  const crossLinksContextBudget = /context-budget/i.test(stripped);
  return {
    ok: true,
    sectionLength: section.length,
    explainsMcpAsBudgetConcern,
    namesEnabledMcpjsonServers,
    namesDisabledMcpjsonServers,
    namesClaudeSettingsJson,
    includesPrePhaseAudit,
    auditMentionsBrowserOrPlaywright,
    auditMentionsPlatformSpecific,
    auditMentionsCrossProject,
    explainsHarnessNotGsd,
    mentionsModelProfileInteraction,
    crossLinksContextBudget,
  };
}

// ─── context-budget.md ──────────────────────────────────────────────────────

describe('#3025 context-budget.md: MCP token-budget section exists with required content', () => {
  test('the file exists', () => {
    assert.ok(fs.existsSync(CONTEXT_BUDGET_MD), `expected file at ${CONTEXT_BUDGET_MD}`);
  });

  test('has a section header that mentions MCP', () => {
    const section = extractSection(CONTEXT_BUDGET_MD, 'mcp');
    assert.ok(section, 'must have a `## ...MCP...` heading; section was not found');
  });

  test('explains MCP/tool schemas as a context-budget concern (#3025 requirement 1)', () => {
    const section = extractSection(CONTEXT_BUDGET_MD, 'mcp');
    const parsed = parseMcpBudgetSection(section);
    assert.equal(parsed.explainsMcpAsBudgetConcern, true,
      `must explain MCP/tool schemas as a token/context-budget concern; section was:\n${section}`);
  });

  test('names enabledMcpjsonServers and disabledMcpjsonServers (#3025 requirement 2)', () => {
    const section = extractSection(CONTEXT_BUDGET_MD, 'mcp');
    const parsed = parseMcpBudgetSection(section);
    assert.equal(parsed.namesEnabledMcpjsonServers, true,
      'section must reference `enabledMcpjsonServers` so users know the exact key');
    assert.equal(parsed.namesDisabledMcpjsonServers, true,
      'section must reference `disabledMcpjsonServers` for parity');
    assert.equal(parsed.namesClaudeSettingsJson, true,
      'section must name `.claude/settings.json` as the location of the toggle');
  });

  test('includes a pre-phase audit checklist with all three classes (#3025 requirement 3)', () => {
    const section = extractSection(CONTEXT_BUDGET_MD, 'mcp');
    const parsed = parseMcpBudgetSection(section);
    assert.equal(parsed.includesPrePhaseAudit, true,
      'section must include audit/checklist framing for pre-phase MCP review');
    assert.equal(parsed.auditMentionsBrowserOrPlaywright, true,
      'audit must mention browser/playwright tools as a candidate for disabling');
    assert.equal(parsed.auditMentionsPlatformSpecific, true,
      'audit must mention platform-specific tools (Mac/Windows/OS-specific)');
    assert.equal(parsed.auditMentionsCrossProject, true,
      'audit must mention stale/cross-project MCPs from other projects');
  });

  test('explains GSD does not own MCP enablement — harness concern (#3025 requirement 4)', () => {
    const section = extractSection(CONTEXT_BUDGET_MD, 'mcp');
    const parsed = parseMcpBudgetSection(section);
    assert.equal(parsed.explainsHarnessNotGsd, true,
      'section must explicitly state GSD does not manage MCP enablement (harness concern)');
  });

  test('notes interaction with model_profile (compounding levers) (#3025 requirement 5)', () => {
    const section = extractSection(CONTEXT_BUDGET_MD, 'mcp');
    const parsed = parseMcpBudgetSection(section);
    assert.equal(parsed.mentionsModelProfileInteraction, true,
      'section must note that trimming MCPs compounds with model_profile choice');
  });

  test('full semantic record matches the #3025 contract — typed snapshot', () => {
    const section = extractSection(CONTEXT_BUDGET_MD, 'mcp');
    const parsed = parseMcpBudgetSection(section);
    const contract = {
      ok: parsed.ok,
      explainsMcpAsBudgetConcern: parsed.explainsMcpAsBudgetConcern,
      namesEnabledMcpjsonServers: parsed.namesEnabledMcpjsonServers,
      namesDisabledMcpjsonServers: parsed.namesDisabledMcpjsonServers,
      namesClaudeSettingsJson: parsed.namesClaudeSettingsJson,
      includesPrePhaseAudit: parsed.includesPrePhaseAudit,
      auditMentionsBrowserOrPlaywright: parsed.auditMentionsBrowserOrPlaywright,
      auditMentionsPlatformSpecific: parsed.auditMentionsPlatformSpecific,
      auditMentionsCrossProject: parsed.auditMentionsCrossProject,
      explainsHarnessNotGsd: parsed.explainsHarnessNotGsd,
      mentionsModelProfileInteraction: parsed.mentionsModelProfileInteraction,
    };
    assert.deepStrictEqual(contract, {
      ok: true,
      explainsMcpAsBudgetConcern: true,
      namesEnabledMcpjsonServers: true,
      namesDisabledMcpjsonServers: true,
      namesClaudeSettingsJson: true,
      includesPrePhaseAudit: true,
      auditMentionsBrowserOrPlaywright: true,
      auditMentionsPlatformSpecific: true,
      auditMentionsCrossProject: true,
      explainsHarnessNotGsd: true,
      mentionsModelProfileInteraction: true,
    }, 'context-budget.md MCP section contract violated');
  });
});

// ─── docs/USER-GUIDE.md task section ────────────────────────────────────────

describe('#3025 docs/USER-GUIDE.md: companion task section exists', () => {
  test('USER-GUIDE.md has an MCP-trimming task section', () => {
    const section = extractSection(USER_GUIDE_MD, 'mcp');
    assert.ok(section,
      'USER-GUIDE.md must have a `### ...MCP...` task section so users find it via the guide');
  });

  test('USER-GUIDE.md task section names the harness key and cross-links the reference', () => {
    const section = extractSection(USER_GUIDE_MD, 'mcp');
    const parsed = parseMcpBudgetSection(section);
    assert.equal(parsed.namesEnabledMcpjsonServers, true,
      'task section must mention the harness key by name');
    // Cross-link to the reference doc — assert on the parsed flag so
    // the invariant lives alongside the other named flags (CR follow-up
    // on the no-source-grep standard).
    assert.equal(parsed.crossLinksContextBudget, true,
      'task section must cross-link to context-budget.md');
  });
});

// ─── markdownlint pre-flight (per bundle-docs-with-code skill) ──────────────

describe('#3025 markdownlint pre-flight: MD040 + MD056', () => {
  test('every fenced code block in the new MCP section has a language tag (MD040)', () => {
    const section = extractSection(CONTEXT_BUDGET_MD, 'mcp');
    // Guard: extractSection returns null when the section is missing.
    // Without this, `section.match(...)` would throw a TypeError instead
    // of producing a meaningful assertion failure (CR follow-up).
    assert.ok(section, 'MCP section not found in context-budget.md — cannot check MD040');
    const fences = (section.match(/^```([a-zA-Z0-9_+-]*)?\s*$/gm) || []);
    // Pairs of fences open/close; odd-indexed ones close blocks. Every
    // OPENING fence must have a language tag. Closing fences are bare ```.
    // Walk pairs: even index = opener, odd = closer.
    const openers = fences.filter((_, i) => i % 2 === 0);
    const missing = openers.filter((line) => /^```\s*$/.test(line));
    assert.deepStrictEqual(missing, [],
      `every fenced code block opener must have a language tag (MD040). Missing: ${JSON.stringify(missing)}`);
  });

  test('every markdown table row in the new MCP section has the same column count as its header (MD056)', () => {
    const section = extractSection(CONTEXT_BUDGET_MD, 'mcp');
    // Guard: same null-section concern as MD040 above (CR follow-up).
    assert.ok(section, 'MCP section not found in context-budget.md — cannot check MD056');
    const lines = section.split('\n');
    // Walk through and detect tables: header row followed by a separator
    // (--- pattern) followed by data rows. Count `|` per line.
    const issues = [];
    for (let i = 0; i < lines.length - 1; i += 1) {
      const header = lines[i];
      const sep = lines[i + 1];
      if (!/^\s*\|.*\|\s*$/.test(header)) continue;
      if (!/^\s*\|[\s\-:|]+\|\s*$/.test(sep)) continue;
      const headerCols = (header.match(/\|/g) || []).length;
      // Walk data rows
      for (let j = i + 2; j < lines.length; j += 1) {
        const row = lines[j];
        if (!/^\s*\|.*\|\s*$/.test(row)) break;
        const rowCols = (row.match(/\|/g) || []).length;
        if (rowCols !== headerCols) {
          issues.push({ line: j, expected: headerCols, actual: rowCols, row });
        }
      }
    }
    assert.deepStrictEqual(issues, [],
      `table rows must match header column count (MD056). Issues: ${JSON.stringify(issues, null, 2)}`);
  });
});
