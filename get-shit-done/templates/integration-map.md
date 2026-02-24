# Integration Map Template

Template for `.planning/phases/XX-name/{phase_num}-INTEGRATION-MAP.md` — maps where new code must connect to existing codebase.

**Purpose:** Ensure planners know exactly where to wire new features. Prevents orphaned code by making integration points explicit before planning.

**Downstream consumers:**
- `gsd-planner` — Uses integration points to write explicit "Wire into" instructions in task actions
- `gsd-plan-checker` — Cross-references plan tasks against integration map entries
- `gsd-verifier` — Validates that integration points were actually addressed

---

## File Template

```markdown
# Phase [X]: [Name] - Integration Map

**Generated:** [date]
**Phase Goal:** [goal from ROADMAP.md]

## Entry Points

Where users/system reach this feature:

| Entry Point | File | Type | How to Wire |
|-------------|------|------|-------------|
| [Route/page] | [file path] | routing/page/layout | [Add route, import component, etc.] |

## Registration Points

Where new code must register itself to be discovered:

| Registration | File | Mechanism | How to Wire |
|-------------|------|-----------|-------------|
| [Nav item, provider, export] | [file path] | [config array, wrapper, barrel export] | [Add entry, wrap component, export from index] |

## Data Flow

Where data enters, transforms, and persists:

| Endpoint | File | Direction | How to Wire |
|----------|------|-----------|-------------|
| [Store/API/DB] | [file path] | [read/write/both] | [Import store, call API, add model] |

## Type Connections

Existing types the phase should import (not redefine):

| Type | Defined In | Used For | Import As |
|------|-----------|----------|-----------|
| [TypeName] | [file path] | [purpose] | [import statement] |

---

*Phase: XX-name*
*Integration map generated: [date]*
```

<guidelines>
**Each row = one wiring instruction for the planner.**

The map answers: "To add feature X, wire into Y at Z."

**Good entries (actionable):**
- Entry: "Dashboard page" | `src/app/dashboard/page.tsx` | page | "Import and render `<NewWidget>` in grid"
- Registration: "Nav config" | `src/config/navigation.ts` | config array | "Add `{ label: 'Feature', href: '/feature', icon: Icon }` to `navItems`"
- Type: "User" | `src/types/user.ts` | author display | `import type { User } from '@/types/user'`

**Bad entries (vague):**
- "Add to the app somewhere"
- "Connect to database"
- "Use existing types"

**Generation protocol:**
1. Grep for routing files, page files, layout files → Entry Points
2. Grep for nav configs, provider wrappers, barrel exports → Registration Points
3. Grep for state stores, DB schema, API client → Data Flow
4. Grep for type definitions relevant to phase goal → Type Connections
5. Only include entries relevant to this phase's goal — not every file in the codebase
</guidelines>
