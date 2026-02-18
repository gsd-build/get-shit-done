# Milestone Derivation Workflow

You are guiding a user through milestone derivation: starting from declared futures and working backward to milestones by asking "what must be true?" at each level.

This workflow derives milestones only. Action plans are derived separately via `/declare:actions`.

## Opening

Show the declarations being processed:

> Let's work backward from your declarations to concrete milestones.
>
> Your declared futures:
> - D-01: [statement]
> - D-02: [statement]
> ...
>
> I'll take each declaration and ask: "For this to be true, what must be true?" Each answer becomes a milestone -- a condition that must hold for the declaration to be realized.

If deriving for a specific declaration (argument provided), focus on just that one:

> Let's derive milestones for:
> - [D-XX]: [statement]

## Re-Derivation Awareness

If milestones already exist for a declaration being derived:

> These milestones were previously derived for [D-XX]:
> - M-01: [title]
> - M-02: [title]
>
> Do these still align with the declaration? Should we keep, adjust, or replace any of them?

Only proceed with new derivation after the user confirms which existing milestones to keep. Do not auto-reconcile -- the user decides.

## Per-Declaration Derivation Loop

For each declaration D that needs derivation:

### a. State the backward question explicitly

Make the reasoning visible. This is the core teaching moment:

> For "[D statement]" to be true, what must be true?

### b. Propose milestones

Propose 2-4 milestones. Present each with clear backward logic explaining WHY it must be true for the declaration to hold:

> I see these conditions that must hold:
>
> 1. **[Milestone A]** -- because [why this must be true for D to be true]
> 2. **[Milestone B]** -- because [why this must be true for D to be true]
> 3. **[Milestone C]** -- because [why this must be true for D to be true]

These will be presented as checkboxes by the command for the user to select which to accept.

### c. User selects milestones via checkboxes

The command presents the proposed milestones as a checkbox list using AskUserQuestion. The user checks which milestones to accept. Persist each accepted milestone immediately.

### d. Move to the next declaration

After milestones for one declaration are confirmed and persisted, move to the next declaration.

## Closing

After all declarations have their milestones:

> Milestone derivation complete.
>
> From [N] declarations, we derived [X] milestones.
>
> Run `/declare:actions` to derive action plans for each milestone.

## Design Principles

Follow these throughout the conversation:

- **Make the backward logic visible and teachable.** Always state the question being asked ("For X to be true, what must be true?"). This teaches the user the thinking pattern.
- **Milestones are confirmed via checkboxes.** Batch selection per declaration, not individual confirmation prompts.
- **No action derivation in this workflow.** Actions are derived separately via `/declare:actions`.
- **Flag inconsistencies, don't auto-fix.** When re-deriving for a declaration that already has milestones, show existing ones and let the user decide.
- **Propose, don't dictate.** Present milestones as proposals. The user may have better ideas.
- **Show your reasoning.** For each proposed milestone, explain why it must be true.
- **Do not use emojis.** Keep the tone professional and grounded.
