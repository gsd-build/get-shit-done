/**
 * Regression test for bug #2504
 *
 * When UAT testing is mandated and a phase has no user-facing elements
 * (e.g., code foundations, database schema, internal APIs), the agent
 * invented artificial UAT steps — things like "manually run git commits",
 * "manually invoke methods", "manually check database state" — and left
 * work half-finished specifically to create things for a human to do.
 *
 * Fix: The verify-phase workflow's identify_human_verification step must
 * explicitly handle phases with no user-facing elements by auto-passing UAT
 * with a logged rationale instead of inventing manual steps.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const VERIFY_PHASE_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'verify-phase.md'
);

/**
 * Extract a named section from a markdown/workflow document.
 * Returns the text from `heading` up to (but not including) the next `## ` heading,
 * or to end-of-file if no subsequent heading exists.
 */
function extractSection(content, heading) {
  const start = content.indexOf(heading);
  if (start === -1) return '';
  const nextHeading = content.indexOf('\n## ', start + 1);
  return nextHeading === -1 ? content.slice(start) : content.slice(start, nextHeading);
}

describe('bug #2504: UAT auto-pass for foundation/infrastructure phases', () => {
  test('verify-phase workflow file exists', () => {
    assert.ok(
      fs.existsSync(VERIFY_PHASE_PATH),
      'get-shit-done/workflows/verify-phase.md should exist'
    );
  });

  test('identify_human_verification step handles phases with no user-facing elements', () => {
    const content = fs.readFileSync(VERIFY_PHASE_PATH, 'utf-8');
    const section = extractSection(content, 'identify_human_verification');
    // The step must explicitly call out the infrastructure/foundation case
    const hasInfrastructureHandling =
      section.includes('infrastructure') ||
      section.includes('foundation') ||
      section.includes('no user-facing') ||
      section.includes('no user facing') ||
      section.includes('internal API') ||
      section.includes('internal APIs') ||
      section.includes('database schema') ||
      section.includes('code foundation');

    assert.ok(
      hasInfrastructureHandling,
      'verify-phase.md identify_human_verification step must explicitly handle ' +
      'infrastructure/foundation phases that have no user-facing elements. Without ' +
      'this, agents invent artificial manual steps to satisfy UAT requirements ' +
      '(root cause of #2504).'
    );
  });

  test('workflow includes auto-pass or skip UAT language for non-user-facing phases', () => {
    const content = fs.readFileSync(VERIFY_PHASE_PATH, 'utf-8');
    const section = extractSection(content, 'identify_human_verification');
    const hasAutoPass =
      section.includes('auto-pass') ||
      section.includes('auto pass') ||
      section.includes('automatically pass') ||
      section.includes('skip UAT') ||
      section.includes('skip the UAT') ||
      section.includes('UAT does not apply') ||
      section.includes('UAT not applicable') ||
      section.includes('no UAT required');

    assert.ok(
      hasAutoPass,
      'verify-phase.md identify_human_verification step must contain language about ' +
      'auto-passing or skipping UAT for phases without user-facing elements. Agents ' +
      'must not invent manual steps when there is nothing user-facing to test ' +
      '(root cause of #2504).'
    );
  });

  test('workflow prohibits inventing artificial manual steps for infrastructure phases', () => {
    const content = fs.readFileSync(VERIFY_PHASE_PATH, 'utf-8');
    const section = extractSection(content, 'identify_human_verification');
    // The workflow must tell the agent NOT to invent steps when there's nothing to test.
    // Look for explicit prohibition or the inverse: "do not invent" or "must not create"
    // or equivalent framing like "only require human testing when..."
    const hasProhibition =
      section.includes('do not invent') ||
      section.includes('must not invent') ||
      section.includes('never invent') ||
      section.includes('Do not invent') ||
      section.includes('Must not invent') ||
      section.includes('Never invent') ||
      section.includes('only require human') ||
      section.includes('only add human') ||
      (section.includes('only flag') && section.includes('user-facing')) ||
      // Or via "N/A" framing
      (section.includes('N/A') && (
        section.includes('infrastructure') ||
        section.includes('foundation') ||
        section.includes('no user-facing')
      ));

    assert.ok(
      hasProhibition,
      'verify-phase.md identify_human_verification step must explicitly prohibit ' +
      'inventing artificial manual UAT steps for infrastructure phases. The current ' +
      'wording causes agents to create fake "manually run git commits" steps to ' +
      'satisfy UAT mandates (root cause of #2504).'
    );
  });

  test('workflow includes a concept of N/A or not-applicable UAT state', () => {
    const content = fs.readFileSync(VERIFY_PHASE_PATH, 'utf-8');
    const section = extractSection(content, 'identify_human_verification');
    const hasNaState =
      section.includes('N/A') ||
      section.includes('not applicable') ||
      section.includes('not_applicable') ||
      section.includes('no_uat') ||
      section.includes('uat_not_applicable') ||
      section.includes('infrastructure phase') ||
      section.includes('foundation phase');

    assert.ok(
      hasNaState,
      'verify-phase.md identify_human_verification step must include some concept of ' +
      'a "not applicable" or N/A UAT state for phases with no user-facing elements. ' +
      'This prevents agents from blocking phase completion on invented manual steps ' +
      '(root cause of #2504).'
    );
  });
});
