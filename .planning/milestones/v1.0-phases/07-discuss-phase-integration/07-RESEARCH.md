# Phase 7: Discuss-Phase Integration - Research

**Researched:** 2026-04-30
**Domain:** Workflow markdown integration, progressive disclosure pattern, SME context injection into discuss-phase
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISCUSS-01 | Before plan-phase, discuss-phase checks whether `milestone.active_smes` is populated in STATE.md | `frontmatter.get` query reads STATE.md frontmatter directly; `active_smes` field written by Phase 8 as nested YAML under `milestone` key [VERIFIED: sdk/src/query/frontmatter.ts, sdk/src/query/index.ts] |
| DISCUSS-02 | If active SMEs exist, spawn `gsd-sme-auditor` with SME context to generate domain-specific probing questions | `gsd-sme-auditor.md` exists; `sme.context-block` produces XML blocks; auditor receives a different prompt (questions mode, not plan-audit mode) [VERIFIED: agents/gsd-sme-auditor.md, sdk/src/query/sme.ts] |
| DISCUSS-03 | Append SME insights to `{phase_num}-CONTEXT.md` under a `<sme_context>` block, visible to the planner | CONTEXT.md template (`workflows/discuss-phase/templates/context.md`) is written by `write_context` step; template must be updated to include `<sme_context>` section [VERIFIED: discuss-phase.md, context.md template] |

</phase_requirements>

---

## Summary

Phase 7 adds an SME awareness step to the discuss-phase workflow. When `workflow.use_sme_agents` is true and the STATE.md frontmatter has active SMEs queued (set by Phase 8), the discuss-phase spawns the `gsd-sme-auditor` in a probing-question mode before the standard gray-area discussion. The auditor reads the relevant SME documents via `sme.context-block` and returns domain-specific risk questions. Those questions are injected into the discussion as pre-loaded risk areas, and a `<sme_context>` block is written into CONTEXT.md so the planner can see which domain risks were surfaced.

The deliverables are: (1) a new lazy-loaded step file (`workflows/discuss-phase/sme-step.md`) containing the SME check logic, (2) a minimal reference added to `discuss-phase.md` that lazy-loads the file at the correct point, (3) an update to `workflows/discuss-phase/templates/context.md` to include the `<sme_context>` output section, and (4) structural tests in `tests/sme-discuss-phase.test.cjs`. The phase uses zero new npm packages — all infrastructure (auditor agent, SDK query handlers) is in place from Phases 2 and 5.

**Critical constraint:** `discuss-phase.md` is gated by a `< 500 line` budget (test: `workflow-size-budget.test.cjs`, line 104, `lines < DISCUSS_PHASE_TARGET`). It is currently 497 lines. All SME logic must be extracted to `workflows/discuss-phase/sme-step.md` (lazy-loaded) to stay under budget. Adding even 3 inline lines requires the existing progressive-disclosure pattern (a reference + lazy Read call).

**Primary recommendation:** Add one reference line to `discuss-phase.md` dispatching to a new `discuss-phase/sme-step.md` file, implement the full SME check logic there, add the `<sme_context>` section to the context template, and cover all three requirements with CJS structural tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `use_sme_agents` feature guard | SDK Layer (`config-get`) | Orchestration Layer | Same pattern as plan-phase step 12.6 and all other opt-in gates |
| Read `milestone.active_smes` from STATE.md | SDK Layer (`frontmatter.get`) | — | `frontmatter.get .planning/STATE.md` returns raw parsed frontmatter including nested fields; `state.json` rebuilds frontmatter from body and does NOT pass through custom fields like `active_smes` |
| Fetch SME context blocks | SDK Layer (`sme.context-block`) | — | Implemented in Phase 2; returns `<sme_context process="..." block_mode="...">` XML block |
| Auditor invocation (probing-questions mode) | Orchestration Layer (`sme-step.md`) | Agent Layer (`gsd-sme-auditor.md`) | Auditor receives a different prompt: SME context blocks + phase goal, no PLAN.md; asked to produce probing questions not plan-gap findings |
| Inject risk questions into discussion | Orchestration Layer (`discuss-phase.md`) | — | Questions returned by auditor are added as pre-loaded gray areas before the user's standard area selection |
| Write `<sme_context>` to CONTEXT.md | Orchestration Layer (`discuss-phase.md` write_context step) | Template Layer (`templates/context.md`) | The CONTEXT.md template is lazy-loaded during `write_context`; the `<sme_context>` block is appended when SME risks were surfaced |
| Progressive disclosure enforcement | Presentation Layer (workflow-size-budget.test.cjs) | — | Enforces `discuss-phase.md < 500 lines`; all new logic must go in the lazy-loaded `sme-step.md` |

