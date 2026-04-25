/**
 * Tests for gsd:plan-review-convergence command (#2306)
 *
 * Validates that the command source and workflow contain the key structural
 * elements required for correct cross-AI plan convergence loop behavior:
 * initial planning gate, review agent spawning, CYCLE_SUMMARY contract for
 * HIGH count extraction, stall detection, escalation gate, and STATE.md update
 * on convergence.
 *
 * v2 additions (#2306-v2):
 * - CYCLE_SUMMARY contract replaces raw grep (prevents false stalls from
 *   accumulated REVIEWS.md history across cycles)
 * - workflow.plan_review_convergence config gate (disabled by default)
 * - --ws forwarded to review agent (symmetric with replan agent)
 * - PARTIALLY RESOLVED / FULLY RESOLVED definitions in contract
 * - HIGH_LINES validation warning when HIGH_COUNT > 0 but section absent
 * - Success criteria updated to reflect CYCLE_SUMMARY parsing
 */

// allow-test-rule: source-text-is-the-product
// The workflow markdown IS the runtime instruction. Testing its text content
// tests the deployed contract — if the CYCLE_SUMMARY requirement is absent,
// the false-stall bug is absent from defenses too.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMMAND_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'plan-review-convergence.md');
const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-review-convergence.md');
const SCHEMA_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'config-schema.cjs');
const CONFIG_DOC_PATH = path.join(__dirname, '..', 'docs', 'CONFIGURATION.md');

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

  test('command documents local model reviewer flags (--ollama, --lm-studio, --llama-cpp)', () => {
    assert.ok(command.includes('--ollama'), 'must document --ollama flag for local Ollama server');
    assert.ok(command.includes('--lm-studio'), 'must document --lm-studio flag for local LM Studio server');
    assert.ok(command.includes('--llama-cpp'), 'must document --llama-cpp flag for local llama.cpp server');
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

  test('command documents the workflow.plan_review_convergence config key', () => {
    assert.ok(
      command.includes('workflow.plan_review_convergence') ||
      command.includes('plan_review_convergence'),
      'command must document the config key required to enable the feature (#2306-v2)'
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

// ─── Workflow: config gate (disabled by default) ───────────────────────────

describe('plan-review-convergence workflow: config gate (#2306-v2)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow checks workflow.plan_review_convergence config key before running', () => {
    assert.ok(
      workflow.includes('workflow.plan_review_convergence'),
      'workflow must check workflow.plan_review_convergence config key — feature is disabled by default (#2306-v2)'
    );
  });

  test('workflow exits with enable instructions when config key is false', () => {
    // Must tell the user how to enable the feature
    assert.ok(
      workflow.includes('gsd config-set workflow.plan_review_convergence true') ||
      workflow.includes('config-set workflow.plan_review_convergence'),
      'workflow must show the user how to enable the feature when disabled (#2306-v2)'
    );
  });

  test('workflow defaults config key to false (opt-in, not opt-out)', () => {
    // The config-get call must default to false, not true
    const configGetMatch = workflow.match(/config-get\s+workflow\.plan_review_convergence[^\n]*/);
    assert.ok(
      configGetMatch,
      'workflow must read workflow.plan_review_convergence via config-get'
    );
    assert.ok(
      configGetMatch[0].includes('"false"') || configGetMatch[0].includes("'false'") || configGetMatch[0].includes('false'),
      'workflow must default workflow.plan_review_convergence to false (disabled by default) (#2306-v2)'
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

  test('workflow extracts HIGH count from CYCLE_SUMMARY contract, NOT from grepping REVIEWS.md', () => {
    // Critical regression guard: REVIEWS.md accumulates history across cycles;
    // resolved HIGHs from cycle N remain in the file during cycle N+1 as audit trail,
    // inflating raw grep counts and causing false stalls. HIGH count must come from
    // the review agent's CYCLE_SUMMARY return message, not from the file.
    assert.ok(
      workflow.includes('CYCLE_SUMMARY'),
      'workflow must use CYCLE_SUMMARY contract from review agent return message, not raw grep (#2306-v2 false-stall fix)'
    );
    assert.ok(
      workflow.includes('current_high'),
      'workflow must parse current_high from CYCLE_SUMMARY line'
    );
  });

  test('workflow aborts if review agent omits CYCLE_SUMMARY contract', () => {
    assert.ok(
      workflow.includes('did not honor the CYCLE_SUMMARY contract') ||
      workflow.includes('CYCLE_SUMMARY contract'),
      'workflow must abort with clear error when review agent omits CYCLE_SUMMARY (#2306-v2)'
    );
  });

  test('workflow distinguishes malformed CYCLE_SUMMARY from absent CYCLE_SUMMARY', () => {
    // Helps debugging: "present but malformed" vs "completely missing" are different errors
    assert.ok(
      workflow.includes('malformed') ||
      (workflow.includes('CYCLE_SUMMARY') && workflow.includes('present')),
      'workflow must distinguish malformed CYCLE_SUMMARY from absent one for debuggability (#2306-v2)'
    );
  });

  test('review agent spawn forwards --ws via GSD_WS (symmetric with replan agent)', () => {
    // Critical correctness bug: if GSD_WS is not forwarded to the review agent,
    // the review reads from the wrong workspace while replanning reads from the correct one.
    const reviewAgentBlock = workflow.match(/gsd-review['"`,\s][\s\S]{0,300}?GSD_WS/);
    assert.ok(
      reviewAgentBlock ||
      (workflow.includes("'gsd-review'") && workflow.includes('{GSD_WS}') &&
       workflow.indexOf('{GSD_WS}') < workflow.indexOf("'gsd-plan-phase'")),
      'review agent spawn must forward {GSD_WS} — workspace flag must reach the reviewer (#2306-v2 --ws fix)'
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

// ─── Workflow: CYCLE_SUMMARY contract definition ──────────────────────────

describe('plan-review-convergence workflow: CYCLE_SUMMARY contract definition (#2306-v2)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('review agent prompt defines CYCLE_SUMMARY: current_high=<N> format', () => {
    assert.ok(
      workflow.includes('CYCLE_SUMMARY: current_high='),
      'review agent spawn prompt must define the CYCLE_SUMMARY: current_high=<N> output format (#2306-v2)'
    );
  });

  test('CYCLE_SUMMARY contract defines PARTIALLY RESOLVED (acknowledged, mitigation incomplete)', () => {
    assert.ok(
      workflow.includes('PARTIALLY RESOLVED'),
      'CYCLE_SUMMARY INCLUDE list must define PARTIALLY RESOLVED — prevents under-counting of in-progress issues (#2306-v2)'
    );
  });

  test('CYCLE_SUMMARY contract defines FULLY RESOLVED (verified/closed)', () => {
    assert.ok(
      workflow.includes('FULLY RESOLVED'),
      'CYCLE_SUMMARY EXCLUDE list must define FULLY RESOLVED — prevents over-counting of closed issues (#2306-v2)'
    );
  });

  test('CYCLE_SUMMARY contract requires ## Current HIGH Concerns section in review return', () => {
    assert.ok(
      workflow.includes('## Current HIGH Concerns'),
      'review agent must provide ## Current HIGH Concerns section so escalation gate can show specific issues (#2306-v2)'
    );
  });
});

// ─── Workflow: HIGH_LINES validation ──────────────────────────────────────

describe('plan-review-convergence workflow: HIGH_LINES validation (#2306-v2)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow warns when HIGH_COUNT > 0 but ## Current HIGH Concerns section is absent', () => {
    // Prevents silent UX degradation: escalation gate shows blank concern list
    assert.ok(
      workflow.includes('HIGH_LINES') &&
      (workflow.includes('incomplete escalation') || workflow.includes('Current HIGH Concerns')),
      'workflow must warn when HIGH_COUNT > 0 but HIGH_LINES is empty (contract partially violated) (#2306-v2)'
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
    assert.ok(
      workflow.includes('prev_high_count') || workflow.includes('prev_HIGH'),
      'workflow must track prev_high_count across cycles'
    );
    assert.ok(
      workflow.includes('HIGH_COUNT >= prev_high_count') ||
      workflow.includes('HIGH_COUNT >= prev_HIGH') ||
      workflow.includes('not decreasing'),
      'workflow must compare current HIGH count against previous to detect stall'
    );
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
    assert.ok(
      workflow.includes('cycle >= MAX_CYCLES') ||
      workflow.includes('cycle >= max_cycles') ||
      (workflow.includes('MAX_CYCLES') && workflow.includes('AskUserQuestion')),
      'workflow must check cycle >= MAX_CYCLES so --max-cycles 1 triggers escalation after first cycle'
    );
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

// ─── Workflow: success criteria ────────────────────────────────────────────

describe('plan-review-convergence workflow: success criteria (#2306-v2)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('success criteria references CYCLE_SUMMARY parsing, not grep HIGHs', () => {
    const successBlock = workflow.slice(workflow.lastIndexOf('<success_criteria>'));
    assert.ok(
      successBlock.includes('CYCLE_SUMMARY') || successBlock.includes('parse'),
      'success_criteria must reflect that orchestrator parses CYCLE_SUMMARY, not greps REVIEWS.md (#2306-v2)'
    );
    assert.ok(
      !successBlock.includes('grep HIGHs'),
      'success_criteria must NOT say "grep HIGHs" — that was the false-stall bug (#2306-v2)'
    );
  });
});

// ─── Config schema registration ───────────────────────────────────────────

describe('plan-review-convergence config schema registration (#2306-v2)', () => {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

  test('workflow.plan_review_convergence is registered in config-schema.cjs', () => {
    assert.ok(
      schema.includes("'workflow.plan_review_convergence'"),
      "workflow.plan_review_convergence must be registered in VALID_CONFIG_KEYS in config-schema.cjs so gsd config-set accepts it (#2306-v2)"
    );
  });
});

// ─── CONFIGURATION.md documentation ──────────────────────────────────────

describe('plan-review-convergence CONFIGURATION.md documentation (#2306-v2)', () => {
  const configDoc = fs.readFileSync(CONFIG_DOC_PATH, 'utf8');

  test('workflow.plan_review_convergence is documented in CONFIGURATION.md', () => {
    assert.ok(
      configDoc.includes('workflow.plan_review_convergence'),
      'workflow.plan_review_convergence must be documented in docs/CONFIGURATION.md — schema/docs parity test enforces this (#2306-v2)'
    );
  });

  test('CONFIGURATION.md entry documents disabled-by-default behavior', () => {
    const row = configDoc.match(/workflow\.plan_review_convergence[^\n]*/);
    assert.ok(row, 'workflow.plan_review_convergence row must exist in CONFIGURATION.md');
    assert.ok(
      row[0].includes('false') || row[0].includes('disabled'),
      'CONFIGURATION.md entry must document that the feature defaults to false (disabled by default) (#2306-v2)'
    );
  });
});

// ─── Local model reviewer support ────────────────────────────────────────

describe('plan-review-convergence local model reviewer flags (#2306-local)', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('workflow parses --ollama flag into REVIEWER_FLAGS', () => {
    assert.ok(
      workflow.includes('--ollama'),
      'workflow must parse --ollama flag so it is forwarded to the review agent'
    );
  });

  test('workflow parses --lm-studio flag into REVIEWER_FLAGS', () => {
    assert.ok(
      workflow.includes('--lm-studio'),
      'workflow must parse --lm-studio flag so it is forwarded to the review agent'
    );
  });

  test('workflow parses --llama-cpp flag into REVIEWER_FLAGS', () => {
    assert.ok(
      workflow.includes('--llama-cpp'),
      'workflow must parse --llama-cpp flag so it is forwarded to the review agent'
    );
  });
});

describe('plan-review-convergence local model config schema registration (#2306-local)', () => {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

  test('review.ollama_host is registered in config-schema.cjs', () => {
    assert.ok(
      schema.includes("'review.ollama_host'"),
      "review.ollama_host must be in VALID_CONFIG_KEYS so gsd config-set accepts it"
    );
  });

  test('review.lm_studio_host is registered in config-schema.cjs', () => {
    assert.ok(
      schema.includes("'review.lm_studio_host'"),
      "review.lm_studio_host must be in VALID_CONFIG_KEYS so gsd config-set accepts it"
    );
  });

  test('review.llama_cpp_host is registered in config-schema.cjs', () => {
    assert.ok(
      schema.includes("'review.llama_cpp_host'"),
      "review.llama_cpp_host must be in VALID_CONFIG_KEYS so gsd config-set accepts it"
    );
  });
});

describe('plan-review-convergence local model CONFIGURATION.md documentation (#2306-local)', () => {
  const configDoc = fs.readFileSync(CONFIG_DOC_PATH, 'utf8');

  test('review.ollama_host is documented in CONFIGURATION.md', () => {
    assert.ok(
      configDoc.includes('review.ollama_host'),
      'review.ollama_host must be documented in docs/CONFIGURATION.md'
    );
  });

  test('review.lm_studio_host is documented in CONFIGURATION.md', () => {
    assert.ok(
      configDoc.includes('review.lm_studio_host'),
      'review.lm_studio_host must be documented in docs/CONFIGURATION.md'
    );
  });

  test('review.llama_cpp_host is documented in CONFIGURATION.md', () => {
    assert.ok(
      configDoc.includes('review.llama_cpp_host'),
      'review.llama_cpp_host must be documented in docs/CONFIGURATION.md'
    );
  });

  test('review.models.ollama is documented in CONFIGURATION.md', () => {
    assert.ok(
      configDoc.includes('review.models.ollama'),
      'review.models.ollama must be documented so users know how to configure the local model name'
    );
  });

  test('review.models.lm_studio is documented in CONFIGURATION.md', () => {
    assert.ok(
      configDoc.includes('review.models.lm_studio'),
      'review.models.lm_studio must be documented so users know how to configure the local model name'
    );
  });

  test('review.models.llama_cpp is documented in CONFIGURATION.md', () => {
    assert.ok(
      configDoc.includes('review.models.llama_cpp'),
      'review.models.llama_cpp must be documented so users know how to configure the local model name'
    );
  });
});
