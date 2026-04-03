/**
 * GSD Tools Tests - Preflight
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, createTempDir, cleanup } = require('./helpers.cjs');

// ─── Helper: write a ROADMAP with configurable phases ────────────────────────

function writeRoadmap(tmpDir, opts = {}) {
  const {
    phase1Complete = false,
    phase2DependsOn = 'Phase 1',
    phase2Goal = 'Build core features',
    includePhase2 = true,
  } = opts;

  const p1Check = phase1Complete ? 'x' : ' ';
  let content = `# Roadmap

## Phases

- [${p1Check}] **Phase 1: Foundation** - Base setup
${includePhase2 ? '- [ ] **Phase 2: Features** - Core features' : ''}

## Phase Details

### Phase 1: Foundation
**Goal**: Set up the base project
**Depends on**: Nothing
**Success Criteria**:
  1. Project runs
`;

  if (includePhase2) {
    content += `
### Phase 2: Features
**Goal**: ${phase2Goal}
**Depends on**: ${phase2DependsOn}
**Success Criteria**:
  1. Features work
`;
  }

  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);
}

// ─── Check 1: Planning exists ────────────────────────────────────────────────

describe('preflight: check 1 — planning exists', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns no_planning when .planning/ missing', () => {
    const result = runGsdTools('preflight 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, false);
    assert.strictEqual(out.blockers[0].type, 'no_planning');
  });

  test('returns no_roadmap when ROADMAP.md missing', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    const result = runGsdTools('preflight 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, false);
    assert.strictEqual(out.blockers[0].type, 'no_roadmap');
  });
});

// ─── Check 2: Phase exists ───────────────────────────────────────────────────

describe('preflight: check 2 — phase exists', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeRoadmap(tmpDir, { includePhase2: false });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns no_phase when phase arg missing', () => {
    const result = runGsdTools('preflight', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, false);
    assert.strictEqual(out.blockers[0].type, 'no_phase');
  });

  test('returns phase_not_found for nonexistent phase', () => {
    const result = runGsdTools('preflight 99', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, false);
    assert.strictEqual(out.blockers[0].type, 'phase_not_found');
  });

  test('finds existing phase', () => {
    const result = runGsdTools('preflight 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.phase, '1');
    assert.strictEqual(out.phase_name, 'Foundation');
  });
});

// ─── Check 3: Dependencies complete ──────────────────────────────────────────

describe('preflight: check 3 — dependencies', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('blocks when dependency phase is incomplete', () => {
    writeRoadmap(tmpDir, { phase1Complete: false });
    const result = runGsdTools('preflight 2', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, false);
    const depBlocker = out.blockers.find(b => b.type === 'dependency_incomplete');
    assert.ok(depBlocker, 'should have dependency_incomplete blocker');
    assert.ok(depBlocker.message.includes('Phase 1'));
    assert.ok(depBlocker.command.includes('/gsd:execute-phase 1'));
  });

  test('passes when dependency phase is complete', () => {
    writeRoadmap(tmpDir, { phase1Complete: true });
    const result = runGsdTools('preflight 2', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    const depBlocker = out.blockers.find(b => b.type === 'dependency_incomplete');
    assert.strictEqual(depBlocker, undefined, 'should have no dependency blocker');
  });

  test('skips dependency check when "Depends on: Nothing"', () => {
    writeRoadmap(tmpDir);
    const result = runGsdTools('preflight 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.blockers.length, 0);
  });
});

// ─── Check 4: Artifact gate ──────────────────────────────────────────────────

describe('preflight: check 4 — artifact gate', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeRoadmap(tmpDir, { phase1Complete: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('discuss workflow requires no artifacts', () => {
    const result = runGsdTools('preflight 1 --workflow discuss', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.detected_workflow, 'discuss');
    const artifactBlocker = out.blockers.find(b => b.type === 'artifact_missing');
    assert.strictEqual(artifactBlocker, undefined);
  });

  test('plan workflow blocks without CONTEXT.md', () => {
    const result = runGsdTools('preflight 1 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, false);
    const blocker = out.blockers.find(b => b.type === 'artifact_missing');
    assert.ok(blocker);
    assert.ok(blocker.message.includes('CONTEXT.md'));
  });

  test('plan workflow passes with CONTEXT.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-CONTEXT.md'),
      '# Context\nSome context'
    );
    const result = runGsdTools('preflight 1 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    const blocker = out.blockers.find(b => b.type === 'artifact_missing');
    assert.strictEqual(blocker, undefined);
  });

  test('execute workflow blocks without PLAN.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-CONTEXT.md'),
      '# Context'
    );
    const result = runGsdTools('preflight 1 --workflow execute', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, false);
    const blocker = out.blockers.find(b => b.type === 'artifact_missing');
    assert.ok(blocker);
    assert.ok(blocker.message.includes('PLAN.md'));
  });

  test('verify workflow blocks without SUMMARY.md', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context');
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nwave: 1\n---\n# Plan');
    const result = runGsdTools('preflight 1 --workflow verify', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, false);
    const blocker = out.blockers.find(b => b.type === 'artifact_missing');
    assert.ok(blocker);
    assert.ok(blocker.message.includes('SUMMARY.md'));
  });
});

// ─── Check 4b: UI-SPEC warning ──────────────────────────────────────────────

describe('preflight: check 4b — UI-SPEC warning', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Phase 2 has "UI" and "dashboard" and "widget" in its ROADMAP section
    writeRoadmap(tmpDir, {
      phase1Complete: true,
      phase2Goal: 'Build dashboard UI widget components',
    });
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '02-features');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '02-CONTEXT.md'), '# Context');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('warns about missing UI-SPEC on frontend phase', () => {
    const result = runGsdTools('preflight 2 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    const warning = out.warnings.find(w => w.type === 'ui_spec_missing');
    assert.ok(warning, 'should warn about missing UI-SPEC');
    assert.ok(warning.command.includes('/gsd:ui-phase 2'));
  });

  test('no UI-SPEC warning when UI-SPEC exists', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '02-features');
    fs.writeFileSync(path.join(phaseDir, '02-UI-SPEC.md'), '# UI Spec');
    const result = runGsdTools('preflight 2 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    const warning = out.warnings.find(w => w.type === 'ui_spec_missing');
    assert.strictEqual(warning, undefined, 'should not warn when UI-SPEC exists');
  });
});

// ─── Check 5: Canonical refs ─────────────────────────────────────────────────

describe('preflight: check 5 — canonical refs', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeRoadmap(tmpDir, { phase1Complete: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    // Create a real file that can be referenced
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'module.exports = {}');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validates canonical refs pointing to real files', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-CONTEXT.md'),
      `# Context

<canonical_refs>
## Canonical References

### Source
- \`src/index.js\` — Main entry point
</canonical_refs>
`
    );
    const result = runGsdTools('preflight 1 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.canonical_refs_checked, 1);
    assert.strictEqual(out.canonical_refs_valid, 1);
    assert.strictEqual(out.warnings.filter(w => w.type === 'canonical_ref_missing').length, 0);
  });

  test('warns about missing canonical refs', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-CONTEXT.md'),
      `# Context

<canonical_refs>
## Canonical References

### Docs
- \`docs/api-spec.md\` — API specification
- \`src/index.js\` — Main entry
</canonical_refs>
`
    );
    const result = runGsdTools('preflight 1 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.canonical_refs_checked, 2);
    assert.strictEqual(out.canonical_refs_valid, 1);
    const warning = out.warnings.find(w => w.type === 'canonical_ref_missing');
    assert.ok(warning);
    assert.ok(warning.path.includes('docs/api-spec.md'));
  });

  test('skips "No external specs" content', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-CONTEXT.md'),
      `# Context

<canonical_refs>
No external specs — requirements fully captured in decisions above
</canonical_refs>
`
    );
    const result = runGsdTools('preflight 1 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.canonical_refs_checked, 0);
  });

  test('skips when no canonical_refs section', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-CONTEXT.md'),
      '# Context\nJust decisions, no refs.'
    );
    const result = runGsdTools('preflight 1 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.canonical_refs_checked, 0);
  });

  test('strips section references (§N) before checking path', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-CONTEXT.md'),
      `# Context

<canonical_refs>
- \`src/index.js §3 Exports section\` — Relevant exports
</canonical_refs>
`
    );
    const result = runGsdTools('preflight 1 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.canonical_refs_checked, 1);
    assert.strictEqual(out.canonical_refs_valid, 1);
  });
});

// ─── Check 6: Plan files_modified ────────────────────────────────────────────

describe('preflight: check 6 — plan files_modified', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeRoadmap(tmpDir, { phase1Complete: true });
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context');
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), '// app');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('validates existing files_modified paths', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-01-PLAN.md'),
      `---
wave: 1
files_modified: [src/app.js]
---
# Plan 1
`
    );
    const result = runGsdTools('preflight 1 --workflow execute', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.plan_paths_checked, 1);
    assert.strictEqual(out.plan_paths_valid, 1);
  });

  test('accepts new files when parent dir exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-01-PLAN.md'),
      `---
wave: 1
files_modified: [src/new-file.js]
---
# Plan 1
`
    );
    const result = runGsdTools('preflight 1 --workflow execute', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.plan_paths_checked, 1);
    assert.strictEqual(out.plan_paths_valid, 1);
  });

  test('warns when parent dir also missing', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-01-PLAN.md'),
      `---
wave: 1
files_modified: [nonexistent/dir/file.js]
---
# Plan 1
`
    );
    const result = runGsdTools('preflight 1 --workflow execute', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.plan_paths_checked, 1);
    assert.strictEqual(out.plan_paths_valid, 0);
    const warning = out.warnings.find(w => w.type === 'files_modified_missing');
    assert.ok(warning);
    assert.ok(warning.path.includes('nonexistent/dir/file.js'));
  });

  test('skips glob patterns in files_modified', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-01-PLAN.md'),
      `---
wave: 1
files_modified: [src/*.js, src/app.js]
---
# Plan 1
`
    );
    const result = runGsdTools('preflight 1 --workflow execute', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    // Only src/app.js counted, src/*.js skipped
    assert.strictEqual(out.plan_paths_checked, 1);
    assert.strictEqual(out.plan_paths_valid, 1);
  });

  test('skips plans without files_modified field', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'phases', '01-foundation', '01-01-PLAN.md'),
      `---
wave: 1
---
# Plan 1
`
    );
    const result = runGsdTools('preflight 1 --workflow execute', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.plan_paths_checked, 0);
  });
});

// ─── Workflow auto-detection ─────────────────────────────────────────────────

describe('preflight: workflow auto-detection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeRoadmap(tmpDir, { phase1Complete: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects discuss when no phase dir', () => {
    const result = runGsdTools('preflight 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.detected_workflow, 'discuss');
    assert.strictEqual(out.next_command, '/gsd:discuss-phase 1');
  });

  test('detects discuss when phase dir empty', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-foundation'), { recursive: true });
    const result = runGsdTools('preflight 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.detected_workflow, 'discuss');
  });

  test('detects plan when CONTEXT exists but no PLANs', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context');
    const result = runGsdTools('preflight 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.detected_workflow, 'plan');
    assert.strictEqual(out.next_command, '/gsd:plan-phase 1');
  });

  test('detects execute when PLANs exist but no SUMMARYs', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context');
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nwave: 1\n---\n# Plan');
    const result = runGsdTools('preflight 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.detected_workflow, 'execute');
    assert.strictEqual(out.next_command, '/gsd:execute-phase 1');
  });

  test('detects verify when SUMMARYs exist', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context');
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nwave: 1\n---\n# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '---\ncompleted: true\n---\n# Summary');
    const result = runGsdTools('preflight 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.detected_workflow, 'verify');
    assert.strictEqual(out.next_command, '/gsd:verify-work 1');
  });
});

// ─── Arg parsing: step 3.7 compat ───────────────────────────────────────────

describe('preflight: arg parsing', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeRoadmap(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('workflow-first format: preflight plan-phase 1', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context');
    const result = runGsdTools('preflight plan-phase 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.phase, '1');
    assert.strictEqual(out.detected_workflow, 'plan');
  });

  test('workflow-first format: preflight execute-phase 1', () => {
    const result = runGsdTools('preflight execute-phase 1', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.phase, '1');
    assert.strictEqual(out.detected_workflow, 'execute');
  });

  test('flag format: preflight 1 --workflow verify', () => {
    const result = runGsdTools('preflight 1 --workflow verify', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.phase, '1');
    assert.strictEqual(out.detected_workflow, 'verify');
  });
});

// ─── ready flag logic ────────────────────────────────────────────────────────

describe('preflight: ready flag', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeRoadmap(tmpDir, { phase1Complete: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('ready=true when no blockers (only warnings)', () => {
    // Phase 2 has frontend indicators → ui_spec_missing warning
    writeRoadmap(tmpDir, {
      phase1Complete: true,
      phase2Goal: 'Build dashboard UI widget',
    });
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '02-features');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '02-CONTEXT.md'), '# Context');
    const result = runGsdTools('preflight 2 --workflow plan', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, true, 'warnings should not block');
    assert.ok(out.warnings.length > 0, 'should have warnings');
  });

  test('ready=false when any non-skippable blocker', () => {
    writeRoadmap(tmpDir, { phase1Complete: false });
    const result = runGsdTools('preflight 2', tmpDir);
    assert.ok(result.success);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.ready, false);
    assert.ok(out.blockers.some(b => !b.skippable));
  });
});
