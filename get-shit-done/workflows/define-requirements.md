<purpose>
Define or enrich Jira tickets with well-structured requirements through conversational
interaction. PM/PO describes a feature, agent asks clarifying questions, then creates
or updates Jira tickets with structured acceptance criteria, subtasks, and metadata.

Standalone — does not require a GSD project. Operates entirely within Jira.

Two modes:
- Create: conversational feature definition → structured Jira ticket(s)
- Enrich: analyze existing ticket → identify gaps → improve in place

Writes acceptance criteria in a standard format that /gsd:from-jira can parse
into CONTEXT.md locked decisions, creating the bridge between PM and developer flows.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<ac_format>
CRITICAL: All acceptance criteria MUST be written in this exact format in Jira ticket
descriptions. This is the contract between management and developer flows.

```markdown
## Acceptance Criteria
- [ ] Users can log in via SSO with SAML 2.0
- [ ] Session expires after 30 minutes of inactivity
- [ ] Failed login attempts are logged with IP address
```

Rules:
- Always use `## Acceptance Criteria` as the heading (h2)
- Each criterion is a markdown checkbox: `- [ ] <criterion>`
- Criteria must be user-observable and testable
- Avoid implementation details — describe WHAT, not HOW
- One behavior per checkbox line
- Use Given/When/Then inline when helpful: `- [ ] Given [X], when [Y], then [Z]`

This format is what /gsd:from-jira parses to generate locked decisions in CONTEXT.md.
If the format is wrong, the developer flow cannot auto-generate context.
</ac_format>

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

Could not connect to Jira via MCP. Ensure mcp-atlassian is configured with write access.

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
4. Ensure READ_ONLY_MODE is NOT set (this command writes to Jira).
5. Restart your IDE/runtime and retry.
```

Exit.

**If successful:** Continue. Extract available projects from the response for later validation.
</step>

<step name="parse_mode">
Parse $ARGUMENTS to determine mode:

**Enrich mode:**
If arguments contain ticket keys (matching `[A-Z][A-Z0-9]+-\d+`) AND `--enrich` flag:
- Set `MODE = "enrich"`
- Set `TICKET_KEYS` to the list of keys
- Go to `discover_fields`

**Create mode:**
Everything else:
- Set `MODE = "create"`
- If `--project PROJ` provided, set `PROJECT_KEY`
- If `--epic EPIC-KEY` provided, set `EPIC_KEY`
- Go to `discover_fields`

**If enrich mode without ticket keys:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ERROR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

--enrich requires at least one ticket key.

Usage:
  /gsd:define-requirements PROJ-123 --enrich            Enrich single ticket
  /gsd:define-requirements PROJ-123 PROJ-456 --enrich   Enrich multiple tickets
  /gsd:define-requirements --project PROJ               Create new ticket
  /gsd:define-requirements                               Interactive create mode
```

Exit.
</step>

<step name="discover_fields">
Discover custom field IDs for the target Jira instance. Field names vary between instances.

```
mcp__mcp_atlassian__jira_search_fields(query="story point")
mcp__mcp_atlassian__jira_search_fields(query="epic")
```

Cache the results. Look for:
- Story points field (often `customfield_10028` or `story_points`)
- Epic link field (often `customfield_10014` or `epic`)
- Sprint field (often `customfield_10020`)

These field IDs will be used when creating/updating tickets.

If fields are not discoverable, proceed without them — they're optional metadata.

**If MODE = "enrich":** Go to `analyze_existing`
**If MODE = "create":** Go to `gather_context`
</step>

<step name="analyze_existing">
**Enrich mode only.** Fetch each ticket and identify what's missing.

For each key in TICKET_KEYS:

```
mcp__mcp_atlassian__jira_get_issue(issue_key=KEY)
```

For each ticket, assess quality across these dimensions:

| Dimension | Good | Missing |
|-----------|------|---------|
| Summary | Clear, specific | Vague, too broad |
| Description | Explains the problem/need | Empty or one-liner |
| Acceptance Criteria | `## Acceptance Criteria` with checkboxes | No AC section, or unstructured |
| Priority | Set | Default/unset |
| Story Points | Estimated | No estimate |
| Subtasks | Broken into actionable work | None |
| Labels/Components | Categorized | Uncategorized |
| Type | Specific (Story/Bug/Task) | Generic |

