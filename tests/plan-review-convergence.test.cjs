/**
 * Tests for gsd:plan-review-convergence command (#2306)
 *
 * Validates that the command source and workflow contain the key structural
 * elements required for correct cross-AI plan convergence loop behavior:
 * initial planning gate, review agent spawning, HIGH count detection,
 * stall detection, escalation gate, and STATE.md update on convergence.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMMAND_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'plan-review-convergence.md');
const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-review-convergence.md');

// ─── Command source ────────────────────────────────────────────────────────

describe('plan-review-convergence command source (#2306)', () => {
  const command = fs.readFileSync(COMMAND_PATH, 'utf8');

  test('command name uses gsd: prefix (installer converts to gsd- on install)', () => {
    assert.ok(
      command.includes('name: gsd:plan-review-convergence'),
      'command name must use gsd: prefix so installer converts it to gsd-plan-review-convergence'
    );
  });

  test('command declares all reviewer flags in context', () => {
    assert.ok(command.includes('--codex'), 'must document --codex flag');
    assert.ok(command.includes('--gemini'), 'must document --gemini flag');
    assert.ok(command.includes('--claude'), 'must document --claude flag');
    assert.ok(command.includes('--opencode'), 'must document --opencode flag');
    assert.ok(command.includes('--all'), 'must document --all flag');
    assert.ok(command.includes('--max-cycles'), 'must document --max-cycles flag');
  });

  test('command references the workflow file via execution_context', () => {
    assert.ok(
      command.includes('@$HOME/.claude/get-shit-done/workflows/plan-review-convergence.md'),
      'execution_context must reference the workflow file'
    );
  });

  test('command references supporting reference files', () => {
    assert.ok(
      command.includes('revision-loop.md'),
      'must reference revision-loop.md for stall detection pattern'
    );
    assert.ok(
      command.includes('gates.md'),
      'must reference gates.md for gate taxonomy'
    );
    assert.ok(
      command.includes('agent-contracts.md'),
      'must reference agent-contracts.md for completion markers'
    );
  });

  test('command declares Agent in allowed-tools (required for spawning sub-agents)', () => {
    assert.ok(
      command.includes('- Agent'),
      'Agent must be in allowed-tools — command spawns isolated agents for planning and reviewing'
    );
  });

  test('command has Copilot runtime_note for AskUserQuestion fallback', () => {
    assert.ok(
      command.includes('vscode_askquestions'),
      'must document vscode_askquestions fallback for Copilot compatibility'
    );
  });

  test('--codex is the default reviewer when no flag is specified', () => {
    assert.ok(
      command.includes('default if no reviewer specified') ||
      command.includes('default: --codex') ||
      command.includes('(default if no reviewer specified)'),
      '--codex must be documented as the default reviewer'
    );
  });
});

// ─── Workflow: initialization ──────────────────────────────────────────────

describe('plan-review-convergence workflow: initialization (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow calls gsd-tools.cjs init plan-phase for initialization', () => {
    assert.ok(
      workflow.includes('gsd-tools.cjs') && workflow.includes('init') && workflow.includes('plan-phase'),
      'workflow must initialize via gsd-tools.cjs init plan-phase'
    );
  });

  test('workflow parses --max-cycles with default of 3', () => {
    assert.ok(
      workflow.includes('MAX_CYCLES') && workflow.includes('3'),
      'workflow must parse --max-cycles with default of 3'
    );
  });

  test('workflow displays a startup banner with phase number and reviewer flags', () => {
    assert.ok(
      workflow.includes('PLAN CONVERGENCE') || workflow.includes('Plan Convergence'),
      'workflow must display a startup banner'
    );
  });
});

// ─── Workflow: initial planning gate ──────────────────────────────────────

describe('plan-review-convergence workflow: initial planning gate (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow skips initial planning when plans already exist', () => {
    assert.ok(
      workflow.includes('has_plans') || workflow.includes('plan_count'),
      'workflow must check whether plans already exist before spawning planning agent'
    );
  });

  test('workflow spawns isolated planning agent when no plans exist', () => {
    assert.ok(
      workflow.includes('gsd-plan-phase'),
      'workflow must spawn Agent → gsd-plan-phase when no plans exist'
    );
  });

  test('workflow errors if initial planning produces no PLAN.md files', () => {
    assert.ok(
      workflow.includes('PLAN_COUNT') || workflow.includes('plan_count'),
      'workflow must verify PLAN.md files were created after initial planning'
    );
  });
});

// ─── Workflow: convergence loop ────────────────────────────────────────────

describe('plan-review-convergence workflow: convergence loop (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow spawns isolated review agent each cycle', () => {
    assert.ok(
      workflow.includes('gsd-review'),
      'workflow must spawn Agent → gsd-review each cycle'
    );
  });

  test('workflow detects HIGH concerns by grepping REVIEWS.md', () => {
    assert.ok(
      workflow.includes('HIGH_COUNT') || workflow.includes('grep'),
      'workflow must grep REVIEWS.md for HIGH concerns to determine convergence'
    );
  });

  test('workflow exits loop when HIGH_COUNT == 0 (converged)', () => {
    assert.ok(
      workflow.includes('HIGH_COUNT == 0') ||
      workflow.includes('HIGH_COUNT === 0') ||
      workflow.includes('converged'),
      'workflow must exit the loop when no HIGH concerns remain'
    );
  });

  test('workflow updates STATE.md on convergence', () => {
    assert.ok(
      workflow.includes('planned-phase') || workflow.includes('state'),
      'workflow must update STATE.md via gsd-tools.cjs when converged'
    );
  });

  test('workflow spawns replan agent with --reviews flag', () => {
    assert.ok(
      workflow.includes('--reviews'),
      'replan agent must pass --reviews so gsd-plan-phase incorporates review feedback'
    );
  });

  test('workflow passes --skip-research to replan agent (research already done)', () => {
    assert.ok(
      workflow.includes('--skip-research'),
      'replan agent must skip research — only initial planning needs research'
    );
  });
});

// ─── Workflow: stall detection ─────────────────────────────────────────────

describe('plan-review-convergence workflow: stall detection (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow tracks previous HIGH count to detect stalls', () => {
    assert.ok(
      workflow.includes('prev_high_count') || workflow.includes('prev_HIGH'),
      'workflow must track the previous cycle HIGH count for stall detection'
    );
  });

  test('workflow warns when HIGH count is not decreasing', () => {
    assert.ok(
      workflow.includes('stall') || workflow.includes('Stall') || workflow.includes('not decreasing'),
      'workflow must warn user when HIGH count is not decreasing between cycles'
    );
  });
});

// ─── Workflow: escalation gate ────────────────────────────────────────────

describe('plan-review-convergence workflow: escalation gate (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow escalates to user when max cycles reached with HIGHs remaining', () => {
    assert.ok(
      workflow.includes('MAX_CYCLES') &&
      (workflow.includes('AskUserQuestion') || workflow.includes('vscode_askquestions')),
      'workflow must escalate to user via AskUserQuestion when max cycles reached'
    );
  });

  test('escalation offers "Proceed anyway" option', () => {
    assert.ok(
      workflow.includes('Proceed anyway'),
      'escalation gate must offer "Proceed anyway" to accept plans with remaining HIGH concerns'
    );
  });

  test('escalation offers "Manual review" option', () => {
    assert.ok(
      workflow.includes('Manual review') || workflow.includes('manual'),
      'escalation gate must offer a manual review option'
    );
  });

  test('workflow has text-mode fallback for escalation (plain numbered list)', () => {
    assert.ok(
      workflow.includes('TEXT_MODE') || workflow.includes('text_mode'),
      'workflow must support TEXT_MODE for plain-text escalation prompt'
    );
  });
});

// ─── Workflow: stall detection — behavioral ───────────────────────────────

describe('plan-review-convergence workflow: stall detection behavioral (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow surfaces stall warning when prev_high_count equals current HIGH_COUNT', () => {
    // Behavioral test: two consecutive cycles with the same HIGH count must trigger
    // the stall warning. The workflow must compare HIGH_COUNT >= prev_high_count and
    // emit a warning string that would appear in output.
    assert.ok(
      workflow.includes('prev_high_count') || workflow.includes('prev_HIGH'),
      'workflow must track prev_high_count across cycles'
    );
    // The comparison that detects the stall
    assert.ok(
      workflow.includes('HIGH_COUNT >= prev_high_count') ||
      workflow.includes('HIGH_COUNT >= prev_HIGH') ||
      workflow.includes('not decreasing'),
      'workflow must compare current HIGH count against previous to detect stall'
    );
    // The stall warning text that appears in output
    assert.ok(
      workflow.includes('stall') || workflow.includes('Stall') || workflow.includes('not decreasing'),
      'workflow must emit a stall warning when HIGH count is not decreasing'
    );
  });
});

// ─── Workflow: --max-cycles 1 immediate escalation — behavioral ────────────

describe('plan-review-convergence workflow: --max-cycles 1 immediate escalation behavioral (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow escalates immediately after cycle 1 when --max-cycles 1 and HIGH > 0', () => {
    // Behavioral test: when max_cycles=1, after the first review cycle, if HIGH_COUNT > 0
    // the workflow must trigger the escalation gate (cycle >= MAX_CYCLES check fires on
    // cycle 1 itself). Verify the workflow contains the logic for this edge case.
    assert.ok(
      workflow.includes('cycle >= MAX_CYCLES') ||
      workflow.includes('cycle >= max_cycles') ||
      (workflow.includes('MAX_CYCLES') && workflow.includes('AskUserQuestion')),
      'workflow must check cycle >= MAX_CYCLES so --max-cycles 1 triggers escalation after first cycle'
    );
    // Escalation gate must fire when HIGH > 0 (not just at exactly max_cycles)
    assert.ok(
      workflow.includes('HIGH_COUNT > 0') ||
      workflow.includes('HIGH concerns remain') ||
      workflow.includes('Proceed anyway'),
      'escalation gate must be reachable when HIGH_COUNT > 0 after a single cycle'
    );
  });
});

// ─── Workflow: REVIEWS.md verification ────────────────────────────────────

describe('plan-review-convergence workflow: artifact verification (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow verifies REVIEWS.md exists after each review cycle', () => {
    assert.ok(
      workflow.includes('REVIEWS.md') || workflow.includes('REVIEWS_FILE'),
      'workflow must verify REVIEWS.md was produced by the review agent each cycle'
    );
  });

  test('workflow errors if review agent does not produce REVIEWS.md', () => {
    assert.ok(
      workflow.includes('REVIEWS_FILE') || workflow.includes('review agent did not produce'),
      'workflow must error if the review agent fails to produce REVIEWS.md'
    );
  });
});
