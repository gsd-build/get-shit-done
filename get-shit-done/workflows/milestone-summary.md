# Milestone Summary Workflow

Generate a comprehensive, human-friendly project summary from completed milestone artifacts.
Designed for team onboarding — a new contributor can read the output and understand the entire project.

---

## Step 1: Resolve Version

```bash
VERSION="$ARGUMENTS"
```

If `$ARGUMENTS` is empty:
1. Check `.planning/STATE.md` for current milestone version
2. Check `.planning/milestones/` for the latest archived version
3. If neither found, check if `.planning/ROADMAP.md` exists (project may be mid-milestone)
4. If nothing found: error "No milestone found. Run /gsd-new-project or /gsd-new-milestone first."

Set `VERSION` to the resolved version (e.g., "1.0").

## Step 2: Locate Artifacts

Determine whether the milestone is **archived** or **current**:

**Archived milestone** (`.planning/milestones/v{VERSION}-ROADMAP.md` exists):
```
ROADMAP_PATH=".planning/milestones/v${VERSION}-ROADMAP.md"
REQUIREMENTS_PATH=".planning/milestones/v${VERSION}-REQUIREMENTS.md"
AUDIT_PATH=".planning/milestones/v${VERSION}-MILESTONE-AUDIT.md"
```

**Current/in-progress milestone** (no archive yet):
```
ROADMAP_PATH=".planning/ROADMAP.md"
REQUIREMENTS_PATH=".planning/REQUIREMENTS.md"
AUDIT_PATH=".planning/v${VERSION}-MILESTONE-AUDIT.md"
```

Note: The audit file moves to `.planning/milestones/` on archive (per `complete-milestone` workflow). Check both locations as a fallback.

**Always available:**
```
PROJECT_PATH=".planning/PROJECT.md"
RETRO_PATH=".planning/RETROSPECTIVE.md"
STATE_PATH=".planning/STATE.md"
```

Read all files that exist. Missing files are fine — the summary adapts to what's available.

## Step 3: Discover Phase Artifacts

Find all phase directories:

```bash
gsd-tools.cjs init progress
```

This returns phase metadata. For each phase in the milestone scope:

- Read `{phase_dir}/{padded}-SUMMARY.md` if it exists — extract `one_liner`, `accomplishments`, `decisions`
- Read `{phase_dir}/{padded}-VERIFICATION.md` if it exists — extract status, gaps, deferred items
- Read `{phase_dir}/{padded}-CONTEXT.md` if it exists — extract key decisions from `<decisions>` section
- Read `{phase_dir}/{padded}-RESEARCH.md` if it exists — note what was researched

Track which phases have which artifacts.

**If no phase directories exist** (empty milestone or pre-build state): skip to Step 5 and generate a minimal summary noting "No phases have been executed yet." Do not error — the summary should still capture PROJECT.md and ROADMAP.md content.

## Step 4: Gather Git Statistics

Try each method in order until one succeeds:

**Method 1 — Tagged milestone** (check first):
```bash
git tag -l "v${VERSION}" | head -1
```
If the tag exists:
```bash
git log v${VERSION} --oneline | wc -l
git diff --stat $(git log --format=%H --reverse v${VERSION} | head -1)..v${VERSION}
```

**Method 2 — STATE.md date range** (if no tag):
Read STATE.md and extract the `started_at` or earliest session date. Use it as the `--since` boundary:
```bash
git log --oneline --since="<started_at_date>" | wc -l
```

**Method 3 — Earliest phase commit** (if STATE.md has no date):
Find the earliest `.planning/phases/` commit:
```bash
git log --oneline --diff-filter=A -- ".planning/phases/" | tail -1
```
Use that commit's date as the start boundary.

**Method 4 — Skip stats** (if none of the above work):
Report "Git statistics unavailable — no tag or date range could be determined." This is not an error — the summary continues without the Stats section.

Extract (when available):
- Total commits in milestone
- Files changed, insertions, deletions
- Timeline (start date → end date)
- Contributors (from git log authors)

