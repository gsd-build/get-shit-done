---
description: Derive action plans per milestone
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
argument-hint: "[M-XX]"
---

Derive action plans for milestones by working backward from what must be done.

**Step 1: Load current graph state.**

```bash
node /Users/guilherme/Projects/get-shit-done/dist/declare-tools.cjs load-graph
```

Parse the JSON output. If the output contains an `error` field, tell the user to run `/declare:init` first and stop.

If no milestones exist in the graph, tell the user to run `/declare:milestones` first and stop.

Note all milestones and their current plan status from the graph.

**Step 2: Determine scope.**

- If `$ARGUMENTS` contains a milestone ID (e.g., `M-01`), derive only for that milestone.
- Otherwise, derive for all milestones that don't have a plan yet (milestones where `hasPlan` is false or no PLAN.md folder exists).

If all milestones already have plans and no specific milestone was requested, tell the user: "All milestones already have action plans. Run `/declare:status` to see coverage."

**Step 3: Follow the action derivation workflow.**

Read and follow the full workflow instructions:

@/Users/guilherme/Projects/get-shit-done/workflows/actions.md

Pass the loaded graph state into the workflow so it knows about existing milestones and actions.

**Step 4: For each milestone, derive and present plan for approval.**

The workflow derives actions for each milestone. After derivation, present the complete plan and ask for approval using AskUserQuestion:

```
Use AskUserQuestion to ask the user to approve the derived plan for each milestone.

Proposed plan for M-XX "[milestone title]":
- A-XX: [action title] -- produces [what]
- A-XX: [action title] -- produces [what]

Approve this plan? (yes/adjust/skip)
```

If the user wants adjustments, adjust and re-present. If they skip, move to the next milestone.

**Step 5: Persist each approved plan.**

For each approved plan, call create-plan:

```bash
node /Users/guilherme/Projects/get-shit-done/dist/declare-tools.cjs create-plan --milestone "M-XX" --actions '[{"title":"Action Title","produces":"what it creates"}]'
```

Parse the JSON output to confirm the plan was created.

**Step 6: Show summary and suggest next step.**

After all milestones processed:

1. Reload the graph to get final counts:
```bash
node /Users/guilherme/Projects/get-shit-done/dist/declare-tools.cjs load-graph
```

2. Show summary: milestones processed, plans created, total actions derived.
3. Suggest: "Run `/declare:status` to see coverage and health."
