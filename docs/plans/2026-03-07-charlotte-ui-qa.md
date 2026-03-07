# Charlotte UI/UX QA Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace manual `checkpoint:human-verify` for web app UI/UX with an automated Charlotte browser agent loop that tests, reports issues, spawns fix subagents, and only escalates to human after 3 failed rounds.

**Architecture:** A new `checkpoint:ui-qa` task type triggers a coordinator loop in `gsd-phase-coordinator`. The coordinator spawns `gsd-charlotte-qa` (Haiku) which uses Charlotte MCP browser tools to navigate, screenshot, observe, and report issues in a structured format. On issues found, a fix subagent (Haiku for Low/Medium, Sonnet for High/Critical) is spawned to patch the code, then the QA agent reruns — up to 3 rounds before escalating to human.

**Tech Stack:** Charlotte MCP tools (`charlotte_navigate`, `charlotte_observe`, `charlotte_screenshot`, `charlotte_screenshot_get`, `charlotte_find`, `charlotte_click`, `charlotte_type`, `charlotte_console`, `charlotte_requests`), GSD agent system (Task spawning), project CLAUDE.md `## QA / Dev Server` config section.

---

## Pre-Implementation Notes

These notes are for the implementer agent to understand context that shaped the design:

- The existing `checkpoint:human-verify` stays for non-web verification (macOS apps, audio, Xcode builds, etc.). Only web UI/UX QA is automated.
- Charlotte MCP tools are already available in the environment. The `gsd-charlotte-qa` agent uses them directly — no install required.
- The QA agent reads service config from the project's CLAUDE.md `## QA / Dev Server` section. If that section is absent, it falls back to sensible defaults (localhost:3000).
- The fix subagent is NOT a new named agent — it is spawned inline by the coordinator using `general-purpose` subagent type with the fix prompt constructed from the issue report.
- `needs_restart: true` in fix subagent output signals the coordinator to wait for the health-check to confirm the server restarted before re-running QA.
- The planner changes are additive — existing plans with `checkpoint:human-verify` still work unchanged.

---

## Task 1 — Create `get-shit-done/references/service-health.md`

**File:** `/Users/ollorin/get-shit-done/get-shit-done/references/service-health.md`

**Purpose:** Reusable reference documenting the health-check-first service startup protocol. Used by `gsd-charlotte-qa` and referenced in coordinator logic.

**Write this exact content:**

```markdown
# Service Health & Startup Reference

Used by: gsd-charlotte-qa, gsd-phase-coordinator (ui-qa loop)

## Core Protocol

Before launching any service, health-check first. Only launch if down. Wait for ready signal. Verify. If still failing after launch, investigate before escalating.

**Never blindly re-launch a service that might already be running.** A running service that receives a second launch command may crash, fork a duplicate process on a different port, or lose in-flight state.

## Health-Check-First Pattern

```bash
# Step 1: health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" {health_check_url})

if [ "$HTTP_CODE" = "200" ]; then
  echo "Service already running — skipping launch"
else
  # Step 2: launch
  {launch_command} &
  LAUNCH_PID=$!

  # Step 3: wait for ready signal (max 60s)
  timeout 60 bash -c 'until curl -s -o /dev/null -w "%{http_code}" {health_check_url} | grep -q "200"; do sleep 2; done'

  # Step 4: verify
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" {health_check_url})
  if [ "$HTTP_CODE" != "200" ]; then
    echo "ERROR: Service failed to start. Check logs."
    exit 1
  fi
fi
```

## CLAUDE.md Config Format

Projects declare their dev server config in `## QA / Dev Server` section of CLAUDE.md:

```markdown
## QA / Dev Server

### Web App
- **URL**: http://localhost:3001
- **Health check**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001`
- **Launch**: `pnpm --filter operator-web dev` (from /project/root)
- **Ready signal**: "Ready in" in stdout
- **Credentials**: admin@test.local / admin123456

### Supabase (if applicable)
- **Health check**: `supabase status`
- **Launch**: `supabase start` (from /project/root)
```

## Parsing the CLAUDE.md Config

```bash
# Read CLAUDE.md and extract QA Dev Server section
QA_CONFIG=$(awk '/^## QA \/ Dev Server/,/^## /' CLAUDE.md | grep -v "^## ")

# Extract fields
QA_URL=$(echo "$QA_CONFIG" | grep "^\- \*\*URL\*\*" | sed 's/.*: //')
QA_HEALTH=$(echo "$QA_CONFIG" | grep "^\- \*\*Health check\*\*" | sed 's/.*`: //' | tr -d '`')
QA_LAUNCH=$(echo "$QA_CONFIG" | grep "^\- \*\*Launch\*\*" | sed 's/.*`: //' | sed 's/ (.*//' | tr -d '`')
QA_CREDS=$(echo "$QA_CONFIG" | grep "^\- \*\*Credentials\*\*" | sed 's/.*: //')
```

## Defaults (when CLAUDE.md section absent)

| Field | Default |
|-------|---------|
| URL | http://localhost:3000 |
| Health check | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` |
| Launch | `npm run dev` |
| Ready signal | "Ready in" or "ready" |
| Credentials | none |

## Framework-Specific Ready Signals

| Framework | Start Command | Ready Signal |
|-----------|---------------|--------------|
| Next.js | `npm run dev` | "Ready in" |
| Vite | `npm run dev` | "ready in" |
| Express | `npm start` | "listening on port" |
| Django | `python manage.py runserver` | "Starting development server" |

## Restart Detection

