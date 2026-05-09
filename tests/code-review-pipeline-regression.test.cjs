// allow-test-rule: source-text-is-the-product
// The workflow and agent .md files ARE the product: their text is loaded and
// executed/interpreted at runtime by the agent host. Testing that specific
// strings exist within these files tests the deployed contract, not an
// implementation detail. No runtime API exists to enumerate the label accept-
// list or filter-set definitions — the text IS the specification.
//
// Bug 1 (compute_file_scope) — The inline Node.js script embedded in the
// workflow .md is the parser. The test implements the identical parse logic as
// a pure JS function (mirroring lines 172-184 of code-review.md exactly) and
// asserts on its structured output. A separate docs-parity assertion checks
// that the workflow .md contains the hyphen-aware boundary regex and the
// em-dash/parenthetical stripping — both of which are the deployed contract.
//
// Bug 2 (present_results) — Tested both behaviourally (pure JS helper that
// mimics the grep|cut pipeline) and via docs-parity on the workflow .md text.
//
// Bugs 3 and reviewer contract — docs-parity only on agents/*.md: the filter-
// set definition and label-equivalence contract exist only as text in those
// files; there is no runtime enumeration API.

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW_PATH = path.join(ROOT, 'get-shit-done', 'workflows', 'code-review.md');
const FIXER_PATH = path.join(ROOT, 'agents', 'gsd-code-fixer.md');
const REVIEWER_PATH = path.join(ROOT, 'agents', 'gsd-code-reviewer.md');

