<purpose>
Detect current project state and automatically advance to the next logical GSD workflow step.
Reads project state to determine: discuss → plan → execute → verify → complete progression.
Includes hard-stop safety checks at milestone boundaries, error states, verification gaps,
and unresolved checkpoints. Guards against runaway automation with a consecutive-call budget.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="banner">
Display the GSD stage banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► NEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="detect_state">
Read project state to determine current position:

```bash
# Get state snapshot
STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state json 2>/dev/null || echo "{}")
```

Also read inline (not via Task):
- `.planning/STATE.md` — current phase, progress, status, last_command
- `.planning/ROADMAP.md` — milestone structure and phase list

Extract:
- `current_phase` — which phase is active
- `plan_of` / `plans_total` — plan execution progress
- `progress` — overall percentage
- `status` — planning, executing, verifying, complete, paused
- `stopped_at` — phase/plan identifier or null
- `last_command` — last command invoked (used by consecutive guard)

If no `.planning/` directory exists:
```
No GSD project detected. Run `/gsd-new-project` to get started.
```
Exit.
</step>

<step name="consecutive_guard">
Implement consecutive-call budget guard to prevent runaway automation.

1. Read `last_command` from STATE.md frontmatter:
   ```bash
   grep "last_command:" .planning/STATE.md 2>/dev/null || echo ""
   ```

2. If `last_command` contains "next", increment CONSECUTIVE_COUNT.
   Track the count by checking recent git log or STATE.md session entries for consecutive `/gsd-next` invocations.

3. If CONSECUTIVE_COUNT >= 6:
   Ask via AskUserQuestion:
   - header: "Budget"
   - question: "You've run /gsd-next 6+ times consecutively. Continue anyway?"
   - options:
     - "Yes" — Proceed (warn but allow)
     - "No" — Pause and show /gsd-progress

   If **no**: display "Pausing. Run `/gsd-progress` to see current state." and exit.

4. If any other command found as last_command: CONSECUTIVE_COUNT = 0, proceed normally.
</step>

<step name="check_hard_stops">
Before routing, evaluate hard-stop conditions. If any trigger, STOP and display the issue. Do NOT route to the next command.

**HARD STOP 1 — Unresolved checkpoint:**
```bash
ls .planning/phases/*-*/.continue-here.md 2>/dev/null
```
If a `.continue-here.md` file is found in any phase directory:
- Read and display its contents.
- Message: `GSD > Unresolved checkpoint found. Resolve it before continuing.`
- Exit.

**HARD STOP 2 — Error state:**
If `status` contains "error" OR `stopped_at` contains "ERROR":
- Display error details from STATE.md.
- Message: `GSD > Error state detected. Fix the error before continuing.`
- Exit.

**HARD STOP 3 — Verification gaps:**
If `status` == "verifying":
- Check for unchecked verification items:
  ```bash
  grep -r "\- \[ \]" .planning/phases/*-*/VERIFICATION.md 2>/dev/null
  ```
- If gaps found, display the gap list.
- Message: `GSD > Verification incomplete. Address gaps before advancing.`
- Exit.
</step>

<step name="determine_next_action">
Apply routing rules based on state:

**Route 1: No phases exist yet → discuss**
If ROADMAP has phases but no phase directories exist on disk:
→ Next action: `/gsd-discuss-phase <first-phase>`

**Route 2: Phase exists but has no CONTEXT.md or RESEARCH.md → discuss**
If the current phase directory exists but has neither CONTEXT.md nor RESEARCH.md:
→ Next action: `/gsd-discuss-phase <current-phase>`

**Route 3: Phase has context but no plans → plan**
If the current phase has CONTEXT.md (or RESEARCH.md) but no PLAN.md files:
→ Next action: `/gsd-plan-phase <current-phase>`

**Route 4: Phase has plans but incomplete summaries → execute**
If plans exist but not all have matching summaries:
→ Next action: `/gsd-execute-phase <current-phase>`

**Route 5: All plans have summaries → verify and complete**
If all plans in the current phase have summaries:
→ Next action: `/gsd-verify-work`

**Route 6: Phase complete, next phase exists → advance**
If the current phase is complete and the next phase exists in ROADMAP:
→ Next action: `/gsd-discuss-phase <next-phase>`

**Route 7: All phases complete → HARD STOP (milestone boundary)**
If all phases are complete:
→ Do NOT invoke `/gsd-complete-milestone` automatically.
→ Display: `GSD > Milestone complete. Run /gsd-complete-milestone to finalize.`
→ Exit. This is a deliberate hard stop at the milestone boundary.

**Route 8: Paused → resume**
If STATE.md shows paused_at:
→ Next action: `/gsd-resume-work`
</step>

<step name="show_and_execute">
Display the determination:

```
## GSD Next

**Current:** Phase [N] — [name] | [progress]%
**Status:** [status description]

▶ **Next step:** `/gsd-[command] [args]`
  [One-line explanation of why this is the next step]
```

Then immediately invoke the determined command via Skill().
Use Skill() for command delegation — NOT Task(). Do not ask for confirmation.
</step>

</process>

<anti_patterns>
- Do NOT invoke /gsd-complete-milestone automatically at Route 7 — hard stop
- Do NOT continue past hard stops — they exist to prevent blind automation
- Do NOT use Task() for command delegation — Skill() only
</anti_patterns>

<success_criteria>
- [ ] Project state correctly detected from STATE.md
- [ ] Consecutive-call guard triggers at 6+ invocations
- [ ] Hard stops enforced at milestone boundary, error state, verification gaps, unresolved checkpoints
- [ ] Next action correctly determined from 8-route table
- [ ] Command invoked via Skill() without user confirmation (except at hard stops)
- [ ] Clear status shown before invoking
</success_criteria>
