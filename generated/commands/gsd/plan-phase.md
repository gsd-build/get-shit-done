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
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped or exists), spawn gsd-planner agent, verify plans with gsd-plan-checker, iterate until plans pass or max iterations reached, present results.

**Why subagents:** Research and planning burn context fast. Verification uses fresh context. User sees the flow between agents in main context.
</objective>

<context>
Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)

- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research entirely, go straight to planning
- `--gaps` — Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` — Skip planner → checker verification loop

Normalize phase input in step 2 before any directory lookups.
</context>

<process>
## Step 1: Validate Environment

Initialize context, parse arguments, validate environment:

```bash
CTX=$(node runtime.js planPhase_init '{"arguments":"$ARGUMENTS"}')
```

**If ctx.error:**

**Error:** $(echo "$CTX" | jq -r '.error')

Run `/gsd:new-project` first if .planning/ directory is missing.

**End command (ERROR)**: Initialization failed

Phase $(echo "$CTX" | jq -r '.phaseId'): $(echo "$CTX" | jq -r '.phaseName')

Directory: $(echo "$CTX" | jq -r '.phaseDir')

Model profile: $(echo "$CTX" | jq -r '.modelProfile')

### Model Profile Lookup

| Agent | quality | balanced | budget |
| :--- | :--- | :--- | :--- |
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-planner | opus | opus | sonnet |
| gsd-plan-checker | sonnet | sonnet | haiku |

Store resolved models for use in Task calls below.

## Step 2: Handle Research

**If ctx.flags.gaps:**

Gap closure mode — skipping research (using VERIFICATION.md instead)

**Otherwise:**

**If ctx.flags.skipResearch:**

Research skipped (--skip-research flag)

**Otherwise:**

**If ctx.needsResearch:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING `PHASE ${ctx.phaseId}`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

◆ Building researcher prompt...

```bash
RESEARCHER_PROMPT=$(node runtime.js planPhase_buildResearcherPrompt '{"phaseId":"ctx.phaseId","phaseName":"ctx.phaseName","phaseDir":"ctx.phaseDir","phaseDescription":"ctx.phaseDescription","agentPath":"ctx.agentPaths.researcher"}')
```

◆ Spawning researcher agent...

◆ Spawning researcher agent...

```
Task(
  prompt="<prompt>
$(echo \"$RESEARCHER_PROMPT\" | jq -r '.prompt')
</prompt>",
  subagent_type="gsd-phase-researcher",
  model="sonnet",
  description="Research Phase ${ctx.phaseId}"
)
```

Store the agent's result in `$AGENT_OUTPUT`.

```bash
AGENT_STATUS=$(node runtime.js planPhase_parseAgentStatus '{"output":"agentOutput"}')
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

## Step 3: Check Existing Plans

```bash
EXISTING_PLANS=$(node runtime.js planPhase_checkExistingPlans '{"phaseDir":"ctx.phaseDir"}')
```

**If existing_plans.hasPlans:**

Found $(echo "$EXISTING_PLANS" | jq -r '.planCount') existing plan(s):

```
existingPlans.planSummary
```

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
PLANS_DISPLAY=$(node runtime.js planPhase_readAndDisplayPlans '{"phaseDir":"ctx.phaseDir"}')
```

```
plansDisplay
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

```bash
_VOID=$(node runtime.js planPhase_archiveExistingPlans '{"phaseDir":"ctx.phaseDir"}')
```

Existing plans archived. Starting fresh...

## Step 4: Spawn Planner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE ${ctx.phaseId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

◆ Building planner prompt...

```bash
PLANNER_PROMPT=$(node runtime.js planPhase_buildPlannerPrompt '{"phaseId":"ctx.phaseId","phaseName":"ctx.phaseName","phaseDir":"ctx.phaseDir","agentPath":"ctx.agentPaths.planner","mode":"ctx.flags.gaps ? '"'"'gap_closure'"'"' : '"'"'standard'"'"'"}')
```

◆ Spawning planner agent...

```
Task(
  prompt="<prompt>
$(echo \"$PLANNER_PROMPT\" | jq -r '.prompt')
</prompt>",
  subagent_type="gsd-planner",
  model="opus",
  description="Plan Phase ${ctx.phaseId}"
)
```

Store the agent's result in `$AGENT_OUTPUT`.

```bash
AGENT_STATUS=$(node runtime.js planPhase_parseAgentStatus '{"output":"agentOutput"}')
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

## Step 5: Verification Loop

**If ctx.flags.skipVerify:**

Verification skipped (--skip-verify flag)

**Otherwise:**

**If !ctx.config.workflowPlanCheck:**

Verification disabled in config (workflow.plan_check: false)

**Otherwise:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Loop up to 4 times (counter: $ITERATION):**

◆ Iteration $(echo "$ITERATION" | jq -r '.')/3: Spawning plan checker...

```bash
CHECKER_PROMPT=$(node runtime.js planPhase_buildCheckerPrompt '{"phaseId":"ctx.phaseId","phaseDir":"ctx.phaseDir"}')
```

```
Task(
  prompt="<prompt>
$(echo \"$CHECKER_PROMPT\" | jq -r '.prompt')
</prompt>",
  subagent_type="gsd-plan-checker",
  model="sonnet",
  description="Verify Phase ${ctx.phaseId} plans"
)
```

Store the agent's result in `$AGENT_OUTPUT`.

```bash
AGENT_STATUS=$(node runtime.js planPhase_parseAgentStatus '{"output":"agentOutput"}')
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

```bash
PLANNER_PROMPT=$(node runtime.js planPhase_buildPlannerPrompt '{"phaseId":"ctx.phaseId","phaseName":"ctx.phaseName","phaseDir":"ctx.phaseDir","agentPath":"ctx.agentPaths.planner","mode":"revision","issues":"agentStatus.issues"}')
```

```
Task(
  prompt="<prompt>
$(echo \"$PLANNER_PROMPT\" | jq -r '.prompt')
</prompt>",
  subagent_type="gsd-planner",
  model="opus",
  description="Revise Phase ${ctx.phaseId} plans"
)
```

Store the agent's result in `$AGENT_OUTPUT`.

Plans revised. Re-checking...

## Step 6: Final Summary

```bash
SUMMARY=$(node runtime.js planPhase_generateSummary '{"phaseId":"ctx.phaseId","phaseName":"ctx.phaseName","phaseDir":"ctx.phaseDir","checkerPassed":"agentStatus.status === '"'"'PASSED'"'"'","skipVerify":"ctx.flags.skipVerify","hasResearch":"ctx.hasResearch","forcedResearch":"ctx.flags.research","skippedResearch":"ctx.flags.skipResearch || ctx.flags.gaps"}')
```

```bash
SUMMARY_MD=$(node runtime.js planPhase_formatSummaryMarkdown '{"summary":"summary"}')
```
</process>

<offer_next>
Output this markdown directly (not as a code block):

$(echo "$SUMMARY_MD" | jq -r '.')
</offer_next>

<success_criteria>
- [] Init runtime: environment validated, arguments parsed, phase resolved, directory created
- [] Research: gsd-phase-researcher spawned if needed (unless --skip-research, --gaps, or exists)
- [] Existing plans: user consulted if plans exist (continue/view/replan)
- [] Planner: gsd-planner spawned with runtime-built prompt (handles COMPLETE/CHECKPOINT/INCONCLUSIVE)
- [] Verification: gsd-plan-checker in loop (unless --skip-verify or config disabled)
- [] Revision: planner re-spawned with issues if checker finds problems (max 3 iterations)
- [] Summary: runtime generates formatted output with next steps
</success_criteria>
