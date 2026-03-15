<purpose>
AI-assisted sprint planning for Jira projects. Analyzes backlog, proposes sprint
composition based on priority/dependencies/capacity, or validates an existing sprint
for issues.

Standalone — does not require a GSD project. Operates entirely within Jira.

Two modes:
- Suggest: analyze backlog → propose sprint composition → PM approves → apply
- Validate: analyze existing sprint → identify issues → PM adjusts → apply fixes

Conversational — PM can adjust the sprint plan iteratively before applying changes.
All Jira writes require PM confirmation.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<process>

<step name="check_mcp" priority="first">
Attempt a lightweight Jira MCP call to verify connectivity:

```
mcp__mcp_atlassian__jira_search(jql="project IS NOT EMPTY", limit=1)
```

**If the MCP tool is not available or errors:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► JIRA CONNECTION FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Could not connect to Jira via MCP. Ensure mcp-atlassian is configured.

Setup:
1. Install: pip install mcp-atlassian (or uvx mcp-atlassian)
2. Add to your MCP config (Claude Desktop, Cursor, or claude_desktop_config.json):

   {
     "mcpServers": {
       "mcp_atlassian": {
         "command": "uvx",
         "args": ["mcp-atlassian"],
         "env": {
           "JIRA_URL": "https://your-company.atlassian.net",
           "JIRA_USERNAME": "your.email@company.com",
           "JIRA_API_TOKEN": "your_api_token"
         }
       }
     }
   }

3. Get API token: https://id.atlassian.com/manage-profile/security/api-tokens
4. Restart your IDE/runtime and retry.
```

Exit.

**If successful:** Continue.
</step>

<step name="parse_args">
Parse $ARGUMENTS to extract configuration:

**Required:**
- `--project PROJ` — Jira project key. If not provided:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ERROR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

--project is required. Specify your Jira project key.

Usage:
  /gsd:plan-sprint --project PROJ                          Suggest sprint composition
  /gsd:plan-sprint --project PROJ --validate               Validate current sprint
  /gsd:plan-sprint --project PROJ --sprint "Sprint 5"      Target specific sprint
  /gsd:plan-sprint --project PROJ --capacity 40            Set capacity (story points)
```

Exit.

**Optional:**
- `--sprint "Sprint Name"` — target a specific sprint by name
- `--validate` — switch to validate mode (default is suggest mode)
- `--capacity N` — team capacity in story points (used for scope analysis)

Set `MODE = "validate"` if `--validate` flag present, otherwise `MODE = "suggest"`.

Validate project exists:
```
mcp__mcp_atlassian__jira_search(jql="project = '{PROJECT_KEY}'", limit=1)
```

If invalid project, show error and exit.

Go to `discover_board`.
</step>

<step name="discover_board">
Find the agile board for this project.

```
mcp__mcp_atlassian__jira_get_agile_boards(project_key=PROJECT_KEY)
```

**If multiple boards found:**

Use AskUserQuestion:
- header: "Select board"
- question: "Multiple boards found for {PROJECT_KEY}. Which one?"
- options: [board names from response]

Set `BOARD_ID` from selected board.

**If single board:** Set `BOARD_ID` directly.

**If no boards found:**

```
⚠ No agile boards found for project {PROJECT_KEY}.

Sprint planning requires a Scrum or Kanban board.
Create one in Jira first, then retry.
```

Exit.

Go to `discover_sprints`.
</step>

<step name="discover_sprints">
Find active and future sprints.

```
mcp__mcp_atlassian__jira_get_sprints_from_board(board_id=BOARD_ID, state="active,future")
```

Parse sprints into:
- `ACTIVE_SPRINT` — currently active sprint (if any)
- `FUTURE_SPRINTS` — upcoming sprints (sorted by start date)

**If --sprint specified:** Match by name. If no match, show available sprints and ask to pick.

**If --sprint NOT specified:**
- **Suggest mode:** Target the next future sprint. If none exists, use active sprint.
- **Validate mode:** Target the active sprint. If none active, show error.

