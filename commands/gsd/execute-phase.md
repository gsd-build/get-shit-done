---
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---

<objective>
Execute all plans in a phase using wave-based parallel execution.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/references/planning-config.md
</execution_context>

<context>
Phase: $ARGUMENTS

**Flags:**
- `--gaps-only` — Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.

@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>
0. **Resolve Model Profile**

   Read model profile for agent spawning:
   ```bash
   MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
   ```

   Default to "balanced" if not set.

   **Model lookup table:**

   | Agent | quality | balanced | budget |
   |-------|---------|----------|--------|
   | gsd-executor | opus | sonnet | sonnet |
   | gsd-verifier | sonnet | sonnet | haiku |
   | gsd-adversary | sonnet | sonnet | haiku |

   Store resolved models for use in Task calls below.

1. **Validate phase exists**
   - Find phase directory matching argument
   - Count PLAN.md files
   - Error if no plans found

2. **Discover plans**
   - List all *-PLAN.md files in phase directory
   - Check which have *-SUMMARY.md (already complete)
   - If `--gaps-only`: filter to only plans with `gap_closure: true`
   - Build list of incomplete plans

3. **Group by wave**
   - Read `wave` from each plan's frontmatter
   - Group plans by wave number
   - Report wave structure to user

4. **Execute waves**
   For each wave in order:
   - Spawn `gsd-executor` for each plan in wave (parallel Task calls)
   - Wait for completion (Task blocks)
   - Verify SUMMARYs created
   - Proceed to next wave

5. **Aggregate results**
   - Collect summaries from all plans
   - Report phase completion status

6. **Commit any orchestrator corrections**
   Check for uncommitted changes before verification:
   ```bash
   git status --porcelain
   ```

   **If changes exist:** Orchestrator made corrections between executor completions. Commit them:
   ```bash
   git add -u && git commit -m "fix({phase}): orchestrator corrections"
   ```

   **If clean:** Continue to verification.

7. **Verify phase goal**
   Check config: `WORKFLOW_VERIFIER=$(cat .planning/config.json 2>/dev/null | grep -o '"verifier"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")`

   **If `workflow.verifier` is `false`:** Skip to step 8 (treat as passed). This skips both verification and adversary review, since there is no VERIFICATION.md to challenge.

   **Otherwise:**
   - Spawn `gsd-verifier` subagent with phase directory and goal
   - Verifier checks must_haves against actual codebase (not SUMMARY claims)
   - Creates VERIFICATION.md with detailed report

   Continue to step 7.5 (adversary review). Status routing happens after adversary review.

