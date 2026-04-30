/**
 * execute-phase MVP+TDD gate — contract test
 * Verifies the workflow markdown documents the gate's resolution chain,
 * per-task firing condition, and end-of-phase review escalation.
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

describe('execute-phase — MVP+TDD gate', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf-8');

  test('Step 1 resolves MVP_MODE from roadmap mode field', () => {
    assert.match(content, /MVP_MODE/, 'workflow must declare MVP_MODE');
    assert.match(
      content,
      /roadmap[^\n]*mode|phase[^\n]*\.mode|\.mode\s*=/i,
      'must consult phase mode from roadmap'
    );
  });

  test('gate fires when both MVP_MODE and TDD_MODE are true', () => {
    assert.match(
      content,
      /MVP_MODE[^\n]*TDD_MODE|TDD_MODE[^\n]*MVP_MODE/,
      'workflow must combine MVP_MODE and TDD_MODE for the gate'
    );
  });

  test('per-task gate is documented before behavior-adding task execution', () => {
    assert.match(content, /MVP\+TDD\s*gate|mvp[\s-]?tdd[\s-]?gate/i, 'must label the gate');
    assert.match(content, /failing[\s-]?test\s*commit|test\(.+\):.*RED/i, 'must reference failing-test commit check');
  });

  test('end-of-phase TDD review escalates to blocking under MVP+TDD', () => {
    assert.match(
      content,
      /blocking[^\n]*MVP|MVP[^\n]*blocking|escalat\w+\s*to\s*blocking/i,
      'must escalate end-of-phase review to blocking'
    );
  });

  test('workflow references execute-mvp-tdd.md', () => {
    assert.match(content, /execute-mvp-tdd\.md/, 'must reference the gate semantics file');
  });
});

describe('execute-phase MVP+TDD — resolution chain integration', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('roadmap.get-phase --pick mode returns mvp when **Mode:** mvp set', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## v1.0.0\n\n### Phase 1: User Auth\n**Goal:** As a user, I want to log in, so that I can access.\n**Mode:** mvp\n`
    );
    const result = runGsdTools('roadmap get-phase 1 --pick mode', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(result.output.trim(), 'mvp');
  });

  test('roadmap.get-phase --pick mode returns null/empty when no Mode line', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## v1.0.0\n\n### Phase 1: User Auth\n**Goal:** Users can log in.\n`
    );
    const result = runGsdTools('roadmap get-phase 1 --pick mode', tmpDir);
    if (result.success) {
      assert.ok(result.output.trim() === '' || result.output.trim() === 'null');
    }
  });

  test('config-get workflow.mvp_mode default is unset in fresh project', () => {
    const result = runGsdTools('config-get workflow.mvp_mode', tmpDir);
    if (result.success) {
      assert.notStrictEqual(result.output.trim(), 'true');
    }
  });
});