## Step 5: Generate Summary Document

Write to `.planning/reports/MILESTONE_SUMMARY-v${VERSION}.md`:

```markdown
# Milestone v{VERSION} — Project Summary

**Generated:** {date}
**Purpose:** Team onboarding and project review

---

## 1. Project Overview

{From PROJECT.md: "What This Is", core value proposition, target users}
{If mid-milestone: note which phases are complete vs in-progress}

## 2. Architecture & Technical Decisions

{From CONTEXT.md files across phases: key technical choices}
{From SUMMARY.md decisions: patterns, libraries, frameworks chosen}
{From PROJECT.md: tech stack if documented}

Present as a bulleted list of decisions with brief rationale:
- **Decision:** {what was chosen}
  - **Why:** {rationale from CONTEXT.md}
  - **Phase:** {which phase made this decision}

## 3. Phases Delivered

| Phase | Name | Status | One-Liner |
|-------|------|--------|-----------|
{For each phase: number, name, status (complete/in-progress/planned), one_liner from SUMMARY.md}

## 4. Requirements Coverage

{From REQUIREMENTS.md: list each requirement with status}
- ✅ {Requirement met}
- ⚠️ {Requirement partially met — note gap}
- ❌ {Requirement not met — note reason}

{If MILESTONE-AUDIT.md exists: include audit verdict}

## 5. Key Decisions Log

{Aggregate from all CONTEXT.md <decisions> sections}
{Each decision with: ID, description, phase, rationale}

## 6. Tech Debt & Deferred Items

{From VERIFICATION.md files: gaps found, anti-patterns noted}
{From RETROSPECTIVE.md: lessons learned, what to improve}
{From CONTEXT.md <deferred> sections: ideas parked for later}

## 7. Getting Started

{Entry points for new contributors:}
- **Run the project:** {from PROJECT.md or SUMMARY.md}
- **Key directories:** {from codebase structure}
- **Tests:** {test command from PROJECT.md or CLAUDE.md}
- **Where to look first:** {main entry points, core modules}

---

## Stats

- **Timeline:** {start} → {end} ({duration})
- **Phases:** {count complete} / {count total}
- **Commits:** {count}
- **Files changed:** {count} (+{insertions} / -{deletions})
- **Contributors:** {list}
```

## Step 6: Write and Commit

**Overwrite guard:** If `.planning/reports/MILESTONE_SUMMARY-v${VERSION}.md` already exists, ask the user:
> "A milestone summary for v{VERSION} already exists. Overwrite it, or view the existing one?"
If "view": display existing file and skip to Step 8 (interactive mode). If "overwrite": proceed.

Create the reports directory if needed:
```bash
mkdir -p .planning/reports
```

Write the summary, then commit:
```bash
gsd-tools.cjs commit "docs(v${VERSION}): generate milestone summary for onboarding" \
  --files ".planning/reports/MILESTONE_SUMMARY-v${VERSION}.md"
```

## Step 7: Present Summary

Display the full summary document inline.

## Step 8: Offer Interactive Mode

After presenting the summary:

> "Summary written to `.planning/reports/MILESTONE_SUMMARY-v{VERSION}.md`.
>
> I have full context from the build artifacts. Want to ask anything about the project?
> Architecture decisions, specific phases, requirements, tech debt — ask away."

If the user asks questions:
- Answer from the artifacts already loaded (CONTEXT.md, SUMMARY.md, VERIFICATION.md, etc.)
- Reference specific files and decisions
- Stay grounded in what was actually built (not speculation)

If the user is done:
- Suggest next steps: `/gsd-new-milestone`, `/gsd-progress`, or sharing the summary with the team

## Step 9: Update STATE.md

```bash
gsd-tools.cjs state record-session \
  --stopped-at "Milestone v${VERSION} summary generated" \
  --resume-file ".planning/reports/MILESTONE_SUMMARY-v${VERSION}.md"
```
