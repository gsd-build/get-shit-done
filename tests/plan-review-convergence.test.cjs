/**
 * Tests for gsd:plan-review-convergence command (#2306)
 *
 * Validates that the command source and workflow contain the key structural
 * elements required for correct cross-AI plan convergence loop behavior:
 * initial planning gate, review agent spawning, HIGH count extraction via
 * CYCLE_SUMMARY contract, stall detection (behavioral), escalation gate
 * (including --max-cycles 1 edge case), and STATE.md update on convergence.
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

  test('workflow parses ARGUMENTS before calling gsd-tools init (PHASE must be known)', () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const parseIdx = workflow.search(/Parse (and Normalize )?Arguments/i);
    const initIdx = workflow.search(/node\s+"?\$HOME[^"]*gsd-tools\.cjs"?\s+init\s+plan-phase/);
    assert.ok(parseIdx > -1, 'workflow must have an ARGUMENTS parsing section');
    assert.ok(initIdx > -1, 'workflow must call gsd-tools.cjs init plan-phase');
    assert.ok(
      parseIdx < initIdx,
      'Arguments parsing must come BEFORE init plan-phase so $PHASE is populated'
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

  test('review agent spawn forwards --ws via {GSD_WS} (symmetric with replan agent)', () => {
    // Extract the review agent spawn block (between "Cross-AI review" description and its closing mode="auto")
    const reviewMatch = workflow.match(/description="Cross-AI review[\s\S]*?mode="auto"/);
    assert.ok(reviewMatch, 'review agent spawn block must exist');
    assert.ok(
      reviewMatch[0].includes('{GSD_WS}'),
      'review agent spawn must include {GSD_WS} in the skill args — asymmetry with replan agent is a correctness bug when user passes --ws'
    );
  });

  test('replan agent spawn forwards --ws via {GSD_WS}', () => {
    const replanMatch = workflow.match(/description="Replan[\s\S]*?mode="auto"/);
    assert.ok(replanMatch, 'replan agent spawn block must exist');
    assert.ok(
      replanMatch[0].includes('{GSD_WS}'),
      'replan agent must include {GSD_WS} in the skill args'
    );
  });

  test('workflow extracts HIGH_COUNT via CYCLE_SUMMARY contract (not raw grep of REVIEWS.md)', () => {
    assert.ok(
      workflow.includes('CYCLE_SUMMARY'),
      'workflow must use CYCLE_SUMMARY contract — raw grep of REVIEWS.md double-counts historical references across cycles'
    );
    assert.ok(
      workflow.includes('current_high='),
      'CYCLE_SUMMARY contract must use current_high=<N> format'
    );
    assert.ok(
      workflow.match(/CYCLE_SUMMARY:\s*\\s\+\s*current_high=\(\\d\+\)/) ||
      workflow.match(/CYCLE_SUMMARY:\\s\+current_high=\(\\d\+\)/),
      'workflow must extract HIGH_COUNT via regex matching CYCLE_SUMMARY: current_high=<N>'
    );
  });

  test('workflow instructs reviewer to exclude resolved/historical HIGH from count', () => {
    assert.ok(
      workflow.includes('EXCLUDE') && workflow.includes('RESOLVED'),
      'CYCLE_SUMMARY contract must exclude resolved HIGHs from the count'
    );
    assert.ok(
      workflow.match(/retrospective|summary tables/i),
      'contract must exclude HIGH mentions in retrospective/summary tables (cycle-comparison artifacts)'
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

// ─── Workflow: stall detection (behavioral) ───────────────────────────────

describe('plan-review-convergence workflow: stall detection — behavioral (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow tracks previous HIGH count to detect stalls', () => {
    assert.ok(
      workflow.includes('prev_high_count') || workflow.includes('prev_HIGH'),
      'workflow must track the previous cycle HIGH count for stall detection'
    );
  });

  test('stall condition uses >= (covers both "stable" AND "increasing" cases)', () => {
    // The exact spec: "If HIGH_COUNT >= prev_high_count"
    // A bug would be using > alone (misses the stable-count case) or <= (inverted logic)
    assert.ok(
      workflow.match(/HIGH_COUNT\s*>=\s*prev_high_count/),
      'stall condition must be HIGH_COUNT >= prev_high_count — using > alone would miss the "count stable across cycles" case (real stall)'
    );
    assert.ok(
      !workflow.match(/HIGH_COUNT\s*<=\s*prev_high_count/),
      'stall condition must NOT be <= (that would be inverted logic — decreasing counts would falsely trigger stall)'
    );
  });

  // Behavioral simulation: verify the condition `HIGH_COUNT >= prev_high_count`
  // produces correct stall/no-stall decisions across the three cycle transitions.
  const stallCondition = (current, previous) => current >= previous;

  test('BEHAVIORAL: decreasing HIGH count (progress) does NOT trigger stall', () => {
    // 5 → 3: real progress, cycle should continue to replan
    assert.strictEqual(stallCondition(3, 5), false, 'decreasing 5→3 must NOT be stall');
    assert.strictEqual(stallCondition(1, 10), false, 'decreasing 10→1 must NOT be stall');
  });

  test('BEHAVIORAL: stable HIGH count (no progress) DOES trigger stall', () => {
    // 5 → 5: the original stall case from revision-loop.md
    assert.strictEqual(stallCondition(5, 5), true, 'stable 5→5 MUST be stall (revision not converging)');
    assert.strictEqual(stallCondition(0, 0), true, 'stable 0→0 is stall but HIGH_COUNT==0 exits loop first — trap prevents false alarm');
  });

  test('BEHAVIORAL: increasing HIGH count (regression) DOES trigger stall', () => {
    // Regression case: replan made things worse
    assert.strictEqual(stallCondition(7, 5), true, 'increasing 5→7 MUST be stall (regression)');
    assert.strictEqual(stallCondition(13, 3), true, 'increasing 3→13 MUST be stall');
  });

  test('workflow emits stall warning text when condition triggers', () => {
    assert.ok(
      workflow.match(/stalled|Stall|not decreasing/),
      'workflow must emit a stall warning message when condition triggers (for user visibility)'
    );
  });
});

// ─── Workflow: escalation gate (including --max-cycles 1 edge) ────────────

describe('plan-review-convergence workflow: escalation gate (#2306)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow escalates to user when max cycles reached with HIGHs remaining', () => {
    assert.ok(
      workflow.includes('MAX_CYCLES') &&
      (workflow.includes('AskUserQuestion') || workflow.includes('vscode_askquestions')),
      'workflow must escalate to user via AskUserQuestion when max cycles reached'
    );
  });

  test('max-cycles condition uses >= (so --max-cycles 1 triggers after cycle 1)', () => {
    assert.ok(
      workflow.match(/cycle\s*>=\s*MAX_CYCLES/),
      'max-cycles check must use cycle >= MAX_CYCLES — using > alone would require cycle=MAX_CYCLES+1 before escalation'
    );
  });

  // Behavioral simulation: --max-cycles 1 corner case
  const shouldEscalate = (cycle, maxCycles, highCount) => highCount > 0 && cycle >= maxCycles;

  test('BEHAVIORAL: --max-cycles 1 with HIGHs in cycle 1 immediately escalates (no replan)', () => {
    // User sets --max-cycles 1 as "review-only / dry-run" mode
    assert.strictEqual(shouldEscalate(1, 1, 3), true, 'cycle=1, max=1, HIGHs=3 MUST escalate immediately');
    assert.strictEqual(shouldEscalate(1, 1, 0), false, 'cycle=1, max=1, HIGHs=0 converges instead (HIGH_COUNT==0 branch exits earlier)');
  });

  test('BEHAVIORAL: --max-cycles 3 (default) only escalates after 3 cycles', () => {
    assert.strictEqual(shouldEscalate(1, 3, 5), false, 'cycle=1 of 3: must NOT escalate yet — replan next');
    assert.strictEqual(shouldEscalate(2, 3, 5), false, 'cycle=2 of 3: must NOT escalate yet — replan next');
    assert.strictEqual(shouldEscalate(3, 3, 5), true, 'cycle=3 of 3: MUST escalate (max reached)');
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

  test('workflow aborts if review agent omits CYCLE_SUMMARY contract', () => {
    assert.ok(
      workflow.match(/did not honor the CYCLE_SUMMARY contract/i),
      'workflow must fail-loud (not silently default) if review agent omits the CYCLE_SUMMARY summary line'
    );
  });
});
