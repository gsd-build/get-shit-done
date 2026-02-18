---
description: Derive milestones backward from declared futures
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
argument-hint: "[D-XX]"
---

Derive milestones by working backward from declared futures.

**Step 1: Load current graph state.**

```bash
node /Users/guilherme/Projects/get-shit-done/dist/declare-tools.cjs load-graph
```

Parse the JSON output. If the output contains an `error` field, tell the user to run `/declare:init` first and stop.

If no declarations exist in the graph, tell the user to run `/declare:future` first and stop.

Note all declarations and milestones from the graph -- the workflow needs full context.

**Step 2: Determine scope.**

- If `$ARGUMENTS` contains a declaration ID (e.g., `D-01`), derive only for that specific declaration.
- Otherwise, derive for all declarations that have no milestones yet (declarations with empty milestones arrays in the graph).

**Step 3: Follow the milestone derivation workflow.**

Read and follow the full workflow instructions:

@/Users/guilherme/Projects/get-shit-done/workflows/milestones.md

Pass the loaded graph state into the workflow so it knows about existing declarations and milestones.

**Step 4: Per-declaration milestone confirmation with checkboxes.**

After the workflow proposes milestones for a declaration, present them using AskUserQuestion with multi-select checkboxes:

```
Use AskUserQuestion to present proposed milestones as a checklist. The user checks which milestones to accept. Format:

Which of these milestones should we create for D-XX?
- [ ] Milestone A -- because [reason]
- [ ] Milestone B -- because [reason]
- [ ] Milestone C -- because [reason]
```

**Step 5: Persist each accepted milestone.**

For each checked milestone:

```bash
node /Users/guilherme/Projects/get-shit-done/dist/declare-tools.cjs add-milestone --title "Milestone Title" --realizes "D-XX"
```

Parse the JSON output to confirm the milestone was created and note its assigned ID.

**Step 6: Inconsistency flagging.**

If milestones already exist for a declaration being processed (re-derivation case):
- Show existing milestones for that declaration
- Ask the user if they still align with the declaration
- Offer to keep, re-derive, or adjust
- Do NOT auto-reconcile -- the user decides what to update

**Step 7: Show summary and suggest next step.**

After all declarations processed:

1. Reload the graph to get final counts:
```bash
node /Users/guilherme/Projects/get-shit-done/dist/declare-tools.cjs load-graph
```

2. Show summary: declarations processed, milestones derived.
3. Suggest: "Run `/declare:actions` to derive action plans for each milestone."
