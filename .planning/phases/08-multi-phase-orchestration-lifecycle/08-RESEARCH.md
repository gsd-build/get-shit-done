# Phase 8: Multi-Phase Orchestration & Lifecycle - Research

**Researched:** 2025-07-14
**Domain:** Copilot workflow orchestration — markdown instruction file editing
**Confidence:** HIGH

## Summary

Phase 8 completes the autonomous workflow by adding lifecycle automation after all phases finish, fixing the progress bar calculation for `--from N` resume scenarios, and adding documentation for the smart_discuss relationship to discuss-phase. The entire scope is modifications to a single file: `get-shit-done/workflows/autonomous.md` (currently 630 lines).

The core change replaces the current "all phases complete" banner (lines 564-577) with automatic lifecycle invocation: `audit-milestone` → route on result → `complete-milestone` → `cleanup`, all via `Skill()` flat calls matching the existing pattern. This requires audit result detection (read the generated YAML frontmatter), user-facing routing for the 3 audit outcomes (passed/gaps_found/tech_debt), and a lifecycle transition banner.

**Primary recommendation:** Make surgical edits to autonomous.md — replace the completion banner in the iterate step with lifecycle logic, fix the progress bar formula in execute_phase, and add a one-line documentation comment to smart_discuss.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- After all phases complete, **automatically invoke audit→complete→cleanup** via Skill() flat calls
- **audit-milestone**: `Skill(skill="gsd:audit-milestone")` — reads all phase verifications, produces audit report
- **Audit result routing** — 3 outcomes:
  - `passed` → auto-continue to complete-milestone
  - `gaps_found` → AskUserQuestion: fix gaps / continue anyway / stop
  - `tech_debt` → show debt summary, ask if continue
