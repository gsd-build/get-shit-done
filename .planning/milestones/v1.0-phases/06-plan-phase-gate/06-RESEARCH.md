# Phase 6: Plan-Phase Gate - Research

**Researched:** 2026-04-30
**Domain:** Workflow integration, markdown agent orchestration, config-driven gates
**Confidence:** HIGH

---

## Summary

Phase 6 wires the SME auditor agent (Phase 5) into the plan-phase workflow as step 12.5. The gate runs after the plan-checker (step 10-12 revision loop) and before PLAN.md finalization (step 13), reads the `workflow.use_sme_agents` config flag to skip unconditionally when disabled, uses `sme.detect-processes` to identify relevant processes, calls `sme.context-block` to inject SME findings into the auditor's prompt, and routes on `## SME_APPROVED` / `## SME_CONCERNS` markers with per-process `block_mode` (soft: warn + proceed, strict: halt).

The deliverables are: (1) an addition to `get-shit-done/workflows/plan-phase.md` (a new step 12.5 block inserted between the revision loop and the requirements coverage gate), (2) an updated `commands/gsd/plan-phase.md` to expose `--acknowledge-sme-risk` in its argument-hint, and (3) structural tests in `tests/` covering the gate behavior. CONFIG-04 (no-SME-documents warning) shares the same no-op-when-no-SME path as GATE-07 and is implemented at the same time.

The phase has no new npm dependencies. All infrastructure is in place: the auditor agent exists (`agents/gsd-sme-auditor.md`), the three SDK query handlers are registered (`sme.list`, `sme.detect-processes`, `sme.context-block`), and the return markers are documented in `agent-contracts.md`. This phase is pure workflow markdown plus structural tests.

**Primary recommendation:** Add a single `## 12.5. SME Audit Gate` step to `plan-phase.md` following the security-enforcement gate pattern (config read → skip guard → banner → detect → spawn auditor → route on marker), update the command file argument-hint, and write CJS structural tests in `tests/` that verify gate presence, skip behavior, and `--acknowledge-sme-risk` handling.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GATE-01 | Plan-phase gate runs as step 12.5 (after plan-checker, before finalization) | Insertion point is between step 12 (revision loop) and step 13 (requirements coverage gate) in `plan-phase.md` [VERIFIED: repo scan of workflow] |
| GATE-02 | Gate detects which processes the current phase touches via `sme.detect-processes` | `sme.detect-processes` handler already implemented and registered in SDK index [VERIFIED: sdk/src/query/sme.ts, sdk/src/query/index.ts] |
| GATE-03 | Gate spawns `gsd-sme-auditor` with relevant SME document(s) and PLAN.md | `gsd-sme-auditor.md` exists with correct frontmatter name [VERIFIED: agents/gsd-sme-auditor.md]; `sme.context-block` produces the XML block injected into the prompt |
| GATE-04 | In soft mode: surface concerns as warnings, allow user to proceed | SME document `block_mode` field read from frontmatter; `sme.detect-processes` returns `block_mode` per match [VERIFIED: sme.ts] |
| GATE-05 | In strict mode: BLOCKER findings halt plan finalization until user acknowledges or revises | Escalation Gate pattern from `gates.md` [VERIFIED: references/gates.md]; AskUserQuestion with "Acknowledge risk / Revise plan" options |
| GATE-06 | User can override strict mode with `--acknowledge-sme-risk` flag | Same pattern as `--skip-verify` / `--skip-ui` flags already in plan-phase.md [VERIFIED: commands/gsd/plan-phase.md argument-hint] |
| GATE-07 | When no SME exists for a detected process, emit warning with `/gsd-create-sme` instructions — never block | `sme.detect-processes` returns `matches: []` when no SME file matches; gate emits non-blocking warning identical to CONFIG-04 path |
| GATE-08 | SME BLOCKERs injected at the top of the gate prompt to prevent context window saturation | Prompt construction must place `<sme_context>` blocks before PLAN.md path reference, not after |
| CONFIG-04 | Enabling SMEs with no existing documents emits a warning with `/gsd-create-sme` instructions, never blocks | Co-located with GATE-07 — same "no SME found" code path; `sme.list` returns `{ enabled: true, smes: [] }` when directory empty [VERIFIED: sme.ts] |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SME feature flag check | SDK Layer (`sme.ts`/`config.ts`) | Orchestration Layer | `workflow.use_sme_agents` read from config via existing pattern; gate skips unconditionally when false |
| Process detection | SDK Layer (`sme.detect-processes`) | — | Already implemented in Phase 2; gate calls via `gsd-sdk query sme.detect-processes` |
| Context block production | SDK Layer (`sme.context-block`) | — | Already implemented in Phase 2; gate calls per detected process |
| Auditor invocation | Orchestration Layer (`plan-phase.md`) | Agent Layer (`gsd-sme-auditor.md`) | Gate spawns auditor as Task(), waits for return marker |
| Return marker routing | Orchestration Layer (`plan-phase.md`) | — | Gate reads `## SME_APPROVED` or `## SME_CONCERNS` and routes per `block_mode` |
| Soft/strict block mode | Orchestration Layer (`plan-phase.md`) | — | block_mode comes from the matched SME's frontmatter (returned by `sme.detect-processes`); gate decides how to react |
| Flag override (`--acknowledge-sme-risk`) | Presentation Layer (`commands/gsd/plan-phase.md`) | Orchestration Layer | Flag parsed in step 2 alongside other `--skip-*` flags; if present, gate proceeds unconditionally |
| No-SME warning (CONFIG-04/GATE-07) | Orchestration Layer (`plan-phase.md`) | — | Warning + `/gsd-create-sme` instruction emitted when `sme.detect-processes` returns empty matches; never blocks |

