# Phase 8: New-Milestone Process Detection - Research

**Researched:** 2026-04-30
**Domain:** Workflow markdown integration, new-milestone hook point, SME process detection and queuing
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DETECT-01 | During new-milestone setup, scan codebase to identify which processes the milestone touches | `sme.detect-processes` SDK-02 (Phase 2) provides detection by file paths + goal keywords; new-milestone.md step 9 defines requirements with goal text; codebase scan via `sme.list` returns all known processes [VERIFIED: sdk/src/query/sme.ts] |
| DETECT-02 | Check if SMEs exist for detected processes in `.planning/smes/` | `sme.list` returns all existing SME documents; cross-reference detected processes against the list [VERIFIED: sdk/src/query/sme.ts smeList handler] |
| DETECT-03 | If SME exists: surface it and ask user confirmation to use it | Interactive confirmation via `AskUserQuestion` or text-mode numbered list; pattern established by seed scanning (step 2.5) and research decision (step 8) in new-milestone.md [VERIFIED: new-milestone.md] |
| DETECT-04 | If SME missing: offer to create one per-process (yes/no/skip all) | Same interactive pattern with multiSelect; spawn `gsd-sme-creator` for accepted processes (create-sme.md pattern) [VERIFIED: create-sme.md] |
| DETECT-05 | Queue selected SMEs in `.planning/STATE.md` under `milestone.active_smes` array | CRITICAL: must use `frontmatter.merge` or `frontmatter.set` on STATE.md directly — NOT via any `readModifyWriteStateMd`-based handler (which erases custom fields via `buildStateFrontmatter`) [VERIFIED: sdk/src/query/state-mutation.ts, sdk/src/query/state.ts] |

</phase_requirements>

---

## Summary

Phase 8 adds an SME awareness hook into the new-milestone workflow. When a new milestone starts, the workflow now scans which processes the milestone is likely to touch (using the existing `sme.detect-processes` SDK query), surfaces existing SME documents for user confirmation, offers to create SMEs for uncovered processes, and writes the selected process names to `milestone.active_smes` in STATE.md frontmatter so that Phase 7's discuss-phase step can read them.

The implementation follows the same lazy-load + feature-gate pattern established by Phases 6 and 7. The single most important technical constraint is DETECT-05: `active_smes` must be written using `frontmatter.merge` or `frontmatter.set` on STATE.md directly — the standard `state.*` mutation handlers use `readModifyWriteStateMd` → `syncStateFrontmatter` → `buildStateFrontmatter`, which rebuilds frontmatter from body scanning and does NOT preserve custom nested fields like `milestone.active_smes`. Any subsequent standard state write would silently erase the field if the wrong approach is used.

The primary deliverables are: (1) a new lazy-loaded step file (`workflows/new-milestone/sme-step.md`) with all detection and queuing logic, (2) a 1-2 line reference added to `new-milestone.md` dispatching to it, and (3) structural tests in `tests/sme-new-milestone-detect.test.cjs`. Zero new npm packages are required.

**Primary recommendation:** Add a single dispatch reference to `new-milestone.md` at the correct step (after milestone goals are gathered, before requirement definition), implement all SME detection and queuing logic in `get-shit-done/workflows/new-milestone/sme-step.md`, write `active_smes` via `frontmatter.merge` on STATE.md, and cover DETECT-01 through DETECT-05 with CJS structural tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Feature guard (`use_sme_agents`) | SDK Layer (`config-get`) | Orchestration Layer | Same pattern as plan-phase step 12.6 and discuss-phase sme-step.md [VERIFIED: plan-phase.md, discuss-phase/sme-step.md] |
| Detect which processes the milestone touches | SDK Layer (`sme.detect-processes`) | Orchestration Layer | Phase 2 SDK-02 handler; matches by process names in existing SME files against goal keywords [VERIFIED: sdk/src/query/sme.ts] |
| List existing SME documents | SDK Layer (`sme.list`) | — | Phase 2 SDK-01 handler; returns all `.planning/smes/*-SME.md` with frontmatter [VERIFIED: sdk/src/query/sme.ts] |
| User confirmation for existing SMEs | Orchestration Layer (`sme-step.md`) | — | `AskUserQuestion` with multiSelect; text-mode fallback with numbered list |
| Offer SME creation for missing processes | Orchestration Layer (`sme-step.md`) | Agent Layer (`gsd-sme-creator`) | Spawn creator agent; same pattern as create-sme.md `spawn_creator` step [VERIFIED: create-sme.md] |
| Write `active_smes` to STATE.md | SDK Layer (`frontmatter.merge`) | — | MUST bypass `readModifyWriteStateMd`; `frontmatter.merge` on STATE.md preserves all existing frontmatter [VERIFIED: sdk/src/query/frontmatter-mutation.ts] |
| Progressive disclosure enforcement | Orchestration Layer (new-milestone.md) | Presentation Layer (workflow-size-budget.test.cjs) | `new-milestone` is LARGE tier (limit 1500); currently 634 lines — abundant headroom for 1-2 dispatch lines |

