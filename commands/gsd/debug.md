---
name: gsd:debug
description: Systematic debugging with persistent state across context resets
argument-hint: [issue description]
allowed-tools:
  - Read
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Debug issues using scientific method with subagent isolation.

**Orchestrator role:** Gather symptoms, spawn gsd-debugger agent, handle checkpoints, spawn continuations.

**Why subagent:** Investigation burns context fast (reading files, forming hypotheses, testing). Fresh 200k context per investigation. Main context stays lean for user interaction.
</objective>

<context>
User's issue: $ARGUMENTS

Check for active sessions:
```bash
ls .planning/debug/*.md 2>/dev/null | grep -v resolved | head -5
```
</context>

<process>

## 0. Resolve Model Profile

Read model profile for agent spawning:

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Default to "balanced" if not set.

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-debugger | opus | sonnet | sonnet |

Store resolved model for use in Task calls below.

## 0.5. Detect Agent Teams

Check Agent Teams availability (both must be true):
- Environment: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Config: `agent_teams: true` in config.json

```bash
AGENT_TEAMS_ENV=${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-0}
AGENT_TEAMS_CONFIG=$(cat .planning/config.json 2>/dev/null | grep -o '"agent_teams"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "false")
USE_AGENT_TEAMS=false
[ "$AGENT_TEAMS_ENV" = "1" ] && [ "$AGENT_TEAMS_CONFIG" = "true" ] && USE_AGENT_TEAMS=true
```

## 1. Check Active Sessions

If active sessions exist AND no $ARGUMENTS:
- List sessions with status, hypothesis, next action
- User picks number to resume OR describes new issue

If $ARGUMENTS provided OR user describes new issue:
- Continue to symptom gathering

## 2. Gather Symptoms (if new issue)

Use AskUserQuestion for each:

1. **Expected behavior** - What should happen?
2. **Actual behavior** - What happens instead?
3. **Error messages** - Any errors? (paste or describe)
4. **Timeline** - When did this start? Ever worked?
5. **Reproduction** - How do you trigger it?

After all gathered, confirm ready to investigate.

## 3. Spawn Debugger

**If USE_AGENT_TEAMS = true:**

### 3b. Spawn Adversarial Debug Team

Display:
```
◆ Spawning adversarial debug team...
  → Debugger Alpha (primary investigator)
  → Debugger Beta (adversarial challenger)
```

Use spawnTeam to create a 2-agent team:

**debugger-alpha** gets the standard gsd-debugger prompt below with an added `<team_protocol>`:

```markdown
<team_protocol>
You are DEBUGGER ALPHA — PRIMARY INVESTIGATOR.

Your teammate: debugger-beta (adversarial challenger)

PROTOCOL (3 rounds max):
Round 1 (INVESTIGATE): Investigate using scientific method. Share your top 3 hypotheses with Beta.
Round 2 (DEFEND): When Beta challenges, provide evidence or concede and revise.
Round 3 (CONVERGE): Present final hypothesis. If still disagreeing, return BOTH hypotheses to orchestrator.

MESSAGE FORMATS:
- HYPOTHESIS: [claim] | EVIDENCE: [support] | FALSIFIABLE BY: [disproof method]
- When defending: EVIDENCE: [for which hypothesis] | DATA: [concrete proof]
- When conceding: CONCEDE: [which] | REASON: [why wrong] | REVISED: [new hypothesis]

RULES:
1. MAX 3 message exchanges. After round 3, report results regardless of convergence.
2. Convergence: root cause requires agreement from both agents
3. You own the debug file creation and eventual fix
4. goal: find_and_fix
</team_protocol>
```

**debugger-beta** gets the same symptoms context with an added `<team_protocol>`:

```markdown
<team_protocol>
You are DEBUGGER BETA — ADVERSARIAL CHALLENGER.

Your teammate: debugger-alpha (primary investigator)

PROTOCOL (3 rounds max):
Round 1 (INDEPENDENT): Form hypotheses INDEPENDENTLY before reading Alpha's. Share competing hypotheses.
Round 2 (CHALLENGE): Challenge Alpha's hypotheses with disconfirming evidence.
Round 3 (CONVERGE): Present final hypothesis. If still disagreeing, return BOTH to orchestrator with evidence.

MESSAGE FORMATS:
- HYPOTHESIS: [claim] | EVIDENCE: [support] | FALSIFIABLE BY: [disproof method]
- CHALLENGE: [which hypothesis] | COUNTER-EVIDENCE: [contradiction] | ALTERNATIVE: [competing explanation]
- CONCEDE: [which] | REASON: [why wrong] | REVISED: [new hypothesis]

RULES:
1. MAX 3 message exchanges. After round 3, report results regardless of convergence.
2. Convergence: only agree when evidence is unambiguous
3. Read Alpha's debug file, append evidence prefixed with [BETA]
4. goal: find_root_cause_only (no fix responsibility)
</team_protocol>
```

After team completes, handle return per Step 4 below.

**Else (USE_AGENT_TEAMS = false):**

### 3a. Spawn Single gsd-debugger Agent

Fill prompt and spawn:

```markdown
<objective>
Investigate issue: {slug}

**Summary:** {trigger}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<mode>
symptoms_prefilled: true
goal: find_and_fix
</mode>

<debug_file>
Create: .planning/debug/{slug}.md
</debug_file>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-debugger",
  model="{debugger_model}",
  description="Debug {slug}"
)
```

## 4. Handle Agent Return

**If Agent Teams was used:**

When both agents agree on root cause:
- Present as "confirmed root cause (adversarial validation)"
- Display shared evidence from both agents
- Offer options same as standard flow below

When agents disagree:
- Present BOTH hypotheses with supporting evidence
- Display Alpha's hypothesis and Beta's competing hypothesis
- Let user decide which to pursue, or spawn continuation

**Standard return handling (all modes):**

**If `## ROOT CAUSE FOUND`:**
- Display root cause and evidence summary
- Offer options:
  - "Fix now" - spawn fix subagent
  - "Plan fix" - suggest /gsd:plan-phase --gaps
  - "Manual fix" - done

**If `## CHECKPOINT REACHED`:**
- Present checkpoint details to user
- Get user response
- Spawn continuation agent (see step 5)

**If `## INVESTIGATION INCONCLUSIVE`:**
- Show what was checked and eliminated
- Offer options:
  - "Continue investigating" - spawn new agent with additional context
  - "Manual investigation" - done
  - "Add more context" - gather more symptoms, spawn again

## 5. Spawn Continuation Agent (After Checkpoint)

When user responds to checkpoint, spawn fresh agent:

```markdown
<objective>
Continue debugging {slug}. Evidence is in the debug file.
</objective>

<prior_state>
Debug file: @.planning/debug/{slug}.md
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
goal: find_and_fix
</mode>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="gsd-debugger",
  model="{debugger_model}",
  description="Continue debug {slug}"
)
```

</process>

<success_criteria>
- [ ] Active sessions checked
- [ ] Symptoms gathered (if new)
- [ ] gsd-debugger spawned with context
- [ ] Checkpoints handled correctly
- [ ] Root cause confirmed before fixing
</success_criteria>
