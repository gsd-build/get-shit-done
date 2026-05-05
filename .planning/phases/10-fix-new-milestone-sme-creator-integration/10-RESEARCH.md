# Phase 10: Fix New-Milestone SME Creator Integration - Research

**Researched:** 2026-05-04
**Domain:** Workflow markdown bug fixes, agent definition config wiring, structural tests
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONFIG-03 | `sme.blocking` config key controls default block mode for new SMEs (soft \| strict) | Config key registered in schema (`sme.blocking`) and in defaults (`sme.blocking: soft`) but `gsd-sme-creator.md` hardcodes `block_mode: soft` without reading the config. Fix: add `gsd-sdk query config-get sme.blocking` call to the creator's `synthesize_and_write` step. [VERIFIED: agents/gsd-sme-creator.md line 147, sdk/src/query/config-mutation.ts line 395, sdk/src/query/config-schema.ts line 74] |
| DETECT-04 | If SME missing: offer to create one per-process (yes/no/skip all) | Phase 8 implemented this in `new-milestone/sme-step.md` but the `Task()` spawn uses literal `{CREATOR_MODEL}` and `{AGENT_SKILLS_CREATOR}` template placeholders — the variables are never resolved before use. Fix: add two `gsd-sdk query` calls above the creator spawn, matching the pattern in `create-sme.md` and `execute-phase.md`. [VERIFIED: get-shit-done/workflows/new-milestone/sme-step.md lines 119-128, get-shit-done/workflows/create-sme.md lines 12-13, get-shit-done/workflows/execute-phase.md lines 1599-1600] |
| DETECT-05 | Queue selected SMEs in `.planning/STATE.md` under `milestone.active_smes` array | Phase 8 implemented the write correctly via `frontmatter.merge`, but the `SELECTED_SMES` population logic has a bug: after `gsd-sme-creator` Task() returns, the process name is added to `SELECTED_SMES` unconditionally even if the creator failed. Fix: add a `## SME Creation Complete` marker check before adding to `SELECTED_SMES`. [VERIFIED: get-shit-done/workflows/new-milestone/sme-step.md lines 129-131, agents/gsd-sme-creator.md lines 183-193] |

</phase_requirements>

---

## Summary

Phase 10 is a gap closure phase that fixes three integration bugs discovered in the v1.0 milestone audit. All three fixes are confined to workflow markdown files and one agent definition — no TypeScript SDK changes are needed.

**Bug 1 (DETECT-04 / CONFIG-03):** `new-milestone/sme-step.md` spawns `gsd-sme-creator` via `Task()` with `model="{CREATOR_MODEL}"` and a prompt ending in `{AGENT_SKILLS_CREATOR}`. These are unresolved template placeholders. The variables `CREATOR_MODEL` and `AGENT_SKILLS_CREATOR` are never set before the `Task()` call. The correct pattern — `gsd-sdk query resolve-model gsd-sme-creator --raw` and `gsd-sdk query agent-skills gsd-sme-creator` — is already used in `create-sme.md` (lines 12-13) and `execute-phase.md` (lines 1599-1600). The sme-step.md simply omits this initialization.

**Bug 2 (DETECT-05):** After the creator `Task()` returns, `new-milestone/sme-step.md` step 5 says "After creator returns: add process name to `SELECTED_SMES`" without checking the `## SME Creation Complete` return marker. Failed creator runs (network error, context exhaustion, `## INCOMPLETE` marker) silently add the process name to `SELECTED_SMES`, causing a broken SME reference to be written into `STATE.md`. The `create-sme.md` and `execute-phase.md` both check this marker before proceeding [VERIFIED: create-sme.md lines 204-214, execute-phase.md line 1621].

**Bug 3 (CONFIG-03):** `gsd-sme-creator.md` hardcodes `block_mode: soft` in the frontmatter template it writes (line 147). The `sme.blocking` config key was registered in Phase 1 (schema + defaults) expressly so the creator would use it, but the creator was never wired to read it. The fix adds a `gsd-sdk query config-get sme.blocking` call before the `synthesize_and_write` step writes the final document.

