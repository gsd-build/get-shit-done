<purpose>

Start a new milestone cycle for an existing project. Loads project context, gathers milestone goals (from MILESTONE-CONTEXT.md or conversation), updates PROJECT.md and STATE.md, optionally runs parallel research, defines scoped requirements with REQ-IDs, spawns the roadmapper to create phased execution plan, and commits all artifacts. Brownfield equivalent of new-project.

</purpose>

<required_reading>

Read all files referenced by the invoking prompt's execution_context before starting.

</required_reading>

<process>

## 1. Load Context

- Read PROJECT.md (existing project, validated requirements, decisions)
- Read MILESTONES.md (what shipped previously)
- Read STATE.md (pending todos, blockers)
- Check for MILESTONE-CONTEXT.md (from /gsd:discuss-milestone)

## 1.5. Check for Pending PRDs

Before gathering milestone goals, check for existing pending PRDs in `.planning/prds/pending/`:

```bash
PENDING_PRDS=$(ls .planning/prds/pending/*.md 2>/dev/null)
```

**If PENDING_PRDS is non-empty (PRDs found):**

For each file in PENDING_PRDS, extract:
- `SLUG` — filename without `.md` extension (e.g., `auth-system` from `auth-system.md`)
- `CONCEPT_SUMMARY` — the line starting with `**Concept:**` in the file (e.g., `Auth system for multi-tenant SaaS`)
- `STAGE` — the stage marker at the top of the file (`<!-- stage: complete -->`, `<!-- stage: pm -->`, etc.)
- `STATUS_LABEL` — if STAGE is `<!-- stage: complete -->`: empty string; otherwise: ` (in progress)`

Display a selection prompt using AskUserQuestion:
```
header: "Pending PRDs"
question: "Found {N} pending PRD(s). Select one as the milestone foundation, or enter a goal manually:"
options:
  - "[1] {slug1} — {concept_summary1}{status_label1}"
  - "[2] {slug2} — {concept_summary2}{status_label2}"
  - ... (one per PRD, numbered sequentially)
  - "Enter milestone goal manually"
```

**If user selects a PRD option (selects option 1 through N):**
- Set `SELECTED_PRD_PATH = .planning/prds/pending/{selected_slug}.md`
- Set `SELECTED_PRD_SLUG = {selected_slug}`
- Set `PRD_DRIVEN = true`
- Display: "Using PRD: {SELECTED_PRD_SLUG} as milestone foundation."

**If user selects "Enter milestone goal manually":**
- Set `PRD_DRIVEN = false`
- Continue to step 2.

**If PENDING_PRDS is empty (no PRDs found):**
- Set `PRD_DRIVEN = false`
- Skip step 1.5 entirely. Continue to step 2 without showing any PRD UI.

## 2. Gather Milestone Goals

**Skip this step if PRD_DRIVEN=true** — the selected PRD provides goals and scope. Proceed directly to step 3.

**If MILESTONE-CONTEXT.md exists:**
- Use features and scope from discuss-milestone
- Present summary for confirmation

**If no context file:**
- Present what shipped in last milestone
- Ask inline (freeform, NOT AskUserQuestion): "What do you want to build next?"
- Wait for their response, then use AskUserQuestion to probe specifics
- If user selects "Other" at any point to provide freeform input, ask follow-up as plain text — not another AskUserQuestion

## 3. Determine Milestone Version

- Parse last version from MILESTONES.md
- Suggest next version (v1.0 → v1.1, or v2.0 for major)
- Confirm with user

## 4. Update PROJECT.md

Add/update:

```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence describing milestone focus]

**Target features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]
```

Update Active requirements section and "Last updated" footer.

## 5. Update STATE.md

```markdown
## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: [today] — Milestone v[X.Y] started
```

Keep Accumulated Context section from previous milestone.

## 6. Cleanup and Commit