- **complete-milestone**: `Skill(skill="gsd:complete-milestone")` — evolves PROJECT.md, reorganizes ROADMAP, archives milestone. Interactions surface naturally through Skill()
- **cleanup**: `Skill(skill="gsd:cleanup")` — cleanup shows dry-run and asks user for approval internally (this pause is acceptable per CTRL-01 since it's an explicit decision)
- Display lifecycle banner before starting: "All phases complete → Starting lifecycle: audit → complete → cleanup"
- **Smart discuss inline is NOT a CTRL-03 violation** — CTRL-03 means "don't modify existing skill files (discuss-phase.md, plan-phase.md, execute-phase.md)." Smart discuss is new code in autonomous.md that produces identical CONTEXT.md output
- **Keep inline in v1.24** — extraction to separate skill deferred to future milestone if needed
- **Document the relationship** — add comment in smart_discuss step noting it's an autonomous-optimized variant of discuss-phase
- **Fix progress bar on resume** — calculate progress relative to total milestone phases (e.g., "Phase 6/8"), not just remaining incomplete phases
- **Gap closure auto-retry (1 attempt) is acceptable** — it's a technical retry, not an unnecessary confirmation
- **No CTRL+C trap needed** — handle_blocker's "Stop autonomous mode" + terminal's natural CTRL+C are sufficient
- **Lifecycle banner**: Show transition banner when moving from phases to lifecycle

### Claude's Discretion
- Exact lifecycle banner wording and formatting
- How to detect audit result (parse audit output or read audit file)
- Final completion banner design after lifecycle completes
- Whether to show timing summary (elapsed time for full run)

### Deferred Ideas (OUT OF SCOPE)
- Extract smart_discuss to separate skill (possible future milestone)
- CTRL+C trap with state persistence (unnecessary complexity for v1.24)
- Timing summary (elapsed time tracking — not requested by user)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-01 | User can run gsd-autonomous to execute all remaining phases without manual invocation | Already works from Phases 5-7. Phase 8 ensures the loop reaches lifecycle. No new code for this req — lifecycle completion IS the remaining gap. |
| ORCH-02 | Progress banners between phases showing what's running and what's next | Progress bar FIX needed: currently N/T uses incomplete-only counts. Must use total milestone phases for correct display on `--from N` resume. |
| ORCH-04 | System runs audit → complete → cleanup automatically after all phases finish | Core lifecycle logic: replace completion banner (lines 564-577) with Skill() calls for audit, complete, cleanup with result routing. |
| CTRL-01 | System only pauses for explicit user decisions | Audit routing pauses only on `gaps_found` and `tech_debt` (explicit decisions). Cleanup's internal confirmation is acceptable. Passed → auto-continue. |
| CTRL-02 | Emergency stop mechanism | Already exists via handle_blocker "Stop autonomous mode". Phase 8 just needs to ensure lifecycle steps also route failures to handle_blocker. |
| CTRL-03 | Preserve existing skill logic — delegates, doesn't reimplement | Add documentation comment to smart_discuss noting it's autonomous-optimized variant of discuss-phase, NOT a reimplementation violation. No existing skill files touched. |
</phase_requirements>

## Standard Stack

This is a markdown instruction file — no libraries or frameworks involved. The "stack" is:

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| autonomous.md | `get-shit-done/workflows/autonomous.md` | Main workflow file (630 lines) | Only file modified in this phase |
| Skill() calls | Inline in autonomous.md | Invoke other GSD skills | Established pattern (lines 152, 160, 225, 232) |
| gsd-tools.cjs | `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs` | CLI for init, roadmap, commit | Used throughout autonomous.md |
| AskUserQuestion | Copilot built-in | Interactive user prompts | Used for all decision points |

### Supporting Skills (invoked, NOT modified)
| Skill | Command | Workflow | Lines |
|-------|---------|----------|-------|
| audit-milestone | `commands/gsd/audit-milestone.md` | `workflows/audit-milestone.md` (331 lines) | Reads verifications, produces audit report |
| complete-milestone | `commands/gsd/complete-milestone.md` | `workflows/complete-milestone.md` (763 lines) | Archives milestone, tags release |
| cleanup | `commands/gsd/cleanup.md` | `workflows/cleanup.md` (153 lines) | Archives phase directories |

## Architecture Patterns

### Current Workflow Structure
```
autonomous.md (630 lines)
├── <step name="initialize">        — lines 15-52: parse args, bootstrap, startup banner
├── <step name="discover_phases">   — lines 54-105: roadmap analyze, filter incomplete
├── <step name="execute_phase">     — lines 107-255: discuss → plan → execute → verify loop
├── <step name="smart_discuss">     — lines 257-537: inline discuss with grey area proposals
├── <step name="iterate">           — lines 539-578: re-read roadmap, check blockers, loop or complete
└── <step name="handle_blocker">    — lines 580-611: retry/skip/stop options
```

### Pattern 1: Skill() Flat Invocation
**What:** All sub-skill calls use the `Skill()` flat call pattern
**When to use:** Every time autonomous.md delegates to another GSD skill
**Example (from existing code):**
```
Skill(skill="gsd:plan-phase", args="${PHASE_NUM}")
Skill(skill="gsd:execute-phase", args="${PHASE_NUM} --no-transition")
```

For lifecycle skills, the pattern will be:
```
Skill(skill="gsd:audit-milestone")
Skill(skill="gsd:complete-milestone", args="${milestone_version}")
Skill(skill="gsd:cleanup")
```

**Note on args:** audit-milestone and cleanup take no required args. complete-milestone takes version — `milestone_version` is already parsed in the `initialize` step (line 34).

### Pattern 2: AskUserQuestion for Decision Points
**What:** Multi-option user prompts with structured routing
**When to use:** When user must decide between 2-4 options
**Example (from gaps_found routing, lines 218-253):**
```
AskUserQuestion:
  question: "Gaps found in phase ${PHASE_NUM}. How to proceed?"
  options: "Run gap closure" / "Continue without fixing" / "Stop autonomous mode"
```

### Pattern 3: Bash-Based State Detection
**What:** Read file frontmatter/status via grep + bash
**When to use:** After a Skill() call produces output files
**Example (from execute_phase, lines 166-178):**
```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

### Pattern 4: Banner Display
**What:** Consistent visual separators for progress/transition/completion
**When to use:** At every major state transition
**Example (from current completion, lines 567-577):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ COMPLETE ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Anti-Patterns to Avoid
- **Don't modify skill files:** CTRL-03 explicitly forbids touching audit-milestone.md, complete-milestone.md, or cleanup.md workflows/commands
- **Don't reimplement skill logic:** The Skill() call delegates entirely — autonomous.md only routes on the results, never duplicates the skill's internal logic
- **Don't add unnecessary pauses:** CTRL-01 means no confirmations that aren't explicit decisions. `passed` audit goes straight to complete-milestone without asking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit logic | Custom verification aggregation | `Skill(skill="gsd:audit-milestone")` | 331-line workflow handles all edge cases |
| Milestone archiving | Manual file moves and tagging | `Skill(skill="gsd:complete-milestone")` | 763-line workflow with full PROJECT.md evolution |
| Phase cleanup | Custom directory archival | `Skill(skill="gsd:cleanup")` | Handles milestone membership detection, dry-run, confirmation |
| Audit result parsing | Complex JSON parsing | Simple `grep "^status:"` on YAML frontmatter | Audit file has well-defined YAML frontmatter with `status:` field |

**Key insight:** All three lifecycle skills are fully self-contained with their own internal interaction patterns (confirmations, option menus). Autonomous.md just invokes them sequentially and routes on results.

## Common Pitfalls

### Pitfall 1: Audit File Naming Ambiguity
**What goes wrong:** The audit workflow template (line 156) shows `v{version}-v{version}-MILESTONE-AUDIT.md` (double prefix typo), but all other references (lines 213, 236, 275, 287) use `v{version}-MILESTONE-AUDIT.md`.
**Why it happens:** Copy-paste error in the audit workflow template text.
**How to avoid:** Use the canonical path `.planning/v${milestone_version}-MILESTONE-AUDIT.md` which matches the complete-milestone.md reference (line 44) and all other audit workflow references.
**Warning signs:** `grep "^status:"` returns empty — check file path.

### Pitfall 2: Progress Bar N/T Calculation on Resume
**What goes wrong:** Current formula (line 119) uses N=position among incomplete phases and T=total incomplete. When resuming with `--from 6` on an 8-phase milestone where 5 are done, you'd see "Phase 1/3" instead of "Phase 6/8".
**Why it happens:** The discover_phases step filters to incomplete, and execute_phase counts position within that filtered list.
**How to avoid:** N should be the current phase's position among ALL milestone phases (use `phase_count` from init), T should be `phase_count` (total milestone phases, not just incomplete count). The `phase_count` is already available from the `initialize` step.
**Warning signs:** Progress shows "Phase 1/3" when user expects "Phase 6/8" on resume.

### Pitfall 3: complete-milestone Needs Version Arg
**What goes wrong:** Invoking `Skill(skill="gsd:complete-milestone")` without the version arg may cause the skill to prompt for it interactively, adding an unexpected pause.
**Why it happens:** complete-milestone.md command (line 5) shows `argument-hint: <version>`.
**How to avoid:** Always pass the version: `Skill(skill="gsd:complete-milestone", args="${milestone_version}")`. The `milestone_version` variable is already parsed in the initialize step (line 34).

### Pitfall 4: Audit Failure vs Audit "gaps_found"
**What goes wrong:** Confusing the audit skill crashing/failing (technical error) with the audit producing a `gaps_found` result (successful audit finding problems).
**Why it happens:** Both are "negative" outcomes but need different routing.
**How to avoid:** Technical failure (no audit file produced) → `handle_blocker`. Audit result `gaps_found` → user decision routing. Check file existence first, then status.

### Pitfall 5: Lifecycle Step Failures Need handle_blocker Routing
**What goes wrong:** If audit, complete, or cleanup skills fail (technical error), execution halts without recovery options.
**Why it happens:** Phase execution has handle_blocker; lifecycle steps might not.
**How to avoid:** After each Skill() call in the lifecycle, verify the expected output was produced. Route failures to handle_blocker with descriptive messages.

## Code Examples

### Exact Location: Iterate Step Replacement (lines 564-577)

**CURRENT** (to be replaced):
```markdown
If all phases complete, display completion banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ COMPLETE ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone {milestone_version}: {milestone_name}
 Phases completed: {total}
 Status: All phases executed successfully

 Next: /gsd:complete-milestone to finalize
```
```

**REPLACE WITH** lifecycle invocation logic (conceptual structure):
```markdown
If all phases complete, proceed to lifecycle step.
```

### Lifecycle Step (New — after iterate, before handle_blocker)

The new `<step name="lifecycle">` should:

1. Display transition banner
2. Invoke audit: `Skill(skill="gsd:audit-milestone")`
3. Detect audit result by reading the generated file
4. Route on 3 outcomes
5. Invoke complete: `Skill(skill="gsd:complete-milestone", args="${milestone_version}")`
6. Invoke cleanup: `Skill(skill="gsd:cleanup")`
7. Display final completion banner

**Audit result detection pattern:**
```bash
AUDIT_FILE=".planning/v${milestone_version}-MILESTONE-AUDIT.md"
AUDIT_STATUS=$(grep "^status:" "${AUDIT_FILE}" 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

**Routing logic:**
- `AUDIT_STATUS` is empty / file doesn't exist → handle_blocker: "Audit did not produce results"
- `passed` → auto-continue to complete-milestone (NO user pause per CTRL-01)
- `gaps_found` → AskUserQuestion with 3 options: "Fix gaps (plan-milestone-gaps)" / "Continue anyway" / "Stop"
- `tech_debt` → Show summary, AskUserQuestion: "Continue with tech debt" / "Address debt first" / "Stop"

### Progress Bar Fix (line 119)

**CURRENT:**
```
Where N = current phase position (1-based among incomplete), T = total phases, P = percentage complete.
```

**REPLACE WITH:**
```
Where N = current phase number, T = total milestone phases (from phase_count in initialize), P = (phases completed so far / T * 100). Calculate phases completed = number of phases with disk_status "complete" from the latest roadmap analyze.
```

### Smart Discuss Documentation (line 259-261)

**CURRENT:**
```markdown
## Smart Discuss

Run smart discuss for the current phase. Proposes grey area answers in batch tables — the user accepts or overrides per area. Produces identical CONTEXT.md output to regular discuss-phase.
```

**ADD after the existing description:**
```markdown
> **Note:** Smart discuss is an autonomous-optimized variant of the `gsd:discuss-phase` skill. It produces identical CONTEXT.md output but uses batch table proposals instead of sequential questioning. The original `discuss-phase` skill remains unchanged (per CTRL-03). Future milestones may extract this to a separate skill file.
```

## Detailed Edit Map

Summary of all changes needed in `autonomous.md`:

| # | Location | Lines | Change Type | Description |
|---|----------|-------|-------------|-------------|
| 1 | execute_phase progress bar | ~115-119 | Edit | Fix N/T formula to use total milestone phases |
| 2 | smart_discuss header | ~259-261 | Add | Document relationship to discuss-phase |
| 3 | iterate — completion banner | ~564-577 | Replace | Replace static banner with lifecycle invocation |
| 4 | New step: lifecycle | After iterate | Add | Full lifecycle step (audit → route → complete → cleanup) |
| 5 | success_criteria | ~615-630 | Edit | Add lifecycle criteria to the checklist |

### Estimated Size Impact
- Lines removed: ~13 (old completion banner)
- Lines added: ~80-100 (lifecycle step + routing + banners)
- Net change: ~70-90 lines added (total ≈ 700-720 lines)

## Open Questions

1. **Lifecycle banner exact wording**
   - What we know: User wants "All phases complete → Starting lifecycle: audit → complete → cleanup" message
   - What's unclear: Exact formatting — full-width bar style like existing banners, or lighter?
   - Recommendation: Use the established `━━━` banner style for consistency. Claude's discretion per CONTEXT.md.

2. **Final completion banner after lifecycle**
   - What we know: After cleanup succeeds, there should be a final "done" message
   - What's unclear: What info to include — just "done" or milestone stats?
   - Recommendation: Show milestone name, phases completed, and "Milestone complete" status. Skip timing summary (deferred).

3. **gaps_found routing — "Fix gaps" path**
   - What we know: User gets option to fix gaps via `/gsd:plan-milestone-gaps`
   - What's unclear: Should autonomous.md invoke plan-milestone-gaps as a Skill(), or tell user to run it manually?
   - Recommendation: Show the suggestion as text ("Run /gsd:plan-milestone-gaps") + offer "Stop autonomous mode" so user can run it manually. Autonomous mode's purpose is the phase loop, not gap planning. This matches the audit workflow's own `<offer_next>` section.

## Validation Architecture

> `workflow.nyquist_validation` is not present in config.json — treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (markdown instruction files, no automated test runner) |
| Config file | N/A — this is a copilot prompt engineering project |
| Quick run command | Manual: read `autonomous.md` and verify structure |
| Full suite command | Manual: run `/gsd:autonomous` end-to-end |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORCH-01 | All remaining phases execute without manual invocation | manual-only | Run `/gsd:autonomous` and observe | N/A |
| ORCH-02 | Progress banners show correct N/T on resume | manual-only | Run `/gsd:autonomous --from 6` and verify banner shows "Phase 6/8" | N/A |
| ORCH-04 | Audit→complete→cleanup runs after phases | manual-only | Complete all phases, observe lifecycle auto-trigger | N/A |
| CTRL-01 | Only pauses for explicit decisions | manual-only | Verify `passed` audit auto-continues; `gaps_found` asks user | N/A |
| CTRL-02 | Emergency stop available | manual-only | Verify handle_blocker reachable from lifecycle steps | N/A |
| CTRL-03 | Existing skills unchanged | manual-only | `git diff` on audit/complete/cleanup files shows no changes | N/A |

**Justification for manual-only:** This project consists of markdown prompt files consumed by a Copilot runtime. There is no automated test framework — validation is through reading the instructions and running the skill in Claude. The VERIFICATION.md produced by execute-phase serves as the validation record.

### Sampling Rate
- **Per task commit:** Review the diff of autonomous.md for correctness
- **Per wave merge:** Read full autonomous.md to verify coherence
- **Phase gate:** All 6 requirements verified manually against the modified file

### Wave 0 Gaps
None — no automated test infrastructure applicable to this project type.

## Sources

### Primary (HIGH confidence)
- `get-shit-done/workflows/autonomous.md` — full file read, line-by-line analysis of current 630-line structure
- `get-shit-done/workflows/audit-milestone.md` — full 332-line workflow read, YAML frontmatter format for status detection
- `get-shit-done/workflows/complete-milestone.md` — first 200 lines read, understood args and flow
- `get-shit-done/workflows/cleanup.md` — full 153-line workflow read, understood dry-run + confirmation flow
- `commands/gsd/audit-milestone.md` — command definition, no required args
- `commands/gsd/complete-milestone.md` — command definition, takes `<version>` arg
- `commands/gsd/cleanup.md` — command definition, no required args
- `.planning/phases/08-multi-phase-orchestration-lifecycle/08-CONTEXT.md` — all decisions and code context references

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — traceability table confirms ORCH-01, ORCH-02, ORCH-04, CTRL-01, CTRL-02, CTRL-03 assigned to Phase 8

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — single file modification, all patterns directly observed
- Architecture: HIGH — existing autonomous.md structure thoroughly analyzed
- Pitfalls: HIGH — specific line numbers and edge cases identified from code
- Code examples: HIGH — direct quotes from existing file with exact replacements

**Research date:** 2025-07-14
**Valid until:** 2025-08-14 (stable — markdown instruction files, no external dependencies)
