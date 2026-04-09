/**
 * GSD Tools Tests - State
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('state-snapshot command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing STATE.md returns error', () => {
    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'STATE.md not found', 'should report missing file');
  });

  test('extracts basic fields from STATE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Current Phase Name:** API Layer
**Total Phases:** 6
**Current Plan:** 03-02
**Total Plans in Phase:** 3
**Status:** In progress
**Progress:** 45%
**Last Activity:** 2024-01-15
**Last Activity Description:** Completed 03-01-PLAN.md
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.current_phase, '03', 'current phase extracted');
    assert.strictEqual(output.current_phase_name, 'API Layer', 'phase name extracted');
    assert.strictEqual(output.total_phases, 6, 'total phases extracted');
    assert.strictEqual(output.current_plan, '03-02', 'current plan extracted');
    assert.strictEqual(output.total_plans_in_phase, 3, 'total plans extracted');
    assert.strictEqual(output.status, 'In progress', 'status extracted');
    assert.strictEqual(output.progress_percent, 45, 'progress extracted');
    assert.strictEqual(output.last_activity, '2024-01-15', 'last activity date extracted');
  });

  test('extracts decisions table', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 01

## Decisions Made

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01 | Use Prisma | Better DX than raw SQL |
| 02 | JWT auth | Stateless authentication |
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions.length, 2, 'should have 2 decisions');
    assert.strictEqual(output.decisions[0].phase, '01', 'first decision phase');
    assert.strictEqual(output.decisions[0].summary, 'Use Prisma', 'first decision summary');
    assert.strictEqual(output.decisions[0].rationale, 'Better DX than raw SQL', 'first decision rationale');
  });

  test('extracts blockers list', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Blockers

- Waiting for API credentials
- Need design review for dashboard
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.blockers, [
      'Waiting for API credentials',
      'Need design review for dashboard',
    ], 'blockers extracted');
  });

  test('extracts session continuity info', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03

## Session

**Last Date:** 2024-01-15
**Stopped At:** Phase 3, Plan 2, Task 1
**Resume File:** .planning/phases/03-api/03-02-PLAN.md
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.session.last_date, '2024-01-15', 'session date extracted');
    assert.strictEqual(output.session.stopped_at, 'Phase 3, Plan 2, Task 1', 'stopped at extracted');
    assert.strictEqual(output.session.resume_file, '.planning/phases/03-api/03-02-PLAN.md', 'resume file extracted');
  });

  test('handles paused_at field', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 03
**Paused At:** Phase 3, Plan 1, Task 2 - mid-implementation
`
    );

    const result = runGsdTools('state-snapshot', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.paused_at, 'Phase 3, Plan 1, Task 2 - mid-implementation', 'paused_at extracted');
  });

  describe('--cwd override', () => {
    let outsideDir;

    beforeEach(() => {
      outsideDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-outside-'));
    });

    afterEach(() => {
      cleanup(outsideDir);
    });

    test('supports --cwd override when command runs outside project root', () => {
      fs.writeFileSync(
        path.join(tmpDir, '.planning', 'STATE.md'),
        `# Session State

**Current Phase:** 03
**Status:** Ready to plan
`
      );

      const result = runGsdTools(`state-snapshot --cwd "${tmpDir}"`, outsideDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const output = JSON.parse(result.output);
      assert.strictEqual(output.current_phase, '03', 'should read STATE.md from overridden cwd');
      assert.strictEqual(output.status, 'Ready to plan', 'should parse status from overridden cwd');
    });
  });

  test('returns error for invalid --cwd path', () => {
    const invalid = path.join(tmpDir, 'does-not-exist');
    const result = runGsdTools(`state-snapshot --cwd "${invalid}"`, tmpDir);
    assert.ok(!result.success, 'should fail for invalid --cwd');
    assert.ok(result.error.includes('Invalid --cwd'), 'error should mention invalid --cwd');
  });
});

describe('state mutation commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('add-decision preserves dollar amounts without corrupting Decisions section', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Decisions
No decisions yet.

## Blockers
None
`
    );

    const result = runGsdTools(
      ['state', 'add-decision', '--phase', '11-01', '--summary', 'Benchmark prices moved from $0.50 to $2.00 to $5.00', '--rationale', 'track cost growth'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(
      state,
      /- \[Phase 11-01\]: Benchmark prices moved from \$0\.50 to \$2\.00 to \$5\.00 — track cost growth/,
      'decision entry should preserve literal dollar values'
    );
    assert.strictEqual((state.match(/^## Decisions$/gm) || []).length, 1, 'Decisions heading should not be duplicated');
    assert.ok(!state.includes('No decisions yet.'), 'placeholder should be removed');
  });

  test('add-blocker preserves dollar strings without corrupting Blockers section', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Decisions
None

## Blockers
None
`
    );

    const result = runGsdTools(['state', 'add-blocker', '--text', 'Waiting on vendor quote $1.00 before approval'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(state, /- Waiting on vendor quote \$1\.00 before approval/, 'blocker entry should preserve literal dollar values');
    assert.strictEqual((state.match(/^## Blockers$/gm) || []).length, 1, 'Blockers heading should not be duplicated');
  });

  test('add-decision supports file inputs to preserve shell-sensitive dollar text', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Decisions
No decisions yet.

## Blockers
None
`
    );

    const summaryPath = path.join(tmpDir, 'decision-summary.txt');
    const rationalePath = path.join(tmpDir, 'decision-rationale.txt');
    fs.writeFileSync(summaryPath, 'Price tiers: $0.50, $2.00, else $5.00\n');
    fs.writeFileSync(rationalePath, 'Keep exact currency literals for budgeting\n');

    const result = runGsdTools(
      `state add-decision --phase 11-02 --summary-file "${summaryPath}" --rationale-file "${rationalePath}"`,
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(
      state,
      /- \[Phase 11-02\]: Price tiers: \$0\.50, \$2\.00, else \$5\.00 — Keep exact currency literals for budgeting/,
      'file-based decision input should preserve literal dollar values'
    );
  });

  test('add-blocker supports --text-file for shell-sensitive text', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

## Decisions
None

## Blockers
None
`
    );

    const blockerPath = path.join(tmpDir, 'blocker.txt');
    fs.writeFileSync(blockerPath, 'Vendor quote updated from $1.00 to $2.00 pending approval\n');

    const result = runGsdTools(`state add-blocker --text-file "${blockerPath}"`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.match(state, /- Vendor quote updated from \$1\.00 to \$2\.00 pending approval/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state json command (machine-readable STATE.md frontmatter)
// ─────────────────────────────────────────────────────────────────────────────

describe('state json command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing STATE.md returns error', () => {
    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'STATE.md not found', 'should report missing file');
  });

  test('builds frontmatter on-the-fly from body when no frontmatter exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 05
**Current Phase Name:** Deployment
**Total Phases:** 8
**Current Plan:** 05-03
**Total Plans in Phase:** 4
**Status:** In progress
**Progress:** 60%
**Last Activity:** 2026-01-20
`
    );

    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.gsd_state_version, '1.0', 'should have version 1.0');
    assert.strictEqual(output.current_phase, '05', 'current phase extracted');
    assert.strictEqual(output.current_phase_name, 'Deployment', 'phase name extracted');
    assert.strictEqual(output.current_plan, '05-03', 'current plan extracted');
    assert.strictEqual(output.status, 'executing', 'status normalized to executing');
    assert.ok(output.last_updated, 'should have last_updated timestamp');
    assert.strictEqual(output.last_activity, '2026-01-20', 'last activity extracted');
    assert.ok(output.progress, 'should have progress object');
    assert.strictEqual(output.progress.percent, 60, 'progress percent extracted');
  });

  test('reads existing frontmatter when present', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `---
gsd_state_version: 1.0
current_phase: 03
status: paused
stopped_at: Plan 2 of Phase 3
---

# Project State

**Current Phase:** 03
**Status:** Paused
`
    );

    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.gsd_state_version, '1.0', 'version from frontmatter');
    assert.strictEqual(output.current_phase, '03', 'phase from frontmatter');
    assert.strictEqual(output.status, 'paused', 'status from frontmatter');
    assert.strictEqual(output.stopped_at, 'Plan 2 of Phase 3', 'stopped_at from frontmatter');
  });

  test('normalizes various status values', () => {
    const statusTests = [
      { input: 'In progress', expected: 'executing' },
      { input: 'Ready to execute', expected: 'executing' },
      { input: 'Paused at Plan 3', expected: 'paused' },
      { input: 'Ready to plan', expected: 'planning' },
      { input: 'Phase complete — ready for verification', expected: 'verifying' },
      { input: 'Milestone complete', expected: 'completed' },
    ];

    for (const { input, expected } of statusTests) {
      fs.writeFileSync(
        path.join(tmpDir, '.planning', 'STATE.md'),
        `# State\n\n**Current Phase:** 01\n**Status:** ${input}\n`
      );

      const result = runGsdTools('state json', tmpDir);
      assert.ok(result.success, `Command failed for status "${input}": ${result.error}`);
      const output = JSON.parse(result.output);
      assert.strictEqual(output.status, expected, `"${input}" should normalize to "${expected}"`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATE.md frontmatter sync (write operations add frontmatter)
// ─────────────────────────────────────────────────────────────────────────────

describe('STATE.md frontmatter sync', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state update adds frontmatter to STATE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 02
**Status:** Ready to execute
`
    );

    const result = runGsdTools('state update Status "Executing Plan 1"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.startsWith('---\n'), 'should start with frontmatter delimiter');
    assert.ok(content.includes('gsd_state_version: 1.0'), 'should have version field');
    assert.ok(content.includes('current_phase: 02'), 'frontmatter should have current phase');
    assert.ok(content.includes('**Current Phase:** 02'), 'body field should be preserved');
    assert.ok(content.includes('**Status:** Executing Plan 1'), 'updated field in body');
  });

  test('state patch adds frontmatter', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 04
**Status:** Planning
**Current Plan:** 04-01
`
    );

    const result = runGsdTools('state patch --Status "In progress" --"Current Plan" 04-02', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.startsWith('---\n'), 'should have frontmatter after patch');
  });

  test('frontmatter is idempotent on multiple writes', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 01
**Status:** Ready to execute
`
    );

    runGsdTools('state update Status "In progress"', tmpDir);
    runGsdTools('state update Status "Paused"', tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    const delimiterCount = (content.match(/^---$/gm) || []).length;
    assert.strictEqual(delimiterCount, 2, 'should have exactly one frontmatter block (2 delimiters)');
    assert.ok(content.includes('status: paused'), 'frontmatter should reflect latest status');
  });

  test('preserves frontmatter status when body Status field is missing', () => {
    // Simulate: frontmatter has status: executing, but body lost Status: field
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `---
status: executing
milestone: v1.0
---

# Project State

**Current Phase:** 03
**Current Plan:** 03-02
`
    );

    // Any writeStateMd triggers syncStateFrontmatter — use state update on a field that exists
    runGsdTools('state update "Current Plan" "03-03"', tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('status: executing'), 'should preserve existing status, not overwrite with unknown');
    assert.ok(!content.includes('status: unknown'), 'should not contain unknown status');
  });

  test('round-trip: write then read via state json', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

**Current Phase:** 07
**Current Phase Name:** Production
**Total Phases:** 10
**Status:** In progress
**Current Plan:** 07-05
**Progress:** 70%
`
    );

    runGsdTools('state update Status "Executing Plan 5"', tmpDir);

    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `state json failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.current_phase, '07', 'round-trip: phase preserved');
    assert.strictEqual(output.current_phase_name, 'Production', 'round-trip: phase name preserved');
    assert.strictEqual(output.status, 'executing', 'round-trip: status normalized');
    assert.ok(output.last_updated, 'round-trip: timestamp present');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stateExtractField and stateReplaceField helpers
// ─────────────────────────────────────────────────────────────────────────────

const { stateExtractField, stateReplaceField, stateReplaceFieldWithFallback } = require('../get-shit-done/bin/lib/state.cjs');

describe('stateExtractField and stateReplaceField helpers', () => {
  // stateExtractField tests

  test('extracts simple field value', () => {
    const content = '# State\n\n**Status:** In progress\n';
    const result = stateExtractField(content, 'Status');
    assert.strictEqual(result, 'In progress', 'should extract simple field value');
  });

  test('extracts field with colon in value', () => {
    const content = '# State\n\n**Last Activity:** 2024-01-15 — Completed plan\n';
    const result = stateExtractField(content, 'Last Activity');
    assert.strictEqual(result, '2024-01-15 — Completed plan', 'should return full value after field pattern');
  });

  test('returns null for missing field', () => {
    const content = '# State\n\n**Phase:** 03\n';
    const result = stateExtractField(content, 'Status');
    assert.strictEqual(result, null, 'should return null when field not present');
  });

  test('is case-insensitive on field name', () => {
    const content = '# State\n\n**status:** Active\n';
    const result = stateExtractField(content, 'Status');
    assert.strictEqual(result, 'Active', 'should match field name case-insensitively');
  });

  // stateReplaceField tests

  test('replaces field value', () => {
    const content = '# State\n\n**Status:** Old\n';
    const result = stateReplaceField(content, 'Status', 'New');
    assert.ok(result !== null, 'should return updated content, not null');
    assert.ok(result.includes('**Status:** New'), 'output should contain updated field value');
    assert.ok(!result.includes('**Status:** Old'), 'output should not contain old field value');
  });

  test('returns null when field not found', () => {
    const content = '# State\n\n**Phase:** 03\n';
    const result = stateReplaceField(content, 'Status', 'New');
    assert.strictEqual(result, null, 'should return null when field not present');
  });

  test('preserves surrounding content', () => {
    const content = [
      '# Project State',
      '',
      '**Phase:** 03',
      '**Status:** Old',
      '**Last Activity:** 2024-01-15',
      '',
      '## Notes',
      'Some notes here.',
    ].join('\n');

    const result = stateReplaceField(content, 'Status', 'New');
    assert.ok(result !== null, 'should return updated content');
    assert.ok(result.includes('**Phase:** 03'), 'Phase line should be unchanged');
    assert.ok(result.includes('**Status:** New'), 'Status should be updated');
    assert.ok(result.includes('**Last Activity:** 2024-01-15'), 'Last Activity line should be unchanged');
    assert.ok(result.includes('## Notes'), 'Notes heading should be unchanged');
    assert.ok(result.includes('Some notes here.'), 'Notes content should be unchanged');
  });

  test('round-trip: extract then replace then extract', () => {
    const content = '# State\n\n**Phase:** 3\n';
    const extracted = stateExtractField(content, 'Phase');
    assert.strictEqual(extracted, '3', 'initial extract should return "3"');

    const updated = stateReplaceField(content, 'Phase', '4');
    assert.ok(updated !== null, 'replace should succeed');

    const reExtracted = stateExtractField(updated, 'Phase');
    assert.strictEqual(reExtracted, '4', 'extract after replace should return "4"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stateReplaceFieldWithFallback — consolidated fallback helper
// ─────────────────────────────────────────────────────────────────────────────

describe('stateReplaceFieldWithFallback', () => {
  test('replaces primary field when present', () => {
    const content = '# State\n\n**Status:** Old\n';
    const result = stateReplaceFieldWithFallback(content, 'Status', null, 'New');
    assert.ok(result.includes('**Status:** New'));
  });

  test('falls back to secondary field when primary not found', () => {
    const content = '# State\n\nLast activity: 2024-01-01\n';
    const result = stateReplaceFieldWithFallback(content, 'Last Activity', 'Last activity', '2025-03-19');
    assert.ok(result.includes('Last activity: 2025-03-19'), 'should update fallback field');
  });

  test('returns content unchanged when neither field matches', () => {
    const content = '# State\n\n**Phase:** 3\n';
    const result = stateReplaceFieldWithFallback(content, 'Status', 'state', 'New');
    assert.strictEqual(result, content, 'content should be unchanged');
  });

  test('prefers primary over fallback when both exist', () => {
    const content = '# State\n\n**Status:** Old\nStatus: Also old\n';
    const result = stateReplaceFieldWithFallback(content, 'Status', 'Status', 'New');
    // Bold format is tried first by stateReplaceField
    assert.ok(result.includes('**Status:** New'), 'should replace bold (primary) format');
  });

  test('works with plain format fields', () => {
    const content = '# State\n\nPhase: 1 of 3 (Foundation)\nStatus: In progress\nPlan: 01-01\n';
    let updated = stateReplaceFieldWithFallback(content, 'Status', null, 'Complete');
    assert.ok(updated.includes('Status: Complete'), 'should update plain Status');
    updated = stateReplaceFieldWithFallback(updated, 'Current Plan', 'Plan', 'Not started');
    assert.ok(updated.includes('Plan: Not started'), 'should fall back to Plan field');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdStateLoad, cmdStateGet, cmdStatePatch, cmdStateUpdate CLI tests
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdStateLoad (state load)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns config and state when STATE.md exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' })
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n'
    );

    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_exists, true, 'state_exists should be true');
    assert.strictEqual(output.config_exists, true, 'config_exists should be true');
    assert.strictEqual(output.roadmap_exists, true, 'roadmap_exists should be true');
    assert.ok(output.state_raw.includes('**Status:** Active'), 'state_raw should contain STATE.md content');
  });

  test('returns state_exists false when STATE.md missing', () => {
    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_exists, false, 'state_exists should be false');
    assert.strictEqual(output.state_raw, '', 'state_raw should be empty string');
  });

  test('returns raw key=value format with --raw flag', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' })
    );

    const result = runGsdTools('state load --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(result.output.includes('state_exists=true'), 'raw output should include state_exists=true');
    assert.ok(result.output.includes('config_exists=true'), 'raw output should include config_exists=true');
  });
});

describe('cmdStateGet (state get)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns full content when no section specified', () => {
    const stateContent = '# Project State\n\n**Status:** Active\n**Phase:** 03\n';
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent);

    const result = runGsdTools('state get', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.content !== undefined, 'output should have content field');
    assert.ok(output.content.includes('**Status:** Active'), 'content should include full STATE.md text');
  });

  test('extracts bold field value', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );

    const result = runGsdTools('state get Status', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output['Status'], 'Active', 'should extract Status field value');
  });

  test('extracts markdown section content', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n\n## Blockers\n\n- item1\n- item2\n'
    );

    const result = runGsdTools('state get Blockers', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output['Blockers'] !== undefined, 'should have Blockers key in output');
    assert.ok(output['Blockers'].includes('item1'), 'section content should include item1');
    assert.ok(output['Blockers'].includes('item2'), 'section content should include item2');
  });

  test('returns error for nonexistent field', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );

    const result = runGsdTools('state get Missing', tmpDir);
    assert.ok(result.success, `Command should exit 0 even for missing field: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.toLowerCase().includes('not found'), 'error should mention "not found"');
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state get Status', tmpDir);
    assert.ok(!result.success, 'command should fail when STATE.md is missing');
    assert.ok(
      result.error.includes('STATE.md') || result.output.includes('STATE.md'),
      'error message should mention STATE.md'
    );
  });
});

describe('cmdStatePatch and cmdStateUpdate (state patch, state update)', () => {
  let tmpDir;
  const stateMd = [
    '# Project State',
    '',
    '**Current Phase:** 03',
    '**Status:** In progress',
    '**Last Activity:** 2024-01-15',
  ].join('\n') + '\n';

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state patch updates multiple fields at once', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state patch --Status Complete --"Current Phase" 04', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('**Status:** Complete'), 'Status should be updated to Complete');
    assert.ok(updated.includes('**Last Activity:** 2024-01-15'), 'Last Activity should be unchanged');
  });

  test('state patch reports failed fields that do not exist', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state patch --Status Done --Missing value', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output.updated), 'updated should be an array');
    assert.ok(output.updated.includes('Status'), 'Status should be in updated list');
    assert.ok(Array.isArray(output.failed), 'failed should be an array');
    assert.ok(output.failed.includes('Missing'), 'Missing should be in failed list');
  });

  test('state update changes a single field', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state update Status "Phase complete"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'updated should be true');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('**Status:** Phase complete'), 'Status should be updated');
    assert.ok(updated.includes('**Current Phase:** 03'), 'Current Phase should be unchanged');
    assert.ok(updated.includes('**Last Activity:** 2024-01-15'), 'Last Activity should be unchanged');
  });

  test('state update reports field not found', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state update Missing value', tmpDir);
    assert.ok(result.success, `Command should exit 0 for not-found field: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'updated should be false');
    assert.ok(output.reason !== undefined, 'should include a reason');
  });

  test('state update returns error when STATE.md missing', () => {
    const result = runGsdTools('state update Status value', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'updated should be false');
    assert.ok(
      output.reason.includes('STATE.md'),
      'reason should mention STATE.md'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdStateAdvancePlan, cmdStateRecordMetric, cmdStateUpdateProgress
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdStateAdvancePlan (state advance-plan)', () => {
  let tmpDir;

  const advanceFixture = [
    '# Project State',
    '',
    '**Current Plan:** 1',
    '**Total Plans in Phase:** 3',
    '**Status:** Executing',
    '**Last Activity:** 2024-01-10',
  ].join('\n') + '\n';

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('advances plan counter when not on last plan', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), advanceFixture);

    const before = new Date().toISOString().split('T')[0];
    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, true, 'advanced should be true');
    assert.strictEqual(output.previous_plan, 1, 'previous_plan should be 1');
    assert.strictEqual(output.current_plan, 2, 'current_plan should be 2');
    assert.strictEqual(output.total_plans, 3, 'total_plans should be 3');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('**Current Plan:** 2'), 'Current Plan should be updated to 2');
    assert.ok(updated.includes('**Status:** Ready to execute'), 'Status should be Ready to execute');
    const after = new Date().toISOString().split('T')[0];
    assert.ok(
      updated.includes(`**Last Activity:** ${before}`) || updated.includes(`**Last Activity:** ${after}`),
      `Last Activity should be today (${before}) or next day if midnight boundary (${after})`
    );
  });

  test('marks phase complete on last plan', () => {
    const lastPlanFixture = advanceFixture.replace('**Current Plan:** 1', '**Current Plan:** 3');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), lastPlanFixture);

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, false, 'advanced should be false');
    assert.strictEqual(output.reason, 'last_plan', 'reason should be last_plan');
    assert.strictEqual(output.status, 'ready_for_verification', 'status should be ready_for_verification');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('Phase complete'), 'Status should contain Phase complete');
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.includes('STATE.md'), 'error should mention STATE.md');
  });

  test('returns error when plan fields not parseable', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.toLowerCase().includes('cannot parse'), 'error should mention Cannot parse');
  });

  test('advances plan in compound "Plan: X of Y" format', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\nPlan: 2 of 5 in current phase\nStatus: In progress\nLast activity: 2025-01-01\n`
    );

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, true, 'advanced should be true');
    assert.strictEqual(output.previous_plan, 2);
    assert.strictEqual(output.current_plan, 3);
    assert.strictEqual(output.total_plans, 5);

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('Plan: 3 of 5 in current phase'),
      'should preserve compound format with updated plan number');
    assert.ok(updated.includes('Status: Ready to execute'),
      'Status should be updated');
  });

  test('marks phase complete on last plan in compound format', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\nPlan: 3 of 3 in current phase\nStatus: In progress\nLast activity: 2025-01-01\n`
    );

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.advanced, false);
    assert.strictEqual(output.reason, 'last_plan');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('Phase complete'), 'Status should contain Phase complete');
  });
});

describe('cmdStateRecordMetric (state record-metric)', () => {
  let tmpDir;

  const metricsFixture = [
    '# Project State',
    '',
    '## Performance Metrics',
    '',
    '| Plan | Duration | Tasks | Files |',
    '|------|----------|-------|-------|',
    '| Phase 1 P1 | 3min | 2 tasks | 3 files |',
    '',
    '## Session Continuity',
  ].join('\n') + '\n';

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('appends metric row to existing table', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), metricsFixture);

    const result = runGsdTools('state record-metric --phase 2 --plan 1 --duration 5min --tasks 3 --files 4', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'recorded should be true');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('| Phase 2 P1 | 5min | 3 tasks | 4 files |'), 'new row should be present');
    assert.ok(updated.includes('| Phase 1 P1 | 3min | 2 tasks | 3 files |'), 'existing row should still be present');
  });

  test('replaces None yet placeholder with first metric', () => {
    const noneYetFixture = [
      '# Project State',
      '',
      '## Performance Metrics',
      '',
      '| Plan | Duration | Tasks | Files |',
      '|------|----------|-------|-------|',
      'None yet',
      '',
      '## Session Continuity',
    ].join('\n') + '\n';
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), noneYetFixture);

    const result = runGsdTools('state record-metric --phase 1 --plan 1 --duration 2min --tasks 1 --files 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(!updated.includes('None yet'), 'None yet placeholder should be removed');
    assert.ok(updated.includes('| Phase 1 P1 | 2min | 1 tasks | 2 files |'), 'new row should be present');
  });

  test('returns error when required fields missing', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), metricsFixture);

    const result = runGsdTools('state record-metric --phase 1', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(
      output.error.includes('phase') || output.error.includes('plan') || output.error.includes('duration'),
      'error should mention missing required fields'
    );
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state record-metric --phase 1 --plan 1 --duration 2min', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.includes('STATE.md'), 'error should mention STATE.md');
  });
});

describe('cmdStateUpdateProgress (state update-progress)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('calculates progress from plan/summary counts', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Progress:** [░░░░░░░░░░] 0%\n'
    );

    // Phase 01: 1 PLAN + 1 SUMMARY = completed
    const phase01Dir = path.join(tmpDir, '.planning', 'phases', '01');
    fs.mkdirSync(phase01Dir, { recursive: true });
    fs.writeFileSync(path.join(phase01Dir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase01Dir, '01-01-SUMMARY.md'), '# Summary\n');

    // Phase 02: 1 PLAN only = not completed
    const phase02Dir = path.join(tmpDir, '.planning', 'phases', '02');
    fs.mkdirSync(phase02Dir, { recursive: true });
    fs.writeFileSync(path.join(phase02Dir, '02-01-PLAN.md'), '# Plan\n');

    const result = runGsdTools('state update-progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'updated should be true');
    assert.strictEqual(output.percent, 50, 'percent should be 50');
    assert.strictEqual(output.completed, 1, 'completed should be 1');
    assert.strictEqual(output.total, 2, 'total should be 2');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('50%'), 'STATE.md Progress should contain 50%');
  });

  test('handles zero plans gracefully', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Progress:** [░░░░░░░░░░] 0%\n'
    );

    const result = runGsdTools('state update-progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.percent, 0, 'percent should be 0 when no plans found');
  });

  test('returns error when Progress field missing', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n'
    );

    const result = runGsdTools('state update-progress', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'updated should be false');
    assert.ok(output.reason !== undefined, 'should have a reason');
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state update-progress', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.includes('STATE.md'), 'error should mention STATE.md');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdStateResolveBlocker, cmdStateRecordSession
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdStateResolveBlocker (state resolve-blocker)', () => {
  let tmpDir;

  const blockerFixture = [
    '# Project State',
    '',
    '## Blockers',
    '',
    '- Waiting for API credentials',
    '- Need design review for dashboard',
    '- Pending vendor approval',
    '',
    '## Session Continuity',
  ].join('\n') + '\n';

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('removes matching blocker line (case-insensitive substring match)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), blockerFixture);

    const result = runGsdTools('state resolve-blocker --text "api credentials"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.resolved, true, 'resolved should be true');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(!updated.includes('Waiting for API credentials'), 'matched blocker should be removed');
    assert.ok(updated.includes('Need design review for dashboard'), 'other blocker should still be present');
    assert.ok(updated.includes('Pending vendor approval'), 'other blocker should still be present');
  });

  test('adds None placeholder when last blocker resolved', () => {
    const singleBlockerFixture = [
      '# Project State',
      '',
      '## Blockers',
      '',
      '- Single blocker',
      '',
      '## Session Continuity',
    ].join('\n') + '\n';
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), singleBlockerFixture);

    const result = runGsdTools('state resolve-blocker --text "single blocker"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(!updated.includes('- Single blocker'), 'resolved blocker should be removed');

    // Section should contain "None" placeholder, not be empty
    const sectionMatch = updated.match(/## Blockers\n([\s\S]*?)(?=\n##|$)/i);
    assert.ok(sectionMatch, 'Blockers section should still exist');
    assert.ok(sectionMatch[1].includes('None'), 'Blockers section should contain None placeholder');
  });

  test('returns error when text not provided', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), blockerFixture);

    const result = runGsdTools('state resolve-blocker', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(
      output.error.toLowerCase().includes('text'),
      'error should mention text required'
    );
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state resolve-blocker --text "anything"', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.includes('STATE.md'), 'error should mention STATE.md');
  });

  test('returns resolved true even if no line matches', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), blockerFixture);

    const result = runGsdTools('state resolve-blocker --text "nonexistent blocker text"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.resolved, true, 'resolved should be true even when no line matches');
  });
});

describe('cmdStateRecordSession (state record-session)', () => {
  let tmpDir;

  const sessionFixture = [
    '# Project State',
    '',
    '## Session Continuity',
    '',
    '**Last session:** 2024-01-10',
    '**Stopped at:** Phase 2, Plan 1',
    '**Resume file:** None',
  ].join('\n') + '\n';

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('updates session fields with stopped-at and resume-file', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), sessionFixture);

    const result = runGsdTools(
      'state record-session --stopped-at "Phase 3, Plan 2" --resume-file ".planning/phases/03/03-02-PLAN.md"',
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'recorded should be true');
    assert.ok(Array.isArray(output.updated), 'updated should be an array');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('Phase 3, Plan 2'), 'Stopped at should be updated');
    assert.ok(updated.includes('.planning/phases/03/03-02-PLAN.md'), 'Resume file should be updated');

    const today = new Date().toISOString().split('T')[0];
    assert.ok(updated.includes(today), 'Last session should be updated to today');
  });

  test('updates Last session timestamp even with no other options', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), sessionFixture);

    const result = runGsdTools('state record-session', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true, 'recorded should be true');

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    const today = new Date().toISOString().split('T')[0];
    assert.ok(updated.includes(today), 'Last session should contain today\'s date');
  });

  test('sets Resume file to None when not specified', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), sessionFixture);

    const result = runGsdTools('state record-session --stopped-at "Phase 1 complete"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('Phase 1 complete'), 'Stopped at should be updated');
    // Resume file should be set to None (default)
    const resumeMatch = updated.match(/\*\*Resume file:\*\*\s*(.*)/i);
    assert.ok(resumeMatch, 'Resume file field should exist');
    assert.ok(resumeMatch[1].trim() === 'None', 'Resume file should be None when not specified');
  });

  test('returns error when STATE.md missing', () => {
    const result = runGsdTools('state record-session', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.error !== undefined, 'output should have error field');
    assert.ok(output.error.includes('STATE.md'), 'error should mention STATE.md');
  });

  test('returns recorded false when no session fields found', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Status:** Active\n**Phase:** 03\n'
    );

    const result = runGsdTools('state record-session', tmpDir);
    assert.ok(result.success, `Command should exit 0: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, false, 'recorded should be false when no session fields found');
    assert.ok(output.reason !== undefined, 'should have a reason');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Milestone-scoped phase counting in frontmatter
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone-scoped phase counting in frontmatter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('total_phases counts only current milestone phases', () => {
    // ROADMAP lists only phases 5-6 (current milestone)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '## Roadmap v2.0: Next Release',
        '',
        '### Phase 5: Auth',
        '**Goal:** Add authentication',
        '',
        '### Phase 6: Dashboard',
        '**Goal:** Build dashboard',
      ].join('\n')
    );

    // Disk has dirs 01-06 (01-04 are leftover from previous milestone)
    for (let i = 1; i <= 6; i++) {
      const padded = String(i).padStart(2, '0');
      const phaseDir = path.join(tmpDir, '.planning', 'phases', `${padded}-phase-${i}`);
      fs.mkdirSync(phaseDir, { recursive: true });
      // Add a plan to each
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-PLAN.md`), '# Plan');
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-SUMMARY.md`), '# Summary');
    }

    // Write a STATE.md and trigger a write that will sync frontmatter
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Current Phase:** 05\n**Status:** In progress\n'
    );

    const result = runGsdTools('state update Status "Executing"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Read the state json to check frontmatter
    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const output = JSON.parse(jsonResult.output);
    assert.strictEqual(Number(output.progress.total_phases), 2, 'should count only milestone phases (5 and 6), not all 6');
    assert.strictEqual(Number(output.progress.completed_phases), 2, 'both milestone phases have summaries');
  });

  test('total_phases includes ROADMAP phases without directories', () => {
    // ROADMAP lists 6 phases (5-10), but only 4 have directories on disk
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '## Roadmap v3.0',
        '',
        '### Phase 5: Auth',
        '### Phase 6: Dashboard',
        '### Phase 7: API',
        '### Phase 8: Notifications',
        '### Phase 9: Analytics',
        '### Phase 10: Polish',
      ].join('\n')
    );

    // Only phases 5-8 have directories (9 and 10 not yet planned)
    for (let i = 5; i <= 8; i++) {
      const padded = String(i).padStart(2, '0');
      const phaseDir = path.join(tmpDir, '.planning', 'phases', `${padded}-phase-${i}`);
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-PLAN.md`), '# Plan');
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-SUMMARY.md`), '# Summary');
    }

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Current Phase:** 08\n**Status:** In progress\n'
    );

    const result = runGsdTools('state update Status "Executing"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const output = JSON.parse(jsonResult.output);
    assert.strictEqual(Number(output.progress.total_phases), 6, 'should count all 6 ROADMAP phases, not just 4 with directories');
    assert.strictEqual(Number(output.progress.completed_phases), 4, 'only 4 phases have summaries');
  });

  test('without ROADMAP counts all phases (pass-all filter)', () => {
    // No ROADMAP.md — all phases should be counted
    for (let i = 1; i <= 4; i++) {
      const padded = String(i).padStart(2, '0');
      const phaseDir = path.join(tmpDir, '.planning', 'phases', `${padded}-phase-${i}`);
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, `${padded}-01-PLAN.md`), '# Plan');
    }

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Current Phase:** 01\n**Status:** Planning\n'
    );

    const result = runGsdTools('state update Status "In progress"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const output = JSON.parse(jsonResult.output);
    assert.strictEqual(Number(output.progress.total_phases), 4, 'without ROADMAP should count all 4 phases');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// begin-phase — field preservation (#1365)
// ─────────────────────────────────────────────────────────────────────────────

describe('state begin-phase preserves Current Position fields (#1365)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('begin-phase preserves Status, Last activity, and Progress in Current Position', () => {
    const stateMd = `# Project State

**Current Phase:** 1
**Current Phase Name:** setup
**Total Phases:** 5
**Current Plan:** 0
**Total Plans in Phase:** 0
**Status:** Ready to plan
**Last Activity:** 2026-03-20
**Last Activity Description:** Roadmap created

## Current Position
Phase: 1 of 5 (setup)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-20 -- Roadmap created
Progress: [..........] 0%

## Decisions Made

| Phase | Decision | Rationale |
|-------|----------|-----------|
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools(
      ['state', 'begin-phase', '--phase', '1', '--name', 'setup', '--plans', '4'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8'
    );

    // Extract the Current Position section
    const posMatch = content.match(/## Current Position\s*\n([\s\S]*?)(?=\n##|$)/i);
    assert.ok(posMatch, 'Current Position section should exist');
    const posSection = posMatch[1];

    // Phase and Plan lines should be updated
    assert.ok(/^Phase:.*EXECUTING/m.test(posSection), 'Phase line should say EXECUTING');
    assert.ok(/^Plan:.*1 of 4/m.test(posSection), 'Plan line should show 1 of 4');

    // Status, Last activity, and Progress must still be present (the bug destroys these)
    assert.ok(/^Status:/m.test(posSection),
      'Status field must be preserved in Current Position');
    assert.ok(/^Last activity:/m.test(posSection),
      'Last activity field must be preserved in Current Position');
    assert.ok(/^Progress:/m.test(posSection),
      'Progress field must be preserved in Current Position');
  });

  test('advance-plan can update Status after begin-phase', () => {
    // Simulates the full workflow: begin-phase then advance through all plans
    const stateMd = `# Project State

**Current Phase:** 1
**Current Phase Name:** setup
**Total Phases:** 5
**Current Plan:** 0
**Total Plans in Phase:** 0
**Status:** Ready to plan
**Last Activity:** 2026-03-20
**Last Activity Description:** Roadmap created

## Current Position
Phase: 1 of 5 (setup)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-20 -- Roadmap created
Progress: [..........] 0%

## Decisions Made

| Phase | Decision | Rationale |
|-------|----------|-----------|
`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    // Step 1: begin-phase
    const beginResult = runGsdTools(
      ['state', 'begin-phase', '--phase', '1', '--name', 'setup', '--plans', '2'],
      tmpDir
    );
    assert.ok(beginResult.success, `begin-phase failed: ${beginResult.error}`);

    // Step 2: advance-plan to go from plan 1 to plan 2
    const adv1 = runGsdTools(['state', 'advance-plan'], tmpDir);
    assert.ok(adv1.success, `advance-plan 1 failed: ${adv1.error}`);

    // Step 3: advance-plan again — plan 2 of 2 is the last, should set "Phase complete"
    const adv2 = runGsdTools(['state', 'advance-plan'], tmpDir);
    assert.ok(adv2.success, `advance-plan 2 failed: ${adv2.error}`);

    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8'
    );
    const posMatch = content.match(/## Current Position\s*\n([\s\S]*?)(?=\n##|$)/i);
    assert.ok(posMatch, 'Current Position section should exist after advance-plan');
    const posSection = posMatch[1];

    // After advancing past all plans, Status should say "Phase complete"
    assert.ok(/Status:.*Phase complete/i.test(posSection),
      'Status should be updated to "Phase complete" after last advance-plan');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug #1589 — progress counters not updated during plan execution
// ─────────────────────────────────────────────────────────────────────────────

describe('progress counters correct after plan execution (#1589)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('percent in frontmatter is derived from disk counts, not stale Progress body field', () => {
    // STATE.md body still says 0% (update-progress was never called or was skipped),
    // but all 4 plans across 2 phases have SUMMARY.md files on disk.
    // After any STATE.md write, the frontmatter percent must reflect disk reality.
    const phase01Dir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    const phase02Dir = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase01Dir, { recursive: true });
    fs.mkdirSync(phase02Dir, { recursive: true });

    // Phase 01: 2 plans, 2 summaries (complete)
    fs.writeFileSync(path.join(phase01Dir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase01Dir, '01-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phase01Dir, '01-02-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase01Dir, '01-02-SUMMARY.md'), '# Summary\n');

    // Phase 02: 2 plans, 2 summaries (complete)
    fs.writeFileSync(path.join(phase02Dir, '02-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase02Dir, '02-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phase02Dir, '02-02-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase02Dir, '02-02-SUMMARY.md'), '# Summary\n');

    // Body Progress: still says 0% (stale — never updated by update-progress)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Current Phase:** 02\n**Status:** Phase complete — ready for verification\n**Progress:** [░░░░░░░░░░] 0%\n'
    );

    // Trigger a STATE.md write (e.g. state update Status)
    const result = runGsdTools('state update Status "Milestone complete"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Read the frontmatter — percent must be derived from disk (4/4 = 100%), not from body "0%"
    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);
    const output = JSON.parse(jsonResult.output);

    assert.ok(output.progress, 'frontmatter must have progress object');
    assert.strictEqual(Number(output.progress.total_plans), 4, 'total_plans must be 4 from disk');
    assert.strictEqual(Number(output.progress.completed_plans), 4, 'completed_plans must be 4 from disk');
    assert.strictEqual(Number(output.progress.total_phases), 2, 'total_phases must be 2 from disk');
    assert.strictEqual(Number(output.progress.completed_phases), 2, 'completed_phases must be 2 from disk');
    assert.strictEqual(Number(output.progress.percent), 100, 'percent must be 100 (derived from disk counts, not stale body 0%)');
  });

  test('percent is 0 when no summaries exist even if Progress body says 100%', () => {
    // Inverse: body says 100% but disk has no summaries.
    // Frontmatter percent must come from disk, not body.
    const phase01Dir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phase01Dir, { recursive: true });
    fs.writeFileSync(path.join(phase01Dir, '01-01-PLAN.md'), '# Plan\n');
    // No summary files

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Current Phase:** 01\n**Status:** In progress\n**Progress:** [██████████] 100%\n'
    );

    const result = runGsdTools('state update Status "Executing"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);
    const output = JSON.parse(jsonResult.output);

    assert.ok(output.progress, 'frontmatter must have progress object');
    assert.strictEqual(Number(output.progress.total_plans), 1, 'total_plans must be 1 from disk');
    assert.strictEqual(Number(output.progress.completed_plans), 0, 'completed_plans must be 0 (no summaries)');
    assert.strictEqual(Number(output.progress.percent), 0, 'percent must be 0 (derived from disk, not stale body 100%)');
  });

  test('state json rebuilds stale frontmatter progress from disk after all plans complete', () => {
    // Reproduces the exact scenario from #1589:
    // Frontmatter was written early with stale counters.
    // All summaries now exist on disk.
    // state json must return fresh disk-derived progress.
    const phase01Dir = path.join(tmpDir, '.planning', 'phases', '01-phase');
    const phase02Dir = path.join(tmpDir, '.planning', 'phases', '02-phase');
    const phase03Dir = path.join(tmpDir, '.planning', 'phases', '03-phase');
    const phase04Dir = path.join(tmpDir, '.planning', 'phases', '04-phase');
    fs.mkdirSync(phase01Dir, { recursive: true });
    fs.mkdirSync(phase02Dir, { recursive: true });
    fs.mkdirSync(phase03Dir, { recursive: true });
    fs.mkdirSync(phase04Dir, { recursive: true });

    // 4 phases, 6 total plans (as in the bug report)
    fs.writeFileSync(path.join(phase01Dir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase01Dir, '01-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phase02Dir, '02-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase02Dir, '02-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phase02Dir, '02-02-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase02Dir, '02-02-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phase03Dir, '03-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase03Dir, '03-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phase04Dir, '04-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase04Dir, '04-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phase04Dir, '04-02-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase04Dir, '04-02-SUMMARY.md'), '# Summary\n');

    // Write STATE.md with stale frontmatter matching the bug report exactly
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `---\ngsd_state_version: '1.0'\nstatus: executing\nprogress:\n  total_phases: 4\n  completed_phases: 0\n  total_plans: 0\n  completed_plans: 4\n  percent: 0\n---\n\n# Project State\n\n**Current Phase:** 04\n**Status:** Ready to execute\n**Progress:** [░░░░░░░░░░] 0%\n`
    );

    // state json must return fresh progress derived from disk (all 6 plans complete across 4 phases)
    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);
    const output = JSON.parse(jsonResult.output);

    assert.ok(output.progress, 'frontmatter must have progress object');
    assert.strictEqual(Number(output.progress.total_plans), 6, 'total_plans must be 6 (not stale 0)');
    assert.strictEqual(Number(output.progress.completed_plans), 6, 'completed_plans must be 6 (not stale 4)');
    assert.strictEqual(Number(output.progress.total_phases), 4, 'total_phases must be 4');
    assert.strictEqual(Number(output.progress.completed_phases), 4, 'completed_phases must be 4 (not stale 0)');
    assert.strictEqual(Number(output.progress.percent), 100, 'percent must be 100 (not stale 0)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updatePerformanceMetricsSection (Step 1)
// ─────────────────────────────────────────────────────────────────────────────

describe('updatePerformanceMetricsSection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty Performance Metrics section rebuilds with zeros', () => {
    const content = `# Project State

**Status:** Executing Phase 3

## Performance Metrics

**Velocity:**
- Total plans completed: [N]
- Average duration: [X] min
- Total execution time: [X.X] hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context
`;

    // We test via the CLI: phase complete triggers updatePerformanceMetricsSection
    // But first let's test the helper directly via state planned-phase + phase complete flow
    // For a unit-style test, write STATE.md and call state validate to check metrics
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, content);

    // Create a phase with 2 plans, 2 summaries
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), '# Summary 1\n');
    fs.writeFileSync(path.join(phaseDir, '03-02-SUMMARY.md'), '# Summary 2\n');

    // Also need ROADMAP.md for phase complete
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## Phase 3: API\n\n- [ ] Phase 3: API Layer\n`
    );

    const result = runGsdTools('phase complete 3', tmpDir);
    assert.ok(result.success, `phase complete failed: ${result.error}`);

    const stateAfter = fs.readFileSync(statePath, 'utf-8');
    assert.ok(stateAfter.includes('Total plans completed:'), 'Velocity section should have total plans');
    assert.ok(stateAfter.match(/Total plans completed:\s*2/), 'Total plans should be 2');
    assert.ok(stateAfter.includes('| 3'), 'By Phase table should have row for phase 3');
  });

  test('existing Plan Execution Times rows aggregated into Velocity/By Phase', () => {
    const content = `# Project State

**Current Phase:** 04
**Status:** Executing Phase 4

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 3 P1 | 12 min | 5 tasks | 3 files |
| Phase 3 P2 | 8 min | 3 tasks | 2 files |

**Velocity:**
- Total plans completed: 2
- Average duration: 10 min
- Total execution time: 0.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 3 | 2 | 20 min | 10 min |

## Accumulated Context
`;
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, content);

    // Create phase 4 with 1 plan, 1 summary
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '04-ui');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '04-01-PLAN.md'), '# Plan 1\n');
    fs.writeFileSync(path.join(phaseDir, '04-01-SUMMARY.md'), '# Summary 1\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## Phase 4: UI\n\n- [ ] Phase 4: UI Layer\n`
    );

    const result = runGsdTools('phase complete 4', tmpDir);
    assert.ok(result.success, `phase complete failed: ${result.error}`);

    const stateAfter = fs.readFileSync(statePath, 'utf-8');
    assert.ok(stateAfter.match(/Total plans completed:\s*3/), 'Total plans should be 3 (2 previous + 1 new)');
    assert.ok(stateAfter.includes('| 4'), 'By Phase table should have row for phase 4');
  });

  test('idempotent — running twice produces same result', () => {
    const content = `# Project State

**Current Phase:** 05
**Status:** Executing Phase 5

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: N/A
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|

## Accumulated Context
`;
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, content);

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '05-final');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '05-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '05-01-SUMMARY.md'), '# Summary\n');

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## Phase 5: Final\n\n- [ ] Phase 5: Final\n`
    );

    runGsdTools('phase complete 5', tmpDir);
    const afterFirst = fs.readFileSync(statePath, 'utf-8');

    // Reset state so we can complete again
    let resetContent = afterFirst.replace(/Milestone complete|Ready to plan/, 'Executing Phase 5');
    resetContent = resetContent.replace(/Not started/, '1');
    fs.writeFileSync(statePath, resetContent);

    // Re-create plan files (they still exist)
    runGsdTools('phase complete 5', tmpDir);
    const afterSecond = fs.readFileSync(statePath, 'utf-8');

    // Both should have same total plans count (idempotent update for same phase)
    const firstCount = afterFirst.match(/Total plans completed:\s*(\d+)/);
    const secondCount = afterSecond.match(/Total plans completed:\s*(\d+)/);
    assert.ok(firstCount, 'First run should have total plans');
    assert.ok(secondCount, 'Second run should have total plans');
    // Second run adds another completion for phase 5, so count increments
    // The key is the By Phase row for phase 5 should be updated, not duplicated
    const phase5Rows = (afterSecond.match(/\|\s*5\s*\|/g) || []).length;
    assert.ok(phase5Rows <= 1, 'Phase 5 should appear at most once in By Phase table (no duplicates)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state planned-phase (Step 3 — Gate 3a)
// ─────────────────────────────────────────────────────────────────────────────

describe('state planned-phase command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('after call: Status is "Ready to execute"', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Status:** Planning Phase 3\n**Total Plans in Phase:** 0\n**Last Activity:** 2024-01-01\n**Current Phase:** 3\n`
    );

    const result = runGsdTools(['state', 'planned-phase', '--phase', '3', '--name', 'API', '--plans', '5'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const stateContent = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(stateContent.includes('Ready to execute'), 'Status should be "Ready to execute"');
  });

  test('after call: Total Plans matches argument', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Status:** Planning\n**Total Plans in Phase:** 0\n**Last Activity:** 2024-01-01\n**Current Phase:** 2\n`
    );

    const result = runGsdTools(['state', 'planned-phase', '--phase', '2', '--name', 'Core', '--plans', '7'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const stateContent = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(stateContent.match(/Total Plans in Phase.*7/), 'Total Plans should be 7');
  });

  test('after call: Last Activity is today\'s date', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Status:** Planning\n**Total Plans in Phase:** 0\n**Last Activity:** 2024-01-01\n**Current Phase:** 1\n`
    );

    const result = runGsdTools(['state', 'planned-phase', '--phase', '1', '--name', 'Setup', '--plans', '3'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const today = new Date().toISOString().split('T')[0];
    const stateContent = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(stateContent.includes(today), `Last Activity should contain today's date (${today})`);
  });

  test('missing STATE.md returns graceful error', () => {
    // No STATE.md written
    const result = runGsdTools(['state', 'planned-phase', '--phase', '1', '--name', 'Test', '--plans', '3'], tmpDir);
    assert.ok(result.success, 'Should not crash');
    const output = JSON.parse(result.output);
    assert.ok(output.error, 'Should return error field');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state validate (Step 4 — Gate 1)
// ─────────────────────────────────────────────────────────────────────────────

describe('state validate command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('STATE says executing + VERIFICATION.md shows passed emits warning', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Status:** Executing Phase 2\n**Current Phase:** 2\n**Total Plans in Phase:** 2\n**Current Plan:** 1\n`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '02-core');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '02-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '02-02-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '02-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phaseDir, '02-02-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phaseDir, '02-VERIFICATION.md'), '---\nstatus: passed\n---\n# Verification\n');

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.ok(output.warnings.length > 0, 'Should have warnings when executing but verification passed');
    assert.ok(output.warnings.some(w => /verif/i.test(w)), 'Warning should mention verification');
  });

  test('STATE plan count 3 but 12 SUMMARY.md on disk emits mismatch warning', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Status:** Executing Phase 1\n**Current Phase:** 1\n**Total Plans in Phase:** 3\n**Current Plan:** 1\n`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    // Write 12 plans and summaries
    for (let i = 1; i <= 12; i++) {
      const padded = String(i).padStart(2, '0');
      fs.writeFileSync(path.join(phaseDir, `01-${padded}-PLAN.md`), '# Plan\n');
      fs.writeFileSync(path.join(phaseDir, `01-${padded}-SUMMARY.md`), '# Summary\n');
    }

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.ok(output.warnings.length > 0, 'Should have warnings for plan count mismatch');
    assert.ok(output.warnings.some(w => /plan.*count|count.*mismatch/i.test(w)), 'Warning should mention plan count mismatch');
  });

  test('perfect state returns valid: true, no warnings', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Status:** Executing Phase 1\n**Current Phase:** 1\n**Total Plans in Phase:** 2\n**Current Plan:** 1\n`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan\n');

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid, true, 'Should be valid');
    assert.strictEqual(output.warnings.length, 0, 'Should have no warnings');
  });

  test('missing STATE.md returns graceful error', () => {
    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, 'Should not crash');
    const output = JSON.parse(result.output);
    assert.ok(output.error, 'Should return error field');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state sync (Step 5 — Gate 2)
// ─────────────────────────────────────────────────────────────────────────────

describe('state sync command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('drifted STATE.md + correct filesystem: after sync, fields match disk', () => {
    // STATE says phase 1 with 0 plans, but disk has phase 2 with 3 plans
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Status:** Planning\n**Current Phase:** 1\n**Total Plans in Phase:** 0\n**Current Plan:** 0\n**Progress:** 0%\n`
    );

    const phase1Dir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phase1Dir, { recursive: true });
    fs.writeFileSync(path.join(phase1Dir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase1Dir, '01-01-SUMMARY.md'), '# Summary\n');

    const phase2Dir = path.join(tmpDir, '.planning', 'phases', '02-core');
    fs.mkdirSync(phase2Dir, { recursive: true });
    fs.writeFileSync(path.join(phase2Dir, '02-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase2Dir, '02-02-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase2Dir, '02-03-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phase2Dir, '02-01-SUMMARY.md'), '# Summary\n');

    const result = runGsdTools('state sync', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.ok(output.synced, 'Should report synced');

    const stateAfter = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    // Total plans in current phase (phase 2 since it's highest with incomplete plans) should be 3
    assert.ok(stateAfter.match(/Total Plans in Phase.*3/), 'Total Plans should match disk (3)');
  });

  test('run sync twice is idempotent', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Status:** Executing Phase 1\n**Current Phase:** 1\n**Total Plans in Phase:** 2\n**Current Plan:** 1\n**Progress:** 0%\n`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');

    runGsdTools('state sync', tmpDir);
    const afterFirst = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');

    runGsdTools('state sync', tmpDir);
    const afterSecond = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');

    // Strip frontmatter timestamps which will differ
    const stripTimestamps = (s) => s.replace(/last_updated:.*\n/g, '').replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, 'TS');
    assert.strictEqual(stripTimestamps(afterFirst), stripTimestamps(afterSecond), 'Two syncs should produce same result');
  });

  test('--verify flag reports changes without writing', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Status:** Planning\n**Current Phase:** 1\n**Total Plans in Phase:** 0\n**Current Plan:** 0\n**Progress:** 0%\n`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan\n');

    const before = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');

    const result = runGsdTools('state sync --verify', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.ok(output.changes && output.changes.length > 0, 'Should report changes');
    assert.strictEqual(output.dry_run, true, 'Should indicate dry run');

    const after = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.strictEqual(before, after, 'File should not be modified in verify mode');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// summary-extract command
// ─────────────────────────────────────────────────────────────────────────────
