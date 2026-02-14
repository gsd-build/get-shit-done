/**
 * GSD Tools Tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS_PATH = path.join(__dirname, 'gsd-tools.cjs');

// Helper to run gsd-tools command
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Create temp directory structure
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

describe('history-digest command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns valid schema', () => {
    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    assert.deepStrictEqual(digest.phases, {}, 'phases should be empty object');
    assert.deepStrictEqual(digest.decisions, [], 'decisions should be empty array');
    assert.deepStrictEqual(digest.tech_stack, [], 'tech_stack should be empty array');
  });

  test('nested frontmatter fields extracted correctly', () => {
    // Create phase directory with SUMMARY containing nested frontmatter
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    const summaryContent = `---
phase: "01"
name: "Foundation Setup"
dependency-graph:
  provides:
    - "Database schema"
    - "Auth system"
  affects:
    - "API layer"
tech-stack:
  added:
    - "prisma"
    - "jose"
patterns-established:
  - "Repository pattern"
  - "JWT auth flow"
key-decisions:
  - "Use Prisma over Drizzle"
  - "JWT in httpOnly cookies"
---

# Summary content here
`;

    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), summaryContent);

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    // Check nested dependency-graph.provides
    assert.ok(digest.phases['01'], 'Phase 01 should exist');
    assert.deepStrictEqual(
      digest.phases['01'].provides.sort(),
      ['Auth system', 'Database schema'],
      'provides should contain nested values'
    );

    // Check nested dependency-graph.affects
    assert.deepStrictEqual(
      digest.phases['01'].affects,
      ['API layer'],
      'affects should contain nested values'
    );

    // Check nested tech-stack.added
    assert.deepStrictEqual(
      digest.tech_stack.sort(),
      ['jose', 'prisma'],
      'tech_stack should contain nested values'
    );

    // Check patterns-established (flat array)
    assert.deepStrictEqual(
      digest.phases['01'].patterns.sort(),
      ['JWT auth flow', 'Repository pattern'],
      'patterns should be extracted'
    );

    // Check key-decisions
    assert.strictEqual(digest.decisions.length, 2, 'Should have 2 decisions');
    assert.ok(
      digest.decisions.some(d => d.decision === 'Use Prisma over Drizzle'),
      'Should contain first decision'
    );
  });

  test('multiple phases merged into single digest', () => {
    // Create phase 01
    const phase01Dir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phase01Dir, { recursive: true });
    fs.writeFileSync(
      path.join(phase01Dir, '01-01-SUMMARY.md'),
      `---
phase: "01"
name: "Foundation"
provides:
  - "Database"
patterns-established:
  - "Pattern A"
key-decisions:
  - "Decision 1"
---
`
    );

    // Create phase 02
    const phase02Dir = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase02Dir, { recursive: true });
    fs.writeFileSync(
      path.join(phase02Dir, '02-01-SUMMARY.md'),
      `---
phase: "02"
name: "API"
provides:
  - "REST endpoints"
patterns-established:
  - "Pattern B"
key-decisions:
  - "Decision 2"
tech-stack:
  added:
    - "zod"
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);

    // Both phases present
    assert.ok(digest.phases['01'], 'Phase 01 should exist');
    assert.ok(digest.phases['02'], 'Phase 02 should exist');

    // Decisions merged
    assert.strictEqual(digest.decisions.length, 2, 'Should have 2 decisions total');

    // Tech stack merged
    assert.deepStrictEqual(digest.tech_stack, ['zod'], 'tech_stack should have zod');
  });

  test('malformed SUMMARY.md skipped gracefully', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Valid summary
    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
phase: "01"
provides:
  - "Valid feature"
---
`
    );

    // Malformed summary (no frontmatter)
    fs.writeFileSync(
      path.join(phaseDir, '01-02-SUMMARY.md'),
      `# Just a heading
No frontmatter here
`
    );

    // Another malformed summary (broken YAML)
    fs.writeFileSync(
      path.join(phaseDir, '01-03-SUMMARY.md'),
      `---
broken: [unclosed
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command should succeed despite malformed files: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.ok(digest.phases['01'], 'Phase 01 should exist');
    assert.ok(
      digest.phases['01'].provides.includes('Valid feature'),
      'Valid feature should be extracted'
    );
  });

  test('flat provides field still works (backward compatibility)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
phase: "01"
provides:
  - "Direct provides"
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.deepStrictEqual(
      digest.phases['01'].provides,
      ['Direct provides'],
      'Direct provides should work'
    );
  });

  test('inline array syntax supported', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
phase: "01"
provides: [Feature A, Feature B]
patterns-established: ["Pattern X", "Pattern Y"]
---
`
    );

    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const digest = JSON.parse(result.output);
    assert.deepStrictEqual(
      digest.phases['01'].provides.sort(),
      ['Feature A', 'Feature B'],
      'Inline array should work'
    );
    assert.deepStrictEqual(
      digest.phases['01'].patterns.sort(),
      ['Pattern X', 'Pattern Y'],
      'Inline quoted array should work'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phases list command
// ─────────────────────────────────────────────────────────────────────────────

describe('phases list command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns empty array', () => {
    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.directories, [], 'directories should be empty');
    assert.strictEqual(output.count, 0, 'count should be 0');
  });

  test('lists phase directories sorted numerically', () => {
    // Create out-of-order directories
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '10-final'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 3, 'should have 3 directories');
    assert.deepStrictEqual(
      output.directories,
      ['01-foundation', '02-api', '10-final'],
      'should be sorted numerically'
    );
  });

  test('handles decimal phases in sort order', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.1-hotfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02.2-patch'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-ui'), { recursive: true });

    const result = runGsdTools('phases list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.directories,
      ['02-api', '02.1-hotfix', '02.2-patch', '03-ui'],
      'decimal phases should sort correctly between whole numbers'
    );
  });

  test('--type plans lists only PLAN.md files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan 2');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(phaseDir, 'RESEARCH.md'), '# Research');

    const result = runGsdTools('phases list --type plans', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.files.sort(),
      ['01-01-PLAN.md', '01-02-PLAN.md'],
      'should list only PLAN files'
    );
  });

  test('--type summaries lists only SUMMARY.md files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary 2');

    const result = runGsdTools('phases list --type summaries', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(
      output.files.sort(),
      ['01-01-SUMMARY.md', '01-02-SUMMARY.md'],
      'should list only SUMMARY files'
    );
  });

  test('--phase filters to specific phase directory', () => {
    const phase01 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    const phase02 = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(phase01, { recursive: true });
    fs.mkdirSync(phase02, { recursive: true });
    fs.writeFileSync(path.join(phase01, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase02, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('phases list --type plans --phase 01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.deepStrictEqual(output.files, ['01-01-PLAN.md'], 'should only list phase 01 plans');
    assert.strictEqual(output.phase_dir, 'foundation', 'should report phase name without number prefix');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap get-phase command
// ─────────────────────────────────────────────────────────────────────────────

describe('roadmap get-phase command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('extracts phase section from ROADMAP.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phases

### Phase 1: Foundation
**Goal:** Set up project infrastructure
**Plans:** 2 plans

Some description here.

### Phase 2: API
**Goal:** Build REST API
**Plans:** 3 plans
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase should be found');
    assert.strictEqual(output.phase_number, '1', 'phase number correct');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
    assert.strictEqual(output.goal, 'Set up project infrastructure', 'goal extracted');
  });

  test('returns not found for missing phase', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Set up project
`
    );

    const result = runGsdTools('roadmap get-phase 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'phase should not be found');
  });

  test('handles decimal phase numbers', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 2: Main
**Goal:** Main work

### Phase 2.1: Hotfix
**Goal:** Emergency fix
`
    );

    const result = runGsdTools('roadmap get-phase 2.1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'decimal phase should be found');
    assert.strictEqual(output.phase_name, 'Hotfix', 'phase name correct');
    assert.strictEqual(output.goal, 'Emergency fix', 'goal extracted');
  });

  test('extracts full section content', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Setup
**Goal:** Initialize everything

This phase covers:
- Database setup
- Auth configuration
- CI/CD pipeline

### Phase 2: Build
**Goal:** Build features
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.section.includes('Database setup'), 'section includes description');
    assert.ok(output.section.includes('CI/CD pipeline'), 'section includes all bullets');
    assert.ok(!output.section.includes('Phase 2'), 'section does not include next phase');
  });

  test('handles missing ROADMAP.md gracefully', () => {
    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'should return not found');
    assert.strictEqual(output.error, 'ROADMAP.md not found', 'should explain why');
  });

  test('accepts ## phase headers (two hashes)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phase 1: Foundation
**Goal:** Set up project infrastructure
**Plans:** 2 plans

## Phase 2: API
**Goal:** Build REST API
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase with ## header should be found');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
    assert.strictEqual(output.goal, 'Set up project infrastructure', 'goal extracted');
  });

  test('detects malformed ROADMAP with summary list but no detail sections', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phases

- [ ] **Phase 1: Foundation** - Set up project
- [ ] **Phase 2: API** - Build REST API
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'phase should not be found');
    assert.strictEqual(output.error, 'malformed_roadmap', 'should identify malformed roadmap');
    assert.ok(output.message.includes('missing'), 'should explain the issue');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase next-decimal command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase next-decimal command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns X.1 when no decimal phases exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '07-next'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.1', 'should return 06.1');
    assert.deepStrictEqual(output.existing, [], 'no existing decimals');
  });

  test('increments from existing decimal phases', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-hotfix'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.2-patch'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.3', 'should return 06.3');
    assert.deepStrictEqual(output.existing, ['06.1', '06.2'], 'lists existing decimals');
  });

  test('handles gaps in decimal sequence', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-first'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.3-third'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Should take next after highest, not fill gap
    assert.strictEqual(output.next, '06.4', 'should return 06.4, not fill gap at 06.2');
  });

  test('handles single-digit phase input', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-feature'), { recursive: true });

    const result = runGsdTools('phase next-decimal 6', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next, '06.1', 'should normalize to 06.1');
    assert.strictEqual(output.base_phase, '06', 'base phase should be padded');
  });

  test('returns error if base phase does not exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-start'), { recursive: true });

    const result = runGsdTools('phase next-decimal 06', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'base phase not found');
    assert.strictEqual(output.next, '06.1', 'should still suggest 06.1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase-plan-index command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase-plan-index command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phase directory returns empty plans array', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase, '03', 'phase number correct');
    assert.deepStrictEqual(output.plans, [], 'plans should be empty');
    assert.deepStrictEqual(output.waves, {}, 'waves should be empty');
    assert.deepStrictEqual(output.incomplete, [], 'incomplete should be empty');
    assert.strictEqual(output.has_checkpoints, false, 'no checkpoints');
  });

  test('extracts single plan with frontmatter', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Set up database schema
files-modified: [prisma/schema.prisma, src/lib/db.ts]
---

## Task 1: Create schema
## Task 2: Generate client
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 1, 'should have 1 plan');
    assert.strictEqual(output.plans[0].id, '03-01', 'plan id correct');
    assert.strictEqual(output.plans[0].wave, 1, 'wave extracted');
    assert.strictEqual(output.plans[0].autonomous, true, 'autonomous extracted');
    assert.strictEqual(output.plans[0].objective, 'Set up database schema', 'objective extracted');
    assert.deepStrictEqual(output.plans[0].files_modified, ['prisma/schema.prisma', 'src/lib/db.ts'], 'files extracted');
    assert.strictEqual(output.plans[0].task_count, 2, 'task count correct');
    assert.strictEqual(output.plans[0].has_summary, false, 'no summary yet');
  });

  test('groups multiple plans by wave', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Database setup
---

## Task 1: Schema
`
    );

    fs.writeFileSync(
      path.join(phaseDir, '03-02-PLAN.md'),
      `---
wave: 1
autonomous: true
objective: Auth setup
---

## Task 1: JWT
`
    );

    fs.writeFileSync(
      path.join(phaseDir, '03-03-PLAN.md'),
      `---
wave: 2
autonomous: false
objective: API routes
---

## Task 1: Routes
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans.length, 3, 'should have 3 plans');
    assert.deepStrictEqual(output.waves['1'], ['03-01', '03-02'], 'wave 1 has 2 plans');
    assert.deepStrictEqual(output.waves['2'], ['03-03'], 'wave 2 has 1 plan');
  });

  test('detects incomplete plans (no matching summary)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Plan with summary
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), `---\nwave: 1\n---\n## Task 1`);
    fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), `# Summary`);

    // Plan without summary
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), `---\nwave: 2\n---\n## Task 1`);

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plans[0].has_summary, true, 'first plan has summary');
    assert.strictEqual(output.plans[1].has_summary, false, 'second plan has no summary');
    assert.deepStrictEqual(output.incomplete, ['03-02'], 'incomplete list correct');
  });

  test('detects checkpoints (autonomous: false)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '03-01-PLAN.md'),
      `---
wave: 1
autonomous: false
objective: Manual review needed
---

## Task 1: Review
`
    );

    const result = runGsdTools('phase-plan-index 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_checkpoints, true, 'should detect checkpoint');
    assert.strictEqual(output.plans[0].autonomous, false, 'plan marked non-autonomous');
  });

  test('phase not found returns error', () => {
    const result = runGsdTools('phase-plan-index 99', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'Phase not found', 'should report phase not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// state-snapshot command
// ─────────────────────────────────────────────────────────────────────────────

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
});

// ─────────────────────────────────────────────────────────────────────────────
// summary-extract command
// ─────────────────────────────────────────────────────────────────────────────

describe('summary-extract command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing file returns error', () => {
    const result = runGsdTools('summary-extract .planning/phases/01-test/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'File not found', 'should report missing file');
  });

  test('extracts all fields from SUMMARY.md', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
one-liner: Set up Prisma with User and Project models
key-files:
  - prisma/schema.prisma
  - src/lib/db.ts
tech-stack:
  added:
    - prisma
    - zod
patterns-established:
  - Repository pattern
  - Dependency injection
key-decisions:
  - Use Prisma over Drizzle: Better DX and ecosystem
  - Single database: Start simple, shard later
---

# Summary

Full summary content here.
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.path, '.planning/phases/01-foundation/01-01-SUMMARY.md', 'path correct');
    assert.strictEqual(output.one_liner, 'Set up Prisma with User and Project models', 'one-liner extracted');
    assert.deepStrictEqual(output.key_files, ['prisma/schema.prisma', 'src/lib/db.ts'], 'key files extracted');
    assert.deepStrictEqual(output.tech_added, ['prisma', 'zod'], 'tech added extracted');
    assert.deepStrictEqual(output.patterns, ['Repository pattern', 'Dependency injection'], 'patterns extracted');
    assert.strictEqual(output.decisions.length, 2, 'decisions extracted');
  });

  test('selective extraction with --fields', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
one-liner: Set up database
key-files:
  - prisma/schema.prisma
tech-stack:
  added:
    - prisma
patterns-established:
  - Repository pattern
key-decisions:
  - Use Prisma: Better DX
---
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md --fields one_liner,key_files', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.one_liner, 'Set up database', 'one_liner included');
    assert.deepStrictEqual(output.key_files, ['prisma/schema.prisma'], 'key_files included');
    assert.strictEqual(output.tech_added, undefined, 'tech_added excluded');
    assert.strictEqual(output.patterns, undefined, 'patterns excluded');
    assert.strictEqual(output.decisions, undefined, 'decisions excluded');
  });

  test('handles missing frontmatter fields gracefully', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
one-liner: Minimal summary
---

# Summary
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.one_liner, 'Minimal summary', 'one-liner extracted');
    assert.deepStrictEqual(output.key_files, [], 'key_files defaults to empty');
    assert.deepStrictEqual(output.tech_added, [], 'tech_added defaults to empty');
    assert.deepStrictEqual(output.patterns, [], 'patterns defaults to empty');
    assert.deepStrictEqual(output.decisions, [], 'decisions defaults to empty');
  });

  test('parses key-decisions with rationale', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      `---
key-decisions:
  - Use Prisma: Better DX than alternatives
  - JWT tokens: Stateless auth for scalability
---
`
    );

    const result = runGsdTools('summary-extract .planning/phases/01-foundation/01-01-SUMMARY.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.decisions[0].summary, 'Use Prisma', 'decision summary parsed');
    assert.strictEqual(output.decisions[0].rationale, 'Better DX than alternatives', 'decision rationale parsed');
    assert.strictEqual(output.decisions[1].summary, 'JWT tokens', 'second decision summary');
    assert.strictEqual(output.decisions[1].rationale, 'Stateless auth for scalability', 'second decision rationale');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// init --include flag tests
// ─────────────────────────────────────────────────────────────────────────────

describe('init commands with --include flag', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase includes state and config content', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Current Phase:** 03\n**Status:** In progress'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' })
    );

    const result = runGsdTools('init execute-phase 03 --include state,config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_content, 'state_content should be included');
    assert.ok(output.state_content.includes('Current Phase'), 'state content correct');
    assert.ok(output.config_content, 'config_content should be included');
    assert.ok(output.config_content.includes('model_profile'), 'config content correct');
  });

  test('init execute-phase without --include omits content', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');

    const result = runGsdTools('init execute-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_content, undefined, 'state_content should be omitted');
    assert.strictEqual(output.config_content, undefined, 'config_content should be omitted');
  });

  test('init plan-phase includes multiple file contents', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# Project State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap v1.0');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Requirements');
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research Findings');

    const result = runGsdTools('init plan-phase 03 --include state,roadmap,requirements,context,research', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_content, 'state_content included');
    assert.ok(output.state_content.includes('Project State'), 'state content correct');
    assert.ok(output.roadmap_content, 'roadmap_content included');
    assert.ok(output.roadmap_content.includes('Roadmap v1.0'), 'roadmap content correct');
    assert.ok(output.requirements_content, 'requirements_content included');
    assert.ok(output.context_content, 'context_content included');
    assert.ok(output.research_content, 'research_content included');
  });

  test('init plan-phase includes verification and uat content', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification Results');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT Findings');

    const result = runGsdTools('init plan-phase 03 --include verification,uat', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.verification_content, 'verification_content included');
    assert.ok(output.verification_content.includes('Verification Results'), 'verification content correct');
    assert.ok(output.uat_content, 'uat_content included');
    assert.ok(output.uat_content.includes('UAT Findings'), 'uat content correct');
  });

  test('init progress includes state, roadmap, project, config', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' })
    );

    const result = runGsdTools('init progress --include state,roadmap,project,config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_content, 'state_content included');
    assert.ok(output.roadmap_content, 'roadmap_content included');
    assert.ok(output.project_content, 'project_content included');
    assert.ok(output.config_content, 'config_content included');
  });

  test('missing files return null in content fields', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init execute-phase 03 --include state,config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_content, null, 'missing state returns null');
    assert.strictEqual(output.config_content, null, 'missing config returns null');
  });

  test('partial includes work correctly', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');

    // Only request state, not roadmap
    const result = runGsdTools('init execute-phase 03 --include state', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.state_content, 'state_content included');
    assert.strictEqual(output.roadmap_content, undefined, 'roadmap_content not requested, should be undefined');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap analyze command
// ─────────────────────────────────────────────────────────────────────────────

describe('roadmap analyze command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing ROADMAP.md returns error', () => {
    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'ROADMAP.md not found');
  });

  test('parses phases with goals and disk status', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Set up infrastructure

### Phase 2: Authentication
**Goal:** Add user auth

### Phase 3: Features
**Goal:** Build core features
`
    );

    // Create phase dirs with varying completion
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const p2 = path.join(tmpDir, '.planning', 'phases', '02-authentication');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 3, 'should find 3 phases');
    assert.strictEqual(output.phases[0].disk_status, 'complete', 'phase 1 complete');
    assert.strictEqual(output.phases[1].disk_status, 'planned', 'phase 2 planned');
    assert.strictEqual(output.phases[2].disk_status, 'no_directory', 'phase 3 no directory');
    assert.strictEqual(output.completed_phases, 1, '1 phase complete');
    assert.strictEqual(output.total_plans, 2, '2 total plans');
    assert.strictEqual(output.total_summaries, 1, '1 total summary');
    assert.strictEqual(output.progress_percent, 50, '50% complete');
    assert.strictEqual(output.current_phase, '2', 'current phase is 2');
  });

  test('extracts goals and dependencies', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Setup
**Goal:** Initialize project
**Depends on:** Nothing

### Phase 2: Build
**Goal:** Build features
**Depends on:** Phase 1
`
    );

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases[0].goal, 'Initialize project');
    assert.strictEqual(output.phases[0].depends_on, 'Nothing');
    assert.strictEqual(output.phases[1].goal, 'Build features');
    assert.strictEqual(output.phases[1].depends_on, 'Phase 1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase add command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase add command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('adds phase after highest existing', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API

---
`
    );

    const result = runGsdTools('phase add User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 3, 'should be phase 3');
    assert.strictEqual(output.slug, 'user-dashboard');

    // Verify directory created
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-user-dashboard')),
      'directory should be created'
    );

    // Verify ROADMAP updated
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('### Phase 3: User Dashboard'), 'roadmap should include new phase');
    assert.ok(roadmap.includes('**Depends on:** Phase 2'), 'should depend on previous');
  });

  test('handles empty roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );

    const result = runGsdTools('phase add Initial Setup', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 1, 'should be phase 1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase insert command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase insert command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('inserts decimal phase after target', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runGsdTools('phase insert 1 Fix Critical Bug', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '01.1', 'should be 01.1');
    assert.strictEqual(output.after_phase, '1');

    // Verify directory
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01.1-fix-critical-bug')),
      'decimal phase directory should be created'
    );

    // Verify ROADMAP
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Phase 01.1: Fix Critical Bug (INSERTED)'), 'roadmap should include inserted phase');
  });

  test('increments decimal when siblings exist', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup

### Phase 2: API
**Goal:** Build API
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01.1-hotfix'), { recursive: true });

    const result = runGsdTools('phase insert 1 Another Fix', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '01.2', 'should be 01.2');
  });

  test('rejects missing phase', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Test\n**Goal:** Test\n`
    );

    const result = runGsdTools('phase insert 99 Fix Something', tmpDir);
    assert.ok(!result.success, 'should fail for missing phase');
    assert.ok(result.error.includes('not found'), 'error mentions not found');
  });

  test('handles padding mismatch between input and roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

## Phase 09.05: Existing Decimal Phase
**Goal:** Test padding

## Phase 09.1: Next Phase
**Goal:** Test
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '09.05-existing'), { recursive: true });

    // Pass unpadded "9.05" but roadmap has "09.05"
    const result = runGsdTools('phase insert 9.05 Padding Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.after_phase, '9.05');

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('(INSERTED)'), 'roadmap should include inserted phase');
  });

  test('handles #### heading depth from multi-milestone roadmaps', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### v1.1 Milestone

#### Phase 5: Feature Work
**Goal:** Build features

#### Phase 6: Polish
**Goal:** Polish
`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '05-feature-work'), { recursive: true });

    const result = runGsdTools('phase insert 5 Hotfix', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, '05.1');

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Phase 05.1: Hotfix (INSERTED)'), 'roadmap should include inserted phase');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase remove command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase remove command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('removes phase directory and renumbers subsequent', () => {
    // Setup 3 phases
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Foundation
**Goal:** Setup
**Depends on:** Nothing

### Phase 2: Auth
**Goal:** Authentication
**Depends on:** Phase 1

### Phase 3: Features
**Goal:** Core features
**Depends on:** Phase 2
`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    const p2 = path.join(tmpDir, '.planning', 'phases', '02-auth');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');
    const p3 = path.join(tmpDir, '.planning', 'phases', '03-features');
    fs.mkdirSync(p3, { recursive: true });
    fs.writeFileSync(path.join(p3, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p3, '03-02-PLAN.md'), '# Plan 2');

    // Remove phase 2
    const result = runGsdTools('phase remove 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.removed, '2');
    assert.strictEqual(output.directory_deleted, '02-auth');

    // Phase 3 should be renumbered to 02
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features')),
      'phase 3 should be renumbered to 02-features'
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-features')),
      'old 03-features should not exist'
    );

    // Files inside should be renamed
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features', '02-01-PLAN.md')),
      'plan file should be renumbered to 02-01'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-features', '02-02-PLAN.md')),
      'plan 2 should be renumbered to 02-02'
    );

    // ROADMAP should be updated
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(!roadmap.includes('Phase 2: Auth'), 'removed phase should not be in roadmap');
    assert.ok(roadmap.includes('Phase 2: Features'), 'phase 3 should be renumbered to 2');
  });

  test('rejects removal of phase with summaries unless --force', () => {
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Test\n**Goal:** Test\n`
    );

    // Should fail without --force
    const result = runGsdTools('phase remove 1', tmpDir);
    assert.ok(!result.success, 'should fail without --force');
    assert.ok(result.error.includes('executed plan'), 'error mentions executed plans');

    // Should succeed with --force
    const forceResult = runGsdTools('phase remove 1 --force', tmpDir);
    assert.ok(forceResult.success, `Force remove failed: ${forceResult.error}`);
  });

  test('removes decimal phase and renumbers siblings', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 6: Main\n**Goal:** Main\n### Phase 6.1: Fix A\n**Goal:** Fix A\n### Phase 6.2: Fix B\n**Goal:** Fix B\n### Phase 6.3: Fix C\n**Goal:** Fix C\n`
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06-main'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.1-fix-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.2-fix-b'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '06.3-fix-c'), { recursive: true });

    const result = runGsdTools('phase remove 6.2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // 06.3 should become 06.2
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '06.2-fix-c')),
      '06.3 should be renumbered to 06.2'
    );
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'phases', '06.3-fix-c')),
      'old 06.3 should not exist'
    );
  });

  test('updates STATE.md phase count', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n**Goal:** A\n### Phase 2: B\n**Goal:** B\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 1\n**Total Phases:** 2\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-b'), { recursive: true });

    runGsdTools('phase remove 2', tmpDir);

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('**Total Phases:** 1'), 'total phases should be decremented');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('phase complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('marks phase complete and transitions to next', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation
- [ ] Phase 2: API

### Phase 1: Foundation
**Goal:** Setup
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Foundation\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working on phase 1\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_phase, '1');
    assert.strictEqual(output.plans_executed, '1/1');
    assert.strictEqual(output.next_phase, '02');
    assert.strictEqual(output.is_last_phase, false);

    // Verify STATE.md updated
    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('**Current Phase:** 02'), 'should advance to phase 02');
    assert.ok(state.includes('**Status:** Ready to plan'), 'status should be ready to plan');
    assert.ok(state.includes('**Current Plan:** Not started'), 'plan should be reset');

    // Verify ROADMAP checkbox
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('[x]'), 'phase should be checked off');
    assert.ok(roadmap.includes('completed'), 'completion date should be added');
  });

  test('detects last phase in milestone', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: Only Phase\n**Goal:** Everything\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-only-phase');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.is_last_phase, true, 'should detect last phase');
    assert.strictEqual(output.next_phase, null, 'no next phase');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('Milestone complete'), 'status should be milestone complete');
  });

  test('updates REQUIREMENTS.md traceability when phase completes', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Auth

### Phase 1: Auth
**Goal:** User authentication
**Requirements:** AUTH-01, AUTH-02
**Plans:** 1 plans

### Phase 2: API
**Goal:** Build API
**Requirements:** API-01
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up with email
- [ ] **AUTH-02**: User can log in
- [ ] **AUTH-03**: User can reset password

### API

- [ ] **API-01**: REST endpoints

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 2 | Pending |
| API-01 | Phase 2 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Auth\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-auth');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');

    // Checkboxes updated for phase 1 requirements
    assert.ok(req.includes('- [x] **AUTH-01**'), 'AUTH-01 checkbox should be checked');
    assert.ok(req.includes('- [x] **AUTH-02**'), 'AUTH-02 checkbox should be checked');
    // Other requirements unchanged
    assert.ok(req.includes('- [ ] **AUTH-03**'), 'AUTH-03 should remain unchecked');
    assert.ok(req.includes('- [ ] **API-01**'), 'API-01 should remain unchecked');

    // Traceability table updated
    assert.ok(req.includes('| AUTH-01 | Phase 1 | Complete |'), 'AUTH-01 status should be Complete');
    assert.ok(req.includes('| AUTH-02 | Phase 1 | Complete |'), 'AUTH-02 status should be Complete');
    assert.ok(req.includes('| AUTH-03 | Phase 2 | Pending |'), 'AUTH-03 should remain Pending');
    assert.ok(req.includes('| API-01 | Phase 2 | Pending |'), 'API-01 should remain Pending');
  });

  test('handles phase with no requirements mapping', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Setup

### Phase 1: Setup
**Goal:** Project setup (no requirements)
**Plans:** 1 plans
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements

## v1 Requirements

- [ ] **REQ-01**: Some requirement

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 | Phase 2 | Pending |
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // REQUIREMENTS.md should be unchanged
    const req = fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    assert.ok(req.includes('- [ ] **REQ-01**'), 'REQ-01 should remain unchecked');
    assert.ok(req.includes('| REQ-01 | Phase 2 | Pending |'), 'REQ-01 should remain Pending');
  });

  test('handles missing REQUIREMENTS.md gracefully', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

- [ ] Phase 1: Foundation
**Requirements:** REQ-01

### Phase 1: Foundation
**Goal:** Setup
`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command should succeed even without REQUIREMENTS.md: ${result.error}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('archives roadmap, requirements, creates MILESTONES.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n- [ ] User auth\n- [ ] Dashboard\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\none-liner: Set up project infrastructure\n---\n# Summary\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP Foundation', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.version, 'v1.0');
    assert.strictEqual(output.phases, 1);
    assert.ok(output.archived.roadmap, 'roadmap should be archived');
    assert.ok(output.archived.requirements, 'requirements should be archived');

    // Verify archive files exist
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-ROADMAP.md')),
      'archived roadmap should exist'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-REQUIREMENTS.md')),
      'archived requirements should exist'
    );

    // Verify MILESTONES.md created
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'MILESTONES.md')),
      'MILESTONES.md should be created'
    );
    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v1.0 MVP Foundation'), 'milestone entry should contain name');
    assert.ok(milestones.includes('Set up project infrastructure'), 'accomplishments should be listed');
  });

  test('appends to existing MILESTONES.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      `# Milestones\n\n## v0.9 Alpha (Shipped: 2025-01-01)\n\n---\n\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name Beta', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v0.9 Alpha'), 'existing entry should be preserved');
    assert.ok(milestones.includes('v1.0 Beta'), 'new entry should be appended');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validate consistency command
// ─────────────────────────────────────────────────────────────────────────────

describe('validate consistency command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('passes for consistent project', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n### Phase 2: B\n### Phase 3: C\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-b'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-c'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.passed, true, 'should pass');
    assert.strictEqual(output.warning_count, 0, 'no warnings');
  });

  test('warns about phase on disk but not in roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-orphan'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.warning_count > 0, 'should have warnings');
    assert.ok(
      output.warnings.some(w => w.includes('disk but not in ROADMAP')),
      'should warn about orphan directory'
    );
  });

  test('warns about gaps in phase numbering', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n### Phase 1: A\n### Phase 3: C\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-c'), { recursive: true });

    const result = runGsdTools('validate consistency', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(
      output.warnings.some(w => w.includes('Gap in phase numbering')),
      'should warn about gap'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// progress command
// ─────────────────────────────────────────────────────────────────────────────

describe('progress command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('renders JSON progress', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n`
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Done');
    fs.writeFileSync(path.join(p1, '01-02-PLAN.md'), '# Plan 2');

    const result = runGsdTools('progress json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.total_plans, 2, '2 total plans');
    assert.strictEqual(output.total_summaries, 1, '1 summary');
    assert.strictEqual(output.percent, 50, '50%');
    assert.strictEqual(output.phases.length, 1, '1 phase');
    assert.strictEqual(output.phases[0].status, 'In Progress', 'phase in progress');
  });

  test('renders bar format', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Done');

    const result = runGsdTools('progress bar --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('1/1'), 'should include count');
    assert.ok(result.output.includes('100%'), 'should include 100%');
  });

  test('renders table format', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n`
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');

    const result = runGsdTools('progress table --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('Phase'), 'should have table header');
    assert.ok(result.output.includes('foundation'), 'should include phase name');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// todo complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('todo complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('moves todo from pending to completed', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(
      path.join(pendingDir, 'add-dark-mode.md'),
      `title: Add dark mode\narea: ui\ncreated: 2025-01-01\n`
    );

    const result = runGsdTools('todo complete add-dark-mode.md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed, true);

    // Verify moved
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'todos', 'pending', 'add-dark-mode.md')),
      'should be removed from pending'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'todos', 'completed', 'add-dark-mode.md')),
      'should be in completed'
    );

    // Verify completion timestamp added
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'todos', 'completed', 'add-dark-mode.md'),
      'utf-8'
    );
    assert.ok(content.startsWith('completed:'), 'should have completed timestamp');
  });

  test('fails for nonexistent todo', () => {
    const result = runGsdTools('todo complete nonexistent.md', tmpDir);
    assert.ok(!result.success, 'should fail');
    assert.ok(result.error.includes('not found'), 'error mentions not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// scaffold command
// ─────────────────────────────────────────────────────────────────────────────

describe('scaffold command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('scaffolds context file', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('scaffold context --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    // Verify file content
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'phases', '03-api', '03-CONTEXT.md'),
      'utf-8'
    );
    assert.ok(content.includes('Phase 3'), 'should reference phase number');
    assert.ok(content.includes('Decisions'), 'should have decisions section');
    assert.ok(content.includes('Discretion Areas'), 'should have discretion section');
  });

  test('scaffolds UAT file', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('scaffold uat --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'phases', '03-api', '03-UAT.md'),
      'utf-8'
    );
    assert.ok(content.includes('User Acceptance Testing'), 'should have UAT heading');
    assert.ok(content.includes('Test Results'), 'should have test results section');
  });

  test('scaffolds verification file', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('scaffold verification --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'phases', '03-api', '03-VERIFICATION.md'),
      'utf-8'
    );
    assert.ok(content.includes('Goal-Backward Verification'), 'should have verification heading');
  });

  test('scaffolds phase directory', () => {
    const result = runGsdTools('scaffold phase-dir --phase 5 --name User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '05-user-dashboard')),
      'directory should be created'
    );
  });

  test('does not overwrite existing files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Existing content');

    const result = runGsdTools('scaffold context --phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, false, 'should not overwrite');
    assert.strictEqual(output.reason, 'already_exists');
  });
});

// ─── Atomic Write Tests ───────────────────────────────────────────────────────

describe('atomicWrite (via state update)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state update creates .bak file for existing STATE.md', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n**Status:** planning\n**Current Phase:** 1\n');

    const result = runGsdTools('state update Status building', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Verify .bak exists (atomicWrite creates backup)
    assert.ok(
      fs.existsSync(statePath + '.bak'),
      'Should create .bak backup file'
    );

    // Verify .bak contains original content
    const bakContent = fs.readFileSync(statePath + '.bak', 'utf-8');
    assert.ok(
      bakContent.includes('**Status:** planning'),
      'Backup should contain original content'
    );

    // Verify main file has updated content
    const content = fs.readFileSync(statePath, 'utf-8');
    assert.ok(
      content.includes('**Status:** building'),
      'Main file should have updated content'
    );
  });

  test('no .tmp file left after successful state update', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n**Status:** planning\n');

    runGsdTools('state update Status building', tmpDir);

    assert.ok(
      !fs.existsSync(statePath + '.tmp'),
      'Should not leave .tmp file after success'
    );
  });

  test('no .lock file left after successful state update', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n**Status:** planning\n');

    runGsdTools('state update Status building', tmpDir);

    assert.ok(
      !fs.existsSync(statePath + '.lock'),
      'Should not leave .lock file after success'
    );
  });

  test('config-ensure-section uses atomic write', () => {
    const result = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    assert.ok(fs.existsSync(configPath), 'config.json should exist');

    // No .tmp should be left behind
    assert.ok(
      !fs.existsSync(configPath + '.tmp'),
      'Should not leave .tmp file'
    );
  });

  test('frontmatter set uses atomic write', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    const planPath = path.join(phaseDir, '01-PLAN.md');
    fs.writeFileSync(planPath, '---\nphase: "01"\nplan: "01"\nwave: 1\n---\n\n# Plan\n');

    const result = runGsdTools(`frontmatter set "${planPath}" --field status --value '"active"'`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Verify backup was created
    assert.ok(
      fs.existsSync(planPath + '.bak'),
      'Should create .bak backup of frontmatter file'
    );
  });

  test('multiple successive state updates preserve content', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n**Status:** planning\n**Current Phase:** 1\n**Last Activity:** none\n');

    runGsdTools('state update Status building', tmpDir);
    runGsdTools('state update "Current Phase" 2', tmpDir);
    runGsdTools('state update "Last Activity" 2026-02-11', tmpDir);

    const content = fs.readFileSync(statePath, 'utf-8');
    assert.ok(content.includes('**Status:** building'), 'Status should be building');
    assert.ok(content.includes('**Current Phase:** 2'), 'Current Phase should be 2');
    assert.ok(content.includes('**Last Activity:** 2026-02-11'), 'Last Activity should be updated');
  });
});

// ─── Lockfile Protection Tests ────────────────────────────────────────────────

describe('lockedFileUpdate (via state mutation commands)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state patch uses locked update — no lock left behind', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n**Status:** planning\n**Current Phase:** 1\n');

    const result = runGsdTools('state patch --Status building --"Current Phase" 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(
      !fs.existsSync(statePath + '.lock'),
      'Lock file should be cleaned up after state patch'
    );
  });

  test('state add-decision uses locked update', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n### Decisions\nNone yet.\n');

    const result = runGsdTools('state add-decision --summary "Use React" --phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true, 'Decision should be added');

    // Verify no lock left behind
    assert.ok(
      !fs.existsSync(statePath + '.lock'),
      'Lock file should be cleaned up after add-decision'
    );

    // Verify content
    const content = fs.readFileSync(statePath, 'utf-8');
    assert.ok(content.includes('Use React'), 'Decision should be in STATE.md');
    assert.ok(!content.includes('None yet'), 'Placeholder should be removed');
  });

  test('state add-blocker uses locked update', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n### Blockers\nNone\n');

    const result = runGsdTools('state add-blocker --text "API key missing"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.added, true);

    assert.ok(
      !fs.existsSync(statePath + '.lock'),
      'Lock file should be cleaned up'
    );

    const content = fs.readFileSync(statePath, 'utf-8');
    assert.ok(content.includes('API key missing'), 'Blocker should be in STATE.md');
  });

  test('state resolve-blocker uses locked update', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n### Blockers\n- API key missing\n- Database timeout\n');

    const result = runGsdTools('state resolve-blocker --text "API key"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.resolved, true);

    const content = fs.readFileSync(statePath, 'utf-8');
    assert.ok(!content.includes('API key missing'), 'Resolved blocker should be removed');
    assert.ok(content.includes('Database timeout'), 'Other blockers should remain');
  });

  test('stale lock is recovered automatically', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n**Status:** planning\n');

    // Create a stale lock file (old timestamp)
    const lockPath = statePath + '.lock';
    fs.writeFileSync(lockPath, '99999');
    const oldTime = new Date(Date.now() - 10000); // 10 seconds ago
    fs.utimesSync(lockPath, oldTime, oldTime);

    // Should still succeed — stale lock gets cleaned up
    const result = runGsdTools('state update Status building', tmpDir);
    assert.ok(result.success, `Command should succeed despite stale lock: ${result.error}`);

    const content = fs.readFileSync(statePath, 'utf-8');
    assert.ok(content.includes('**Status:** building'), 'Update should have been applied');

    // Lock should be cleaned up
    assert.ok(!fs.existsSync(lockPath), 'Stale lock should be removed');
  });

  test('state record-session uses locked update', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, '# Project State\n\n**Last session:** none\n**Last Date:** none\n**Stopped At:** none\n**Resume File:** none\n');

    const result = runGsdTools('state record-session --stopped-at "Finished phase 2"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.recorded, true);

    assert.ok(
      !fs.existsSync(statePath + '.lock'),
      'Lock file should be cleaned up'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hook configuration tests
// ─────────────────────────────────────────────────────────────────────────────

describe('hook configuration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-ensure-section creates hooks section with defaults', () => {
    const result = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true, 'config should be created');

    // Verify hooks section exists in created config
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    assert.ok(config.hooks, 'hooks section should exist');
    assert.strictEqual(config.hooks.blockDangerousCommands, true, 'blockDangerousCommands default');
    assert.strictEqual(config.hooks.validateCommits, true, 'validateCommits default');
    assert.strictEqual(config.hooks.enforceWorkflowOrder, true, 'enforceWorkflowOrder default');
    assert.strictEqual(config.hooks.checkPlanFormat, true, 'checkPlanFormat default');
    assert.strictEqual(config.hooks.checkRoadmapSync, true, 'checkRoadmapSync default');
    assert.strictEqual(config.hooks.enforcePhaseBoundaries, false, 'enforcePhaseBoundaries default (off)');
    assert.strictEqual(config.hooks.checkSubagentOutput, true, 'checkSubagentOutput default');
    assert.strictEqual(config.hooks.trackContextBudget, true, 'trackContextBudget default');
    assert.strictEqual(config.hooks.suggestCompact, true, 'suggestCompact default');
    assert.strictEqual(config.hooks.compactThreshold, 50, 'compactThreshold default');
  });

  test('state load returns hooks config from config.json', () => {
    // Create config with hooks section
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        model_profile: 'balanced',
        hooks: {
          blockDangerousCommands: true,
          validateCommits: false,
          compactThreshold: 75
        }
      })
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n'
    );

    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.config, 'config should be present');
    assert.ok(output.config.hooks, 'hooks config should be in state load output');
    assert.strictEqual(output.config.hooks.blockDangerousCommands, true, 'hook config preserved');
    assert.strictEqual(output.config.hooks.validateCommits, false, 'hook config override preserved');
    assert.strictEqual(output.config.hooks.compactThreshold, 75, 'hook threshold preserved');
  });

  test('loadConfig returns empty hooks when config has no hooks section', () => {
    // Create config without hooks section
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' })
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n'
    );

    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.config, 'config should be present');
    assert.deepStrictEqual(output.config.hooks, {}, 'hooks should default to empty object');
  });

  test('loadConfig returns empty hooks when config.json is missing', () => {
    // No config.json exists (createTempProject does not create it)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Current Phase:** 01\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n'
    );

    const result = runGsdTools('state load', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.config, 'config should be present');
    assert.deepStrictEqual(output.config.hooks, {}, 'hooks should default to empty object when config missing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safety hooks
// ─────────────────────────────────────────────────────────────────────────────

describe('safety hooks', () => {
  const { execSync } = require('node:child_process');
  const hooksDir = path.join(__dirname, '..', '..', 'hooks');

  function runHook(hookName, toolInput) {
    const input = JSON.stringify(toolInput);
    try {
      const result = execSync(`node "${path.join(hooksDir, hookName)}"`, {
        input: input,
        encoding: 'utf8',
        timeout: 5000
      });
      return { stdout: result, exitCode: 0 };
    } catch (e) {
      return { stdout: e.stdout || '', exitCode: e.status };
    }
  }

  // ── check-dangerous-commands.js ──

  describe('check-dangerous-commands', () => {
    test('blocks rm -rf .planning', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf .planning' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
      assert.ok(output.reason.includes('.planning'), 'reason mentions .planning');
    });

    test('blocks git reset --hard', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git reset --hard HEAD~1' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
    });

    test('blocks git push --force', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git push --force' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
    });

    test('blocks git push --force to main', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git push origin --force main' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
    });

    test('blocks git clean -fd', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git clean -fd' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
    });

    test('blocks DROP TABLE', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'mysql -e "DROP TABLE users"' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
    });

    test('blocks DROP DATABASE', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'psql -c "DROP DATABASE production"' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
    });

    test('allows safe bash commands', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git status' }
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0');
    });

    test('allows git push without --force', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git push origin main' }
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0');
    });

    test('allows git push --force-with-lease', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git push --force-with-lease origin feature' }
      });
      assert.strictEqual(result.exitCode, 0, 'should allow --force-with-lease');
    });

    test('ignores non-Bash tools', () => {
      const result = runHook('check-dangerous-commands.js', {
        tool_name: 'Write',
        tool_input: { command: 'rm -rf .planning' }
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0 for non-Bash tools');
    });
  });

  // ── validate-commit.js ──

  describe('validate-commit', () => {
    test('blocks bad commit message format', () => {
      const result = runHook('validate-commit.js', {
        tool_name: 'Bash',
        tool_input: { command: "git commit -m 'updated stuff'" }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
      assert.ok(output.reason.includes('does not match format'), 'reason explains format issue');
    });

    test('allows valid commit message', () => {
      const result = runHook('validate-commit.js', {
        tool_name: 'Bash',
        tool_input: { command: "git commit -m 'feat(hooks): add safety hooks'" }
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0');
    });

    test('allows commit with scope', () => {
      const result = runHook('validate-commit.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "fix(api): resolve auth bug"' }
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0');
    });

    test('allows commit without scope', () => {
      const result = runHook('validate-commit.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m "docs: update readme"' }
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0');
    });

    test('blocks staging .env files', () => {
      const result = runHook('validate-commit.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git add .env' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
      assert.ok(output.reason.includes('.env'), 'reason mentions .env');
    });

    test('blocks staging .pem files', () => {
      const result = runHook('validate-commit.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git add server.pem' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
    });

    test('blocks staging credentials files', () => {
      const result = runHook('validate-commit.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git add credentials.json' }
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
    });

    test('allows staging normal files', () => {
      const result = runHook('validate-commit.js', {
        tool_name: 'Bash',
        tool_input: { command: 'git add src/index.ts' }
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0');
    });

    test('ignores non-Bash tools', () => {
      const result = runHook('validate-commit.js', {
        tool_name: 'Write',
        tool_input: { command: "git commit -m 'bad message'" }
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0 for non-Bash tools');
    });
  });

  // ── check-skill-workflow.js ──

  describe('check-skill-workflow', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = createTempProject();
    });

    afterEach(() => {
      cleanup(tmpDir);
    });

    test('blocks source writes without PLAN.md during execute-phase', () => {
      // Set up .active-skill signal
      fs.writeFileSync(path.join(tmpDir, '.planning', '.active-skill'), 'execute-phase');

      const result = runHook('check-skill-workflow.js', {
        tool_name: 'Write',
        tool_input: { file_path: path.join(tmpDir, 'src', 'index.ts') },
        cwd: tmpDir
      });
      assert.strictEqual(result.exitCode, 2, 'should exit with code 2');
      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.decision, 'block');
      assert.ok(output.reason.includes('no PLAN.md found'), 'reason mentions missing plan');
    });

    test('allows source writes when PLAN.md exists during execute-phase', () => {
      // Set up .active-skill signal
      fs.writeFileSync(path.join(tmpDir, '.planning', '.active-skill'), 'execute-phase');
      // Create a PLAN.md
      const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');

      const result = runHook('check-skill-workflow.js', {
        tool_name: 'Write',
        tool_input: { file_path: path.join(tmpDir, 'src', 'index.ts') },
        cwd: tmpDir
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0');
    });

    test('allows planning file writes always', () => {
      // Set up .active-skill signal without any PLAN.md
      fs.writeFileSync(path.join(tmpDir, '.planning', '.active-skill'), 'execute-phase');

      const result = runHook('check-skill-workflow.js', {
        tool_name: 'Write',
        tool_input: { file_path: path.join(tmpDir, '.planning', 'STATE.md') },
        cwd: tmpDir
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0 for planning files');
    });

    test('warns on SUMMARY.md write without .active-agent', () => {
      const result = runHook('check-skill-workflow.js', {
        tool_name: 'Write',
        tool_input: { file_path: path.join(tmpDir, 'src', 'SUMMARY.md') },
        cwd: tmpDir
      });
      // Should warn but not block (exit 0)
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0 (warn only)');
      if (result.stdout) {
        const output = JSON.parse(result.stdout);
        assert.strictEqual(output.decision, 'warn');
      }
    });

    test('ignores non-Write/Edit tools', () => {
      fs.writeFileSync(path.join(tmpDir, '.planning', '.active-skill'), 'execute-phase');

      const result = runHook('check-skill-workflow.js', {
        tool_name: 'Bash',
        tool_input: { command: 'echo hello' },
        cwd: tmpDir
      });
      assert.strictEqual(result.exitCode, 0, 'should exit with code 0 for non-Write/Edit tools');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Context Budget Hooks
// ─────────────────────────────────────────────────────────────────────────────

// Hooks are in the repo root hooks/ directory
const hooksDir = path.join(__dirname, '..', '..', 'hooks');

// Helper to run a hook script via stdin pipe
// Uses spawnSync to capture both stdout and stderr regardless of exit code
const { spawnSync } = require('child_process');

function runHook(hookName, hookInput) {
  const input = JSON.stringify(hookInput);
  const result = spawnSync(process.execPath, [path.join(hooksDir, hookName)], {
    input: input,
    encoding: 'utf8',
    timeout: 5000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

describe('track-context-budget hook', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('tracks Read tool calls and creates context tracker file', () => {
    const result = runHook('track-context-budget.js', {
      tool_name: 'Read',
      tool_input: { file_path: '/some/file.js' },
      tool_result: 'a'.repeat(500),
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const trackerPath = path.join(tmpDir, '.planning', '.context-tracker');
    assert.ok(fs.existsSync(trackerPath), 'tracker file should be created');

    const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
    assert.strictEqual(tracker.reads, 1, 'should have 1 read');
    assert.strictEqual(tracker.chars, 500, 'should have 500 chars');
    assert.deepStrictEqual(tracker.files, ['/some/file.js'], 'should track file path');
  });

  test('ignores non-Read tool calls', () => {
    const result = runHook('track-context-budget.js', {
      tool_name: 'Write',
      tool_input: { file_path: '/some/file.js' },
      tool_result: 'content',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const trackerPath = path.join(tmpDir, '.planning', '.context-tracker');
    assert.ok(!fs.existsSync(trackerPath), 'tracker file should not be created for non-Read calls');
  });

  test('accumulates reads and warns at threshold', () => {
    // Write a tracker that is just below threshold
    const trackerPath = path.join(tmpDir, '.planning', '.context-tracker');
    fs.writeFileSync(trackerPath, JSON.stringify({
      reads: 14,
      chars: 25000,
      files: ['/a.js', '/b.js'],
      skill: '',
    }));

    const result = runHook('track-context-budget.js', {
      tool_name: 'Read',
      tool_input: { file_path: '/c.js' },
      tool_result: 'a'.repeat(100),
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    // Should warn because reads >= 15
    assert.ok(
      result.stderr.includes('Context budget warning'),
      'should emit warning when threshold reached'
    );
    assert.ok(
      result.stderr.includes('Task() subagent'),
      'warning should suggest delegation'
    );

    const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
    assert.strictEqual(tracker.reads, 15, 'should have 15 reads');
    assert.strictEqual(tracker.files.length, 3, 'should have 3 unique files');
  });

  test('resets tracker when active skill changes', () => {
    // Write tracker with old skill
    const trackerPath = path.join(tmpDir, '.planning', '.context-tracker');
    fs.writeFileSync(trackerPath, JSON.stringify({
      reads: 10,
      chars: 20000,
      files: ['/a.js'],
      skill: 'old-skill',
    }));

    // Write new active skill
    const skillPath = path.join(tmpDir, '.planning', '.active-skill');
    fs.writeFileSync(skillPath, 'new-skill');

    const result = runHook('track-context-budget.js', {
      tool_name: 'Read',
      tool_input: { file_path: '/b.js' },
      tool_result: 'content',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
    assert.strictEqual(tracker.reads, 1, 'reads should reset to 1');
    assert.strictEqual(tracker.skill, 'new-skill', 'skill should be updated');
  });

  test('respects config disable flag', () => {
    // Write config disabling the hook
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ hooks: { trackContextBudget: false } })
    );

    const result = runHook('track-context-budget.js', {
      tool_name: 'Read',
      tool_input: { file_path: '/some/file.js' },
      tool_result: 'content',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const trackerPath = path.join(tmpDir, '.planning', '.context-tracker');
    assert.ok(!fs.existsSync(trackerPath), 'tracker should not be created when disabled');
  });
});

describe('suggest-compact hook', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('counts tool calls and creates counter file', () => {
    const result = runHook('suggest-compact.js', {
      tool_name: 'Read',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const counterPath = path.join(tmpDir, '.planning', '.compact-counter');
    assert.ok(fs.existsSync(counterPath), 'counter file should be created');

    const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    assert.strictEqual(counter.calls, 1, 'should have 1 call');
    assert.strictEqual(counter.lastSuggested, 0, 'should not have suggested yet');
  });

  test('suggests compact at threshold', () => {
    // Write counter just below threshold
    const counterPath = path.join(tmpDir, '.planning', '.compact-counter');
    fs.writeFileSync(counterPath, JSON.stringify({ calls: 49, lastSuggested: 0 }));

    const result = runHook('suggest-compact.js', {
      tool_name: 'Read',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(
      result.stderr.includes('Tool call count: 50'),
      'should suggest compact at threshold'
    );
    assert.ok(
      result.stderr.includes('/compact'),
      'should mention /compact command'
    );

    const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    assert.strictEqual(counter.calls, 50, 'should have 50 calls');
    assert.strictEqual(counter.lastSuggested, 50, 'lastSuggested should be updated');
  });

  test('re-suggests after re-remind interval', () => {
    // Counter at 74 (suggested at 50, re-remind every 25)
    const counterPath = path.join(tmpDir, '.planning', '.compact-counter');
    fs.writeFileSync(counterPath, JSON.stringify({ calls: 74, lastSuggested: 50 }));

    const result = runHook('suggest-compact.js', {
      tool_name: 'Bash',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(
      result.stderr.includes('Tool call count: 75'),
      'should re-suggest at 75'
    );
  });

  test('does not suggest between intervals', () => {
    // Counter at 59 (suggested at 50, not yet at 75)
    const counterPath = path.join(tmpDir, '.planning', '.compact-counter');
    fs.writeFileSync(counterPath, JSON.stringify({ calls: 59, lastSuggested: 50 }));

    const result = runHook('suggest-compact.js', {
      tool_name: 'Read',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.strictEqual(result.stderr, '', 'should not suggest between intervals');
  });

  test('respects config disable flag', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ hooks: { suggestCompact: false } })
    );

    const counterPath = path.join(tmpDir, '.planning', '.compact-counter');
    fs.writeFileSync(counterPath, JSON.stringify({ calls: 49, lastSuggested: 0 }));

    const result = runHook('suggest-compact.js', {
      tool_name: 'Read',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    // Counter should not have been updated since hook exited early
    const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    assert.strictEqual(counter.calls, 49, 'calls should not increment when disabled');
  });
});

describe('context-budget-check hook (PreCompact)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('preserves session continuity in STATE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State

Phase: 03 of 5 (API Layer)
Plan: 03-02 of 3
Status: In progress
`
    );

    const result = runHook('context-budget-check.js', {
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf8');
    assert.ok(state.includes('## Session Continuity'), 'should add Session Continuity section');
    assert.ok(state.includes('Context compaction'), 'should mention compaction');
    assert.ok(state.includes('Active phase: 03 of 5 (API Layer)'), 'should preserve current phase');
    assert.ok(state.includes('Active plan: 03-02 of 3'), 'should preserve current plan');
    assert.ok(state.includes('Resume action:'), 'should include resume guidance');
  });

  test('includes roadmap progress when available', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\nPhase: 01\nPlan: 01-01\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## Phase 1\n[x] complete\n\n## Phase 2\nIn progress\n`
    );

    const result = runHook('context-budget-check.js', {
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf8');
    assert.ok(state.includes('Roadmap progress:'), 'should include roadmap summary');
    assert.ok(state.includes('phases'), 'should mention phase count');
  });

  test('includes context tracker stats when available', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\nPhase: 02\nPlan: 02-01\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', '.context-tracker'),
      JSON.stringify({ reads: 8, chars: 15000, files: ['/a.js', '/b.js'] })
    );

    const result = runHook('context-budget-check.js', {
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf8');
    assert.ok(state.includes('Context consumption:'), 'should include context stats');
    assert.ok(state.includes('8 reads'), 'should show read count');
    assert.ok(state.includes('15k chars'), 'should show char count');
  });

  test('resets compact counter after compaction', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\nPhase: 01\nPlan: 01-01\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', '.compact-counter'),
      JSON.stringify({ calls: 75, lastSuggested: 75 })
    );

    const result = runHook('context-budget-check.js', {
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const counter = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.planning', '.compact-counter'), 'utf8')
    );
    assert.strictEqual(counter.calls, 0, 'calls should be reset to 0');
    assert.strictEqual(counter.lastSuggested, 0, 'lastSuggested should be reset to 0');
  });

  test('outputs additionalContext JSON for post-compaction recovery', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\nPhase: 03\nPlan: 03-02\n`
    );

    const result = runHook('context-budget-check.js', {
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(result.stdout, 'should output JSON to stdout');

    const output = JSON.parse(result.stdout);
    assert.ok(output.additionalContext, 'should have additionalContext field');
    assert.ok(output.additionalContext.includes('compacted'), 'should mention compaction');
    assert.ok(output.additionalContext.includes('Resume from STATE.md'), 'should mention STATE.md');
  });

  test('replaces existing Session Continuity section', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\nPhase: 02\nPlan: 02-01\n\n## Session Continuity\n\nLast session: 2025-01-01\nStopped at: old content\n`
    );

    const result = runHook('context-budget-check.js', {
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf8');
    assert.ok(!state.includes('old content'), 'old content should be replaced');
    assert.ok(state.includes('Context compaction'), 'new content should be present');
    // Should only have one Session Continuity section
    const matches = state.match(/## Session Continuity/g);
    assert.strictEqual(matches.length, 1, 'should have exactly one Session Continuity section');
  });

  test('exits silently when STATE.md does not exist', () => {
    // Remove the .planning directory's STATE.md (it wasn't created)
    const result = runHook('context-budget-check.js', {
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly even without STATE.md');
    assert.strictEqual(result.stdout, '', 'should not output anything');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// check-plan-format hook
// ─────────────────────────────────────────────────────────────────────────────

describe('check-plan-format hook', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validates PLAN.md frontmatter and warns on missing fields', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Plan missing required frontmatter fields
    const planPath = path.join(phaseDir, '03-01-PLAN.md');
    fs.writeFileSync(planPath, `---
wave: 1
---

## Task 1: Setup database
## Task 2: Create models
`);

    const result = runHook('check-plan-format.js', {
      tool_name: 'Write',
      tool_input: { file_path: planPath },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(result.stderr.includes('Missing required frontmatter field: phase'), 'should warn about missing phase');
    assert.ok(result.stderr.includes('Missing required frontmatter field: plan'), 'should warn about missing plan');
  });

  test('warns when task count exceeds 3', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const planPath = path.join(phaseDir, '03-01-PLAN.md');
    fs.writeFileSync(planPath, `---
phase: "03"
plan: "03-01"
---

## Task 1: A
## Task 2: B
## Task 3: C
## Task 4: D
`);

    const result = runHook('check-plan-format.js', {
      tool_name: 'Write',
      tool_input: { file_path: planPath },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(result.stderr.includes('High task count: 4'), 'should warn about >3 tasks');
  });

  test('ignores non-plan files', () => {
    const readmePath = path.join(tmpDir, 'README.md');
    fs.writeFileSync(readmePath, '# Hello');

    const result = runHook('check-plan-format.js', {
      tool_name: 'Write',
      tool_input: { file_path: readmePath },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.strictEqual(result.stderr, '', 'no warnings for non-plan files');
  });

  test('passes for valid PLAN.md', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const planPath = path.join(phaseDir, '03-01-PLAN.md');
    fs.writeFileSync(planPath, `---
phase: "03"
plan: "03-01"
wave: 1
---

## Task 1: Setup
## Task 2: Build
`);

    const result = runHook('check-plan-format.js', {
      tool_name: 'Write',
      tool_input: { file_path: planPath },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.strictEqual(result.stderr, '', 'no warnings for valid plan');
  });

  test('validates SUMMARY.md frontmatter', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const summaryPath = path.join(phaseDir, '03-01-SUMMARY.md');
    fs.writeFileSync(summaryPath, `---
phase: "03"
---

# Summary
`);

    const result = runHook('check-plan-format.js', {
      tool_name: 'Write',
      tool_input: { file_path: summaryPath },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(result.stderr.includes('Missing required frontmatter field: plan'), 'should warn about missing plan');
    assert.ok(result.stderr.includes('Missing required frontmatter field: status'), 'should warn about missing status');
  });

  test('respects config toggle', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Disable the hook via config
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ hooks: { checkPlanFormat: false } })
    );

    const planPath = path.join(phaseDir, '03-01-PLAN.md');
    fs.writeFileSync(planPath, '# No frontmatter at all');

    const result = runHook('check-plan-format.js', {
      tool_name: 'Write',
      tool_input: { file_path: planPath },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.strictEqual(result.stderr, '', 'no warnings when disabled');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// check-roadmap-sync hook
// ─────────────────────────────────────────────────────────────────────────────

describe('check-roadmap-sync hook', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects phase status mismatch (complete in roadmap, active in state)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Status:** In progress\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n- [x] Phase 1: Foundation\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const result = runHook('check-roadmap-sync.js', {
      tool_name: 'Write',
      tool_input: { file_path: path.join(tmpDir, '.planning', 'STATE.md') },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(
      result.stderr.includes('marked complete in ROADMAP.md'),
      'should warn about sync mismatch'
    );
  });

  test('passes when state and roadmap are in sync', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 02\n**Status:** In progress\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n- [x] Phase 1: Foundation\n- [ ] Phase 2: API\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n### Phase 2: API\n**Goal:** Build API\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runHook('check-roadmap-sync.js', {
      tool_name: 'Write',
      tool_input: { file_path: path.join(tmpDir, '.planning', 'STATE.md') },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.strictEqual(result.stderr, '', 'no warnings when in sync');
  });

  test('ignores non-STATE.md files', () => {
    const result = runHook('check-roadmap-sync.js', {
      tool_name: 'Write',
      tool_input: { file_path: path.join(tmpDir, '.planning', 'ROADMAP.md') },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.strictEqual(result.stderr, '', 'no warnings for non-state files');
  });

  test('warns when phase not found in roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 05\n**Status:** In progress\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );

    const result = runHook('check-roadmap-sync.js', {
      tool_name: 'Write',
      tool_input: { file_path: path.join(tmpDir, '.planning', 'STATE.md') },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(
      result.stderr.includes('not found in ROADMAP.md'),
      'should warn about missing phase'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// check-phase-boundary hook
// ─────────────────────────────────────────────────────────────────────────────

describe('check-phase-boundary hook', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('warns on out-of-phase writes (default mode)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 03\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    // Write to a file outside .planning (simulating source code edit)
    const result = runHook('check-phase-boundary.js', {
      tool_name: 'Write',
      tool_input: { file_path: path.join(tmpDir, 'src', 'unrelated.js') },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.decision, 'allow', 'should allow by default');
    assert.ok(result.stderr.includes('outside the current phase'), 'should warn about boundary');
  });

  test('allows in-phase writes', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 03\n`
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runHook('check-phase-boundary.js', {
      tool_name: 'Write',
      tool_input: { file_path: path.join(phaseDir, '03-01-PLAN.md') },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.decision, 'allow', 'should allow in-phase writes');
    assert.strictEqual(result.stderr, '', 'no warnings for in-phase writes');
  });

  test('always allows .planning/ files', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 03\n`
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runHook('check-phase-boundary.js', {
      tool_name: 'Write',
      tool_input: { file_path: path.join(tmpDir, '.planning', 'ROADMAP.md') },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.decision, 'allow', 'should allow planning files');
  });

  test('blocks when enforcePhaseBoundaries is true', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 03\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ hooks: { enforcePhaseBoundaries: true } })
    );
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runHook('check-phase-boundary.js', {
      tool_name: 'Write',
      tool_input: { file_path: path.join(tmpDir, 'src', 'unrelated.js') },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.decision, 'block', 'should block out-of-phase writes');
    assert.ok(output.reason.includes('Phase boundary enforcement'), 'reason explains block');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// check-subagent-output hook
// ─────────────────────────────────────────────────────────────────────────────

describe('check-subagent-output hook', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('warns on missing executor SUMMARY', () => {
    // No SUMMARY files in phases dir
    const result = runHook('check-subagent-output.js', {
      tool_name: 'Task',
      tool_input: { subagent_type: 'gsd-executor', prompt: 'Execute plan 03-01' },
      tool_result: 'gsd-executor completed plan 03-01',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(
      result.stderr.includes('no SUMMARY.md found'),
      'should warn about missing SUMMARY'
    );
  });

  test('passes when executor artifacts exist', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), '# Summary');

    const result = runHook('check-subagent-output.js', {
      tool_name: 'Task',
      tool_input: { subagent_type: 'gsd-executor', prompt: 'Execute plan 03-01' },
      tool_result: 'gsd-executor completed plan 03-01',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.strictEqual(result.stderr, '', 'no warnings when artifacts exist');
  });

  test('warns on missing planner PLAN', () => {
    const result = runHook('check-subagent-output.js', {
      tool_name: 'Task',
      tool_input: { subagent_type: 'gsd-planner', prompt: 'Plan phase 03' },
      tool_result: 'gsd-planner completed phase 03',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.ok(
      result.stderr.includes('no PLAN.md found'),
      'should warn about missing PLAN'
    );
  });

  test('ignores non-Task tools', () => {
    const result = runHook('check-subagent-output.js', {
      tool_name: 'Write',
      tool_input: { file_path: '/some/file.js' },
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.strictEqual(result.stderr, '', 'no warnings for non-Task tools');
  });

  test('respects config toggle', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ hooks: { checkSubagentOutput: false } })
    );

    const result = runHook('check-subagent-output.js', {
      tool_name: 'Task',
      tool_input: 'Run gsd-executor for plan 03-01',
      tool_result: 'gsd-executor completed plan 03-01',
      cwd: tmpDir,
    });

    assert.strictEqual(result.exitCode, 0, 'hook should exit cleanly');
    assert.strictEqual(result.stderr, '', 'no warnings when disabled');
  });
});


// ─── Signal File Management Tests ────────────────────────────────────────────

describe('signal write/read/delete cycle', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('write and read a signal', () => {
    const writeResult = runGsdTools('signal write active-agent gsd-executor', tmpDir);
    assert.ok(writeResult.success, `Write failed: ${writeResult.error}`);

    const readResult = runGsdTools('signal read active-agent', tmpDir);
    assert.ok(readResult.success, `Read failed: ${readResult.error}`);
    const data = JSON.parse(readResult.output);
    assert.strictEqual(data.signal, 'active-agent');
    assert.strictEqual(data.value, 'gsd-executor');
    assert.strictEqual(data.exists, true);
  });

  test('delete removes a signal', () => {
    runGsdTools('signal write active-plan 01-02', tmpDir);
    const deleteResult = runGsdTools('signal delete active-plan', tmpDir);
    assert.ok(deleteResult.success, `Delete failed: ${deleteResult.error}`);
    const data = JSON.parse(deleteResult.output);
    assert.strictEqual(data.deleted, true);

    // Verify signal is gone
    const readResult = runGsdTools('signal read active-plan', tmpDir);
    assert.ok(readResult.success);
    const readData = JSON.parse(readResult.output);
    assert.strictEqual(readData.exists, false);
    assert.strictEqual(readData.value, '');
  });

  test('read returns empty for missing signal', () => {
    const result = runGsdTools('signal read auto-next', tmpDir);
    assert.ok(result.success, `Read failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.value, '');
    assert.strictEqual(data.exists, false);
  });
});

describe('signal list', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('shows active signals', () => {
    runGsdTools('signal write active-agent executor', tmpDir);
    runGsdTools('signal write active-plan 01-03', tmpDir);

    const result = runGsdTools('signal list --raw', tmpDir);
    assert.ok(result.success, `List failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.signals.length, 2);
    const names = data.signals.map(s => s.name);
    assert.ok(names.includes('active-agent'));
    assert.ok(names.includes('active-plan'));
  });

  test('shows empty list when no signals', () => {
    const result = runGsdTools('signal list --raw', tmpDir);
    assert.ok(result.success, `List failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.signals.length, 0);
  });
});

describe('signal cleanup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('removes all signals and trackers', () => {
    // Write some signals
    runGsdTools('signal write active-agent test', tmpDir);
    runGsdTools('signal write auto-next proceed', tmpDir);
    // Write tracker files directly
    fs.writeFileSync(path.join(tmpDir, '.planning', '.context-tracker'), '42');
    fs.writeFileSync(path.join(tmpDir, '.planning', '.compact-counter'), '3');

    const result = runGsdTools('signal cleanup', tmpDir);
    assert.ok(result.success, `Cleanup failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.removed, 4);

    // Verify all files are gone
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', '.active-agent')));
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', '.auto-next')));
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', '.context-tracker')));
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', '.compact-counter')));
  });
});

describe('signal check-stale', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('warns on old signals', () => {
    // Write a signal and backdate it
    const signalPath = path.join(tmpDir, '.planning', '.active-operation');
    fs.writeFileSync(signalPath, 'some-op');
    // Set mtime to 15 minutes ago
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    fs.utimesSync(signalPath, fifteenMinAgo, fifteenMinAgo);

    const result = runGsdTools('signal check-stale --raw', tmpDir);
    assert.ok(result.success, `Check-stale failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.stale.length, 1);
    assert.strictEqual(data.stale[0].name, 'active-operation');
    assert.ok(data.stale[0].age_minutes >= 14);
  });

  test('no stale signals when all fresh', () => {
    runGsdTools('signal write active-agent fresh', tmpDir);

    const result = runGsdTools('signal check-stale --raw', tmpDir);
    assert.ok(result.success, `Check-stale failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.stale.length, 0);
  });
});

describe('signal validation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('rejects invalid signal names', () => {
    const result = runGsdTools('signal write bogus-name value', tmpDir);
    assert.ok(!result.success, 'Should reject invalid signal name');
    assert.ok(result.error.includes('Invalid signal name'));
  });

  test('rejects invalid signal names for read', () => {
    const result = runGsdTools('signal read not-a-signal', tmpDir);
    assert.ok(!result.success, 'Should reject invalid signal name');
    assert.ok(result.error.includes('Invalid signal name'));
  });

  test('rejects invalid signal names for delete', () => {
    const result = runGsdTools('signal delete fake', tmpDir);
    assert.ok(!result.success, 'Should reject invalid signal name');
    assert.ok(result.error.includes('Invalid signal name'));
  });
});

describe('session-cleanup hook', () => {
  let tmpDir;
  const { spawnSync } = require('child_process');

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('removes signal files on session end', () => {
    const planningDir = path.join(tmpDir, '.planning');
    // Create signal files
    fs.writeFileSync(path.join(planningDir, '.active-agent'), 'test-agent');
    fs.writeFileSync(path.join(planningDir, '.active-plan'), '01-01');
    fs.writeFileSync(path.join(planningDir, '.context-tracker'), '50');

    // Run session-cleanup hook via stdin using spawnSync
    const hookPath = path.join(__dirname, '..', '..', 'hooks', 'session-cleanup.js');
    const stdinData = JSON.stringify({ cwd: tmpDir });
    spawnSync(process.execPath, [hookPath], {
      input: stdinData,
      encoding: 'utf-8',
    });

    // Verify files are removed
    assert.ok(!fs.existsSync(path.join(planningDir, '.active-agent')));
    assert.ok(!fs.existsSync(path.join(planningDir, '.active-plan')));
    assert.ok(!fs.existsSync(path.join(planningDir, '.context-tracker')));
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// progress tracking commands (crash recovery)
// ─────────────────────────────────────────────────────────────────────────────

describe('progress tracking commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('progress write/read/delete lifecycle', () => {
    // Write progress
    const writeResult = runGsdTools('progress write 01-02 --task 2 --total 5 --commit abc1234', tmpDir);
    assert.ok(writeResult.success, `Write failed: ${writeResult.error}`);

    const writeData = JSON.parse(writeResult.output);
    assert.strictEqual(writeData.plan_id, '01-02');
    assert.strictEqual(writeData.last_completed_task, 2);
    assert.strictEqual(writeData.total_tasks, 5);
    assert.strictEqual(writeData.last_commit, 'abc1234');
    assert.ok(writeData.timestamp, 'should have timestamp');

    // Read progress
    const readResult = runGsdTools('progress read 01-02', tmpDir);
    assert.ok(readResult.success, `Read failed: ${readResult.error}`);

    const readData = JSON.parse(readResult.output);
    assert.strictEqual(readData.exists, true);
    assert.strictEqual(readData.plan_id, '01-02');
    assert.strictEqual(readData.last_completed_task, 2);
    assert.strictEqual(readData.total_tasks, 5);
    assert.strictEqual(readData.last_commit, 'abc1234');

    // Delete progress
    const deleteResult = runGsdTools('progress delete 01-02', tmpDir);
    assert.ok(deleteResult.success, `Delete failed: ${deleteResult.error}`);

    const deleteData = JSON.parse(deleteResult.output);
    assert.strictEqual(deleteData.deleted, true);
    assert.strictEqual(deleteData.existed, true);

    // Verify deleted
    const afterDelete = runGsdTools('progress read 01-02', tmpDir);
    assert.ok(afterDelete.success);
    const afterData = JSON.parse(afterDelete.output);
    assert.strictEqual(afterData.exists, false);
  });

  test('progress list with multiple progress files', () => {
    // Write two progress files
    runGsdTools('progress write 01-01 --task 1 --total 3 --commit aaa1111', tmpDir);
    runGsdTools('progress write 02-01 --task 3 --total 4 --commit bbb2222', tmpDir);

    const result = runGsdTools('progress list', tmpDir);
    assert.ok(result.success, `List failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.progress.length, 2, 'should have 2 progress entries');

    const planIds = data.progress.map(p => p.plan_id).sort();
    assert.deepStrictEqual(planIds, ['01-01', '02-01']);
  });

  test('progress list with no progress files', () => {
    const result = runGsdTools('progress list', tmpDir);
    assert.ok(result.success, `List failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.progress.length, 0, 'should have no progress entries');
  });

  test('progress read for nonexistent plan returns exists:false', () => {
    const result = runGsdTools('progress read 99-99', tmpDir);
    assert.ok(result.success, `Read failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.exists, false);
  });

  test('progress write with --raw flag returns human-readable text', () => {
    const result = runGsdTools('progress write 01-03 --task 1 --total 2 --raw', tmpDir);
    assert.ok(result.success, `Write failed: ${result.error}`);

    // --raw outputs the human-readable rawValue string
    assert.ok(result.output.includes('Progress: 01-03 task 1/2'),
      `Expected human-readable output, got: ${result.output}`);
  });

  test('progress write without --commit defaults to empty string', () => {
    const result = runGsdTools('progress write 01-04 --task 1 --total 3', tmpDir);
    assert.ok(result.success, `Write failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.last_commit, '');
  });

  test('progress delete nonexistent file succeeds with existed:false', () => {
    const result = runGsdTools('progress delete 99-99', tmpDir);
    assert.ok(result.success, `Delete failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.deleted, true);
    assert.strictEqual(data.existed, false);
  });

  test('progress check-orphaned with no files returns empty', () => {
    const result = runGsdTools('progress check-orphaned', tmpDir);
    assert.ok(result.success, `Check-orphaned failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.orphaned.length, 0);
  });

  test('progress check-orphaned detects old files', () => {
    // Create a progress file and manually backdate it
    const progressPath = path.join(tmpDir, '.planning', '.PROGRESS-01-01');
    const data = {
      plan_id: '01-01',
      last_completed_task: 2,
      total_tasks: 5,
      last_commit: 'abc1234',
      timestamp: '2024-01-01T00:00:00Z',
    };
    fs.writeFileSync(progressPath, JSON.stringify(data, null, 2));

    // Backdate the file mtime to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(progressPath, twoHoursAgo, twoHoursAgo);

    const result = runGsdTools('progress check-orphaned', tmpDir);
    assert.ok(result.success, `Check-orphaned failed: ${result.error}`);

    const orphanData = JSON.parse(result.output);
    assert.strictEqual(orphanData.orphaned.length, 1, 'should detect 1 orphaned file');
    assert.strictEqual(orphanData.orphaned[0].plan_id, '01-01');
    assert.ok(orphanData.orphaned[0].age_minutes >= 119, 'should be at least ~120 minutes old');
  });

  test('progress check-orphaned ignores recent files', () => {
    // Write a fresh progress file (< 1 hour old)
    runGsdTools('progress write 01-01 --task 1 --total 3 --commit fff0000', tmpDir);

    const result = runGsdTools('progress check-orphaned', tmpDir);
    assert.ok(result.success, `Check-orphaned failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.orphaned.length, 0, 'fresh file should not be orphaned');
  });

  test('progress write errors without .planning directory', () => {
    const emptyDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-noplanning-'));
    try {
      const result = runGsdTools('progress write 01-01 --task 1 --total 3', emptyDir);
      assert.ok(!result.success, 'Should fail without .planning dir');
      assert.ok(result.error.includes('.planning directory not found'));
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  test('progress write errors with missing required args', () => {
    const result = runGsdTools('progress write 01-01', tmpDir);
    assert.ok(!result.success, 'Should fail without --task and --total');
    assert.ok(result.error.includes('Usage'));
  });

  test('existing progress render commands still work', () => {
    // The json/table/bar subcommands should still go through cmdProgressRender
    // This creates a minimal structure for progress render
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('progress json', tmpDir);
    assert.ok(result.success, `Progress json failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.phases !== undefined || data.total !== undefined, 'should return progress data');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// seed commands
// ─────────────────────────────────────────────────────────────────────────────

describe('seed list command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty or missing seeds directory returns empty list', () => {
    const result = runGsdTools('seed list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 0, 'count should be 0');
    assert.deepStrictEqual(output.seeds, [], 'seeds should be empty');
  });

  test('lists seeds with metadata extracted from frontmatter', () => {
    const seedsDir = path.join(tmpDir, '.planning', 'seeds');
    fs.mkdirSync(seedsDir, { recursive: true });

    fs.writeFileSync(
      path.join(seedsDir, 'seed-add-caching.md'),
      `---
title: "Add Caching Layer"
trigger: "performance"
scope: medium
created: "2024-03-15"
status: planted
---

## Context
Need caching for API responses.
`
    );

    fs.writeFileSync(
      path.join(seedsDir, 'seed-dark-mode.md'),
      `---
title: "Dark Mode Support"
trigger: "ui-polish"
scope: small
created: "2024-03-16"
status: planted
---

## Context
Users want dark mode.
`
    );

    const result = runGsdTools('seed list', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 2, 'should have 2 seeds');
    assert.strictEqual(output.seeds[0].title, 'Add Caching Layer', 'first seed title');
    assert.strictEqual(output.seeds[0].trigger, 'performance', 'first seed trigger');
    assert.strictEqual(output.seeds[0].scope, 'medium', 'first seed scope');
    assert.strictEqual(output.seeds[1].title, 'Dark Mode Support', 'second seed title');
    assert.strictEqual(output.seeds[1].scope, 'small', 'second seed scope');
  });
});

describe('seed read-for-phase command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('filters seeds by phase trigger', () => {
    const seedsDir = path.join(tmpDir, '.planning', 'seeds');
    fs.mkdirSync(seedsDir, { recursive: true });

    fs.writeFileSync(
      path.join(seedsDir, 'seed-cache.md'),
      `---
title: "Add Caching"
trigger: "performance"
scope: medium
status: planted
---
`
    );

    fs.writeFileSync(
      path.join(seedsDir, 'seed-dark-mode.md'),
      `---
title: "Dark Mode"
trigger: "ui-polish"
scope: small
status: planted
---
`
    );

    fs.writeFileSync(
      path.join(seedsDir, 'seed-perf-monitor.md'),
      `---
title: "Performance Monitor"
trigger: "performance"
scope: large
status: planted
---
`
    );

    const result = runGsdTools('seed read-for-phase performance', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase, 'performance', 'phase slug returned');
    assert.strictEqual(output.count, 2, 'should match 2 seeds');
    assert.ok(
      output.seeds.some(s => s.title === 'Add Caching'),
      'should include caching seed'
    );
    assert.ok(
      output.seeds.some(s => s.title === 'Performance Monitor'),
      'should include perf monitor seed'
    );
  });

  test('returns empty when no seeds match phase', () => {
    const seedsDir = path.join(tmpDir, '.planning', 'seeds');
    fs.mkdirSync(seedsDir, { recursive: true });

    fs.writeFileSync(
      path.join(seedsDir, 'seed-cache.md'),
      `---
title: "Add Caching"
trigger: "performance"
scope: medium
status: planted
---
`
    );

    const result = runGsdTools('seed read-for-phase security', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 0, 'no seeds should match');
    assert.deepStrictEqual(output.seeds, [], 'seeds should be empty');
  });

  test('case-insensitive substring matching on trigger', () => {
    const seedsDir = path.join(tmpDir, '.planning', 'seeds');
    fs.mkdirSync(seedsDir, { recursive: true });

    fs.writeFileSync(
      path.join(seedsDir, 'seed-test.md'),
      `---
title: "Test Seed"
trigger: "UI-Polish"
scope: small
status: planted
---
`
    );

    const result = runGsdTools('seed read-for-phase ui-polish', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.count, 1, 'should match case-insensitively');
  });
});

describe('seed create command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates seed file with correct content', () => {
    const result = runGsdTools(
      'seed create --title "Add Rate Limiting" --trigger "api-security" --scope large --context "API needs protection" --approach "Use express-rate-limit" --deps "Express middleware"',
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true, 'should report created');
    assert.strictEqual(output.file, 'seed-add-rate-limiting.md', 'filename should be slugified');
    assert.ok(output.path.includes('.planning/seeds/'), 'path should include seeds dir');

    // Verify file contents
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'seeds', 'seed-add-rate-limiting.md'),
      'utf-8'
    );
    assert.ok(content.includes('title: "Add Rate Limiting"'), 'title in frontmatter');
    assert.ok(content.includes('trigger: "api-security"'), 'trigger in frontmatter');
    assert.ok(content.includes('scope: large'), 'scope in frontmatter');
    assert.ok(content.includes('status: planted'), 'status in frontmatter');
    assert.ok(content.includes('API needs protection'), 'context in body');
    assert.ok(content.includes('Use express-rate-limit'), 'approach in body');
    assert.ok(content.includes('Express middleware'), 'deps in body');
  });

  test('creates seeds directory if it does not exist', () => {
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'seeds')),
      'seeds dir should not exist yet'
    );

    const result = runGsdTools(
      'seed create --title "Test Seed" --trigger "test-phase"',
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'seeds')),
      'seeds dir should be created'
    );
  });

  test('defaults scope to medium when not provided', () => {
    const result = runGsdTools(
      'seed create --title "Default Scope" --trigger "test"',
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'seeds', 'seed-default-scope.md'),
      'utf-8'
    );
    assert.ok(content.includes('scope: medium'), 'should default to medium scope');
  });

  test('fails without required --title', () => {
    const result = runGsdTools('seed create --trigger "test"', tmpDir);
    assert.ok(!result.success, 'should fail without title');
    assert.ok(result.error.includes('--title required'), 'error mentions title');
  });

  test('fails without required --trigger', () => {
    const result = runGsdTools('seed create --title "Test"', tmpDir);
    assert.ok(!result.success, 'should fail without trigger');
    assert.ok(result.error.includes('--trigger required'), 'error mentions trigger');
  });
});
