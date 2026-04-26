# Forensics Workflow

Post-mortem investigation for failed or stuck GSD workflows. Analyzes git history,
`.planning/` artifacts, and file system state to detect anomalies and generate a
structured diagnostic report.

**Principle:** This is a read-only investigation. Do not modify project files.
Only write the forensic report.

---

## Step 1: Get Problem Description

```bash
PROBLEM="$ARGUMENTS"
```

If `$ARGUMENTS` is empty, ask the user:
> "What went wrong? Describe the issue — e.g., 'autonomous mode got stuck on phase 3',
> 'execute-phase failed silently', 'costs seem unusually high'."

Record the problem description for the report.

## Step 2: Gather Evidence

Collect data from all available sources. Missing sources are fine — adapt to what exists.

### 2a. Git History

```bash
# Recent commits (last 30)
git log --oneline -30

# Commits with timestamps for gap analysis
git log --format="%H %ai %s" -30

# Files changed in recent commits (detect repeated edits)
git log --name-only --format="" -20 | sort | uniq -c | sort -rn | head -20

# Uncommitted work
git status --short
git diff --stat
```

Record:
- Commit timeline (dates, messages, frequency)
- Most-edited files (potential stuck-loop indicator)
- Uncommitted changes (potential crash/interruption indicator)

### 2b. Planning State

Read these files if they exist:
- `.planning/STATE.md` — current milestone, phase, progress, blockers, last session
- `.planning/ROADMAP.md` — phase list with status
- `.planning/config.json` — workflow configuration

Extract:
- Current phase and its status
- Last recorded session stop point
- Any blockers or flags

### 2c. Phase Artifacts

For each phase directory in `.planning/phases/*/`:

```bash
ls .planning/phases/*/
```

For each phase, check which artifacts exist:
- `{padded}-PLAN.md` or `{padded}-PLAN-*.md` (execution plans)
- `{padded}-SUMMARY.md` (completion summary)
- `{padded}-VERIFICATION.md` (quality verification)
- `{padded}-CONTEXT.md` (design decisions)
- `{padded}-RESEARCH.md` (pre-planning research)

Track: which phases have complete artifact sets vs gaps.

### 2d. Session Reports

Read `.planning/reports/SESSION_REPORT.md` if it exists — extract last session outcomes,
work completed, token estimates.

### 2e. Git Worktree State

```bash
git worktree list
```

Check for orphaned worktrees (from crashed agents).

## Step 3: Detect Anomalies

Evaluate the gathered evidence against these anomaly patterns:

### Stuck Loop Detection

**Signal:** Same file appears in 3+ consecutive commits within a short time window.

```bash
# Look for files committed repeatedly in sequence
git log --name-only --format="---COMMIT---" -20
```

Parse commit boundaries. If any file appears in 3+ consecutive commits, flag as:
- **Confidence HIGH** if the commit messages are similar (e.g., "fix:", "fix:", "fix:" on same file)
- **Confidence MEDIUM** if the file appears frequently but commit messages vary

### Missing Artifact Detection

**Signal:** Phase appears complete (has commits, is past in roadmap) but lacks expected artifacts.

For each phase that should be complete:
- PLAN.md missing → planning step was skipped
- SUMMARY.md missing → phase was not properly closed
- VERIFICATION.md missing → quality check was skipped

### Abandoned Work Detection

**Signal:** Large gap between last commit and current time, with STATE.md showing mid-execution.

```bash
# Time since last commit
git log -1 --format="%ai"
```

If STATE.md shows an active phase but the last commit is >2 hours old and there are
uncommitted changes, flag as potential abandonment or crash.

### Crash/Interruption Detection

**Signal:** Uncommitted changes + STATE.md shows mid-execution + orphaned worktrees.

Combine:
- `git status` shows modified/staged files
- STATE.md has an active execution entry
- `git worktree list` shows worktrees beyond the main one

### Scope Drift Detection

**Signal:** Recent commits touch files outside the current phase's expected scope.

Read the current phase PLAN.md to determine expected file paths. Compare against
files actually modified in recent commits. Flag any files that are clearly outside
the phase's domain.

### Test Regression Detection

**Signal:** Commit messages containing "fix test", "revert", or re-commits of test files.

```bash
git log --oneline -20 | grep -iE "fix test|revert|broken|regression|fail"
```

## Step 4: Generate Report

Create the forensics directory if needed:
```bash
mkdir -p .planning/forensics
```

Write to `.planning/forensics/report-$(date +%Y%m%d-%H%M%S).md`:

```markdown
# Forensic Report

**Generated:** {ISO timestamp}
**Problem:** {user's description}

---

## Evidence Summary

### Git Activity
- **Last commit:** {date} — "{message}"
- **Commits (last 30):** {count}
- **Time span:** {earliest} → {latest}
- **Uncommitted changes:** {yes/no — list if yes}
- **Active worktrees:** {count — list if >1}

### Planning State
- **Current milestone:** {version or "none"}
- **Current phase:** {number — name — status}
- **Last session:** {stopped_at from STATE.md}
- **Blockers:** {any flags from STATE.md}

### Artifact Completeness
| Phase | PLAN | CONTEXT | RESEARCH | SUMMARY | VERIFICATION |
|-------|------|---------|----------|---------|-------------|
{for each phase: name | ✅/❌ per artifact}

## Anomalies Detected

### {Anomaly Type} — {Confidence: HIGH/MEDIUM/LOW}
**Evidence:** {specific commits, files, or state data}
**Interpretation:** {what this likely means}

{repeat for each anomaly found}

## Root Cause Hypothesis

Based on the evidence above, the most likely explanation is:

{1-3 sentence hypothesis grounded in the anomalies}

## Recommended Actions

1. {Specific, actionable remediation step}
2. {Another step if applicable}
3. {Recovery command if applicable — e.g., `/gsd-resume-work`, `/gsd-execute-phase N`}

---

*Report generated by `/gsd-forensics`. All paths redacted for portability.*
```

**Redaction rules:**
- Replace absolute paths with relative paths (strip `$HOME` prefix)
- Remove any API keys, tokens, or credentials found in git diff output
- Truncate large diffs to first 50 lines

## Step 5: Present Report

Display the full forensic report inline.

## Step 6: Offer Interactive Investigation

> "Report saved to `.planning/forensics/report-{timestamp}.md`.
>
> I can dig deeper into any finding. Want me to:
> - Trace a specific anomaly to its root cause?
> - Read specific files referenced in the evidence?
> - Check if a similar issue has been reported before?"

If the user asks follow-up questions, answer from the evidence already gathered.
Read additional files only if specifically needed.

## Step 7: Offer Issue Creation

If actionable anomalies were found (HIGH or MEDIUM confidence):

> "Want me to create a GitHub issue for this? I'll format the findings and redact paths."

If confirmed:
```bash
# Check if "bug" label exists before using it
BUG_LABEL=$(gh label list --repo gsd-build/get-shit-done --search "bug" --json name -q '.[0].name' 2>/dev/null)
LABEL_FLAG=""
if [ -n "$BUG_LABEL" ]; then
  LABEL_FLAG="--label bug"
fi

gh issue create \
  --repo gsd-build/get-shit-done \
  --title "bug: {concise description from anomaly}" \
  $LABEL_FLAG \
  --body "{formatted findings from report}"
```

## Step 8: Update STATE.md

```bash
gsd-sdk query state.record-session "" \
  "Forensic investigation complete" \
  ".planning/forensics/report-{timestamp}.md"
```
