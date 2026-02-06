---
name: gsdf:plan-phase
description: Token-optimized phase planning with conditional skill loading
argument-hint: "[phase] [--research] [--skip-research] [--gaps] [--skip-verify]"
agent: gsd-planner-core
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
Token-optimized version of /gsd:plan-phase.

**Key difference:** Loads planner skills conditionally instead of monolithic agent prompt.

**Default flow:** Research (if needed) → Plan → Verify → Done
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

## 1. Validate Environment

```bash
ls .planning/ 2>/dev/null
```

**If not found:** Error - user should run `/gsd:new-project` first.

**Resolve GSDF model profile:**
```bash
# GSDF uses model_profile_gsdf (falls back to model_profile, then "balanced")
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**GSDF planner model lookup:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-planner-core | opus | opus | sonnet |
| gsd-plan-checker | sonnet | sonnet | haiku |

## 2. Parse Arguments

Extract from $ARGUMENTS:
- Phase number (integer or decimal like `2.1`)
- `--research`, `--skip-research`, `--gaps`, `--skip-verify` flags

**If no phase number:** Detect next unplanned phase from roadmap.

**Normalize phase:**
```bash
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

## 4. Ensure Phase Directory and Load CONTEXT.md

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
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

## 5. Handle Research

**If `--gaps` flag:** Skip research (gap closure uses VERIFICATION.md instead).

**If `--skip-research` flag:** Skip to step 6.

**Check config for research setting:**
```bash
WORKFLOW_RESEARCH=$(cat .planning/config.json 2>/dev/null | grep -o '"research"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
```

**If `workflow.research` is `false` AND `--research` flag NOT set:** Skip to step 6.

**Otherwise:**

```bash
ls "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null
```

**If RESEARCH.md exists AND `--research` flag NOT set:** Use existing research, skip to step 6.

**If RESEARCH.md missing OR `--research` flag set:** Spawn official gsd-phase-researcher (research is already lean enough).

## 6. Check Existing Plans

```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null
```

**If exists:** Offer: 1) Continue planning (add more plans), 2) View existing, 3) Replan from scratch. Wait for response.

## 7. Determine Required Skills

**Analyze phase to determine which skills to load:**

```bash
# Check for gap closure mode
NEEDS_GAP_CLOSURE=false
[[ "$FLAGS" == *"--gaps"* ]] && NEEDS_GAP_CLOSURE=true

# Check for TDD in context/requirements
NEEDS_TDD=false
grep -qi "tdd\|test.driven" "${PHASE_DIR}"/*-CONTEXT.md .planning/REQUIREMENTS.md 2>/dev/null && NEEDS_TDD=true

# Check for checkpoints in context/requirements
NEEDS_CHECKPOINTS=false
grep -qi "checkpoint\|verify\|visual\|ui.check" "${PHASE_DIR}"/*-CONTEXT.md .planning/REQUIREMENTS.md 2>/dev/null && NEEDS_CHECKPOINTS=true

# Check for external services requiring user setup
NEEDS_USER_SETUP=false
grep -qiE "stripe|twilio|oauth|sendgrid|aws|gcp|firebase|supabase" "${PHASE_DIR}"/*-CONTEXT.md .planning/REQUIREMENTS.md 2>/dev/null && NEEDS_USER_SETUP=true

# Check for discovery-heavy phases
NEEDS_DISCOVERY=false
grep -qi "research\|explore\|investigate\|spike\|proof.of.concept" "${PHASE_DIR}"/*-CONTEXT.md .planning/REQUIREMENTS.md 2>/dev/null && NEEDS_DISCOVERY=true

# Revision mode determined by checker feedback (step 12)
```

## 8. Build Context

Read and store context file contents:

```bash
STATE_CONTENT=$(cat .planning/STATE.md)
ROADMAP_CONTENT=$(cat .planning/ROADMAP.md)
REQUIREMENTS_CONTENT=$(cat .planning/REQUIREMENTS.md 2>/dev/null)
# CONTEXT_CONTENT already loaded in step 4
RESEARCH_CONTENT=$(cat "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null)

# Gap closure files (only if --gaps mode)
VERIFICATION_CONTENT=$(cat "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null)
UAT_CONTENT=$(cat "${PHASE_DIR}"/*-UAT.md 2>/dev/null)
```

## 9. Build Skill Includes

**Conditionally include skills based on detected needs:**

