---
name: gsd:plan-phase
description: Create detailed execution plan for a phase (PLAN.md) with verification loop
argument-hint: "[phase] [--research] [--skip-research] [--gaps] [--skip-verify]"
agent: gsd-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - Teammate
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskList
  - WebFetch
  - mcp__context7__*
---
<objective>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped), spawn gsd-planner, verify with gsd-plan-checker, iterate until pass or max iterations, present results.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase number: $ARGUMENTS (optional — auto-detects next unplanned phase if omitted)

**Flags:**
- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research, go straight to planning
- `--gaps` — Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` — Skip verification loop

Normalize phase input in step 2 before any directory lookups.
</context>

<process>
Execute the plan-phase workflow from @~/.claude/get-shit-done/workflows/plan-phase.md end-to-end.
Preserve all workflow gates (validation, research, planning, verification loop, routing).
</process>
=======

## 1. Validate Environment and Resolve Model Profile

```bash
ls .planning/ 2>/dev/null
```

**If not found:** Error - user should run `/gsd:new-project` first.

**Resolve model profile for agent spawning:**

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Default to "balanced" if not set.

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-planner | opus | opus | sonnet |
| gsd-plan-checker | sonnet | sonnet | haiku |

Store resolved models for use in Task calls below.

## 2. Parse and Normalize Arguments

Extract from $ARGUMENTS:

- Phase number (integer or decimal like `2.1`)
- `--research` flag to force re-research
- `--skip-research` flag to skip research
- `--gaps` flag for gap closure mode
- `--skip-verify` flag to bypass verification loop

**If no phase number:** Detect next unplanned phase from roadmap.

**Normalize phase to zero-padded format:**

```bash
# Normalize phase number (8 → 08, but preserve decimals like 2.1 → 02.1)
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  PHASE=$(printf "%02d" "$PHASE")
elif [[ "$PHASE" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
fi
```

**Check for existing research and plans:**

```bash
ls .planning/phases/${PHASE}-*/*-RESEARCH.md 2>/dev/null
ls .planning/phases/${PHASE}-*/*-PLAN.md 2>/dev/null
```

## 2.5. Detect Agent Teams

Check Agent Teams availability (both must be true):
- Environment: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Config: `agent_teams: true` in config.json

```bash
AGENT_TEAMS_ENV=${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-0}
AGENT_TEAMS_CONFIG=$(cat .planning/config.json 2>/dev/null | grep -o '"agent_teams"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "false")
USE_AGENT_TEAMS=false
[ "$AGENT_TEAMS_ENV" = "1" ] && [ "$AGENT_TEAMS_CONFIG" = "true" ] && USE_AGENT_TEAMS=true
```

## 3. Validate Phase

```bash
grep -A5 "Phase ${PHASE}:" .planning/ROADMAP.md 2>/dev/null
```

**If not found:** Error with available phases. **If found:** Extract phase number, name, description.

## 4. Ensure Phase Directory Exists and Load CONTEXT.md

```bash
# PHASE is already normalized (08, 02.1, etc.) from step 2
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  # Create phase directory from roadmap name
  PHASE_NAME=$(grep "Phase ${PHASE}:" .planning/ROADMAP.md | sed 's/.*Phase [0-9]*: //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  mkdir -p ".planning/phases/${PHASE}-${PHASE_NAME}"
  PHASE_DIR=".planning/phases/${PHASE}-${PHASE_NAME}"
fi

# Load CONTEXT.md immediately - this informs ALL downstream agents
CONTEXT_CONTENT=$(cat "${PHASE_DIR}"/*-CONTEXT.md 2>/dev/null)
```

**CRITICAL:** Store `CONTEXT_CONTENT` now. It must be passed to:
- **Researcher** — constrains what to research (locked decisions vs Claude's discretion)
- **Planner** — locked decisions must be honored, not revisited
- **Checker** — verifies plans respect user's stated vision
- **Revision** — context for targeted fixes

If CONTEXT.md exists, display: `Using phase context from: ${PHASE_DIR}/*-CONTEXT.md`

## 5. Handle Research

**If `--gaps` flag:** Skip research (gap closure uses VERIFICATION.md instead).

**If `--skip-research` flag:** Skip to step 6.

**Check config for research setting:**

```bash
WORKFLOW_RESEARCH=$(cat .planning/config.json 2>/dev/null | grep -o '"research"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

**If `workflow.research` is `false` AND `--research` flag NOT set:** Skip to step 6.

**Otherwise:**

Check for existing research:

```bash
ls "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null
```

**If RESEARCH.md exists AND `--research` flag NOT set:**
- Display: `Using existing research: ${PHASE_DIR}/${PHASE}-RESEARCH.md`
- Skip to step 6

**If RESEARCH.md missing OR `--research` flag set:**

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning researcher...
```

Proceed to spawn researcher

### Spawn gsd-phase-researcher

Gather additional context for research prompt:

```bash
# Get phase description from roadmap
PHASE_DESC=$(grep -A3 "Phase ${PHASE}:" .planning/ROADMAP.md)

# Get requirements if they exist
REQUIREMENTS=$(cat .planning/REQUIREMENTS.md 2>/dev/null | grep -A100 "## Requirements" | head -50)

# Get prior decisions from STATE.md
DECISIONS=$(grep -A20 "### Decisions Made" .planning/STATE.md 2>/dev/null)

# CONTEXT_CONTENT already loaded in step 4
```

Fill research prompt and spawn:

```markdown
<objective>
Research how to implement Phase {phase_number}: {phase_name}

Answer: "What do I need to know to PLAN this phase well?"
</objective>

<phase_context>
**IMPORTANT:** If CONTEXT.md exists below, it contains user decisions from /gsd:discuss-phase.

- **Decisions section** = Locked choices — research THESE deeply, don't explore alternatives
- **Claude's Discretion section** = Your freedom areas — research options, make recommendations
- **Deferred Ideas section** = Out of scope — ignore completely

{context_content}
</phase_context>

<additional_context>
**Phase description:**
{phase_description}

**Requirements (if any):**
{requirements}

**Prior decisions from STATE.md:**
{decisions}
</additional_context>

<output>
Write research findings to: {phase_dir}/{phase}-RESEARCH.md
</output>
```

```
Task(
  prompt="First, read ~/.claude/agents/gsd-phase-researcher.md for your role and instructions.\n\n" + research_prompt,
  subagent_type="general-purpose",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

### Handle Researcher Return

**`## RESEARCH COMPLETE`:**
- Display: `Research complete. Proceeding to planning...`
- Continue to step 6

**`## RESEARCH BLOCKED`:**
- Display blocker information
- Offer: 1) Provide more context, 2) Skip research and plan anyway, 3) Abort
- Wait for user response

## 6. Check Existing Plans

```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null
```

**If exists:** Offer: 1) Continue planning (add more plans), 2) View existing, 3) Replan from scratch. Wait for response.

## 7. Read Context Files

Read and store context file contents for the planner agent. The `@` syntax does not work across Task() boundaries - content must be inlined.

```bash
# Read required files
STATE_CONTENT=$(cat .planning/STATE.md)
ROADMAP_CONTENT=$(cat .planning/ROADMAP.md)

# Read optional files (empty string if missing)
REQUIREMENTS_CONTENT=$(cat .planning/REQUIREMENTS.md 2>/dev/null)
# CONTEXT_CONTENT already loaded in step 4
RESEARCH_CONTENT=$(cat "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null)

# Gap closure files (only if --gaps mode)
VERIFICATION_CONTENT=$(cat "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null)
UAT_CONTENT=$(cat "${PHASE_DIR}"/*-UAT.md 2>/dev/null)
```

## 8. Plan & Verify

**Gate for streaming verification:**
- `USE_AGENT_TEAMS = true`
- `plan_check` enabled (not `--skip-verify`, config `workflow.plan_check` is true)
- NOT `--gaps` mode (gap closure produces 1-2 plans — sequential is fine)

**If all gate conditions met → use 8b (Streaming). Otherwise → use 8a (Sequential).**

### 8a. Standard Sequential Planning

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner...
```

Fill prompt with inlined content and spawn:

```markdown
<planning_context>

**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

**Project State:**
{state_content}

**Roadmap:**
{roadmap_content}

**Requirements (if exists):**
{requirements_content}

**Phase Context (if exists):**

IMPORTANT: If phase context exists below, it contains USER DECISIONS from /gsd:discuss-phase.
- **Decisions** = LOCKED — honor these exactly, do not revisit or suggest alternatives
- **Claude's Discretion** = Your freedom — make implementation choices here
- **Deferred Ideas** = Out of scope — do NOT include in this phase

{context_content}

**Research (if exists):**
{research_content}

**Gap Closure (if --gaps mode):**
{verification_content}
{uat_content}

</planning_context>

<downstream_consumer>
Output consumed by /gsd:execute-phase
Plans must be executable prompts with:

- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

```
Task(
  prompt="First, read ~/.claude/agents/gsd-planner.md for your role and instructions.\n\n" + filled_prompt,
  subagent_type="general-purpose",
  model="{planner_model}",
  description="Plan Phase {phase}"
)
```

#### Handle Planner Return

Parse planner output:

**`## PLANNING COMPLETE`:**
- Display: `Planner created {N} plan(s). Files on disk.`
- If `--skip-verify`: Skip to step 13
- Check config: `WORKFLOW_PLAN_CHECK=$(cat .planning/config.json 2>/dev/null | grep -o '"plan_check"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")`
- If `workflow.plan_check` is `false`: Skip to step 13
- Otherwise: Proceed to verification

**`## CHECKPOINT REACHED`:**
- Present to user, get response, spawn continuation (see revision loop)

**`## PLANNING INCONCLUSIVE`:**
- Show what was attempted
- Offer: Add context, Retry, Manual
- Wait for user response

#### Spawn gsd-plan-checker Agent

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Read plans for the checker:

```bash
# Read all plans in phase directory
PLANS_CONTENT=$(cat "${PHASE_DIR}"/*-PLAN.md 2>/dev/null)

# CONTEXT_CONTENT already loaded in step 4
# REQUIREMENTS_CONTENT already loaded in step 7
```

Fill checker prompt with inlined content and spawn:

```markdown
<verification_context>

**Phase:** {phase_number}
**Phase Goal:** {goal from ROADMAP}

**Plans to verify:**
{plans_content}

**Requirements (if exists):**
{requirements_content}

**Phase Context (if exists):**

IMPORTANT: If phase context exists below, it contains USER DECISIONS from /gsd:discuss-phase.
Plans MUST honor these decisions. Flag as issue if plans contradict user's stated vision.

- **Decisions** = LOCKED — plans must implement these exactly
- **Claude's Discretion** = Freedom areas — plans can choose approach
- **Deferred Ideas** = Out of scope — plans must NOT include these

{context_content}

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} plans"
)
```

#### Handle Checker Return

**If `## VERIFICATION PASSED`:**
- Display: `Plans verified. Ready for execution.`
- Proceed to step 13

**If `## ISSUES FOUND`:**
- Display: `Checker found issues:`
- List issues from checker output
- Check iteration count
- Proceed to revision loop

#### Revision Loop (Max 3 Iterations)

Track: `iteration_count` (starts at 1 after initial plan + check)

**If iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Read current plans for revision context:

```bash
PLANS_CONTENT=$(cat "${PHASE_DIR}"/*-PLAN.md 2>/dev/null)
# CONTEXT_CONTENT already loaded in step 4
```

Spawn gsd-planner with revision prompt:

```markdown
<revision_context>

**Phase:** {phase_number}
**Mode:** revision

**Existing plans:**
{plans_content}

**Checker issues:**
{structured_issues_from_checker}

**Phase Context (if exists):**

IMPORTANT: If phase context exists, revisions MUST still honor user decisions.

{context_content}

</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Revisions must still honor all locked decisions from Phase Context.
Return what changed.
</instructions>
```

```
Task(
  prompt="First, read ~/.claude/agents/gsd-planner.md for your role and instructions.\n\n" + revision_prompt,
  subagent_type="general-purpose",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

- After planner returns → spawn checker again (verification step above)
- Increment iteration_count

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain:`
- List remaining issues

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit planning)

Wait for user response.

### 8b. Streaming Plan Verification (Agent Teams)

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE {X} (streaming verification)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner + checker team...
  → Planner writes plans, checker verifies incrementally
  → Issues caught during planning, not after
```

Use `spawnTeam` to create a 2-agent team: `plan-phase-{N}`

**Planner teammate** gets the standard planning prompt (same inlined context as 8a) with added `<team_protocol>`:

```markdown
<team_protocol>
You are the PLANNER in a planner-checker team.

Your teammate: checker (verifies your plans incrementally)

PROTOCOL:
1. Write each PLAN.md file to disk as normal
2. After EACH plan file is written, message checker:
   PLAN_READY: {plan-id} at {file-path} | TASKS: {count} | WAVE: {N}
3. If checker sends back issues, fix them BEFORE writing the next plan:
   - Read the issue message
   - Edit the plan file on disk
   - Message checker: PLAN_REVISED: {plan-id} at {file-path} | FIXED: {issue summary}
4. After ALL plans written, message checker:
   ALL_PLANS_COMPLETE: {total-count} plans at {phase-dir}
5. Wait for checker's final cross-plan verdict before returning to orchestrator
6. If you encounter a CHECKPOINT: message orchestrator directly with checkpoint details. Wait for response before continuing.

IMPORTANT: Do not wait for checker between plans unless checker has sent an issue.
Write continuously — only pause to fix reported issues.
</team_protocol>
```

Planner prompt includes inlined context (same as 8a):
- `<planning_context>` with STATE, ROADMAP, REQUIREMENTS, CONTEXT, RESEARCH content
- `<downstream_consumer>` and `<quality_gate>` sections
- Self-read prefix: `"First, read ~/.claude/agents/gsd-planner.md for your role and instructions.\n\n"`
- Model: `{planner_model}` from profile

**Checker teammate** gets the verification context with added `<team_protocol>`:

```markdown
<team_protocol>
You are the CHECKER in a planner-checker team.

Your teammate: planner (writes plans, you verify them)

PROTOCOL:
1. Wait for PLAN_READY messages from planner
2. For each plan received, run PER-PLAN checks immediately:
   - [ ] Valid frontmatter (wave, depends_on, files_modified, autonomous)
   - [ ] Tasks have <action>, <verify>, <done> sections
   - [ ] Scope aligns with phase goal
   - [ ] Context/decisions honored (if CONTEXT.md exists)
   - [ ] must_haves derived from phase goal
3. If issues found, message planner immediately:
   ISSUE: {plan-id} | SEVERITY: {blocker|warning} | DETAIL: {specific problem and fix suggestion}
4. If plan passes per-plan checks: no message needed (silence = approval)
5. After receiving ALL_PLANS_COMPLETE, run CROSS-PLAN checks:
   - [ ] Full requirement coverage across all plans
   - [ ] Dependency graph correctness (depends_on references valid plan IDs)
   - [ ] No file overlap between same-wave plans
   - [ ] Wave ordering makes sense for the dependency graph
6. Return final verdict to orchestrator:
   - ## VERIFICATION PASSED — all plans pass
   - ## ISSUES FOUND — list remaining cross-plan issues

IMPORTANT: Send issues AS SOON AS you find them. Don't batch. The planner can fix while writing later plans.
</team_protocol>
```

Checker verification context includes:
```markdown
<verification_context>
**Phase:** {phase_number}
**Phase Goal:** {goal from ROADMAP}

**Roadmap:**
{roadmap_content}

**Requirements (if exists):**
{requirements_content}

**Phase Context (if exists):**

IMPORTANT: Plans MUST honor these decisions. Flag as issue if plans contradict user's stated vision.
- **Decisions** = LOCKED — plans must implement these exactly
- **Claude's Discretion** = Freedom areas — plans can choose approach
- **Deferred Ideas** = Out of scope — plans must NOT include these

{context_content}
</verification_context>
```

Self-read prefix: `"First, read ~/.claude/agents/gsd-plan-checker.md for your role and instructions.\n\n"`
Model: `{checker_model}` from profile

**After team completes:**
1. Call `Teammate.cleanup()` to remove team resources
2. If checker returned `## VERIFICATION PASSED`: proceed to next step (display results)
3. If checker returned `## ISSUES FOUND` (cross-plan issues only — per-plan issues already fixed):
   - Display remaining issues
   - These are cross-plan issues that couldn't be fixed inline
   - Offer: 1) Force proceed, 2) Manual fix, 3) Spawn fresh revision subagent
   - If option 3: spawn fresh gsd-planner subagent (NOT teammate) with cross-plan issues + plans inlined, then re-run checker as subagent (current sequential pattern for one final pass)
4. If planner sent `## CHECKPOINT REACHED` via message:
   - Present checkpoint details to user
   - Get user response
   - Send response back to planner teammate via SendMessage

## 13. Present Final Status

Route to `<offer_next>`.

</process>

<offer_next>
Output this markdown directly (not as a code block):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {X} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} plan(s) in {M} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute Phase {X}** — run all {N} plans

/gsd:execute-phase {X}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase-dir}/*-PLAN.md — review plans
- /gsd:plan-phase {X} --research — re-research first

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] .planning/ directory validated
- [ ] Phase validated against roadmap
- [ ] Phase directory created if needed
- [ ] CONTEXT.md loaded early (step 4) and passed to ALL agents
- [ ] Research completed (unless --skip-research or --gaps or exists)
- [ ] gsd-phase-researcher spawned with CONTEXT.md (constrains research scope)
- [ ] Existing plans checked
- [ ] gsd-planner spawned with context (CONTEXT.md + RESEARCH.md)
- [ ] Plans created (PLANNING COMPLETE or CHECKPOINT handled)
- [ ] gsd-plan-checker spawned with CONTEXT.md (verifies context compliance)
- [ ] Verification passed OR user override OR max iterations with user decision
- [ ] User sees status between agent spawns
- [ ] Agent Teams detection (if enabled, streaming verification used)
- [ ] Team cleanup after completion (if teams used)
- [ ] User knows next steps (execute or review)
</success_criteria>
