---
name: gsdf:autopilot
description: Run all remaining phases end-to-end without stopping (research, plan, execute, verify)
argument-hint: "[starting-phase]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
---

<objective>
Fully automated phase loop. Runs research → plan → execute → verify for every remaining phase in the roadmap without stopping for user input.

Operates in YOLO mode regardless of config. Stops only on unrecoverable errors (CHECKPOINT, EXECUTION BLOCKED, or critical verification failures the debugger cannot resolve).

Resumable: if interrupted, run `/gsdf:autopilot` again — it picks up from the current phase in STATE.md.
</objective>

<context>
Starting phase: $ARGUMENTS (optional — auto-detects first incomplete phase from ROADMAP.md if not provided)
</context>

<process>

## 1. Validate Environment

```bash
ls .planning/ROADMAP.md .planning/STATE.md .planning/config.json 2>/dev/null || echo "ERROR: Missing project files. Run /gsdf:new-project first."
```

**Resolve GSDF model profile:**
```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Model lookup tables:**

| Profile | researcher | planner | executor | verifier | plan-checker | debugger |
|---------|-----------|---------|----------|----------|-------------|----------|
| quality | opus | opus | sonnet | sonnet | sonnet | sonnet |
| balanced | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet |
| budget | haiku | sonnet | haiku | haiku | haiku | haiku |

**Read config toggles:**
```bash
RESEARCH_ENABLED=$(cat .planning/config.json | grep -o '"research"[[:space:]]*:[[:space:]]*[a-z]*' | grep -o '[a-z]*$')
PLAN_CHECK_ENABLED=$(cat .planning/config.json | grep -o '"plan_check"[[:space:]]*:[[:space:]]*[a-z]*' | grep -o '[a-z]*$')
VERIFIER_ENABLED=$(cat .planning/config.json | grep -o '"verifier"[[:space:]]*:[[:space:]]*[a-z]*' | grep -o '[a-z]*$')
```

## 2. Discover Phases

Parse ROADMAP.md for all phases and their status.

```bash
# Extract all phase lines: "- [ ] Phase 01: Name" or "- [x] Phase 01: Name"
grep -E "^\- \[[ x]\] \*\*Phase [0-9]" .planning/ROADMAP.md
```

Build list of all phases (number + name + status). Determine:
- **TOTAL_PHASES**: count of all phases
- **START_PHASE**: from $ARGUMENTS if provided, otherwise first phase where status is `[ ]` (not started)
- **REMAINING_PHASES**: list of phases from START_PHASE to last phase

If $ARGUMENTS provided:
```bash
PHASE="$ARGUMENTS"
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  PHASE=$(printf "%02d" "$PHASE")
fi
```

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► AUTOPILOT ENGAGED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phases: {START_PHASE} → {LAST_PHASE} ({REMAINING} of {TOTAL})
Profile: {MODEL_PROFILE}
Research: {RESEARCH_ENABLED}
Plan check: {PLAN_CHECK_ENABLED}
Verifier: {VERIFIER_ENABLED}
```

## 3. Phase Loop

**For each phase in REMAINING_PHASES, execute steps A through E sequentially:**

---

### Step A: Research Phase (Conditional)

**Skip if:**
- `RESEARCH_ENABLED` is `false`
- RESEARCH.md already exists for this phase

**Ensure phase directory:**
```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  PHASE_NAME=$(grep "Phase ${PHASE}:" .planning/ROADMAP.md | sed 's/.*Phase [0-9]*: //' | sed 's/\*\*//g' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  mkdir -p ".planning/phases/${PHASE}-${PHASE_NAME}"
  PHASE_DIR=".planning/phases/${PHASE}-${PHASE_NAME}"
fi
```

**Check existing research:**
```bash
ls "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null
```

```bash
CONTEXT_CONTENT=$(cat "${PHASE_DIR}"/*-CONTEXT.md 2>/dev/null)
```

If missing, display:
```
───────────────────────────────────────────────────────
 AUTOPILOT ► PHASE {X}: RESEARCHING
───────────────────────────────────────────────────────
```