---

## Standard Stack

### Core (already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Markdown + YAML frontmatter | N/A | Workflow definition format | All GSD workflows use this format [VERIFIED: repo scan] |
| `gsd-sdk query sme.detect-processes` | N/A (SDK-02) | Detect relevant processes for a phase | Implemented and registered in Phase 2 [VERIFIED: sdk/src/query/sme.ts, index.ts] |
| `gsd-sdk query sme.context-block` | N/A (SDK-03) | Produce XML block for agent prompt injection | Implemented and registered in Phase 2 [VERIFIED: sdk/src/query/sme.ts, index.ts] |
| `gsd-sdk query config-get` | N/A | Read `workflow.use_sme_agents` and `sme.blocking` | Used by all config-gated features (security, ui, nyquist) [VERIFIED: plan-phase.md steps 5.55, 5.6] |
| `agents/gsd-sme-auditor.md` | N/A (Phase 5) | The auditor agent to spawn | Exists, all 16 structural tests green [VERIFIED: repo + vitest run] |

### No New Packages Required

Phase 6 delivers workflow markdown changes and CJS structural tests. Zero new npm installs.

---

## Architecture Patterns

### System Architecture Diagram

```
plan-phase.md orchestrator
    │
    │ Step 10-12: plan-checker + revision loop
    │
    ▼
## 12.5. SME Audit Gate  ◄─── PHASE 6 INSERTION POINT
    │
    ├── [use_sme_agents == false] ──────────────────────────► SKIP → Step 13
    │
    ├── gsd-sdk query sme.detect-processes
    │     --file-paths {phase files from PLAN.md}
    │     --goal "{phase goal from ROADMAP.md}"
    │       │
    │       ├── [enabled: false] ──────────────────────────► SKIP → Step 13
    │       │
    │       ├── [matches: [] (no SME for detected processes)]
    │       │     │
    │       │     ├── [CONFIG-04: sme.list returns smes: []]
    │       │     │     └── Warning: "No SME documents exist yet. Run /gsd-create-sme"
    │       │     │
    │       │     └── [GATE-07: processes detected but no SME file exists]
    │       │           └── Warning: "No SME for process '{X}'. Run /gsd-create-sme {X}"
    │       │           └── ──────────────────────────────► PROCEED → Step 13
    │       │
    │       └── [matches: [...] (SME(s) found)]
    │             │
    │             ├── For each match: gsd-sdk query sme.context-block {process_name}
    │             │
    │             └── Task(gsd-sme-auditor, prompt with <sme_context> blocks + PLAN.md path)
    │                     │
    │                     ├── ## SME_APPROVED ────────────────► Display + PROCEED → Step 13
    │                     │
    │                     └── ## SME_CONCERNS
    │                             │
    │                             ├── [--acknowledge-sme-risk flag] ─► PROCEED (documented)
    │                             │
    │                             ├── [block_mode == soft]
    │                             │     └── Display warnings + PROCEED → Step 13
    │                             │
    │                             └── [block_mode == strict]
    │                                   └── AskUserQuestion:
    │                                         1. Acknowledge risk → PROCEED (documented)
    │                                         2. Revise plan → RETURN to Step 8 (replanning)
    │
    ▼
Step 13: Requirements Coverage Gate
```

### Recommended Project Structure

Phase 6 modifies existing files and adds test files:

```
get-shit-done/workflows/
└── plan-phase.md               # Add ## 12.5. SME Audit Gate step

commands/gsd/
└── plan-phase.md               # Update argument-hint to add --acknowledge-sme-risk

tests/
└── sme-gate-plan-phase.test.cjs  # CJS structural tests for gate behavior
```

### Pattern 1: Config-Gated Step (from existing plan-phase.md)

The security enforcement gate in step 5.55 is the direct analog for GATE-01 (skip when disabled). [VERIFIED: plan-phase.md step 5.55]

```markdown
## 12.5. SME Audit Gate

> Skip if `workflow.use_sme_agents` is explicitly `false` (absent = disabled; default is false).

```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```

**If `SME_AGENTS` is `false`:** Skip to step 13.
```

### Pattern 2: `--acknowledge-sme-risk` Flag Parsing (from step 2)

The `--skip-verify`, `--skip-ui`, and `--skip-bounce` flags are parsed in step 2 of plan-phase.md. The `--acknowledge-sme-risk` flag follows the same pattern. [VERIFIED: plan-phase.md step 2]

