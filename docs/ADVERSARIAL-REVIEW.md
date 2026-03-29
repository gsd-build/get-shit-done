# Adversarial Code Review: get-shit-done

**Date:** 2026-03-29
**Reviewer:** Tibsfox (Claude Opus 4.6, 1M context)
**Scope:** Core workflow logic, robustness for long-running projects, 1M context optimization, skill-creator feature portability
**Method:** Four parallel deep-dive agents, each reading 10-13 core files

---

## Executive Summary

GSD is architecturally ambitious and well-crafted for a prompt-driven workflow system. The four-phase pipeline (discuss -> plan -> execute -> verify) is thoughtfully designed with good separation of concerns. However, the system carries risks from three fundamental design constraints that were reasonable at inception but are now limiting:

1. **Filesystem-as-database with no transactional guarantees** -- STATE.md and ROADMAP.md can diverge on crash
2. **200k context window assumptions baked into every workflow** -- subagents are context-starved when 1M is available
3. **Verification that trusts its own optimism** -- the verifier can derive weak truths and confirm them

This review identifies **42 specific findings** across 4 categories, with actionable recommendations prioritized by impact and effort.

---

## Part 1: Critical Infrastructure Issues

### 1.1 No Atomic State Transitions (CRITICAL)

`cmdPhaseComplete` in `phase.cjs:629` performs 4 sequential file writes (ROADMAP.md, REQUIREMENTS.md, STATE.md, output) with no rollback. A crash between writes 1 and 3 leaves the project in an inconsistent state that no automated repair can fix.

The executor agent compounds this: it runs 6 separate `gsd-tools` commands sequentially (`state advance-plan`, `state update-progress`, `state record-metric`, `state add-decision`, `state record-session`, `roadmap update-plan-progress`). Any failure mid-sequence leaves STATE.md and ROADMAP.md inconsistent.

**Fix:** The `withPlanningLock` function already exists at `core.cjs:497` but is **never called by any production code**. Wire it into all multi-file update paths.

### 1.2 Parallel Agents Race on Shared State (HIGH)

STATE.md's `writeStateMd` (state.cjs:789) has a file lock -- but only around the write. The read happens outside the lock. Classic lost-update problem:

```
Agent A reads STATE.md (plan count: 2/5)
Agent B reads STATE.md (plan count: 2/5)
Agent A writes STATE.md (plan count: 3/5)
Agent B writes STATE.md (plan count: 3/5) -- clobbers A's update
```

**ROADMAP.md has no locking at all.** Five separate write paths (`phase.cjs:368,451,561,712`, `roadmap.cjs:313`) use plain `fs.writeFileSync`.

**Fix:** Move STATE.md read inside the lock. Apply same locking to ROADMAP.md writes.

### 1.3 O(n^2) normalizeMd (HIGH)

`normalizeMd` (core.cjs:354) is called on every STATE.md write. For each fenced code block line, `isInsideFencedBlock` scans from line 0 to the current position. A 500-line STATE.md with 10 code blocks does ~2500 line scans per write.

**Fix:** Single-pass fence tracker maintaining state as it iterates.

### 1.4 Bespoke YAML Parser Fragility (HIGH)

`parseMustHavesBlock` (frontmatter.cjs:163-252) is a hand-rolled YAML parser. When it silently fails on LLM-generated YAML (extra blank line, colon in value, mixed indentation), must_haves returns empty and verification degrades to Option C (LLM-derived truths) **without any warning to the user**.

**Fix:** Log when must_haves parsing returns empty for a plan that has a must_haves block.

---

## Part 2: Verification Trust Boundary Issues

### 2.1 Verification Can Be Trivially Satisfied

Three compounding weaknesses:

| Gap | Detail |
|-----|--------|
| **Option C must-haves** | When no must_haves in PLAN frontmatter and no success criteria in ROADMAP, verifier derives its own truths. It then checks those self-invented truths. |
| **Stub detection is grep-based** | Checks `return null|return {}|return []|=> {}`. A `return data \|\| []` passes all checks. |
| **Key link verification is substring matching** | `sourceContent.includes(link.to)` -- a comment like `// TODO: connect to api/chat` satisfies the wiring check. |
| **Executor self-check is self-grading** | Executor writes SUMMARY.md AND the files, then checks if the files it listed exist. Orchestrator spot-checks only 2 files. |

Issue #1457 (circular tests + it.skip) is a real-world manifestation -- a financial migration marked COMPLETE with zero actual parity tests.

### 2.2 Auto-Mode Bypasses All Human Checkpoints

When `_auto_chain_active` or `workflow.auto_advance` is true, `checkpoint:human-verify` tasks are auto-approved and `checkpoint:decision` tasks auto-select the first option. The planner decides the answer to questions specifically marked as requiring human input. Only `checkpoint:human-action` (auth gates) survives.

### 2.3 Plan Checker Is Advisory, Not Blocking

