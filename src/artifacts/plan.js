// @ts-check
'use strict';

/**
 * PLAN.md parser and writer for milestone folders.
 *
 * Parses section-per-action format (### A-XX: Title) into plan objects.
 * Writes plans back to canonical markdown format.
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
 * Parse a PLAN.md file into a plan object.
 *
 * Handles hand-edited files permissively:
 * - Extra whitespace trimmed
 * - Case-insensitive field matching
 * - Missing fields default gracefully
 *
 * @param {string} content - Raw markdown content of PLAN.md
 * @returns {{ milestone: string | null, realizes: string[], status: string, derived: string, actions: Array<{id: string, title: string, status: string, produces: string, description: string}> }}
 */
function parsePlanFile(content) {
  if (!content || !content.trim()) {
    return { milestone: null, realizes: [], status: 'PENDING', derived: '', actions: [] };
  }

  // Extract milestone ID from header: # Plan: M-XX or # Plan: M-XX -- Title
  const headerMatch = content.match(/^# Plan:\s*(M-\d+)/m);
  const milestone = headerMatch ? headerMatch[1] : null;

  // Extract metadata fields from the header section (before ## Actions)
  const headerSection = content.split(/^## /m)[0] || '';
  const headerLines = headerSection.split('\n');

  const realizesRaw = extractField(headerLines, 'Realizes');
  const realizes = realizesRaw
    ? realizesRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const status = (extractField(headerLines, 'Status') || 'PENDING').toUpperCase();
  const derived = extractField(headerLines, 'Derived') || '';

  // Extract actions from ### sections
  const actionSections = content.split(/^### /m).slice(1);
  const actions = actionSections.map(section => {
    const lines = section.trim().split('\n');
    const actionHeaderMatch = lines[0].match(/^(A-\d+):\s*(.+)/);
    if (!actionHeaderMatch) return null;

    const [, id, title] = actionHeaderMatch;
    const actionStatus = (extractField(lines, 'Status') || 'PENDING').toUpperCase();
    const produces = extractField(lines, 'Produces') || '';

    // Description: remaining non-field lines after the header
    const description = lines.slice(1)
      .filter(l => !l.trim().startsWith('**'))
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n');

    return { id, title: title.trim(), status: actionStatus, produces, description };
  }).filter(Boolean);

  return { milestone, realizes, status, derived, actions };
}

/**
 * Write a PLAN.md file in canonical format.
 *
 * @param {string} milestoneId - e.g. 'M-01'
 * @param {string} milestoneTitle - e.g. 'User authentication'
 * @param {string[]} realizes - Declaration IDs e.g. ['D-01', 'D-02']
 * @param {Array<{id?: string, title: string, status?: string, produces?: string, description?: string}>} actions
 * @returns {string} Canonical markdown content
 */
function writePlanFile(milestoneId, milestoneTitle, realizes, actions) {
  const today = new Date().toISOString().split('T')[0];
  const lines = [
    `# Plan: ${milestoneId} -- ${milestoneTitle}`,
    '',
    `**Milestone:** ${milestoneId}`,
    `**Realizes:** ${realizes.join(', ')}`,
    `**Status:** PENDING`,
    `**Derived:** ${today}`,
    '',
    '## Actions',
    '',
  ];

  for (const action of actions) {
    const id = action.id || 'A-XX';
    const status = action.status || 'PENDING';
    const produces = action.produces || '';

    lines.push(`### ${id}: ${action.title}`);
    lines.push(`**Status:** ${status}`);
    if (produces) {
      lines.push(`**Produces:** ${produces}`);
    }
    if (action.description) {
      lines.push(action.description);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { parsePlanFile, writePlanFile };
