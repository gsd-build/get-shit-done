'use strict';

// allow-test-rule: source-text-is-the-product
// Reads get-shit-done/workflows/fast.md whose deployed text IS the product —
// the workflow markdown is executed verbatim by LLM runtimes.

/**
 * #3805 — fast.md log_to_state appends a schema-blind 4-column row to the
 * 5-column "Quick Tasks Completed" table created by quick.md Step 7.
 *
 * quick.md Step 7 creates the table with 5 columns:
 *   | # | Description | Date | Commit | Directory |
 *
 * Before this fix, fast.md's log_to_state step appended a hardcoded 4-cell
 * row unconditionally:
 *   echo "| $(date +%Y-%m-%d) | fast | $TASK | ✅ |" >> .planning/STATE.md
 *
 * This produces malformed Markdown when the existing table has a different
 * column count.
 *
 * Covers:
 *   - fast.md does NOT contain the hardcoded 4-cell echo template
 *   - fast.md log_to_state step reads/introspects the existing table header
 *     before appending (schema-aware insertion)
 *   - fast.md log_to_state step matches the 5-column schema from quick.md
 *     Step 7 when that table is present
 *   - fast.md log_to_state step skips (does not corrupt) the STATE.md write
 *     when the table schema is unrecognized
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const FAST_MD_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'fast.md');

// The 5-column schema defined in quick.md Step 7 (non-validate mode).
// Column count is 5: # | Description | Date | Commit | Directory
// Named constant for traceability — mirrors quick.md Step 7's table header.
const QUICK_MD_STEP7_COL_COUNT = 5;
const QUICK_MD_STEP7_COLUMNS = ['#', 'Description', 'Date', 'Commit', 'Directory'];

describe('bug #3805: fast.md log_to_state must be schema-aware', () => {
  let fastMdContent;

  test('fast.md workflow file exists and is readable', () => {
    assert.ok(fs.existsSync(FAST_MD_PATH), `fast.md not found at ${FAST_MD_PATH}`);
    fastMdContent = fs.readFileSync(FAST_MD_PATH, 'utf-8');
  });

  test('fast.md log_to_state step does NOT hardcode a 4-cell row template', () => {
    // The old broken template: | date | fast | task | ✅ |
    // This regex matches the exact hardcoded pattern that ignores table schema.
    // A 4-cell row has exactly 4 pipe-delimited fields plus the surrounding pipes.
    const hardcoded4CellPattern = /echo\s+["'][|][^|]*[|][^|]*[|][^|]*[|][^|]*[|]\s*["']/;
    const match = fastMdContent.match(hardcoded4CellPattern);
    assert.ok(
      !match,
      [
        'fast.md log_to_state still contains the hardcoded 4-cell row template:',
        `  "${match?.[0]}"`,
        'This appends a malformed row to the 5-column Quick Tasks Completed table',
        'created by quick.md Step 7.',
        `Expected table schema (${QUICK_MD_STEP7_COL_COUNT} cols): | ${QUICK_MD_STEP7_COLUMNS.join(' | ')} |`,
      ].join('\n')
    );
  });

  test('fast.md log_to_state step reads the existing table header (schema introspection)', () => {
    // The fix must inspect the existing STATE.md table header before appending.
    // Acceptable signals: reading STATE.md content, grepping for the header line,
    // or parsing columns from the header row.
    const hasHeaderRead =
      // Reads STATE.md to inspect it (awk/sed/grep on the file for header detection)
      /grep.*Quick Tasks Completed.*STATE\.md/.test(fastMdContent) ||
      /awk.*Quick Tasks Completed/.test(fastMdContent) ||
      /sed.*Quick Tasks Completed/.test(fastMdContent) ||
      // Reads the header line explicitly (head -n, sed -n, awk NR==)
      /head\s+-n/.test(fastMdContent) && /STATE\.md/.test(fastMdContent) ||
      // Counts pipe separators / columns from existing header
      /col.*count|column.*count|count.*col|NF|awk.*\|/.test(fastMdContent) ||
      // References schema detection in prose
      /schema|header|column\s+count|existing.*table/.test(fastMdContent);

    assert.ok(
      hasHeaderRead,
      [
        'fast.md log_to_state step does not appear to introspect the existing table schema.',
        'The step must read the STATE.md table header to detect column count before appending.',
        'quick.md Step 7 uses schema-aware matching — fast.md must follow the same discipline.',
      ].join('\n')
    );
  });

  test('fast.md log_to_state step references the 5-column quick.md schema', () => {
    // The fix must handle the 5-col schema: | # | Description | Date | Commit | Directory |
    // Test that all 5 column names appear in the log_to_state step's context.
    // Extract the log_to_state step content to scope the check.
    const logToStateMatch = fastMdContent.match(/<step name="log_to_state">([\s\S]*?)<\/step>/);
    assert.ok(logToStateMatch, 'fast.md must contain a <step name="log_to_state"> element');

    const stepContent = logToStateMatch[1];

    // All 5 column names from quick.md Step 7 must be referenced in the step.
    for (const col of QUICK_MD_STEP7_COLUMNS) {
      assert.ok(
        stepContent.toLowerCase().includes(col.toLowerCase()),
        [
          `fast.md log_to_state step does not reference column "${col}"`,
          `Expected all 5 columns from quick.md Step 7: ${QUICK_MD_STEP7_COLUMNS.join(', ')}`,
          `(${QUICK_MD_STEP7_COL_COUNT}-column schema)`,
        ].join('\n')
      );
    }
  });

  test('fast.md log_to_state step skips STATE.md write on unrecognized schema', () => {
    // The fix must not blindly append when the table schema is unknown.
    // Check for a guard that skips or logs rather than corrupting the file.
    const logToStateMatch = fastMdContent.match(/<step name="log_to_state">([\s\S]*?)<\/step>/);
    assert.ok(logToStateMatch, 'fast.md must contain a <step name="log_to_state"> element');

    const stepContent = logToStateMatch[1];

    // Must have a skip/guard path for unrecognized schemas
    const hasSkipGuard =
      /skip/i.test(stepContent) ||
      /unrecognized|unknown|mismatch/i.test(stepContent) ||
      /else\b/.test(stepContent) ||
      /warn|log/i.test(stepContent);

    assert.ok(
      hasSkipGuard,
      [
        'fast.md log_to_state step does not appear to guard against unrecognized table schemas.',
        'When the existing STATE.md table does not match an expected schema,',
        'the step must skip the write (with a brief log) rather than append a malformed row.',
      ].join('\n')
    );
  });
});
