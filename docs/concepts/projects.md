# Projects

A **Project** is the strategic, long-term container for all work in GSD. It answers the fundamental question: "What am I building and why does it matter?"

## Overview

| Attribute | Value |
|-----------|-------|
| **Location** | `.planning/PROJECT.md` |
| **Created by** | `/gsd:new-project` |
| **Lifespan** | Entire product lifetime |
| **Updates** | After each milestone completion |

## Purpose

The project defines:
- **What This Is** — 2-3 sentence product description
- **Core Value** — The ONE thing that matters most (rarely changes)
- **Requirements** — Validated, Active, and Out of Scope
- **Constraints** — Hard limits with reasoning
- **Key Decisions** — Significant choices with rationale

## PROJECT.md Structure

```markdown
# MyApp

## What This Is
A community platform where users share interests and connect with like-minded people.

## Core Value
Users can find and discuss content with people who share their interests.

## Requirements

### Validated
- ✓ User authentication system — v1.0
- ✓ Profile creation — v1.0

### Active
- [ ] User can create posts with text
- [ ] User can follow other users
- [ ] User can see feed of followed users' posts

### Out of Scope
- Mobile app — web-first approach, PWA works well
- Video chat — use external tools

## Context
Background information informing implementation decisions.

## Constraints
- Must use PostgreSQL (existing infrastructure)
- Timeline: MVP in 6 weeks
- Budget: $0 external services initially

## Key Decisions
| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Next.js | Team familiarity + SSR | ✓ Good |
| JWT over sessions | Stateless scaling | ✓ Good |

*Last updated: 2025-01-15 after Phase 4*
```

## Requirement Lifecycle

Requirements flow through states as work progresses:

```
Active (hypothesis)
    ↓ shipped in milestone
Validated (proven)
    ↓ or invalidated
Out of Scope (deferred/rejected)
```

**Example evolution:**

Before v1.0:
```markdown
### Active
- [ ] Auth system
- [ ] Dashboard
- [ ] User profile
```

After v1.0 ships:
```markdown
### Validated
- ✓ Auth system — v1.0
- ✓ Dashboard — v1.0
- ✓ User profile — v1.0

### Active (v1.1)
- [ ] Two-factor auth
- [ ] Export data
```

## Project vs Other Concepts

| Aspect | PROJECT | MILESTONE | PHASE |
|--------|---------|-----------|-------|
| **Scope** | Entire product | One version | One delivery |
| **Lifespan** | Forever | Release cycle | Part of milestone |
| **Requirements** | Cumulative | Scoped to version | Maps to phase |
| **Changes** | Rarely | Each release | Each phase |

## Core Value

The Core Value is the most important section:

- **What it is:** The ONE thing that must work if everything else fails
- **How to identify:** "If users can only do one thing, what is it?"
- **When it changes:** Only during major pivots

**Good Core Values:**
- "Users can find and purchase products" (e-commerce)
- "Users can send and receive messages" (messaging app)
- "Users can create and share documents" (productivity tool)

**Bad Core Values:**
- "Fast and reliable" (too vague)
- "User authentication" (feature, not value)
- "Modern UI" (implementation detail)

## Greenfield vs Brownfield

### Greenfield (New Project)
```markdown
### Validated
(None yet — ship to validate)

### Active
- [ ] User authentication
- [ ] Content creation
```

### Brownfield (Existing Code)
```markdown
### Validated
- ✓ Existing API server — pre-GSD
- ✓ Database schema — pre-GSD

### Active
- [ ] New notification system
- [ ] Admin dashboard
```

GSD detects existing code and infers validated requirements.

## Project Creation

`/gsd:new-project` creates the project through:

1. **Brownfield detection** — Checks for existing code
2. **Deep questioning** — Gathers vision, constraints, goals
3. **Research (optional)** — 4 parallel researchers for domain understanding
4. **Requirements gathering** — Categorizes into v1/v2/out-of-scope
5. **Roadmap creation** — Maps requirements to phases

## Project Updates

Projects are updated:

1. **After each milestone** — Full evolution review
   - Move shipped requirements to Validated
   - Update Core Value if product changed
   - Audit Out of Scope reasoning
   - Log Key Decisions

2. **During development** — Incremental updates
   - Add emerged requirements to Active
   - Log decisions as they're made

## Key Files

| File | Purpose |
|------|---------|
| `PROJECT.md` | Vision, requirements, constraints |
| `REQUIREMENTS.md` | Detailed requirement checklist with traceability |
| `STATE.md` | Current position and accumulated decisions |
| `config.json` | Workflow preferences |

## Best Practices

1. **Keep Core Value stable** — Changing it means pivoting
2. **Be specific in requirements** — "User can X" not "Support X"
3. **Document constraints with reasoning** — "Why" matters
4. **Update after milestones** — Keep PROJECT.md current
5. **Archive old decisions** — Keep Key Decisions table manageable

## Related Commands

- `/gsd:new-project` — Create new project
- `/gsd:new-milestone` — Start new milestone cycle
- `/gsd:progress` — Check current project status
- `/gsd:complete-milestone` — Archive milestone and update project