Display assessment:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TICKET ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROJ-123: "Add user authentication"

| Dimension          | Status | Notes                              |
|--------------------|--------|------------------------------------|
| Summary            | ✓      | Clear and specific                 |
| Description        | ⚠      | Brief — lacks context on SSO needs |
| Acceptance Criteria| ✗      | No AC section found                |
| Priority           | ✓      | High                               |
| Story Points       | ✗      | Not estimated                      |
| Subtasks           | ✗      | None defined                       |
| Labels             | ✓      | auth, backend                      |
| Type               | ✓      | Story                              |
```

Ask the PM what to improve:

Use AskUserQuestion:
- header: "What to enrich?"
- question: "I found gaps in this ticket. What should I improve?"
- options:
  - "Fix everything" — Address all gaps
  - "Just add acceptance criteria" — Focus on AC only
  - "Let me specify" — I'll tell you what to change

**If "Let me specify":** Wait for free-text response from PM.

Go to `draft_ticket` with the enrichment plan.
</step>

<step name="gather_context">
**Create mode.** Conversational feature definition with the PM.

**If PROJECT_KEY not set:**
Ask: "Which Jira project should I create this ticket in?"

Use AskUserQuestion or wait for free text. Validate the project exists:

```
mcp__mcp_atlassian__jira_search(jql="project = '{PROJECT_KEY}'", limit=1)
```

If invalid, show error and ask again.

**Begin feature conversation:**

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DEFINE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Let's define this feature. I'll ask a few questions to understand
what you need, then draft a structured Jira ticket for your approval.
```

Ask these questions sequentially (adapt based on answers — skip redundant questions):

1. **What:** "What feature or capability do you need? Describe it as you would to a colleague."
   - Wait for response.

2. **Who:** "Who is the user? (e.g., admin, end user, API consumer, internal team)"
   - Wait for response.

3. **Why:** "What problem does this solve? What happens if we don't build it?"
   - Wait for response.

4. **Success:** "How would you know this feature is working correctly? What would you test?"
   - Wait for response. This directly feeds acceptance criteria.

5. **Scope:** "What's explicitly OUT of scope? Anything you want to make sure we DON'T build?"
   - Wait for response.

6. **Priority:** "How urgent is this? (Highest / High / Medium / Low / Lowest)"
   - Wait for response.

7. **Context** (optional, ask only if relevant): "Any technical constraints, existing systems this integrates with, or prior decisions I should know about?"
   - Wait for response.

After gathering responses, go to `draft_ticket`.
</step>

<step name="draft_ticket">
Structure the gathered information into a Jira ticket draft.

**For create mode:** Build from conversation responses.
**For enrich mode:** Build from existing ticket + identified gaps.

### Draft structure:

**Summary:** Concise, action-oriented title (max 80 chars)
- Pattern: `<Verb> <what> <for whom/where>`
- Example: "Add SSO authentication for enterprise users"

**Type:** Infer from context:
- Story = new user-facing capability
- Task = technical/internal work
- Bug = fixing broken behavior
- If unclear, default to Story

**Priority:** From PM's answer or existing ticket

**Description:** Structured markdown body:

```markdown
## Overview

[1-3 sentences: what this feature does and why it matters]

## User Story

As a [user type], I want [capability] so that [benefit].

## Acceptance Criteria
- [ ] [Criterion 1 — derived from PM's "success" answer]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] [Criterion N]

## Out of Scope
- [Item 1 — from PM's "scope" answer]
- [Item 2]

## Technical Notes
[Any constraints, integrations, or prior decisions from PM's "context" answer]
[Omit this section if no technical notes]
```

**Subtasks:** Break the feature into 2-6 implementation-level subtasks:
- Each subtask is a concrete piece of work (not a restatement of AC)
- Pattern: `<Verb> <what>` — e.g., "Implement SAML handler", "Add session timeout middleware"
- Subtasks should be independently assignable

**Labels:** Infer from feature domain (e.g., `auth`, `api`, `frontend`, `backend`, `infra`)

**Story Points:** Suggest an estimate based on complexity (1/2/3/5/8/13). Present reasoning.

### Present draft to PM:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TICKET DRAFT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type: Story | Priority: High | Points: 5