---

## Standard Stack

### Core (already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Markdown + YAML frontmatter | N/A | Workflow and agent definition format | All GSD workflows use this format [VERIFIED: repo scan] |
| `gsd-sdk query frontmatter.get` | N/A | Read `milestone.active_smes` from STATE.md frontmatter | Registered in `sdk/src/query/index.ts` line 283; reads raw YAML including nested fields [VERIFIED: sdk/src/query/frontmatter.ts] |
| `gsd-sdk query sme.context-block` | N/A (SDK-03) | Fetch XML context block per active SME | Implemented in Phase 2; returns `<sme_context process="..." block_mode="...">` [VERIFIED: sdk/src/query/sme.ts line 296] |
| `gsd-sdk query config-get` | N/A | Read `workflow.use_sme_agents` feature flag | Same pattern as plan-phase gate step 12.6 [VERIFIED: plan-phase.md line 1283] |
| `agents/gsd-sme-auditor.md` | N/A (Phase 5) | Reused in probing-questions mode | Agent exists with adversarial stance; receives different prompt (phase goal + SME context, no PLAN.md) for question generation [VERIFIED: agents/gsd-sme-auditor.md] |

### No New Packages Required

Phase 7 delivers workflow markdown changes, a template update, and CJS structural tests. Zero new npm installs.

---

## Architecture Patterns

### System Architecture Diagram

```
discuss-phase.md orchestrator
    │
    │ load_prior_context: cat STATE.md (reads active_smes in body as prior context)
    │
    │ [NEW: sme_check step — lazy-loads sme-step.md]
    │
    ▼
workflows/discuss-phase/sme-step.md
    │
    │ 1. Read use_sme_agents config flag → skip if false
    │ 2. frontmatter.get .planning/STATE.md → extract milestone.active_smes[]
    │    → skip if empty (Phase 8 not yet run, or no SMEs queued)
    │ 3. sme.context-block per active SME → collect XML blocks
    │    → skip gracefully if block not found (never block)
    │ 4. Task(gsd-sme-auditor, prompt=XML blocks + phase goal,
    │         mode="probing-questions")
    │    → returns probing questions (not ## SME_APPROVED/CONCERNS markers)
    │ 5. Store questions as sme_risk_areas for injection into gray-area list
    │
    ▼
discuss-phase.md continues: analyze_phase, present_gray_areas
    │
    │ sme_risk_areas injected as pre-loaded domain risk areas
    │
    ▼
write_context step
    │
    │ If sme_risk_areas exist: append <sme_context> block to CONTEXT.md
    │                          lists risk questions surfaced by auditor
    ▼
{phase_num}-CONTEXT.md
    └── <sme_context> block (read by planner to see domain risks surfaced)
```

### Recommended Project Structure

```
get-shit-done/workflows/
├── discuss-phase.md          # MODIFIED — add ≤3 lines referencing sme-step.md at correct step
└── discuss-phase/
    ├── modes/                # existing — no changes needed
    ├── templates/
    │   └── context.md        # MODIFIED — add <sme_context> section (conditional)
    └── sme-step.md           # NEW — full SME check logic (lazy-loaded)

tests/
└── sme-discuss-phase.test.cjs  # NEW — structural tests for DISCUSS-01, -02, -03
```

### Pattern 1: Config-Gated Step (from plan-phase.md step 12.6)

**What:** Read `workflow.use_sme_agents` flag first; skip the entire step when false.
**When to use:** Every SME feature entry point.
**Example:**
```bash
# Source: get-shit-done/workflows/plan-phase.md line 1283
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
# If SME_AGENTS is not true: skip entirely
```