Delete MILESTONE-CONTEXT.md if exists (consumed).

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.js" commit "docs: start milestone v[X.Y] [Name]" --files .planning/PROJECT.md .planning/STATE.md
```

## 7. Load Context and Resolve Models

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.js" init new-milestone)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `research_enabled`, `current_milestone`, `project_exists`, `roadmap_exists`.

## 8. Research Decision

> **Skip this step if PRD_DRIVEN=true.** The selected PRD already contains research (Tech Candidates from Stage 3 of the PRD workflow); proceed directly to step 9.

AskUserQuestion: "Research the domain ecosystem for new features before defining requirements?"
- "Research first (Recommended)" — Discover patterns, features, architecture for NEW capabilities
- "Skip research" — Go straight to requirements

**Persist choice to config** (so future `/gsd:plan-phase` honors it):

```bash
# If "Research first": persist true
node "$HOME/.claude/get-shit-done/bin/gsd-tools.js" config-set workflow.research true

# If "Skip research": persist false
node "$HOME/.claude/get-shit-done/bin/gsd-tools.js" config-set workflow.research false
```

**If "Research first":**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning 4 researchers in parallel...
  → Stack, Features, Architecture, Pitfalls
```

```bash
mkdir -p .planning/research
```

Spawn 4 parallel gsd-project-researcher agents. Each uses this template with dimension-specific fields:

**Common structure for all 4 researchers:**
```
Agent(prompt="
<research_type>Project Research — {DIMENSION} for [new features].</research_type>

<milestone_context>
SUBSEQUENT MILESTONE — Adding [target features] to existing app.
{EXISTING_CONTEXT}
Focus ONLY on what's needed for the NEW features.
</milestone_context>

<question>{QUESTION}</question>

<files_to_read>
- .planning/PROJECT.md (Project context)
</files_to_read>

<downstream_consumer>{CONSUMER}</downstream_consumer>

<quality_gate>{GATES}</quality_gate>

<output>
Write to: .planning/research/{FILE}
Use template: ~/.claude/get-shit-done/templates/research-project/{FILE}
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="{DIMENSION} research", run_in_background=true)
```

**Dimension-specific fields:**

| Field | Stack | Features | Architecture | Pitfalls |
|-------|-------|----------|-------------|----------|
| EXISTING_CONTEXT | Existing validated capabilities (DO NOT re-research): [from PROJECT.md] | Existing features (already built): [from PROJECT.md] | Existing architecture: [from PROJECT.md or codebase map] | Focus on common mistakes when ADDING these features to existing system |
| QUESTION | What stack additions/changes are needed for [new features]? | How do [target features] typically work? Expected behavior? | How do [target features] integrate with existing architecture? | Common mistakes when adding [target features] to [domain]? |
| CONSUMER | Specific libraries with versions for NEW capabilities, integration points, what NOT to add | Table stakes vs differentiators vs anti-features, complexity noted, dependencies on existing | Integration points, new components, data flow changes, suggested build order | Warning signs, prevention strategy, which phase should address it |
| GATES | Versions current (verify with Context7), rationale explains WHY, integration considered | Categories clear, complexity noted, dependencies identified | Integration points identified, new vs modified explicit, build order considers deps | Pitfalls specific to adding these features, integration pitfalls covered, prevention actionable |
| FILE | STACK.md | FEATURES.md | ARCHITECTURE.md | PITFALLS.md |

After all 4 complete, spawn synthesizer:

```
Agent(prompt="
Synthesize research outputs into SUMMARY.md.

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
</files_to_read>

Write to: .planning/research/SUMMARY.md
Use template: ~/.claude/get-shit-done/templates/research-project/SUMMARY.md
Commit after writing.
", subagent_type="gsd-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

Display key findings from SUMMARY.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Stack additions:** [from SUMMARY.md]
**Feature table stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]
```

**If "Skip research":** Continue to Step 9.

## 9. Define Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Read PROJECT.md: core value, current milestone goals, validated requirements (what exists).

**If research exists:** Read FEATURES.md, extract feature categories.

Present features by category:
```
## [Category 1]
**Table stakes:** Feature A, Feature B
**Differentiators:** Feature C, Feature D
**Research notes:** [any relevant notes]
```