```markdown
<!-- In step 2 "Parse and Normalize Arguments": -->
Extract from $ARGUMENTS: ..., `--acknowledge-sme-risk`

Set `ACKNOWLEDGE_SME_RISK=true` if `--acknowledge-sme-risk` is present in $ARGUMENTS.
```

The command file argument-hint must also be updated:

```markdown
<!-- commands/gsd/plan-phase.md -->
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>] [--reviews] [--text] [--tdd] [--acknowledge-sme-risk]"
```

### Pattern 3: Process Detection + Context Block Composition

The gate calls two SDK handlers in sequence: detect processes, then fetch context blocks. [VERIFIED: sme.ts source + registered commands in index.ts]

```bash
# Detect which processes this phase touches
PLAN_FILES=$(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | tr '\n' ' ')
PHASE_GOAL=$(gsd-sdk query roadmap.get-phase "${PHASE}" --pick goal 2>/dev/null || echo "")

SME_DETECT=$(gsd-sdk query sme.detect-processes \
  --file-paths ${PLAN_FILES} \
  --goal "${PHASE_GOAL}" 2>/dev/null || echo '{"data":{"enabled":false,"matches":[]}}')
```

Parse `SME_DETECT` JSON: `enabled`, `matches[]` (each has `process_name`, `block_mode`, `file`).

For each match, fetch its context block:
```bash
SME_CTX=$(gsd-sdk query sme.context-block "${process_name}" 2>/dev/null || echo "")
```

The context block is XML: `<sme_context process="..." block_mode="...">...</sme_context>`. [VERIFIED: sme.ts smeContextBlock return format]

### Pattern 4: Auditor Invocation (from agent-contracts.md + Task() pattern)

The auditor is spawned exactly like `gsd-plan-checker` — blocking Task, wait for return marker. [VERIFIED: agent-contracts.md, plan-phase.md step 10]

```markdown
<!-- Auditor prompt construction — GATE-08: SME blockers at top -->
Task(
  prompt="""
{SME_CONTEXT_BLOCKS}  ← inject all <sme_context> blocks FIRST (GATE-08)

PLAN.md path: {PHASE_DIR}/{padded_phase}-PLAN.md

Phase: {phase_name}
""",
  subagent_type="gsd-sme-auditor",
  model="{checker_model}",
  description="SME audit Phase {phase}"
)
```

**GATE-08 rationale:** Context window saturation is a real risk. If PLAN.md (which can be 10-30KB) is injected before the SME context blocks, the BLOCKERs may fall into the middle of a large context and receive less attention from the LLM. Injecting SME context first ensures BLOCKERs are prominent at the top of the working memory.

### Pattern 5: Return Marker Routing with block_mode

