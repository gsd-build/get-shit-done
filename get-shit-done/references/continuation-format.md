# Continuation Format

Standard format for presenting next steps after completing a command or workflow.

## Core Structure

```
---

## ▶ Next Up

**{identifier}: {name}** — {one-line description}

`/clear` then:

`{command to copy-paste}`

---

**Also available:**
- `{alternative option 1}` — description
- `{alternative option 2}` — description

---
```

## Format Rules

1. **Always show what it is** — name + description, never just a command path
2. **Pull context from source** — ROADMAP.md for phases, PLAN.md `<objective>` for plans
3. **Command in inline code** — backticks, easy to copy-paste, renders as clickable link
4. **`/clear` first** — always show `/clear` before the command so users run it in the correct order
5. **"Also available" not "Other options"** — sounds more app-like
6. **Visual separators** — `---` above and below to make it stand out

## Variants

### Execute Next Plan

```
---

## ▶ Next Up

**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry

`/clear` then:

`/gsd:execute-phase 2`

---

**Also available:**
- Review plan before executing
- `/gsd:list-phase-assumptions 2` — check assumptions

---
```

### Execute Final Plan in Phase

Add note that this is the last plan and what comes after:

```
---

## ▶ Next Up

**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry
<sub>Final plan in Phase 2</sub>

`/clear` then:

`/gsd:execute-phase 2`

---

**After this completes:**
- Phase 2 → Phase 3 transition
- Next: **Phase 3: Core Features** — User dashboard and settings

---
```

### Plan a Phase

```
---

## ▶ Next Up

**Phase 2: Authentication** — JWT login flow with refresh tokens

`/clear` then:

`/gsd:plan-phase 2`

---

**Also available:**
- `/gsd:discuss-phase 2` — gather context first
- `/gsd:research-phase 2` — investigate unknowns
- Review roadmap

---
```

### Phase Complete, Ready for Next

Show completion status before next action:

```
---

## ✓ Phase 2 Complete

3/3 plans executed

## ▶ Next Up

**Phase 3: Core Features** — User dashboard, settings, and data export

`/clear` then:

`/gsd:plan-phase 3`

---

**Also available:**
- `/gsd:discuss-phase 3` — gather context first
- `/gsd:research-phase 3` — investigate unknowns
- Review what Phase 2 built

---
```

### Multiple Equal Options

When there's no clear primary action:

```
---

## ▶ Next Up

**Phase 3: Core Features** — User dashboard, settings, and data export

`/clear` then one of:

**To plan directly:** `/gsd:plan-phase 3`

**To discuss context first:** `/gsd:discuss-phase 3`

**To research unknowns:** `/gsd:research-phase 3`

---
```

### Milestone Complete

```
---

## 🎉 Milestone v1.0 Complete

All 4 phases shipped

## ▶ Next Up

**Start v1.1** — questioning → research → requirements → roadmap

`/clear` then:

`/gsd:new-milestone`

---
```

## Pulling Context

### For phases (from ROADMAP.md):

```markdown
### Phase 2: Authentication
**Goal**: JWT login flow with refresh tokens
```

Extract: `**Phase 2: Authentication** — JWT login flow with refresh tokens`

### For plans (from ROADMAP.md):

```markdown
Plans:
- [ ] 02-03: Add refresh token rotation
```

Or from PLAN.md `<objective>`:

```xml
<objective>
Add refresh token rotation with sliding expiry window.

Purpose: Extend session lifetime without compromising security.
</objective>
```

Extract: `**02-03: Refresh Token Rotation** — Add /api/auth/refresh with sliding expiry`

## Anti-Patterns

### Don't: Command-only (no context)

```
## To Continue

Run `/clear`, then paste:
/gsd:execute-phase 2
```

User has no idea what 02-03 is about.

### Don't: Missing /clear explanation

```
`/gsd:plan-phase 3`

Run /clear first.
```

Doesn't explain why. User might skip it.

### Don't: "Other options" language

```
Other options:
- Review roadmap
```

Sounds like an afterthought. Use "Also available:" instead.

### Don't: Fenced code blocks for commands

```
```
/gsd:plan-phase 3
```
```

Fenced blocks inside templates create nesting ambiguity. Use inline backticks instead.
