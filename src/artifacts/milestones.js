// @ts-check
'use strict';

/**
 * MILESTONES.md parser and writer.
 *
 * Parses markdown table format for milestones and actions.
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
 * Parse a MILESTONES.md file into milestone and action objects.
 *
 * Handles hand-edited files permissively:
 * - Extra whitespace in table cells
 * - Misaligned columns
 * - Case-insensitive status
 * - Missing columns default to empty
 *
 * @param {string} content - Raw markdown content of MILESTONES.md
 * @returns {{ milestones: Array<{id: string, title: string, status: string, realizes: string[], causedBy: string[]}>, actions: Array<{id: string, title: string, status: string, causes: string[]}> }}
 */
function parseMilestonesFile(content) {
  if (!content || !content.trim()) {
    return { milestones: [], actions: [] };
  }

  // Split on ## sections
  const milestonesMatch = content.match(/## Milestones\s*\n([\s\S]*?)(?=## Actions|$)/i);
  const actionsMatch = content.match(/## Actions\s*\n([\s\S]*?)$/i);

  const milestoneRows = milestonesMatch ? parseMarkdownTable(milestonesMatch[1]) : [];
  const actionRows = actionsMatch ? parseMarkdownTable(actionsMatch[1]) : [];

  const milestones = milestoneRows.map(row => ({
    id: (row['ID'] || '').trim(),
    title: (row['Title'] || '').trim(),
    status: (row['Status'] || 'PENDING').trim().toUpperCase(),
    realizes: splitMultiValue(row['Realizes'] || ''),
    causedBy: splitMultiValue(row['Caused By'] || ''),
  })).filter(m => m.id);

  const actions = actionRows.map(row => ({
    id: (row['ID'] || '').trim(),
    title: (row['Title'] || '').trim(),
    status: (row['Status'] || 'PENDING').trim().toUpperCase(),
    causes: splitMultiValue(row['Causes'] || ''),
  })).filter(a => a.id);

  return { milestones, actions };
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
 * Write milestones and actions to canonical MILESTONES.md format.
 * Columns are aligned for readability.
 *
 * @param {Array<{id: string, title: string, status: string, realizes: string[], causedBy: string[]}>} milestones
 * @param {Array<{id: string, title: string, status: string, causes: string[]}>} actions
 * @param {string} projectName
 * @returns {string} Canonical markdown content
 */
function writeMilestonesFile(milestones, actions, projectName) {
  const lines = [`# Milestones & Actions: ${projectName}`, ''];

  // -- Milestones table --
  lines.push('## Milestones', '');

  const mHeaders = ['ID', 'Title', 'Status', 'Realizes', 'Caused By'];
  const mRows = milestones.map(m => [
    m.id,
    m.title,
    m.status,
    m.realizes.join(', '),
    m.causedBy.join(', '),
  ]);

  lines.push(...formatTable(mHeaders, mRows));
  lines.push('');

  // -- Actions table --
  lines.push('## Actions', '');

  const aHeaders = ['ID', 'Title', 'Status', 'Causes'];
  const aRows = actions.map(a => [
    a.id,
    a.title,
    a.status,
    a.causes.join(', '),
  ]);

  lines.push(...formatTable(aHeaders, aRows));
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