The gate must determine the effective block_mode. When multiple processes are detected, use the strictest mode across all matched SMEs: if any SME is `strict`, treat as `strict`. [ASSUMED — requirement text says "per-process config" but doesn't specify multi-process resolution; the safe choice is strictest-wins]

```markdown
## Handle ## SME_CONCERNS

Parse auditor return for ## SME_CONCERNS.

Determine EFFECTIVE_BLOCK_MODE:
- If any matched SME has block_mode: strict → EFFECTIVE_BLOCK_MODE=strict
- Else → EFFECTIVE_BLOCK_MODE=soft

**If `ACKNOWLEDGE_SME_RISK` is true:** Log risk acceptance and proceed to step 13.

**If `EFFECTIVE_BLOCK_MODE` is `soft`:**
Display concerns as warnings. Proceed to step 13.

**If `EFFECTIVE_BLOCK_MODE` is `strict`:**
Display concerns. Present:
AskUserQuestion(
  header: "SME Audit: BLOCKERs Found",
  question: "...",
  options:
    - "Acknowledge risk and proceed" — documented in STATE.md
    - "Revise plan" — return to step 8 for replanning
)
```

### Pattern 6: CONFIG-04 / GATE-07 No-SME Warning

When `sme.detect-processes` returns `matches: []`, the gate emits a non-blocking warning and skips to step 13. This handles both CONFIG-04 (no SME documents exist at all) and GATE-07 (processes detected but no SME file covers them). [VERIFIED: sme.ts graceful empty-dir handling; REQUIREMENTS.md CONFIG-04 note]

```markdown
**If `matches` is empty:**

Check if any SME documents exist at all:
```bash
SME_LIST=$(gsd-sdk query sme.list)
# parse enabled, smes[]
```

If `smes[]` is empty (CONFIG-04): Display:
```
◆ SME agents enabled but no SME documents exist yet.
  Create one: /gsd-create-sme [process-name]
  Skipping SME audit.
```

If `smes[]` is non-empty but no match (GATE-07): Display:
```
◆ No SME found for detected processes ({detected_process_list}).
  Create one: /gsd-create-sme {first_detected_process}
  Skipping SME audit.
```

Proceed to step 13 (never block).
```

### Pattern 7: CJS Structural Test Pattern (from tests/ directory)

Phase 6 tests follow the `plan-phase-ui-redirect.test.cjs` and `gates-taxonomy.test.cjs` patterns — read workflow markdown files and assert on content. [VERIFIED: tests/plan-phase-ui-redirect.test.cjs, tests/gates-taxonomy.test.cjs]

```javascript
// tests/sme-gate-plan-phase.test.cjs
'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');
const PLAN_PHASE_CMD = path.join(ROOT, 'commands', 'gsd', 'plan-phase.md');

describe('GATE-01: SME gate step 12.5 exists in plan-phase.md', () => {
  test('workflow contains step 12.5 SME Audit Gate heading', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      content.includes('12.5') && content.includes('SME Audit'),
      'plan-phase.md must contain a step 12.5 SME Audit Gate section'
    );
  });
});

describe('GATE-02: process detection via sme.detect-processes', () => {
  test('workflow calls sme.detect-processes', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(content.includes('sme.detect-processes'), ...);
  });
});

// ... one describe block per GATE-XX requirement
```

### Anti-Patterns to Avoid

- **Reading `block_mode` from SME frontmatter in the auditor:** The auditor ignores `block_mode` (it reports all findings regardless). Only the gate reads `block_mode` for routing. [VERIFIED: agents/gsd-sme-auditor.md critical_rules "BLOCK_MODE DOES NOT CHANGE YOUR OUTPUT"]
- **Using `sme.list` to inject SME content:** `sme.list` returns metadata only. Use `sme.context-block {process_name}` to get the full document wrapped in `<sme_context>` XML for the auditor.
- **Skipping the gate on `--skip-verify`:** The SME audit gate is separate from the plan-checker loop. `--skip-verify` only skips the plan-checker (step 10-12). The SME gate has its own skip mechanism (`workflow.use_sme_agents: false` or `--acknowledge-sme-risk`).
- **Placing PLAN.md path before SME context blocks in the auditor prompt:** Violates GATE-08. Inject `<sme_context>` blocks at the top of the prompt.
- **Blocking when no SME exists:** CONFIG-04 and GATE-07 are explicit — never block when no SME document exists. Only warn + provide `/gsd-create-sme` instructions.
- **Passing raw SME file content instead of using `sme.context-block`:** The `sme.context-block` handler wraps the document in the XML format the auditor expects. Bypassing it produces incorrectly formatted input.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SME document listing | Custom `readdir` + frontmatter parse in workflow | `gsd-sdk query sme.list` | Handler already implements this with config guard and graceful empty-dir handling (Phase 2) |
| Process detection | Keyword-matching shell script | `gsd-sdk query sme.detect-processes --file-paths ... --goal ...` | Handler already implements case-insensitive substring matching across all SME `process_name` fields (Phase 2) |
| Context block construction | `cat .planning/smes/X-SME.md` and manual XML wrapping | `gsd-sdk query sme.context-block {process_name}` | Handler produces the exact `<sme_context process="..." block_mode="...">...</sme_context>` format the auditor expects (Phase 2) |
| Severity routing | Re-parsing `## SME_CONCERNS` for BLOCKER count | Read `block_mode` from `sme.detect-processes` matches and route on the auditor's return marker | The auditor already counts and classifies; the gate only needs to know the marker and the block_mode |
| Strict-mode acknowledgment tracking | Custom STATE.md mutation | Log to output; record in STATE.md `## Accumulated Context` section using existing pattern | Keeping the gate simple; acknowledgment is a developer decision, not a system state |

---

## Common Pitfalls

### Pitfall 1: Gate Runs After Bounce, Not Before

**What goes wrong:** If step 12.5 is inserted after the current step 12.5 (plan bounce), the auditor reviews plans that may have been bounced/modified and not yet re-checked. The gate then approves plans that the bounce script has altered.

**Why it happens:** The step numbers in plan-phase.md are prose descriptions. "Step 12.5" is already used by the plan bounce feature.

**How to avoid:** Read the current plan-phase.md structure carefully. The current step 12.5 is "Plan Bounce (Optional External Refinement)". The SME audit gate must be inserted as a **new numbered step** placed after the bounce step and before step 13 (Requirements Coverage Gate). The planner must rename one step or renumber to avoid collision. The audit must run on the **final** plan files, after bounce.

**Warning signs:** Tests checking that the SME gate runs "between plan-checker and finalization" pass structurally but at runtime the gate runs on pre-bounce plans.

**Correct insertion:** The gate belongs at the end of the plan-checker/revision cycle, after bounce, immediately before step 13. It should be numbered 12.75 or the bounce step should be renumbered to 12.5 and the SME gate numbered 12.6. [VERIFIED: plan-phase.md step 12.5 is currently "Plan Bounce" — step numbering conflict must be resolved in planning]

### Pitfall 2: Using `checker_model` vs. a Dedicated `auditor_model`

**What goes wrong:** The gate spawns the auditor with the planner model or a hardcoded model name instead of the configured `checker_model`.

**Why it happens:** The `initPlanPhase` handler returns `checker_model` which is used for the plan-checker. The SME auditor is semantically similar (read-only reviewer). [VERIFIED: sdk/src/query/init.ts initPlanPhase returns checker_model]

**How to avoid:** Reuse `checker_model` for the SME auditor invocation. A separate `auditor_model` config field is not needed for v1.

### Pitfall 3: Multi-Process `block_mode` Resolution

**What goes wrong:** A phase touches two processes — one with `soft` block_mode and one with `strict`. The gate reads only the first match and applies `soft`, allowing BLOCKERs from the `strict` process to pass without user acknowledgment.

**Why it happens:** The `sme.detect-processes` returns a `matches` array. The gate must check block_mode across all matches, not just the first.

**How to avoid:** When multiple SMEs are matched, determine EFFECTIVE_BLOCK_MODE = `strict` if ANY match has `block_mode: strict`, else `soft`. This is the safe conservative approach. [ASSUMED — multi-process resolution not specified in requirements; strict-wins is the safest default]

**Warning signs:** Structural tests only check single-process scenarios. Add a test for the multi-process strict-wins case.

### Pitfall 4: Step 12.5 Numbering Conflict

**What goes wrong:** The plan-phase.md already uses `## 12.5. Plan Bounce` for the optional external refinement step. Inserting `## 12.5. SME Audit Gate` creates two steps with the same number, confusing structural tests and human readers.

**Why it happens:** The requirement says "step 12.5" but the step number is already taken.

**How to avoid:** In the PLAN.md, the planner must either: (a) renumber the bounce step to 12.4 and the SME gate to 12.5, or (b) keep bounce at 12.5 and add the SME gate as step 12.6. Option (b) is safer — it avoids renaming an existing step that tests reference. Confirm with the requirement text: GATE-01 says "after plan-checker, before finalization," which is satisfied by either 12.5 or 12.6 as long as the order is: plan-checker (10-12) → bounce (12.5) → SME gate (12.6) → requirements coverage (13).

**Warning signs:** Existing tests checking step numbers break after the gate is added.

### Pitfall 5: Missing `sme.context-block` per Process

**What goes wrong:** The gate calls `sme.detect-processes` and gets back 2 matched processes, but only calls `sme.context-block` for the first one. The auditor receives only one SME context and misses BLOCKERs from the second process.

**Why it happens:** Iterating over the `matches` array requires explicit loop logic in the workflow step.

**How to avoid:** The step must loop over all matches and accumulate context blocks. Concatenate all `<sme_context>` blocks before injecting them into the auditor prompt. [VERIFIED: auditor agent designed to accept multiple `<sme_context>` blocks — see gsd-sme-auditor.md step "load_context" which says "Extract all `<sme_context>` blocks from the prompt"]

### Pitfall 6: `--acknowledge-sme-risk` Not Extracted in Step 2

**What goes wrong:** The flag is documented in the argument-hint but not parsed in step 2's argument extraction block. The gate never sees it.

**Why it happens:** Step 2 extracts specific named flags. A new flag must be explicitly added.

**How to avoid:** The plan must include an explicit addition to step 2's argument parsing block to extract `--acknowledge-sme-risk` and set `ACKNOWLEDGE_SME_RISK` variable. Without this, the flag is silently ignored.

---

## Code Examples

### Gate Step Skeleton (verified against plan-phase.md patterns)

```markdown
<!-- Source: plan-phase.md step 5.55 (security gate pattern) + step 12.5 (bounce) [VERIFIED: repo] -->

## 12.6. SME Audit Gate

> Skip if `workflow.use_sme_agents` is not `true`.

```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```

**If `SME_AGENTS` is not `true`:** Skip to step 13.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SME AUDIT GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Detecting relevant processes...
```

### Detect processes

Collect file paths from PLAN.md frontmatter `files_modified` fields and the phase goal:

```bash
PLAN_FILES=$(grep -h "files_modified:" "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | tr ' ' '\n' | grep "^\s*-" | sed 's/^\s*-\s*//' | tr '\n' ' ')
PHASE_GOAL=$(gsd-sdk query roadmap.get-phase "${PHASE}" --pick goal 2>/dev/null || echo "")

SME_DETECT=$(gsd-sdk query sme.detect-processes --file-paths ${PLAN_FILES} --goal "${PHASE_GOAL}" 2>/dev/null || echo '{"data":{"enabled":false,"matches":[]}}')
```

Parse `SME_DETECT`: extract `enabled` and `matches[]`.

**If `enabled` is false:** Skip to step 13.

**If `matches` is empty:** [see GATE-07 / CONFIG-04 handling below]

### Fetch context blocks

```bash
SME_CONTEXT_BLOCKS=""
for match in ${matches}; do  # iterate matches array
  PROCESS_NAME=$(extract process_name from match)
  CTX=$(gsd-sdk query sme.context-block "${PROCESS_NAME}")
  # parse CTX.data.block
  SME_CONTEXT_BLOCKS="${SME_CONTEXT_BLOCKS}${block}"
done
```

### Spawn auditor

```
Task(
  prompt="""${SME_CONTEXT_BLOCKS}

PLAN.md path: ${PHASE_DIR}/${PADDED_PHASE}-PLAN.md

Phase: ${phase_name}
""",
  subagent_type="gsd-sme-auditor",
  model="${checker_model}",
  description="SME audit Phase ${PHASE}"
)
```

> **ORCHESTRATOR RULE**: After calling Task() above, stop working immediately. Wait for
> the subagent return before continuing.

### Route on return marker

**`## SME_APPROVED`:** Display approval, proceed to step 13.

**`## SME_CONCERNS`:** [see soft/strict routing pattern above]

**No marker / empty return:** Log warning. Offer: 1) Retry audit, 2) Skip audit, 3) Stop.