**If no research:** Gather requirements through conversation. Ask: "What are the main things users need to do with [new features]?" Clarify, probe for related capabilities, group into categories.

**Scope each category** via AskUserQuestion (multiSelect: true, header max 12 chars):
- "[Feature 1]" — [brief description]
- "[Feature 2]" — [brief description]
- "None for this milestone" — Defer entire category

Track: Selected → this milestone. Unselected table stakes → future. Unselected differentiators → out of scope.

**Identify gaps** via AskUserQuestion:
- "No, research covered it" — Proceed
- "Yes, let me add some" — Capture additions

**Generate REQUIREMENTS.md:**
- v1 Requirements grouped by category (checkboxes, REQ-IDs)
- Future Requirements (deferred)
- Out of Scope (explicit exclusions with reasoning)
- Traceability section (empty, filled by roadmap)

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, NOTIF-02). Continue numbering from existing.

**Requirement quality criteria:**

Good requirements are:
- **Specific and testable:** "User can reset password via email link" (not "Handle password reset")
- **User-centric:** "User can X" (not "System does Y")
- **Atomic:** One capability per requirement (not "User can login and manage profile")
- **Independent:** Minimal dependencies on other requirements

Present FULL requirements list for confirmation:

```
## Milestone v[X.Y] Requirements

### [Category 1]
- [ ] **CAT1-01**: User can do X
- [ ] **CAT1-02**: User can do Y

### [Category 2]
- [ ] **CAT2-01**: User can do Z

Does this capture what you're building? (yes / adjust)
```

If "adjust": Return to scoping.