### Pattern 2: Read STATE.md Frontmatter for Custom Fields (NOT state.json)

**What:** Use `frontmatter.get .planning/STATE.md` to read raw YAML frontmatter including nested custom fields like `milestone.active_smes`. Do NOT use `state.json` — that handler rebuilds frontmatter from body scanning and does not preserve custom fields.
**When to use:** Any workflow step that reads `active_smes` or future custom frontmatter fields.
**Example:**
```bash
# Source: sdk/src/query/frontmatter.ts frontmatterGet handler (VERIFIED)
STATE_FM=$(gsd-sdk query frontmatter.get .planning/STATE.md 2>/dev/null || echo '{}')
# Parse: active_smes is nested under 'milestone' key in YAML frontmatter:
#   milestone:
#     active_smes:
#       - payments
#       - auth
# Extract with: echo "$STATE_FM" | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(d.get('milestone',{}).get('active_smes',[])))"
# Or jq: echo "$STATE_FM" | jq -r '.data.milestone.active_smes[]? // empty'
```

### Pattern 3: Lazy-Load a New Step File (Progressive Disclosure)

**What:** When `discuss-phase.md` is at budget limit (< 500 lines), add new step logic to a separate file under `discuss-phase/` and reference it with a single dispatch line.
**When to use:** Any new substantive step for discuss-phase; the main file cannot exceed 499 lines.
**Example:**
```markdown
<!-- In discuss-phase.md, inside the correct step position: -->
| `use_sme_agents: true` AND active SMEs exist | `workflows/discuss-phase/sme-step.md` |
<!-- OR inline in the process steps: -->
If `use_sme_agents` is true: `Read(workflows/discuss-phase/sme-step.md)` and execute its steps.
```

### Pattern 4: Repurposing the Auditor for Probing Questions

**What:** The `gsd-sme-auditor` agent was designed to audit PLAN.md against SME risks. For discuss-phase, it is spawned with a **different prompt**: SME context blocks + the phase goal (no PLAN.md path). The prompt instructs it to produce domain-specific probing questions for the user, not plan-gap findings.
**When to use:** In the `sme-step.md` Task() invocation.
**Example:**
```
Task(
  prompt="""${SME_CONTEXT_BLOCKS}

Phase goal: ${PHASE_GOAL}

Your task is different from a plan audit: instead of reviewing a PLAN.md,
generate 3-5 domain-specific probing questions that the user MUST answer
before planning to surface hidden risks from the SME findings above.

Focus on the highest-severity findings (BLOCKERs first).
Return questions as a numbered list — no markers like SME_APPROVED or SME_CONCERNS.
""",
  subagent_type="gsd-sme-auditor"
)
```

### Pattern 5: Appending Conditional Section to CONTEXT.md Template

**What:** The `context.md` template uses conditional comment markers. The `<sme_context>` block is included only when SME risks were surfaced.
**When to use:** In the `write_context` step, if `sme_risk_areas` is non-empty.
**Example (template addition):**
```markdown
[If sme_risk_areas exist (SME check ran and produced questions):]
<sme_context>
## SME Domain Risks Surfaced

Domain-specific risks from active SME documents, surfaced during discussion.
The planner must address these risks in the plan.

{numbered list of probing questions/risk areas surfaced by the auditor}

**Active SMEs:** {list of process names}
</sme_context>
```

### Anti-Patterns to Avoid

