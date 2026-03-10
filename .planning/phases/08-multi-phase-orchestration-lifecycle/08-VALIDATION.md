# Phase 8: Multi-Phase Orchestration & Lifecycle - Validation

**Phase:** 08-multi-phase-orchestration-lifecycle
**Plans:** 1 (08-01)
**Validation type:** Manual — markdown instruction file, no automated test framework

## Requirement Validation Matrix

| Req ID | Description | Validation Method | Expected Evidence |
|--------|-------------|-------------------|-------------------|
| ORCH-01 | Phases execute sequentially, autonomous handles the loop | Structural: iterate step loops back to execute_phase for incomplete phases | iterate step contains "loop back to execute_phase" logic + lifecycle step follows when all complete |
| ORCH-02 | Progress banners show correct N/T | Structural: progress bar formula references `phase_count` from initialize | grep for "phase_count" near progress bar; no "1-based among incomplete" text |
| ORCH-04 | Audit→complete→cleanup runs automatically after phases | Structural: lifecycle step contains all 3 Skill() calls | grep for `gsd:audit-milestone`, `gsd:complete-milestone`, `gsd:cleanup` |
| CTRL-01 | Only pauses for explicit user decisions | Structural: `passed` audit auto-continues; gaps/debt ask user | No AskUserQuestion between passed audit and complete-milestone |
| CTRL-02 | Emergency stop mechanism | Structural: lifecycle failures route to handle_blocker | grep for "handle_blocker" within lifecycle step |
| CTRL-03 | Existing skill logic preserved | File diff: only autonomous.md modified | `git diff --name-only` shows only autonomous.md |

## Structural Checks

Run after plan execution:

```bash
cd /path/to/get-shit-done-copilot

# Step count (expect 7)
grep -c '<step name=' get-shit-done/workflows/autonomous.md

# Balanced tags
echo "Open: $(grep -c '<step name=' get-shit-done/workflows/autonomous.md)"
echo "Close: $(grep -c '</step>' get-shit-done/workflows/autonomous.md)"

# All step names present
grep '<step name=' get-shit-done/workflows/autonomous.md

# Lifecycle Skill() calls present
grep 'gsd:audit-milestone\|gsd:complete-milestone\|gsd:cleanup' get-shit-done/workflows/autonomous.md

# Old completion banner gone
grep "Next: /gsd:complete-milestone to finalize" get-shit-done/workflows/autonomous.md; echo "Should return nothing"

# CTRL-03 compliance note present
grep "autonomous-optimized variant" get-shit-done/workflows/autonomous.md

# Progress bar fix
grep "phase_count" get-shit-done/workflows/autonomous.md | head -3

# File size
wc -l get-shit-done/workflows/autonomous.md
```

## Acceptance Criteria

- [ ] 7 balanced `<step>` tags (initialize, discover_phases, execute_phase, smart_discuss, iterate, lifecycle, handle_blocker)
- [ ] Progress bar uses total milestone phases, not incomplete-only count
- [ ] Smart discuss has CTRL-03 documentation blockquote
- [ ] Iterate step routes to lifecycle when all phases complete
- [ ] Lifecycle step: audit → result routing → complete → cleanup → final banner
- [ ] Audit passed → auto-continue (no user prompt)
- [ ] Audit gaps_found/tech_debt → AskUserQuestion with options
- [ ] Lifecycle failures → handle_blocker
- [ ] Only autonomous.md modified
- [ ] File ~700-740 lines
