<purpose>
Import Jira tickets into the current GSD project as new phases. Fetches ticket details via
mcp-atlassian MCP server, auto-detects issue type (epic vs story/task/bug), creates phase
directories and CONTEXT.md files from acceptance criteria, and routes to planning.

Supports three input modes:
- Ticket keys: PROJ-123 PROJ-456
- Epic key: PROJ-100 (fetches children automatically)
- JQL query: --jql 'sprint = "Sprint 5" AND assignee = currentUser()'

Read-only — never writes back to Jira.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<process>

## 1. Validate Project

Check that a GSD project exists:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "0")
```

Check `roadmap_exists` from init JSON. If false:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ERROR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No GSD project found (.planning/ROADMAP.md missing).

/gsd:from-jira adds phases to an existing project.
Run /gsd:new-project first to initialize.
```

Exit.

## 2. Check MCP Jira Tools

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

**If successful:** Continue. Store the Jira base URL from the response if available for linking later.

## 3. Parse Arguments

Parse $ARGUMENTS to determine input mode:

**Mode A — JQL query:**
If arguments contain `--jql`:
- Extract the JQL string (everything after `--jql` in quotes or until end of args)
- Set `MODE = "jql"`
- Set `JQL_QUERY` to the extracted string

**Mode B — Ticket keys:**
- All non-flag arguments are treated as Jira issue keys (e.g., PROJ-123)
- Validate format: each key should match pattern `[A-Z][A-Z0-9]+-\d+`
- Set `MODE = "keys"`
- Set `ISSUE_KEYS` to the list of keys

**If no arguments provided:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ERROR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No Jira tickets specified.

Usage:
  /gsd:from-jira PROJ-123                          Single ticket
  /gsd:from-jira PROJ-123 PROJ-456 PROJ-789        Multiple tickets
  /gsd:from-jira PROJ-100                           Epic (children auto-fetched)
  /gsd:from-jira --jql 'sprint = "Sprint 5"'       JQL query
```

Exit.

## 4. Fetch Issues

**Mode A — JQL:**

```
result = mcp__mcp_atlassian__jira_search(
  jql=JQL_QUERY,
  limit=20
)
```

Parse the results. If more than 20 results, display warning:
```
⚠ Query returned more than 20 results. Showing first 20.
  Narrow your JQL query for more targeted import.
```

Collect all issues into `ISSUES` list.

**Mode B — Keys:**

For each key in ISSUE_KEYS:

```
issue = mcp__mcp_atlassian__jira_get_issue(issue_key=KEY)
```

Collect all issues into `ISSUES` list.

**If any fetch fails:** Display error for the specific key, continue with remaining keys.
**If all fetches fail:** Error and exit.

## 5. Classify Issues

For each issue in `ISSUES`, inspect the `issuetype` field (or `issuetype.name`):

- **Epic** → add to `EPICS` list
- **Story, Task, Bug, Sub-task, or any other type** → add to `TICKETS` list

Track for each issue:
- `key` — e.g., PROJ-123
- `type` — e.g., Story, Epic, Bug
- `summary` — ticket title
- `description` — full description body
- `priority` — e.g., High, Medium, Low
- `story_points` — if available (custom field varies by instance)
- `acceptance_criteria` — extracted from description (see step 9 for parsing)
- `subtasks` — list of subtask keys and summaries
- `linked_issues` — linked issue keys and relationship types
- `labels` — ticket labels
- `components` — ticket components
- `comments` — latest 5 comments (if available)

## 6. Resolve Epics

**Skip if:** No epics in `EPICS` list.

For each epic in `EPICS`:

```
children = mcp__mcp_atlassian__jira_search(
  jql="'Epic Link' = {EPIC_KEY} ORDER BY rank ASC",
  limit=20
)
```

**If JQL field name fails** (some instances use different field names), try:
```
children = mcp__mcp_atlassian__jira_search(
  jql="parent = {EPIC_KEY} ORDER BY rank ASC",
  limit=20
)
```

For each child:
- Add to `TICKETS` list (with all fields from step 5)
- Tag with `epic_source = EPIC_KEY` for traceability

Remove the epic itself from `TICKETS` (epics become grouping context, not phases).

**If epic has no children:**
Treat the epic itself as a single ticket (add to `TICKETS`).

Display:
```
◆ Epic {EPIC_KEY}: {summary}
  Found {N} child issues
