---
name: gsd:plan-phase
description: Create detailed execution plan for a phase (PLAN.md) with verification loop
argument-hint: [phase] [--research] [--skip-research] [--gaps] [--skip-verify]
agent: gsd-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
---

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<objective>
Create executable phase plans (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, read context files, construct prompts with understanding, spawn subagents, iterate until plans pass, present results.

**Why subagents:** Research and planning burn context fast. Verification uses fresh context. User sees the flow between agents in main context.
</objective>

<context>
Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)

- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research entirely
- `--gaps` — Gap closure mode (uses VERIFICATION.md, skips research)
- `--skip-verify` — Skip verification loop
</context>

<process>
## Step 1: Validate Environment and Initialize

**Runtime Call**: `planPhase_init`

| Argument | Source |
|----------|--------|
| arguments | "$ARGUMENTS" |

```bash
CTX=$(node .claude/runtime/runtime.js planPhase_init '{"arguments": "$ARGUMENTS"}')
```

**If ctx.error:**

**Error:** $(echo "$CTX" | jq -r '.error')

Run `/gsd:new-project` first if .planning/ directory is missing.

**End command (ERROR)**: Initialization failed

Phase directory: $(echo "$CTX" | jq -r '.phaseDir')

Model profile: $(echo "$CTX" | jq -r '.modelProfile')

### Model Profile Lookup

| Agent | quality | balanced | budget |
| :--- | :--- | :--- | :--- |
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-planner | opus | opus | sonnet |
| gsd-plan-checker | sonnet | sonnet | haiku |

## Step 2: Read Context Files

Read and store context file contents for prompt construction. The `@` syntax does not work across Task() boundaries — content must be inlined.

```bash
# Read required files
STATE_CONTENT=$(cat .planning/STATE.md)
ROADMAP_CONTENT=$(cat .planning/ROADMAP.md)

# Read optional files (empty string if missing)
REQUIREMENTS_CONTENT=$(cat .planning/REQUIREMENTS.md 2>/dev/null)
CONTEXT_CONTENT=$(cat ${ctx.phaseDir}/*-CONTEXT.md 2>/dev/null)
RESEARCH_CONTENT=$(cat ${ctx.phaseDir}/*-RESEARCH.md 2>/dev/null)

# Gap closure files (only if --gaps mode)
VERIFICATION_CONTENT=$(cat ${ctx.phaseDir}/*-VERIFICATION.md 2>/dev/null)
UAT_CONTENT=$(cat ${ctx.phaseDir}/*-UAT.md 2>/dev/null)
```

## Step 3: Handle Research

**If ctx.flags.gaps:**

Gap closure mode — skipping research (using VERIFICATION.md instead).

**Otherwise:**

**If ctx.flags.skipResearch:**

Research skipped (--skip-research flag).

**Otherwise:**