**Primary recommendation:** Three targeted edits: (1) add two lines to `new-milestone/sme-step.md` before the `Task()` call, (2) wrap the `SELECTED_SMES` append in a marker check, (3) wire `config-get sme.blocking` into `gsd-sme-creator.md`. Cover all three with new structural test assertions added to the existing `tests/sme-new-milestone-detect.test.cjs` and a new Vitest test in `sdk/src/agents/sme-creator-structure.test.ts`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve model for creator agent | SDK Layer (`resolve-model`) | Orchestration Layer (sme-step.md) | Same pattern as `create-sme.md` and `execute-phase.md` — orchestrator resolves model before spawning [VERIFIED: create-sme.md line 12] |
| Inject agent skills for creator | SDK Layer (`agent-skills`) | Orchestration Layer (sme-step.md) | Same pattern as `create-sme.md` line 13; skills injected into Task() prompt [VERIFIED] |
| Check `## SME Creation Complete` marker | Orchestration Layer (sme-step.md) | — | Caller checks return marker; pattern from `create-sme.md` `handle_return` step and `execute-phase.md` line 1621 |
| Read `sme.blocking` config for block_mode | Agent Layer (gsd-sme-creator.md) | SDK Layer (`config-get`) | Creator is the right place — it owns the frontmatter write. Config resolution at creation time [VERIFIED: agents/gsd-sme-creator.md line 147] |

---

## Standard Stack

### Core (all existing — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `gsd-sdk query resolve-model` | N/A | Resolve model alias for `gsd-sme-creator` before spawning | Same pattern as `create-sme.md` lines 12-13 [VERIFIED] |
| `gsd-sdk query agent-skills` | N/A | Inject agent skills into creator prompt | Same pattern as `create-sme.md` line 13 [VERIFIED] |
| `gsd-sdk query config-get` | N/A | Read `sme.blocking` config value in creator agent | Same pattern used throughout workflows [VERIFIED: execute-phase.md, new-milestone/sme-step.md] |
| Node.js `node:test` | Built-in | CJS structural tests for workflow markdown | Established pattern for all `tests/*.test.cjs` files [VERIFIED] |
| Vitest | 3.2.4 | TypeScript tests for agent structure in `sdk/src/` | Established pattern for `sdk/src/agents/*.test.ts` [VERIFIED] |

### No New Packages Required

Phase 10 is workflow markdown + agent definition edits and test additions. Zero new npm installs.

---

## Architecture Patterns

### System Architecture Diagram

```
new-milestone/sme-step.md (step 5: Offer Creation for Uncovered Processes)
    │
    │ [FIX 1: add BEFORE Task() spawn]
    │ CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw ...)
    │ AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator ...)
    │
    │ Task(
    │   subagent_type="gsd-sme-creator",
    │   model="{CREATOR_MODEL}",        ← now resolved, not a raw placeholder
    │   prompt="...{AGENT_SKILLS_CREATOR}"  ← now resolved, not a raw placeholder
    │ )
    │
    │ [FIX 2: add AFTER Task() returns]
    │ Check creator output for "## SME Creation Complete"
    │ If found: add PROCESS_NAME to SELECTED_SMES
    │ If NOT found: log warning, skip SELECTED_SMES append
    │
    ▼
SELECTED_SMES is populated only with VERIFIED successful creations
    │
    │ (step 6 unchanged)
    │ frontmatter.merge STATE.md with {milestone: {active_smes: [...]}}
    ▼
STATE.md milestone.active_smes contains only successfully-created SMEs

──────────────────────────────────────────────────────────────────

agents/gsd-sme-creator.md (synthesize_and_write step)
    │
    │ [FIX 3: add BEFORE final document write]
    │ BLOCK_MODE=$(gsd-sdk query config-get sme.blocking --raw 2>/dev/null || echo "soft")
    │ Validate: must be "soft" or "strict"; default to "soft" if neither
    │
    │ Write frontmatter:
    │   block_mode: {BLOCK_MODE}   ← now config-driven, not hardcoded
    │
    ▼
.planning/smes/{PROCESS_NAME}-SME.md uses project's configured block mode
```