---

## Standard Stack

### Core (already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Markdown + YAML frontmatter | N/A | Workflow and agent definition format | All GSD workflows use this format [VERIFIED: repo scan] |
| `gsd-sdk query config-get` | N/A | Read `workflow.use_sme_agents` feature flag | Same pattern as plan-phase step 12.6 and discuss-phase/sme-step.md [VERIFIED: both files] |
| `gsd-sdk query sme.list` | N/A (SDK-01) | List all existing SME documents with metadata | Phase 2 implementation; returns `{ enabled, smes[] }` [VERIFIED: sdk/src/query/sme.ts] |
| `gsd-sdk query sme.detect-processes` | N/A (SDK-02) | Detect which processes milestone touches | Phase 2 implementation; args: `--file-paths ... --goal "..."` [VERIFIED: sdk/src/query/sme.ts] |
| `gsd-sdk query frontmatter.merge` | N/A | Write `milestone.active_smes` to STATE.md frontmatter | Only handler that updates STATE.md frontmatter without erasing custom nested fields [VERIFIED: sdk/src/query/frontmatter-mutation.ts] |
| `gsd-sdk query commit` | N/A | Commit STATE.md after writing active_smes | Standard commit handler; same as all other workflow phases |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `frontmatter.merge` on STATE.md | `state.update` or `state.patch` | `state.*` handlers go through `readModifyWriteStateMd` → `syncStateFrontmatter` → `buildStateFrontmatter`, which rebuilds frontmatter from body scan and silently erases `milestone.active_smes` [VERIFIED: sdk/src/query/state-mutation.ts line 278-279, state.ts line 80] |
| `frontmatter.merge` on STATE.md | `frontmatter.set` on STATE.md | `frontmatter.set` sets one field at a time; `frontmatter.merge` accepts JSON object and can set nested `milestone` key with full object. Either works but `merge` is cleaner for writing nested structure |
| Lazy-loaded `new-milestone/sme-step.md` | Inline in `new-milestone.md` | Budget: new-milestone is LARGE tier (1500 limit, currently 634 lines — 866 headroom). Inline is technically feasible, but the lazy-load pattern established by Phase 7 is the architectural precedent to follow for all SME steps |

### No New Packages Required

Phase 8 delivers workflow markdown changes and CJS structural tests. Zero new npm installs.

---

## Architecture Patterns

### System Architecture Diagram

```
new-milestone.md orchestrator
    │
    │ Step 1: Load Context (INIT)
    │ Step 2: Gather Milestone Goals → sets MILESTONE_GOAL / target features
    │ Step 2.5: Scan Planted Seeds (existing)
    │ Step 3: Determine Milestone Version
    │ Step 3.5: Verify Milestone Understanding
    │
    │ [NEW: sme_detect step — dispatch to new-milestone/sme-step.md]
    │   (after goals gathered, before PROJECT.md update)
    │
    ▼
get-shit-done/workflows/new-milestone/sme-step.md
    │
    │ 1. Check use_sme_agents config flag → skip if false
    │ 2. sme.list → get all existing SME documents
    │    → skip if enabled=false
    │    → skip (but note) if smes[] empty AND no detection possible
    │ 3. sme.detect-processes --goal "${MILESTONE_GOAL}" → get matches
    │    matches: SME names that appear in milestone goal text
    │    (no file-paths at this stage — milestone hasn't started yet)
    │ 4. Cross-reference: separate matches into:
    │    - existing_smes: processes in matches that have SME documents
    │    - missing_smes: processes in all smes[] NOT in matches (surfaced manually)
    │    - undetected: smes[] not matching goal (not surfaced automatically)
    │ 5. If existing_smes: AskUserQuestion — confirm which to use
    │    → selected_smes (list)
    │ 6. If missing processes (user can also manually specify):
    │    AskUserQuestion — per-process yes/no/skip-all to create SMEs
    │    For each accepted: Task(gsd-sme-creator, process-name)
    │    After creation: add to selected_smes
    │ 7. Write selected_smes to STATE.md:
    │    frontmatter.merge .planning/STATE.md --data '{"milestone":{"active_smes":[...]}}'
    │
    ▼
new-milestone.md continues
    │ Step 4: Update PROJECT.md
    │ Step 5: Update STATE.md (state.milestone-switch — atomically resets body+frontmatter)
    │ ...
```

**CRITICAL ORDERING ISSUE:** Step 5 of new-milestone calls `state.milestone-switch`, which performs a full frontmatter rebuild with `reconstructFrontmatter` on a fresh `fm` object — it does NOT preserve custom fields like `milestone.active_smes`. This means the SME step MUST run AFTER `state.milestone-switch`, or the `active_smes` written in step 4.5 will be overwritten by the switch.

