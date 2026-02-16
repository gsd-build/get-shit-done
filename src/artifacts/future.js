// @ts-check
'use strict';

/**
 * FUTURE.md parser and writer.
 *
 * Parses section-card format (## D-XX: Title) into declaration objects.
 * Writes declarations back to canonical markdown format.
 *
 * Permissive on input (handles hand-edited files), strict on output.
 * Zero runtime dependencies. CJS module.
 */

/**
 * Extract a bold field value from a set of lines.
 * Matches **FieldName:** value (case-insensitive field name).
 * @param {string[]} lines
 * @param {string} field
 * @returns {string | null}
 */
function extractField(lines, field) {
  const pattern = new RegExp(`^\\*\\*${field}:\\*\\*`, 'i');
  const line = lines.find(l => pattern.test(l.trim()));
  if (!line) return null;
  return line.trim().replace(/^\*\*[^:]+:\*\*\s*/, '').trim();
}

/**
 * Parse a FUTURE.md file into an array of declaration objects.
 *
 * Handles hand-edited files permissively:
 * - Extra whitespace trimmed
 * - Case-insensitive status matching
 * - Missing fields default gracefully
 * - Sections without valid ID pattern are skipped
 *
 * @param {string} content - Raw markdown content of FUTURE.md
 * @returns {Array<{id: string, title: string, statement: string, status: string, milestones: string[]}>}
 */
function parseFutureFile(content) {
  if (!content || !content.trim()) return [];

  const declarations = [];
  const sections = content.split(/^## /m).slice(1); // Skip file header

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const headerMatch = lines[0].match(/^(D-\d+):\s*(.+)/);
    if (!headerMatch) continue;

    const [, id, title] = headerMatch;
    const statement = extractField(lines, 'Statement') || '';
    const rawStatus = extractField(lines, 'Status') || 'PENDING';
    const status = rawStatus.toUpperCase().trim();
    const rawMilestones = extractField(lines, 'Milestones');
    const milestones = rawMilestones
      ? rawMilestones.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    declarations.push({ id, title: title.trim(), statement, status, milestones });
  }

  return declarations;
}

/**
 * Write an array of declarations to canonical FUTURE.md format.
 *
 * @param {Array<{id: string, title: string, statement: string, status: string, milestones: string[]}>} declarations
 * @param {string} projectName
 * @returns {string} Canonical markdown content
 */
function writeFutureFile(declarations, projectName) {
  const lines = [`# Future: ${projectName}`, ''];

  for (const d of declarations) {
    lines.push(`## ${d.id}: ${d.title}`);
    lines.push(`**Statement:** ${d.statement}`);
    lines.push(`**Status:** ${d.status}`);
    lines.push(`**Milestones:** ${d.milestones.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { parseFutureFile, writeFutureFile };
