---
name: gsd:recover-summary
description: Generate SUMMARY.md for plans where code exists but SUMMARY is missing
allowed-tools: Read, Write, Bash, Grep, Glob
---

<objective>
Recover missing SUMMARY.md files for plans that have been executed (code commits exist) but where the SUMMARY was never created or was lost.

This command fixes STATE/SUMMARY inconsistencies that can occur when:
- Sessions are interrupted after code commits but before SUMMARY creation
- Subagents fail silently
- STATE.md is manually edited
</objective>

<usage>
```bash
# Recover specific plan
/gsd:recover-summary 02-18

# Recover all missing in a phase
/gsd:recover-summary --phase 2.7

# Dry-run (show what would be recovered)
/gsd:recover-summary --dry-run
```
</usage>

<process>

<step name="parse_arguments">
Parse the command arguments:

```bash
# Check for --dry-run flag
DRY_RUN=false
if [[ "$*" == *"--dry-run"* ]]; then
  DRY_RUN=true
fi

# Check for --phase flag
if [[ "$*" == *"--phase"* ]]; then
  PHASE_NUM=$(echo "$*" | grep -oP '(?<=--phase\s)\S+')
  MODE="phase"
else
  PLAN_ID="$1"
  MODE="single"
fi
```

**If no arguments:**
```
## Usage

/gsd:recover-summary {plan-id}     # e.g., 02-18
/gsd:recover-summary --phase {N}   # e.g., --phase 2.7
/gsd:recover-summary --dry-run     # Show what would be recovered
```
</step>

<step name="find_missing_summaries">
Identify plans with missing SUMMARYs:

**Single mode:**
```bash
# Find the plan file
PLAN_FILE=$(find .planning/phases -name "*${PLAN_ID}*-PLAN.md" 2>/dev/null | head -1)
PHASE_DIR=$(dirname "$PLAN_FILE")
SUMMARY_FILE="${PLAN_FILE/-PLAN.md/-SUMMARY.md}"

if [ ! -f "$PLAN_FILE" ]; then
  echo "ERROR: Plan not found: $PLAN_ID"
  exit 1
fi

if [ -f "$SUMMARY_FILE" ]; then
  echo "SUMMARY already exists: $SUMMARY_FILE"
  echo "Use --force to regenerate."
  exit 0
fi
```

**Phase mode:**
```bash
# Find phase directory
PHASE_DIR=$(find .planning/phases -maxdepth 1 -type d -name "*${PHASE_NUM}*" 2>/dev/null | head -1)

# Find all missing SUMMARYs
MISSING=()
for plan in "$PHASE_DIR"/*-PLAN.md; do
  summary="${plan/-PLAN.md/-SUMMARY.md}"
  if [ ! -f "$summary" ]; then
    MISSING+=("$plan")
  fi
done

echo "Found ${#MISSING[@]} plans with missing SUMMARYs"
```
</step>

<step name="verify_code_exists">
For each plan with missing SUMMARY, verify code was actually implemented:

```bash
# Extract plan ID for commit search
PLAN_ID=$(basename "$PLAN_FILE" | sed 's/-PLAN.md//')

# Search for commits related to this plan
COMMITS=$(git log --oneline --grep="($PLAN_ID)" --grep="feat($PLAN_ID)" --grep="fix($PLAN_ID)" 2>/dev/null)

if [ -z "$COMMITS" ]; then
  echo "⚠️ No commits found for $PLAN_ID"
  echo "Code may not have been implemented."
  echo "Options: 1) Execute plan normally, 2) Skip recovery"
else
  echo "✓ Found commits for $PLAN_ID:"
  echo "$COMMITS" | head -5
fi
```

**If no commits found:** Offer to execute plan normally instead of recovering.
</step>

<step name="gather_context">
Gather information to generate SUMMARY:

