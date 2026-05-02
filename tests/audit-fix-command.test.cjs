// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Audit-Fix Command Tests
 *
 * Validates the autonomous audit-to-fix pipeline:
 * - Command file exists with correct frontmatter
 * - Workflow file exists with all required steps
 * - 4 flags documented (--max, --severity, --dry-run, --source)
 * - Classification heuristics (auto-fixable vs manual-only)
 * - --dry-run stops before fixing
 * - Atomic commit with finding ID in message
 * - Test-then-commit pattern
 * - Revert on test failure
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands', 'gsd');
const WORKFLOWS_DIR = path.join(REPO_ROOT, 'get-shit-done', 'workflows');

// ─── 1. Command file — audit-fix.md ──────────────────────────────────────────

describe('AUDIT-FIX: command file', () => {
  const cmdPath = path.join(COMMANDS_DIR, 'audit-fix.md');

  test('command file exists', () => {
    assert.ok(
      fs.existsSync(cmdPath),
      'audit-fix.md must exist in commands/gsd/'
    );
  });

  test('has valid frontmatter with name gsd:audit-fix', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('name: gsd:audit-fix'),
      'name must be gsd:audit-fix'
    );
  });

  test('has description in frontmatter', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('description:'),
      'must have description in frontmatter'
    );
  });

  test('has allowed-tools list including Agent', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('allowed-tools:'),
      'must have allowed-tools in frontmatter'
    );
    assert.ok(
      frontmatter.includes('- Agent'),
      'allowed-tools must include Agent for spawning executor subagents'
    );
  });

  test('has argument-hint in frontmatter for /gsd-help discoverability', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('argument-hint:'),
      'must have argument-hint in frontmatter for /gsd-help discoverability'
    );
  });

  test('has type: prompt in frontmatter', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('type: prompt'),
      'must have type: prompt in frontmatter'
    );
  });

  test('argument-hint reflects supported source values', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    const frontmatter = content.split('---')[1] || '';
    assert.ok(
      frontmatter.includes('--source <audit-uat>'),
      'argument-hint must show --source <audit-uat> (the only currently supported value)'
    );
    assert.ok(
      !frontmatter.includes('--source <audit|verify>'),
      'argument-hint must not advertise unsupported verify source'
    );
  });

  test('references audit-fix.md workflow', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    assert.ok(
      content.includes('audit-fix.md'),
      'must reference audit-fix.md workflow'
    );
  });

  test('has <objective> section', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    assert.ok(content.includes('<objective>'), 'must have <objective> section');
    assert.ok(content.includes('</objective>'), 'must close <objective> section');
  });
});

// ─── 2. Workflow file — audit-fix.md ──────────────────────────────────────────

describe('AUDIT-FIX: workflow file', () => {
  const wfPath = path.join(WORKFLOWS_DIR, 'audit-fix.md');

  test('workflow file exists', () => {
    assert.ok(
      fs.existsSync(wfPath),
      'audit-fix.md must exist in get-shit-done/workflows/'
    );
  });

  test('has <purpose> section', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(content.includes('<purpose>'), 'must have <purpose> section');
    assert.ok(content.includes('</purpose>'), 'must close <purpose> section');
  });

  test('has <process> section with steps', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(content.includes('<process>'), 'must have <process> section');
    assert.ok(content.includes('</process>'), 'must close <process> section');
  });

  test('has <success_criteria> section', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(content.includes('<success_criteria>'), 'must have <success_criteria> section');
    assert.ok(content.includes('</success_criteria>'), 'must close <success_criteria> section');
  });

  test('has <available_agent_types> listing gsd-executor', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('<available_agent_types>'),
      'must have <available_agent_types> section'
    );
    assert.ok(
      content.includes('gsd-executor'),
      'must list gsd-executor as available agent type'
    );
  });
});

// ─── 3. Flags documented ─────────────────────────────────────────────────────

describe('AUDIT-FIX: all 4 flags documented', () => {
  const cmdPath = path.join(COMMANDS_DIR, 'audit-fix.md');
  const wfPath = path.join(WORKFLOWS_DIR, 'audit-fix.md');

  test('--max flag documented in command', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    assert.ok(
      content.includes('--max'),
      'command must document --max flag'
    );
  });

  test('--severity flag documented in command', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    assert.ok(
      content.includes('--severity'),
      'command must document --severity flag'
    );
  });

  test('--dry-run flag documented in command', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    assert.ok(
      content.includes('--dry-run'),
      'command must document --dry-run flag'
    );
  });

  test('--source flag documented in command', () => {
    const content = fs.readFileSync(cmdPath, 'utf-8');
    assert.ok(
      content.includes('--source'),
      'command must document --source flag'
    );
  });

  test('--max flag documented in workflow with default 5', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(content.includes('--max'), 'workflow must document --max flag');
    assert.ok(
      content.includes('5'),
      'workflow must show default of 5 for --max'
    );
  });

  test('--severity flag documented in workflow with default medium', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(content.includes('--severity'), 'workflow must document --severity flag');
    assert.ok(
      content.includes('medium'),
      'workflow must show default of medium for --severity'
    );
  });

  test('--dry-run flag documented in workflow', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('--dry-run'),
      'workflow must document --dry-run flag'
    );
  });

  test('--source flag documented in workflow with default audit-uat', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(content.includes('--source'), 'workflow must document --source flag');
    assert.ok(
      content.includes('audit-uat'),
      'workflow must show audit-uat as default source'
    );
  });
});