**If ctx.needsResearch:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING PHASE ${ctx.phaseId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Gather context for research prompt:

```bash
# Get phase description from roadmap
PHASE_DESC=$(grep -A3 "Phase ${ctx.phaseId}:" .planning/ROADMAP.md)

# Get requirements if they exist
REQUIREMENTS=$(cat .planning/REQUIREMENTS.md 2>/dev/null | grep -A100 "## Requirements" | head -50)

# Get prior decisions from STATE.md
DECISIONS=$(grep -A20 "### Decisions Made" .planning/STATE.md 2>/dev/null)

# Get phase context if exists
PHASE_CONTEXT=$(cat ${ctx.phaseDir}/*-CONTEXT.md 2>/dev/null)
```

Fill research prompt with context and spawn:

```
<objective>
Research how to implement Phase ${ctx.phaseId}: ${ctx.phaseName}

Answer: "What do I need to know to PLAN this phase well?"
</objective>

<context>
**Phase description:**
{phase_description}

**Requirements (if any):**
{requirements_content}

**Prior decisions:**
{decisions_content}

**Phase context (if any):**
{context_content}
</context>

<output>
Write research findings to: ${ctx.phaseDir}/${ctx.phaseId}-RESEARCH.md
</output>
```

◆ Spawning researcher...

```
Task(
  prompt="First, read ${ctx.agentPaths.researcher} for your role and instructions.\n\n" + research_prompt,
  subagent_type="gsd-phase-researcher",
  model="${ctx.models.researcher}",
  description="Research Phase ${ctx.phaseId}"
)
```

**Runtime Call**: `planPhase_parseAgentStatus`

| Argument | Source |
|----------|--------|
| output | "$AGENT_OUTPUT" |

```bash
AGENT_STATUS=$(node .claude/runtime/runtime.js planPhase_parseAgentStatus '{"output": "$AGENT_OUTPUT"}')
```

**If agent_status.status === "BLOCKED":**

**Research blocked:** $(echo "$AGENT_STATUS" | jq -r '.message')

Use the AskUserQuestion tool:

- Question: "Research encountered a blocker. How would you like to proceed?"
- Header: "Blocker"
- Options:
  - "Provide more context" (value: "context") - Add information and retry research
  - "Skip research" (value: "skip") - Proceed to planning without research
  - "Abort" (value: "abort") - Exit planning entirely

Store the user's response in `$USER_CHOICE`.

**If user_choice === "abort":**

**End command (BLOCKED)**: User aborted due to research blocker

**If user_choice === "skip":**

Skipping research, proceeding to planning...

**If user_choice === "context":**

Please provide additional context, then run /gsd:plan-phase $(echo "$CTX" | jq -r '.phaseId') again.

**End command (CHECKPOINT)**: Waiting for user context

**Otherwise:**

Research complete. Proceeding to planning...

**Otherwise:**

Using existing research: $(echo "$CTX" | jq -r '.phaseDir')/$(echo "$CTX" | jq -r '.phaseId')-RESEARCH.md

## Step 4: Check Existing Plans

```bash
ls ${ctx.phaseDir}/*-PLAN.md 2>/dev/null
```

**If ctx.hasPlans:**

Found existing plan(s) in $(echo "$CTX" | jq -r '.phaseDir')/

Use the AskUserQuestion tool:

- Question: "Plans already exist for this phase. What would you like to do?"
- Header: "Existing Plans"
- Options:
  - "Continue planning" (value: "continue") - Add more plans to existing ones
  - "View existing plans" (value: "view") - Display current plans before deciding
  - "Replan from scratch" (value: "replan") - Archive existing and create new plans

Store the user's response in `$USER_CHOICE`.

**If user_choice === "view":**

```bash
cat ${ctx.phaseDir}/*-PLAN.md
```

Use the AskUserQuestion tool:

- Question: "After reviewing the plans, how would you like to proceed?"
- Header: "Decision"
- Options:
  - "Continue planning" (value: "continue") - Add more plans
  - "Replan from scratch" (value: "replan") - Archive and recreate
  - "Done" (value: "done") - Plans look good, exit

Store the user's response in `$USER_CHOICE`.

**If user_choice === "done":**

Keeping existing plans. Run /gsd:execute-phase $(echo "$CTX" | jq -r '.phaseId') when ready.

**End command (SUCCESS)**: Using existing plans

**If user_choice === "replan":**

Archiving existing plans...

**Runtime Call**: `planPhase_archiveExistingPlans`

| Argument | Source |
|----------|--------|
| phaseDir | CTX.phaseDir |

```bash
ARCHIVE_RESULT=$(node .claude/runtime/runtime.js planPhase_archiveExistingPlans '{"phaseDir": "$(echo "$CTX" | jq -r '.phaseDir')"}')
```

$(echo "$ARCHIVE_RESULT" | jq -r '.')

## Step 5: Spawn gsd-planner Agent

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE ${ctx.phaseId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Fill prompt with inlined content and spawn:

```
<planning_context>

**Phase:** ${ctx.phaseId}
**Mode:** {mode}

**Project State:**
{state_content}

**Roadmap:**
{roadmap_content}

**Requirements (if exists):**
{requirements_content}

**Phase Context (if exists):**
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

◆ Spawning planner...

```
Task(
  prompt="First, read ${ctx.agentPaths.planner} for your role and instructions.\n\n" + filled_prompt,
  subagent_type="gsd-planner",
  model="${ctx.models.planner}",
  description="Plan Phase ${ctx.phaseId}"
)
```

**Runtime Call**: `planPhase_parseAgentStatus`

| Argument | Source |
|----------|--------|
| output | "$AGENT_OUTPUT" |

```bash
AGENT_STATUS=$(node .claude/runtime/runtime.js planPhase_parseAgentStatus '{"output": "$AGENT_OUTPUT"}')
```

**If agent_status.status === "CHECKPOINT":**

**Checkpoint reached:** $(echo "$AGENT_STATUS" | jq -r '.message')

Planner needs user input to continue.

Use the AskUserQuestion tool:

- Question: "Planner reached a checkpoint. How would you like to proceed?"
- Header: "Checkpoint"
- Options:
  - "Continue" (value: "continue") - Provide guidance and continue
  - "Pause" (value: "pause") - Save progress and exit

Store the user's response in `$USER_CHOICE`.

**If user_choice === "pause":**

**End command (CHECKPOINT)**: Planning paused at checkpoint

**If agent_status.status === "INCONCLUSIVE":**

**Planning inconclusive:** $(echo "$AGENT_STATUS" | jq -r '.message')

Use the AskUserQuestion tool:

- Question: "Planning was inconclusive. How would you like to proceed?"
- Header: "Inconclusive"
- Options:
  - "Add context" (value: "context") - Provide more details and retry
  - "Retry" (value: "retry") - Try planning again
  - "Manual" (value: "manual") - Create plans manually

Store the user's response in `$USER_CHOICE`.

**If user_choice === "manual":**

Create plans manually in $(echo "$CTX" | jq -r '.phaseDir')/, then run /gsd:execute-phase $(echo "$CTX" | jq -r '.phaseId')

**End command (CHECKPOINT)**: Manual planning requested

**If user_choice === "context":**

Please provide additional context, then run /gsd:plan-phase $(echo "$CTX" | jq -r '.phaseId') again.

**End command (CHECKPOINT)**: Waiting for user context

**Otherwise:**

Planner completed. Plans created in $(echo "$CTX" | jq -r '.phaseDir')/

## Step 6: Verification Loop

**If ctx.flags.skipVerify:**

Verification skipped (--skip-verify flag).

**Otherwise:**

**If !ctx.config.workflowPlanCheck:**

Verification disabled in config (workflow.plan_check: false).

**Otherwise:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Read plans and requirements for the checker:

```bash
PLANS_CONTENT=$(cat ${ctx.phaseDir}/*-PLAN.md 2>/dev/null)
REQUIREMENTS_CONTENT=$(cat .planning/REQUIREMENTS.md 2>/dev/null)
```

**Loop up to 4 times (counter: $ITERATION):**

◆ Iteration $(echo "$ITERATION" | jq -r '.')/3: Spawning plan checker...

Fill checker prompt with inlined content:

```
<verification_context>

**Phase:** ${ctx.phaseId}
**Phase Goal:** {phase_goal}

**Plans to verify:**
{plans_content}

**Requirements (if exists):**
{requirements_content}

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
  model="${ctx.models.checker}",
  description="Verify Phase ${ctx.phaseId} plans"
)
```

**Runtime Call**: `planPhase_parseAgentStatus`

| Argument | Source |
|----------|--------|
| output | "$AGENT_OUTPUT" |

```bash
AGENT_STATUS=$(node .claude/runtime/runtime.js planPhase_parseAgentStatus '{"output": "$AGENT_OUTPUT"}')
```

**If agent_status.status === "PASSED":**

Plans verified. Ready for execution.

**Break loop:** Verification passed

**If agent_status.status === "ISSUES_FOUND":**

Checker found issues:

```
agentStatus.issues.join('\n')
```

**If iteration >= 3:**

**Max iterations reached.** $(echo "$AGENT_STATUS" | jq -r '.issues.length') issue(s) remain.

Use the AskUserQuestion tool:

- Question: "Max verification iterations reached. How would you like to proceed?"
- Header: "Max Iterations"
- Options:
  - "Force proceed" (value: "force") - Execute despite issues
  - "Provide guidance" (value: "guidance") - Add context and retry
  - "Abandon" (value: "abandon") - Exit planning

Store the user's response in `$USER_CHOICE`.

**If user_choice === "abandon":**

**End command (ERROR)**: Verification failed after max iterations

**If user_choice === "force":**

Proceeding with issues. Consider fixing manually.

**Break loop:** User forced proceed

**Otherwise:**

Sending back to planner for revision... (iteration $(echo "$ITERATION" | jq -r '.')/3)

Fill revision prompt:

```
<revision_context>

**Phase:** ${ctx.phaseId}
**Mode:** revision

**Existing plans:**
{plans_content}

**Checker issues:**
{checker_issues}

</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Return what changed.
</instructions>
```

```
Task(
  prompt="First, read ${ctx.agentPaths.planner} for your role and instructions.\n\n" + revision_prompt,
  subagent_type="gsd-planner",
  model="${ctx.models.planner}",
  description="Revise Phase ${ctx.phaseId} plans"
)
```

After planner returns, re-read plans:

```bash
PLANS_CONTENT=$(cat ${ctx.phaseDir}/*-PLAN.md 2>/dev/null)
```

Plans revised. Re-checking...

## Step 7: Present Final Status

Gather plan statistics from phase directory:

```bash
# Count plans and extract wave info
PLAN_COUNT=$(ls ${ctx.phaseDir}/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
WAVE_COUNT=$(grep -h "^wave:" ${ctx.phaseDir}/*-PLAN.md 2>/dev/null | sort -u | wc -l | tr -d ' ')
PLAN_NAMES=$(ls ${ctx.phaseDir}/*-PLAN.md 2>/dev/null | xargs -I{} basename {} -PLAN.md | tr '\n' ', ')
```

Route to offer_next with filled values.
</process>

<offer_next>
Output this summary directly (not as a code block), filling in values based on what happened:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE ${ctx.phaseId} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase ${ctx.phaseId}: ${ctx.phaseName}** — {plan_count} plan(s) in {wave_count} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives from plans] |
| 2    | 03     | [objective from plan]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute Phase ${ctx.phaseId}** — run all {plan_count} plans

/gsd:execute-phase ${ctx.phaseId}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat ${ctx.phaseDir}/*-PLAN.md — review plans
- /gsd:plan-phase ${ctx.phaseId} --research — re-research first

───────────────────────────────────────────────────────────────
```

Fill the placeholders:

- `{plan_count}` — number of PLAN.md files created
- `{wave_count}` — number of unique waves across plans
- `Wave table` — actual plans grouped by wave with their objectives
- `Research` — based on what happened: Completed (spawned researcher), Used existing (had RESEARCH.md), Skipped (--skip-research or --gaps)
- `Verification` — based on what happened: Passed (checker approved), Passed with override (user forced), Skipped (--skip-verify or config disabled)
</offer_next>

<success_criteria>
- [] .planning/ directory validated
- [] Phase validated against roadmap
- [] Phase directory created if needed
- [] Research completed (unless --skip-research or --gaps or exists)
- [] gsd-phase-researcher spawned if research needed
- [] Existing plans checked
- [] gsd-planner spawned with context (including RESEARCH.md if available)
- [] Plans created (PLANNING COMPLETE or CHECKPOINT handled)
- [] gsd-plan-checker spawned (unless --skip-verify)
- [] Verification passed OR user override OR max iterations with user decision
- [] User sees status between agent spawns
- [] User knows next steps (execute or review)
</success_criteria>
