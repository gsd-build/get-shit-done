# SPEC.md Template

Use this template when creating `.planning/SPEC.md` - the project's single source of truth.

> **Agentic PRD Constraint:** Do not write narrative prose or fluff. Use strict checklists, dense tables, and typed schemas. There is no artificial line limit, but every single line must be highly deterministic and actionable for a downstream Subagent.

---

```markdown
# [Project Name]

## What We're Building

[2-3 sentences. What does this product/feature do and who is it for? Use the developer's own language.]

## Core Value

[The ONE thing that matters most. If everything else fails, this must work.]

## Core Principles

[SOTA: 3-5 governing rules for the project (e.g., Code Quality, UI Consistency, Testing)]

## Typed Data Schemas

```typescript
// SOTA: Define the core shared data models here early to prevent agent hallucination during handoffs
// type User = { id: string; role: 'admin' | 'user' };
```

## Capability & Security Gates

// SOTA [OpenFang]: Define what autonomous agents are explicitly NOT allowed to do without human `/approve`.
- **Destructive DB actions:** Require human review
- **External Purchases:** Mandatory approval gate

## Requirements

### Must Have (v1)

- [ ] **[CAT-01]**: [User-centric, testable requirement]
- [ ] **[CAT-02]**: [User-centric, testable requirement]
- [ ] **[CAT-03]**: [User-centric, testable requirement]

### Nice to Have (v2)

- **[CAT-04]**: [Deferred requirement]
- **[CAT-05]**: [Deferred requirement]

### Out of Scope

- [Feature] - [why excluded]
- [Feature] - [why excluded]

## Constraints

- **[Type]**: [What] - [Why]
- **[Type]**: [What] - [Why]

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| [Choice] | [Why] | [When] |

## Current State

- **Active Phase:** Phase [X] - [Name] ([ ]/[-]/[x])
- **Last Completed:** [What was last done]
- **In Progress:** [What is currently being worked on]
- **Decisions:** [Any recent decisions]
- **Blockers:** [None / description]

---
*Last updated: [date] after [trigger]*
```

---

## Guidelines

- **Requirements** must be specific, testable, and user-centric ("User can X", not "System does Y")
- **Requirement IDs** use `[CATEGORY]-[NUMBER]` format (AUTH-01, DATA-02, UI-03)
- **v1 requirements** have checkboxes - check them off when verified as complete
- **Out of Scope** always includes reasoning (prevents scope creep discussions later)
- **Key Decisions** are appended throughout the project as they're made
- **Current State** is updated after each significant milestone - this is how agents resume work across sessions
- **No Narrative Fluff** - this is an executable Agentic PRD, not a novel. Details live in plans, but core Typed Schemas MUST reside here.

## When Codebase Already Exists (Brownfield)

If auditing an existing codebase during `init`:
- Add a **Validated** section under Requirements:
  ```markdown
  ### Validated (existing capabilities)
  - [x] **[CAT-01]**: User can log in - existing auth system
  - [x] **[CAT-02]**: Data persists across sessions - PostgreSQL database
  ```
- New requirements go under "Must Have (v1)"
- Document existing tech stack and patterns in Constraints
- Document any tech debt discovered in a separate concern note (not in SPEC.md)

## Archive Guidance

When a major milestone completes:
1. The SPEC.md "Current State" section reflects the new state
2. Completed phases have summaries in `.planning/phases/{N}-SUMMARY.md`
3. SPEC.md itself stays lean - don't accumulate history here