Set `TARGET_SPRINT` (id, name, start date, end date, goal).

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SPRINT PLANNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: {PROJECT_KEY}
Board: {BOARD_NAME}
Target Sprint: {SPRINT_NAME}
Mode: {Suggest | Validate}
```

**If validate mode:** Go to `analyze_sprint`
**If suggest mode:** Go to `analyze_backlog`
</step>

<step name="analyze_backlog">
**Suggest mode.** Gather backlog data to propose sprint composition.

**1. Get current sprint state (if active sprint exists):**

```
mcp__mcp_atlassian__jira_get_sprint_issues(
  sprint_id=ACTIVE_SPRINT.id,
  fields="summary,status,story_points,assignee,priority,issuetype,labels"
)
```

Calculate: total points committed, points completed, velocity estimate.

**2. Query the backlog:**

```
mcp__mcp_atlassian__jira_search(
  jql="project = '{PROJECT_KEY}' AND sprint IS EMPTY AND status NOT IN ('Done', 'Closed') ORDER BY priority DESC, rank ASC",
  limit=20
)
```

**3. For each backlog candidate, fetch details:**

For the top 20 results, extract:
- `key`, `summary`, `type`, `priority`
- `story_points` (if available)
- `labels`, `components`
- `linked issues` (for dependency analysis)

Identify epics for grouping:
```
mcp__mcp_atlassian__jira_search(
  jql="project = '{PROJECT_KEY}' AND issuetype = Epic AND status NOT IN ('Done', 'Closed')",
  limit=10
)
```

Map tickets to their epics for the sprint plan grouping.

**4. Discover field IDs (for story points):**

```
mcp__mcp_atlassian__jira_search_fields(query="story point")
```

Go to `compute_analysis`.
</step>

<step name="analyze_sprint">
**Validate mode.** Analyze an existing sprint for issues.

**1. Get sprint issues:**

```
mcp__mcp_atlassian__jira_get_sprint_issues(
  sprint_id=TARGET_SPRINT.id,
  fields="summary,status,story_points,assignee,priority,issuetype,labels"
)
```

**2. For each sprint issue, check for problems:**

For dependency analysis, fetch linked issues:
```
mcp__mcp_atlassian__jira_get_issue(issue_key=KEY)
```
(Do this for tickets that have linked issues listed)

**3. Discover field IDs:**

```
mcp__mcp_atlassian__jira_search_fields(query="story point")
```

Go to `compute_analysis`.
</step>

<step name="compute_analysis">
Build the sprint analysis. This step is pure computation — no Jira calls.

### For suggest mode — build proposed sprint plan:

**1. Calculate capacity:**
- If `--capacity` provided, use that value
- If velocity from active sprint available, use as default
- Otherwise, flag that capacity is unknown

**2. Score and rank backlog items:**

Priority weighting:
- Highest/Blocker: 5
- High/Critical: 4
- Medium: 3
- Low: 2
- Lowest: 1

Bonus factors:
- +1 if ticket has acceptance criteria (ready for dev)
- +1 if ticket has story point estimate
- +1 if ticket's epic has other tickets already in sprint (epic cohesion)
- -2 if ticket has unresolved blocker (dependency risk)

**3. Build the sprint proposal:**

Add tickets in priority-score order until capacity is reached (or 15 tickets max if no estimates).

Group by epic for presentation.

**4. Identify warnings:**

- Tickets without estimates → "Missing estimate"
- Tickets without AC → "No acceptance criteria (run /gsd:define-requirements)"
- Dependency chains where blocker is NOT in sprint → "Blocker {KEY} not in sprint"
- Single-epic domination (>70% of points) → "Sprint heavily weighted toward one epic"
- Scope exceeds capacity by >20% → "Overcommitted"

### For validate mode — identify issues:

**1. Categorize issues by severity:**

**Blockers** (must fix before sprint starts):
- Ticket A blocks Ticket B, but A is not in sprint and not Done
- Ticket has status "Blocked" or "On Hold"
- No tickets in sprint (empty sprint)

**Warnings** (should fix):
- Tickets without story point estimates
- Tickets without acceptance criteria
- Total points exceed capacity by >20% (if capacity known)
- Unbalanced assignment (one person has >50% of points)
- Tickets in "Done" status still in sprint (cleanup needed)

**Info** (nice to know):
- Sprint has no goal set
- Some tickets have no assignee
- Epic distribution (for awareness)

Go to `present_plan`.
</step>

<step name="present_plan">
Display the sprint plan or validation results.

### Suggest mode — proposed sprint:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROPOSED SPRINT: {SPRINT_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Capacity: {N} points | Proposed: {M} points | Tickets: {K}

## Epic: User Authentication (PROJ-50)

| #  | Key       | Type  | Summary                       | Points | Priority | Status    |
|----|-----------|-------|-------------------------------|--------|----------|-----------|
| 1  | PROJ-124  | Story | Add SSO for enterprise users  | 5      | High     | ✓ Ready   |
| 2  | PROJ-125  | Task  | Implement session timeout     | 3      | High     | ✓ Ready   |

## Epic: Dashboard (PROJ-60)

| #  | Key       | Type  | Summary                       | Points | Priority | Status    |
|----|-----------|-------|-------------------------------|--------|----------|-----------|
| 3  | PROJ-130  | Story | Widget drag-and-drop          | 8      | Medium   | ⚠ No AC   |
| 4  | PROJ-131  | Bug   | Chart rendering on mobile     | 2      | High     | ✓ Ready   |

## Unlinked (No Epic)

| #  | Key       | Type  | Summary                       | Points | Priority | Status    |
|----|-----------|-------|-------------------------------|--------|----------|-----------|
| 5  | PROJ-140  | Task  | Update CI pipeline            | 3      | Medium   | ⚠ No est. |

────────────────────────────────────────────────────────
Total: {M} points across {K} tickets
────────────────────────────────────────────────────────

## Warnings

⚠ PROJ-130: No acceptance criteria — run /gsd:define-requirements PROJ-130 --enrich
⚠ PROJ-140: No story point estimate
⚠ Sprint goal not set

## Not Included (top backlog items that didn't fit)

| Key       | Summary                    | Points | Reason           |
|-----------|----------------------------|--------|------------------|
| PROJ-150  | Email notifications        | 8      | Exceeds capacity |
| PROJ-151  | Data export feature        | 13     | Exceeds capacity |
```