// ---------------------------------------------------------------------------
// Pure-function implementation of the compute_file_scope Node script body.
// This mirrors the logic in code-review.md lines 172-184 exactly.
// If those lines change, this function must be updated in tandem (and the
// docs-parity assertions below will catch a mismatch at the regex level).
// ---------------------------------------------------------------------------
function parseKeyFiles(yaml) {
  const files = [];
  let inSection = null;
  for (const line of yaml.split('\n')) {
    if (/^\s+created:/.test(line)) { inSection = 'created'; continue; }
    if (/^\s+modified:/.test(line)) { inSection = 'modified'; continue; }
    // Hyphen-aware boundary: reset inSection for ANY key: line (including key-decisions:, etc.)
    if (/^\s*[\w-]+:/.test(line) && !/^\s*-/.test(line)) { inSection = null; continue; }
    if (inSection && /^\s+-\s+(.+)/.test(line)) {
      let raw = line.match(/^\s+-\s+(.+)/)[1].trim();
      raw = raw.replace(/^['"]|['"]$/g, '');
      // Order matters: parens BEFORE em-dash because em-dashes can appear inside parens
      raw = raw.replace(/\s+\([^)]*\)\s*$/, '');
      raw = raw.split(/\s+—\s/)[0].trim();
      if (/\//.test(raw) && /\.[A-Za-z0-9]+$/.test(raw)) {
        files.push(raw);
      }
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Pure-function implementation of the present_results severity-label parser.
// Mirrors the grep -E "^\s*(critical|blocker):" | head -1 | cut -d: -f2 | xargs
// pipeline from code-review.md.
// ---------------------------------------------------------------------------
function parseFrontmatterCritical(frontmatter) {
  const lines = frontmatter.split('\n');
  const match = lines.find((l) => /^\s*(critical|blocker):/.test(l));
  if (!match) return { critical: 0 };
  const value = match.split(':').slice(1).join(':').trim();
  return { critical: parseInt(value, 10) || 0 };
}

// ---------------------------------------------------------------------------
// BUG 1 — SUMMARY parser: compute_file_scope must not bleed prose from
// hyphenated sections (key-decisions:, patterns-established:, etc.) into the
// file list, and must strip em-dash descriptions and parentheticals.
// ---------------------------------------------------------------------------
describe('Bug 1 — compute_file_scope SUMMARY parser', () => {
  test('extracts only key-files.created and key-files.modified entries', () => {
    const yaml = [
      'key-files:',
      '  created:',
      '    - app/foo.tsx',
      '  modified:',
      '    - lib/bar.ts',
      'key-decisions:',
      '  - We chose RSC for performance reasons',
      'patterns-established:',
      '  - Always validate at the boundary',
      'requirements-completed:',
      '  - REQ-01 done',
    ].join('\n');

    const files = parseKeyFiles(yaml);
    assert.deepStrictEqual(files.sort(), ['app/foo.tsx', 'lib/bar.ts'].sort());
  });

  test('strips em-dash narrative from bullet: "app/foo.tsx — RSC catalogue with filters"', () => {
    const yaml = [
      'key-files:',
      '  created:',
      '    - app/foo.tsx — RSC catalogue with topic/mode/date filters',
    ].join('\n');

    const files = parseKeyFiles(yaml);
    assert.deepStrictEqual(files, ['app/foo.tsx']);
  });

  test('strips parenthetical from bullet: "tests/bar.test.ts (122 lines — 17 assertions)"', () => {
    const yaml = [
      'key-files:',
      '  created:',
      '    - tests/bar.test.ts (122 lines — 17 assertions)',
    ].join('\n');

    const files = parseKeyFiles(yaml);
    assert.deepStrictEqual(files, ['tests/bar.test.ts']);
  });

  test('hyphenated sections in any order produce identical results', () => {
    const yamlA = [
      'key-decisions:',
      '  - Some decision',
      'key-files:',
      '  created:',
      '    - src/index.ts',
      'patterns-established:',
      '  - Some pattern',
    ].join('\n');

    const yamlB = [
      'patterns-established:',
      '  - Some pattern',
      'key-files:',
      '  created:',
      '    - src/index.ts',
      'key-decisions:',
      '  - Some decision',
    ].join('\n');

    assert.deepStrictEqual(parseKeyFiles(yamlA), parseKeyFiles(yamlB));
    assert.deepStrictEqual(parseKeyFiles(yamlA), ['src/index.ts']);
  });

  test('prose-only bullets from key-decisions are never included in file list', () => {
    const yaml = [
      'key-decisions:',
      '  - We chose RSC for performance reasons',
      '  - Deferred auth to Phase 3',
      'key-files:',
      '  created:',
      '    - app/page.tsx',
    ].join('\n');

    const files = parseKeyFiles(yaml);
    assert.deepStrictEqual(files, ['app/page.tsx']);
  });

  // Docs-parity: the workflow .md must contain the hyphen-aware boundary regex
  // so what we tested above is actually what is deployed.
  test('code-review.md contains hyphen-aware boundary regex [\\w-]+', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    // Locate the Node script block in the compute_file_scope step
    const scriptStart = src.indexOf('const files = [];');
    assert.ok(scriptStart !== -1, 'compute_file_scope script must contain "const files = [];"');
    const scriptEnd = src.indexOf('if (files.length)', scriptStart);
    const scriptSection = src.slice(scriptStart, scriptEnd);
    // Must use [\\w-]+ (hyphen-aware) not \\w+ only
    const hasHyphenAwareRegex = scriptSection.includes('[\\\\w-]') || scriptSection.includes('[\\w-]');
    assert.ok(
      hasHyphenAwareRegex,
      'compute_file_scope boundary regex must be hyphen-aware ([\\w-]+), found section:\n' + scriptSection
    );
  });

  // Docs-parity: the workflow .md must contain the em-dash and parenthetical stripping.
  test('code-review.md contains em-dash split and parenthetical strip in script body', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const scriptStart = src.indexOf('const files = [];');
    const scriptEnd = src.indexOf('if (files.length)', scriptStart);
    const scriptSection = src.slice(scriptStart, scriptEnd);
    assert.ok(
      scriptSection.includes('replace(/\\s+\\([^)]*\\)\\s*$/, \'\')'),
      'Script must strip parentheticals with replace(/\\s+\\([^)]*\\)\\s*$/, \'\')'
    );
    assert.ok(
      scriptSection.includes('split(/\\s+—\\s'),
      'Script must split on em-dash to strip narrative'
    );
  });
});

// ---------------------------------------------------------------------------
// BUG 2 — severity-label parser: present_results must accept both `critical:`
// and `blocker:` as Critical-tier frontmatter keys.
// ---------------------------------------------------------------------------
describe('Bug 2 — present_results severity-label parser', () => {
  test('frontmatter with blocker: 8 is parsed as critical: 8', () => {
    const frontmatter = [
      'phase: 03-courses',
      'reviewed: 2025-01-01T00:00:00Z',
      'findings:',
      '  blocker: 8',
      '  warning: 2',
      '  info: 0',
      '  total: 10',
      'status: issues_found',
    ].join('\n');

    const result = parseFrontmatterCritical(frontmatter);
    assert.strictEqual(result.critical, 8);
  });

  test('frontmatter with critical: 5 is parsed as critical: 5', () => {
    const frontmatter = [
      'phase: 03-courses',
      'reviewed: 2025-01-01T00:00:00Z',
      'findings:',
      '  critical: 5',
      '  warning: 1',
      '  info: 0',
      '  total: 6',
      'status: issues_found',
    ].join('\n');

    const result = parseFrontmatterCritical(frontmatter);
    assert.strictEqual(result.critical, 5);
  });

  test('frontmatter with neither critical nor blocker returns 0', () => {
    const frontmatter = [
      'phase: 03-courses',
      'findings:',
      '  warning: 3',
      '  info: 1',
      '  total: 4',
      'status: issues_found',
    ].join('\n');

    const result = parseFrontmatterCritical(frontmatter);
    assert.strictEqual(result.critical, 0);
  });

  // Docs-parity: the workflow .md must contain the updated grep pattern.
  test('code-review.md present_results grep accepts both critical and blocker labels', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.ok(
      src.includes('grep -E "^[[:space:]]*(critical|blocker):"'),
      'code-review.md present_results must grep for both critical: and blocker: labels'
    );
  });

  // Docs-parity: the workflow .md must contain the updated grep for BL- headings.
  test('code-review.md present_results grep includes BL- headings alongside CR- and WR-', () => {
    const src = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.ok(
      src.includes('### BL-') && src.includes('### CR-') && src.includes('### WR-'),
      'code-review.md present_results must grep for BL- alongside CR- and WR- headings'
    );
  });
});

// ---------------------------------------------------------------------------
// BUG 3 — fixer agent ID alphabet and filter sets must include BL-* alongside CR-*.
// ---------------------------------------------------------------------------
describe('Bug 3 — gsd-code-fixer BL-* inclusion in filter sets', () => {
  test('finding_parser documents BL-\\d+ as Critical-tier-equivalent', () => {
    const src = fs.readFileSync(FIXER_PATH, 'utf8');
    const parserStart = src.indexOf('<finding_parser>');
    const parserEnd = src.indexOf('</finding_parser>');
    assert.ok(parserStart !== -1, 'gsd-code-fixer.md must have a <finding_parser> block');
    const parserSection = src.slice(parserStart, parserEnd);
    assert.ok(
      parserSection.includes('BL-'),
      'finding_parser block must document BL-* as a Critical-tier-equivalent ID prefix'
    );
  });

  test('parse_findings step documents severity as "Critical (CR-* or BL-*)"', () => {
    const src = fs.readFileSync(FIXER_PATH, 'utf8');
    const stepStart = src.indexOf('<step name="parse_findings">');
    const stepEnd = src.indexOf('</step>', stepStart);
    assert.ok(stepStart !== -1, 'gsd-code-fixer.md must have a parse_findings step');
    const stepSection = src.slice(stepStart, stepEnd);
    assert.ok(
      stepSection.includes('CR-* or BL-*') || stepSection.includes('CR-* and BL-*'),
      'parse_findings step must describe Critical severity as "CR-* or BL-*"'
    );
  });

  test('critical_warning filter set includes BL-* alongside CR-* and WR-*', () => {
    const src = fs.readFileSync(FIXER_PATH, 'utf8');
    const stepStart = src.indexOf('<step name="parse_findings">');
    const stepEnd = src.indexOf('</step>', stepStart);
    const stepSection = src.slice(stepStart, stepEnd);

    const critWarningIdx = stepSection.indexOf('critical_warning');
    assert.ok(critWarningIdx !== -1, 'parse_findings must define critical_warning filter');
    const lineStart = stepSection.lastIndexOf('\n', critWarningIdx);
    const lineEnd = stepSection.indexOf('\n', critWarningIdx);
    const filterLine = stepSection.slice(lineStart, lineEnd);
    assert.ok(
      filterLine.includes('BL-'),
      'critical_warning filter line must include BL-*: ' + filterLine.trim()
    );
  });

  test('sort order description mentions both CR-* and BL-* for Critical tier', () => {
    const src = fs.readFileSync(FIXER_PATH, 'utf8');
    const stepStart = src.indexOf('<step name="parse_findings">');
    const stepEnd = src.indexOf('</step>', stepStart);
    const stepSection = src.slice(stepStart, stepEnd);
    assert.ok(
      stepSection.includes('BL-'),
      'parse_findings sort-order description must mention BL-* as Critical-tier alongside CR-*'
    );
  });
});

// ---------------------------------------------------------------------------
// REVIEWER CONTRACT — gsd-code-reviewer.md must acknowledge BL-/blocker: as
// an accepted alternative to CR-/critical: (tier-equivalent).
// ---------------------------------------------------------------------------
describe('Reviewer contract — gsd-code-reviewer.md label-equivalence', () => {
  test('write_review step documents blocker: as accepted alternative to critical:', () => {
    const src = fs.readFileSync(REVIEWER_PATH, 'utf8');
    const stepStart = src.indexOf('<step name="write_review">');
    const stepEnd = src.indexOf('</step>', stepStart);
    assert.ok(stepStart !== -1, 'gsd-code-reviewer.md must have a write_review step');
    const stepSection = src.slice(stepStart, stepEnd);
    assert.ok(
      stepSection.includes('blocker'),
      'write_review step must acknowledge blocker: as a tier-equivalent alternative to critical:'
    );
  });

  test('write_review step acknowledges BL- finding ID prefix as Critical-tier-equivalent', () => {
    const src = fs.readFileSync(REVIEWER_PATH, 'utf8');
    const stepStart = src.indexOf('<step name="write_review">');
    const stepEnd = src.indexOf('</step>', stepStart);
    const stepSection = src.slice(stepStart, stepEnd);
    assert.ok(
      stepSection.includes('BL-'),
      'write_review step must acknowledge BL- as a Critical-tier-equivalent finding ID prefix'
    );
  });
});
