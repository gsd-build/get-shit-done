// @ts-check
'use strict';

/**
 * MILESTONES.md parser and writer.
 *
 * Parses markdown table format for milestones (no actions -- actions live in PLAN.md files).
 * Writes back to canonical aligned-column format.
 *
 * Permissive on input (handles hand-edited files), strict on output.
 * Zero runtime dependencies. CJS module.
 */

/**
 * Parse a markdown table into an array of row objects keyed by header names.
 * Handles extra whitespace, misaligned columns, and empty cells.
 *
 * @param {string} text - Markdown text containing a table
 * @returns {Array<Record<string, string>>}
 */
function parseMarkdownTable(text) {
  const lines = text.trim().split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split('|')
    .map(h => h.trim())
    .filter(Boolean);

  // Skip separator line (lines[1] is the |---|---| row)
  return lines.slice(2).map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] || '';
    });
    return row;
  });
}

/**
 * Split a comma-separated multi-value field into a trimmed array.
 * Handles both "M-01, M-02" and "M-01,M-02" (no space).
 *
 * @param {string} value
 * @returns {string[]}
 */
function splitMultiValue(value) {
  if (!value || !value.trim()) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Parse a MILESTONES.md file into milestone objects.
 *
 * Handles hand-edited files permissively:
 * - Extra whitespace in table cells
 * - Misaligned columns
 * - Case-insensitive status
 * - Missing columns default to empty
 * - Backward compatible: parses both old format (Caused By column) and new format (Plan column)
 *
 * @param {string} content - Raw markdown content of MILESTONES.md
 * @returns {{ milestones: Array<{id: string, title: string, status: string, realizes: string[], hasPlan: boolean}> }}
 */
function parseMilestonesFile(content) {
  if (!content || !content.trim()) {
    return { milestones: [] };
  }

  // Match ## Milestones section (stop at any other ## or end of file)
  const milestonesMatch = content.match(/## Milestones\s*\n([\s\S]*?)(?=## |$)/i);
  const milestoneRows = milestonesMatch ? parseMarkdownTable(milestonesMatch[1]) : [];

  const milestones = milestoneRows.map(row => ({
    id: (row['ID'] || '').trim(),
    title: (row['Title'] || '').trim(),
    status: (row['Status'] || 'PENDING').trim().toUpperCase(),
    realizes: splitMultiValue(row['Realizes'] || ''),
    hasPlan: (row['Plan'] || '').trim().toUpperCase() === 'YES',
  })).filter(m => m.id);

  return { milestones };
}

/**
 * Pad a string to a given width.
 * @param {string} str
 * @param {number} width
 * @returns {string}
 */
function pad(str, width) {
  return str + ' '.repeat(Math.max(0, width - str.length));
}

/**
 * Write milestones to canonical MILESTONES.md format.
 * Columns are aligned for readability.
 *
 * Backward compatibility: accepts 2-arg (milestones, projectName) or
 * 3-arg (milestones, actions, projectName) signature. If 3 args and
 * second is an array, treats as old signature and ignores actions.
 *
 * @param {Array<{id: string, title: string, status: string, realizes: string[], hasPlan?: boolean}>} milestones
 * @param {string | Array} projectNameOrActions - Project name string, or actions array (backward compat)
 * @param {string} [maybeProjectName] - Project name when using old 3-arg signature
 * @returns {string} Canonical markdown content
 */
function writeMilestonesFile(milestones, projectNameOrActions, maybeProjectName) {
  // Backward compat: old signature was (milestones, actions, projectName)
  const projectName = maybeProjectName || (typeof projectNameOrActions === 'string' ? projectNameOrActions : 'Project');

  const lines = [`# Milestones: ${projectName}`, ''];

  // -- Milestones table --
  lines.push('## Milestones', '');

  const mHeaders = ['ID', 'Title', 'Status', 'Realizes', 'Plan'];
  const mRows = milestones.map(m => [
    m.id,
    m.title,
    m.status,
    m.realizes.join(', '),
    m.hasPlan ? 'YES' : 'NO',
  ]);

  lines.push(...formatTable(mHeaders, mRows));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format headers and rows into aligned markdown table lines.
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {string[]}
 */
function formatTable(headers, rows) {
  // Calculate column widths
  const widths = headers.map((h, i) => {
    const cellWidths = rows.map(r => (r[i] || '').length);
    return Math.max(h.length, ...cellWidths);
  });

  const headerLine = '| ' + headers.map((h, i) => pad(h, widths[i])).join(' | ') + ' |';
  const separatorLine = '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|';
  const dataLines = rows.map(row =>
    '| ' + row.map((cell, i) => pad(cell, widths[i])).join(' | ') + ' |'
  );

  return [headerLine, separatorLine, ...dataLines];
}

module.exports = { parseMilestonesFile, writeMilestonesFile, parseMarkdownTable };