- **Adding inline logic to discuss-phase.md:** Budget is `< 500 lines` (currently 497). Any addition beyond 2 lines fails `workflow-size-budget.test.cjs`. All logic must go in `discuss-phase/sme-step.md`.
- **Using `state.json` to read `active_smes`:** `state.json` rebuilds frontmatter from body scanning — it does NOT pass through custom frontmatter fields like `milestone.active_smes`. Use `frontmatter.get .planning/STATE.md` instead.
- **Using `state.get "active_smes"` to read the field:** `state.get` uses regex to match `**field:**` and `field:` patterns in the body text — it does NOT read YAML frontmatter. The `active_smes` field lives in frontmatter, not the body.
- **Blocking when no active SMEs exist:** DISCUSS-01 checks a precondition; if the field is absent or empty, silently skip the SME step and proceed normally. Never block discuss-phase.
- **Blocking when a context block is not found for an active SME:** Gracefully skip that SME with a warning (same as GATE-07 pattern). Never halt the discussion.
- **Returning `## SME_APPROVED` or `## SME_CONCERNS` markers in the probing-questions invocation:** The auditor produces these markers when auditing a PLAN.md. In the probing-questions mode, the prompt explicitly asks for a numbered question list — the workflow should NOT attempt to route on SME_APPROVED/SME_CONCERNS markers.
- **Duplicating the test infrastructure between CJS tests and Vitest:** All structural tests for workflow `.md` files follow the `tests/*.test.cjs` pattern (Node.js built-in test runner), not Vitest. Only `sdk/src/` tests use Vitest.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Read STATE.md frontmatter | Custom `cat \| grep` | `gsd-sdk query frontmatter.get .planning/STATE.md` | Handles workstream scoping, nested YAML, null-byte guard [VERIFIED: sdk/src/query/frontmatter.ts] |
| Produce SME XML block | Custom string template | `gsd-sdk query sme.context-block {process}` | Handles missing files gracefully, correct attribute escaping [VERIFIED: sdk/src/query/sme.ts line 296] |
| Feature flag check | Hardcoded conditional | `gsd-sdk query config-get workflow.use_sme_agents --raw` | Consistent with all other opt-in gates in plan-phase.md [VERIFIED: plan-phase.md step 12.6] |
| Probing question generation | Inline risk summarization logic | `Task(gsd-sme-auditor, probing-questions prompt)` | Auditor already reads SME format and understands severity calibration; inline summarization is brittle |

**Key insight:** Phase 7 is almost entirely orchestration markdown — it wires existing infrastructure (Phase 2 SDK handlers + Phase 5 auditor) into discuss-phase. The only new artifact is the step file (`sme-step.md`) and template update. This is the same pattern as Phase 6 (which wired the same components into plan-phase).

---

## Common Pitfalls

### Pitfall 1: Discuss-Phase Budget Test Failure

**What goes wrong:** Content is added inline to `discuss-phase.md`, pushing it to 500+ lines. `workflow-size-budget.test.cjs` fails: `discuss-phase.md has N lines — must be under 500 per #2551`.

**Why it happens:** The test asserts `lines < DISCUSS_PHASE_TARGET` (strictly less than 500). The file is currently 497 lines — 2 lines of headroom. Even minimal additions overflow the budget.

**How to avoid:** All new logic goes in `get-shit-done/workflows/discuss-phase/sme-step.md`. The only modification to `discuss-phase.md` is adding the dispatch reference (1-2 lines in the progressive-disclosure table and/or a `Read(...)` call at the correct step). If the dispatch reference causes overflow, reduce the file elsewhere or bump `DISCUSS_PHASE_TARGET` with a justification comment.

**Warning signs:** `node --test tests/workflow-size-budget.test.cjs` fails with "exceeds budget".

### Pitfall 2: Reading `active_smes` with the Wrong Query

**What goes wrong:** Workflow uses `gsd-sdk query state.json` to read `active_smes`. The field is absent because `state.json` rebuilds frontmatter from body scanning and does NOT preserve custom frontmatter fields. Phase 8's DETECT-05 writes `active_smes` to the STATE.md YAML frontmatter, but `state.json` never surfaces it.

**Why it happens:** `state.json` is the standard way to read STATE.md metadata — but it uses `buildStateFrontmatter()` which derives fields from body content + disk scanning. It explicitly does NOT forward arbitrary frontmatter fields.

**How to avoid:** Use `gsd-sdk query frontmatter.get .planning/STATE.md` to read raw frontmatter JSON. Then extract: `jq -r '.data.milestone.active_smes[]? // empty'` to get the list.

**Warning signs:** SME step silently skips when `use_sme_agents: true` and SMEs are queued — because `active_smes` comes back empty.

### Pitfall 3: CONTEXT.md Template Not Updated

**What goes wrong:** The `write_context` step correctly collects `sme_risk_areas` but the CONTEXT.md template (`templates/context.md`) has no `<sme_context>` section. The block is never written to the output file. The planner never sees the domain risks.