Summary: Add SSO authentication for enterprise users

Description:
────────────────────────────────────────────────────────
## Overview

Enable enterprise users to authenticate via their organization's
SSO provider using SAML 2.0, eliminating the need for separate credentials.

## User Story

As an enterprise user, I want to log in using my company SSO
so that I don't need to manage a separate password.

## Acceptance Criteria
- [ ] Users can initiate SSO login from the login page
- [ ] SAML 2.0 assertions are validated and mapped to user accounts
- [ ] Session expires after 30 minutes of inactivity
- [ ] Failed SSO attempts show a meaningful error message
- [ ] Non-SSO login remains available for non-enterprise users

## Out of Scope
- SCIM provisioning (future phase)
- Multi-factor authentication (separate ticket)

## Technical Notes
- Must integrate with existing session management
- IdP metadata URL will be configurable per tenant
────────────────────────────────────────────────────────

Subtasks:
  1. Implement SAML 2.0 service provider endpoint
  2. Add IdP metadata configuration UI
  3. Create SSO login flow on login page
  4. Implement session timeout middleware
  5. Add error handling for failed assertions

Labels: auth, backend, enterprise
Epic: PROJ-50 (if --epic was provided)
```

Go to `iterate`.
</step>

<step name="iterate">
**Approval loop.** PM reviews and adjusts. Max 5 iterations.

Initialize: `iteration_count = 1`

Wait for PM response (plain text, no AskUserQuestion).

**If PM approves:**
- Responses indicating approval: "looks good", "approve", "yes", "ship it", "create it", "go", "lgtm"
- Go to `create_or_update`

**If PM requests changes:**
- Any other response is treated as change requests
- Parse the feedback, update the draft accordingly
- Re-display the updated draft
- Increment `iteration_count`

**If iteration_count > 5:**
Display: "We've iterated 5 times. Let me create what we have — you can always update it in Jira later."
Go to `create_or_update`

**Common change patterns to handle:**
- "add an AC for [X]" → add to acceptance criteria
- "remove subtask [N]" → remove from subtasks
- "change priority to [X]" → update priority
- "the description should mention [X]" → update description
- "split this into two tickets" → create two separate drafts, present both
- "make it simpler" → reduce subtasks, consolidate AC
</step>

<step name="create_or_update">
**Apply changes to Jira.** All writes require implicit PM approval (they approved in iterate step).

### Create mode:

**1. Create the main ticket:**

```
mcp__mcp_atlassian__jira_create_issue(
  project_key=PROJECT_KEY,
  issue_type=TYPE,
  summary=SUMMARY,
  description=DESCRIPTION,
  additional_fields="{\"priority\": {\"name\": \"PRIORITY\"}, \"labels\": [LABELS]}"
)
```

Store the returned issue key as `CREATED_KEY`.

If story points field was discovered:
```
mcp__mcp_atlassian__jira_update_issue(
  issue_key=CREATED_KEY,
  additional_fields="{\"STORY_POINTS_FIELD\": POINTS}"
)
```

**2. Create subtasks:**

Build subtasks array for batch creation:

```
mcp__mcp_atlassian__jira_batch_create_issues(
  project_key=PROJECT_KEY,
  issues=[
    {"issue_type": "Sub-task", "summary": "Subtask 1 summary", "description": "Part of CREATED_KEY"},
    {"issue_type": "Sub-task", "summary": "Subtask 2 summary", "description": "Part of CREATED_KEY"},
    ...
  ]
)
```

Note: If batch create doesn't support parent linking, create subtasks individually with parent field.

**3. Link to epic (if --epic provided):**

```
mcp__mcp_atlassian__jira_link_to_epic(
  issue_key=CREATED_KEY,
  epic_key=EPIC_KEY
)
```

### Enrich mode:

**Update existing ticket:**

```
mcp__mcp_atlassian__jira_update_issue(
  issue_key=TICKET_KEY,
  summary=UPDATED_SUMMARY,
  description=UPDATED_DESCRIPTION,
  additional_fields="{...updated fields...}"
)
```

**Create missing subtasks** (if needed):

Same as create mode but for existing ticket.

Display progress:
```
✓ Created PROJ-124: "Add SSO authentication for enterprise users"
✓ Created 5 subtasks (PROJ-125 through PROJ-129)
✓ Linked to epic PROJ-50
```

Or for enrich:
```
✓ Updated PROJ-123: added acceptance criteria, 3 subtasks, story points
```

Go to `document_rationale`.
</step>

<step name="document_rationale">
Post a comment on the created/updated ticket documenting the requirements conversation.

```
mcp__mcp_atlassian__jira_add_comment(
  issue_key=CREATED_KEY,
  body="## Requirements Definition Session\n\n**Defined via:** GSD /gsd:define-requirements\n**Date:** [current date]\n\n### Key Decisions\n- [Summary of PM's answers to Who/What/Why]\n- [Any scope decisions made during iteration]\n\n### Acceptance Criteria Rationale\n[Brief note on why each AC was chosen — maps to PM's 'success' answer]\n\n### Out of Scope (Explicit)\n- [Items PM explicitly excluded]\n\n---\n*This comment was generated by GSD define-requirements to document the rationale behind these requirements.*"
)
```

This comment serves as an audit trail — when a developer later reads the ticket,
they understand not just WHAT the requirements are but WHY they were chosen.

Go to `check_duplicates`.
</step>

<step name="check_duplicates">
Search for potentially duplicate or overlapping tickets.

```
mcp__mcp_atlassian__jira_search(
  jql="project = '{PROJECT_KEY}' AND summary ~ '{KEY_TERMS}' AND key != '{CREATED_KEY}' ORDER BY created DESC",
  limit=5
)
```

Extract 2-3 key terms from the summary for the search.

**If potential duplicates found:**

```
⚠ Potential overlapping tickets found:

