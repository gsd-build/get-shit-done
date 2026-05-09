// allow-test-rule: source-text-is-the-product
// docs/contributor-standards.md is a contributor-facing contract doc — its headings
// and cross-links ARE what contributors read. Structural assertions on headings and
// links test the deployed contract, not implementation detail.

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const STANDARDS_DOC = path.join(REPO_ROOT, 'docs', 'contributor-standards.md');
const CONTRIBUTING_MD = path.join(REPO_ROOT, 'CONTRIBUTING.md');

function readStandardsDoc() {
  try {
    return fs.readFileSync(STANDARDS_DOC, 'utf-8');
  } catch (err) {
    assert.fail(`docs/contributor-standards.md does not exist: ${err.message}`);
  }
}

function parseH2Headings(content) {
  return content
    .split('\n')
    .filter((line) => /^## /.test(line))
    .map((line) => line.replace(/^## /, '').trim());
}

describe('docs/contributor-standards.md', () => {
  test('file exists', () => {
    assert.ok(fs.existsSync(STANDARDS_DOC), 'docs/contributor-standards.md must exist');
  });

  test('has required CONTEXT.md section', () => {
    const content = readStandardsDoc();
    const headings = parseH2Headings(content);
    const hasContextSection = headings.some((h) => /context/i.test(h));
    assert.ok(
      hasContextSection,
      `Expected an ## heading containing "context" (case-insensitive). Found headings: ${JSON.stringify(headings)}`
    );
  });

  test('has required ADR section', () => {
    const content = readStandardsDoc();
    const headings = parseH2Headings(content);
    const hasAdrSection = headings.some((h) => /adr/i.test(h));
    assert.ok(
      hasAdrSection,
      `Expected an ## heading containing "ADR" (case-insensitive). Found headings: ${JSON.stringify(headings)}`
    );
  });

  test('has required AI-agent section', () => {
    const content = readStandardsDoc();
    const headings = parseH2Headings(content);
    const hasAgentSection = headings.some((h) => /ai.?agent|agent.?assist/i.test(h));
    assert.ok(
      hasAgentSection,
      `Expected an ## heading containing "AI-agent" or "agent-assist" (case-insensitive). Found headings: ${JSON.stringify(headings)}`
    );
  });

  test('references CONTEXT.md', () => {
    const content = readStandardsDoc();
    assert.ok(
      content.includes('CONTEXT.md'),
      'docs/contributor-standards.md must reference CONTEXT.md'
    );
  });

  test('references docs/adr/', () => {
    const content = readStandardsDoc();
    assert.ok(
      content.includes('docs/adr/'),
      'docs/contributor-standards.md must reference docs/adr/'
    );
  });
});

describe('CONTRIBUTING.md links contributor-standards.md', () => {
  test('CONTRIBUTING.md contains link to contributor-standards.md', () => {
    let contributing;
    try {
      contributing = fs.readFileSync(CONTRIBUTING_MD, 'utf-8');
    } catch (err) {
      assert.fail(`CONTRIBUTING.md does not exist: ${err.message}`);
    }
    assert.ok(
      contributing.includes('contributor-standards.md'),
      'CONTRIBUTING.md must link to docs/contributor-standards.md'
    );
  });
});
