/**
 * Bug #2876: SKILL.md frontmatter parse failure when `description` begins
 * with a YAML flow indicator like `[BETA]`.
 *
 *   description: [BETA] Offload plan phase to Claude Code's ultraplan…
 *
 * YAML 1.2 treats a leading `[` as the start of a flow sequence, so any
 * downstream parser (gh-copilot, JetBrains' kit, etc.) fails with
 * "Unexpected scalar at node end". The Copilot/Antigravity/Trae/Codebuddy
 * skill+agent converters in `bin/install.js` re-emit the description
 * unquoted; the Claude variant `yamlQuote(...)`s it. Bring the others
 * in line so any value is round-trip-safe regardless of leading char.
 *
 * The test is structural: it parses each emitted frontmatter into lines
 * and asserts the `description` value is a quoted YAML scalar (double or
 * single quoted) when the source description starts with a flow indicator.
 * It does not regex the bytes for substrings.
 */
'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
const installPath = path.resolve(REPO_ROOT, pkg.bin['get-shit-done-cc']);
const install = require(installPath);

// Build a minimal Claude command source whose description starts with the
// reporter's exact flow-indicator prefix. Apostrophe in the body forces
// any naive single-quoting to also escape correctly — the canonical
// safe form is `JSON.stringify(...)` (used by yamlQuote).
const REPORTER_DESCRIPTION =
  "[BETA] Offload plan phase to Claude Code's ultraplan cloud — drafts remotely while terminal stays free, review in browser with inline comments, import back via /gsd-import. Claude Code only.";

// Use unquoted description in the source frontmatter — that's exactly the
// shape that ships in commands/gsd/*.md when authors paste a description
// without quoting it (see commands/gsd/ultraplan-phase.md). The bug is
// triggered when the converter re-emits this same value to the destination
// runtime without quoting. `extractFrontmatterField` strips a single outer
// quote pair but does not unescape internal characters, so quoting the
// fixture input would actually mask the bug.
function buildClaudeCommand(description) {
  return [
    '---',
    'name: gsd:ultraplan-phase',
    `description: ${description}`,
    'argument-hint: "[phase-number]"',
    'allowed-tools:',
    '  - Read',
    '  - Bash',
    '---',
    '',
    '# body',
    '',
  ].join('\n');
}

function buildClaudeAgent(description) {
  return [
    '---',
    'name: gsd-extract-learnings',
    `description: ${description}`,
    'tools: Read, Bash',
    '---',
    '',
    '# body',
    '',
  ].join('\n');
}

function extractFrontmatter(content) {
  // Leading delimiter is `---\n`; closing is the next standalone `---`
  // on its own line. Tests parse line-structurally so the assertion
  // doesn't drift on whitespace/order changes (per project test-rigor).
  assert.ok(content.startsWith('---'), `output must begin with frontmatter, got: ${content.slice(0, 40)}`);
  const lines = content.split('\n');
  let openIdx = -1;
  let closeIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      if (openIdx === -1) openIdx = i;
      else { closeIdx = i; break; }
    }
  }
  assert.ok(openIdx !== -1 && closeIdx !== -1, `output must have a closed frontmatter block, got:\n${content}`);
  return lines.slice(openIdx + 1, closeIdx);
}

function findDescriptionLine(frontmatterLines) {
  for (const line of frontmatterLines) {
    if (line.startsWith('description:')) return line;
  }
  assert.fail(`no description line found in frontmatter:\n${frontmatterLines.join('\n')}`);
  return ''; // unreachable
}

function isQuotedYamlScalar(valueText) {
  // YAML safe-quoted scalar: starts with `"` and ends with `"`, OR
  // starts with `'` and ends with `'`. This is what `yamlQuote()`
  // (JSON.stringify) and the Claude variant of these converters emit.
  const trimmed = valueText.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return true;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return true;
  return false;
}

function parseQuotedYamlValue(valueText) {
  const trimmed = valueText.trim();
  if (trimmed.startsWith('"')) return JSON.parse(trimmed);
  if (trimmed.startsWith("'")) return trimmed.slice(1, -1).replace(/''/g, "'");
  return trimmed;
}