After 3 revision iterations, if the checker still finds issues, the workflow proceeds with imperfect plans. There is no mechanism for the checker to block execution.

---

## Part 3: 1M Context Window Opportunities

### The Core Problem

GSD was designed for 200k context windows. Every workflow aggressively conserves context: thin orchestrators at 10-15%, 2-3 tasks per plan to stay under 50%, path-only delegation to subagents, and frequent `/clear` recommendations. With 1M tokens (5x), these constraints are now unnecessarily limiting quality.

### 3.1 Context Starvation (What Subagents Don't Get)

| Agent | What it gets | What it should get with 1M |
|-------|-------------|---------------------------|
| **Executor (Wave 2+)** | Current plan, PROJECT.md, STATE.md | + Wave 1 SUMMARY.md files, CONTEXT.md, RESEARCH.md |
| **Verifier** | Phase dir + goal (sparse prompt, no files_to_read) | + All PLANs, SUMMARYs, CONTEXT.md, RESEARCH.md pitfalls, REQUIREMENTS.md, prior VERIFICATION.md |
| **Researcher** | CONTEXT.md, REQUIREMENTS.md, STATE.md | + Prior phase RESEARCH.md files (avoid re-investigating known stack) |
| **Planner** | Current CONTEXT.md only | + Prior phase CONTEXT.md files (cross-phase decision consistency) |

A phase with 5 plans producing 2k-token SUMMARYs adds only 10k tokens -- negligible in a 1M window.

### 3.2 Context Waste (What Could Be Eliminated)

- **Duplicate init calls**: Every subagent re-runs `init` to get paths the orchestrator already had
- **Repeated CLAUDE.md/skills reads**: 4-6 agents per phase independently read the same files
- **Verbose boilerplate**: 30-line prompt templates repeated identically per executor spawn

### 3.3 What Becomes Possible

| Opportunity | Impact | Effort |
|-------------|--------|--------|
| **Cross-phase summaries for executors** | Wave 2+ agents understand what Wave 1 built | LOW -- add SUMMARY paths to executor prompt |
| **History-aware verification** | Full traceability: requirements -> decisions -> plans -> execution | LOW -- add files_to_read to verifier spawn |
| **Richer plans** | 4-5 tasks per plan (was 2-3), embedded code examples | MEDIUM -- adjust planner rules |
| **Inline small phases** | Execute 1-3 plan phases without spawning agents | MEDIUM -- orchestrator logic |
| **Planner+checker collapse** | Self-check with embedded criteria for 1M models | MEDIUM -- conditional agent spawning |
| **Full context chain** | discuss prior_context flows through plan -> execute -> verify | MEDIUM -- serialize digest block |

### 3.4 The `context_window` Config Exists But Is Never Used

`core.cjs:218` has `context_window` defaulting to 200000, loaded into init JSON. But **no workflow reads it to change behavior**. The conditional logic should be:

```
IF context_window >= 500000:
  - Include prior SUMMARYs and CONTEXT.md in executor/verifier prompts
  - Expand plan size limits (4-5 tasks)
  - Consider inline execution for <=3 plan phases
  - Embed CLAUDE.md content directly in subagent prompts
  - Skip separate plan-checker (embed criteria in planner prompt)

IF context_window < 500000:
  - Current behavior (path-only delegation, aggressive compression)
```

### 3.5 No Runtime Model Detection

There is no auto-detection of which model is running. The `context_window` config must be manually set. GSD should detect the model and auto-set context_window when at the default.

---

## Part 4: Skill-Creator Features to Upstream

### Tier 1: Ready Now (high value, zero dependencies)

| Feature | Source | Lines | Value |
|---------|--------|-------|-------|
| **Session orientation hook** | `hooks/session-state.sh` | 22 | Immediate session orientation -- GSD has no SessionStart hook today |
| **Commit validation hook** | `hooks/validate-commit.sh` | 33 | Enforces Conventional Commits that every GSD project documents |
| **Context monitor hook** | `hooks/gsd-context-monitor.js` | 122 | Prevents context exhaustion mid-plan -- debounce, severity escalation, stale-data rejection |
| **Statusline** | `hooks/gsd-statusline.js` | 339 | Persistent GSD phase/plan/status/progress display |
| **Update check hook** | `hooks/gsd-check-update.js` | 63 | Background update notifications |
| **Phase boundary hook** | `hooks/phase-boundary-check.sh` | 14 | Warns when .planning/ files modified (remove 1 skill-creator-specific line) |

Total: ~593 lines of well-tested code. Zero skill-creator dependencies.

### Tier 2: Worth Adapting

| Feature | Current Form | Upstream Form | Effort |
|---------|-------------|---------------|--------|
| **Phase smart router** | `wrap:phase` command | Native `/gsd:phase N` -- detects state and routes to plan/execute/verify | MEDIUM |
| **Session save on end** | JS hook calling skill-creator | Native hook calling `gsd-tools state record-session` | MEDIUM |
| **Security boundary: YOLO scope** | security-hygiene SKILL.md | Document: "YOLO applies to workflows, not system modifications" | LOW |

