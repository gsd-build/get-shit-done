---
name: gsd:new-milestone
description: Start a new milestone cycle — update PROJECT.md and route to requirements
argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Start a new milestone by updating PROJECT.md with new goals, then routing to the requirements → roadmap cycle.

This is the brownfield equivalent of new-project. The project exists, PROJECT.md has history. This command gathers "what's next" and updates PROJECT.md to reflect the new milestone's goals.

Output: Updated PROJECT.md, routes to research-project or define-requirements
</objective>

<execution_context>
@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/templates/project.md
</execution_context>

<context>
Milestone name: $ARGUMENTS (optional - will prompt if not provided)

**Load project context:**
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/MILESTONES.md
@.planning/config.json

**Load milestone context (if exists, from /gsd:discuss-milestone):**
@.planning/MILESTONE-CONTEXT.md
</context>

<process>

1. **Load context:**
   - Read PROJECT.md (existing project, Validated requirements, decisions)
   - Read MILESTONES.md (what shipped previously)
   - Read STATE.md (pending todos, blockers)
   - Check for MILESTONE-CONTEXT.md (from /gsd:discuss-milestone)

2. **Gather milestone goals:**

   **If MILESTONE-CONTEXT.md exists:**
   - Use features and scope from discuss-milestone
   - Present summary for confirmation

   **If no context file:**
   - Present what shipped in last milestone
   - Ask: "What do you want to build next?"
   - Use AskUserQuestion to explore features
   - Probe for priorities, constraints, scope

3. **Determine milestone version:**
   - Parse last version from MILESTONES.md
   - Suggest next version (v1.0 → v1.1, or v2.0 for major)
   - Confirm with user

4. **Update PROJECT.md:**

   Add/update these sections:

   ```markdown
   ## Current Milestone: v[X.Y] [Name]

   **Goal:** [One sentence describing milestone focus]

   **Target features:**
   - [Feature 1]
   - [Feature 2]
   - [Feature 3]
   ```

   Update Active requirements section with new goals.

   Update "Last updated" footer.

5. **Update STATE.md:**

   ```markdown
   ## Current Position

   Phase: Not started (run /gsd:create-roadmap)
   Plan: —
   Status: Defining requirements
   Last activity: [today] — Milestone v[X.Y] started
   ```

   Keep Accumulated Context section (decisions, blockers) from previous milestone.

6. **Cleanup:**
   - Delete MILESTONE-CONTEXT.md if exists (consumed)

7. **Git commit:**

   Check planning config:
   ```bash
   COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
   git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
   ```

   If `COMMIT_PLANNING_DOCS=false`: Skip git operations

   If `COMMIT_PLANNING_DOCS=true` (default):
   ```bash
   git add .planning/PROJECT.md .planning/STATE.md
   git commit -m "docs: start milestone v[X.Y] [Name]"
   ```

8. **Route to next step:**

   ```
   Milestone v[X.Y] [Name] initialized.

   PROJECT.md updated with new goals.

   ---

   ## ▶ Next Up

   Choose your path:

   **Option A: Research first** (new domains/capabilities)
   Research ecosystem before scoping. Discovers patterns, expected features, architecture approaches.

   `/gsd:research-project`

   **Option B: Define requirements directly** (familiar territory)
   Skip research, define requirements from what you know.

   `/gsd:define-requirements`

   <sub>`/clear` first → fresh context window</sub>

   ---
   ```

</process>

<success_criteria>
- PROJECT.md updated with Current Milestone section
- Active requirements reflect new milestone goals
- STATE.md reset for new milestone
- MILESTONE-CONTEXT.md consumed and deleted (if existed)
- Git commit made
- User routed to define-requirements (or research-project)
</success_criteria>
