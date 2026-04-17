/**
 * GSD file-issue Tests
 *
 * Validates the shared issue-filing workflow used by both
 * `/gsd-feedback` and `/gsd-forensics`.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const workflowPath = path.join(repoRoot, 'get-shit-done', 'workflows', 'file-issue.md');

describe('file-issue workflow', () => {
  test('workflow file exists', () => {
    assert.ok(fs.existsSync(workflowPath), 'workflows/file-issue.md should exist');
  });

  test('declares input contract for caller variables', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const inputs = [
      'ISSUE_TYPE',
      'ISSUE_TITLE',
      'ISSUE_DESCRIPTION',
      'DIAGNOSTICS_MARKDOWN',
      'INVESTIGATION_FINDINGS',
      'REPO',
    ];
    for (const v of inputs) {
      assert.ok(content.includes(v), `workflow should document input: ${v}`);
    }
  });

  test('defaults REPO to gsd-build/get-shit-done', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('gsd-build/get-shit-done'),
      'should default REPO to gsd-build/get-shit-done'
    );
  });

  test('maps issue types to labels', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('`bug` -> `bug`'), 'bug type maps to bug label');
    assert.ok(content.includes('`feature` -> `enhancement`'), 'feature maps to enhancement');
    assert.ok(content.includes('`question` -> `question`'), 'question maps to question');
  });

  test('checks label existence before applying', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('gh label list'), 'should probe label existence');
    assert.ok(content.includes('LABEL_FLAG'), 'should conditionally set label flag');
  });

  test('renders optional investigation findings section', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('Investigation Findings'),
      'should render investigation section when findings provided'
    );
    assert.ok(
      content.includes('INVESTIGATION_FINDINGS non-empty'),
      'should gate investigation section on non-empty findings'
    );
  });

  test('includes diagnostics block via caller input', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('<details>'), 'should wrap diagnostics in details block');
    assert.ok(content.includes('Diagnostic Info'), 'should label diagnostics summary');
    assert.ok(
      content.includes('{DIAGNOSTICS_MARKDOWN}'),
      'should slot caller-provided diagnostics markdown'
    );
  });

  test('attempts gh issue create first', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('gh issue create'), 'should invoke gh issue create');
    assert.ok(content.includes('--body-file'), 'should use body-file to avoid escaping issues');
  });

  test('builds prefilled URL fallback', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('issues/new?title='),
      'should build prefilled GitHub issue URL'
    );
    assert.ok(content.includes('encodeURIComponent'), 'should URL-encode title and body');
    assert.ok(content.includes('&labels='), 'should include labels in URL');
  });

  test('opens URL across all supported platforms', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const openers = ['open ', 'xdg-open', 'Start-Process', 'cmd.exe /c start'];
    for (const opener of openers) {
      assert.ok(content.includes(opener), `should support ${opener} for URL open`);
    }
  });

  test('always returns raw markdown body for manual paste', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('raw markdown body') || content.includes('rendered markdown body'),
      'should always print the rendered body'
    );
    assert.ok(
      content.includes('Manual fallback'),
      'should describe the manual paste fallback'
    );
  });

  test('includes success_criteria section', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('<success_criteria>'), 'should declare success_criteria');
  });
});