**Correct position:** SME detection step runs AFTER step 5 (`state.milestone-switch`) and BEFORE step 10 (roadmap creation).

### Recommended Project Structure

```
get-shit-done/workflows/
├── new-milestone.md          # MODIFIED — add 1-2 lines referencing sme-step.md (after step 5)
└── new-milestone/
    └── sme-step.md           # NEW — full SME detection and queuing logic (lazy-loaded)

tests/
└── sme-new-milestone-detect.test.cjs  # NEW — structural tests for DETECT-01..05
```

### Pattern 1: Config-Gated SME Step (from discuss-phase/sme-step.md)

**What:** Read `workflow.use_sme_agents` flag first; skip the entire step when false.
**When to use:** Every SME feature entry point — this is the canonical pattern for all SME workflow steps.
**Example:**
```bash
# Source: get-shit-done/workflows/discuss-phase/sme-step.md [VERIFIED]
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
# If SME_AGENTS is not "true": skip this step entirely.
```

### Pattern 2: List and Detect Processes

**What:** `sme.list` returns all existing SME documents; `sme.detect-processes` matches processes against goal text. At milestone setup time, there are no file paths yet — detection uses only the goal.
**When to use:** The initial scan in the SME step.
**Example:**
```bash
# Source: sdk/src/query/sme.ts smeList and smeDetectProcesses [VERIFIED]
SME_LIST=$(gsd-sdk query sme.list 2>/dev/null || echo '{"data":{"enabled":false,"smes":[]}}')
ENABLED=$(echo "$SME_LIST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('enabled',False))" 2>/dev/null || echo "False")

# Detect by goal text only (no file paths at milestone setup stage)
SME_DETECT=$(gsd-sdk query sme.detect-processes --goal "${MILESTONE_GOAL}" 2>/dev/null || echo '{"data":{"enabled":false,"matches":[]}}')
MATCHES=$(echo "$SME_DETECT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
matches = d.get('data', {}).get('matches', [])
print('\n'.join(m['process_name'] for m in matches))
" 2>/dev/null || echo "")
```

### Pattern 3: Write active_smes to STATE.md via frontmatter.merge

**What:** Write the nested YAML field `milestone.active_smes` using `frontmatter.merge`, which reads existing frontmatter, merges the JSON object, and writes back — bypassing `buildStateFrontmatter`.
**When to use:** DETECT-05 — after user selects which SMEs to activate.
**Why NOT state.update/state.patch:** Those go through `readModifyWriteStateMd` → `syncStateFrontmatter` → `buildStateFrontmatter`, which rebuilds frontmatter from body scan and does NOT include `active_smes`. The field would be silently erased.
**Example:**
```bash
# Source: sdk/src/query/frontmatter-mutation.ts frontmatterMerge [VERIFIED]
# SELECTED_SMES is a bash array: ("payments" "auth")
# Serialize to JSON array:
ACTIVE_SMES_JSON=$(echo "${SELECTED_SMES[@]}" | python3 -c "
import sys, json
names = sys.stdin.read().split()
print(json.dumps({'milestone': {'active_smes': names}}))
")
gsd-sdk query frontmatter.merge .planning/STATE.md --data "$ACTIVE_SMES_JSON"
```

### Pattern 4: Interactive Confirmation (from new-milestone.md Step 2.5 seed scanning)

**What:** Present detected processes as a multiSelect list; handle auto mode, text mode, and normal mode.
**When to use:** DETECT-03 and DETECT-04 — confirm existing SMEs, offer creation for missing.
**Example:**
```
# Normal mode — existing SMEs:
AskUserQuestion(
  header: "Active SMEs",
  question: "These SME documents match your milestone goals. Which should be active for this milestone?",
  multiSelect: true,
  options: [
    { label: "{process_name}", description: "Block mode: {block_mode} | Findings: {blocker}B / {warning}W / {watch}W" },
    ...
  ]
)

# Text mode (TEXT_MODE=true):
Active SME candidates:
1. {process_name} ({block_mode}, {blocker}B/{warning}W/{watch}W)
2. {process_name} ...
Enter numbers to activate (comma-separated), or "none" to skip:

# --auto mode:
Auto-select ALL detected SME matches.
Log: [auto] Activated N SME(s): [list]
```

### Pattern 5: Lazy-Load from new-milestone.md

**What:** Add a single dispatch reference in new-milestone.md to the sme-step.md file, positioned AFTER `state.milestone-switch` (step 5) and BEFORE requirement definition (step 9).
**When to use:** The only modification to new-milestone.md.
**Example:**
```markdown
<!-- In new-milestone.md, after Step 5 and before Step 6 (cleanup/commit): -->
## 5.5. SME Process Detection

If `workflow.use_sme_agents` is true: Read `workflows/new-milestone/sme-step.md` and execute its steps.
```

**Note:** Actual position depends on exact step ordering in new-milestone.md. Verify the current step structure before choosing the insertion point.