### Validate mode — issue report:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SPRINT VALIDATION: {SPRINT_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tickets: {K} | Points: {M} | Capacity: {N or "unknown"}

## Current Sprint Composition

| #  | Key       | Type  | Summary                       | Points | Assignee | Status    |
|----|-----------|-------|-------------------------------|--------|----------|-----------|
| 1  | PROJ-124  | Story | Add SSO for enterprise users  | 5      | @alice   | In Prog   |
| 2  | PROJ-125  | Task  | Implement session timeout     | 3      | @bob     | To Do     |
| 3  | PROJ-130  | Story | Widget drag-and-drop          | 8      | —        | To Do     |

────────────────────────────────────────────────────────

## Blockers (must resolve)

✗ PROJ-125 is blocked by PROJ-200 (status: Open, NOT in sprint)
  → Either add PROJ-200 to sprint or remove PROJ-125

## Warnings (should address)

⚠ PROJ-130: No acceptance criteria — devs may interpret differently
⚠ PROJ-130: No assignee
⚠ Total points (40) exceed capacity (30) by 33%

## Info

○ Sprint has no goal set
○ 60% of points assigned to @alice (potential bottleneck)

────────────────────────────────────────────────────────
Issues: {B} blockers, {W} warnings, {I} info
```

Go to `iterate`.
</step>

<step name="iterate">
**PM adjustment loop.** PM reviews and adjusts. Max 5 iterations.

Initialize: `iteration_count = 1`

Wait for PM response (plain text, no AskUserQuestion).

**If PM approves:**
- Responses indicating approval: "looks good", "approve", "yes", "go", "apply", "ship it", "lgtm"
- Go to `apply`

**If PM requests changes:**
- Any other response is treated as adjustment requests

**Common adjustment patterns:**

| PM says | Action |
|---------|--------|
| "add PROJ-150" | Add ticket to proposed sprint, recalculate totals |
| "remove PROJ-130" | Remove from proposed sprint, recalculate |
| "swap PROJ-130 for PROJ-150" | Remove one, add other |
| "increase capacity to 50" | Update capacity, re-evaluate fit |
| "move PROJ-125 to next sprint" | Remove from this sprint |
| "this looks overloaded" | Suggest which tickets to cut (lowest priority first) |
| "can we fit more?" | Show next backlog candidates that would fit |

After changes:
- Recalculate totals
- Re-run warnings analysis
- Re-display the updated plan (abbreviated — only show changes and new totals)
- Increment `iteration_count`

**If iteration_count > 5:**
Display: "We've iterated 5 times. Let me apply what we have — you can always adjust in Jira."
Go to `apply`.
</step>

<step name="apply">
**Apply sprint changes to Jira.** Show each action before executing.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► APPLYING SPRINT CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Confirm before writing:**

Use AskUserQuestion:
- header: "Apply changes?"
- question: "I'm about to make these changes to Jira. Confirm?"
- options:
  - "Apply all" — Execute all changes
  - "Review each" — Confirm each change individually
  - "Cancel" — Don't apply anything

**If "Cancel":** Display "No changes applied." and go to `summary`.

### Changes to apply (in order):

**1. Update sprint goal (if suggested/changed):**

```
mcp__mcp_atlassian__jira_update_sprint(
  sprint_id=TARGET_SPRINT.id,
  name=TARGET_SPRINT.name,
  goal="Sprint goal text"
)
```

Display: `✓ Updated sprint goal`

**2. Move tickets into sprint (suggest mode):**

For each ticket being added to the sprint, update its sprint field:

```
mcp__mcp_atlassian__jira_update_issue(
  issue_key=KEY,
  additional_fields="{\"SPRINT_FIELD\": TARGET_SPRINT.id}"
)
```

Display: `✓ Added PROJ-124 to {SPRINT_NAME}`

Note: If sprint field ID is not discoverable, use transition to move tickets:

```
mcp__mcp_atlassian__jira_transition_issue(
  issue_key=KEY,
  transition="To Do"
)
```

**3. Remove tickets from sprint (if PM removed any):**

```
mcp__mcp_atlassian__jira_update_issue(
  issue_key=KEY,
  additional_fields="{\"SPRINT_FIELD\": null}"
)
```

Display: `✓ Removed PROJ-130 from {SPRINT_NAME}`

**4. Update priorities (if PM changed any):**

```
mcp__mcp_atlassian__jira_update_issue(
  issue_key=KEY,
  additional_fields="{\"priority\": {\"name\": \"NEW_PRIORITY\"}}"
)
```

Display: `✓ Updated PROJ-140 priority to High`

**5. Post sprint planning comment on key tickets:**

For tickets that were added or had changes:

```
mcp__mcp_atlassian__jira_add_comment(
  issue_key=KEY,
  body="Added to {SPRINT_NAME} via GSD sprint planning ({date}). Sprint capacity: {N} points."
)
```

**If "Review each" selected:** Before each write, display what will happen and wait for "yes"/"skip".

Go to `summary`.
</step>

<step name="summary">
Display final results and suggest next steps.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SPRINT PLANNING COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sprint: {SPRINT_NAME}
Tickets: {K} | Points: {M} | Capacity: {N}

Changes applied:
  ✓ {X} tickets added to sprint
  ✓ {Y} tickets removed
  ✓ Sprint goal updated
  ✓ {Z} priorities updated

## Sprint Composition (Final)

| Epic                  | Tickets | Points | % of Sprint |
|-----------------------|---------|--------|-------------|
| User Authentication   | 3       | 11     | 37%         |
| Dashboard             | 2       | 10     | 33%         |
| Infrastructure        | 2       | 6      | 20%         |
| Unlinked              | 1       | 3      | 10%         |

## Remaining Warnings

⚠ PROJ-130: No acceptance criteria — enrich before sprint starts
⚠ PROJ-140: No story point estimate

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Fix ticket quality issues:**

`/gsd:define-requirements PROJ-130 PROJ-140 --enrich`

**Developer handoff** (import sprint into GSD):

`/gsd:from-jira --jql 'sprint = "{SPRINT_NAME}"'`

**Define more requirements for the backlog:**

`/gsd:define-requirements --project {PROJECT_KEY}`

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd:plan-sprint --project {PROJECT_KEY} --validate` — re-validate after changes
- `/gsd:plan-sprint --project {PROJECT_KEY} --sprint "Sprint {N+1}"` — plan next sprint

───────────────────────────────────────────────────────────────
```
</step>

</process>

<success_criteria>
- [ ] MCP Jira connectivity verified
- [ ] Project validated as existing in Jira
- [ ] Agile board discovered for the project
- [ ] Active and future sprints retrieved
- [ ] Target sprint identified (from --sprint or auto-detected)
- [ ] Suggest mode: backlog analyzed with priority scoring and dependency checking
- [ ] Validate mode: sprint issues analyzed for blockers, warnings, and info
- [ ] Sprint plan/validation presented with epic grouping and warnings
- [ ] PM approved or iterated on the plan (max 5 iterations)
- [ ] Changes applied to Jira with user confirmation
- [ ] Summary displayed with epic breakdown and next steps
- [ ] Tickets without AC flagged with /gsd:define-requirements suggestion
- [ ] Developer handoff path shown (/gsd:from-jira)
</success_criteria>
