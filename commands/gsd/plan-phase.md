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
  - WebFetch
  - mcp__context7__*
---

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/planning-config.md
</execution_context>

<objective>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped or exists), spawn gsd-planner agent, verify plans with gsd-plan-checker, iterate until plans pass or max iterations reached, present results.

**Why subagents:** Research and planning burn context fast. Verification uses fresh context. User sees the flow between agents in main context.
</objective>

<context>
Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)

**Flags:**
- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research entirely, go straight to planning
- `--gaps` — Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` — Skip planner → checker verification loop

Normalize phase input in step 2 before any directory lookups.
</context>

<process>

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
| gsd-adversary | sonnet | sonnet | haiku |

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

## 3. Validate Phase

```bash
grep -A5 "Phase ${PHASE}:" .planning/ROADMAP.md 2>/dev/null
```

**If not found:** Error with available phases. **If found:** Extract phase number, name, description.

## 4. Ensure Phase Directory Exists

```bash
# PHASE is already normalized (08, 02.1, etc.) from step 2
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  # Create phase directory from roadmap name
  PHASE_NAME=$(grep "Phase ${PHASE}:" .planning/ROADMAP.md | sed 's/.*Phase [0-9]*: //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  mkdir -p ".planning/phases/${PHASE}-${PHASE_NAME}"
  PHASE_DIR=".planning/phases/${PHASE}-${PHASE_NAME}"
fi
```

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

Gather context for research prompt:

```bash
# Get phase description from roadmap
PHASE_DESC=$(grep -A3 "Phase ${PHASE}:" .planning/ROADMAP.md)

# Get requirements if they exist
REQUIREMENTS=$(cat .planning/REQUIREMENTS.md 2>/dev/null | grep -A100 "## Requirements" | head -50)

# Get prior decisions from STATE.md
DECISIONS=$(grep -A20 "### Decisions Made" .planning/STATE.md 2>/dev/null)

# Get phase context if exists
PHASE_CONTEXT=$(cat "${PHASE_DIR}"/*-CONTEXT.md 2>/dev/null)
```

Fill research prompt and spawn:

```markdown
<objective>
Research how to implement Phase {phase_number}: {phase_name}

Answer: "What do I need to know to PLAN this phase well?"
</objective>

<context>
**Phase description:**
{phase_description}

**Requirements (if any):**
{requirements}

**Prior decisions:**
{decisions}

**Phase context (if any):**
{phase_context}
</context>

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
CONTEXT_CONTENT=$(cat "${PHASE_DIR}"/*-CONTEXT.md 2>/dev/null)
RESEARCH_CONTENT=$(cat "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null)

# Gap closure files (only if --gaps mode)
VERIFICATION_CONTENT=$(cat "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null)
UAT_CONTENT=$(cat "${PHASE_DIR}"/*-UAT.md 2>/dev/null)
```

## 8. Spawn gsd-planner Agent

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

## 9. Handle Planner Return

Parse planner output:

**`## PLANNING COMPLETE`:**
- Display: `Planner created {N} plan(s). Files on disk.`
- If `--skip-verify`: Skip to step 12.5 (adversary review, which has its own skip logic)
- Check config: `WORKFLOW_PLAN_CHECK=$(cat .planning/config.json 2>/dev/null | grep -o '"plan_check"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")`
- If `workflow.plan_check` is `false`: Skip to step 12.5
- Otherwise: Proceed to step 10

**`## CHECKPOINT REACHED`:**
- Present to user, get response, spawn continuation (see step 12)

**`## PLANNING INCONCLUSIVE`:**
- Show what was attempted
- Offer: Add context, Retry, Manual
- Wait for user response

## 10. Spawn gsd-plan-checker Agent

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Read plans and requirements for the checker:

```bash
# Read all plans in phase directory
PLANS_CONTENT=$(cat "${PHASE_DIR}"/*-PLAN.md 2>/dev/null)

# Read requirements (reuse from step 7 if available)
REQUIREMENTS_CONTENT=$(cat .planning/REQUIREMENTS.md 2>/dev/null)
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

## 11. Handle Checker Return

**If `## VERIFICATION PASSED`:**
- Display: `Plans verified. Ready for execution.`
- Proceed to step 12.5 (adversary review)

**If `## ISSUES FOUND`:**
- Display: `Checker found issues:`
- List issues from checker output
- Check iteration count
- Proceed to step 12

## 12. Revision Loop (Max 3 Iterations)

Track: `iteration_count` (starts at 1 after initial plan + check)

**If iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Read current plans for revision context:

```bash
PLANS_CONTENT=$(cat "${PHASE_DIR}"/*-PLAN.md 2>/dev/null)
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

</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
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

- After planner returns → spawn checker again (step 10)
- Increment iteration_count

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain:`
- List remaining issues

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit planning)

Wait for user response.

## 12.5. Adversary Review — Plans

**Read adversary config:**

```bash
CHECKPOINT_NAME="plan"
CHECKPOINT_CONFIG=$(node -e "
  try {
    const c = JSON.parse(require('fs').readFileSync('.planning/config.json', 'utf8'));
    const adv = c.adversary || {};
    if (adv.enabled === false) { console.log('false|3'); process.exit(0); }
    const cp = adv.checkpoints?.[process.argv[1]];
    let enabled, rounds;
    if (typeof cp === 'boolean') { enabled = cp; rounds = adv.max_rounds ?? 3; }
    else if (typeof cp === 'object' && cp !== null) { enabled = cp.enabled ?? true; rounds = cp.max_rounds ?? adv.max_rounds ?? 3; }
    else { enabled = true; rounds = adv.max_rounds ?? 3; }
    console.log(enabled + '|' + rounds);
  } catch(e) { console.log('true|3'); }
" "$CHECKPOINT_NAME" 2>/dev/null || echo "true|3")

CHECKPOINT_ENABLED=$(echo "$CHECKPOINT_CONFIG" | cut -d'|' -f1)
MAX_ROUNDS=$(echo "$CHECKPOINT_CONFIG" | cut -d'|' -f2)

# Apply CONV-01 hard cap: debate never exceeds 3 rounds
EFFECTIVE_MAX_ROUNDS=$((MAX_ROUNDS > 3 ? 3 : MAX_ROUNDS))
```

**Skip logic:**

- If `CHECKPOINT_ENABLED = "false"`: Set `ADVERSARY_SKIPPED_DISABLED=true`. Skip to step 13.
- If `--gaps` mode: Set `ADVERSARY_SKIPPED_GAPS=true`. Skip to step 13. Adversary review adds friction without proportional value for gap closure plans.

**If CHECKPOINT_ENABLED = "true" AND not --gaps mode:**

Set `ADVERSARY_RAN=true`.

**Enumerate plans:**

```bash
PLAN_FILES=$(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | sort)
PLAN_COUNT=$(echo "$PLAN_FILES" | wc -l | tr -d ' ')
```

Initialize tracking variables: `PLANS_REVISED=false`, `TOTAL_CHALLENGES=0`, `TOTAL_ADDRESSED=0`, `TOTAL_NOTED=0`

**Per-plan debate loop:**

For each PLAN_FILE in PLAN_FILES (in plan number order):

### i. Display banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > ADVERSARY REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plan {NN} of {PLAN_COUNT}: Reviewing...
```

### ii. Initialize per-plan state

`ROUND=1`, `CONVERGED=false`, `PLAN_REVISED=false`

### iii. Debate loop

While ROUND <= EFFECTIVE_MAX_ROUNDS AND not CONVERGED:

**1. Read artifact from disk** (re-read each round to get latest after planner revision):

```bash
ARTIFACT_CONTENT=$(cat "$PLAN_FILE")
PROJECT_CONTEXT=$(head -50 .planning/PROJECT.md)

# Gather prior plans (all plans before current in sort order)
PRIOR_PLANS=""
for prior in $PLAN_FILES; do
  [ "$prior" = "$PLAN_FILE" ] && break
  PRIOR_PLANS+="$(cat "$prior")\n\n---\n\n"
done
```

**2. Spawn adversary:**

**Round 1:**
```
Task(prompt="First, read ~/.claude/agents/gsd-adversary.md for your role and instructions.

<artifact_type>plan</artifact_type>

<artifact_content>
{ARTIFACT_CONTENT}
</artifact_content>

<round>1</round>
<max_rounds>{EFFECTIVE_MAX_ROUNDS}</max_rounds>

<project_context>
{PROJECT_CONTEXT}
</project_context>

<prior_plans>
{PRIOR_PLANS — content of prior PLAN.md files in this phase. Empty for plan 01.}
</prior_plans>
", subagent_type="gsd-adversary", model="{adversary_model}", description="Adversary review: plan {NN} (round 1)")
```

**Round > 1:**
```
Task(prompt="First, read ~/.claude/agents/gsd-adversary.md for your role and instructions.

<artifact_type>plan</artifact_type>

<artifact_content>
{ARTIFACT_CONTENT — re-read from disk after planner revision}
</artifact_content>

<round>{ROUND}</round>
<max_rounds>{EFFECTIVE_MAX_ROUNDS}</max_rounds>

<defense>
{DEFENSE — built from planner's revision return}
</defense>

<previous_challenges>
{PREV_CHALLENGES — adversary's challenges from previous round}
</previous_challenges>

<project_context>
{PROJECT_CONTEXT}
</project_context>

<prior_plans>
{PRIOR_PLANS}
</prior_plans>
", subagent_type="gsd-adversary", model="{adversary_model}", description="Adversary review: plan {NN} (round {ROUND})")
```

**3. Parse adversary response:**
- Extract challenges (title, severity, concern, evidence, affected)
- Extract convergence recommendation (CONTINUE/CONVERGE)

**4. Check convergence:** If adversary recommends CONVERGE and ROUND > 1:
- Set `CONVERGED=true`
- Break

**5. Handle challenges** (if ROUND < EFFECTIVE_MAX_ROUNDS):

**If BLOCKING challenges exist — Planner-as-defender pattern:**

Re-spawn the planner agent in adversary_revision mode to address challenges. Do NOT edit the plan inline as the orchestrator — the planner has plan-level knowledge for higher-quality revisions.

```
Task(prompt="First, read ~/.claude/agents/gsd-planner.md for your role and instructions.

<revision_context>

**Phase:** {phase_number}
**Mode:** adversary_revision
**Target plan:** {plan_number}

**Current plan content:**
{current plan content from disk}

**Adversary challenges:**
{adversary's full challenge output — not a summary}

**Challenge handling instructions:**
- BLOCKING challenges: Must address with specific plan changes
- MAJOR challenges: Address if valid, note with rationale if not
- MINOR challenges: Note without revision (typically)

</revision_context>

<instructions>
Make targeted updates to plan {plan_number} to address adversary challenges.
Do NOT rewrite the plan from scratch.
Do NOT modify other plans.
Write the revised plan to disk at the exact file path: {PLAN_FILE}
Return what changed and why — this becomes the defense for the next adversary round.
</instructions>
", subagent_type="general-purpose", model="{planner_model}", description="Revise plan {NN} (adversary feedback)")
```

After planner returns:
- Build `DEFENSE` text from planner's return (what changed + what was rejected with rationale)
- Store `PREV_CHALLENGES` = adversary's full challenge output from this round
- Set `PLAN_REVISED=true`, `PLANS_REVISED=true`
- Update challenge counts: `TOTAL_ADDRESSED += addressed count`

**If MAJOR/MINOR only (no BLOCKING):** At Claude's discretion, may note without spawning planner. Build defense text noting the rationale for not revising. Store `PREV_CHALLENGES`. Increment `TOTAL_NOTED`.

**6.** Increment ROUND

### iv. Display per-plan summary

```
Plan {NN}: Adversary review complete

**Challenges:**
- ✓ **[SEVERITY]** {title} — Addressed: {what changed}
- ○ **[SEVERITY]** {title} — Noted: {rationale}
- ⚠ **[SEVERITY]** {title} — Unresolved: {why}
```

Use `✓` for addressed challenges, `○` for noted/minor challenges, `⚠` for unresolved challenges remaining at max rounds.

---

**Consolidated commit:**

After all plans reviewed, if `PLANS_REVISED = true`:

```bash
git add "${PHASE_DIR}"/*-PLAN.md
git commit -m "$(cat <<'EOF'
docs({phase}): incorporate adversary review feedback (plans)
EOF
)"
```

Only commit if actual revisions were made. Do not commit if all challenges were noted without revision. This preserves the pre-adversary state in git history (separate from the planner's original commit in step 8 and the checker revision commit in step 12).

**Consolidated summary:**

Display after all plans reviewed, before step 13:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > ADVERSARY REVIEW COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{PLAN_COUNT} plan(s) reviewed | {TOTAL_ADDRESSED} challenges addressed | {TOTAL_NOTED} noted
```

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
Adversary: {Reviewed N plan(s) | Skipped (disabled) | Skipped (gap closure)}

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
- [ ] Research completed (unless --skip-research or --gaps or exists)
- [ ] gsd-phase-researcher spawned if research needed
- [ ] Existing plans checked
- [ ] gsd-planner spawned with context (including RESEARCH.md if available)
- [ ] Plans created (PLANNING COMPLETE or CHECKPOINT handled)
- [ ] gsd-plan-checker spawned (unless --skip-verify)
- [ ] Verification passed OR user override OR max iterations with user decision
- [ ] Adversary review completed (unless disabled or --gaps)
- [ ] Adversary runs independently of --skip-verify and plan_check config
- [ ] Per-plan adversary challenges displayed with severity markers
- [ ] User sees status between agent spawns
- [ ] User knows next steps (execute or review)
</success_criteria>