### Anti-Patterns to Avoid

- **Writing `active_smes` via `state.update` or `state.patch`:** These go through `readModifyWriteStateMd` → `syncStateFrontmatter` → `buildStateFrontmatter`. That function rebuilds frontmatter from body scanning and does NOT include `milestone.active_smes`. The field is silently erased on every subsequent state write. Use `frontmatter.merge` instead [VERIFIED: sdk/src/query/state-mutation.ts lines 276-279, state.ts lines 80-206].
- **Running SME detection BEFORE `state.milestone-switch` (step 5):** The `stateMilestoneSwitch` handler builds a fresh `fm` object that does NOT preserve custom fields — it would overwrite `active_smes` written before it runs [VERIFIED: sdk/src/query/state-mutation.ts lines 1205-1227].
- **Using `sme.detect-processes --file-paths ...` with no meaningful paths:** At milestone setup, there are no modified files yet. Pass only `--goal "${MILESTONE_GOAL}"` for detection. File-path matching is for plan-phase, not new-milestone.
- **Blocking when no SMEs detected:** Both DETECT-03 and DETECT-04 are optional user prompts — if no SMEs detected and user skips creation, silently proceed without writing `active_smes`. Never block new-milestone setup.
- **Spawning the creator agent and blocking on it:** SME creation may take minutes. Always give the user a skip-all option. If they skip, proceed without `active_smes`.
- **Duplicating inline detection logic in new-milestone.md:** All logic must go in `new-milestone/sme-step.md`. The main file gets only the dispatch reference.
- **Using jq without a fallback:** Not all environments have jq installed. Use `python3` for JSON parsing (consistent with discuss-phase/sme-step.md pattern) [VERIFIED: discuss-phase/sme-step.md].

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List existing SME docs | `ls .planning/smes/*.md` | `gsd-sdk query sme.list` | Handles missing directory, feature flag check, sorts alphabetically, returns metadata [VERIFIED: sdk/src/query/sme.ts] |
| Detect process matches | Custom string grep | `gsd-sdk query sme.detect-processes --goal "..."` | Case-insensitive matching, deduplication, `match_source` metadata [VERIFIED: sdk/src/query/sme.ts] |
| Write nested frontmatter | `sed` or body text edit | `gsd-sdk query frontmatter.merge .planning/STATE.md --data '{"milestone":{"active_smes":[...]}}'` | Only safe way to write custom nested frontmatter to STATE.md without triggering `buildStateFrontmatter` erasure [VERIFIED: sdk/src/query/frontmatter-mutation.ts] |
| Process name validation | Custom regex | `[[ ! "$PROCESS_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]` | Already established pattern in create-sme.md — copy verbatim [VERIFIED: create-sme.md] |

**Key insight:** Phase 8 is almost entirely orchestration markdown — it wires existing SDK infrastructure (Phase 2 SDK-01 and SDK-02 handlers, Phase 3 creator agent) into new-milestone. The only new artifacts are the step file (`new-milestone/sme-step.md`) and structural tests.

---

## Common Pitfalls

### Pitfall 1: `state.milestone-switch` Erases `active_smes`

**What goes wrong:** SME detection writes `active_smes` to STATE.md frontmatter before step 5. Then `state.milestone-switch` runs, building a fresh frontmatter object that does NOT include `active_smes`. The field is silently erased.

**Why it happens:** `stateMilestoneSwitch` explicitly builds a fresh `fm` object (lines 1205-1226 of state-mutation.ts) and calls `reconstructFrontmatter(fm)` — only known GSD fields (milestone, status, progress, etc.) are included.

**How to avoid:** Insert the SME detection step AFTER `state.milestone-switch` completes (i.e., after step 5 in new-milestone.md). The `frontmatter.merge` call for `active_smes` must be the LAST write to STATE.md frontmatter before the milestone's active work begins.

**Warning signs:** `frontmatter.get .planning/STATE.md` returns empty `milestone.active_smes` immediately after new-milestone runs. Check if step 5 runs after the sme-step in the workflow.

### Pitfall 2: Subsequent State Writes Erase `active_smes`

**What goes wrong:** A later workflow step calls any `state.*` mutation handler (e.g., `state.begin-phase`, `state.update-progress`, `state.advance-plan`). Each of these goes through `readModifyWriteStateMd` → `syncStateFrontmatter` → `buildStateFrontmatter`. `buildStateFrontmatter` returns a fresh frontmatter object that does NOT include `milestone.active_smes`. The field is erased.

**Why it happens:** `buildStateFrontmatter` is designed to derive canonical STATE fields from body content and disk scanning. It has no mechanism for preserving arbitrary custom fields.

**How to avoid:** This is a known limitation acknowledged in Phase 7's RESEARCH.md. Phase 7's discuss-phase `sme-step.md` reads `active_smes` using `frontmatter.get .planning/STATE.md` (not `state.json`) precisely because `state.json` rebuilds from the same `buildStateFrontmatter` call. The write should happen as late as possible in the new-milestone flow, just before the milestone's operational work begins.

