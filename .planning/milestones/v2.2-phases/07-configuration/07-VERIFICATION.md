---
phase: 07-configuration
verified: 2026-02-17T14:00:00Z
status: gaps_found
score: 8/9 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 9/9 automated (score field was 8/9 in frontmatter — error corrected)
  adversary_revision: true
  adversary_challenges_addressed:
    - "Challenge 1 (BLOCKING): Corrected contradictory score fields — frontmatter now reflects 8/9 after SC3 reclassified as a gap"
    - "Challenge 2 (MAJOR): Clarified 7 PLAN CLI tests + 1 bonus --raw test = 8 rows in table"
    - "Challenge 3 (MAJOR): Truth #3 downgraded — evidence was static code only, no dynamic test"
    - "Challenge 4 (MAJOR): --raw output format contract documented"
    - "Challenge 5 (MAJOR): SC3 reclassified from human_needed to gaps_found — Phase 7 does not satisfy it"
  gaps_closed: []
  gaps_remaining:
    - "SC3: Commands invoke configured agents at checkpoints — deferred to Phase 8"
gaps:
  - truth: "Commands read checkpoint-specific agent configuration and invoke only the configured agents (ROADMAP SC3)"
    status: failed
    reason: "Phase 7 delivers configuration infrastructure and the CLI resolution tool. No workflow command (new-project.md, plan-phase.md, execute-phase.md) has been updated to call 'coplanner agents' and act on the result. The PLAN explicitly defers agent invocation to Phase 8."
    artifacts:
      - path: "commands/gsd/new-project.md"
        issue: "Not updated — does not call coplanner agents at any checkpoint"
      - path: "commands/gsd/plan-phase.md"
        issue: "Not updated — does not call coplanner agents at plan checkpoint"
      - path: "commands/gsd/execute-phase.md"
        issue: "Not updated — does not call coplanner agents at any checkpoint"
    missing:
      - "Workflow commands must read checkpoint config via 'coplanner agents <checkpoint>' and invoke only the resolved agents"
      - "This is explicitly scoped to Phase 8 per the PLAN objective statement"
---

# Phase 7: Configuration Verification Report

**Phase Goal:** Users control exactly which external agents participate at which workflow checkpoints
**Verified:** 2026-02-17T14:00:00Z
**Status:** gaps_found (adversary revision — SC3 reclassified from human_needed to gap)
**Re-verification:** Yes — adversary revision after initial verification

## Adversary Revision Summary

Four adversary challenges revised conclusions:

- **Challenge 1 (BLOCKING — accepted):** Frontmatter `score: 8/9` contradicted body `9/9 automated`. Root cause: SC3 was being counted as automated-pass while simultaneously flagged as human-needed. After SC3 reclassification (Challenge 5), the correct score is 8/9 automated truths verified. Frontmatter now consistent with body.
- **Challenge 2 (MAJOR — accepted with clarification):** "All 7" in the functional test header was correct per PLAN numbering (items 1-7 are CLI tests; items 8-9 are template/settings checks covered by Truths 8-9). The 8th table row is a bonus `--raw` output test run beyond the 7. Header corrected to "All 7 PLAN CLI tests + 1 bonus --raw test."
- **Challenge 3 (MAJOR — accepted):** Truth #3 evidence was static code inspection only. The warning string exists at line 341, but no functional test exercised the "enabled but no agents" path dynamically. Truth #3 status downgraded to PARTIAL (code verified, behavior untested).
- **Challenge 4 (MAJOR — accepted):** `--raw` output format contract was not documented. Format pinned below.
- **Challenge 5 (MAJOR — accepted):** SC3 reclassified from human_needed to gaps_found. The PLAN explicitly says "Phase 8 workflows will consume this configuration to invoke the right agents at the right checkpoints." No workflow commands have been updated. SC3 is a Phase 8 deliverable.

## Goal Achievement