| Key       | Summary                          | Status      |
|-----------|----------------------------------|-------------|
| PROJ-089  | SSO integration for portal       | In Progress |
| PROJ-067  | Enterprise auth improvements     | Open        |

These may overlap with your new ticket.
```

Use AskUserQuestion:
- header: "Link related tickets?"
- question: "Want me to link any of these as 'relates to' on your new ticket?"
- options:
  - "Link all" — Link all found tickets
  - "Let me choose" — I'll pick which ones
  - "Skip" — No linking needed

**If linking:**

```
mcp__mcp_atlassian__jira_create_issue_link(
  link_type="Relates",
  inward_issue_key=CREATED_KEY,
  outward_issue_key=RELATED_KEY
)
```

**If no duplicates found:** Skip silently.

Go to `summary`.
</step>

<step name="summary">
Display final results and suggest next steps.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► REQUIREMENTS DEFINED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Create mode:]
Created {N} ticket(s) in {PROJECT_KEY}:

| Key       | Type  | Summary                              | Points | Subtasks |
|-----------|-------|--------------------------------------|--------|----------|
| PROJ-124  | Story | Add SSO authentication for users     | 5      | 5        |

[Enrich mode:]
Enriched {N} ticket(s):

| Key       | Improvements                                      |
|-----------|----------------------------------------------------|
| PROJ-123  | +AC (5 criteria), +subtasks (3), +story points (5) |

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Define more requirements:**

`/gsd:define-requirements --project {PROJECT_KEY}`

**Plan the sprint with these tickets:**

`/gsd:plan-sprint --project {PROJECT_KEY}`

**Developer handoff** (when ready to code):

`/gsd:from-jira {CREATED_KEY}`

───────────────────────────────────────────────────────────────
```
</step>

</process>

<success_criteria>
- [ ] MCP Jira connectivity verified (with write access)
- [ ] Mode correctly determined (create vs enrich)
- [ ] Custom fields discovered for story points, epic link
- [ ] Create mode: conversational questions gathered feature context
- [ ] Enrich mode: existing ticket analyzed for quality gaps
- [ ] Ticket draft presented with structured AC in standard format
- [ ] PM approved draft (or iterated until satisfied, max 5)
- [ ] Jira ticket(s) created or updated successfully
- [ ] Subtasks created if applicable
- [ ] Epic linked if --epic provided
- [ ] Rationale comment posted on ticket
- [ ] Duplicate check performed
- [ ] Summary displayed with next step suggestions
- [ ] All acceptance criteria use `## Acceptance Criteria` + `- [ ]` format
</success_criteria>
