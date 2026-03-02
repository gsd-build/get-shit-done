# Codebase Architecture

**Analysis Date:** [YYYY-MM-DD]

<guidelines>
- This document is durable intent: boundaries, layering, entrypoints, and change-routing rules.
- Do NOT write a static directory tree. It rots. Instead: reference a few canonical entrypoints and show "where changes go".
- Every layer/abstraction must include concrete file paths.
- Include "where to add new code" rules. This prevents downstream agents from scattering logic across random files.
</guidelines>

## Pattern Overview

Overall:
- [Pattern name]

Key characteristics:
- [Characteristic 1]
- [Characteristic 2]
- [Characteristic 3]

## Layers (Boundaries)

Layer: [Layer name]
- Purpose: [What this layer does]
- Location: `[path(s)]`
- Owns: [What it is responsible for]
- Does NOT own: [Explicit non-responsibilities]
- Depends on: [What it uses]
- Used by: [What uses it]

## Entry Points

Entrypoint: [Name]
- Location: `[path]`
- Triggers: [What invokes it]
- Responsibilities: [What it does]

## Data Flow (One Or Two Canonical Flows)

Flow: [Name]
1. [Step 1]
2. [Step 2]
3. [Step 3]

State management:
- [How state is handled]

## Key Abstractions

Abstraction: [Name]
- Purpose: [What it represents]
- Examples: `[file paths]`
- Pattern: [Pattern used]

## Error Handling Strategy

Strategy:
- [Approach]
- Examples: `[file paths]`

## Cross-Cutting Concerns

Logging:
- [Approach] - examples: `[file paths]`

Validation:
- [Approach] - examples: `[file paths]`

Authentication/Authorization:
- [Approach] - examples: `[file paths]`

## Change Routing (Where To Add New Code)

When making a change, follow these rules:

| Change type | Add/modify here | Do NOT do this | Example paths |
|---|---|---|---|
| New API endpoint / handler | [file or folder pattern] | [anti-pattern] | `[paths]` |
| New domain capability / business rule | [location] | [anti-pattern] | `[paths]` |
| New UI page / screen | [location] | [anti-pattern] | `[paths]` |
| New background job / worker | [location] | [anti-pattern] | `[paths]` |
| DB schema change / migration | [location] | [anti-pattern] | `[paths]` |
| New external integration | [location] | [anti-pattern] | `[paths]` |
| Adding a new module/package | [location] | [anti-pattern] | `[paths]` |

<good_examples>
Example (good):
- "New routes live in `src/server/routes/*.ts` and are registered in `src/server/app.ts`. Business rules never go in route handlers; they live in `src/domain/*`. See `src/server/routes/users.ts` and `src/domain/user/createUser.ts`."

Example (bad):
- "Add routes wherever it makes sense."
</good_examples>

---

*Architecture analysis: [date]*

