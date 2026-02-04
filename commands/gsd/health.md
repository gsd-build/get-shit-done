---
name: gsd:health
description: Validate .planning/ directory integrity and identify issues
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Diagnose .planning/ directory health. Validates structure, file integrity, and cross-file consistency. Read-only — reports issues with fix suggestions, never modifies files.

Use when GSD commands behave unexpectedly, after git operations that touch .planning/, or when resuming work after a long break.
</objective>

<process>

<step name="check_directory">

## 1. Check .planning/ exists

```bash
test -d .planning && echo "exists" || echo "missing"
```

If missing:
```
[!] .planning/ directory not found

No GSD project initialized.
Fix: /gsd:new-project
```
Exit.

</step>

<step name="check_core_files">

## 2. Check core files

Check existence of each required file:

```bash
for f in PROJECT.md ROADMAP.md STATE.md config.json; do
  test -f ".planning/$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

Report each result:
- `[OK]` for files that exist
- `[!]` for missing files with fix suggestion

Fix suggestions per file:
| File | Fix |
|------|-----|
| PROJECT.md | `/gsd:new-project` to reinitialize |
| ROADMAP.md | If PROJECT.md exists: `/gsd:new-milestone` to create roadmap |
| STATE.md | `/gsd:progress` triggers creation from ROADMAP.md |
| config.json | `/gsd:settings` to create with defaults |

**Do NOT exit on missing files** — continue checking what exists.

</step>

<step name="check_config_json">

## 3. Validate config.json

If config.json exists, check it parses as valid JSON:

```bash
cat .planning/config.json | python -m json.tool > /dev/null 2>&1 && echo "VALID" || echo "INVALID"
```

If python unavailable, try node:
```bash
node -e "JSON.parse(require('fs').readFileSync('.planning/config.json','utf8'))" 2>&1
```

Report:
- `[OK] config.json — valid JSON`
- `[!] config.json — invalid JSON` with suggestion: "Edit .planning/config.json to fix syntax"

</step>

<step name="check_phase_consistency">

## 4. Check phase consistency

If ROADMAP.md exists:

**Extract phases from ROADMAP.md:**
Look for phase headers matching pattern `## Phase N:` or `## N.` or phase entries in the roadmap structure. Collect the phase numbers and directory names.

**List phase directories:**
```bash
ls -d .planning/phases/*/ 2>/dev/null
```

**Compare:**
- Phases in ROADMAP.md without matching directory → `[!] Phase {N} in ROADMAP.md but no directory`
  - Unplanned phases are OK (directory created when planning starts)
  - Only flag if STATE.md says this phase should be in progress or complete
- Directories not referenced in ROADMAP.md → `[!] Directory {dir} exists but not in ROADMAP.md`

If no phases/ directory at all and ROADMAP.md has phases:
- `[OK]` — phases not started yet, directory created on first `/gsd:plan-phase`

</step>

<step name="check_plan_summary_pairing">

## 5. Check plan/summary pairing

For each phase directory, find PLAN.md files and check for matching SUMMARY.md:

```bash
for plan in .planning/phases/*/*-PLAN.md; do
  summary="${plan%-PLAN.md}-SUMMARY.md"
  test -f "$summary" && echo "OK: $plan" || echo "ORPHAN: $plan"
done
```

Report orphaned plans (PLAN.md without SUMMARY.md):
- Check STATE.md to see if the plan is currently in progress
- If in progress: `[OK] {plan} — execution in progress`
- If NOT in progress: `[!] {plan} — no SUMMARY.md and not in progress`
  - Fix: `/gsd:execute-phase {phase}` to complete or manually create SUMMARY.md

</step>

<step name="check_state_position">

## 6. Validate STATE.md position

If STATE.md exists, parse current position (Phase X, Plan Y).

Check that:
- Referenced phase exists in ROADMAP.md
- Referenced phase directory exists (if claimed in progress or complete)
- Referenced plan number doesn't exceed plan count in phase directory

Report:
- `[OK] STATE.md position — Phase {X}, Plan {Y} valid`
- `[!] STATE.md references Phase {X} but ROADMAP.md has {N} phases`
- `[!] STATE.md says Plan {Y} in progress but only {N} plans in directory`
  - Fix: "Edit .planning/STATE.md to correct position"

</step>

<step name="report">

## 7. Summary report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► HEALTH CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Structure
[results from steps 2-3]

## Phase Consistency
[results from step 4]

## Execution State
[results from steps 5-6]

## Summary

{N} checks passed, {M} issues found
{list each issue with fix suggestion}
```

If zero issues: `All checks passed. Planning directory is healthy.`

</step>

</process>

<success_criteria>
- [ ] All 6 check areas evaluated
- [ ] Each issue has actionable fix suggestion
- [ ] No files modified (read-only)
- [ ] Zero issues = clear "healthy" message
</success_criteria>