### Observable Truths (from PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `coplanner agents <checkpoint>` returns checkpoint-specific agents when configured | VERIFIED | Tested: config with `checkpoints.plan.agents: ["gemini"]` returns `["gemini"]` for plan; `["codex"]` (global) for requirements |
| 2 | `coplanner agents <checkpoint>` falls back to global agents list when no checkpoint override | VERIFIED | Tested: config with `agents: ["codex"], checkpoints: {}` returns `["codex"]` for any checkpoint |
| 3 | `coplanner agents <checkpoint>` returns empty array with warning when enabled but no agents | PARTIAL | Code at line 341: `warnings.push('co_planners enabled but no agents configured')` — string verified by static inspection only; no dynamic test exercised this path |
| 4 | `coplanner agents <checkpoint>` returns empty array when co_planners disabled (kill switch) | VERIFIED | Tested: `enabled: false` with agents configured still returns `{"agents": [], "warnings": []}` |
| 5 | `coplanner agents` (no argument) returns global agents list, skipping checkpoint-specific resolution | VERIFIED | Tested: null checkpoint with `enabled: true, agents: ["codex"]` returns `["codex"]` |
| 6 | Invalid agent names are filtered out with warnings, not errors | VERIFIED | Tested: `["codex", "fakeagent"]` returns `agents: ["codex"]` with warning about fakeagent |
| 7 | Unknown checkpoint names produce a warning and return empty agents | VERIFIED | Tested: `coplanner agents unknown` returns `agents: []` with "Unknown checkpoint 'unknown'" warning |
| 8 | Config template includes agents array and checkpoints object in co_planners section | VERIFIED | `get-shit-done/templates/config.json` lines 35-36: `"agents": []` and `"checkpoints": {}` |
| 9 | Commands read checkpoint-specific agent configuration and invoke only the configured agents (ROADMAP SC3) | FAILED | No workflow command updated. PLAN defers invocation to Phase 8. See gaps. |

**Score:** 8/9 truths verified (7 fully VERIFIED, 1 PARTIAL on dynamic behavior, 1 FAILED scoped to Phase 8)

### --raw Output Format Contract (Phase 8 Consumer Documentation)

The `coplanner agents <checkpoint> --raw` command outputs in one of two formats:

- **Agents present:** `agent1,agent2` — comma-separated agent names, no spaces, no brackets (e.g. `codex,gemini`)
- **No agents:** `none (reason)` — where `reason` is the first warning string, or `disabled` if no warnings

Source: `cmdCoplannerAgents` at line 5014-5020 in `get-shit-done/bin/gsd-tools.cjs`:
```javascript
if (result.agents.length > 0) {
  output(result, true, result.agents.join(',') + '\n');
} else {
  var reason = result.warnings.length > 0 ? result.warnings[0] : 'disabled';
  output(result, true, 'none (' + reason + ')\n');
}
```

Phase 8 workflows consuming this output must handle both formats. This format is now pinned.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `get-shit-done/bin/gsd-tools.cjs` | getAgentsForCheckpoint function, filterValidAgents helper, VALID_CHECKPOINTS constant, cmdCoplannerAgents command, updated CLI router | VERIFIED | Lines 255 (VALID_CHECKPOINTS), 289 (filterValidAgents), 302 (getAgentsForCheckpoint), 5012 (cmdCoplannerAgents), 5451 (CLI router 'agents' case) |
| `get-shit-done/templates/config.json` | Extended co_planners schema with agents and checkpoints | VERIFIED | Lines 35-36 confirm `"agents": []` and `"checkpoints": {}` |
| `commands/gsd/settings.md` | Co-planner settings questions with conditional flow | VERIFIED | Lines 132-303: full co-planner section with toggle, agent selection, per-checkpoint questions, merge rules, confirm display |
| `commands/gsd/new-project.md` | Invoke coplanner agents at configured checkpoints | MISSING | Not updated in Phase 7; deferred to Phase 8 |
| `commands/gsd/plan-phase.md` | Read plan checkpoint config and invoke only configured agents | MISSING | Not updated in Phase 7; deferred to Phase 8 |
| `commands/gsd/execute-phase.md` | Read checkpoint config and invoke only configured agents | MISSING | Not updated in Phase 7; deferred to Phase 8 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `getAgentsForCheckpoint()` | `SUPPORTED_CLIS` | filterValidAgents validates agent names | WIRED | Line 293: `SUPPORTED_CLIS.includes(agent)` inside filterValidAgents called from getAgentsForCheckpoint |
| `getAgentsForCheckpoint()` | `checkKillSwitch()` | kill switch check before resolving agents | WIRED | Lines 311-313: `var killSwitch = checkKillSwitch(cwd); if (!killSwitch.enabled) return {agents: [], warnings: []}` |
| `cmdCoplannerAgents()` | `getAgentsForCheckpoint()` | command delegates to resolution function | WIRED | Line 5013: `var result = getAgentsForCheckpoint(cwd, checkpointName)` |
| CLI router 'agents' case | `cmdCoplannerAgents()` | coplanner subcommand routing | WIRED | Lines 5451-5454: `case 'agents': { var checkpoint = args[2] !== undefined ? args[2] : null; cmdCoplannerAgents(cwd, checkpoint, raw); break; }` |
| Workflow commands | `coplanner agents <checkpoint>` | Phase 8 invocation | NOT_WIRED | No workflow command calls the resolution tool; deferred to Phase 8 |