```

## 7. Present Issues

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► JIRA IMPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Display the issues that will become phases:

```
| #  | Jira Key  | Type  | Summary                    | Priority |
|----|-----------|-------|----------------------------|----------|
| 1  | PROJ-123  | Story | Add user authentication    | High     |
| 2  | PROJ-456  | Task  | Dashboard widget system    | Medium   |
| 3  | PROJ-789  | Bug   | Fix login redirect loop    | High     |
```

If epics were resolved:
```
Source: Epic PROJ-100 "User Management" ({N} children)
```

Ask user to confirm:

Use AskUserQuestion:
- header: "Import these as GSD phases?"
- question: "These {N} Jira tickets will be added as new phases to your current milestone. Each gets a CONTEXT.md generated from its acceptance criteria. Continue?"
- options:
  - "Import all" — Create phases for all listed tickets
  - "Select specific tickets" — Let me choose which ones
  - "Cancel" — Abort import

**If "Select specific tickets":** Present numbered list, ask user to enter numbers (comma-separated). Filter `TICKETS` to selected only.

**If "Cancel":** Exit.

## 8. Create Phases

For each ticket in `TICKETS` (in order):

```bash
RESULT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase add "${TICKET_SUMMARY}")
```

Parse JSON result: `phase_number`, `padded`, `name`, `slug`, `directory`.

Store mapping: `PHASE_MAP[ticket.key] = { phase_number, padded, directory }`.

Display progress:
```
✓ PROJ-123 → Phase {N}: {summary}
✓ PROJ-456 → Phase {N+1}: {summary}
✓ PROJ-789 → Phase {N+2}: {summary}
```

## 9. Generate CONTEXT.md

For each ticket in `TICKETS`, generate a CONTEXT.md in the phase directory.

### Acceptance Criteria Extraction

Parse the ticket description to find acceptance criteria. Common patterns:

1. **Heading-based:** Look for `## Acceptance Criteria`, `### AC`, `## Done When`, `**Acceptance Criteria:**`
2. **Checkbox-based:** Lines starting with `- [ ]` or `- [x]` after an AC heading
3. **Numbered-based:** Numbered list items after an AC heading
4. **Given/When/Then:** Blocks starting with `Given`, `When`, `Then`
5. **Fallback:** If no structured AC found, use the full description as context

Store extracted criteria in `ACCEPTANCE_CRITERIA` list.

### Description Parsing

Separate the description into:
- **Phase boundary:** First paragraph or summary section (scope anchor)
- **Implementation details:** Technical details, constraints, notes
- **References:** Links, attachments mentioned, external docs

### Linked Issues Parsing