function assertDescriptionRoundTrips(emitted, expected, label) {
  const fmLines = extractFrontmatter(emitted);
  const descLine = findDescriptionLine(fmLines);
  const valueText = descLine.slice('description:'.length);
  assert.ok(
    isQuotedYamlScalar(valueText),
    `(${label}) description must be a quoted YAML scalar (parser-safe for leading flow indicators). Got line: ${descLine}`,
  );
  assert.strictEqual(
    parseQuotedYamlValue(valueText),
    expected,
    `(${label}) description must round-trip through YAML quoting unchanged.`,
  );
}

const COMMAND_CONVERTERS = [
  { label: 'convertClaudeCommandToCopilotSkill', fn: (src) => install.convertClaudeCommandToCopilotSkill(src, 'gsd-ultraplan-phase') },
  { label: 'convertClaudeCommandToAntigravitySkill', fn: (src) => install.convertClaudeCommandToAntigravitySkill(src, 'gsd-ultraplan-phase') },
  { label: 'convertClaudeCommandToTraeSkill', fn: (src) => install.convertClaudeCommandToTraeSkill(src, 'gsd-ultraplan-phase') },
  { label: 'convertClaudeCommandToCodebuddySkill', fn: (src) => install.convertClaudeCommandToCodebuddySkill(src, 'gsd-ultraplan-phase') },
];

const AGENT_CONVERTERS = [
  { label: 'convertClaudeAgentToCopilotAgent', fn: (src) => install.convertClaudeAgentToCopilotAgent(src) },
  { label: 'convertClaudeAgentToAntigravityAgent', fn: (src) => install.convertClaudeAgentToAntigravityAgent(src) },
];

// A grab-bag of leading characters that all break unquoted YAML scalar
// parsing per YAML 1.2 §7.3.3 / §6.9. The reporter's case is `[`; the
// rest defend against neighbouring drift.
const FLOW_HOSTILE_PREFIXES = ['[', '{', '*', '&', '!', '|', '>', '%', '@', '`'];

// Some converters (Trae, CodeBuddy) deliberately rewrite "Claude Code"
// in body content to their target runtime name, and the rewrite cuts
// across the description too. That's correct behavior — out of scope for
// the YAML-quoting fix — so for the reporter case we assert only the
// quoting requirement, not byte-equality of the round-tripped value.
function assertDescriptionIsQuoted(emitted, label) {
  const fmLines = extractFrontmatter(emitted);
  const descLine = findDescriptionLine(fmLines);
  const valueText = descLine.slice('description:'.length);
  assert.ok(
    isQuotedYamlScalar(valueText),
    `(${label}) description must be a quoted YAML scalar (parser-safe for leading flow indicators). Got line: ${descLine}`,
  );
}

describe('bug-2876: skill+agent converters emit YAML-quoted description', () => {
  for (const { label, fn } of COMMAND_CONVERTERS) {
    test(`${label}: reporter's "[BETA] ..." description is quoted`, () => {
      const out = fn(buildClaudeCommand(REPORTER_DESCRIPTION));
      assertDescriptionIsQuoted(out, label);
    });
    for (const prefix of FLOW_HOSTILE_PREFIXES) {
      test(`${label}: leading ${JSON.stringify(prefix)} is quoted`, () => {
        // Avoid leading/trailing `'` or `"` in the payload — `extractFrontmatterField`
        // strips a single outer quote char of either kind regardless of whether
        // the value was actually quoted, which would obscure the round-trip
        // assertion. Pre-existing behavior, out of scope for #2876.
        const desc = `${prefix} edge-case payload — flow indicator at start`;
        const out = fn(buildClaudeCommand(desc));
        assertDescriptionRoundTrips(out, desc, `${label} prefix=${prefix}`);
      });
    }
  }

  for (const { label, fn } of AGENT_CONVERTERS) {
    test(`${label}: reporter-shape "[BETA] ..." description is quoted`, () => {
      const out = fn(buildClaudeAgent(REPORTER_DESCRIPTION));
      assertDescriptionIsQuoted(out, label);
    });
  }
});
