'use strict';

/**
 * Tests for #2427 — prompt-level sycophancy hardening of audit-class agents.
 * Verifies the four required changes are present in each agent file:
 *   1. Third-person framing (no "You are a GSD X" opening in <role>)
 *   2. FORCE adversarial stance block
 *   3. Explicit failure modes list
 *   4. BLOCKER/WARNING classification requirement
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AGENTS_DIR = path.join(__dirname, '../agents');
const SDK_AGENTS_DIR = path.join(__dirname, '../sdk/prompts/agents');

const AUDIT_AGENTS = [
  'gsd-plan-checker.md',
  'gsd-code-reviewer.md',
  'gsd-security-auditor.md',
  'gsd-verifier.md',
  'gsd-eval-auditor.md',
  'gsd-nyquist-auditor.md',
  'gsd-ui-auditor.md',
  'gsd-integration-checker.md',
  'gsd-doc-verifier.md',
];

const SDK_AUDIT_AGENTS = [
  'gsd-plan-checker.md',
  'gsd-verifier.md',
];

function readAgent(agentsDir, filename) {
  return fs.readFileSync(path.join(agentsDir, filename), 'utf-8');
}

function extractRole(content) {
  const match = content.match(/<role>([\s\S]*?)<\/role>/);
  return match ? match[1] : '';
}

describe('enh-2427 — sycophancy hardening: audit-class agents', () => {

  for (const filename of AUDIT_AGENTS) {
    const label = filename.replace('.md', '');

    describe(label, () => {
      let content;
      let role;

      test('file is readable', () => {
        content = readAgent(AGENTS_DIR, filename);
        role = extractRole(content);
        assert.ok(content.length > 0, `${filename} should not be empty`);
      });

      test('(1) third-person framing — <role> does not open with "You are a GSD"', () => {
        content = content || readAgent(AGENTS_DIR, filename);
        role = role || extractRole(content);
        const firstSentence = role.trim().slice(0, 80);
        assert.ok(
          !firstSentence.startsWith('You are a GSD'),
          `${filename}: <role> must not open with "You are a GSD" — use third-person submission framing. Got: "${firstSentence}"`
        );
      });

      test('(2) FORCE adversarial stance — <adversarial_stance> block present', () => {
        content = content || readAgent(AGENTS_DIR, filename);
        assert.ok(
          content.includes('<adversarial_stance>'),
          `${filename}: must contain <adversarial_stance> block`
        );
        assert.ok(
          content.includes('FORCE stance'),
          `${filename}: <adversarial_stance> must contain "FORCE stance"`
        );
      });

      test('(3) explicit failure modes list present', () => {
        content = content || readAgent(AGENTS_DIR, filename);
        assert.ok(
          content.includes('failure modes'),
          `${filename}: must contain "failure modes" section in <adversarial_stance>`
        );
      });

      test('(4) BLOCKER/WARNING classification requirement present', () => {
        content = content || readAgent(AGENTS_DIR, filename);
        assert.ok(
          content.includes('**BLOCKER**'),
          `${filename}: must define BLOCKER classification in <adversarial_stance>`
        );
        assert.ok(
          content.includes('**WARNING**'),
          `${filename}: must define WARNING classification in <adversarial_stance>`
        );
      });
    });
  }

  describe('sdk/prompts/agents variants', () => {
    for (const filename of SDK_AUDIT_AGENTS) {
      const label = `sdk/${filename.replace('.md', '')}`;

      describe(label, () => {
        test('third-person framing and adversarial_stance block present', () => {
          const content = readAgent(SDK_AGENTS_DIR, filename);
          const role = extractRole(content);
          const firstSentence = role.trim().slice(0, 80);

          assert.ok(
            !firstSentence.startsWith('You are a GSD'),
            `${filename}: SDK variant must not open <role> with "You are a GSD"`
          );
          assert.ok(
            content.includes('<adversarial_stance>'),
            `${filename}: SDK variant must contain <adversarial_stance> block`
          );
        });
      });
    }
  });
});
