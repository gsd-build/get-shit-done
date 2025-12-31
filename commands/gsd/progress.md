---
description: Check project progress, show context, and route to next action (execute or plan)
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
---

<objective>
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.

Provides situational awareness before continuing work.
</objective>


<process>

<step name="verify">
**Verify planning structure exists:**

If no `.planning/` directory:

```
No planning structure found.

Run /gsd:new-project to start a new project.
```

Exit.

If missing STATE.md or ROADMAP.md: inform what's missing, suggest running `/gsd:new-project`.
</step>

<step name="load">
**Load full project context:**

- Read `.planning/STATE.md` for living memory (position, decisions, issues)
- Read `.planning/ROADMAP.md` for phase structure and objectives
- Read `.planning/PROJECT.md` for current state (What This Is, Core Value, Requirements)
  </step>

<step name="recent">
**Gather recent work context:**

- Find the 2-3 most recent SUMMARY.md files
- Extract from each: what was accomplished, key decisions, any issues logged
- This shows "what we've been working on"
  </step>

<step name="position">
**Parse current position:**

- From STATE.md: current phase, plan number, status
- Calculate: total plans, completed plans, remaining plans
- Note any blockers, concerns, or deferred issues
- Check for CONTEXT.md: For phases without PLAN.md files, check if `{phase}-CONTEXT.md` exists in phase directory
  </step>

<step name="report">
**Present rich status report:**

```
# [Project Name]

**Progress:** [████████░░] 8/10 plans complete

## Recent Work
- [Phase X, Plan Y]: [what was accomplished - 1 line]
- [Phase X, Plan Z]: [what was accomplished - 1 line]

## Current Position
Phase [N] of [total]: [phase-name]
Plan [M] of [phase-total]: [status]
CONTEXT: [✓ if CONTEXT.md exists | - if not]

## Key Decisions Made
- [decision 1 from STATE.md]
- [decision 2]

## Open Issues
- [any deferred issues or blockers]

## What's Next
[Next phase/plan objective from ROADMAP]
```

</step>

<step name="route">
**Determine next action and AUTO-EXECUTE:**

Find the next plan number that needs work.
Check if `{phase}-{plan}-PLAN.md` exists for that number.

**If PLAN.md exists (unexecuted):**

- Read its `<objective>` section
- Show: "Ready to execute: [path] - [objective summary]"
- Display:
  ```
  ---

  ## ▶ Auto-executing

  **{phase}-{plan}: [Plan Name]** — [objective summary from PLAN.md]

  ---
  ```
- **AUTO-EXECUTE:** Invoke `SlashCommand("/gsd:execute-plan [full-path-to-PLAN.md]")`

**If PLAN.md does NOT exist:**

- Check if `{phase}-CONTEXT.md` exists in phase directory
- Show: "Next plan not yet created: [expected path]"
- Show phase objective from ROADMAP

**If CONTEXT.md exists:**

- Display: "✓ Context gathered, ready to plan"
- Display:
  ```
  ---

  ## ▶ Auto-executing

  **Phase [N]: [Name]** — [Goal from ROADMAP.md]

  ---
  ```
- **AUTO-EXECUTE:** Invoke `SlashCommand("/gsd:plan-phase [phase-number]")`

**If CONTEXT.md does NOT exist:**

- Display:
  ```
  ---

  ## ▶ Auto-executing

  **Phase [N]: [Name]** — [Goal from ROADMAP.md]

  Planning phase (no CONTEXT.md found, will gather context during planning)

  ---
  ```
- **AUTO-EXECUTE:** Invoke `SlashCommand("/gsd:plan-phase [phase-number]")`

**If all plans complete for current phase:**

- Check if more phases exist in ROADMAP
- If yes:
  - Display: "Phase complete, transitioning to next phase"
  - **AUTO-EXECUTE:** Invoke `SlashCommand("/gsd:plan-phase [next-phase]")`
- If no (milestone 100% complete):
  - Display: "🎉 Milestone complete!"
  - **AUTO-EXECUTE:** Invoke `SlashCommand("/gsd:complete-milestone")`
  </step>

<step name="edge_cases">
**Handle edge cases:**

- Phase complete but next phase not planned → offer `/gsd:plan-phase [next]`
- All work complete → offer milestone completion
- Blockers present → highlight before offering to continue
- Handoff file exists → mention it, offer `/gsd:resume-work`
  </step>

</process>

<success_criteria>

- [ ] Rich context provided (recent work, decisions, issues)
- [ ] Current position clear with visual progress
- [ ] What's next clearly explained
- [ ] Smart routing: /gsd:execute-plan if plan exists, /gsd:plan-phase if not
- [ ] Auto-execute: Immediately invoke the next appropriate gsd command
- [ ] Seamless continuation without user intervention
      </success_criteria>
