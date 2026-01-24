<trigger>
Use this workflow when:
- Starting a new session on an existing project
- User says "continue", "what's next", "where were we", "resume"
- Any planning operation when .planning/ already exists
- User returns after time away from project
</trigger>

<purpose>
Instantly restore full project context so "Where were we?" has an immediate, complete answer.
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/continuation-format.md
@~/.claude/get-shit-done/references/state-derivation.md
</required_reading>

<process>

<step name="detect_existing_project">
Check if this is an existing project:

```bash
ls .planning/STATE.md 2>/dev/null && echo "Project exists"
ls .planning/ROADMAP.md 2>/dev/null && echo "Roadmap exists"
ls .planning/PROJECT.md 2>/dev/null && echo "Project file exists"
```

**If STATE.md exists:** Proceed to load_state
**If only ROADMAP.md/PROJECT.md exist:** Offer to reconstruct STATE.md
**If .planning/ doesn't exist:** This is a new project - route to /gsd:new-project
</step>

<step name="load_state">

Derive project position from filesystem (parallel-safe), then read context from STATE.md:

```bash
# Derive position from filesystem - parallel-safe, no race conditions
# See state-derivation.md for function implementations
source ~/.claude/get-shit-done/references/state-derivation.md 2>/dev/null || true

CURRENT_PHASE=$(get_current_phase ".planning")
CURRENT_PLAN=$(get_current_plan ".planning/phases/${CURRENT_PHASE}-"*)
PROGRESS=$(get_progress ".planning")

echo "Derived: Phase=$CURRENT_PHASE, Plan=$CURRENT_PLAN, Progress=$PROGRESS"

# Read accumulated context from STATE.md and PROJECT.md
cat .planning/STATE.md
cat .planning/PROJECT.md
```

**From filesystem derivation (source of truth for position):**

- **Current Phase**: First incomplete phase from ROADMAP.md
- **Current Plan**: First PLAN without matching SUMMARY
- **Progress**: Computed from SUMMARY file counts

**From STATE.md (accumulated context, not position):**

- **Project Reference**: Core value and current focus
- **Recent Decisions**: Key decisions affecting current work
- **Pending Todos**: Ideas captured during sessions
- **Blockers/Concerns**: Issues carried forward
- **Session Continuity**: Where we left off, any resume files
- **NOTE:** Position in STATE.md may lag behind filesystem; derivation is authoritative

**From PROJECT.md extract:**

- **What This Is**: Current accurate description
- **Requirements**: Validated, Active, Out of Scope
- **Key Decisions**: Full decision log with outcomes
- **Constraints**: Hard limits on implementation

</step>

<step name="check_incomplete_work">
Look for incomplete work using state derivation (parallel-safe):

```bash
# Use derivation for parallel-safe incomplete plan detection
# This is the same check two terminals can run simultaneously
CURRENT_PLAN=$(get_current_plan ".planning/phases/${CURRENT_PHASE}-"*)
if [ "$CURRENT_PLAN" != "none" ]; then
  echo "Incomplete plan: $CURRENT_PLAN"
fi

# Check for continue-here files (mid-plan resumption)
ls .planning/phases/*/.continue-here*.md 2>/dev/null

# Check for interrupted agents
if [ -f .planning/current-agent-id.txt ] && [ -s .planning/current-agent-id.txt ]; then
  AGENT_ID=$(cat .planning/current-agent-id.txt | tr -d '\n')
  echo "Interrupted agent: $AGENT_ID"
fi
```

**If .continue-here file exists:**

- This is a mid-plan resumption point
- Read the file for specific resumption context
- Flag: "Found mid-plan checkpoint"

**If PLAN without SUMMARY exists:**

- Execution was started but not completed
- Flag: "Found incomplete plan execution"

**If interrupted agent found:**

- Subagent was spawned but session ended before completion
- Read agent-history.json for task details
- Flag: "Found interrupted agent"
  </step>

<step name="present_status">
Present complete project status using derived position (parallel-safe):

```bash
# Use derived values (computed in load_state step)
# These come from state derivation functions, not STATE.md
echo "Phase: $CURRENT_PHASE"
echo "Plan: $CURRENT_PLAN"
echo "Progress: $PROGRESS%"
```

```
╔══════════════════════════════════════════════════════════════╗
║  PROJECT STATUS                                               ║
╠══════════════════════════════════════════════════════════════╣
║  Building: [one-liner from PROJECT.md "What This Is"]         ║
║                                                               ║
║  Phase: [CURRENT_PHASE] - [Phase name from ROADMAP.md]       ║
║  Plan:  [CURRENT_PLAN] - [derived from SUMMARY existence]    ║
║  Progress: [████████░░] [PROGRESS]%                          ║
║                                                               ║
║  Last activity: [date from STATE.md] - [what happened]       ║
╚══════════════════════════════════════════════════════════════╝

[If incomplete work found:]
⚠️  Incomplete work detected:
    - [.continue-here file or incomplete plan]

[If interrupted agent found:]
⚠️  Interrupted agent detected:
    Agent ID: [id]
    Task: [task description from agent-history.json]
    Interrupted: [timestamp]

    Resume with: Task tool (resume parameter with agent ID)

[If pending todos exist:]
📋 [N] pending todos — /gsd:check-todos to review

[If blockers exist:]
⚠️  Carried concerns:
    - [blocker 1]
    - [blocker 2]

[If alignment is not ✓:]
⚠️  Brief alignment: [status] - [assessment]
```

