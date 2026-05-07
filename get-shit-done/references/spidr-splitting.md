# SPIDR Story Splitting Rules

> Used by `mvp-phase` workflow when the user-supplied story is too large for a single phase. Per PRD decision Q3, SPIDR runs as a **full interactive flow** — not a lightweight check.

## When SPIDR triggers

Trigger SPIDR splitting if **any** of these size signals fire on the user story:

1. **Compound capabilities.** The story names two or more independent user actions joined by "and" (e.g., "register **and** log in **and** reset their password"). Each "and" is a candidate split point.
2. **Multi-actor.** The story names more than one `[user role]` (e.g., "As a user or admin..."). Each role is a candidate split.
3. **Length.** The assembled story exceeds ~120 chars on a single line.
4. **Vague capability.** The capability is a noun phrase, not a verb-noun pair (e.g., "I want to use the dashboard" — needs to specify *which interaction* with the dashboard).

If none of these fire, skip SPIDR entirely and proceed to ROADMAP write.

## The five SPIDR axes

For each axis, ask one targeted question. The user picks the axis that best fits their story; only one axis is applied per split.

### Spike

> "Is there an unknown that needs research before this can be implemented? If so, the spike is its own phase."

If yes: split out a research phase (no acceptance criteria except "we know enough to plan the rest"). The remaining story becomes a follow-up phase.

### Paths

> "Does this feature have a happy path and one or more error/edge paths?"

If yes: split happy path into the first phase, edge paths into follow-ups. Order: happy path first (it proves the slice works), then progressively edge cases.

### Interfaces

> "Does this feature need to work on more than one interface (web, mobile, API, CLI)?"

If yes: split by interface. Web first if user-facing; API first if integration-driven; mobile last unless it's the primary platform.

### Data

> "Does this feature touch multiple data scopes (one user vs. many, single team vs. multi-tenant, small CSV vs. large dataset)?"

If yes: split by scope. Smallest scope first (one user, single team, small data), then expand.

### Rules

> "Does this feature have multiple business rules that could be added incrementally (basic validation first, then complex policy)?"

If yes: split by rule complexity. Minimum viable rules first; complex policy in follow-ups.

## Workflow

When SPIDR triggers, the workflow:

1. Restates the user-supplied story.
2. Asks "Which SPIDR axis fits best?" with the five options above.
3. Walks through the chosen axis interactively (one focused question), produces a split proposal: "Phase N (this one): X. Phase N+1: Y. Phase N+2: Z."
4. Confirms the split with the user.
5. On accept: writes the FIRST phase's story to the current ROADMAP entry; defers creating new phases for the splits to a follow-up step (the workflow surfaces a list of `/gsd add-phase` invocations the user can run after `mvp-phase` completes — but does not run them automatically, to preserve user control over phase numbering).
6. On reject: proceeds with the original story unchanged.

## Anti-patterns to reject

- **Splitting by technical layer.** "Phase 1: schema. Phase 2: API. Phase 3: UI." That's horizontal planning. Reject.
- **Pre-splitting before the user even sees the original.** Always show the user-supplied story first; only offer split if it triggers a size signal.
- **Splitting more than one axis at once.** SPIDR is one axis per split. If a story needs splitting on two axes (e.g., paths AND data), do paths first, then re-evaluate the resulting smaller stories.

## Reference

See [Mike Cohn — Five Simple But Powerful Ways to Split User Stories](https://www.mountaingoatsoftware.com/blog/five-simple-but-powerful-ways-to-split-user-stories).