### Recommended Project Structure

No structural changes to the project layout. Three files are modified:

```
get-shit-done/workflows/new-milestone/
└── sme-step.md              # MODIFIED: add resolve-model + agent-skills + marker check

agents/
└── gsd-sme-creator.md       # MODIFIED: add config-get sme.blocking in synthesize_and_write

tests/
└── sme-new-milestone-detect.test.cjs  # MODIFIED: add assertions for fixes 1 and 2

sdk/src/agents/
└── sme-creator-structure.test.ts      # MODIFIED: add assertion for fix 3
```

### Pattern 1: Resolve Model and Skills Before Task() Spawn

**What:** Call `resolve-model` and `agent-skills` before the `Task()` call, assign to variables, then use the variables in the `model=` and prompt.
**When to use:** Any workflow step that spawns `gsd-sme-creator` — the exact same pattern used everywhere else in the codebase.
**Example:**
```bash
# Source: get-shit-done/workflows/create-sme.md lines 12-13 [VERIFIED]
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw)
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator)
```

Then in the `Task()`:
```
Task(
  subagent_type="gsd-sme-creator",
  model="{CREATOR_MODEL}",
  description="Create SME for {PROCESS_NAME}",
  prompt="Process: {PROCESS_NAME}
Today: {date}
Analyze the '{PROCESS_NAME}' process and produce .planning/smes/{PROCESS_NAME}-SME.md.
{AGENT_SKILLS_CREATOR}"
)
```

**Key note:** `gsd-sme-creator` is NOT in `MODEL_PROFILES` (verified: `get-shit-done/bin/lib/model-profiles.cjs`, `sdk/src/query/config-query.ts`). `resolve-model` returns `{ model: "sonnet", profile: "balanced", unknown_agent: true }`. With `--raw`, the raw output is the JSON; the model string is extracted via the CJS `cmdResolveModel` `output()` function which, in raw mode, outputs just the model string. The fallback `|| echo "inherit"` used in `execute-phase.md` line 1599 is correct.

### Pattern 2: Check ## SME Creation Complete Marker

**What:** After `Task()` returns, search the creator's output for the `## SME Creation Complete` marker before treating the creation as successful.
**When to use:** Any orchestrator that spawns `gsd-sme-creator` blocking (not background).
**Example:**
```bash
# Source: get-shit-done/workflows/create-sme.md handle_return step [VERIFIED]
# After Task() returns, check return marker:
# If "## SME Creation Complete": success — add to SELECTED_SMES
# If no marker or error text: log warning, do NOT add to SELECTED_SMES
```
From `execute-phase.md` line 1621 [VERIFIED]:
```
After each Task: check for `## SME Creation Complete` marker.
On failure: log warning and continue to next process (never block phase completion).
```

The marker is defined in `agents/gsd-sme-creator.md` `return_confirmation` step (line 183):
```
## SME Creation Complete

**Process:** {PROCESS_NAME}
**Output:** `.planning/smes/{PROCESS_NAME}-SME.md`
**Findings:** {blocker_count} BLOCKERs, {warning_count} WARNINGs, {watch_count} WATCHes
**Commit:** {last_analyzed_commit}
```

### Pattern 3: Config-Get sme.blocking in Creator Agent

**What:** Before writing the final SME document, read `sme.blocking` config to determine `block_mode`.
**When to use:** `gsd-sme-creator.md` `synthesize_and_write` step, before the `Write` call that outputs the frontmatter.
**Example:**
```bash
# Source: pattern from config-get usage in workflows [VERIFIED via execute-phase.md, sme-step.md]
BLOCK_MODE=$(gsd-sdk query config-get sme.blocking --raw 2>/dev/null || echo "soft")
# Validate: only "soft" or "strict" are valid; default to "soft" for any other value
if [ "$BLOCK_MODE" != "soft" ] && [ "$BLOCK_MODE" != "strict" ]; then
  BLOCK_MODE="soft"