The `wrap:phase` routing logic is the single most impactful structural improvement -- it eliminates "which command do I run?" confusion using pure GSD state detection:

```
no PLAN files       -> plan-phase
SUMMARY < PLAN      -> execute-phase
SUMMARY == PLAN     -> verify-work
VERIFICATION exists -> "phase done"
```

### Tier 3: Should Stay in Extension Layer

Wrapper commands (wrap:plan/execute/verify), observer pattern, JSONL logging, bounded learning, session snapshots, sc:* commands -- these all depend on skill-creator's adaptive learning pipeline.

---

## Part 5: Long-Running Project Robustness

### State Divergence Over Time

| Issue | Severity | Detail |
|-------|----------|--------|
| STATE.md vs ROADMAP.md divergence | HIGH | No cross-validation at startup. STATE says Phase 8 while ROADMAP shows 8+9 complete -- no error raised |
| SUMMARY.md as completion signal | MEDIUM | File on disk counts as "complete" even if commit failed |
| STATE.md unbounded growth | LOW | Performance Metrics table grows forever across milestones -- not archived on milestone completion |
| Three sources of truth | HIGH | ROADMAP.md, STATE.md, phase directory filesystem, config.json must agree but nothing enforces this |

### Scale Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| O(n^2) normalizeMd | HIGH | Fence detection rescans from line 0 on every fenced block |
| Phase removal renumbering O(P*C) | MEDIUM | Removing phase 1 from 50 phases: 98 iterations x 5 regex replacements on full content |
| buildStateFrontmatter disk scan per write | MEDIUM | 50+ `readdirSync` calls on every STATE.md write |
| extractCurrentMilestone reads STATE.md on every ROADMAP read | MEDIUM | Extra file read per operation |

### Recovery Gaps

| Scenario | What happens | Severity |
|----------|-------------|----------|
| Process killed mid-phase-complete | ROADMAP updated, STATE not -- inconsistent state, no rollback | CRITICAL |
| Executor writes SUMMARY but commit fails | Plan appears "complete" by file count but work isn't committed | MEDIUM |
| Verification passes but session ends before state update | Result lost, re-verifies from scratch | MEDIUM |
| User deletes PLAN.md mid-execution | Plan count drops, premature "phase complete" signal | MEDIUM |

---

## Prioritized Action Plan

### Wave 1: Critical Fixes (immediate)

1. **Wire `withPlanningLock` into production write paths** -- the mechanism exists but is dead code
2. **Move STATE.md read inside the lock** -- fix the lost-update race
3. **Add ROADMAP.md write locking** -- apply same pattern
4. **Fix O(n^2) normalizeMd** -- single-pass fence tracker
5. **Log when must_haves parsing returns empty** -- surface verification degradation

### Wave 2: 1M Context Optimization (high impact)

6. **Read `context_window` in workflows and conditionally enrich subagent prompts** -- the config already flows through init
7. **Add cross-phase SUMMARYs to executor prompts** -- Wave 2+ agents need Wave 1 context
8. **Add files_to_read to verifier spawn** -- PLAN, SUMMARY, CONTEXT, REQUIREMENTS
9. **Pass prior CONTEXT.md to planner** -- cross-phase decision consistency
10. **Auto-detect model and set context_window** -- eliminate manual config

### Wave 3: Skill-Creator Upstreaming (community value)

11. **Upstream the 6 hook files** -- session orientation, commit validation, context monitor, statusline, update check, phase boundary
12. **Extract wrap:phase routing as native `/gsd:phase N`** -- eliminate "which command?" confusion
13. **Add native SessionEnd hook** -- `gsd-tools state record-session` on session close

### Wave 4: Robustness Hardening (long-running projects)

14. **Add STATE/ROADMAP cross-validation at startup** -- detect and surface divergence
15. **Add STATE.md rotation during milestone completion** -- archive accumulated metrics
16. **Validate config.json fields in health check** -- catch invalid branching_strategy, context_window, templates
17. **Make regex field extraction log on no-match** -- surface template drift early

---

## Appendix: Issue Coverage

Issues referenced in this review that already have PRs from us:
- #1418 (verifier SC scope reduction) -- PR #1434
- #1451 (worktree merge ordering) -- PR #1456
- #1395 (commit_docs enforcement) -- PR #1411

Issues referenced that are covered by other contributors:
- #1457 (circular tests/it.skip) -- PR #1458 by @grgbrasil
- #1453 (manager bypasses Skill pipeline) -- PR #1455 by @jeremymcs
- #1459 (stats without verification) -- reference impl by @grgbrasil

New issues identified by this review that don't have upstream issues yet:
- Parallel state write race condition (STATE.md + ROADMAP.md)
- `withPlanningLock` dead code
- `context_window` config never consumed by workflows
- Verifier Option C silent degradation
- must_haves parser silent failure
- O(n^2) normalizeMd
