// allow-test-rule: source-text-is-the-product
// These assertions validate shipped workflow/command markdown contracts.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COMMAND_PATH = path.join(ROOT, 'commands', 'gsd', 'plan-phase.md');
const WORKFLOW_PATH = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');
const DOCS_COMMANDS_PATH = path.join(ROOT, 'docs', 'COMMANDS.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('enh #3209: plan-phase ADR ingest express path', () => {
  test('command argument-hint advertises --ingest and --ingest-format', () => {
    const command = read(COMMAND_PATH);
    assert.ok(command.includes('--ingest <path-or-glob>'),
      'plan-phase command argument-hint must include --ingest <path-or-glob>');
    assert.ok(command.includes('--ingest-format <auto|nygard|madr|narrative>'),
      'plan-phase command argument-hint must include --ingest-format selector');
  });

  test('workflow parses --ingest and --ingest-format flags', () => {
    const workflow = read(WORKFLOW_PATH);
    assert.ok(workflow.includes('--ingest <path-or-glob>'),
      'plan-phase workflow argument parsing must mention --ingest');
    assert.ok(workflow.includes('--ingest-format'),
      'plan-phase workflow argument parsing must mention --ingest-format');
  });

  test('workflow has explicit mutual exclusion guard for --prd and --ingest', () => {
    const workflow = read(WORKFLOW_PATH);
    assert.ok(
      workflow.includes('cannot combine `--prd` with `--ingest`') ||
      workflow.includes('mutually exclusive'),
      'plan-phase workflow must fail fast when --prd and --ingest are both provided'
    );
  });

  test('workflow defines an ADR ingest express-path step', () => {
    const workflow = read(WORKFLOW_PATH);
    assert.ok(/##\s*(?:\d+(?:\.\d+)*)?\.?\s*Handle ADR Ingest Express Path/i.test(workflow),
      'plan-phase workflow must include a dedicated ADR ingest express-path step');
    assert.ok(workflow.includes('ADR Ingest Express Path'),
      'workflow must display ADR ingest express-path banner text');
  });

  test('ADR ingest context template includes scope fence and ADR source attribution', () => {
    const workflow = read(WORKFLOW_PATH);
    assert.ok(workflow.includes('<scope_fence>'),
      'ADR ingest context template must include <scope_fence> for hard out-of-scope exclusions');
    assert.ok(workflow.includes('Source:** ADR Ingest Express Path'),
      'ADR ingest context template must tag source as ADR Ingest Express Path');
  });

  test('workflow documents status gate and no-decisions fallback', () => {
    const workflow = read(WORKFLOW_PATH);
    assert.ok(
      workflow.includes('Reject `superseded`/`rejected`/`deprecated`') ||
      workflow.includes('reject `superseded`/`rejected`/`deprecated`') ||
      /superseded.*rejected.*deprecated/i.test(workflow),
      'ADR ingest workflow must include status gate for non-active ADRs'
    );
    assert.ok(
      workflow.includes('empty-decisions fallback') ||
      workflow.includes('fall back to discuss-phase'),
      'ADR ingest workflow must document fallback when no locked decisions are present'
    );
  });

  test('docs COMMANDS advertises --ingest flag for /gsd-plan-phase', () => {
    const commands = read(DOCS_COMMANDS_PATH);
    assert.ok(commands.includes('--ingest <path-or-glob>'),
      'docs/COMMANDS.md must document --ingest for /gsd-plan-phase');
  });
});