```bash
# Read the original plan
PLAN_CONTENT=$(cat "$PLAN_FILE")

# Get all commits for this plan
COMMIT_DETAILS=$(git log --pretty=format:"%h - %s%n%b" --grep="($PLAN_ID)" 2>/dev/null)

# Get files changed by these commits
FILES_CHANGED=$(git log --name-only --pretty=format:"" --grep="($PLAN_ID)" 2>/dev/null | sort -u | grep -v '^$')

# Get creation date from first commit
COMPLETION_DATE=$(git log --format="%ai" --grep="($PLAN_ID)" 2>/dev/null | tail -1 | cut -d' ' -f1)
```
</step>

<step name="generate_summary">
Generate SUMMARY.md from gathered context:

```markdown
---
phase: {extracted from plan}
plan: {extracted from plan}
subsystem: {inferred from plan focus}
tags: {from commit messages and files}
requires: {from plan context section}
provides: {from accomplished tasks}
affects: {inferred}
tech-stack:
  added: {from package.json changes}
  patterns: {from code structure}
key-files:
  created: {from git log}
  modified: {from git log}
key-decisions: {from plan decisions or "See plan"}
duration: "auto-recovered"
completed: {COMPLETION_DATE}
---

# Phase {X} Plan {Y}: {Name} Summary

**Auto-recovered:** This SUMMARY was generated from git history because the original was not created.

## One-Liner

{Extracted from plan objective}

## Accomplishments

{Generated from commit messages}

1. {Task 1 from commits}
2. {Task 2 from commits}
...

## Files Created/Modified

**Created:**
{From git log --diff-filter=A}

**Modified:**
{From git log --diff-filter=M}

## Decisions Made

{From plan or "Decisions documented in plan"}

## Deviations from Plan

**Recovery note:** Unable to determine deviations - this SUMMARY was auto-recovered from git history.

## Issues Encountered

Unknown - SUMMARY auto-recovered.

## Next Step

{Inferred from plan position}

## Recovery Metadata

- **Recovered on:** {today}
- **Recovery reason:** SUMMARY missing after execution
- **Commits recovered from:** {commit hashes}
- **Confidence:** Medium (generated from git history, not execution context)
```
</step>

<step name="write_summary">
**If --dry-run:**
```
## Dry Run Results

Would recover SUMMARYs for:
- {plan-id-1}: {plan-name} (5 commits found)
- {plan-id-2}: {plan-name} (3 commits found)

Run without --dry-run to create files.
```

**Otherwise:**
```bash
# Write the SUMMARY file
cat > "$SUMMARY_FILE" << 'EOF'
{generated_content}
EOF

echo "✓ Created: $SUMMARY_FILE"
```
</step>

<step name="update_state">
After recovery, update STATE.md frontmatter:

```bash
# Update plan_summary_exists
sed -i 's/plan_summary_exists: false/plan_summary_exists: true/' .planning/STATE.md

# Update counts
SUMMARY_COUNT=$(ls -1 "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null | wc -l | tr -d ' ')
PLAN_COUNT=$(ls -1 "$PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
sed -i "s/summaries_in_phase: .*/summaries_in_phase: $SUMMARY_COUNT/" .planning/STATE.md
sed -i "s/plans_in_phase: .*/plans_in_phase: $PLAN_COUNT/" .planning/STATE.md

# Update last_verified timestamp
sed -i "s/last_verified: .*/last_verified: $(date -u +%Y-%m-%dT%H:%M:%SZ)/" .planning/STATE.md
```
</step>

<step name="report">
Report recovery results:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SUMMARY RECOVERY COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Recovered: {N} SUMMARYs
Skipped: {M} (no commits found)
Failed: {O} (errors)

Files created:
- {SUMMARY_FILE_1}
- {SUMMARY_FILE_2}

STATE.md updated:
- plan_summary_exists: true
- summaries_in_phase: {count}

⚠️ Note: Recovered SUMMARYs have Medium confidence.
   Review them for accuracy before continuing.

Next: /gsd:execute-phase {phase}
```
</step>

</process>

<success_criteria>
- [ ] Missing SUMMARYs identified
- [ ] Git commits verified for each plan
- [ ] SUMMARYs generated from commit history
- [ ] Files written to correct locations
- [ ] STATE.md frontmatter updated
- [ ] Recovery metadata included in each SUMMARY
</success_criteria>
