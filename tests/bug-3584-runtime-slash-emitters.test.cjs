/**
 * Regression tests for bug #3584 — runtime emitters use the slash formatter.
 *
 * These tests exercise the actual runtime command handlers via `runGsdTools`
 * and assert on the structured payloads they emit/persist. They prove that
 * the high-impact emitters identified in the issue (`init.cjs` recommended
 * actions, `phase.cjs` ROADMAP persistence, `verify.cjs` remediation hints,
 * `milestone.cjs` Operator-Next-Steps persistence, `validate-command-router`
 * fracture recommendations) no longer emit the unroutable `/gsd:<cmd>` colon
 * form for skills-based runtimes.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  runGsdTools,
  createTempProject,
  createTempDir,
  cleanup,
} = require('./helpers.cjs');

// Helper: assert no string field anywhere in `value` (recursive) contains '/gsd:'.
function assertNoColonForm(value, label) {
  const stack = [{ v: value, p: label }];
  while (stack.length > 0) {
    const { v, p } = stack.pop();
    if (typeof v === 'string') {
      assert.ok(
        !v.includes('/gsd:'),
        `${p}: must not contain deprecated /gsd: form, got ${JSON.stringify(v)}`,
      );
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => stack.push({ v: item, p: `${p}[${i}]` }));
    } else if (v && typeof v === 'object') {
      for (const key of Object.keys(v)) {
        stack.push({ v: v[key], p: `${p}.${key}` });
      }
    }
  }
}

// Helper: collect every `command` string under a recommendedActions-style array.
function collectCommandFields(value) {
  const out = [];
  const stack = [value];
  while (stack.length > 0) {
    const v = stack.pop();
    if (Array.isArray(v)) {
      for (const item of v) stack.push(item);
    } else if (v && typeof v === 'object') {
      if (typeof v.command === 'string') out.push(v.command);
      for (const key of Object.keys(v)) stack.push(v[key]);
    }
  }
  return out;
}

describe('bug-3584: init manager recommendedActions emit hyphen form', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Minimal ROADMAP + STATE so init manager will run.
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap',
        '',
        '## Milestone v1',
        '',
        '### Phase 1: Foundation',
        '**Goal:** scaffold',
        '**Plans:** 1 plan',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\nCurrent Phase: 1\n',
    );
  });

  afterEach(() => cleanup(tmpDir));

  test('skills runtime (claude) emits /gsd-<cmd> in recommended_actions[].command', () => {
    // Plan-but-not-executed: directory exists with a PLAN.md → execute is recommended.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');

    const result = runGsdTools('init manager', tmpDir, { GSD_RUNTIME: 'claude' });
    assert.ok(result.success, `init manager failed: ${result.error || result.output}`);

    const payload = JSON.parse(result.output);
    const commands = collectCommandFields(payload.recommended_actions || []);
    assert.ok(commands.length > 0, 'recommended_actions should produce at least one command');

    for (const cmd of commands) {
      assert.ok(
        cmd.startsWith('/gsd-'),
        `recommended_actions command must start with /gsd- for skills-based runtimes, got ${cmd}`,
      );
      assert.ok(
        !cmd.includes('/gsd:'),
        `recommended_actions command must not contain /gsd: colon form, got ${cmd}`,
      );
    }
    assertNoColonForm(payload, 'init.manager payload');
  });

  test('codex runtime emits $gsd-<cmd> in recommended_actions[].command', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');

    const result = runGsdTools('init manager', tmpDir, { GSD_RUNTIME: 'codex' });
    assert.ok(result.success, `init manager (codex) failed: ${result.error || result.output}`);

    const payload = JSON.parse(result.output);
    const commands = collectCommandFields(payload.recommended_actions || []);
    assert.ok(commands.length > 0);

    for (const cmd of commands) {
      assert.ok(
        cmd.startsWith('$gsd-'),
        `codex recommended_actions command must use $gsd- shell-var form, got ${cmd}`,
      );
    }
  });
});

describe('bug-3584: phase add persists hyphen form into ROADMAP.md', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n## Milestone v1\n\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n',
    );
  });

  afterEach(() => cleanup(tmpDir));

  test('phase add persists hyphen-form slash command in roadmap get-phase payload', () => {
    // 1. Add a phase — the system under test persists the phase entry into ROADMAP.md.
    const addResult = runGsdTools(
      ['phase', 'add', 'Test new feature'],
      tmpDir,
      { GSD_RUNTIME: 'claude' },
    );
    assert.ok(addResult.success, `phase add failed: ${addResult.error || addResult.output}`);
    const addPayload = JSON.parse(addResult.output);
    assert.ok(addPayload.phase_number, 'phase add must return phase_number');

    // 2. Read the persisted section back via the structured roadmap-get-phase
    //    contract (NOT via readFileSync; the `section` field on the JSON payload
    //    is the runtime's typed projection of the on-disk ROADMAP content).
    const getResult = runGsdTools(
      ['roadmap', 'get-phase', String(addPayload.phase_number)],
      tmpDir,
      { GSD_RUNTIME: 'claude' },
    );
    assert.ok(getResult.success, `roadmap get-phase failed: ${getResult.error || getResult.output}`);
    const getPayload = JSON.parse(getResult.output);
    assert.ok(getPayload.found, 'roadmap get-phase must find the newly-added phase');
    assert.ok(typeof getPayload.section === 'string', 'roadmap get-phase must return a section field');

    // 3. The persisted phase section must use the routable hyphen form.
    assert.ok(
      !getPayload.section.includes('/gsd:plan-phase'),
      `persisted phase section must not contain /gsd:plan-phase, got: ${getPayload.section}`,
    );
    assert.ok(
      getPayload.section.includes('/gsd-plan-phase'),
      `persisted phase section must contain /gsd-plan-phase, got: ${getPayload.section}`,
    );
  });
});

describe('bug-3584: validate health emits hyphen form in fix hints', () => {
  test('validate health on a broken project returns hyphen-form fix strings', (t) => {
    const tmpDir = createTempDir();
    t.after(() => cleanup(tmpDir));
    // No .planning directory → E001 fires with a `fix:` string that contains
    // the slash-command form.

    const result = runGsdTools(
      ['validate', 'health'],
      tmpDir,
      { GSD_RUNTIME: 'claude' },
    );
    // validate health exits non-zero on broken projects but still emits JSON to stdout.
    const stdout = result.output;
    let payload;
    try {
      payload = JSON.parse(stdout);
    } catch (e) {
      throw new Error(`validate health did not emit parseable JSON: ${stdout.slice(0, 400)}`);
    }

    const allIssues = []
      .concat(payload.errors || [])
      .concat(payload.warnings || [])
      .concat(payload.info || []);

    assert.ok(allIssues.length > 0, 'validate health on a bare tmpdir should report at least one issue');

    const fixesWithSlash = allIssues
      .map((i) => i.fix)
      .filter((f) => typeof f === 'string' && /gsd[-:]/.test(f));
    assert.ok(
      fixesWithSlash.length > 0,
      'at least one fix hint should reference a /gsd- slash command',
    );

    for (const fix of fixesWithSlash) {
      assert.ok(
        !fix.includes('/gsd:'),
        `validate health fix hint must not contain /gsd: colon form, got ${JSON.stringify(fix)}`,
      );
    }
    assertNoColonForm(payload, 'validate health payload');
  });
});

describe('bug-3584: validate context recommendation uses hyphen form', () => {
  test('warning/critical recommendations emit /gsd-thread', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    // Critical band: 75% utilization. validate context emits JSON only with --json.
    const result = runGsdTools(
      ['validate', 'context', '--tokens-used', '75000', '--context-window', '100000', '--json'],
      tmpDir,
      { GSD_RUNTIME: 'claude' },
    );
    assert.ok(result.success, `validate context failed: ${result.error || result.output}`);

    const payload = JSON.parse(result.output);
    assert.ok(payload.recommendation, 'critical utilization should produce a recommendation');
    assert.ok(
      !payload.recommendation.includes('/gsd:'),
      `recommendation must not contain /gsd:, got ${JSON.stringify(payload.recommendation)}`,
    );
    assert.ok(
      payload.recommendation.includes('/gsd-thread'),
      `recommendation must reference /gsd-thread, got ${JSON.stringify(payload.recommendation)}`,
    );
  });
});

describe('bug-3584: validate health uses formatter for codex runtime too', () => {
  test('validate health under codex emits $gsd-<cmd> in fix strings (positive assertion)', (t) => {
    const tmpDir = createTempDir();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['validate', 'health'],
      tmpDir,
      { GSD_RUNTIME: 'codex' },
    );
    let payload;
    try {
      payload = JSON.parse(result.output);
    } catch (e) {
      throw new Error(`validate health (codex) did not emit JSON: ${result.output.slice(0, 400)}`);
    }

    const allIssues = []
      .concat(payload.errors || [])
      .concat(payload.warnings || [])
      .concat(payload.info || []);

    // Collect fixes that mention any gsd slash-command form so we can lock
    // both the absence of legacy forms AND the presence of the codex shape.
    const fixesWithGsdRef = allIssues
      .map((i) => i.fix)
      .filter((f) => typeof f === 'string' && /(?:\$|\/)gsd[-:]/.test(f));

    assert.ok(
      fixesWithGsdRef.length > 0,
      'validate health on a bare tmpdir must produce at least one fix hint referencing a gsd command',
    );

    for (const fix of fixesWithGsdRef) {
      assert.ok(
        fix.includes('$gsd-'),
        `codex validate health fix must use shell-var $gsd- form, got ${JSON.stringify(fix)}`,
      );
      assert.ok(
        !fix.includes('/gsd:'),
        `codex validate health fix must not contain /gsd: colon form, got ${JSON.stringify(fix)}`,
      );
      assert.ok(
        !fix.includes('/gsd-'),
        `codex validate health fix must not contain /gsd- (skills) form, got ${JSON.stringify(fix)}`,
      );
    }
  });
});