### GATE-07 / CONFIG-04: No SME documents

```bash
SME_LIST=$(gsd-sdk query sme.list)
# parse enabled, smes[]
```

If smes[] is empty:
```
◆ SME agents enabled but no SME documents exist yet.
  Create one with: /gsd-create-sme [process-name]
  Skipping SME audit for this phase.
```

If smes[] is non-empty but matches is empty:
```
◆ No SME found for processes detected in this phase ({detected}).
  Create one with: /gsd-create-sme {first_detected}
  Skipping SME audit for this phase.
```

Proceed to step 13. Never block.
```

### CJS Test Skeleton

```javascript
// Source: tests/plan-phase-ui-redirect.test.cjs, tests/gates-taxonomy.test.cjs [VERIFIED: repo]
// File: tests/sme-gate-plan-phase.test.cjs

'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');
const PLAN_PHASE_CMD = path.join(ROOT, 'commands', 'gsd', 'plan-phase.md');

describe('GATE-01: step 12.x SME audit gate position', () => {
  test('plan-phase.md contains SME Audit Gate heading', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      /SME Audit Gate/.test(content),
      'plan-phase.md must contain an SME Audit Gate step'
    );
  });

  test('SME Audit Gate appears after plan-checker and before requirements coverage', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const checkerIdx = content.indexOf('Spawn gsd-plan-checker');
    const smeGateIdx = content.indexOf('SME Audit Gate');
    const reqCoverageIdx = content.indexOf('Requirements Coverage Gate');
    assert.ok(checkerIdx < smeGateIdx, 'SME gate must appear after plan-checker');
    assert.ok(smeGateIdx < reqCoverageIdx, 'SME gate must appear before requirements coverage');
  });
});