**Warning signs:** `active_smes` is present immediately after new-milestone but empty by the time discuss-phase runs. This indicates an intervening state write (e.g., `state.begin-phase`) erased it.

**Resolution:** If this becomes a problem in practice, the solution is to add `milestone.active_smes` preservation to `buildStateFrontmatter` — but that is out of scope for Phase 8. For now, the field survives between milestone creation and the first `state.begin-phase` call, which is sufficient for the discuss-phase integration.

### Pitfall 3: Detection Without Goals

**What goes wrong:** `sme.detect-processes` is called without a `--goal` argument (or with an empty goal). The handler's keyword matching returns no results even when relevant SMEs exist.

**Why it happens:** `sme.detect-processes` requires either file paths or a goal string to match against. At milestone setup, neither is yet well-defined.

**How to avoid:** Use the milestone goal/name gathered in step 2 as the `--goal` argument. Even a rough goal ("Add payment processing to checkout") is enough for the keyword matcher to detect a "payments" process.

**Warning signs:** `sme.detect-processes` always returns empty matches even when `sme.list` returns SMEs with relevant names.

### Pitfall 4: Budget Overflow (new-milestone.md)

**What goes wrong:** Logic is added inline to `new-milestone.md`, pushing it past the LARGE tier limit (1500 lines). `workflow-size-budget.test.cjs` fails.

**Why it happens:** The file is currently 634 lines — well within the 1500 limit. But adding more than ~800 lines of inline content would overflow. Inline is tempting but creates a maintenance burden and violates the progressive-disclosure pattern.

**How to avoid:** All SME logic goes in `get-shit-done/workflows/new-milestone/sme-step.md`. The `new-milestone.md` modification is a single dispatch reference (1-2 lines).

**Warning signs:** `node --test tests/workflow-size-budget.test.cjs` fails with "new-milestone exceeds budget".

### Pitfall 5: Wrong Interactive Pattern for Separate Confirmation Flows

**What goes wrong:** Existing SMEs (DETECT-03) and missing SMEs (DETECT-04) are combined into a single `AskUserQuestion`. The user cannot confirm existing SMEs separately from choosing to create new ones.

**Why it happens:** The two requirements have different semantics: DETECT-03 is "do you want to use this existing document", DETECT-04 is "do you want to create a new one". Conflating them is confusing.

**How to avoid:** Two separate prompts (or one with clearly labeled sections):
1. First prompt: "Which of these existing SMEs should be active for this milestone?" (multiSelect from detected matches)
2. Second prompt (if any SME process names are NOT covered): "These processes have no SME. Create one now?" (per-process yes/no/skip-all)

---

## Code Examples

Verified patterns from existing codebase:

### Check Config Flag (from discuss-phase/sme-step.md)
```bash
# Source: get-shit-done/workflows/discuss-phase/sme-step.md [VERIFIED]
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
if [ "$SME_AGENTS" != "true" ]; then
  # Skip SME detection step entirely
  exit 0
fi
```

### List Existing SMEs and Extract Process Names
```bash
# Source: sdk/src/query/sme.ts smeList [VERIFIED]
SME_LIST=$(gsd-sdk query sme.list 2>/dev/null || echo '{"data":{"enabled":false,"smes":[]}}')
ENABLED=$(echo "$SME_LIST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('enabled',False))" 2>/dev/null || echo "False")
if [ "$ENABLED" != "True" ]; then
  # use_sme_agents is false at config level
  exit 0
fi
ALL_PROCESSES=$(echo "$SME_LIST" | python3 -c "
import json, sys
d = json.load(sys.stdin)
smes = d.get('data', {}).get('smes', [])
for sme in smes:
    print(sme.get('process_name', ''))
" 2>/dev/null || echo "")
```

### Detect Processes from Milestone Goal
```bash
# Source: sdk/src/query/sme.ts smeDetectProcesses [VERIFIED]
# MILESTONE_GOAL should be the goal text gathered in step 2
SME_DETECT=$(gsd-sdk query sme.detect-processes --goal "${MILESTONE_GOAL}" 2>/dev/null || echo '{"data":{"enabled":false,"matches":[]}}')
MATCHED_PROCESSES=$(echo "$SME_DETECT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
matches = d.get('data', {}).get('matches', [])
print('\n'.join(m.get('process_name', '') for m in matches))
" 2>/dev/null || echo "")
```

