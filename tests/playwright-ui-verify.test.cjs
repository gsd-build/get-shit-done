// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Playwright-MCP UI verification integration', () => {
  test('verify-work.md mentions automated UI verification', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-work.md'), 'utf-8'
    );
    assert.ok(
      content.toLowerCase().includes('playwright') || content.includes('automated') && content.includes('UI'),
      'verify-work.md should mention automated UI verification option'
    );
  });

  test('ui-review.md mentions Playwright-MCP when available', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'ui-review.md'), 'utf-8'
    );
    assert.ok(
      content.toLowerCase().includes('playwright') || content.includes('mcp__playwright'),
      'ui-review.md should reference Playwright-MCP'
    );
  });

  test('gsd-ui-auditor.md includes automated screenshot guidance', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '..', 'agents', 'gsd-ui-auditor.md'), 'utf-8'
    );
    assert.ok(
      content.toLowerCase().includes('playwright') || content.includes('screenshot') || content.includes('automated'),
      'gsd-ui-auditor.md should mention automated screenshot verification'
    );
  });

  test('automated verification is optional/conditional (falls back to manual)', () => {
    const verifyContent = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-work.md'), 'utf-8'
    );
    // Must include a fallback / "if available" conditional
    const hasConditional =
      verifyContent.includes('if available') ||
      verifyContent.includes('when available') ||
      verifyContent.includes('if Playwright') ||
      verifyContent.includes('fall back');
    assert.ok(hasConditional, 'Playwright integration must be conditional with manual fallback');
  });
});