</step>

<step name="determine_next_action">
Based on project state, determine the most logical next action:

**If interrupted agent exists:**
→ Primary: Resume interrupted agent (Task tool with resume parameter)
→ Option: Start fresh (abandon agent work)

**If .continue-here file exists:**
→ Primary: Resume from checkpoint
→ Option: Start fresh on current plan

**If incomplete plan (PLAN without SUMMARY):**
→ Primary: Complete the incomplete plan
→ Option: Abandon and move on

**If phase in progress, all plans complete:**
→ Primary: Transition to next phase
→ Option: Review completed work

**If phase ready to plan:**
→ Check if CONTEXT.md exists for this phase:

- If CONTEXT.md missing:
  → Primary: Discuss phase vision (how user imagines it working)
  → Secondary: Plan directly (skip context gathering)
- If CONTEXT.md exists:
  → Primary: Plan the phase
  → Option: Review roadmap

**If phase ready to execute:**
→ Primary: Execute next plan
→ Option: Review the plan first
</step>

<step name="offer_options">
Present contextual options based on project state:

```
What would you like to do?

[Primary action based on state - e.g.:]
1. Resume interrupted agent [if interrupted agent found]
   OR
1. Execute phase (/gsd:execute-phase {phase})
   OR
1. Discuss Phase 3 context (/gsd:discuss-phase 3) [if CONTEXT.md missing]
   OR
1. Plan Phase 3 (/gsd:plan-phase 3) [if CONTEXT.md exists or discuss option declined]

[Secondary options:]
2. Review current phase status
3. Check pending todos ([N] pending)
4. Review brief alignment
5. Something else
```

**Note:** When offering phase planning, check for CONTEXT.md existence first:

```bash
ls .planning/phases/XX-name/*-CONTEXT.md 2>/dev/null
```

If missing, suggest discuss-phase before plan. If exists, offer plan directly.

Wait for user selection.
</step>

<step name="route_to_workflow">
Based on user selection, route to appropriate workflow:

- **Execute plan** → Show command for user to run after clearing:
  ```
  ---

  ## ▶ Next Up

  **{phase}-{plan}: [Plan Name]** — [objective from PLAN.md]

  `/gsd:execute-phase {phase}`

  <sub>`/clear` first → fresh context window</sub>

  ---
  ```
- **Plan phase** → Show command for user to run after clearing:
  ```
  ---

  ## ▶ Next Up

  **Phase [N]: [Name]** — [Goal from ROADMAP.md]

  `/gsd:plan-phase [phase-number]`

  <sub>`/clear` first → fresh context window</sub>

  ---

  **Also available:**
  - `/gsd:discuss-phase [N]` — gather context first
  - `/gsd:research-phase [N]` — investigate unknowns

  ---
  ```
- **Transition** → ./transition.md
- **Check todos** → Read .planning/todos/pending/, present summary
- **Review alignment** → Read PROJECT.md, compare to current state
- **Something else** → Ask what they need
</step>

<step name="update_session">
Before proceeding to routed workflow, update session continuity:

Update STATE.md:

```markdown
## Session Continuity

Last session: [now]
Stopped at: Session resumed, proceeding to [action]
Resume file: [updated if applicable]
```

This ensures if session ends unexpectedly, next resume knows the state.
</step>

</process>

<reconstruction>
If STATE.md is missing but other artifacts exist:

"STATE.md missing. Deriving state from filesystem..."

**Primary approach (v1.11+): State derivation**

Position and progress can be derived directly from filesystem without STATE.md:

```bash
# Derive state - no STATE.md needed for position
CURRENT_PHASE=$(get_current_phase ".planning")
CURRENT_PLAN=$(get_current_plan ".planning/phases/${CURRENT_PHASE}-"*)
PROGRESS=$(get_progress ".planning")
DECISIONS=$(get_decisions ".planning")
BLOCKERS=$(get_blockers ".planning")
```

This is parallel-safe and works even if STATE.md is corrupted or missing.

**Secondary: Reconstruct STATE.md for human reference**

1. Read PROJECT.md → Extract "What This Is" and Core Value
2. Use derivation → Get current position from SUMMARY existence
3. Scan \*-SUMMARY.md files → Extract decisions, concerns
4. Count pending todos in .planning/todos/pending/
5. Check for .continue-here files → Session continuity

Reconstruct and write STATE.md for human reference, but execution position comes from derivation.

This handles cases where:

- Project predates STATE.md introduction
- File was accidentally deleted
- Cloning repo without full .planning/ state
- Two sessions wrote to STATE.md simultaneously (cosmetic corruption)
  </reconstruction>

<quick_resume>
If user says "continue" or "go":
- Load state silently
- Determine primary action
- Execute immediately without presenting options

"Continuing from [state]... [action]"
</quick_resume>

<success_criteria>
Resume is complete when:

- [ ] STATE.md loaded (or reconstructed)
- [ ] Incomplete work detected and flagged
- [ ] Clear status presented to user
- [ ] Contextual next actions offered
- [ ] User knows exactly where project stands
- [ ] Session continuity updated
      </success_criteria>
