# User Story Template (MVP Mode)

> Used by `mvp-phase` workflow and `gsd-planner` agent when `MVP_MODE=true`. Defines the canonical "As a / I want to / So that" format and the rules for converting it into the `**Goal:**` line in ROADMAP.md.

## Canonical format

```
As a [user role], I want to [capability], so that [outcome].
```

Three required components:

| Slot | Question | Examples |
|---|---|---|
| `[user role]` | Who is the actor? | "new user", "admin", "signed-in customer", "API consumer" |
| `[capability]` | What can they do? | "register and log in", "upload a CSV", "see my dashboard" |
| `[outcome]` | Why does it matter? | "I can access my account", "I can bulk-import contacts", "I can see at a glance what needs attention" |

All three must be present. Refuse to assemble a partial story.

## How it lands in ROADMAP.md

The full user story replaces the existing `**Goal:**` line in the phase section:

**Before:**
```
### Phase 1: User Auth MVP
**Goal:** Users can register and log in
```

**After:**
```
### Phase 1: User Auth MVP
**Goal:** As a new user, I want to register and log in, so that I can access my dashboard.
**Mode:** mvp
```

Two structural rules:
1. The `**Goal:**` line stays on a single line (no line breaks inside the story). If the story is longer than ~120 chars, it should be split into multiple phases via SPIDR (see `spidr-splitting.md`).
2. The `**Mode:** mvp` line is added immediately below `**Goal:**`. If `**Mode:**` already exists, it is replaced (not duplicated).

## How it lands in PLAN.md

The `gsd-planner` agent (with MVP_MODE=true) emits the user story as the first content under the phase header in `PLAN.md`:

```markdown
## Phase Goal

**As a** new user, **I want to** register and log in, **so that** I can access my dashboard.

## Acceptance Criteria
- [ ] ...

## MVP Slice Tasks
...
```

Note the bold-keyword formatting (`**As a**`, `**I want to**`, `**so that**`) is for the PLAN.md emit only. The ROADMAP.md `**Goal:**` line uses prose form (the keywords are not bolded inside the goal line, since the goal is itself a single bolded label).