### Write active_smes via frontmatter.merge (DETECT-05)
```bash
# Source: sdk/src/query/frontmatter-mutation.ts frontmatterMerge [VERIFIED]
# SELECTED_SMES_ARRAY is a bash array of process name strings
# Example: SELECTED_SMES_ARRAY=("payments" "auth")

# Serialize to JSON: {"milestone": {"active_smes": ["payments", "auth"]}}
ACTIVE_SMES_JSON=$(python3 -c "
import sys, json
names = [n.strip() for n in '''${SELECTED_SMES}'''.split() if n.strip()]
print(json.dumps({'milestone': {'active_smes': names}}))
")
gsd-sdk query frontmatter.merge .planning/STATE.md --data "$ACTIVE_SMES_JSON"
```

### Validate Process Name (from create-sme.md)
```bash
# Source: get-shit-done/workflows/create-sme.md [VERIFIED]
if [[ ! "$PROCESS_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "ERROR: Process name must contain only letters, digits, hyphens, and underscores."
  echo "Got: '$PROCESS_NAME'"
  exit 1
fi
```

### Dispatch Reference in new-milestone.md (1-2 lines)
```markdown
## 5.5. SME Process Detection

If `workflow.use_sme_agents` is true: Read `workflows/new-milestone/sme-step.md` and execute its steps.
Otherwise skip silently.
```