7.5. **Adversary Review — Verification**

   **Read adversary config:**

   ```bash
   CHECKPOINT_NAME="verification"
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

   **Skip conditions** (skip to status routing below):
   - `CHECKPOINT_ENABLED = "false"` — adversary disabled for verification checkpoint
   - VERIFICATION.md has `re_verification:` metadata — gap-closure re-check, not initial verification. Adversary adds friction without proportional value for targeted re-checks.
   - Verification status is already `gaps_found` — verifier already found problems, adversary redundant. The gaps speak for themselves.

   **If CHECKPOINT_ENABLED = "true" AND initial verification AND status is `passed` or `human_needed`:**

   Display banner:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GSD ► ADVERSARY REVIEW
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ◆ Reviewing verification conclusions...
   ```

   Set `ADVERSARY_RAN_VERIFICATION=true`.

   **Debate loop:**

   Initialize: `ROUND=1`, `CONVERGED=false`, `VERIFICATION_REVISED=false`

   While ROUND <= EFFECTIVE_MAX_ROUNDS AND not CONVERGED:

   1. **Read artifact from disk** (re-read each round to get latest after verifier revision):
      ```bash
      ARTIFACT_CONTENT=$(cat "$PHASE_DIR"/*-VERIFICATION.md)
      PROJECT_CONTEXT=$(head -50 .planning/PROJECT.md)
      ```

   2. **Spawn adversary:**

      **Round 1:**
      ```
      Task(prompt="First, read ~/.claude/agents/gsd-adversary.md for your role and instructions.

      <artifact_type>verification</artifact_type>

      <artifact_content>
      {ARTIFACT_CONTENT}
      </artifact_content>

      <round>1</round>
      <max_rounds>{EFFECTIVE_MAX_ROUNDS}</max_rounds>

      <project_context>
      {PROJECT_CONTEXT}
      </project_context>
      ", subagent_type="gsd-adversary", model="{adversary_model}", description="Adversary review: verification (round 1)")
      ```

      **Round > 1:**
      ```
      Task(prompt="First, read ~/.claude/agents/gsd-adversary.md for your role and instructions.

      <artifact_type>verification</artifact_type>

      <artifact_content>
      {ARTIFACT_CONTENT — re-read from disk after verifier revision}
      </artifact_content>

      <round>{ROUND}</round>
      <max_rounds>{EFFECTIVE_MAX_ROUNDS}</max_rounds>

      <defense>
      {DEFENSE — built from verifier's re-analysis return}
      </defense>

      <previous_challenges>
      {PREV_CHALLENGES — adversary's challenges from previous round}
      </previous_challenges>

      <project_context>
      {PROJECT_CONTEXT}
      </project_context>
      ", subagent_type="gsd-adversary", model="{adversary_model}", description="Adversary review: verification (round {ROUND})")
      ```

   3. **Parse adversary response:**
      - Extract challenges (title, severity, concern, evidence, affected)
      - Extract convergence recommendation (CONTINUE/CONVERGE)

   4. **Check convergence:** If adversary recommends CONVERGE and ROUND > 1:
      - Set `CONVERGED=true`
      - Break

   5. **Handle challenges** (if ROUND < EFFECTIVE_MAX_ROUNDS):

      **If BLOCKING challenges exist — Verifier-as-defender pattern:**

      Re-spawn gsd-verifier in adversary_revision mode to re-examine specific conclusions. Do NOT edit VERIFICATION.md inline as the orchestrator — the verifier has verification domain knowledge for higher-quality re-analysis.

      ```
      Task(prompt="First, read ~/.claude/agents/gsd-verifier.md for your role and instructions.

      <revision_context>

      **Phase:** {phase_number}
      **Phase directory:** {phase_dir}
      **Mode:** adversary_revision

      **Current VERIFICATION.md:**
      {current VERIFICATION.md content from disk}

      **Adversary challenges:**
      {adversary's full challenge output — not a summary}

      **Challenge handling instructions:**
      - BLOCKING: Re-examine the specific truths/artifacts/links challenged. Update conclusions if evidence supports the challenge.
      - MAJOR: Re-examine if warranted, note rationale if not.
      - MINOR: Note without re-examination (typically).

      </revision_context>

      <instructions>
      Re-examine specific verification conclusions challenged by the adversary.
      Focus on the truths/artifacts/links cited in BLOCKING challenges.
      Update VERIFICATION.md with revised conclusions where evidence supports the challenge.
      Return what changed: which conclusions were revised and why, which challenges were rejected with evidence.
      Do NOT re-run full verification. Target only challenged conclusions.
      </instructions>
      ", subagent_type="gsd-verifier", model="{verifier_model}", description="Re-examine verification conclusions (adversary feedback)")
      ```

      After verifier returns:
      - Build `DEFENSE` text from verifier's return (which conclusions revised + which maintained with evidence)
      - Store `PREV_CHALLENGES` = adversary's full challenge output from this round
      - Set `VERIFICATION_REVISED=true`

      **If MAJOR/MINOR only (no BLOCKING):** At Claude's discretion, may note without re-spawning verifier. Build defense text noting the rationale. Store `PREV_CHALLENGES`.

   6. Increment ROUND

   **Display summary:**

   After loop completes, display adversary review summary:

   ```
   ✓ Adversary review complete

   **Challenges:**
   - ✓ **[SEVERITY]** {challenge title} — Addressed: {what changed}
   - ○ **[SEVERITY]** {challenge title} — Noted: {rationale}
   - ⚠ **[SEVERITY]** {challenge title} — Unresolved: {why}
   ```

   Use `✓` for addressed challenges, `○` for noted/minor challenges, `⚠` for unresolved challenges remaining at max rounds.

   **Status routing (re-read after adversary review):**

   Re-read verification status from disk — it may have changed during adversary review if the verifier re-examined and downgraded conclusions:

   ```bash
   VERIFICATION_STATUS=$(grep "^status:" "$PHASE_DIR"/*-VERIFICATION.md | cut -d: -f2 | tr -d ' ')
   ```

   Route by VERIFICATION_STATUS:
   - `passed` → continue to step 8
   - `human_needed` → present items needing human verification, get approval or feedback
   - `gaps_found` → present gaps, offer `/gsd:plan-phase {X} --gaps`