**Commit requirements:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.js" commit "docs: define milestone v[X.Y] requirements" --files .planning/REQUIREMENTS.md
```

## 10. Create Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

**Starting phase number:** Read MILESTONES.md for last phase number. Continue from there (v1.0 ended at phase 5 → v1.1 starts at phase 6).

**If PRD_DRIVEN=true:** Read the full content of SELECTED_PRD_PATH into variable `PRD_CONTENT`.

**Spawn roadmapper:**

```
Agent(prompt="
<planning_context>
<files_to_read>
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md (if exists)
- .planning/config.json
- .planning/MILESTONES.md
</files_to_read>
</planning_context>

{IF PRD_DRIVEN=true: INSERT THIS BLOCK}
<prd_source>
<prd_slug>{SELECTED_PRD_SLUG}</prd_slug>
<prd_content>
{PRD_CONTENT}
</prd_content>
<decomposition_mode>prd-driven</decomposition_mode>
</prd_source>
{END IF}

<instructions>
{IF PRD_DRIVEN=true:}
Create roadmap for milestone v[X.Y] from the PRD provided in <prd_source>:
1. Start phase numbering from [N]
2. Generate REQUIREMENTS.md entries from the PRD User Stories (use MILE-XX IDs — MILE-01, MILE-02, etc., starting from 01 or continuing from existing numbering)
3. Derive phases from the generated requirements only — one phase per logical capability cluster
4. Map every MVP User Story to exactly one phase (use PRD MVP Boundary section to exclude Phase 2 items from this milestone)
5. Derive 2-5 success criteria per phase from the PRD Acceptance Criteria
6. Order phases by technical dependency (data/infrastructure before API before UI is typical — adjust for the domain)
7. DO NOT write any files yet — return ROADMAP PREVIEW with the proposed phase structure and generated requirements
8. Format the return as: ## ROADMAP PREVIEW followed by the summary table and phase details

{IF PRD_DRIVEN=false (non-PRD-driven — existing behavior):}
Create roadmap for milestone v[X.Y]:
1. Start phase numbering from [N]
2. Derive phases from THIS MILESTONE's requirements only
3. Map every requirement to exactly one phase
4. Derive 2-5 success criteria per phase (observable user behaviors)
5. Validate 100% coverage
6. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
7. Return ROADMAP CREATED with summary

Write files first, then return.
</instructions>
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**Handle return:**

**If `## ROADMAP BLOCKED`:** Present blocker, work with user, re-spawn.

**If `## ROADMAP CREATED`** (non-PRD-driven): Read ROADMAP.md, present inline per format below, then ask for approval.

**If `## ROADMAP PREVIEW`** (PRD-driven): Display the preview inline, then ask for approval. Files have NOT been written yet.

**Display format (for both ROADMAP CREATED and ROADMAP PREVIEW):**

```
## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| [N] | [Name] | [Goal] | [REQ-IDs] | [count] |

### Phase Details

**Phase [N]: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
```

**Ask for approval** via AskUserQuestion:
- "Approve" — Commit and continue
- "Adjust phases" — Tell me what to change
- "Review full file" — Show raw roadmap text

**If "Adjust":** Get notes, re-spawn roadmapper with revision context, loop until approved.
**If "Review":** Display full roadmap text, re-ask.

**After approval:**

**If PRD_DRIVEN=true (files not yet written — ROADMAP PREVIEW was shown):**
Re-spawn roadmapper to write files:
```
Agent(prompt="
{same prompt as above, including prd_source block}

<instructions>
The roadmap below has been approved by the user. Write files now:
1. Write ROADMAP.md with the approved phase structure
2. Write REQUIREMENTS.md with the generated MILE-XX requirements and traceability
3. Update STATE.md for new milestone
4. Return ROADMAP CREATED

Approved roadmap:
{ROADMAP PREVIEW text that was displayed to user}
</instructions>
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Write approved roadmap")
```

Wait for ROADMAP CREATED signal before continuing.

**If PRD_DRIVEN=false (files already written by roadmapper):**
Proceed directly to commit step below.

**Commit roadmap and PRD lifecycle (after approval and files written):**

**If PRD_DRIVEN=true:**
```bash
mkdir -p .planning/prds/done
mv .planning/prds/pending/{SELECTED_PRD_SLUG}.md .planning/prds/done/{SELECTED_PRD_SLUG}.md || echo "Warning: Could not move PRD to done/ — move manually: mv .planning/prds/pending/{SELECTED_PRD_SLUG}.md .planning/prds/done/{SELECTED_PRD_SLUG}.md"
node "$HOME/.claude/get-shit-done/bin/gsd-tools.js" commit "docs: create milestone v[X.Y] roadmap — {SELECTED_PRD_SLUG} PRD promoted" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md .planning/prds/done/{SELECTED_PRD_SLUG}.md
```

Print after commit:
```
Requirements traceability: REQUIREMENTS.md updated with MILE-XX → Phase mapping.
PRD promoted: .planning/prds/done/{SELECTED_PRD_SLUG}.md
```

**If PRD_DRIVEN=false:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.js" commit "docs: create milestone v[X.Y] roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 11. Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |

**[N] phases** | **[X] requirements** | Ready to build ✓

## ▶ Next Up

**Phase [N]: [Phase Name]** — [Goal]

`/gsd:discuss-phase [N]` — gather context and clarify approach

<sub>`/clear` first → fresh context window</sub>

Also: `/gsd:plan-phase [N]` — skip discussion, plan directly
```

</process>

<success_criteria>
- [ ] PROJECT.md updated with Current Milestone section
- [ ] STATE.md reset for new milestone
- [ ] MILESTONE-CONTEXT.md consumed and deleted (if existed)
- [ ] Research completed (if selected) — 4 parallel agents, milestone-aware
- [ ] Requirements gathered and scoped per category
- [ ] REQUIREMENTS.md created with REQ-IDs
- [ ] gsd-roadmapper spawned with phase numbering context
- [ ] Roadmap files written immediately (not draft)
- [ ] User feedback incorporated (if any)
- [ ] ROADMAP.md phases continue from previous milestone
- [ ] All commits made (if planning docs committed)
- [ ] User knows next step: `/gsd:discuss-phase [N]`

**Atomic commits:** Each phase commits its artifacts immediately.
</success_criteria>