describe('GATE-02: sme.detect-processes call', () => {
  test('plan-phase.md calls sme.detect-processes', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(content.includes('sme.detect-processes'), ...);
  });
});

describe('GATE-06 + GATE-01: --acknowledge-sme-risk flag', () => {
  test('command argument-hint includes --acknowledge-sme-risk', () => {
    const content = fs.readFileSync(PLAN_PHASE_CMD, 'utf-8');
    assert.ok(content.includes('--acknowledge-sme-risk'), ...);
  });

  test('plan-phase.md parses --acknowledge-sme-risk in step 2', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(content.includes('--acknowledge-sme-risk'), ...);
  });
});

describe('GATE-07 + CONFIG-04: no-SME warning never blocks', () => {
  test('plan-phase.md emits /gsd-create-sme instruction when no SME found', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(content.includes('/gsd-create-sme'), ...);
  });

  test('plan-phase.md does not block when no SME documents exist', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    // The no-SME path must lead to "proceed to step 13" or "skip", never AskUserQuestion
    const noSMESection = extractNoSMESection(content); // extract relevant block
    assert.ok(!noSMESection.includes('AskUserQuestion'), ...);
  });
});

describe('GATE-08: SME context blocks injected before PLAN.md path', () => {
  test('auditor prompt template places SME context blocks before PLAN.md path', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const smeCtxIdx = content.indexOf('SME_CONTEXT_BLOCKS');
    const planPathIdx = content.indexOf('PLAN.md path:');
    assert.ok(smeCtxIdx < planPathIdx, 'SME context blocks must appear before PLAN.md path in prompt');
  });
});
```

### Gates Matrix Update

The `get-shit-done/references/gates.md` Gate Matrix must be updated to include the SME Audit Gate row:

```markdown
| plan-phase | Step 12.x | Escalation | SME BLOCKERs in PLAN.md | Soft: warn + proceed; Strict: halt until acknowledged |
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No domain-safety check at plan time | SME auditor reviews PLAN.md against domain knowledge before finalization | Phase 6 (this phase) | Domain risks are caught before execution, not after |
| Plan-checker is the only gate between planner and executor | Two gates: plan-checker (structural completeness) + SME auditor (domain safety) | Phase 6 | Different concerns separated into purpose-built agents |
| `block_mode: soft` was defined but unused | `block_mode` read from matched SME frontmatter and enforced by gate | Phase 6 | Per-process risk tolerance is now actionable |