8. **Update roadmap and state**
   - Update ROADMAP.md, STATE.md

9. **Update requirements**
   Mark phase requirements as Complete:
   - Read ROADMAP.md, find this phase's `Requirements:` line (e.g., "AUTH-01, AUTH-02")
   - Read REQUIREMENTS.md traceability table
   - For each REQ-ID in this phase: change Status from "Pending" to "Complete"
   - Write updated REQUIREMENTS.md
   - Skip if: REQUIREMENTS.md doesn't exist, or phase has no Requirements line

10. **Commit phase completion**
    Check `COMMIT_PLANNING_DOCS` from config.json (default: true).
    If false: Skip git operations for .planning/ files.
    If true: Bundle all phase metadata updates in one commit:
    - Stage: `git add .planning/ROADMAP.md .planning/STATE.md`
    - Stage REQUIREMENTS.md if updated: `git add .planning/REQUIREMENTS.md`
    - Commit: `docs({phase}): complete {phase-name} phase`

11. **Offer next steps**
    - Route to next action (see `<offer_next>`)
</process>

<offer_next>
Output this markdown directly (not as a code block). Route based on status:

| Status | Route |
|--------|-------|
| `gaps_found` | Route C (gap closure) |
| `human_needed` | Present checklist, then re-route based on approval |
| `passed` + more phases | Route A (next phase) |
| `passed` + last phase | Route B (milestone complete) |

---

**Route A: Phase verified, more phases remain**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {Z} COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

{Y} plans executed
Goal verified ✓
Adversary reviewed: verification    *(only if adversary ran)*

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}

/gsd:discuss-phase {Z+1} — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsd:plan-phase {Z+1} — skip discussion, plan directly
- /gsd:verify-work {Z} — manual acceptance testing before continuing

───────────────────────────────────────────────────────────────

---

**Route B: Phase verified, milestone complete**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**v1.0**

{N} phases completed
All phase goals verified ✓
Adversary reviewed: verification    *(only if adversary ran)*

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Audit milestone** — verify requirements, cross-phase integration, E2E flows

/gsd:audit-milestone

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsd:verify-work — manual acceptance testing
- /gsd:complete-milestone — skip audit, archive directly

───────────────────────────────────────────────────────────────

---

**Route C: Gaps found — need additional planning**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {Z} GAPS FOUND ⚠
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

Score: {N}/{M} must-haves verified
Report: .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

### What's Missing

{Extract gap summaries from VERIFICATION.md}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan gap closure** — create additional plans to complete the phase

/gsd:plan-phase {Z} --gaps

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase_dir}/{phase}-VERIFICATION.md — see full report
- /gsd:verify-work {Z} — manual testing before planning

───────────────────────────────────────────────────────────────

---