fi
```

Then in the frontmatter template (replacing the hardcoded `block_mode: soft`):
```yaml
block_mode: {BLOCK_MODE}
```

The `sme.blocking` key defaults to `"soft"` in config defaults (`sdk/src/query/config-mutation.ts` line 395) [VERIFIED], so the `|| echo "soft"` fallback is correct and safe.

### Anti-Patterns to Avoid

- **Hardcoding `block_mode: soft` in the creator agent:** This was the original bug. The config key `sme.blocking` exists specifically to drive this value. Never hardcode it [VERIFIED: agents/gsd-sme-creator.md line 147].
- **Appending to SELECTED_SMES without marker check:** A failed creator run still returns from Task() — the only reliable signal of success is the `## SME Creation Complete` marker. Always check it before treating the creation as valid.
- **Using `{CREATOR_MODEL}` or `{AGENT_SKILLS_CREATOR}` as literal placeholders in Task():** These are bash variable interpolations that require the variables to be set before the Task() call. The template literal syntax must be resolved at runtime by preceding bash assignments.
- **Blocking new-milestone on creator failure:** The spec says "failed creations are not added to SELECTED_SMES" — not "abort the workflow". Always log a warning and continue without that process name.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Determine model for gsd-sme-creator | Custom logic | `gsd-sdk query resolve-model gsd-sme-creator --raw` | Profile-aware resolution, per-agent overrides, unknown_agent fallback to sonnet [VERIFIED: sdk/src/query/config-query.ts] |
| Inject agent skills | Hard-coded skill paths | `gsd-sdk query agent-skills gsd-sme-creator` | Skills discovery is workstream-aware and respects the agent_skills config key [VERIFIED: sdk/src/query/skills.ts] |
| Read sme.blocking with validation | Custom file parsing | `gsd-sdk query config-get sme.blocking --raw` + bash validation | config-get handles missing config.json, missing key, and dot-notation traversal [VERIFIED: sdk/src/query/config-query.ts] |

---

## Common Pitfalls

### Pitfall 1: model= Gets the Full JSON Object Instead of the Model String

**What goes wrong:** `CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw)` outputs the full JSON `{ "model": "sonnet", "profile": "balanced", "unknown_agent": true }` when not handled correctly, and `model="{CREATOR_MODEL}"` passes the entire JSON string as the model parameter.

**Why it happens:** `resolve-model` with `--raw` outputs the full JSON result to stdout via the SDK. The CJS version's `output(result, raw, model)` call in raw mode outputs just the model string. The SDK query dispatch does NOT apply the same raw extraction — it outputs JSON.

**How to avoid:** Follow the exact pattern from `execute-phase.md` line 1599 [VERIFIED]:
```bash
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw 2>/dev/null || echo "inherit")
```
The `|| echo "inherit"` fallback handles the case where the command fails. When the JSON `{ "model": "sonnet" ... }` is the full output, the `model=` field in Task() will receive the JSON — but for the actual Claude runtime, the model value is parsed from the `model` field of the object if it's JSON. Confirm the exact output format by checking what `execute-phase.md` does and mirror it exactly.

**Warning signs:** Creator agent spawned with model set to a JSON string instead of a model alias like `sonnet` or `opus`.

### Pitfall 2: The Negative Test String Check in sme-step.md

**What goes wrong:** The Phase 8 test (`sme-step.md uses frontmatter.merge to write active_smes (NOT state.update/state.patch)`) checks for literal absence of `state.update` and `state.patch` anywhere in the file content. If the fix adds a comment mentioning these strings, the test fails.