**Deprecated/outdated:**
- Nothing deprecated by Phase 6. This phase adds new behavior under `use_sme_agents: false` (which keeps existing behavior unchanged).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The SME gate should be numbered 12.6 (after the existing bounce step 12.5) to avoid renaming an existing step | Common Pitfalls (Pitfall 4) | If the gate is instead given number 12.5 by renumbering bounce to 12.4, existing tests that reference bounce by step number will break; strict numbering requires confirmation |
| A2 | Multi-process block_mode resolution uses strict-wins: if any matched SME is strict, treat as strict | Pattern 5 | If the project uses soft for most processes but strict for one critical one, strict-wins is correct; but if the intent is per-process independent halting, the gate should halt only on BLOCKERs from the strict-mode SME, not all SMEs |
| A3 | `checker_model` (from initPlanPhase) is reused for the SME auditor — no separate `auditor_model` config key is needed for v1 | Standard Stack | If the SME auditor benefits from a more powerful model (deeper reasoning), a dedicated config field would allow separate tuning; for v1, reusing checker_model is simpler |
| A4 | The gate emits a single non-blocking warning for both CONFIG-04 and GATE-07 (no SME found cases) | Pattern 6 | CONFIG-04 and GATE-07 are logically identical from the gate's perspective (no SME document to use); if they need different messages, the implementation needs to distinguish them |
| A5 | File path extraction from PLAN.md frontmatter `files_modified` is sufficient for process detection | Architecture diagram | If `sme.detect-processes` needs richer context (phase keywords, file paths from tasks not frontmatter), the extraction step may need enhancement; the SDK handler accepts both `--file-paths` and `--goal` |

---

## Open Questions (RESOLVED)

1. **Step numbering: 12.5 vs 12.6** (RESOLVED)
   - What we know: `## 12.5. Plan Bounce` exists at that step position in plan-phase.md
   - What's unclear: Should the SME gate replace bounce at 12.5 (renumbering bounce), or should it be 12.6?
   - Recommendation: The gate requirement says "after plan-checker, before finalization" — any number in that range is acceptable. Use 12.6 to avoid touching the bounce step numbering. The plan should make this choice explicit.
   - **Resolution:** Use step 12.6. The existing step 12.5 (Plan Bounce) has tests referencing its number. Adding the SME gate as 12.6 avoids breaking existing tests while satisfying the positional requirement (after plan-checker, before finalization). REQUIREMENTS.md GATE-01 updated with implementation note.

2. **Multi-process auditing: one Task call or multiple?** (RESOLVED)
   - What we know: The auditor is designed to accept multiple `<sme_context>` blocks in one call (gsd-sme-auditor.md says "Extract all `<sme_context>` blocks from the prompt")
   - What's unclear: Whether concatenating multiple context blocks into one Task call is more reliable than calling the auditor once per process
   - Recommendation: Single Task call with all context blocks concatenated (GATE-08 prompt construction). This is simpler and the auditor explicitly supports it.
   - **Resolution:** Single Task call with all context blocks concatenated. The auditor explicitly supports multiple `<sme_context>` blocks in one prompt. This is simpler, uses less context budget, and keeps the gate logic straightforward.

3. **Risk acknowledgment persistence** (RESOLVED)
   - What we know: When the user acknowledges strict-mode risk, the gate proceeds. REQUIREMENTS.md doesn't specify how this is recorded.
   - What's unclear: Should acknowledgment be written to STATE.md or just logged to output?
   - Recommendation: Log to terminal output and include a note in the phase's PLAN.md or CONTEXT.md. No STATE.md mutation required for v1 — the audit output is preserved in the terminal history.
   - **Resolution:** Log to terminal output only. No STATE.md mutation for v1. The acknowledgment is visible in session history and the gate proceeds without persisted state. If persistence is needed later, it can be added without breaking the gate contract.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 delivers workflow markdown edits and CJS structural tests. No external dependencies beyond the existing project toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | CJS tests, SDK handlers | Yes | v22+ | — |
| gsd-sdk (built) | Workflow bash commands | Yes | in-repo | — |
| agents/gsd-sme-auditor.md | Gate Task() invocation | Yes (Phase 5 complete) | — | — |
| sme.detect-processes | GATE-02 | Yes (Phase 2 complete) | — | — |
| sme.context-block | GATE-03 | Yes (Phase 2 complete) | — | — |
| sme.list | CONFIG-04/GATE-07 | Yes (Phase 2 complete) | — | — |

**All dependencies are satisfied.** Phase 6 has no blocking prerequisites.

---

## Validation Architecture

nyquist_validation is enabled (`workflow.nyquist_validation: true` in config). [VERIFIED: .planning/config.json]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (CJS .test.cjs files in `tests/`) |
| Config file | none — tests run with `node --test tests/sme-gate-plan-phase.test.cjs` |
| Quick run command | `node --test tests/sme-gate-plan-phase.test.cjs` |
| Full suite command | `npm test` (in repo root) |