```markdown
SKILL_INCLUDES=""

if $NEEDS_GAP_CLOSURE; then
  SKILL_INCLUDES+="
--- GAP CLOSURE SKILL ---
$(cat ~/.claude/skills/planner/gap-closure.md)
"
fi

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

if $NEEDS_USER_SETUP; then
  SKILL_INCLUDES+="
--- USER SETUP SKILL ---
$(cat ~/.claude/skills/planner/user-setup.md)
"
fi

if $NEEDS_DISCOVERY; then
  SKILL_INCLUDES+="
--- DISCOVERY SKILL ---
$(cat ~/.claude/skills/planner/discovery.md)
"
fi
```

## 10. Spawn Lean Planner

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PLANNING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning lean planner...
◆ Skills loaded: {list of loaded skills or "core only"}
```

Build prompt:

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

{skill_includes}

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

Pre-read agent core (inline into prompt, no wasted turn):
```bash
PLANNER_CORE=$(cat ~/.claude/agents/gsd-planner-core.md)
```

```
Task(
  prompt="${PLANNER_CORE}\n\n" + filled_prompt,
  subagent_type="general-purpose",
  model="{planner_model}",
  description="Plan Phase {phase} (lite)"
)
```

## 11. Handle Planner Return

**`## PLANNING COMPLETE`:**
- Display: `Planner created {N} plan(s). Files on disk.`
- If `--skip-verify`: Skip to step 14
- Check config: `WORKFLOW_PLAN_CHECK=$(cat .planning/config.json 2>/dev/null | grep -o '"plan_check"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")`
- If `workflow.plan_check` is `false`: Skip to step 14
- Otherwise: Proceed to verification

**`## CHECKPOINT REACHED`:**
- Present to user, get response

**`## PLANNING INCONCLUSIVE`:**
- Show what was attempted
- Offer: Add context, Retry, Manual
- Wait for user response

## 12. Verification (Use Official Checker)

Spawn official gsd-plan-checker with CONTEXT.md semantics:

Read plans for the checker:
```bash
PLANS_CONTENT=$(cat "${PHASE_DIR}"/*-PLAN.md 2>/dev/null)
```

Include in checker prompt:
```markdown
IMPORTANT: If phase context exists, plans MUST honor user decisions.
- **Decisions** = LOCKED — plans must implement these exactly
- **Claude's Discretion** = Freedom areas — plans can choose approach
- **Deferred Ideas** = Out of scope — plans must NOT include these
```

## 13. Revision Loop (Max 3 Iterations)

**If checker finds issues and iteration_count < 3:**

Add revision skill and re-spawn planner:

```markdown
SKILL_INCLUDES+="
--- REVISION SKILL ---
$(cat ~/.claude/skills/planner/revision.md)
"
```

Spawn with revision context:

```markdown
<revision_context>

**Phase:** {phase_number}
**Mode:** revision

**Existing plans:**
{plans_content}

**Checker issues:**
{structured_issues_from_checker}

**Phase Context (if exists):**

IMPORTANT: Revisions MUST still honor user decisions from CONTEXT.md.

{context_content}

</revision_context>

{skill_includes}
```

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain:`
- List remaining issues

Offer options:
1. Force proceed (execute despite issues)
2. Provide guidance (user gives direction, retry)
3. Abandon (exit planning)

## 14. Present Final Status

</process>

<offer_next>
Output this markdown directly:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PHASE {X} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} plan(s) in {M} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}
Skills loaded: {list or "core only"}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute Phase {X}** — run all {N} plans

/gsdf:execute-phase {X}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase-dir}/*-PLAN.md — review plans
- /gsdf:plan-phase {X} --research — re-research first

───────────────────────────────────────────────────────────────
</offer_next>

<token_comparison>

## Estimated Token Savings

| Scenario | Official | Lite | Savings |
|----------|----------|------|---------|
| Standard plan (no extras) | ~1,387 lines | ~600 lines | ~57% |
| With checkpoints | ~1,387 lines | ~700 lines | ~50% |
| Gap closure only | ~1,387 lines | ~675 lines | ~51% |
| Revision mode | ~1,387 lines | ~715 lines | ~48% |
| Full (all skills) | ~1,387 lines | ~900 lines | ~35% |

**Per revision iteration:** Savings compound (3 iterations = 3x savings)

</token_comparison>

<success_criteria>
- [ ] .planning/ directory validated
- [ ] Phase validated against roadmap
- [ ] CONTEXT.md loaded early (step 4) and passed to ALL agents
- [ ] Research config toggle checked
- [ ] Existing plans checked before spawning planner
- [ ] Skills detected and loaded conditionally
- [ ] gsd-planner-core spawned with CONTEXT.md semantics + downstream_consumer
- [ ] Plans created (PLANNING COMPLETE or CHECKPOINT/INCONCLUSIVE handled)
- [ ] Verification passed (unless skipped) with CONTEXT.md compliance
- [ ] Max iterations handled with user options
- [ ] Token savings achieved
</success_criteria>
