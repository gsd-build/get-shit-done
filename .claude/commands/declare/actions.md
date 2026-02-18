---
description: Derive action plans per milestone
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
argument-hint: "[M-XX] [--auto]"
---

Derive action plans for milestones by working backward from what must be done.

**Step 1: Load current graph state.**

```bash
node dist/declare-tools.cjs load-graph
```

Parse the JSON output. If the output contains an `error` field, tell the user to run `/declare:init` first and stop.

If no milestones exist in the graph, tell the user to run `/declare:milestones` first and stop.

Note all milestones and their current plan status from the graph.

**Step 2: Determine scope and mode.**

- If `$ARGUMENTS` contains a milestone ID (e.g., `M-01`), derive only for that milestone.
- Otherwise, derive for all milestones that don't have a plan yet (milestones where `hasPlan` is false or no PLAN.md folder exists).
- If `$ARGUMENTS` contains `--auto`, use **auto mode** (see Step 3b). Otherwise use **interactive mode** (Step 3a).

If all milestones already have plans and no specific milestone was requested, tell the user: "All milestones already have action plans. Run `/declare:status` to see coverage."

**Step 3a: Interactive mode (default) — per-milestone approval.**

Read and follow the workflow:

@workflows/actions.md

For each milestone, derive and present the plan, then ask for approval using AskUserQuestion:

```
Proposed plan for M-XX "[milestone title]":
- A-XX: [action title] -- produces [what]
- A-XX: [action title] -- produces [what]

Approve this plan? (yes/adjust/skip)
```

If the user wants adjustments, adjust and re-present. If they skip, move to the next milestone.

After approval, persist:

```bash
node dist/declare-tools.cjs create-plan --milestone "M-XX" --actions '[{"title":"Action Title","produces":"what it creates"}]'
```

**Step 3b: Auto mode (`--auto`) — derive all, present once, persist all.**

Derive action plans for ALL milestones in scope without pausing between them. Use the same backward derivation logic from the workflow, but skip all AskUserQuestion prompts.

After deriving all plans:

1. Present the complete set as one summary:

```
## Derived Action Plans

### M-01: [title]
1. [Action A] -- produces [what]
2. [Action B] -- produces [what]

### M-02: [title]
1. [Action A] -- produces [what]
2. [Action B] -- produces [what]

...

Total: X milestones, Y actions
```

2. Ask ONE confirmation using AskUserQuestion: "Create all plans?" with options: "Yes, create all" / "Let me adjust first"

3. If approved, persist ALL plans by calling create-plan for each milestone (these are fast — just file writes + commits).

4. If the user wants adjustments, let them specify which milestones to adjust, adjust, then re-present.

**Step 4: Show summary and suggest next step.**

After all milestones processed:

1. Reload the graph to get final counts:
```bash
node dist/declare-tools.cjs load-graph
```

2. Show summary: milestones processed, plans created, total actions derived.
3. Suggest: "Run `/declare:status` to see coverage and health."
