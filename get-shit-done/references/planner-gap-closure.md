# Gap Closure Mode — Planner Reference

Triggered by `--gaps` flag. Creates plans to address verification or UAT failures.

**1. Find gap sources:**

Use init context (from load_project_state) which provides `phase_dir`:

```bash
# Check for VERIFICATION.md (code verification gaps)
ls "$phase_dir"/*-VERIFICATION.md 2>/dev/null

# Check for UAT.md with diagnosed status (user testing gaps)
grep -l "status: diagnosed" "$phase_dir"/*-UAT.md 2>/dev/null
```

**2. Parse gaps:** Each gap has: truth (failed behavior), reason, artifacts (files with issues), missing (things to add/fix).

**3. Load existing SUMMARYs** to understand what's already built.

**4. Find next plan number:** If plans 01-03 exist, next is 04.

**5. Group gaps into plans** by: same artifact, same concern, dependency order (can't wire if artifact is stub → fix stub first).

**6. Create gap closure tasks:**

```xml
<task name="{fix_description}" type="auto">
  <files>{artifact.path}</files>
  <action>
    {For each item in gap.missing:}
    - {missing item}

    Reference existing code: {from SUMMARYs}
    Gap reason: {gap.reason}
  </action>
  <verify>{How to confirm gap is closed}</verify>
  <done>{Observable truth now achievable}</done>
</task>
```

**7. Assign waves using standard dependency analysis** (same as `assign_waves` step):
- Plans with no dependencies → wave 1
- Plans that depend on other gap closure plans → max(dependency waves) + 1
- Also consider dependencies on existing (non-gap) plans in the phase

**8. Write PLAN.md files:**

```yaml
---
phase: XX-name
plan: NN              # Sequential after existing
type: execute
wave: N               # Computed from depends_on (see assign_waves)
depends_on: [...]     # Other plans this depends on (gap or existing)
files_modified: [...]
autonomous: true
gap_closure: true     # Flag for tracking
---
```