**Why it happens:** The CONTEXT.md template is lazy-loaded at write time and is the canonical source for what sections exist. If the template doesn't include the conditional `<sme_context>` block, the write step has nothing to emit.

**How to avoid:** Update `workflows/discuss-phase/templates/context.md` to include a conditional `<sme_context>` section with the same conditional comment pattern as `<spec_lock>` ("include only when X"). The test for DISCUSS-03 should verify both the template and the workflow.

**Warning signs:** Structural tests for DISCUSS-03 pass (workflow references `sme_context`) but `{phase_num}-CONTEXT.md` files are missing the block at runtime.

### Pitfall 4: New `sme-step.md` Mode File Fails the Mode-Existence Test

**What goes wrong:** The new file is added to `discuss-phase/` but the `workflow-size-budget.test.cjs` mode-existence test at line 117 (which checks for `power`, `all`, `auto`, `chain`, `text`, `batch`, `analyze`, `default`, `advisor`) is not affected. However, if a mode named `sme` appears in the dispatch table without a corresponding mode file in `modes/`, or if tests are added to check the new file exists, the file location must match.

**How to avoid:** `sme-step.md` is NOT a mode file — it is a step sub-workflow. Place it directly under `discuss-phase/sme-step.md` (not in `discuss-phase/modes/`). It is not accessed via `--sme` flag dispatch; it is unconditionally lazy-loaded when the SME feature gate is true.

**Warning signs:** None expected from existing tests. The new tests (DISCUSS-01..03) will verify the file exists at the correct path.

### Pitfall 5: Confusing Auditor Output Modes (Plan-Audit vs. Probing-Questions)

**What goes wrong:** The plan-phase gate logic (routing on `## SME_APPROVED` / `## SME_CONCERNS`) is copy-pasted into the discuss-phase step. The auditor prompt includes a PLAN.md path. The auditor returns plan-audit findings instead of probing questions.

**Why it happens:** The auditor has one documented behavior (plan audit) but is being used in a new role. The prompt is the only differentiator — the agent's behavior is controlled entirely by what it receives.

**How to avoid:** The `sme-step.md` prompt must explicitly: (1) omit any PLAN.md path, (2) tell the auditor its role is question generation, (3) ask for a numbered list format. The routing logic must NOT look for `## SME_APPROVED` / `## SME_CONCERNS` — it captures the numbered question list as text.

**Warning signs:** `sme-step.md` contains references to `SME_APPROVED` or `SME_CONCERNS`.

---

## Code Examples

### Check Config Flag (Pattern from Step 12.6)
```bash
# Source: get-shit-done/workflows/plan-phase.md line 1283 [VERIFIED]
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
# If SME_AGENTS is not "true": skip entire sme-step.md logic
```

### Read active_smes from STATE.md Frontmatter
```bash
# Source: sdk/src/query/frontmatter.ts frontmatterGet handler [VERIFIED]
STATE_FM=$(gsd-sdk query frontmatter.get .planning/STATE.md 2>/dev/null || echo '{"data":{}}')
ACTIVE_SMES=$(echo "$STATE_FM" | python3 -c "
import json, sys
d = json.load(sys.stdin)
data = d.get('data', d)  # frontmatter.get returns { data: {...frontmatter} }
smes = data.get('milestone', {}).get('active_smes', [])
print('\n'.join(smes) if isinstance(smes, list) else '')
" 2>/dev/null || echo "")
# If ACTIVE_SMES is empty: skip (Phase 8 not yet run, or no SMEs queued for this milestone)
```

### Fetch Context Blocks for Active SMEs
```bash
# Source: sdk/src/query/sme.ts smeContextBlock [VERIFIED]
SME_CONTEXT_BLOCKS=""
for PROCESS_NAME in $ACTIVE_SMES; do
  CTX=$(gsd-sdk query sme.context-block "${PROCESS_NAME}" 2>/dev/null || echo '{"data":{"found":false}}')
  FOUND=$(echo "$CTX" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('found', False))" 2>/dev/null || echo "False")
  if [ "$FOUND" = "True" ]; then
    BLOCK=$(echo "$CTX" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('block',''))" 2>/dev/null || echo "")
    SME_CONTEXT_BLOCKS="${SME_CONTEXT_BLOCKS}${BLOCK}"
  fi
done
# If SME_CONTEXT_BLOCKS is empty: skip or warn; never block
```

