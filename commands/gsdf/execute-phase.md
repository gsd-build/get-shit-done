---
name: gsdf:execute-phase
description: Token-optimized phase execution with conditional skill loading
argument-hint: "<phase-number> [--gaps-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
---

<objective>
Token-optimized version of /gsd:execute-phase.

**Key difference:** Loads executor skills conditionally based on plan type.
</objective>

<context>
Phase: $ARGUMENTS

**Flags:**
- `--gaps-only` — Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.

@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>

## 1. Validate Environment

```bash
ls .planning/ 2>/dev/null || echo "ERROR: No .planning directory"
```

**Resolve GSDF model profile:**
```bash
# GSDF uses model_profile_gsdf (falls back to model_profile, then "balanced")
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**GSDF executor model lookup:**

| Profile | gsd-executor-core | gsd-verifier |
|---------|-------------------|--------------|
| quality | sonnet | sonnet |
| balanced | sonnet | sonnet |
| budget | haiku | haiku |

## 2. Parse Arguments

```bash
PHASE="$ARGUMENTS"
# Extract --gaps-only flag
GAPS_ONLY=false
[[ "$PHASE" == *"--gaps-only"* ]] && GAPS_ONLY=true
PHASE=$(echo "$PHASE" | sed 's/--gaps-only//g' | xargs)
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  PHASE=$(printf "%02d" "$PHASE")
fi
```

## 3. Find Phase Directory

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null
```

## 4. Discover Plans

- List all *-PLAN.md files in phase directory
- Check which have *-SUMMARY.md (already complete)
- **If `--gaps-only`:** filter to only plans with `gap_closure: true`
- Build list of incomplete plans

## 5. Analyze Plans for Skill Requirements

```bash
# Check for checkpoints
HAS_CHECKPOINTS=false
grep -q "checkpoint:" "$PHASE_DIR"/*-PLAN.md 2>/dev/null && HAS_CHECKPOINTS=true

# Check for TDD plans
HAS_TDD=false
grep -q "type: tdd" "$PHASE_DIR"/*-PLAN.md 2>/dev/null && HAS_TDD=true

# Check for external services
HAS_AUTH_GATES=false
grep -qiE "stripe|twilio|oauth|sendgrid|aws|gcp" "$PHASE_DIR"/*-PLAN.md 2>/dev/null && HAS_AUTH_GATES=true

# Check for continuation context (prior completed plans in phase)
HAS_CONTINUATION=false
ls "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null && HAS_CONTINUATION=true
```

## 6. Build Skill Includes

```markdown
# Always load deviation rules for executors
SKILL_INCLUDES="
--- DEVIATION RULES SKILL ---
$(cat ~/.claude/skills/executor/deviation-rules.md)
"

if $HAS_CHECKPOINTS; then
  SKILL_INCLUDES+="
--- CHECKPOINTS SKILL ---
$(cat ~/.claude/skills/executor/checkpoints.md)
"
fi

if $HAS_TDD; then
  SKILL_INCLUDES+="
--- TDD SKILL ---
$(cat ~/.claude/skills/executor/tdd.md)
"
fi

if $HAS_AUTH_GATES; then
  SKILL_INCLUDES+="
--- AUTH GATES SKILL ---
$(cat ~/.claude/skills/executor/auth-gates.md)
"
fi

if $HAS_CONTINUATION; then
  SKILL_INCLUDES+="
--- CONTINUATION SKILL ---
$(cat ~/.claude/skills/executor/continuation.md)
"
fi
```

## 7. Group Plans by Wave

Parse `wave:` from each plan frontmatter. Execute waves sequentially, plans within wave in parallel.

## 8. Execute Each Wave