A fix subagent signals restart needed by including `needs_restart: true` in its output summary. When the coordinator receives this signal:

1. Wait 3 seconds for the process to exit
2. Run health check — if still returning 200, the server hot-reloaded (no restart needed)
3. If health check fails, run the launch command and wait for ready signal
4. Re-verify health check returns 200 before proceeding to next QA round

## Common Failure Modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| curl returns 000 | Server not started | Run launch command |
| curl returns 200 then 502 | Server crashed after start | Check process logs, fix crash |
| Port in use | Previous process not killed | `lsof -ti:{port} | xargs kill` then relaunch |
| curl hangs | Server started but not responding | Kill and relaunch with different port |
```

**Verification:** File exists at the path above with complete content.

**Commit:** `docs(references): add service-health startup protocol reference`

---

## Task 2 — Add `checkpoint:ui-qa` to `get-shit-done/references/checkpoints.md`

**File:** `/Users/ollorin/get-shit-done/get-shit-done/references/checkpoints.md`

**Action:** Insert the `checkpoint:ui-qa` type as a new `<type>` block inside `<checkpoint_types>`. Add it BEFORE the closing `</checkpoint_types>` tag, after the existing `</type>` for `checkpoint:human-action`.

Also update the `<summary>` section to include `checkpoint:ui-qa` in the priority list.

**Insert this block** (before `</checkpoint_types>`):

```xml
<type name="ui-qa">
## checkpoint:ui-qa (Web UI/UX — Automated)

**When:** Claude built or modified web UI components, pages, or forms and the project has a running dev server.

**Do NOT use for:**
- macOS apps, iOS apps, Xcode builds (use checkpoint:human-verify)
- Audio/video quality (use checkpoint:human-verify)
- Non-web interactive flows (use checkpoint:human-verify)
- Anything that requires physical hardware or OS-level interaction

**Use instead of `checkpoint:human-verify` when:**
- A web page, form, or UI component was just built or modified
- The project has a `## QA / Dev Server` section in CLAUDE.md (or defaults are sufficient)
- Visual layout, interactive flows, and API wiring can be verified via browser automation

**Structure:**
```xml
<task type="checkpoint:ui-qa" gate="blocking">
  <what-built>Description of what was built</what-built>
  <test-flows>
    Specific user flows to test, URLs, what to verify.
    Be concrete: list each page/flow/interaction to exercise.
    Example:
    - Visit /dashboard — verify sidebar, header, content area render
    - Click "New Project" — verify modal opens with correct form fields
    - Submit form with empty name — verify inline validation error appears
    - Submit valid form — verify success toast and redirect to /projects/{id}
  </test-flows>
</task>
```

**How the coordinator handles it:**
The phase coordinator runs an automated 3-round QA loop:
- Round 1: spawn gsd-charlotte-qa → if issues found → spawn fix subagent → commit → restart if needed
- Round 2: re-run gsd-charlotte-qa → if issues → spawn fix subagent
- Round 3: re-run gsd-charlotte-qa → if still issues → escalate to human with report
- If clean at any round → continue to next task

**Example:**
```xml
<task type="auto">
  <name>Build player detail page</name>
  <files>src/app/players/[id]/page.tsx, src/components/PlayerCard.tsx</files>
  <action>Create player detail page with profile section, KYC status badge, session history table</action>
  <verify>npm run build succeeds, no TypeScript errors</verify>
  <done>Player detail page builds without errors</done>
</task>

<task type="checkpoint:ui-qa" gate="blocking">
  <what-built>Player detail page at /players/[id] — dev server already running</what-built>
  <test-flows>
    - Navigate to /players — click first player row — verify detail page loads with player name and email
    - Verify KYC status badge shows correct color (green=verified, yellow=pending, red=rejected)
    - Verify session history table loads with data, pagination works
    - Verify breadcrumb shows: Home > Players > {player name}
    - Click "Back to Players" — verify navigates to /players list
  </test-flows>
</task>
```
</type>
```

**Also update the `<summary>` section** — find the "Checkpoint priority:" list and add ui-qa:

Find this text in the summary:
```
**Checkpoint priority:**
1. **checkpoint:human-verify** (90%) - Claude automated everything, human confirms visual/functional correctness
2. **checkpoint:decision** (9%) - Human makes architectural/technology choices
3. **checkpoint:human-action** (1%) - Truly unavoidable manual steps with no API/CLI
```

Replace with:
```
**Checkpoint priority:**
1. **checkpoint:ui-qa** (automated web QA) - Charlotte browser agent tests web UI; human only if 3 rounds fail
2. **checkpoint:human-verify** (non-web verification) - macOS apps, audio, Xcode builds, anything Charlotte can't test
3. **checkpoint:decision** (9%) - Human makes architectural/technology choices
4. **checkpoint:human-action** (1%) - Truly unavoidable manual steps with no API/CLI
```

**Verification:** File contains `type name="ui-qa"` and updated summary.

**Commit:** `docs(checkpoints): add checkpoint:ui-qa type for automated web UI QA`

---

## Task 3 — Create `agents/gsd-charlotte-qa.md`

**File:** `/Users/ollorin/get-shit-done/agents/gsd-charlotte-qa.md`

**Write this exact content:**

```markdown
---
name: gsd-charlotte-qa
description: Automated web UI/UX QA agent using Charlotte browser tools. Health-checks and starts dev server if needed, navigates specified flows, screenshots every state, reports issues in structured format. Spawned by gsd-phase-coordinator for checkpoint:ui-qa tasks.
tools: Read, Bash, mcp__charlotte__charlotte_navigate, mcp__charlotte__charlotte_observe, mcp__charlotte__charlotte_screenshot, mcp__charlotte__charlotte_screenshot_get, mcp__charlotte__charlotte_find, mcp__charlotte__charlotte_click, mcp__charlotte__charlotte_type, mcp__charlotte__charlotte_console, mcp__charlotte__charlotte_requests, mcp__charlotte__charlotte_scroll
color: purple
---