### Spawn Auditor in Probing-Questions Mode
```
# Source: discuss-phase/sme-step.md (new file — analogous to plan-phase.md Task invocation)
Task(
  prompt="""${SME_CONTEXT_BLOCKS}

Phase goal: ${PHASE_GOAL}

Your role here is DIFFERENT from a plan audit: there is no PLAN.md to review.
Instead, produce 3-5 domain-specific probing questions that surface the highest-severity
risks from the SME findings above. The user will answer these during the discussion.

Focus on BLOCKERs first, then WARNINGs. Format as a numbered list. No ## markers.
""",
  subagent_type="gsd-sme-auditor",
  description="SME probing questions Phase ${PHASE}"
)
```

### Structural Test Pattern (from sme-gate-plan-phase.test.cjs)
```javascript
// Source: tests/sme-gate-plan-phase.test.cjs [VERIFIED — existing pattern]
'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DISCUSS_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'discuss-phase.md');
const SME_STEP = path.join(ROOT, 'get-shit-done', 'workflows', 'discuss-phase', 'sme-step.md');
const CONTEXT_TPL = path.join(ROOT, 'get-shit-done', 'workflows', 'discuss-phase', 'templates', 'context.md');

describe('DISCUSS-01: discuss-phase checks for active_smes in STATE.md', () => {
  test('sme-step.md uses frontmatter.get to read STATE.md', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('frontmatter.get') && content.includes('STATE.md'),
      'sme-step.md must call frontmatter.get on STATE.md to read active_smes');
  });
});

describe('DISCUSS-02: auditor generates probing questions from SME context', () => {
  test('sme-step.md calls sme.context-block per active SME', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('sme.context-block'),
      'sme-step.md must call sme.context-block to fetch SME context');
  });
  test('sme-step.md spawns gsd-sme-auditor', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('gsd-sme-auditor'),
      'sme-step.md must reference gsd-sme-auditor for probing questions');
  });
});

describe('DISCUSS-03: sme_context block appended to CONTEXT.md', () => {
  test('context.md template includes <sme_context> section', () => {
    const content = fs.readFileSync(CONTEXT_TPL, 'utf-8');
    assert.ok(content.includes('sme_context'),
      'context.md template must include a <sme_context> section for SME insights');
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Discuss-phase is SME-unaware | Discuss-phase surfaces domain risks before planning | Phase 7 (this phase) | Domain-specific risk questions surface early, before the user locks planning decisions |
| SME auditor used only at plan-phase gate | Auditor reused in probing-questions mode for discuss-phase | Phase 7 (this phase) | Same agent infrastructure, different prompt — avoids building a separate question-generation agent |
| CONTEXT.md has no SME knowledge | CONTEXT.md gains a `<sme_context>` block with risk questions | Phase 7 (this phase) | Planner can see which domain risks were surfaced during discussion |
| `state.json` used for all STATE.md reading | `frontmatter.get` used for custom frontmatter fields | Phase 7 (this phase) | `state.json` rebuilds from body scan; `frontmatter.get` reads raw YAML including nested custom fields |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `milestone.active_smes` is stored as a nested YAML key in STATE.md YAML frontmatter (not as body text) | Architecture Patterns, Code Examples | If Phase 8 writes active_smes to the body instead, the `frontmatter.get` approach fails; would need `state.get "active_smes"` body regex instead |
| A2 | The `gsd-sme-auditor` agent can be repurposed for probing-question generation by changing only the prompt (no agent file changes needed) | Architecture Patterns, Anti-Patterns | If the auditor's hardwired `<execution_flow>` prevents question generation (e.g., always looks for PLAN.md), a new agent mode or a separate agent would be needed |
| A3 | Discuss-phase.md can accept a reference to `sme-step.md` in 2 lines without breaking the < 500 budget | Common Pitfalls, Standard Stack | If even 2 lines overflow, content must be extracted elsewhere in discuss-phase.md to make room |

---

## Open Questions

1. **Where in discuss-phase.md does the SME check step fit?**
   - What we know: `load_prior_context` reads STATE.md (line 234) and `analyze_phase` generates gray areas (line 290). The SME check should run after STATE.md is loaded but before gray areas are finalized.
   - What's unclear: Whether it belongs after `load_prior_context` (step 4) or after `cross_reference_todos` (step 5 — before `scout_codebase`)
   - Recommendation: Insert after `cross_reference_todos` and before `scout_codebase`. By that point, STATE.md has been read, todos have been folded, and the SME questions can be treated as additional pre-loaded areas for `analyze_phase`.

2. **Does the auditor need a new `mode` parameter in its frontmatter, or is prompt-only sufficient?**
   - What we know: The auditor's `<execution_flow>` describes a plan-audit process (load PLAN.md, cross-reference, determine outcome). A probing-questions invocation bypasses all of this.
   - What's unclear: Whether the agent will reliably follow a different prompt without being confused by its own execution flow documentation.
   - Recommendation: Craft the prompt to explicitly override the execution flow ("Your task here is X, not Y"). Test with a sample prompt. If the agent ignores the override, add a `mode: probing-questions` frontmatter variant or a new `<probing_questions_mode>` conditional section.

3. **What happens when Phase 7 is deployed before Phase 8 (no `active_smes` field exists yet)?**
   - What we know: Phase 8 (New-Milestone Process Detection) writes `active_smes` to STATE.md. Phase 7 reads it.
   - What's unclear: The field will simply be absent until Phase 8 runs.
   - Recommendation: If `frontmatter.get` returns no `milestone.active_smes` field (or the field is empty), silently skip the SME step. This is the expected state for all existing projects until Phase 8 runs. The skip behavior is identical to CONFIG-02 (feature disabled when flag is false).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 7 is code/workflow/template changes only. No external tools beyond the existing project SDK are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | none — run directly with `node --test` |
| Quick run command | `node --test tests/sme-discuss-phase.test.cjs` |
| Full suite command | `node --test tests/*.test.cjs` |

Note: Structural tests for workflow `.md` files use `node:test` (CJS pattern), NOT Vitest. Only `sdk/src/` tests use Vitest. See `tests/sme-gate-plan-phase.test.cjs` for the exact precedent from Phase 6.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISCUSS-01 | `sme-step.md` uses `frontmatter.get` to read `STATE.md` for `active_smes` | structural | `node --test tests/sme-discuss-phase.test.cjs` | Wave 0 |
| DISCUSS-01 | `use_sme_agents` guard prevents execution when flag is false | structural | `node --test tests/sme-discuss-phase.test.cjs` | Wave 0 |
| DISCUSS-01 | Discuss-phase.md references `sme-step.md` (the lazy-load dispatch) | structural | `node --test tests/sme-discuss-phase.test.cjs` | Wave 0 |
| DISCUSS-02 | `sme-step.md` calls `sme.context-block` per active SME | structural | `node --test tests/sme-discuss-phase.test.cjs` | Wave 0 |
| DISCUSS-02 | `sme-step.md` spawns `gsd-sme-auditor` | structural | `node --test tests/sme-discuss-phase.test.cjs` | Wave 0 |
| DISCUSS-02 | Auditor prompt does NOT include PLAN.md path (probing mode) | structural | `node --test tests/sme-discuss-phase.test.cjs` | Wave 0 |
| DISCUSS-03 | `context.md` template includes `<sme_context>` section | structural | `node --test tests/sme-discuss-phase.test.cjs` | Wave 0 |
| DISCUSS-03 | `sme-step.md` or `discuss-phase.md` references writing `sme_context` block | structural | `node --test tests/sme-discuss-phase.test.cjs` | Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/sme-discuss-phase.test.cjs`
- **Per wave merge:** `node --test tests/*.test.cjs`
- **Phase gate:** Full test suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/sme-discuss-phase.test.cjs` — covers DISCUSS-01, DISCUSS-02, DISCUSS-03 structural behaviors listed above
- [ ] `get-shit-done/workflows/discuss-phase/sme-step.md` — new lazy-loaded SME check step
- [ ] Update `get-shit-done/workflows/discuss-phase/templates/context.md` — add `<sme_context>` conditional section
- [ ] Update `get-shit-done/workflows/discuss-phase.md` — add dispatch reference (≤2 lines)

*(Framework install: not needed — Node.js built-in test runner requires no install)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `frontmatter.get` includes null-byte path guard [VERIFIED: sdk/src/query/frontmatter.ts line 364]; `active_smes` values are process name strings used only as arguments to `sme.context-block`, not as filesystem paths |
| V6 Cryptography | no | — |

### Known Threat Patterns for Workflow Markdown

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `active_smes` values used as filesystem paths | Tampering | `sme.context-block` handler constructs the path internally from `planningPaths(projectDir) + '/smes/' + name + '-SME.md'` — user-supplied names are not raw-concatenated; handler validates file exists and returns `found: false` for unknown names [VERIFIED: sdk/src/query/sme.ts] |
| STATE.md path traversal via `frontmatter.get` | Tampering | `frontmatterGet` rejects null bytes (line 364) and uses `resolvePathUnderProject` which restricts paths to project directory [VERIFIED: sdk/src/query/frontmatter.ts] |
| SME content injection into auditor prompt | Information Disclosure | SME documents are author-created project files (same trust level as PLAN.md files read by other handlers); accept as-is, same pattern as Phase 6 |

---

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: codebase read]` — `get-shit-done/workflows/discuss-phase.md` — complete file structure, step names, progressive disclosure dispatch pattern, line count (497)
- `[VERIFIED: codebase read]` — `get-shit-done/workflows/discuss-phase/templates/context.md` — CONTEXT.md template format, conditional sections, no existing `<sme_context>` section
- `[VERIFIED: codebase read]` — `get-shit-done/workflows/plan-phase.md` lines 1278-1420 — Phase 6 step 12.6 SME audit gate (the closest analog to this phase's work)
- `[VERIFIED: codebase read]` — `agents/gsd-sme-auditor.md` — auditor agent definition, execution flow, return markers
- `[VERIFIED: codebase read]` — `sdk/src/query/sme.ts` — `smeContextBlock` implementation, XML block format
- `[VERIFIED: codebase read]` — `sdk/src/query/frontmatter.ts` — `frontmatterGet` handler, nested YAML support, null-byte guard
- `[VERIFIED: codebase read]` — `sdk/src/query/state.ts` — `buildStateFrontmatter` and `stateJson` — confirmed that state.json does NOT pass through custom frontmatter fields
- `[VERIFIED: shell]` — `gsd-sdk query frontmatter.get .planning/STATE.md` — confirmed handler returns raw YAML frontmatter JSON
- `[VERIFIED: codebase read]` — `tests/workflow-size-budget.test.cjs` lines 94-105 — `< 500` budget constraint for `discuss-phase.md`
- `[VERIFIED: shell]` — `wc -l discuss-phase.md` → 497 lines — confirmed budget headroom is 2 lines
- `[VERIFIED: codebase read]` — `tests/sme-gate-plan-phase.test.cjs` — Phase 6 test pattern (node:test + assert.ok structural approach)
- `[VERIFIED: codebase read]` — `.planning/REQUIREMENTS.md` — exact requirement text for DISCUSS-01, DISCUSS-02, DISCUSS-03

### Secondary (MEDIUM confidence)

- `[VERIFIED: codebase read]` — `.planning/ROADMAP.md` Phase 7 Success Criteria — `milestone.active_smes` dot-path notation confirming nested frontmatter structure
- `[VERIFIED: codebase read]` — `.planning/phases/06-plan-phase-gate/06-RESEARCH.md` — Phase 6 research patterns, architecture decisions reused here
- `[VERIFIED: codebase read]` — `.planning/phases/02-sdk-query-handlers/02-RESEARCH.md` — SDK-03 context block format details

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components are existing, verified infrastructure from Phases 2, 5, 6
- Architecture: HIGH — progressive-disclosure pattern verified in codebase; frontmatter.get vs state.json distinction verified by reading source
- Pitfalls: HIGH — budget constraint verified by reading test; state.json non-preservation verified by reading buildStateFrontmatter implementation

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable domain — internal SDK conventions and workflow patterns)