For each wave:

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► EXECUTING WAVE {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Plans in wave: {list}
◆ Skills loaded: {list or "core only"}
```

Before spawning, read file contents. The `@` syntax does not work across Task() boundaries.

```bash
EXECUTOR_CORE=$(cat ~/.claude/agents/gsd-executor-core.md)
PLAN_CONTENT=$(cat "{plan_path}")
STATE_CONTENT=$(cat .planning/STATE.md)
```

Spawn parallel executors:

```markdown
Task(
  prompt="${EXECUTOR_CORE}\n\n{skill_includes}\n\n<plan>\n{plan_content}\n</plan>\n\nProject state:\n{state_content}",
  subagent_type="general-purpose",
  model="{executor_model}",
  description="Execute plan {phase}-{NN}"
)
```

## 9. Handle Returns

For each executor return:
- **PLAN COMPLETE:** Record success, continue
- **CHECKPOINT REACHED:** Present to user, get response, continue with response
- **EXECUTION BLOCKED:** Present issue, get resolution

## 10. Commit Orchestrator Corrections

Check for uncommitted changes between executor completions:
```bash
git status --porcelain
```

**If changes exist:** Commit them:
```bash
git add -u && git commit -m "fix({phase}): orchestrator corrections"
```

## 11. Verify Phase Goal

Check config: `WORKFLOW_VERIFIER=$(cat .planning/config.json 2>/dev/null | grep -o '"verifier"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")`

**If `workflow.verifier` is `false`:** Skip to step 12 (treat as passed).

**Otherwise:**
- Spawn verifier subagent with phase directory and goal
- Verifier checks must_haves against actual codebase
- Creates VERIFICATION.md
- Route by status:
  - `passed` → continue to step 12
  - `human_needed` → present items, get approval or feedback
  - `gaps_found` → present gaps, offer `/gsdf:plan-phase {X} --gaps`

## 12. Update Roadmap, State, and Requirements

- Update ROADMAP.md, STATE.md
- **Update REQUIREMENTS.md:** Mark phase requirements as Complete:
  - Read ROADMAP.md, find this phase's `Requirements:` line
  - Read REQUIREMENTS.md traceability table
  - For each REQ-ID in this phase: change Status from "Pending" to "Complete"
  - Write updated REQUIREMENTS.md
  - Skip if: REQUIREMENTS.md doesn't exist, or phase has no Requirements line

## 13. Commit Phase Completion

Check `COMMIT_PLANNING_DOCS` from config.json (default: true):
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

If false: Skip git operations for .planning/ files.
If true: Bundle all phase metadata updates in one commit:
- Stage: `git add .planning/ROADMAP.md .planning/STATE.md`
- Stage REQUIREMENTS.md if updated: `git add .planning/REQUIREMENTS.md`
- Commit: `docs({phase}): complete {phase-name} phase`

## 14. Present Final Status

</process>

<!-- Deviation rules and commit protocol: loaded via skills/executor/deviation-rules.md and defined in gsd-executor-core agent -->

<offer_next>
Output this markdown directly. Route based on status:

| Status | Route |
|--------|-------|
| `gaps_found` | Route C (gap closure) |
| `human_needed` | Present checklist, then re-route based on approval |
| `passed` + more phases | Route A (next phase) |
| `passed` + last phase | Route B (milestone complete) |

---

**Route A: Phase verified, more phases remain**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PHASE {Z} COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

{Y} plans executed
Goal verified ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}

/gsd:discuss-phase {Z+1} — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsdf:plan-phase {Z+1} — skip discussion, plan directly
- /gsd:verify-work {Z} — manual acceptance testing before continuing

───────────────────────────────────────────────────────────────

---

**Route B: Phase verified, milestone complete**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► MILESTONE COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{N} phases completed
All phase goals verified ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Audit milestone** — verify requirements, cross-phase integration, E2E flows

/gsdf:audit-milestone

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsd:verify-work — manual acceptance testing
- /gsd:complete-milestone — skip audit, archive directly

───────────────────────────────────────────────────────────────

---

**Route C: Gaps found — need additional planning**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PHASE {Z} GAPS FOUND ⚠
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

Score: {N}/{M} must-haves verified
Report: .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

### What's Missing

{Extract gap summaries from VERIFICATION.md}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan gap closure** — create additional plans to complete the phase

/gsdf:plan-phase {Z} --gaps

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase_dir}/{phase}-VERIFICATION.md — see full report
- /gsd:verify-work {Z} — manual testing before planning

───────────────────────────────────────────────────────────────

---

After user runs /gsdf:plan-phase {Z} --gaps:
1. Planner reads VERIFICATION.md gaps
2. Creates plans 04, 05, etc. to close gaps
3. User runs /gsdf:execute-phase {Z} again
4. Execute-phase runs incomplete plans (04, 05...)
5. Verifier runs again → loop until passed
</offer_next>

<success_criteria>
- [ ] Phase directory found with plans
- [ ] --gaps-only filtering applied (if flag set)
- [ ] Skills detected and loaded conditionally
- [ ] Plans grouped by wave
- [ ] Each wave executed (parallel within wave)
- [ ] All plans completed or checkpoints handled
- [ ] Orchestrator corrections committed
- [ ] Verifier config checked and run (if enabled)
- [ ] REQUIREMENTS.md updated (phase requirements marked Complete)
- [ ] Phase completion committed (if commit_docs enabled)
- [ ] Phase completion reported with correct routing
</success_criteria>