<role>
You are a web UI/UX QA agent. You use Charlotte browser tools to test web interfaces and report issues. You do NOT fix issues — you find and document them precisely.

Spawned by: gsd-phase-coordinator (checkpoint:ui-qa loop)

Your inputs (provided in prompt):
- `what_built`: description of what was just built
- `test_flows`: specific flows to test (from the checkpoint:ui-qa task)
- `round`: which QA round this is (1, 2, or 3)
- `previous_issues`: (optional) issue report from the previous round, for re-verification

Your job: Health-check the dev server, test every specified flow using Charlotte tools, screenshot every state, and return a structured issue report.
</role>

<service_startup>

## Step 1: Read Project Config

Read the project's CLAUDE.md to find dev server config:

```bash
# Find CLAUDE.md — check project root first, then parent dirs
CLAUDE_MD=$(find . -maxdepth 2 -name "CLAUDE.md" | head -1)
if [ -n "$CLAUDE_MD" ]; then
  cat "$CLAUDE_MD"
fi
```

Extract from the `## QA / Dev Server` section:
- `QA_URL` — web app URL (default: http://localhost:3000)
- `QA_HEALTH_CMD` — health check command (default: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`)
- `QA_LAUNCH_CMD` — launch command (default: `npm run dev`)
- `QA_CREDENTIALS` — login credentials if applicable (default: none)
- `QA_READY_SIGNAL` — stdout string to wait for (default: "ready")

If `## QA / Dev Server` section is absent, use the defaults above.

## Step 2: Health-Check First

```bash
HTTP_CODE=$(eval "$QA_HEALTH_CMD")
echo "Health check: $HTTP_CODE"
```

- If `200`: service is running — proceed to testing immediately, do NOT relaunch.
- If not `200`: launch service (Step 3).

## Step 3: Launch If Down (only if health check failed)

```bash
# Launch in background
eval "$QA_LAUNCH_CMD" &
LAUNCH_PID=$!

# Wait for ready signal (max 60s)
timeout 60 bash -c "until eval '$QA_HEALTH_CMD' | grep -q '200'; do sleep 2; done"

# Final verify
HTTP_CODE=$(eval "$QA_HEALTH_CMD")
if [ "$HTTP_CODE" != "200" ]; then
  echo "FATAL: Service failed to start after launch. Cannot proceed with QA."
  # Return failure result — coordinator will escalate
  exit 1
fi
```

Log: "Service health: {status} | URL: {QA_URL}"

</service_startup>

<testing_protocol>

## Step 4: Execute Test Flows

For each flow listed in `test_flows`, follow this discipline precisely.

### Navigation and observation pattern

For EVERY screen you visit:

1. `charlotte_navigate` to the URL
2. `charlotte_observe({ detail: "summary" })` — read full DOM: interactive elements, landmarks, headings
3. `charlotte_screenshot({ save: true, filename: "descriptive-name.png" })` — capture state
4. Immediately call `charlotte_screenshot_get` with returned ID — visually analyze layout, spacing, color, typography, UX quality
5. `charlotte_find` to locate elements before interacting
6. Interact (click, type, filter, submit) — screenshot each new state
7. `charlotte_console` — check for JS errors after each interaction
8. `charlotte_requests` — check for API errors (4xx, 5xx) after each interaction

### Screenshot discipline

- Screenshot every distinct state: initial load, after interaction, modal open, empty state, error state, loading state, filter applied
- After saving, ALWAYS call `charlotte_screenshot_get` and visually analyze before moving on
- Name screenshots descriptively: `players-list.png`, `player-detail-modal.png`, `form-validation-error.png`

### What to check on every screen

**Functionality (does it work?):**
- Every button triggers an action
- API calls succeed (no 4xx/5xx in `charlotte_requests`)
- Modals open and close correctly
- Pagination loads more data
- Filters actually filter results
- Search inputs return results
- Navigation links go to the correct destination
- Forms submit and produce a visible result (success message, redirect, or error)

**Cross-module wiring:**
- IDs shown as plain text should be clickable links (player ID → player detail, etc.)
- Cross-section links work ("View in Players", "View in KYC", etc.)
- Breadcrumbs reflect current location hierarchy
- Sidebar highlights the active section

**UX quality — look for these anti-patterns:**

Input Design:
- Free-text input where a dropdown should be (status, type, category, country — predefined-only values MUST be select)
- Comma-separated text for multi-values (tags, country lists, allowlists — should be tag/chip inputs)
- Missing format hints on UUID, date, CIDR, JSON, percentage fields
- Unconstrained inputs that visually accept anything but only accept a subset

Feedback and Clarity:
- Missing loading state after clicking action buttons (no spinner, no disabled state)
- Missing success feedback after mutations (no toast/notification)
- Raw technical errors shown to user (stack traces, JSON blobs, SQL errors)
- Empty states that don't explain why or offer a next step
- Ambiguous button labels ("Submit", "OK" instead of "Approve Document", "Save Provider")
- Lists missing total count or filtered count

Navigation and Hierarchy:
- Missing breadcrumbs on detail pages
- No back button or back link on detail/inner pages
- Dead-end pages with no exit except the sidebar
- Unclickable IDs (shown as plain text when they should be links)
- Wrong sidebar active state for current section

Layout and Visual:
- Text truncation without tooltip (long names cut off with `...` but no hover to see full value)
- Horizontal overflow without scroll bar
- Badge color mismatch (active=green, banned=red, pending=yellow — verify semantic correctness)
- Inconsistent spacing or alignment breaking the grid
- Destructive actions not visually separated (e.g., "Ban Player" next to "View Details" without distinction)
- Modal too small (content scrolls awkwardly) or too large (wastes space)
- Disabled button with no tooltip explaining why

Form Design:
- Required fields not marked (no asterisk or indicator)
- No inline validation (errors only appear after submit)
- Illogical field order (secondary fields before primary)
- No character limit shown on text areas that have limits

</testing_protocol>

<issue_format>

## Issue Report Format

Each issue uses this structure:

```markdown
### [ISSUE-NNN] Short descriptive title
- **Screen:** /path/to/page or modal name
- **Category:** Broken | Missing | Bad UX | Bad Wiring | Visual | Input Design | Feedback | Navigation
- **Severity:** Critical | High | Medium | Low
- **Description:** Clear description of the problem
- **Steps to Reproduce:** 1. Go to... 2. Click... 3. Observe...
- **Screenshot:** ss-ID or filename (required for Visual/UX issues)
- **Expected:** What a well-designed interface should do
- **Actual / Suggested Fix:** What actually happens + specific improvement suggestion
```

### Severity Guide

- **Critical:** Blocks a core workflow entirely (page crash, navigation broken, data not loading, JS exception)
- **High:** Feature exists but doesn't work or produces errors; or causes significant confusion
- **Medium:** Works but in a poor way; UX friction that slows users down
- **Low:** Minor visual inconsistency, nice-to-have improvement

</issue_format>

<output_format>

## Return Value

Return a structured JSON result to the coordinator:

```json
{
  "round": 1,
  "service_url": "http://localhost:3001",
  "service_status": "already_running | launched | failed_to_start",
  "passed": true,
  "issue_count": 0,
  "severity_counts": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "issues": [],
  "screens_tested": ["/ ", "/dashboard", "/players"],
  "screenshots": [
    { "id": "ss-20260307120000-abc123", "filename": "dashboard-initial.png", "screen": "/dashboard" }
  ],
  "report_markdown": "# QA Report — Round 1\n\n## Coverage Log\n...\n\n## Issues Found\n\n_None — all flows passed._\n\n## Summary\n- Total screens tested: 3\n- Total issues: 0\n..."
}
```

When issues are found:

```json
{
  "round": 1,
  "service_url": "http://localhost:3001",
  "service_status": "already_running",
  "passed": false,
  "issue_count": 3,
  "severity_counts": {
    "critical": 1,
    "high": 1,
    "medium": 1,
    "low": 0
  },
  "issues": [
    {
      "id": "ISSUE-001",
      "title": "Player detail page crashes on load",
      "screen": "/players/abc123",
      "category": "Broken",
      "severity": "Critical",
      "description": "TypeError: Cannot read properties of undefined (reading 'name')",
      "screenshot_id": "ss-20260307120001-def456",
      "steps": "1. Go to /players\n2. Click any player row\n3. Observe: page shows error boundary"
    }
  ],
  "screens_tested": ["/players", "/players/abc123"],
  "screenshots": [...],
  "report_markdown": "# QA Report — Round 1\n\n## Coverage Log\n| Screen | Status | Notes |\n|--------|--------|-------|\n| /players | ✅ Tested | ... |\n| /players/abc123 | ❌ Crashed | ISSUE-001 |\n\n## Issues Found\n\n### [ISSUE-001] Player detail page crashes on load\n..."
}
```

## Report Structure (in report_markdown)

```markdown
# QA Report — Round {N}
Date: YYYY-MM-DD
What was built: {what_built}
Service URL: {QA_URL}

## Coverage Log
| Screen | Status | Notes |
|--------|--------|-------|
| /dashboard | ✅ Tested | ... |
| /players | ❌ Crashed | ISSUE-001 |

## Issues Found
{issues in format above, or "_None — all flows passed._"}

## Summary
- Total screens tested: N
- Total issues: N
  - Critical: N | High: N | Medium: N | Low: N
- Issues by category: Broken: N | Missing: N | Bad UX: N | Bad Wiring: N | Visual: N | Input Design: N | Feedback: N | Navigation: N

## Screenshots Taken
| ID | Filename | Screen |
|----|----------|--------|
...

## Not Covered (and why)
{any flows that could not be tested and why}
```

</output_format>

<re_verification_mode>

## Re-verification (Round 2 and 3)

When `round > 1` and `previous_issues` is provided:

1. Read the previous issue report
2. Focus primarily on verifying whether previously reported issues are fixed
3. Also scan for any new regressions introduced by the fixes
4. Number new issues continuing from the previous highest issue number (do NOT restart at ISSUE-001)
5. In the Coverage Log, note which issues are "FIXED ✅", "STILL PRESENT ❌", or "REGRESSION 🔴"

Return the same JSON structure, with `passed: true` only if ALL previously reported issues are resolved and no new Critical/High issues were introduced.

</re_verification_mode>

<critical_rules>

- ALWAYS health-check before launching. Never blindly launch what might already be running.
- Screenshot every distinct state. Always call `charlotte_screenshot_get` immediately after saving to visually analyze.
- Check `charlotte_console` and `charlotte_requests` after every interaction.
- Report exactly what you find — do not speculate or suggest fixes (that is the fix subagent's job).
- Number issues sequentially from ISSUE-001 (or continuing from previous round).
- Return structured JSON — the coordinator parses it to decide next steps.

</critical_rules>
```

**Verification:** File exists at `/Users/ollorin/get-shit-done/agents/gsd-charlotte-qa.md` with the content above.

**Commit:** `feat(agents): add gsd-charlotte-qa browser QA agent`

---

## Task 4 — Modify `agents/gsd-executor.md` — Route `checkpoint:ui-qa`

**File:** `/Users/ollorin/get-shit-done/agents/gsd-executor.md`

**Action:** Add `checkpoint:ui-qa` to the auto_mode_detection section and to the execute_tasks step. The executor does NOT run the QA loop itself — it stops and returns a structured checkpoint message (same as `checkpoint:human-verify`). The coordinator handles the QA loop.

### Change 1: auto_mode_detection section

Find this block:
```
**Auto mode behavior for checkpoints:**
- `checkpoint:human-verify` → Auto-approve if `AUTO_ADVANCE=true`. Log: "Auto-approved: [checkpoint name]"
- `checkpoint:decision` → Auto-select first option if `AUTO_ADVANCE=true`. Log: "Auto-selected: [option]"
- `checkpoint:human-action` → **ALWAYS STOP** — even in auto mode. These require physical user action.
```

Replace with:
```
**Auto mode behavior for checkpoints:**
- `checkpoint:human-verify` → Auto-approve if `AUTO_ADVANCE=true`. Log: "Auto-approved: [checkpoint name]"
- `checkpoint:decision` → Auto-select first option if `AUTO_ADVANCE=true`. Log: "Auto-selected: [option]"
- `checkpoint:human-action` → **ALWAYS STOP** — even in auto mode. These require physical user action.
- `checkpoint:ui-qa` → **ALWAYS STOP** — even in auto mode. The coordinator handles the automated QA loop.
```

### Change 2: checkpoint_protocol section

Find this block:
```
**checkpoint:human-verify (90%)** — Visual/functional verification after automation.
Provide: what was built, exact verification steps (URLs, commands, expected behavior).

**checkpoint:decision (9%)** — Implementation choice needed.
Provide: decision context, options table (pros/cons), selection prompt.

**checkpoint:human-action (1% - rare)** — Truly unavoidable manual step (email link, 2FA code).
Provide: what automation was attempted, single manual step needed, verification command.
```

Replace with:
```
**checkpoint:ui-qa** — Automated web UI/UX QA. STOP and return structured message. The coordinator spawns gsd-charlotte-qa to handle testing. Provide: what was built, test flows (from the checkpoint task).

**checkpoint:human-verify (90%)** — Visual/functional verification after automation (non-web: macOS, audio, Xcode).
Provide: what was built, exact verification steps (URLs, commands, expected behavior).

**checkpoint:decision (9%)** — Implementation choice needed.
Provide: decision context, options table (pros/cons), selection prompt.

**checkpoint:human-action (1% - rare)** — Truly unavoidable manual step (email link, 2FA code).
Provide: what automation was attempted, single manual step needed, verification command.
```

### Change 3: execute_tasks step — checkpoint routing

Find this text in the execute_tasks step:
```
2. **If `type="checkpoint:*"`:**
   - Check auto mode detection (see auto_mode_detection)
   - If auto mode active and type is `human-verify` or `decision`: auto-approve/select first option
   - If auto mode active and type is `human-action`: STOP — return structured checkpoint message
   - If auto mode not active: STOP immediately — return structured checkpoint message
   - A fresh agent will be spawned to continue
```

Replace with:
```
2. **If `type="checkpoint:*"`:**
   - Check auto mode detection (see auto_mode_detection)
   - If auto mode active and type is `human-verify` or `decision`: auto-approve/select first option
   - If auto mode active and type is `human-action`: STOP — return structured checkpoint message
   - If type is `checkpoint:ui-qa`: STOP — always return structured checkpoint message (coordinator runs QA loop)
   - If auto mode not active: STOP immediately — return structured checkpoint message
   - A fresh agent will be spawned to continue
```

### Change 4: checkpoint_return_format — add ui-qa to the Type field comment

Find:
```
**Type:** [human-verify | decision | human-action]
```

Replace with:
```
**Type:** [ui-qa | human-verify | decision | human-action]
```

**Verification:** File contains "checkpoint:ui-qa" in all four modified locations.

**Commit:** `feat(executor): route checkpoint:ui-qa to coordinator QA loop`

---

## Task 5 — Modify `agents/gsd-phase-coordinator.md` — Add UI QA Loop

**File:** `/Users/ollorin/get-shit-done/agents/gsd-phase-coordinator.md`

**Action:** Add a `<checkpoint_ui_qa_loop>` section to the coordinator. This section is invoked by the execute step when a `checkpoint:ui-qa` is encountered in a plan being executed.

### Where to insert

Find the `</step>` closing tag for the `execute` step (the step named "execute" that spawns executor agents). After that closing `</step>` tag and before the `<step name="verify">` opening tag, insert the new section:

### Content to insert

```xml
<checkpoint_ui_qa_loop>

## UI QA Checkpoint Loop

When the executor agent returns a checkpoint message with `Type: ui-qa`, the coordinator runs an automated QA loop before continuing plan execution.

**Trigger:** Executor returns `## CHECKPOINT REACHED` with `Type: ui-qa`.

**Extract from checkpoint message:**
- `what_built`: from the `<what-built>` tag in the checkpoint task
- `test_flows`: from the `<test-flows>` tag in the checkpoint task

**Loop (max 3 rounds):**

```
MAX_ROUNDS = 3
round = 1
qa_passed = false
previous_issues = null
previous_report = null

while round <= MAX_ROUNDS AND qa_passed == false:

  // --- STEP A: Run QA Agent ---
  qa_result = Task(
    subagent_type="gsd-charlotte-qa",
    model="haiku",
    prompt="
      <what_built>{what_built}</what_built>
      <test_flows>{test_flows}</test_flows>
      <round>{round}</round>
      {IF round > 1: <previous_issues>{previous_report}</previous_issues>}
    "
  )

  Parse qa_result JSON:
    qa_passed = qa_result.passed
    issue_count = qa_result.issue_count
    severity_counts = qa_result.severity_counts
    issues = qa_result.issues
    report_markdown = qa_result.report_markdown
    screenshots = qa_result.screenshots

  Log: "QA Round {round}: {issue_count} issues (Critical: {critical}, High: {high}, Medium: {medium}, Low: {low})"

  // --- STEP B: If clean, exit loop ---
  if qa_passed:
    Log: "QA passed on round {round} — continuing plan execution"
    break

  // --- STEP C: If round == MAX_ROUNDS and still failing, escalate to human ---
  if round == MAX_ROUNDS AND NOT qa_passed:
    // Build human escalation message
    Send Telegram notification (if telegram_topic_id is not null):
      mcp__telegram__send_message({
        text: "UI QA: {issue_count} issues remain after {MAX_ROUNDS} rounds. Human review needed.\n\nCritical: {critical} | High: {high} | Medium: {medium} | Low: {low}\n\nResume to continue or 'stop' to halt.",
        thread_id: telegram_topic_id (if set)
      })

    // Return human checkpoint
    Return checkpoint message to parent:
    ```
    ╔═══════════════════════════════════════════════════════╗
    ║  UI QA: Human Review Required                         ║
    ╚═══════════════════════════════════════════════════════╝

    Charlotte ran {MAX_ROUNDS} QA rounds. {issue_count} issues remain unfixed.

    Severity: Critical: {critical} | High: {high} | Medium: {medium} | Low: {low}

    Issues summary:
    {list top 5 issues by severity}

    Full QA report:
    {report_markdown}

    ────────────────────────────────────────────────────────
    → Type "continue" to proceed despite issues, or describe what to fix
    ────────────────────────────────────────────────────────
    ```
    Wait for user response. If "continue": proceed to next task. Else: implement requested fix and re-run QA.
    break

  // --- STEP D: Spawn fix subagent ---
  // Determine fix subagent tier based on worst severity
  if severity_counts.critical > 0 OR severity_counts.high > 0:
    FIX_TIER = "sonnet"
  else:
    FIX_TIER = "haiku"

  // Build fix prompt from issues report
  fix_result = Task(
    subagent_type="general-purpose",
    model="{FIX_TIER}",
    prompt="
      You are a senior engineer fixing UI/UX issues found during automated QA testing.

      ## Your task
      Fix the issues listed below. Do not refactor surrounding code. Only fix what is listed.
      Commit each logical fix atomically: `fix([scope]): [what was fixed]`

      ## Codebase context
      Read the project's CLAUDE.md to understand:
      - Project structure and file layout
      - Framework and stack (Next.js, Vite, etc.)
      - Component library (shadcn/ui, MUI, etc.)
      - Code style and patterns

      ## Issues to fix
      {report_markdown}

      ## Investigation approach
      1. Read the full issue report
      2. Group issues by root cause (multiple issues may share one fix)
      3. Prioritize: Critical → High → Medium → Low
      4. Use LSP workspaceSymbol/goToDefinition to locate components before editing
      5. Read files before editing — never edit blind

      ## Common fix patterns
      - Free-text → dropdown: replace `<Input>` with `<Select>` for predefined-value fields
      - Missing loading state: add `isPending` to disable button + show spinner
      - Missing success toast: add `toast.success()` in mutation onSuccess
      - Page crash on undefined: add optional chaining (`?.`) and null guards
      - Breadcrumbs missing: add `<Breadcrumb>` component at top of page
      - Unclickable ID: wrap in `<Link href={...}>` with underline styling
      - Table overflow: wrap in `<div className='overflow-x-auto'>`
      - Navigation broken: check if inside `<form>` element; add `type='button'` to links

      ## After each fix
      - Run type-check: `npx tsc --noEmit` (or project equivalent)
      - Run lint: `npm run lint` (or project equivalent)
      - Commit with format: `fix([scope]): [what was fixed]`

      ## Output when done
      Return a JSON summary:
      {
        'issues_fixed': ['ISSUE-001', 'ISSUE-002'],
        'issues_deferred': [{'id': 'ISSUE-003', 'reason': 'requires design decision'}],
        'commits': ['abc1234: fix(dashboard): add breadcrumb navigation'],
        'needs_restart': true | false
      }

      Set `needs_restart: true` if any fix modified server-side files (API routes, server components, config files) that require a dev server restart to take effect. Set `false` for client-side only changes.
    "
  )

  Parse fix_result JSON:
    issues_fixed = fix_result.issues_fixed
    needs_restart = fix_result.needs_restart

  Log: "Fix round {round}: {issues_fixed.length} issues fixed, needs_restart: {needs_restart}"

  // --- STEP E: Restart if needed ---
  if needs_restart:
    Log: "Restart signal received — checking service health"

    // Wait briefly for process to die
    Bash: sleep 3

    // Re-read health check command from CLAUDE.md (or use default)
    QA_HEALTH_CMD = parse from CLAUDE.md `## QA / Dev Server` or default: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
    QA_LAUNCH_CMD = parse from CLAUDE.md or default: `npm run dev`

    HTTP_CODE = Bash: eval "{QA_HEALTH_CMD}"

    if HTTP_CODE != "200":
      // Server stopped — relaunch
      Log: "Server stopped — relaunching"
      Bash: eval "{QA_LAUNCH_CMD}" &
      Bash: timeout 60 bash -c "until eval '{QA_HEALTH_CMD}' | grep -q '200'; do sleep 2; done"
      HTTP_CODE = Bash: eval "{QA_HEALTH_CMD}"
      if HTTP_CODE != "200":
        Log: "ERROR: Service failed to restart — escalating to human"
        // Fall through to human escalation
        round = MAX_ROUNDS  // Force human escalation on next iteration
    else:
      Log: "Server still healthy — hot-reload took effect"

  // --- STEP F: Prepare for next round ---
  previous_report = report_markdown
  round = round + 1

// End of loop
```

**After loop completes successfully (qa_passed == true):** Continue plan execution from the next task after the checkpoint:ui-qa task.

**Note on commit handling:** The fix subagent commits its own changes atomically per fix. The coordinator does not make additional commits for the QA loop — only the executor's per-task commits and the final summary commit exist.

</checkpoint_ui_qa_loop>
```

**Verification:** File contains `<checkpoint_ui_qa_loop>` block and the loop logic with MAX_ROUNDS = 3.

**Commit:** `feat(coordinator): add checkpoint:ui-qa 3-round automated QA loop with fix subagent`

---

## Task 6 — Modify `agents/gsd-planner.md` — Use `checkpoint:ui-qa` and Auto-Add After UI Tasks

**File:** `/Users/ollorin/get-shit-done/agents/gsd-planner.md`

**Action:** Three changes to the planner.

### Change 1: Update Task Types table

Find this table in the `<task_breakdown>` section:

```
| Type | Use For | Autonomy |
|------|---------|----------|
| `auto` | Everything Claude can do independently | Fully autonomous |
| `checkpoint:human-verify` | Visual/functional verification | Pauses for user |
| `checkpoint:decision` | Implementation choices | Pauses for user |
| `checkpoint:human-action` | Truly unavoidable manual steps (rare) | Pauses for user |
```

Replace with:
```
| Type | Use For | Autonomy |
|------|---------|----------|
| `auto` | Everything Claude can do independently | Fully autonomous |
| `checkpoint:ui-qa` | Web UI verification (automated via Charlotte browser agent) | Automated — coordinator runs 3-round QA loop |
| `checkpoint:human-verify` | Non-web verification: macOS apps, audio, Xcode builds | Pauses for user |
| `checkpoint:decision` | Implementation choices | Pauses for user |
| `checkpoint:human-action` | Truly unavoidable manual steps (rare) | Pauses for user |
```

### Change 2: Add `checkpoint:ui-qa` usage rules

After the Task Types table (before `## Task Sizing`), insert this block:

```markdown
## checkpoint:ui-qa — When and How to Use

**Auto-add rule:** After any task that creates or substantially modifies a web UI page, form, or interactive component, add a `checkpoint:ui-qa` task. This is the default for web projects — do not add `checkpoint:human-verify` for web UI.

**Triggers (always add checkpoint:ui-qa after):**
- Creating a new page or route (`/dashboard`, `/players/[id]`, etc.)
- Building a form (login, create, edit, filter forms)
- Adding modals or dialogs
- Implementing navigation (sidebar, breadcrumbs, links between pages)
- Creating data tables with interactions (sort, filter, pagination)
- Adding any interactive component (buttons with actions, tabs, accordions)

**Do NOT add checkpoint:ui-qa for:**
- Pure backend work (API routes only, database migrations, no UI impact)
- Type definitions, utilities, or config files
- CSS-only changes with no structural HTML/JSX changes (use judgment — if visual regression likely, add it)
- Non-web projects (use checkpoint:human-verify)

**Reading CLAUDE.md for QA config:**
When planning a web UI phase, read the project's `## QA / Dev Server` section of CLAUDE.md to understand:
- The app URL (for populating test-flows with real URLs)
- Available credentials (for flows requiring login)
- Whether additional services (Supabase, etc.) need to be running

If the `## QA / Dev Server` section is absent, note this in the plan but still emit checkpoint:ui-qa — the QA agent will use defaults.

**Writing effective test-flows:**
The `<test-flows>` content is the QA agent's script. Be specific:
- List each page/route to visit by exact URL
- Describe each interaction: what to click, what to type, what to verify
- Include both happy path and basic error cases (submit empty form, try invalid input)
- Include cross-module navigation if applicable (click an ID to go to detail page)
- Include authentication flow if the page requires login

**Example checkpoint:ui-qa task structure:**
```xml
<task type="checkpoint:ui-qa" gate="blocking">
  <what-built>User registration form at /auth/register with email/password/name fields</what-built>
  <test-flows>
    - Navigate to /auth/register — verify form renders with Email, Password, Name fields
    - Submit empty form — verify inline validation errors appear on required fields
    - Enter email without @ — verify email format error appears
    - Fill valid data (test@example.com / Password123! / Test User) — verify success redirect to /dashboard
    - After register: verify user name appears in header/nav
    - Navigate to /auth/login — verify login form renders
    - Login with the registered credentials — verify successful login and redirect
  </test-flows>
</task>
```

**Grouping rule:** One `checkpoint:ui-qa` per logical feature group, not per individual task. If tasks 1-3 all build parts of the same page, place a single `checkpoint:ui-qa` after task 3. Do not add a checkpoint after each individual task.
```

### Change 3: Update the Automation-first rule note

Find:
```
**Automation-first rule:** If Claude CAN do it via CLI/API, Claude MUST do it. Checkpoints verify AFTER automation, not replace it.
```

Replace with:
```
**Automation-first rule:** If Claude CAN do it via CLI/API, Claude MUST do it. Checkpoints verify AFTER automation, not replace it. For web UI: use `checkpoint:ui-qa` (automated Charlotte testing). For non-web (macOS, audio, Xcode): use `checkpoint:human-verify`.
```

**Verification:** File contains `checkpoint:ui-qa` table entry, the new `## checkpoint:ui-qa — When and How to Use` section, and updated automation-first rule.

**Commit:** `feat(planner): use checkpoint:ui-qa for web UI tasks, auto-add after UI components`

---

## Task 7 — Commit All Changes and Run Install

**Action:** Stage and commit all modified files, then run the GSD install script to deploy the updated agents to `~/.claude/`.

### Step 1: Verify all files are modified

```bash
cd /Users/ollorin/get-shit-done
git status
```

Expected modified/new files:
- `get-shit-done/references/service-health.md` (new)
- `get-shit-done/references/checkpoints.md` (modified)
- `agents/gsd-charlotte-qa.md` (new)
- `agents/gsd-executor.md` (modified)
- `agents/gsd-phase-coordinator.md` (modified)
- `agents/gsd-planner.md` (modified)
- `docs/plans/2026-03-07-charlotte-ui-qa.md` (this file — already committed separately)

### Step 2: Confirm individual task commits were made

Each task above has its own commit message. Verify with:
```bash
git log --oneline -10
```

Expected recent commits (most recent first):
```
feat(planner): use checkpoint:ui-qa for web UI tasks, auto-add after UI components
feat(coordinator): add checkpoint:ui-qa 3-round automated QA loop with fix subagent
feat(executor): route checkpoint:ui-qa to coordinator QA loop
feat(agents): add gsd-charlotte-qa browser QA agent
docs(checkpoints): add checkpoint:ui-qa type for automated web UI QA
docs(references): add service-health startup protocol reference
```

If any task commits are missing, stage and commit those files now.

### Step 3: Run install to deploy agents

```bash
cd /Users/ollorin/get-shit-done
node bin/install.js
```

Expected output: install script copies agents and references to `~/.claude/`. Verify:
```bash
ls ~/.claude/agents/gsd-charlotte-qa.md
ls ~/.claude/get-shit-done/references/service-health.md
```

Both files should exist after install.

### Step 4: Push to remote

```bash
cd /Users/ollorin/get-shit-done
git push
```

**Verification:** `git log --oneline -8` shows all 6 feature commits plus the plan doc commit. `~/.claude/agents/gsd-charlotte-qa.md` exists. `git push` succeeds.

**Commit:** No additional commit needed — this task only verifies and deploys.

---

## Summary

### Files Created (2)
- `/Users/ollorin/get-shit-done/get-shit-done/references/service-health.md` — service startup protocol reference
- `/Users/ollorin/get-shit-done/agents/gsd-charlotte-qa.md` — Charlotte browser QA agent

### Files Modified (4)
- `/Users/ollorin/get-shit-done/get-shit-done/references/checkpoints.md` — adds checkpoint:ui-qa type
- `/Users/ollorin/get-shit-done/agents/gsd-executor.md` — routes checkpoint:ui-qa to coordinator
- `/Users/ollorin/get-shit-done/agents/gsd-phase-coordinator.md` — adds 3-round QA loop with fix subagent
- `/Users/ollorin/get-shit-done/agents/gsd-planner.md` — uses checkpoint:ui-qa for web UI tasks

### Commit Messages (one per task)
1. `docs(references): add service-health startup protocol reference`
2. `docs(checkpoints): add checkpoint:ui-qa type for automated web UI QA`
3. `feat(agents): add gsd-charlotte-qa browser QA agent`
4. `feat(executor): route checkpoint:ui-qa to coordinator QA loop`
5. `feat(coordinator): add checkpoint:ui-qa 3-round automated QA loop with fix subagent`
6. `feat(planner): use checkpoint:ui-qa for web UI tasks, auto-add after UI components`

### How It Hangs Together

```
Planner writes checkpoint:ui-qa
  → Executor hits it → stops, returns CHECKPOINT REACHED message
    → Coordinator reads message → enters checkpoint_ui_qa_loop
      → Round 1: spawns gsd-charlotte-qa (Haiku)
        → QA agent: health check → navigate → screenshot → observe → report issues
        → If passed: coordinator continues plan
        → If issues: coordinator spawns fix subagent (Haiku=Low/Medium, Sonnet=High/Critical)
          → Fix subagent: investigates, patches, commits, returns needs_restart
          → If needs_restart: coordinator health-checks, relaunches if needed
      → Round 2: re-runs gsd-charlotte-qa → same loop
      → Round 3: re-runs gsd-charlotte-qa → if still failing → human escalation
```