Categorize linked issues:
- `blocks` / `is blocked by` → note as dependency context
- `relates to` → note as related context
- `is blocked by` → add to deferred ideas (can't do until blocker resolved)

### Write CONTEXT.md

Write to `{directory}/{padded}-CONTEXT.md`:

```markdown
# Phase [PHASE_NUM]: [TICKET_SUMMARY] - Context

**Gathered:** [current date]
**Status:** Ready for planning
**Source:** Jira [{TICKET_KEY}]({JIRA_BASE_URL}/browse/{TICKET_KEY})

<domain>
## Phase Boundary

[Phase boundary text — first paragraph of description or ticket summary.
This defines what the phase delivers. Scope is anchored to the Jira ticket.]

</domain>

<decisions>
## Implementation Decisions

### From Acceptance Criteria (Locked)
[For each acceptance criterion extracted from the ticket:]
- [Criterion 1]
- [Criterion 2]
- [Criterion 3]

[If Given/When/Then format found:]
- Given [precondition], when [action], then [expected result]

[If no AC found:]
- No structured acceptance criteria in ticket — derive from description above

### From Subtasks (Locked)
[For each subtask of this ticket:]
- [{SUBTASK_KEY}]: {subtask summary}

[If no subtasks:]
[Omit this section entirely]

### From Description
[Key implementation details, constraints, or technical notes extracted from the
description body that aren't acceptance criteria but inform implementation:]
- [Detail 1]
- [Detail 2]

[If description is minimal:]
- Ticket description is brief — implementation details at Claude's discretion

### From Labels & Components
[If ticket has labels or components, note them as domain hints:]
- Labels: {label1}, {label2}
- Components: {component1}, {component2}

[If none: omit this section]

### Claude's Discretion
- Implementation approach and architecture (unless specified in ticket)
- Library and framework choices (unless constrained by project stack)
- File structure and naming conventions
- Error handling patterns (unless specified in AC)
- Test strategy

</decisions>

<specifics>
## Specific Ideas

[Any specific references, links, or attachments mentioned in the ticket or comments.]
[Recent relevant comments (latest 3-5) that add implementation context.]

[If none: "No specific references in ticket — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Linked "is blocked by" issues — can't be done until blocker resolved:]
- [{BLOCKED_KEY}]: {summary} (blocker — not in scope for this phase)

[Linked "relates to" issues that suggest future work:]
- [{RELATED_KEY}]: {summary} (related — may be a future phase)

[If no linked issues: "None — ticket is self-contained"]

</deferred>

---

*Phase: {PADDED}-{SLUG}*
*Context gathered: [date] via Jira import ({TICKET_KEY})*
```

## 10. Update STATE.md

Read `.planning/STATE.md`.

Add or update a `### Jira Source` section under `## Accumulated Context`:

```markdown
### Jira Source

| Phase | Jira Key | Type | Summary |
|-------|----------|------|---------|
| {N}   | PROJ-123 | Story | Add user authentication |
| {N+1} | PROJ-456 | Task  | Dashboard widget system |
| {N+2} | PROJ-789 | Bug   | Fix login redirect loop |
```

If a `### Jira Source` table already exists, append new rows to it.

Under `### Roadmap Evolution`, add:
```
- Phases {N}-{N+M} added from Jira import ({date})
```

## 11. Commit and Route

### Commit

Collect all created/modified files:
- All new `*-CONTEXT.md` files
- `.planning/ROADMAP.md` (modified by `phase add`)
- `.planning/STATE.md` (modified in step 10)
- All new `.gitkeep` files in phase directories

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit \
  "feat(jira): import {N} tickets as phases {FIRST}-{LAST}" \
  --files {all_files_space_separated}
```

### Present Results

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► JIRA IMPORT COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Imported {N} Jira tickets as new phases:

| Phase | Jira Key  | Summary                    | Context |
|-------|-----------|----------------------------|---------|
| {N}   | PROJ-123  | Add user authentication    | ✓       |
| {N+1} | PROJ-456  | Dashboard widget system    | ✓       |
| {N+2} | PROJ-789  | Fix login redirect loop    | ✓       |

Each phase has a CONTEXT.md with locked decisions from Jira acceptance criteria.
```

### Route to Next Steps

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**Option A: Refine context first** (recommended if tickets lack detail)

/gsd:discuss-phase {FIRST_PHASE}

**Option B: Plan directly** (recommended if tickets have clear AC)

/gsd:plan-phase {FIRST_PHASE}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{first-phase-dir}/*-CONTEXT.md — review generated context
- /gsd:from-jira --jql '<query>' — import more tickets
- /gsd:progress — see full project status

───────────────────────────────────────────────────────────────
```

</process>

<success_criteria>
- [ ] `.planning/` directory validated (project exists)
- [ ] MCP Jira tools verified as available
- [ ] Arguments parsed (keys, epic, or JQL mode detected)
- [ ] All issues fetched successfully from Jira
- [ ] Epics resolved to child issues
- [ ] User confirmed import
- [ ] Phases created via `gsd-tools.cjs phase add` for each ticket
- [ ] CONTEXT.md generated for each phase with acceptance criteria as locked decisions
- [ ] STATE.md updated with Jira source mapping
- [ ] All artifacts committed
- [ ] User sees summary and next steps
</success_criteria>