4/5 key links wired. The workflow-to-CLI link is the Phase 8 gap.

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| CFG-01 (Per-checkpoint agent assignment) | PARTIAL | Config schema, resolution function, CLI subcommand, and settings UI all implemented. Workflow invocation deferred to Phase 8. |

### Anti-Patterns Found

No blockers or stubs in Phase 7 code additions. The grep scan of gsd-tools.cjs returned existing "placeholder" references in pre-Phase-7 todo management functions (cmdListTodos, cmdTodoComplete at lines 392, 1431, 1484) — not related to Phase 7 work. No `return null`, empty handlers, or TODO comments in the new functions (lines 289-346, 5012-5024, 5451-5454).

## Commit Verification

All 3 documented commits verified in git log:
- `dd1e2ca` feat(07-01): add coplanner agents subcommand with checkpoint resolution
- `949e014` feat(07-01): extend config template with agents and checkpoints schema
- `8fbac79` feat(07-01): add co-planner settings to settings command

## Functional Test Results

All 7 PLAN CLI tests (items 1-7) passed. 1 bonus `--raw` test run beyond PLAN scope. Items 8-9 (template and settings checks) are covered by Truths 8 and 9 respectively.

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | `coplanner agents plan` (disabled) returns `{"agents": [], "warnings": []}` | PASS | PLAN test 1 |
| 2 | Fallback: global agents returned when no checkpoint override | PASS | PLAN test 2 |
| 3 | Override: checkpoint-specific agents override global | PASS | PLAN test 3 |
| 4 | Invalid agent names filtered with warnings, valid ones returned | PASS | PLAN test 4 |
| 5 | Kill switch: `enabled: false` returns empty despite populated agents | PASS | PLAN test 5 |
| 6 | Null checkpoint: no argument returns global agents (no "Unknown checkpoint" warning) | PASS | PLAN test 6 |
| 7 | Invalid checkpoint: `coplanner agents bogus` returns empty + warning | PASS | PLAN test 7 |
| + | `coplanner agents plan --raw` prints `none (disabled)` | PASS | Bonus test beyond PLAN scope |

Note: No functional test exercised Truth #3 path ("enabled but no agents configured"). That path is code-verified only.

### Gaps Summary

Phase 7 successfully delivers the configuration infrastructure: the resolution function, CLI subcommand, config schema extension, and settings UI. What is missing is the workflow command integration that makes the configuration actionable — this is SC3 and was explicitly deferred to Phase 8 in the PLAN objective. The gap is structural, not a defect.

The one factual gap in Phase 7's own deliverables is the absence of a dynamic test for the "enabled but no agents" path (Truth #3). The code is present and correct by inspection, but was not exercised by a functional test during implementation.

**Phase 8 must deliver:**
1. Workflow command integration: `new-project.md`, `plan-phase.md`, `execute-phase.md` calling `coplanner agents <checkpoint> --raw` and routing to only the resolved agents
2. The `--raw` output format contract documented above must be treated as stable from this point forward

---

_Verified: 2026-02-17T14:00:00Z_
_Verifier: Claude (gsd-verifier) — adversary revision_
