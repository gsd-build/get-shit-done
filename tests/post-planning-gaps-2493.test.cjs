/**
 * Issue #2493: Add unified post-planning gap checker for requirements and context
 *
 * Verifies:
 *   1. Step 13e (Post-Planning Gap Analysis) is inserted into plan-phase.md after
 *      Step 13d and before Step 14, gated on workflow.post_planning_gaps.
 *   2. Headless plan-phase variant has an equivalent post_planning_gaps step.
 *   3. The decision parser extracts D-NN entries from CONTEXT.md <decisions> blocks.
 *   4. The gap detector identifies covered vs not-covered items, avoiding
 *      false-positive ID collisions (REQ-1 vs REQ-10).
 *   5. The gap-analysis CLI:
 *        - Returns enabled:false when workflow.post_planning_gaps is false.
 *        - Returns rows + table when enabled, sorting deterministically.
 *        - Skips gracefully when REQUIREMENTS.md or CONTEXT.md is missing/malformed.
 *   6. config-set workflow.post_planning_gaps:
 *        - Accepts true/false.
 *        - Rejects non-boolean values.
 *   7. config-ensure-section materializes workflow.post_planning_gaps default true.
 *   8. config-schema lists workflow.post_planning_gaps in VALID_CONFIG_KEYS and
 *      core CONFIG_DEFAULTS includes it.
 *   9. The existing Requirements Coverage Gate (Step 13) is still present
 *      (no regression — §13e adds, does not replace).
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const PLAN_PHASE_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');

// ─── Workflow file structure ──────────────────────────────────────────────────

describe('plan-phase.md Step 13e insertion (#2493)', () => {
  test('plan-phase.md exists', () => {
    assert.ok(fs.existsSync(PLAN_PHASE_PATH));
  });

  test('Step 13e (Post-Planning Gap Analysis) heading is present', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    assert.match(content, /## 13e\.\s*Post-Planning Gap Analysis/);
  });

  test('Step 13e appears between Step 13d and Step 14', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    const i13d = content.indexOf('## 13d.');
    const i13e = content.indexOf('## 13e.');
    const i14 = content.indexOf('## 14.');
    assert.ok(i13d !== -1, '## 13d. must exist');
    assert.ok(i13e !== -1, '## 13e. must exist');
    assert.ok(i14 !== -1, '## 14. must exist');
    assert.ok(i13d < i13e && i13e < i14,
      `Step 13e must be between 13d and 14 (got 13d=${i13d}, 13e=${i13e}, 14=${i14})`);
  });

  test('Step 13e references workflow.post_planning_gaps gate', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    const i13e = content.indexOf('## 13e.');
    const i14 = content.indexOf('## 14.');
    const stepBody = content.slice(i13e, i14);
    assert.match(stepBody, /workflow\.post_planning_gaps/);
  });

  test('Step 13e invokes gap-analysis via gsd-tools', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    const i13e = content.indexOf('## 13e.');
    const i14 = content.indexOf('## 14.');
    const stepBody = content.slice(i13e, i14);
    assert.match(stepBody, /gap-analysis/);
  });

  test('Existing Requirements Coverage Gate (§13) is still present (no regression)', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    assert.match(content, /## 13\.\s*Requirements Coverage Gate/);
  });

  // sdk/prompts/workflows/plan-phase.md removed in 377a6d2 — SDK loads installed workflow directly.
});

// ─── Decisions parser ────────────────────────────────────────────────────────

describe('decisions.cjs parser (shared with #2492)', () => {
  const { parseDecisions } = require('../get-shit-done/bin/lib/decisions.cjs');

  test('extracts D-NN entries from a <decisions> block', () => {
    const md = `
<decisions>
## Implementation Decisions

### Auth
- **D-01:** Use OAuth 2.0 with PKCE
- **D-02:** Session storage in Redis

### Storage
- **D-03:** Postgres 15 with pgvector
</decisions>
`;
    const ds = parseDecisions(md);
    assert.deepStrictEqual(ds.map(d => d.id), ['D-01', 'D-02', 'D-03']);
    assert.strictEqual(ds[0].text, 'Use OAuth 2.0 with PKCE');
  });

  test('returns [] when no <decisions> block is present', () => {
    assert.deepStrictEqual(parseDecisions('# Just a header\nno decisions here'), []);
  });

  test('returns [] for empty / null / undefined input', () => {
    assert.deepStrictEqual(parseDecisions(''), []);
    assert.deepStrictEqual(parseDecisions(null), []);
    assert.deepStrictEqual(parseDecisions(undefined), []);
  });

  test('ignores D-IDs outside the <decisions> block', () => {
    const md = `
Top of file. - **D-99:** Not a real decision (outside block).
<decisions>
- **D-01:** Real decision
</decisions>
After the block. - **D-77:** Also not real.
`;
    const ds = parseDecisions(md);
    assert.deepStrictEqual(ds.map(d => d.id), ['D-01']);
  });
});

// ─── Gap analysis CLI ────────────────────────────────────────────────────────

describe('gap-analysis CLI (#2493)', () => {
  let tmpDir;
  let phaseDir;

  function writeRequirements(ids) {
    const lines = ids.map((id, i) => `- [ ] **${id}** Requirement ${i + 1} description`);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n${lines.join('\n')}\n`);
  }

  function writeContext(decisions) {
    const dLines = decisions.map(d => `- **${d.id}:** ${d.text}`).join('\n');
    fs.writeFileSync(path.join(phaseDir, 'CONTEXT.md'),
      `# Phase Context\n\n<decisions>\n## Implementation Decisions\n\n${dLines}\n</decisions>\n`);
  }

  function writePlan(name, body) {
    fs.writeFileSync(path.join(phaseDir, `${name}-PLAN.md`), body);
  }

  function ensureConfig() {
    const r = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(r.success, `config-ensure-section failed: ${r.error}`);
  }

  beforeEach(() => {
    tmpDir = createTempProject();
    phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    ensureConfig();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('marks REQ-01 as covered when a plan body mentions REQ-01', () => {
    writeRequirements(['REQ-01']);
    writePlan('01', '# Plan 1\n\nImplements REQ-01.\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, `gap-analysis failed: ${r.error}`);
    const out = JSON.parse(r.output);
    const row = out.rows.find(x => x.item === 'REQ-01');
    assert.ok(row, 'REQ-01 row missing');
    assert.strictEqual(row.status, 'Covered');
  });

  test('marks REQ-99 as not covered when no plan mentions it', () => {
    writeRequirements(['REQ-99']);
    writePlan('01', '# Plan 1\n\nImplements something unrelated.\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success);
    const out = JSON.parse(r.output);
    const row = out.rows.find(x => x.item === 'REQ-99');
    assert.strictEqual(row.status, 'Not covered');
  });

  test('marks D-01 covered when plan mentions D-01', () => {
    writeContext([{ id: 'D-01', text: 'Use OAuth 2.0' }]);
    writePlan('01', '# Plan\n\nImplements D-01 (OAuth).\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success);
    const out = JSON.parse(r.output);
    const row = out.rows.find(x => x.item === 'D-01');
    assert.ok(row);
    assert.strictEqual(row.source, 'CONTEXT.md');
    assert.strictEqual(row.status, 'Covered');
  });

  test('marks D-99 not covered when no plan mentions it', () => {
    writeContext([{ id: 'D-99', text: 'Bit offsets in +OFFSET:BIT format' }]);
    writePlan('01', '# Plan\n\nUnrelated work.\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success);
    const out = JSON.parse(r.output);
    const row = out.rows.find(x => x.item === 'D-99');
    assert.strictEqual(row.status, 'Not covered');
  });

  test('REQ-1 in plan does not falsely mark REQ-10 as covered (word-boundary)', () => {
    writeRequirements(['REQ-1', 'REQ-10']);
    writePlan('01', '# Plan\n\nMentions REQ-1 only.\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success);
    const out = JSON.parse(r.output);
    const row1 = out.rows.find(x => x.item === 'REQ-1');
    const row10 = out.rows.find(x => x.item === 'REQ-10');
    assert.strictEqual(row1.status, 'Covered');
    assert.strictEqual(row10.status, 'Not covered',
      'REQ-10 must not be marked covered by a substring match against REQ-1');
  });

  test('table output contains documented columns', () => {
    writeRequirements(['REQ-01']);
    writePlan('01', '# Plan\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success);
    const out = JSON.parse(r.output);
    assert.match(out.table, /\| Source \| Item \| Status \|/);
    assert.match(out.table, /\|--------\|------\|--------\|/);
    assert.match(out.table, /## Post-Planning Gap Analysis/);
  });

  test('rows sort REQ-02 before REQ-10 (natural sort, deterministic)', () => {
    writeRequirements(['REQ-10', 'REQ-02', 'REQ-01']);
    writePlan('01', '# Plan\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success);
    const out = JSON.parse(r.output);
    const reqRows = out.rows.filter(x => x.source === 'REQUIREMENTS.md').map(x => x.item);
    assert.deepStrictEqual(reqRows, ['REQ-01', 'REQ-02', 'REQ-10']);
  });

  test('REQUIREMENTS.md missing → CONTEXT-only run still works', () => {
    writeContext([{ id: 'D-01', text: 'foo' }]);
    writePlan('01', '# Plan mentioning D-01\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, r.error);
    const out = JSON.parse(r.output);
    assert.strictEqual(out.rows.length, 1);
    assert.strictEqual(out.rows[0].source, 'CONTEXT.md');
  });

  test('CONTEXT.md missing → REQ-only run still works', () => {
    writeRequirements(['REQ-01']);
    writePlan('01', '# Plan REQ-01\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, r.error);
    const out = JSON.parse(r.output);
    assert.strictEqual(out.rows.length, 1);
    assert.strictEqual(out.rows[0].source, 'REQUIREMENTS.md');
  });

  test('both REQUIREMENTS.md and CONTEXT.md missing → no error, empty rows', () => {
    writePlan('01', '# Plan\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, r.error);
    const out = JSON.parse(r.output);
    assert.deepStrictEqual(out.rows, []);
    assert.match(out.summary, /no requirements or decisions/i);
  });

  test('malformed CONTEXT.md (no <decisions> block) treated as zero decisions', () => {
    fs.writeFileSync(path.join(phaseDir, 'CONTEXT.md'), '# Just plain prose, no decisions block.\n');
    writeRequirements(['REQ-01']);
    writePlan('01', '# Plan REQ-01\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, r.error);
    const out = JSON.parse(r.output);
    assert.strictEqual(out.rows.length, 1);
    assert.strictEqual(out.rows[0].source, 'REQUIREMENTS.md');
  });

  test('gate flag false → enabled:false, no scanning', () => {
    runGsdTools(['config-set', 'workflow.post_planning_gaps', 'false'], tmpDir);
    writeRequirements(['REQ-01']);
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success);
    const out = JSON.parse(r.output);
    assert.strictEqual(out.enabled, false);
    assert.deepStrictEqual(out.rows, []);
  });

  test('gate flag true (default) → enabled:true, rows present', () => {
    writeRequirements(['REQ-01']);
    writePlan('01', '# Plan REQ-01\n');
    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success);
    const out = JSON.parse(r.output);
    assert.strictEqual(out.enabled, true);
    assert.ok(out.rows.length >= 1);
  });
});

// ─── Config integration ──────────────────────────────────────────────────────

describe('workflow.post_planning_gaps config (#2493)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('VALID_CONFIG_KEYS contains workflow.post_planning_gaps', () => {
    const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config-schema.cjs');
    assert.ok(VALID_CONFIG_KEYS.has('workflow.post_planning_gaps'));
  });

  test('CONFIG_DEFAULTS contains post_planning_gaps default true', () => {
    // CONFIG_DEFAULTS is exported from core.cjs
    const { CONFIG_DEFAULTS } = require('../get-shit-done/bin/lib/core.cjs');
    assert.strictEqual(CONFIG_DEFAULTS.post_planning_gaps, true);
  });

  test('config-ensure-section materializes workflow.post_planning_gaps:true', () => {
    runGsdTools('config-ensure-section', tmpDir);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.workflow.post_planning_gaps, true);
  });

  test('config-set workflow.post_planning_gaps true → persisted as boolean', () => {
    runGsdTools('config-ensure-section', tmpDir);
    const r = runGsdTools(['config-set', 'workflow.post_planning_gaps', 'true'], tmpDir);
    assert.ok(r.success, r.error);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.workflow.post_planning_gaps, true);
  });

  test('config-set workflow.post_planning_gaps false → persisted as boolean', () => {
    runGsdTools('config-ensure-section', tmpDir);
    const r = runGsdTools(['config-set', 'workflow.post_planning_gaps', 'false'], tmpDir);
    assert.ok(r.success, r.error);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.workflow.post_planning_gaps, false);
  });

  test('config-set workflow.post_planning_gaps yes → rejected', () => {
    runGsdTools('config-ensure-section', tmpDir);
    const r = runGsdTools(['config-set', 'workflow.post_planning_gaps', 'yes'], tmpDir);
    assert.ok(!r.success, 'non-boolean value must be rejected');
    assert.match(r.error || r.output, /boolean|true|false/i);
  });

  // CodeRabbit PR #2610 (comment 3127977404): loadConfig() must surface post_planning_gaps
  // in its return so callers can read config.post_planning_gaps regardless of whether
  // config.json exists, has the workflow section, or sets the flat key.
  test('loadConfig() returns post_planning_gaps default true when key absent', () => {
    const { loadConfig } = require('../get-shit-done/bin/lib/core.cjs');
    runGsdTools('config-ensure-section', tmpDir);
    // Remove the key to simulate older configs that pre-date the toggle
    const cfgPath = path.join(tmpDir, '.planning', 'config.json');
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    delete raw.workflow.post_planning_gaps;
    fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2));
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.post_planning_gaps, true);
  });

  test('loadConfig() returns post_planning_gaps:false when workflow.post_planning_gaps=false', () => {
    const { loadConfig } = require('../get-shit-done/bin/lib/core.cjs');
    runGsdTools('config-ensure-section', tmpDir);
    runGsdTools(['config-set', 'workflow.post_planning_gaps', 'false'], tmpDir);
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.post_planning_gaps, false);
  });

  test('loadConfig() returns post_planning_gaps:true when workflow.post_planning_gaps=true', () => {
    const { loadConfig } = require('../get-shit-done/bin/lib/core.cjs');
    runGsdTools('config-ensure-section', tmpDir);
    runGsdTools(['config-set', 'workflow.post_planning_gaps', 'true'], tmpDir);
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.post_planning_gaps, true);
  });
});