### Structural Test Pattern (from sme-discuss-phase.test.cjs)
```javascript
// Source: tests/sme-discuss-phase.test.cjs [VERIFIED — existing pattern for Phase 7]
'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NEW_MILESTONE = path.join(ROOT, 'get-shit-done', 'workflows', 'new-milestone.md');
const SME_STEP = path.join(ROOT, 'get-shit-done', 'workflows', 'new-milestone', 'sme-step.md');

describe('DETECT-01: new-milestone scans for processes milestone touches', () => {
  test('new-milestone.md references sme-step.md (lazy-load dispatch)', () => {
    const content = fs.readFileSync(NEW_MILESTONE, 'utf-8');
    assert.ok(content.includes('new-milestone/sme-step.md') || content.includes('new-milestone\\sme-step.md'),
      'new-milestone.md must dispatch to new-milestone/sme-step.md for SME detection');
  });
  test('sme-step.md calls sme.detect-processes', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('sme.detect-processes'),
      'sme-step.md must call sme.detect-processes to identify milestone-relevant processes');
  });
});

describe('DETECT-02: check for existing SMEs in .planning/smes/', () => {
  test('sme-step.md calls sme.list to check for existing SME documents', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('sme.list'),
      'sme-step.md must call sme.list to check which SMEs already exist');
  });
});

describe('DETECT-03: existing SMEs surfaced for user confirmation', () => {
  test('sme-step.md asks user to confirm which SMEs to activate', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('AskUserQuestion') || content.includes('multiSelect'),
      'sme-step.md must present AskUserQuestion for existing SME confirmation');
  });
});

describe('DETECT-04: missing SMEs offered per-process creation', () => {
  test('sme-step.md references gsd-sme-creator for missing processes', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('gsd-sme-creator'),
      'sme-step.md must offer to spawn gsd-sme-creator for processes without SMEs');
  });
});

describe('DETECT-05: selected SMEs queued in STATE.md under milestone.active_smes', () => {
  test('sme-step.md uses frontmatter.merge to write active_smes (NOT state.update/state.patch)', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('frontmatter.merge'),
      'sme-step.md must use frontmatter.merge to write milestone.active_smes to STATE.md');
    assert.ok(!content.includes('state.update') && !content.includes('state.patch'),
      'sme-step.md must NOT use state.update or state.patch (they erase custom frontmatter fields)');
  });
  test('sme-step.md writes active_smes key to STATE.md', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('active_smes'),
      'sme-step.md must reference active_smes in the write step');
  });
  test('sme-step.md targets .planning/STATE.md', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('STATE.md'),
      'sme-step.md must reference STATE.md as the write target');
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| new-milestone is SME-unaware | new-milestone detects and queues relevant SMEs | Phase 8 (this phase) | Domain-specific risks are queued at milestone start, not discovered reactively at plan-phase |
| User must manually create SMEs | new-milestone offers to create SMEs for detected processes | Phase 8 (this phase) | Lower barrier to SME adoption; right moment to create SMEs is when you know what the milestone touches |
| `milestone.active_smes` populated only by Phase 7 (assumed) | `milestone.active_smes` populated at milestone setup (Phase 8 sources it) | Phase 8 (this phase) | Discuss-phase can now read pre-queued SMEs without requiring a manual setup step |
| STATE.md frontmatter mutations via `state.*` handlers | Custom frontmatter fields use `frontmatter.merge` directly | Phase 7/8 (this phase) | `state.*` handlers erase custom fields via `buildStateFrontmatter`; `frontmatter.merge` preserves them |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The correct insertion point in new-milestone.md is AFTER step 5 (`state.milestone-switch`) and BEFORE step 6/9 (cleanup/requirement definition) | Architecture Patterns, Pitfall 1 | If step 5 runs AFTER the SME step, `active_smes` is overwritten; the detection step must be re-ordered |
| A2 | `frontmatter.merge` preserves ALL existing STATE.md frontmatter fields when writing `milestone.active_smes` | Standard Stack, DETECT-05 | If `frontmatter.merge` does a shallow merge that overwrites nested objects, existing `milestone.{other_fields}` could be lost; verified from source but not integration-tested in this session |
| A3 | Subsequent calls to `state.begin-phase`, `state.update-progress`, etc. will erase `active_smes` | Common Pitfalls | If `buildStateFrontmatter` is updated to preserve custom fields before Phase 8 ships, Pitfall 2 is mitigated; plan accordingly |
| A4 | Using only `--goal "${MILESTONE_GOAL}"` (no `--file-paths`) in `sme.detect-processes` is sufficient for detection at milestone setup | Architecture Patterns, Code Examples | If the milestone goal is vague and doesn't contain process name substrings, detection returns empty; fallback is to surface all SMEs from `sme.list` for manual selection |

---

## Open Questions

1. **What if subsequent `state.*` calls erase `active_smes` before discuss-phase reads it?**
   - What we know: `buildStateFrontmatter` does not preserve custom fields; any `state.*` call between new-milestone and discuss-phase erases `active_smes`.
   - What's unclear: How many state writes happen between new-milestone (step 5) and the first discuss-phase invocation.
   - Recommendation: For Phase 8, accept this limitation and document it. The field is written late in new-milestone and read early in discuss-phase. If intermediate writes prove a problem in practice, the fix is a one-line addition to `buildStateFrontmatter` to preserve `milestone.active_smes` from `existingFm` — but that is a Phase 9 concern, not Phase 8.

2. **Should detection also scan existing ROADMAP.md phase goals/requirements for process names?**
   - What we know: At new-milestone setup time, there is no ROADMAP.md yet (it's created in step 10). Detection can only use the milestone goal gathered in step 2.
   - What's unclear: Whether the milestone goal text is rich enough to reliably detect process names.
   - Recommendation: Use only `--goal "${MILESTONE_GOAL}"` for automatic detection, but always also surface ALL existing SMEs (from `sme.list`) in the confirmation step so the user can manually include any that weren't auto-detected.

3. **Does `new-milestone/` subdirectory need to be created?**
   - What we know: The workflow uses `workflows/discuss-phase/sme-step.md` (a subdirectory exists). For new-milestone, no subdirectory currently exists.
   - What's unclear: Whether a `new-milestone/` subdirectory is needed or if a flat file would suffice.
   - Recommendation: Create `get-shit-done/workflows/new-milestone/sme-step.md` in a subdirectory — consistent with the discuss-phase pattern (which has `discuss-phase/`, `discuss-phase/modes/`, `discuss-phase/templates/`). Future new-milestone sub-steps (e.g., post-execution refresh wiring) can share this directory.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is workflow markdown changes and CJS structural tests only. No external tools beyond the existing project SDK are required. All SDK query handlers (`sme.list`, `sme.detect-processes`, `frontmatter.merge`) are implemented in prior phases [VERIFIED: sdk/src/query/sme.ts, sdk/src/query/frontmatter-mutation.ts].

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) |
| Config file | none — run directly with `node --test` |
| Quick run command | `node --test tests/sme-new-milestone-detect.test.cjs` |
| Full suite command | `node --test tests/*.test.cjs` |

Note: Structural tests for workflow `.md` files use `node:test` (CJS pattern), NOT Vitest. Only `sdk/src/` tests use Vitest. See `tests/sme-discuss-phase.test.cjs` for the exact precedent from Phase 7 [VERIFIED: tests/ directory listing].

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DETECT-01 | `new-milestone.md` dispatches to `new-milestone/sme-step.md` | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Wave 0 |
| DETECT-01 | `sme-step.md` calls `sme.detect-processes` | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Wave 0 |
| DETECT-01 | `use_sme_agents` guard prevents execution when flag is false | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Wave 0 |
| DETECT-02 | `sme-step.md` calls `sme.list` to check existing SMEs | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Wave 0 |
| DETECT-03 | `sme-step.md` uses `AskUserQuestion` or `multiSelect` for existing SME confirmation | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Wave 0 |
| DETECT-04 | `sme-step.md` references `gsd-sme-creator` for missing process creation | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Wave 0 |
| DETECT-05 | `sme-step.md` uses `frontmatter.merge` (not `state.update`/`state.patch`) to write `active_smes` | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Wave 0 |
| DETECT-05 | `sme-step.md` writes `active_smes` key to `STATE.md` | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/sme-new-milestone-detect.test.cjs`
- **Per wave merge:** `node --test tests/*.test.cjs`
- **Phase gate:** Full test suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/sme-new-milestone-detect.test.cjs` — covers DETECT-01 through DETECT-05 structural behaviors above
- [ ] `get-shit-done/workflows/new-milestone/sme-step.md` — new lazy-loaded SME detection and queuing step
- [ ] Update `get-shit-done/workflows/new-milestone.md` — add dispatch reference (1-2 lines after step 5)

*(Framework install: not needed — Node.js built-in test runner requires no install)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Process name validation: `[a-zA-Z0-9_-]+` regex (same as `sme.processes.{name}.block_mode` key restriction in config schema) [VERIFIED: STATE.md decisions section]; `frontmatter.merge` null-byte guard [VERIFIED: sdk/src/query/frontmatter-mutation.ts line 244] |
| V6 Cryptography | no | — |

### Known Threat Patterns for Workflow Markdown

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Process name from detection used as filesystem path | Tampering | `sme-step.md` must NOT directly construct file paths from `sme.detect-processes` output; use `sme.context-block "{PROCESS_NAME}"` which constructs path internally with only registry-returned filenames [VERIFIED: sdk/src/query/sme.ts smeContextBlock] |
| Milestone goal text injected into detect-processes `--goal` | Tampering | `sme.detect-processes` uses case-insensitive substring match; it does not execute the goal string; goal text is workflow-controlled, not user file input |
| `frontmatter.merge` path traversal | Tampering | Handler uses `resolvePathUnderProject` with null-byte rejection (line 244) [VERIFIED: sdk/src/query/frontmatter-mutation.ts line 244] |

---

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: codebase read]` — `sdk/src/query/sme.ts` — `smeList`, `smeDetectProcesses`, `smeContextBlock` implementations; args format, return shapes
- `[VERIFIED: codebase read]` — `sdk/src/query/state-mutation.ts` lines 237-285 — `syncStateFrontmatter` + `readModifyWriteStateMd` pattern; confirmed that custom fields are NOT preserved
- `[VERIFIED: codebase read]` — `sdk/src/query/state-mutation.ts` lines 1157-1241 — `stateMilestoneSwitch` builds fresh `fm` object; confirmed `active_smes` would be erased if written before step 5
- `[VERIFIED: codebase read]` — `sdk/src/query/state.ts` lines 77-206 — `buildStateFrontmatter` confirmed to produce only standard GSD fields; no custom field pass-through
- `[VERIFIED: codebase read]` — `sdk/src/query/frontmatter-mutation.ts` lines 222-278 — `frontmatterMerge` reads existing frontmatter, merges JSON object, writes back without calling `buildStateFrontmatter`
- `[VERIFIED: codebase read]` — `get-shit-done/workflows/new-milestone.md` — full workflow structure (634 lines); budget tier LARGE (1500 limit); step ordering; seed-scan pattern (step 2.5); AskUserQuestion patterns; TEXT_MODE fallback
- `[VERIFIED: codebase read]` — `get-shit-done/workflows/discuss-phase/sme-step.md` — Phase 7 SME step; config-gate pattern; `frontmatter.get` for reading `active_smes`; python3 JSON extraction; graceful skip patterns
- `[VERIFIED: codebase read]` — `get-shit-done/workflows/create-sme.md` — creator spawn pattern; process name validation regex; `gsd-sme-creator` Task() invocation
- `[VERIFIED: codebase read]` — `tests/workflow-size-budget.test.cjs` lines 44-58 — LARGE tier (1500 limit) confirmed for `new-milestone`; currently 634 lines (866 lines of headroom)
- `[VERIFIED: codebase read]` — `tests/sme-discuss-phase.test.cjs` — Phase 7 structural test pattern; `node:test` + `assert.ok` approach; file path construction
- `[VERIFIED: codebase read]` — `tests/seed-scan-new-milestone.test.cjs` — structural test for new-milestone.md; confirms `new-milestone` step addition pattern
- `[VERIFIED: codebase read]` — `.planning/REQUIREMENTS.md` lines 79-83 — exact requirement text for DETECT-01 through DETECT-05

### Secondary (MEDIUM confidence)

- `[VERIFIED: codebase read]` — `.planning/ROADMAP.md` Phase 8 Success Criteria — confirms `milestone.active_smes` as the target field; confirms dependency on Phases 2 and 3
- `[VERIFIED: codebase read]` — `.planning/phases/07-discuss-phase-integration/07-RESEARCH.md` — A1 assumption about `active_smes` YAML structure; reading pattern via `frontmatter.get`; pitfall about `state.json` vs `frontmatter.get`
- `[VERIFIED: codebase read]` — `tests/sme-gate-plan-phase.test.cjs` — Phase 6 test pattern; confirms CJS structural test format

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components are existing, verified infrastructure from Phases 2 and 3; `frontmatter.merge` is the correct handler per source code inspection
- Architecture: HIGH — critical ordering constraint (must run after `stateMilestoneSwitch`) verified by reading `state-mutation.ts`; step file pattern verified from Phase 7
- Pitfalls: HIGH — `buildStateFrontmatter` non-preservation verified by reading source; `stateMilestoneSwitch` field erasure verified by reading source

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable domain — internal SDK conventions and workflow patterns)
