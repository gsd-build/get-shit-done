// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Bug #2410 — /gsd:manager background execute-phase Task fails with
 * "Stream idle timeout" on multi-plan phases.
 *
 * Fix: execute-phase.md instructs the orchestrator to emit `[checkpoint]`
 * heartbeat lines at every wave boundary AND every plan boundary so the
 * Claude API SSE stream never idles long enough to trigger the platform
 * timeout. This test validates the workflow contract that backs that fix.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  'get-shit-done',
  'workflows',
  'execute-phase.md'
);
const COMMANDS_DOC_PATH = path.join(__dirname, '..', 'docs', 'COMMANDS.md');

describe('bug #2410: execute-phase emits checkpoint heartbeats', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf-8');

  test('workflow references the stream idle timeout symptom by name', () => {
    assert.ok(
      /Stream idle timeout/.test(workflow),
      'workflow should name the API error it is preventing'
    );
    assert.ok(
      workflow.includes('#2410'),
      'workflow should cite the tracking issue for future maintainers'
    );
  });

  test('workflow defines a [checkpoint] heartbeat line format', () => {
    assert.ok(
      workflow.includes('[checkpoint]'),
      'workflow should document the [checkpoint] marker prefix'
    );
  });

  test('workflow emits a wave-start heartbeat (A: wave-boundary checkpoint)', () => {
    assert.ok(
      /\[checkpoint\][^\n]*wave \{N\}\/\{M\} starting/.test(workflow),
      'workflow should emit a wave-start [checkpoint] marker before spawning agents'
    );
  });

  test('workflow emits a wave-complete heartbeat (A: wave-boundary checkpoint)', () => {
    assert.ok(
      /\[checkpoint\][^\n]*wave \{N\}\/\{M\} complete/.test(workflow),
      'workflow should emit a wave-complete [checkpoint] marker after spot-checks'
    );
  });

  test('workflow emits a plan-start heartbeat (B: plan-boundary checkpoint)', () => {
    assert.ok(
      /\[checkpoint\][^\n]*plan \{plan_id\} starting/.test(workflow),
      'workflow should emit a plan-start [checkpoint] marker before each Task() dispatch'
    );
  });

  test('workflow emits a plan-complete heartbeat (B: plan-boundary checkpoint)', () => {
    assert.ok(
      /\[checkpoint\][^\n]*plan \{plan_id\} complete/.test(workflow),
      'workflow should emit a plan-complete [checkpoint] marker after executor returns'
    );
  });

  test('workflow handles plan failure and checkpoint-gate heartbeats too', () => {
    assert.ok(
      /\[checkpoint\][^\n]*plan \{plan_id\} failed/.test(workflow),
      'workflow should emit a plan-failed [checkpoint] marker on executor error'
    );
    assert.ok(
      /\[checkpoint\][^\n]*plan \{plan_id\} checkpoint/.test(workflow),
      'workflow should emit a heartbeat when a plan returns a human-gate checkpoint'
    );
  });

  test('heartbeats include a monotonic plans-done counter', () => {
    // The {P}/{Q} counter lets grep-based recovery tools reconstruct progress
    // from a truncated transcript if the agent dies mid-phase.
    assert.ok(
      /\{P\}\/\{Q\} plans done/.test(workflow),
      'heartbeats should include a {P}/{Q} phase-wide completed-plan counter'
    );
  });

  test('wave-start heartbeat precedes the "Describe what\'s being built" text', () => {
    const describeIdx = workflow.indexOf("Describe what's being built");
    const heartbeatIdx = workflow.indexOf(
      '[checkpoint] phase {PHASE_NUMBER} wave {N}/{M} starting'
    );
    assert.ok(describeIdx !== -1, 'workflow should still have the describe step');
    assert.ok(heartbeatIdx !== -1, 'wave-start heartbeat template should be present');
    // The instruction to emit the heartbeat appears in step 2, which is the
    // step titled "Describe what's being built". The actual sentinel text we
    // look for is the inline literal template — it must be emitted BEFORE any
    // tool calls in that step.
    const step2 = workflow.slice(
      describeIdx,
      workflow.indexOf('3. **Spawn executor agents', describeIdx)
    );
    assert.ok(
      step2.includes('[checkpoint]'),
      'step 2 should instruct the orchestrator to emit a [checkpoint] heartbeat'
    );
    assert.ok(
      /before any further reasoning or spawning/i.test(step2) ||
        /before any tool call/i.test(step2) ||
        /no tool call/i.test(step2),
      'step 2 should make clear the heartbeat is an assistant-text line, not a tool call'
    );
  });

  test('plan-start heartbeat is inside the spawn step', () => {
    const spawnIdx = workflow.indexOf('3. **Spawn executor agents');
    const waitIdx = workflow.indexOf('4. **Wait for all agents', spawnIdx);
    assert.ok(spawnIdx !== -1 && waitIdx !== -1, 'spawn and wait steps must exist');
    const step3 = workflow.slice(spawnIdx, waitIdx);
    assert.ok(
      /\[checkpoint\][^\n]*plan \{plan_id\} starting/.test(step3),
      'plan-start heartbeat should be emitted inside step 3 (spawn executor agents)'
    );
  });

  test('plan-complete and wave-complete heartbeats are inside the wait/report steps', () => {
    const waitIdx = workflow.indexOf('4. **Wait for all agents');
    const hookIdx = workflow.indexOf('5. **Post-wave hook validation', waitIdx);
    assert.ok(waitIdx !== -1 && hookIdx !== -1, 'wait + hook steps must exist');
    const step4 = workflow.slice(waitIdx, hookIdx);
    assert.ok(
      /\[checkpoint\][^\n]*plan \{plan_id\} complete/.test(step4),
      'plan-complete heartbeat should be emitted in step 4 (wait for agents)'
    );

    const reportIdx = workflow.indexOf('6. **Report completion');
    const failureIdx = workflow.indexOf('7. **Handle failures', reportIdx);
    assert.ok(reportIdx !== -1 && failureIdx !== -1, 'report + failure steps must exist');
    const step6 = workflow.slice(reportIdx, failureIdx);
    assert.ok(
      /\[checkpoint\][^\n]*wave \{N\}\/\{M\} complete/.test(step6),
      'wave-complete heartbeat should be emitted in step 6 (report completion)'
    );
  });
});

describe('bug #2410: checkpoint heartbeat format is user-documented', () => {
  const commandsDoc = fs.readFileSync(COMMANDS_DOC_PATH, 'utf-8');

  test('COMMANDS.md documents the [checkpoint] format under /gsd-manager', () => {
    const managerIdx = commandsDoc.indexOf('### `/gsd-manager`');
    assert.ok(managerIdx !== -1, '/gsd-manager section should exist');
    const section = commandsDoc.slice(managerIdx, managerIdx + 4000);
    assert.ok(
      /\[checkpoint\]/.test(section),
      'COMMANDS.md /gsd-manager section should document [checkpoint] heartbeat markers'
    );
    assert.ok(
      /Stream idle timeout/i.test(section),
      'COMMANDS.md should explain what the heartbeats prevent'
    );
    assert.ok(
      /#2410/.test(section),
      'COMMANDS.md should reference the tracking issue'
    );
  });
});