// ─── 4. Classification heuristics ─────────────────────────────────────────────

describe('AUDIT-FIX: classification heuristics documented', () => {
  const wfPath = path.join(WORKFLOWS_DIR, 'audit-fix.md');

  test('documents auto-fixable classification', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('auto-fixable'),
      'must document auto-fixable classification'
    );
  });

  test('documents manual-only classification', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('manual-only'),
      'must document manual-only classification'
    );
  });

  test('errs on manual-only when uncertain', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.toLowerCase().includes('uncertain') &&
      content.includes('manual-only'),
      'must specify to err on manual-only when uncertain'
    );
  });

  test('lists auto-fixable signals (file path, missing test)', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('file path'),
      'must list file path reference as auto-fixable signal'
    );
    assert.ok(
      content.includes('missing test') || content.includes('Missing test'),
      'must list missing test as auto-fixable signal'
    );
  });

  test('lists manual-only signals (design decisions, architecture)', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('design decision') || content.includes('design decisions'),
      'must list design decisions as manual-only signal'
    );
    assert.ok(
      content.includes('architecture') || content.includes('architectural'),
      'must list architecture changes as manual-only signal'
    );
  });
});

// ─── 5. --dry-run stops before fixing ─────────────────────────────────────────

describe('AUDIT-FIX: --dry-run stops before fixing', () => {
  const wfPath = path.join(WORKFLOWS_DIR, 'audit-fix.md');

  test('dry-run explicitly stops after classification', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    // Verify dry-run is mentioned in the context of stopping/exiting
    assert.ok(
      content.includes('dry-run') && (
        content.includes('stop here') ||
        content.includes('stop') ||
        content.includes('exit')
      ),
      'must indicate --dry-run stops after classification'
    );
  });

  test('dry-run does not proceed to fix loop', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    // Find the dry-run stop instruction and verify it comes before the fix-loop step
    const dryRunStopIdx = content.indexOf('dry-run');
    const fixLoopIdx = content.indexOf('fix-loop');
    assert.ok(dryRunStopIdx > -1, 'must mention dry-run');
    assert.ok(fixLoopIdx > -1, 'must have fix-loop step');
    // The dry-run stop instruction should be in the classification step, before fix-loop
    assert.ok(
      dryRunStopIdx < fixLoopIdx,
      'dry-run stop must be documented before the fix-loop step'
    );
  });
});

// ─── 6. Atomic commit with finding ID ─────────────────────────────────────────

describe('AUDIT-FIX: atomic commit with finding ID', () => {
  const wfPath = path.join(WORKFLOWS_DIR, 'audit-fix.md');

  test('commit message pattern includes finding ID', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    // The workflow should show {ID} in the commit message template
    assert.ok(
      content.includes('{ID}') && content.includes('commit'),
      'commit message template must include {ID} placeholder for finding ID'
    );
  });

  test('commit is atomic per finding (one commit per fix)', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    // The fix-loop structure should show commit happening inside the per-finding loop
    assert.ok(
      content.includes('commit') && content.includes('finding'),
      'must commit atomically per finding'
    );
  });

  test('mentions finding ID traceability', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('traceability') || content.includes('finding ID'),
      'must mention finding ID for traceability'
    );
  });
});

// ─── 7. Test-then-commit pattern ──────────────────────────────────────────────

describe('AUDIT-FIX: test-then-commit pattern', () => {
  const wfPath = path.join(WORKFLOWS_DIR, 'audit-fix.md');

  test('runs tests before committing', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('npm test'),
      'must run npm test as part of the fix loop'
    );
  });

  test('tests appear before commit in workflow order', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    // Within the fix-loop step, test must come before commit
    const fixLoopStart = content.indexOf('fix-loop');
    const testIdx = content.indexOf('npm test', fixLoopStart);
    const commitIdx = content.indexOf('git commit', fixLoopStart);
    assert.ok(testIdx > -1, 'must have npm test in fix-loop');
    assert.ok(commitIdx > -1, 'must have git commit in fix-loop');
    assert.ok(
      testIdx < commitIdx,
      'npm test must appear before commit in fix-loop (test-then-commit pattern)'
    );
  });

  test('commit is conditional on tests passing', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('tests pass') || content.includes('If tests pass'),
      'commit must be conditional on tests passing'
    );
  });
});

// ─── 8. Revert on test failure ────────────────────────────────────────────────

describe('AUDIT-FIX: revert on test failure', () => {
  const wfPath = path.join(WORKFLOWS_DIR, 'audit-fix.md');

  test('reverts changes when tests fail', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('git checkout') || content.includes('revert'),
      'must revert changes on test failure'
    );
  });

  test('marks failed fixes as fix-failed', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('fix-failed'),
      'must mark failed fixes as fix-failed'
    );
  });

  test('stops pipeline after first test failure', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    assert.ok(
      content.includes('stop') && content.includes('fix-failed'),
      'must stop the pipeline after the first test failure'
    );
  });

  test('test failure does not leave partial changes', () => {
    const content = fs.readFileSync(wfPath, 'utf-8');
    // git checkout scoped to changed files is the revert mechanism
    assert.ok(
      content.includes('git checkout -- {changed_files}'),
      'must use git checkout -- {changed_files} to clean partial changes on failure'
    );
  });
});
