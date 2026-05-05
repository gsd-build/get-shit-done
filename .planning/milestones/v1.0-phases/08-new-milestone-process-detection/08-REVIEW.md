---
phase: 08-new-milestone-process-detection
reviewed: 2026-04-30T22:45:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - tests/sme-new-milestone-detect.test.cjs
  - get-shit-done/workflows/new-milestone/sme-step.md
  - get-shit-done/workflows/new-milestone.md
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-04-30T22:45:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the SME process detection step (`sme-step.md`), its parent workflow (`new-milestone.md`), and the structural test file (`sme-new-milestone-detect.test.cjs`). The overall design is sound -- the sme-step is cleanly separated as a lazy-loaded sub-workflow, the test file covers all five DETECT requirements plus an ordering constraint, and the parent workflow gates correctly on `use_sme_agents`.

One critical security issue was found: a Python code injection vector in the `SELECTED_SMES` variable interpolation. Two warnings flag undefined variables that would cause silent failures at runtime. One informational item notes a minor inconsistency in the parent workflow reference path.

## Critical Issues

### CR-01: Python Code Injection via Triple-Quote Breakout in SELECTED_SMES

**File:** `get-shit-done/workflows/new-milestone/sme-step.md:144`
**Issue:** The `SELECTED_SMES` variable is interpolated directly into a Python triple-quoted string literal (`'''${SELECTED_SMES}'''`). While step 5 validates *new* process names against `^[a-zA-Z0-9_-]+$`, the `SELECTED_SMES` variable also accumulates names from step 4 (existing SMEs selected by the user). These names originate from `sme.list` output and are not re-validated before being interpolated into the Python code. If any existing SME document has a name containing `'''` (unlikely but not prevented by a guard in this code path), it would break out of the Python string and allow arbitrary code execution. More practically, names containing whitespace or special shell characters could cause malformed JSON or shell errors.

The defense-in-depth principle (T-08-01 mitigation mentioned on line 107) is correctly applied for new names but should also cover the accumulation point where all names are joined before interpolation into Python.

**Fix:** Add validation at the aggregation point (before step 6) to ensure all accumulated names pass the same regex, or use a safer interpolation method:

```bash
# Option A: Re-validate all names before interpolation
for NAME in $SELECTED_SMES; do
  if [[ ! "$NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Invalid SME name in selection: '$NAME'"
    exit 1
  fi
done

# Option B: Use stdin instead of string interpolation to avoid injection entirely
ACTIVE_SMES_JSON=$(echo "${SELECTED_SMES}" | python3 -c "
import sys, json
names = [n.strip() for n in sys.stdin.read().split() if n.strip()]
print(json.dumps({'milestone': {'active_smes': names}}))
")
```

Option B is preferred -- it eliminates the injection class entirely by reading from stdin rather than interpolating into code.

## Warnings

### WR-01: MILESTONE_GOAL Variable Used But Never Defined

**File:** `get-shit-done/workflows/new-milestone/sme-step.md:46`
**Issue:** The `sme.detect-processes` call passes `--goal "${MILESTONE_GOAL}"` but this variable is never set in sme-step.md, and the parent workflow `new-milestone.md` does not define or export `MILESTONE_GOAL` before dispatching to step 5.5. The milestone goal text is gathered in step 2 ("Gather Milestone Goals") and confirmed in step 3.5, but it is stored narratively -- no shell variable assignment is shown. At runtime, `${MILESTONE_GOAL}` would expand to an empty string, causing `sme.detect-processes` to receive `--goal ""` and likely return zero matches. This would silently skip auto-detection, falling back to manual-only selection.

**Fix:** Either document that the orchestrating agent must set `MILESTONE_GOAL` from the confirmed goal text before reading sme-step.md, or add an explicit load step at the top of sme-step.md:

```bash
# At the start of sme-step.md, after the config check:
MILESTONE_GOAL=$(gsd-sdk query state.get milestone.goal --raw 2>/dev/null || echo "")
if [[ -z "$MILESTONE_GOAL" ]]; then
  echo "WARN: No milestone goal available for process detection. Skipping auto-detect."
fi
```

### WR-02: CREATOR_MODEL and AGENT_SKILLS_CREATOR Variables Undefined

**File:** `get-shit-done/workflows/new-milestone/sme-step.md:122,127`
**Issue:** The `Task()` call in step 5 references `{CREATOR_MODEL}` (line 122) and `{AGENT_SKILLS_CREATOR}` (line 127), but neither is loaded anywhere in sme-step.md. The parent workflow loads researcher/synthesizer/roadmapper models in step 7 (`gsd-sdk query init.new-milestone`) but this happens *after* step 5.5 (SME detection). The `gsd-sme-creator` agent model and skills are not resolved. At runtime, the Task() call would either use literal placeholder strings as model names (causing model resolution failure) or rely on the orchestrating agent to have resolved them implicitly -- which is undocumented.

**Fix:** Add model and skills resolution at the start of step 5, before the Task() call:

```bash
CREATOR_MODEL=$(gsd-sdk query config-get agents.sme_creator_model --raw 2>/dev/null || echo "default")
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator 2>/dev/null || echo "")
```

Alternatively, move the `init.new-milestone` call (currently step 7 in new-milestone.md) to before step 5.5 so all model variables are available, and add `creator_model` to the init query response.

## Info

### IN-01: Parent Workflow Uses Relative Path Without Leading Directory

**File:** `get-shit-done/workflows/new-milestone.md:206`
**Issue:** The parent workflow says "Read `workflows/new-milestone/sme-step.md`" but the test file (line 28) checks for `new-milestone/sme-step.md` (without the `workflows/` prefix). The test correctly validates the shorter form since the reference is relative to the workflow directory. However, the parent workflow's instruction text uses `workflows/new-milestone/sme-step.md` while the actual dispatch path used by the orchestrating agent is likely `new-milestone/sme-step.md` (relative to the workflows directory). This inconsistency is cosmetic but could cause confusion when debugging dispatch failures.

**Fix:** Standardize the reference in `new-milestone.md` line 206 to match the path the orchestrator actually resolves:

```markdown
If `workflow.use_sme_agents` is true: Read `new-milestone/sme-step.md` and execute its steps.
```

---

_Reviewed: 2026-04-30T22:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