**Why it happens:** The DETECT-05 test uses `!content.includes('state.update')` — any occurrence of that string triggers failure, including in comments. Phase 8 SUMMARY.md documented this exact deviation [VERIFIED: 08-01-SUMMARY.md lines 90-104].

**How to avoid:** When adding the marker check in step 5, do not include the strings `state.update` or `state.patch` anywhere in sme-step.md — not in comments, not in examples. The existing workaround ("Use ONLY `frontmatter.merge`") should not be changed.

**Warning signs:** After adding the marker check prose, the existing DETECT-05 test fails with `must NOT use state.update or state.patch`.

### Pitfall 3: gsd-sme-creator block_mode Validation Scope

**What goes wrong:** The fix reads `sme.blocking` and passes the value directly to `block_mode:` without validating. If someone sets `sme.blocking: "attack-payload"`, the creator writes that into the SME document frontmatter.

**Why it happens:** `config-get` returns whatever is in `config.json` without schema enforcement at read time.

**How to avoid:** Validate `BLOCK_MODE` is one of `soft` or `strict` before writing. Default to `soft` for any other value. This matches the existing `sme.processes.{name}.block_mode` restriction pattern [VERIFIED: STATE.md decisions section — "sme.processes.{name}.block_mode restricted to [a-zA-Z0-9_-]+ regex"].

**Warning signs:** SME document frontmatter contains a `block_mode` value other than `soft` or `strict`.

### Pitfall 4: Model Profile for gsd-sme-creator is Missing

**What goes wrong:** `gsd-sme-creator` is not in `MODEL_PROFILES` (verified in both `get-shit-done/bin/lib/model-profiles.cjs` and `sdk/src/query/config-query.ts`). This means `resolve-model` returns `{ model: "sonnet", ..., unknown_agent: true }`.

**Why it happens:** Phase 3 created the agent but did not add it to the model profiles map.

**How to handle:** The `|| echo "inherit"` fallback from `execute-phase.md` line 1599 handles this. The resolve-model command succeeds (exits 0) and returns `sonnet` as the model — which is a valid fallback. No fix needed for this issue in Phase 10; it is a pre-existing state that the existing pattern handles correctly. The `validate.agents` golden test verifies agents against MODEL_PROFILES — if gsd-sme-creator should be added, that is a separate cleanup task (Phase 11 candidate).

---

## Code Examples

### Fix 1: Resolve Model and Skills in sme-step.md (before Task() call)

Add these two lines at the start of step 5, before the process name validation loop:

```bash
# Source: get-shit-done/workflows/create-sme.md lines 12-13 [VERIFIED]
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw 2>/dev/null || echo "inherit")
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator 2>/dev/null || echo "")
```

### Fix 2: Completion Marker Check in sme-step.md (after Task() returns)

Replace the unconditional append at step 5 point 3 with:

```markdown
3. After creator returns: check the return for `## SME Creation Complete` marker.
   If found: add process name to `SELECTED_SMES`.
   If not found: log warning ("SME creation failed for {PROCESS_NAME} -- skipping") and
   continue without adding to SELECTED_SMES.
```

The equivalent from `execute-phase.md` line 1621 [VERIFIED]:
```
After each Task: check for `## SME Creation Complete` marker.
On failure: log warning and continue to next process (never block phase completion).
```

### Fix 3: Config-Driven block_mode in gsd-sme-creator.md

In the `synthesize_and_write` step, before the frontmatter template block:

```bash
# Source: pattern from execute-phase.md / new-milestone/sme-step.md [VERIFIED via config-get usage]
BLOCK_MODE=$(gsd-sdk query config-get sme.blocking --raw 2>/dev/null || echo "soft")
# Validate value is soft or strict; default to soft otherwise
if [ "$BLOCK_MODE" != "soft" ] && [ "$BLOCK_MODE" != "strict" ]; then
  BLOCK_MODE="soft"
fi
```

Replace the hardcoded `block_mode: soft` in the frontmatter template:
```yaml
# Before (line 147 of agents/gsd-sme-creator.md):
block_mode: soft