Spawn researcher:
```
Task(
  prompt="Research implementation approach for Phase {phase_number}: {phase_name}

Phase goal: {from ROADMAP.md}
Requirements: {mapped REQ-IDs from ROADMAP.md}

Read .planning/PROJECT.md and .planning/REQUIREMENTS.md for context.
Read .planning/research/SUMMARY.md if it exists for tech stack decisions.

<research_methodology>
Treat pre-existing knowledge as hypothesis. Verify before asserting.
Tool strategy: Context7 first for libraries, WebFetch for official docs, WebSearch for ecosystem discovery.
Confidence: HIGH = Context7/official docs, MEDIUM = WebSearch + official verify, LOW = WebSearch only.
</research_methodology>

Discover:
- Standard architecture pattern for this phase's deliverables
- Recommended libraries (with versions) if any new ones needed
- Common pitfalls to avoid
- What NOT to hand-roll

Write to: {PHASE_DIR}/{PHASE}-RESEARCH.md

Return: RESEARCH COMPLETE with key findings summary.",
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}",
  description="Research Phase {X}"
)
```

**On return:**
- `RESEARCH COMPLETE`: Continue to Step B
- `CHECKPOINT REACHED`: **STOP autopilot.** Update STATE.md with current position. Report to user.

Commit:
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```
If COMMIT_PLANNING_DOCS=true:
```bash
git add "${PHASE_DIR}"/*-RESEARCH.md && git commit -m "docs(phase-${PHASE}): research complete"
```

---

### Step B: Plan Phase

Display:
```
───────────────────────────────────────────────────────
 AUTOPILOT ► PHASE {X}: PLANNING
───────────────────────────────────────────────────────
```

**Check for existing plans:**
```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null
```

If plans already exist, skip to Step C.

**Detect required skills:**
```bash
NEEDS_TDD=false
grep -qi "tdd\|test.driven" "${PHASE_DIR}"/*-CONTEXT.md .planning/REQUIREMENTS.md 2>/dev/null && NEEDS_TDD=true

NEEDS_CHECKPOINTS=false
grep -qi "checkpoint\|verify\|visual\|ui.check" "${PHASE_DIR}"/*-CONTEXT.md .planning/REQUIREMENTS.md 2>/dev/null && NEEDS_CHECKPOINTS=true
```

**Build skill includes:**
```markdown
SKILL_INCLUDES=""

if $NEEDS_TDD; then
  SKILL_INCLUDES+="
--- TDD SKILL ---
$(cat ~/.claude/skills/planner/tdd.md)
"
fi

if $NEEDS_CHECKPOINTS; then
  SKILL_INCLUDES+="
--- CHECKPOINTS SKILL ---
$(cat ~/.claude/skills/planner/checkpoints.md)
"
fi
```

**Build context and spawn planner:**

```bash
PLANNER_CORE=$(cat ~/.claude/agents/gsd-planner-core.md)
STATE_CONTENT=$(cat .planning/STATE.md)
ROADMAP_CONTENT=$(cat .planning/ROADMAP.md)
REQUIREMENTS_CONTENT=$(cat .planning/REQUIREMENTS.md 2>/dev/null)
RESEARCH_CONTENT=$(cat "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null)
CONTEXT_CONTENT=$(cat "${PHASE_DIR}"/*-CONTEXT.md 2>/dev/null)
```

```
Task(
  prompt="${PLANNER_CORE}

<planning_context>

**Phase:** {phase_number}
**Mode:** standard

**Project State:**
{state_content}

**Roadmap:**
{roadmap_content}

**Requirements:**
{requirements_content}

**Research:**
{research_content}

**Phase Context (if exists):**

IMPORTANT: If phase context exists below, it contains USER DECISIONS from /gsd:discuss-phase.
- **Decisions** = LOCKED — honor these exactly, do not revisit or suggest alternatives
- **Claude's Discretion** = Your freedom — make implementation choices here
- **Deferred Ideas** = Out of scope — do NOT include in this phase

{context_content}

</planning_context>

{skill_includes}

<downstream_consumer>
Output consumed by autopilot executor step.
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
</quality_gate>",
  subagent_type="general-purpose",
  model="{planner_model}",
  description="Plan Phase {X} (autopilot)"
)
```

**On return:**
- `PLANNING COMPLETE`: Continue to verification (if enabled) or Step C
- `CHECKPOINT REACHED`: **STOP autopilot.** Update STATE.md. Report to user.

**Plan verification (if PLAN_CHECK_ENABLED=true):**

Spawn official gsd-plan-checker. If issues found, enter revision loop (max 3 iterations):

```markdown
REVISION_SKILL="
--- REVISION SKILL ---
$(cat ~/.claude/skills/planner/revision.md)
"
```

Re-spawn planner with revision context + checker issues. Loop up to 3 times. If still failing after 3 iterations, **STOP autopilot** and report.

Commit:
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```
If COMMIT_PLANNING_DOCS=true:
```bash
git add "${PHASE_DIR}"/*-PLAN.md && git commit -m "docs(phase-${PHASE}): planning complete"
```

---

### Step C: Execute Phase

Display:
```
───────────────────────────────────────────────────────
 AUTOPILOT ► PHASE {X}: EXECUTING
───────────────────────────────────────────────────────
```

**Analyze plans for executor skills:**
```bash
HAS_CHECKPOINTS=false
grep -q "checkpoint:" "$PHASE_DIR"/*-PLAN.md 2>/dev/null && HAS_CHECKPOINTS=true

HAS_TDD=false
grep -q "type: tdd" "$PHASE_DIR"/*-PLAN.md 2>/dev/null && HAS_TDD=true

HAS_AUTH_GATES=false
grep -qiE "stripe|twilio|oauth|sendgrid|aws|gcp" "$PHASE_DIR"/*-PLAN.md 2>/dev/null && HAS_AUTH_GATES=true
```

**Build executor skill includes:**
```markdown
EXEC_SKILL_INCLUDES=""

if $HAS_CHECKPOINTS; then
  EXEC_SKILL_INCLUDES+="
--- CHECKPOINTS SKILL ---
$(cat ~/.claude/skills/executor/checkpoints.md)
"
fi

if $HAS_TDD; then
  EXEC_SKILL_INCLUDES+="
--- TDD SKILL ---
$(cat ~/.claude/skills/executor/tdd.md)
"
fi

if $HAS_AUTH_GATES; then
  EXEC_SKILL_INCLUDES+="
--- AUTH GATES SKILL ---
$(cat ~/.claude/skills/executor/auth-gates.md)
"
fi
```

**Group plans by wave:**
Parse `wave:` from each plan's frontmatter. Group sequentially by wave number.

**Execute each wave:**
For each wave, display:
```
  Wave {N}: {plan_list}
```

Pre-read executor core:
```bash
EXECUTOR_CORE=$(cat ~/.claude/agents/gsd-executor-core.md)
```

Spawn **all plans in the wave in parallel** (single message, multiple Task calls):

```
Task(
  prompt="${EXECUTOR_CORE}

{exec_skill_includes}

<plan>
{plan_content}
</plan>

<deviation_rules>
1. Auto-fix bugs — Fix immediately, document in Summary
2. Auto-add critical — Security/correctness gaps, add and document
3. Auto-fix blockers — Can't proceed without fix, do it and document
4. Architectural changes — STOP, report as CHECKPOINT REACHED
</deviation_rules>

<commit_rules>
Per-task commits: stage only files modified by that task.
Format: {type}({phase}-{plan}): {task-name}
Types: feat, fix, test, refactor, perf, chore
NEVER use git add . or git add -A. Always stage files individually.
</commit_rules>",
  subagent_type="general-purpose",
  model="{executor_model}",
  description="Execute plan {phase}-{NN}"
)
```

**On each return:**
- `PLAN COMPLETE`: Record success, continue to next wave
- `CHECKPOINT REACHED`: **STOP autopilot.** Update STATE.md. Report to user.
- `EXECUTION BLOCKED`: **STOP autopilot.** Update STATE.md. Report to user.

After all waves complete, commit any remaining changes.

---

### Step D: Verify Phase (Conditional)

**Skip if:** `VERIFIER_ENABLED` is `false`

Display:
```
───────────────────────────────────────────────────────
 AUTOPILOT ► PHASE {X}: VERIFYING
───────────────────────────────────────────────────────
```

Spawn verifier:
```
Task(
  prompt="Verify Phase {phase_number} goal achievement.

Read:
- .planning/ROADMAP.md (phase goal and success criteria)
- .planning/REQUIREMENTS.md (mapped requirements)
- {PHASE_DIR}/*-PLAN.md (what was planned)
- {PHASE_DIR}/*-SUMMARY.md (what was executed)

Check:
1. Each success criterion from ROADMAP.md — is it met by the code?
2. Each mapped requirement — is it implemented?
3. Run any test commands mentioned in plans.

Write: {PHASE_DIR}/{PHASE}-VERIFICATION.md

Return: VERIFICATION PASSED or VERIFICATION FAILED with list of gaps.",
  subagent_type="gsd-verifier",
  model="{verifier_model}",
  description="Verify Phase {X}"
)
```

**On return:**
- `VERIFICATION PASSED`: Continue to Step E
- `VERIFICATION FAILED`:
  - Spawn parallel debug agents for each gap:
    ```
    Task(prompt="Diagnose root cause for: {gap_description}
    Phase: {phase_number}
    Return: ROOT CAUSE FOUND with evidence",
    subagent_type="gsd-debugger-core", model="{debugger_model}",
    description="Diagnose: {gap}")
    ```
  - Then spawn planner for fix plans:
    ```
    Task(prompt="Create fix plans from diagnosed gaps.
    Gaps: {from debug agents}
    Phase directory: {PHASE_DIR}
    Write fix plans with gap_closure: true in frontmatter.
    Return PLANNING COMPLETE.",
    subagent_type="gsd-planner-core", model="{planner_model}",
    description="Plan fixes for Phase {X}")
    ```
  - Execute fix plans (same execution flow as Step C but only gap_closure plans)
  - Re-verify once. If still failing: **STOP autopilot.** Update STATE.md. Report to user.

Commit:
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```
If COMMIT_PLANNING_DOCS=true:
```bash
git add "${PHASE_DIR}"/*-VERIFICATION.md && git commit -m "docs(phase-${PHASE}): verification complete"
```

---

### Step E: Complete Phase

Update ROADMAP.md:
- Mark phase checkbox: `- [x] **Phase {X}: {Name}**`
- Update progress table: status = Complete, date = today

Update STATE.md:
- Current Phase → next phase
- Last activity → "Phase {X} complete via autopilot"
- Progress bar → updated percentage

Update REQUIREMENTS.md:
- Read ROADMAP.md for this phase's `Requirements:` line
- For each REQ-ID in this phase: change Status from "Pending" to "Complete"
- Skip if REQUIREMENTS.md doesn't exist or phase has no Requirements line

Commit:
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```
If COMMIT_PLANNING_DOCS=true:
```bash
git add .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md 2>/dev/null && git commit -m "docs(phase-${PHASE}): phase complete"
```

Display:
```
───────────────────────────────────────────────────────
 AUTOPILOT ► PHASE {X}: COMPLETE ✓
───────────────────────────────────────────────────────

Continuing to Phase {X+1}...
```

**Loop back to Step A with next phase.**

---

## 4. All Phases Complete

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► AUTOPILOT COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All {TOTAL} phases executed successfully.

| Phase | Name | Plans | Status |
|-------|------|-------|--------|
| 1 | ... | N | ✓ |
| 2 | ... | N | ✓ |
...

## ▶ Next Up

/gsdf:audit-milestone
```

Update STATE.md with final status.

</process>

<stop_conditions>
The autopilot STOPS and reports to the user when:

1. **CHECKPOINT REACHED** — An agent needs user input (e.g., design decision, unclear requirement)
2. **EXECUTION BLOCKED** — An executor hit an unresolvable issue (dependency, environment problem)
3. **VERIFICATION FAILED twice** — Fix attempt didn't resolve the gap
4. **Plan check failed 3 times** — Planner can't satisfy checker after 3 revision iterations

On stop:
- Update STATE.md with exact position (phase, step, issue)
- Display what happened and what needs manual attention
- User can resume with `/gsdf:autopilot` (picks up from current phase)
</stop_conditions>

<success_criteria>
- [ ] All remaining phases researched (if enabled)
- [ ] All remaining phases planned
- [ ] All plans executed
- [ ] All phases verified (if enabled)
- [ ] ROADMAP.md updated with completion dates
- [ ] STATE.md reflects final state
- [ ] Git history has atomic commits per step
</success_criteria>
