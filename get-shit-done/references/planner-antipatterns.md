# Planner Anti-Patterns and Specificity Examples

> Reference file for gsd-planner agent. Loaded on-demand via `@` reference.
> For sub-200K context windows, this content is stripped from the agent prompt and available here for on-demand loading.

## Checkpoint Anti-Patterns

### Bad — Asking human to automate

```xml
<task type="checkpoint:human-action">
  <action>Deploy to Vercel</action>
  <instructions>Visit vercel.com, import repo, click deploy...</instructions>
</task>
```

**Why bad:** Vercel has a CLI. Claude should run `vercel --yes`. Never ask the user to do what Claude can automate via CLI/API.

### Bad — Too many checkpoints

```xml
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API</task>
<task type="checkpoint:human-verify">Check API</task>
```

**Why bad:** Verification fatigue. Users should not be asked to verify every small step. Combine into one checkpoint at the end of meaningful work.

### Good — Single verification checkpoint

```xml
<task type="auto">Create schema</task>
<task type="auto">Create API</task>
<task type="auto">Create UI</task>
<task type="checkpoint:human-verify">
  <what-built>Complete auth flow (schema + API + UI)</what-built>
  <how-to-verify>Test full flow: register, login, access protected page</how-to-verify>
</task>
```

### Bad — Mixing checkpoints with implementation

A plan should not interleave multiple checkpoint types with implementation tasks. Checkpoints belong at natural verification boundaries, not scattered throughout.

## Specificity Examples

| TOO VAGUE | JUST RIGHT |
|-----------|------------|
| "Add authentication" | "Add JWT auth with refresh rotation using jose library, store in httpOnly cookie, 15min access / 7day refresh" |
| "Create the API" | "Create POST /api/projects endpoint accepting {name, description}, validates name length 3-50 chars, returns 201 with project object" |
| "Style the dashboard" | "Add Tailwind classes to Dashboard.tsx: grid layout (3 cols on lg, 1 on mobile), card shadows, hover states on action buttons" |
| "Handle errors" | "Wrap API calls in try/catch, return {error: string} on 4xx/5xx, show toast via sonner on client" |
| "Set up the database" | "Add User and Project models to schema.prisma with UUID ids, email unique constraint, createdAt/updatedAt timestamps, run prisma db push" |

**Specificity test:** Could a different Claude instance execute the task without asking clarifying questions? If not, add more detail.

## Context Section Anti-Patterns

### Bad — Reflexive SUMMARY chaining

```markdown
<context>
@.planning/phases/01-foundation/01-01-SUMMARY.md
@.planning/phases/01-foundation/01-02-SUMMARY.md  <!-- Does Plan 02 actually need Plan 01's output? -->
@.planning/phases/01-foundation/01-03-SUMMARY.md  <!-- Chain grows, context bloats -->
</context>
```

**Why bad:** Plans are often independent. Reflexive chaining (02 refs 01, 03 refs 02...) wastes context. Only reference prior SUMMARY files when the plan genuinely uses types/exports from that prior plan or a decision from it affects the current plan.

### Good — Selective context

```markdown
<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-01-SUMMARY.md  <!-- Uses User type defined in Plan 01 -->
</context>
```

## Scope Reduction Anti-Patterns

**Prohibited language in task actions:**
- "v1", "v2", "simplified version", "static for now", "hardcoded for now"
- "future enhancement", "placeholder", "basic version", "minimal implementation"
- "will be wired later", "dynamic in future phase", "skip for now"

If a decision from CONTEXT.md says "display cost calculated from billing table in impulses", the plan must deliver exactly that. Not "static label /min" as a "v1". If the phase is too complex, recommend a phase split instead of silently reducing scope.
