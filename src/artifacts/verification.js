// @ts-check
'use strict';

/**
 * VERIFICATION.md parser and writer for milestone verification history.
 *
 * Parses structured checklist format with attempt history into objects.
 * Writes verification files with round-trip fidelity.
 *
 * Permissive on input (handles hand-edited files), strict on output.
 * Zero runtime dependencies. CJS module.
 */

/**
 * Extract a bold field value from text lines.
 * Matches **FieldName:** value pattern.
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
 * Parse a VERIFICATION.md file into a verification object.
 *
 * @param {string} content - Raw markdown content
 * @returns {{ milestoneId: string | null, state: string | null, lastVerified: string | null, attempts: number, criteria: Array<{id: string, passed: boolean, description: string, result: string, evidence: string}>, history: Array<{number: number, timestamp: string, passed: boolean, checks: string, remediationTriggered: boolean, remediationActions: string, stateTransition: string}> }}
 */
function parseVerificationFile(content) {
  const defaults = {
    milestoneId: null,
    state: null,
    lastVerified: null,
    attempts: 0,
    criteria: [],
    history: [],
  };

  if (!content || !content.trim()) return defaults;

  // Extract milestone ID from header: # Verification: M-XX
  const headerMatch = content.match(/^# Verification:\s*(M-\d+)/m);
  const milestoneId = headerMatch ? headerMatch[1] : null;

  // Extract metadata from header section (before ## sections)
  const headerSection = content.split(/^## /m)[0] || '';
  const headerLines = headerSection.split('\n');

  const state = extractField(headerLines, 'State');
  const lastVerified = extractField(headerLines, 'Last Verified');
  const attemptsStr = extractField(headerLines, 'Attempts');
  const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

  // Parse criteria from ## Success Criteria section
  const criteriaSection = content.match(/## Success Criteria\n([\s\S]*?)(?=\n## |\n*$)/);
  const criteria = [];

  if (criteriaSection) {
    // Match checkbox lines: - [x] **SC-XX:** description -- PASS/FAIL
    const criteriaLines = criteriaSection[1].split('\n');
    let currentCriterion = null;

    for (const line of criteriaLines) {
      const checkMatch = line.match(/^- \[([ x])\] \*\*([^:]+):\*\*\s*(.+?)\s*--\s*(PASS|FAIL)\s*$/);
      if (checkMatch) {
        if (currentCriterion) criteria.push(currentCriterion);
        currentCriterion = {
          id: checkMatch[2],
          passed: checkMatch[1] === 'x',
          description: checkMatch[3],
          result: checkMatch[4],
          evidence: '',
        };
        continue;
      }

      // Evidence line
      const evidenceMatch = line.match(/^\s+Evidence:\s*(.+)$/);
      if (evidenceMatch && currentCriterion) {
        currentCriterion.evidence = evidenceMatch[1].trim();
      }
    }

    if (currentCriterion) criteria.push(currentCriterion);
  }

  // Parse history from ## Verification History section
  const historySection = content.match(/## Verification History\n([\s\S]*?)$/);
  const history = [];

  if (historySection) {
    const attemptSections = historySection[1].split(/^### Attempt /m).slice(1);

    for (const section of attemptSections) {
      const lines = section.trim().split('\n');
      const numberMatch = lines[0].match(/^(\d+)/);
      if (!numberMatch) continue;

      const number = parseInt(numberMatch[1], 10);
      const timestamp = extractField(lines, 'Timestamp') || '';
      const passedStr = extractField(lines, 'Passed') || 'false';
      const passed = passedStr === 'true';
      const checks = extractField(lines, 'Checks') || '';
      const remediationTriggeredStr = extractField(lines, 'Remediation Triggered') || 'false';
      const remediationTriggered = remediationTriggeredStr === 'true';
      const remediationActions = extractField(lines, 'Remediation Actions') || '';
      const stateTransition = extractField(lines, 'State Transition') || '';

      history.push({
        number,
        timestamp,
        passed,
        checks,
        remediationTriggered,
        remediationActions,
        stateTransition,
      });
    }
  }

  return { milestoneId, state, lastVerified, attempts, criteria, history };
}

/**
 * Write a VERIFICATION.md file in canonical format.
 *
 * @param {string} milestoneId - e.g. 'M-01'
 * @param {string} milestoneTitle - e.g. 'User Authentication'
 * @param {string} state - Current verification state
 * @param {Array<{id: string, passed: boolean, description: string, result: string, evidence: string}>} criteria
 * @param {Array<{number: number, timestamp: string, passed: boolean, checks: string, remediationTriggered: boolean, remediationActions: string, stateTransition: string}>} history
 * @returns {string} Canonical markdown content
 */
function writeVerificationFile(milestoneId, milestoneTitle, state, criteria, history) {
  const lastVerified = history.length > 0
    ? history[history.length - 1].timestamp
    : new Date().toISOString();

  const lines = [
    `# Verification: ${milestoneId} -- ${milestoneTitle}`,
    '',
    `**Milestone:** ${milestoneId}`,
    `**State:** ${state}`,
    `**Last Verified:** ${lastVerified}`,
    `**Attempts:** ${history.length}`,
    '',
    '## Success Criteria',
    '',
  ];

  for (const c of criteria) {
    const checkbox = c.passed ? 'x' : ' ';
    lines.push(`- [${checkbox}] **${c.id}:** ${c.description} -- ${c.result}`);
    if (c.evidence) {
      lines.push(`  Evidence: ${c.evidence}`);
    }
  }

  lines.push('');
  lines.push('## Verification History');
  lines.push('');

  for (const h of history) {
    lines.push(`### Attempt ${h.number}`);
    lines.push('');
    lines.push(`**Timestamp:** ${h.timestamp}`);
    lines.push(`**Passed:** ${h.passed}`);
    lines.push(`**Checks:** ${h.checks}`);
    lines.push(`**Remediation Triggered:** ${h.remediationTriggered}`);
    if (h.remediationActions) {
      lines.push(`**Remediation Actions:** ${h.remediationActions}`);
    }
    lines.push(`**State Transition:** ${h.stateTransition}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Append a new verification attempt to existing content.
 * Preserves existing history and updates header metadata.
 *
 * @param {string} existingContent - Current VERIFICATION.md content
 * @param {string} milestoneId
 * @param {string} milestoneTitle
 * @param {string} state - New state after this attempt
 * @param {Array<{id: string, passed: boolean, description: string, result: string, evidence: string}>} criteria - Updated criteria
 * @param {{number: number, timestamp: string, passed: boolean, checks: string, remediationTriggered: boolean, remediationActions: string, stateTransition: string}} attempt - New attempt to append
 * @returns {string} Updated markdown content
 */
function appendAttempt(existingContent, milestoneId, milestoneTitle, state, criteria, attempt) {
  const existing = parseVerificationFile(existingContent);
  const combinedHistory = [...existing.history, attempt];
  return writeVerificationFile(milestoneId, milestoneTitle, state, criteria, combinedHistory);
}

module.exports = { parseVerificationFile, writeVerificationFile, appendAttempt };