After user runs /gsd:plan-phase {Z} --gaps:
1. Planner reads VERIFICATION.md gaps
2. Creates plans 04, 05, etc. to close gaps
3. User runs /gsd:execute-phase {Z} again
4. Execute-phase runs incomplete plans (04, 05...)
5. Verifier runs again → loop until passed
</offer_next>

<wave_execution>
**Parallel spawning:**

Before spawning, read file contents. The `@` syntax does not work across Task() boundaries.

```bash
# Read each plan and STATE.md
PLAN_01_CONTENT=$(cat "{plan_01_path}")
PLAN_02_CONTENT=$(cat "{plan_02_path}")
PLAN_03_CONTENT=$(cat "{plan_03_path}")
STATE_CONTENT=$(cat .planning/STATE.md)
```

Spawn all plans in a wave with a single message containing multiple Task calls, with inlined content:

```
Task(prompt="Execute plan at {plan_01_path}\n\nPlan:\n{plan_01_content}\n\nProject state:\n{state_content}", subagent_type="gsd-executor", model="{executor_model}")
Task(prompt="Execute plan at {plan_02_path}\n\nPlan:\n{plan_02_content}\n\nProject state:\n{state_content}", subagent_type="gsd-executor", model="{executor_model}")
Task(prompt="Execute plan at {plan_03_path}\n\nPlan:\n{plan_03_content}\n\nProject state:\n{state_content}", subagent_type="gsd-executor", model="{executor_model}")
```

All three run in parallel. Task tool blocks until all complete.

**No polling.** No background agents. No TaskOutput loops.
</wave_execution>

<checkpoint_handling>
Plans with `autonomous: false` have checkpoints. The execute-phase.md workflow handles the full checkpoint flow:
- Subagent pauses at checkpoint, returns structured state
- Orchestrator presents to user, collects response
- Spawns fresh continuation agent (not resume)

See `@~/.claude/get-shit-done/workflows/execute-phase.md` step `checkpoint_handling` for complete details.
</checkpoint_handling>

<deviation_rules>
During execution, handle discoveries automatically:

1. **Auto-fix bugs** - Fix immediately, document in Summary
2. **Auto-add critical** - Security/correctness gaps, add and document
3. **Auto-fix blockers** - Can't proceed without fix, do it and document
4. **Ask about architectural** - Major structural changes, stop and ask user

Only rule 4 requires user intervention.
</deviation_rules>

<commit_rules>
**Per-Task Commits:**

After each task completes:
1. Stage only files modified by that task
2. Commit with format: `{type}({phase}-{plan}): {task-name}`
3. Types: feat, fix, test, refactor, perf, chore
4. Record commit hash for SUMMARY.md

**Plan Metadata Commit:**

After all tasks in a plan complete:
1. Stage plan artifacts only: PLAN.md, SUMMARY.md
2. Commit with format: `docs({phase}-{plan}): complete [plan-name] plan`
3. NO code files (already committed per-task)

**Phase Completion Commit:**

After all plans in phase complete (step 7):
1. Stage: ROADMAP.md, STATE.md, REQUIREMENTS.md (if updated), VERIFICATION.md
2. Commit with format: `docs({phase}): complete {phase-name} phase`
3. Bundles all phase-level state updates in one commit

**NEVER use:**
- `git add .`
- `git add -A`
- `git add src/` or any broad directory

**Always stage files individually.**
</commit_rules>

<success_criteria>
- [ ] All incomplete plans in phase executed
- [ ] Each plan has SUMMARY.md
- [ ] Phase goal verified (must_haves checked against codebase)
- [ ] VERIFICATION.md created in phase directory
- [ ] Adversary reviewed verification conclusions (if enabled)
- [ ] Verification status re-read after adversary review for accurate routing
- [ ] STATE.md reflects phase completion
- [ ] ROADMAP.md updated
- [ ] REQUIREMENTS.md updated (phase requirements marked Complete)
- [ ] User informed of next steps
</success_criteria>