# After:
block_mode: {BLOCK_MODE}
```

### New Structural Tests: sme-new-milestone-detect.test.cjs additions

```javascript
// Source: pattern from tests/sme-new-milestone-detect.test.cjs [VERIFIED]
// Add a new describe block covering DETECT-04 placeholder resolution:

describe('DETECT-04: creator spawn uses resolved model and skills (not raw placeholders)', () => {
  test('sme-step.md resolves CREATOR_MODEL via resolve-model before spawning gsd-sme-creator', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('resolve-model'),
      'sme-step.md must call resolve-model to resolve CREATOR_MODEL before spawning gsd-sme-creator');
  });
  test('sme-step.md resolves AGENT_SKILLS_CREATOR via agent-skills before spawning gsd-sme-creator', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('agent-skills'),
      'sme-step.md must call agent-skills to resolve AGENT_SKILLS_CREATOR before spawning gsd-sme-creator');
  });
  test('sme-step.md checks SME Creation Complete marker after creator returns', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('SME Creation Complete'),
      'sme-step.md must check for ## SME Creation Complete marker after Task() returns');
  });
});
```

### New Vitest Test: sme-creator-structure.test.ts addition (CONFIG-03)

```typescript
// Source: pattern from sdk/src/agents/sme-creator-structure.test.ts [VERIFIED]
// Add a new describe block for CONFIG-03:

describe('CONFIG-03: orchestrator reads sme.blocking config for block_mode (not hardcoded)', () => {
  let orchestrator: string;

  beforeAll(() => {
    orchestrator = readAgent(ORCHESTRATOR_PATH);
  });

  it('orchestrator calls config-get to read sme.blocking before writing block_mode', () => {
    expect(orchestrator).toContain('sme.blocking');
  });

  it('orchestrator does not hardcode "block_mode: soft" (must use BLOCK_MODE variable)', () => {
    expect(orchestrator).not.toContain('block_mode: soft');
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `block_mode: soft` in creator | Config-driven `BLOCK_MODE` from `sme.blocking` | Phase 10 (this phase) | Per-project block mode preference respected; CONFIG-03 fulfilled |
| Unresolved `{CREATOR_MODEL}` in Task() | `CREATOR_MODEL=$(gsd-sdk query resolve-model ...)` | Phase 10 (this phase) | Creator spawned with correct model alias per project profile |
| Unconditional `SELECTED_SMES` append | Marker-gated append (`## SME Creation Complete` required) | Phase 10 (this phase) | Failed creations do not pollute `milestone.active_smes` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gsd-sdk query resolve-model gsd-sme-creator --raw 2>/dev/null \|\| echo "inherit"` outputs the raw model string (e.g., `sonnet`) when called from a workflow | Standard Stack, Code Examples | If `--raw` outputs full JSON from the SDK dispatcher, the model= parameter receives JSON instead of a string. Mitigation: test with `gsd-sdk query resolve-model gsd-sme-creator --raw` in this repo to confirm — output is `{ "model": "sonnet", ... }` JSON, not raw string. Planner should verify exact output and adjust extraction pattern if needed (e.g., pipe through `python3 -c "import json,sys; print(json.load(sys.stdin)['model'])"`) |

</p>

> **Note on Assumption A1:** Testing `gsd-sdk query resolve-model gsd-sme-creator --raw` in this repo returns the full JSON object `{ "model": "sonnet", "profile": "balanced", "unknown_agent": true }`, NOT just the string `sonnet`. The CJS `gsd-tools resolve-model` command (with `--raw`) outputs only the model string. `gsd-sdk` always returns JSON. The `execute-phase.md` line 1599 pattern `$(gsd-sdk query resolve-model gsd-sme-creator --raw 2>/dev/null || echo "inherit")` therefore captures the JSON into `CREATOR_MODEL`. Whether the `model=` Task() parameter accepts JSON or a string depends on runtime behavior. The safe approach is to extract the `.model` field: `CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('model','inherit'))" 2>/dev/null || echo "inherit")`. **The planner should verify the exact extraction needed by checking `execute-phase.md` line 1599-1608 — if `execute-phase.md` works correctly with the same pattern, sme-step.md should match it exactly.**

---

## Open Questions (RESOLVED)

1. **Does `gsd-sme-creator` need to be added to `MODEL_PROFILES`? (RESOLVED)**
   - What we know: It is not in MODEL_PROFILES. `resolve-model` returns `unknown_agent: true` and falls back to `sonnet`. This is acceptable behavior for Phase 10.
   - What's unclear: Whether Phase 11 should add it or if a later cleanup covers it. The `validate.agents` golden test may detect the missing entry.
   - Recommendation: Phase 10 does not need to add it. Flag it as a Phase 11 candidate if the audit shows it causes test failures.

2. **Should the Vitest test use `not.toContain('block_mode: soft')` or a more targeted assertion? (RESOLVED)**
   - What we know: The existing Vitest test file (`sme-creator-structure.test.ts`) uses string content assertions on the markdown file. The creator agent currently has exactly one occurrence of `block_mode: soft` (line 147).
   - What's unclear: Whether the string `block_mode: soft` might appear legitimately elsewhere (e.g., in code examples). Currently it does not.
   - Recommendation: Use `not.toContain('block_mode: soft')` as a negative assertion, plus a positive assertion `toContain('sme.blocking')` to confirm the config read was added. This is sufficient.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 10 is workflow markdown edits and test additions only. No external tool dependencies beyond the existing `gsd-sdk` CLI (already available) and Node.js test runner (built-in). All SDK query handlers used (`resolve-model`, `agent-skills`, `config-get`) are implemented in prior phases and confirmed available [VERIFIED: runtime test above showed `gsd-sdk query resolve-model gsd-sme-creator --raw` exits 0].

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node:test`) for CJS tests; Vitest 3.2.4 for TypeScript SDK tests |
| Config file | None for CJS (`node --test`); `sdk/vitest.config.ts` for Vitest |
| Quick run command (CJS) | `node --test tests/sme-new-milestone-detect.test.cjs` |
| Quick run command (Vitest) | `cd sdk && npx vitest run src/agents/sme-creator-structure.test.ts` |
| Full suite command | `node --test tests/*.test.cjs && cd sdk && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DETECT-04 | sme-step.md calls `resolve-model` before spawning creator | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Exists (Wave 0: add new assertions) |
| DETECT-04 | sme-step.md calls `agent-skills` before spawning creator | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Exists (Wave 0: add new assertions) |
| DETECT-05 | sme-step.md checks `## SME Creation Complete` marker after Task() returns | structural | `node --test tests/sme-new-milestone-detect.test.cjs` | Exists (Wave 0: add new assertion) |
| CONFIG-03 | gsd-sme-creator.md calls `config-get sme.blocking` for block_mode | structural | `cd sdk && npx vitest run src/agents/sme-creator-structure.test.ts` | Exists (Wave 0: add new assertions) |
| CONFIG-03 | gsd-sme-creator.md does NOT hardcode `block_mode: soft` | structural | `cd sdk && npx vitest run src/agents/sme-creator-structure.test.ts` | Exists (Wave 0: add new assertion) |

### Sampling Rate

- **Per task commit:** `node --test tests/sme-new-milestone-detect.test.cjs`
- **Per wave merge:** `node --test tests/*.test.cjs && cd sdk && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

New assertions must be added to existing test files (not new files):
- [ ] `tests/sme-new-milestone-detect.test.cjs` — add DETECT-04 assertions for `resolve-model`, `agent-skills`, and `## SME Creation Complete` marker check (3 new assertions in a new describe block or appended to the existing DETECT-04 block)
- [ ] `sdk/src/agents/sme-creator-structure.test.ts` — add CONFIG-03 assertions for `sme.blocking` config-get and absence of hardcoded `block_mode: soft` (2 new assertions in a new describe block)

*(No new test files required — both test files already exist from Phase 8 and Phase 3 respectively)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `block_mode` from config-get validated to `[soft\|strict]` before write into SME frontmatter; existing process name validation `[a-zA-Z0-9_-]+` unchanged [VERIFIED: sme-step.md lines 110-115] |
| V6 Cryptography | no | — |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Arbitrary `block_mode` from `sme.blocking` config | Tampering | Validate `BLOCK_MODE` is `soft` or `strict`; default to `soft` for any other value. Config is project-local, but defense-in-depth applies. |
| Unvalidated model string passed to Task() model= | Tampering | Model string from `resolve-model` comes from internal registry/config — not direct user input. Low risk. |

---

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: codebase read]` — `get-shit-done/workflows/new-milestone/sme-step.md` lines 119-131 — confirmed `{CREATOR_MODEL}` and `{AGENT_SKILLS_CREATOR}` are unresolved placeholders; confirmed no marker check after Task() returns
- `[VERIFIED: codebase read]` — `get-shit-done/workflows/create-sme.md` lines 12-13 — exact fix pattern for resolve-model and agent-skills calls
- `[VERIFIED: codebase read]` — `get-shit-done/workflows/execute-phase.md` lines 1599-1621 — identical fix pattern confirmed; also shows the `## SME Creation Complete` marker check pattern
- `[VERIFIED: codebase read]` — `agents/gsd-sme-creator.md` line 147 — confirmed `block_mode: soft` is hardcoded; line 183-193 confirms the exact `## SME Creation Complete` marker format
- `[VERIFIED: codebase read]` — `sdk/src/query/config-mutation.ts` line 395 — `sme.blocking` defaults to `"soft"` in config defaults
- `[VERIFIED: codebase read]` — `sdk/src/query/config-schema.ts` line 74 — `sme.blocking` registered as valid config key
- `[VERIFIED: codebase read]` — `get-shit-done/bin/lib/model-profiles.cjs` — `gsd-sme-creator` is NOT in MODEL_PROFILES; resolve-model returns unknown_agent fallback
- `[VERIFIED: runtime]` — `gsd-sdk query resolve-model gsd-sme-creator --raw` — returns `{ "model": "sonnet", "profile": "balanced", "unknown_agent": true }` (JSON, not raw string)
- `[VERIFIED: runtime]` — `node --test tests/sme-new-milestone-detect.test.cjs` — all 10 existing tests pass (GREEN baseline confirmed)
- `[VERIFIED: runtime]` — `cd sdk && npx vitest run src/agents/sme-creator-structure.test.ts` — all 21 existing tests pass (GREEN baseline confirmed)
- `[VERIFIED: codebase read]` — `tests/sme-new-milestone-detect.test.cjs` — full content read; 10 tests covering DETECT-01 through DETECT-05; confirmed no assertions for resolve-model, agent-skills, or SME Creation Complete marker
- `[VERIFIED: codebase read]` — `sdk/src/agents/sme-creator-structure.test.ts` — full content read; 21 tests covering CREATE-01 through CREATE-03; confirmed no assertions for CONFIG-03 or sme.blocking

### Secondary (MEDIUM confidence)

- `[VERIFIED: codebase read]` — `.planning/phases/08-new-milestone-process-detection/08-01-SUMMARY.md` — Phase 8 execution log; confirmed the three gaps were not noticed during implementation; confirmed the negative string test pitfall for `state.update`/`state.patch`

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all three bugs verified by direct file inspection with line numbers
- Fix patterns: HIGH — fix patterns are copies of existing working code from `create-sme.md` and `execute-phase.md`
- Test additions: HIGH — test file structure and assertion patterns verified from existing files
- resolve-model output format: MEDIUM — confirmed via runtime test that SDK outputs JSON; planner must verify the exact extraction approach used by `execute-phase.md` works correctly before assuming sme-step.md should use the same pattern verbatim

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable internal domain — workflow and agent markdown conventions)