Note: All existing `tests/*.test.cjs` files use the Node.js built-in test runner (`require('node:test')`), NOT Vitest. Structural tests for plan-phase workflow go in `tests/`, while structural tests for agent/SDK files go in `sdk/src/agents/`. [VERIFIED: tests/plan-phase-ui-redirect.test.cjs, tests/gates-taxonomy.test.cjs]

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GATE-01 | Step 12.x SME audit gate exists after plan-checker | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |
| GATE-01 | Gate position: after plan-checker, before requirements coverage | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |
| GATE-02 | Gate calls sme.detect-processes | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |
| GATE-03 | Gate spawns gsd-sme-auditor | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |
| GATE-04 | Soft mode: warning + proceed path exists | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |
| GATE-05 | Strict mode: halt + AskUserQuestion path exists | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |
| GATE-06 | `--acknowledge-sme-risk` flag in argument-hint + step 2 | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |
| GATE-07 | No SME found → warn + /gsd-create-sme → never block | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |
| GATE-08 | SME context blocks injected before PLAN.md path in prompt | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |
| CONFIG-04 | No SME documents → warning + /gsd-create-sme → never block | structural | `node --test tests/sme-gate-plan-phase.test.cjs` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/sme-gate-plan-phase.test.cjs`
- **Per wave merge:** `npm test` (full CJS suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/sme-gate-plan-phase.test.cjs` — covers all 9 GATE-XX requirements + CONFIG-04

*(The existing structural tests in `sdk/src/agents/sme-auditor-structure.test.ts` cover the auditor agent itself — that is a Phase 5 artifact already passing. Phase 6 tests focus on the workflow integration.)*

---

## Security Domain

`security_enforcement` is not set to false in config — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Internal developer tool, no auth surface |
| V3 Session Management | No | Agent sessions managed by SDK |
| V4 Access Control | No | No multi-user access model |
| V5 Input Validation | Yes | Phase goal and file paths from PLAN.md frontmatter are developer-authored project files — same project trust level as established in T-02-02 (Phase 2 security decision); process name validation (`[a-zA-Z0-9_-]+`) already enforced upstream in `sme.context-block` |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via SME content in auditor prompt | Tampering | SME documents are developer-authored project files at project trust level — T-02-02 decision from Phase 2 [VERIFIED: sme.ts comment] |
| Path traversal via process_name in context-block call | Tampering | `sme.context-block` validates process_name and only reads from `.planning/smes/` with filenames returned by `readdir` — no user-supplied path segments [VERIFIED: sme.ts T-02-01 comment] |
| Strict-mode bypass via `--acknowledge-sme-risk` flag | Information Disclosure | Flag is a developer-level override; risk is logged to output so it is visible; acceptable for developer tool |

**Established security decisions (from prior phases):**
- SME document content treated at project-file trust level (T-02-02) — no additional sanitization needed
- Process name uses `[a-zA-Z0-9_-]+` validation in SDK (enforced before path construction)

---

## Sources

### Primary (HIGH confidence)

- `get-shit-done/workflows/plan-phase.md` — full step-by-step workflow; insertion point and flag patterns confirmed [VERIFIED: repo]
- `commands/gsd/plan-phase.md` — command file; argument-hint format confirmed [VERIFIED: repo]
- `agents/gsd-sme-auditor.md` — auditor agent frontmatter, tool list, return markers [VERIFIED: repo]
- `get-shit-done/references/agent-contracts.md` — SME auditor output contract and regex patterns [VERIFIED: repo]
- `sdk/src/query/sme.ts` — smeDetectProcesses, smeContextBlock, smeList implementations; return shapes confirmed [VERIFIED: repo]
- `sdk/src/query/index.ts` — handler registrations (`sme.list`, `sme.detect-processes`, `sme.context-block`) confirmed [VERIFIED: repo]
- `sdk/src/query/init.ts` (initPlanPhase) — `checker_model` available for auditor invocation; no `use_sme_agents` currently exposed [VERIFIED: repo]
- `sdk/src/config.ts` — `use_sme_agents: boolean` typed, defaults to `false` [VERIFIED: repo]
- `.planning/config.json` — `workflow.use_sme_agents: false`, `sme.blocking: soft`, `sme.processes.payments.block_mode: strict` confirmed [VERIFIED: repo]
- `tests/plan-phase-ui-redirect.test.cjs` — CJS structural test pattern for plan-phase.md [VERIFIED: repo]
- `tests/gates-taxonomy.test.cjs` — CJS structural test pattern for references/gates.md [VERIFIED: repo]
- `get-shit-done/references/gates.md` — Gate taxonomy (Escalation Gate for strict-mode halt) [VERIFIED: repo]
- `.planning/REQUIREMENTS.md` — GATE-01 through GATE-08 and CONFIG-04 requirement text [VERIFIED: repo]
- `sdk/src/agents/sme-auditor-structure.test.ts` — 16 tests passing GREEN (Phase 5 complete) [VERIFIED: vitest run]

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — Phase 5 execution status and security decisions
- `.planning/phases/05-sme-auditor-agent/05-01-PLAN.md` — auditor agent structure details
- `.planning/phases/02-sdk-query-handlers/02-RESEARCH.md` — SDK handler architecture
- `docs/CONFIGURATION.md` — `sme.blocking` and `sme.processes` config documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against installed versions and repo scan
- Architecture: HIGH — insertion point, flag patterns, and SDK handler shapes all verified from repo
- Pitfalls: HIGH — sourced from plan-phase.md step numbering conflict (discovered via direct file read) and auditor-block_mode boundary (verified in agent-contracts.md)
- Test patterns: HIGH — verified from 3 existing structural test files in tests/ directory

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days — stable workflow patterns, stable project conventions)
