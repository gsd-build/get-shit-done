# Phase Prompt Template

Template for `.planning/phases/XX-name/{phase}-{plan}-PLAN.md` - executable phase plans optimized for parallel execution.

**Naming:** Use `{phase}-{plan}-PLAN.md` format (e.g., `01-02-PLAN.md` for Phase 1, Plan 2)

---

## File Template

```markdown
---
phase: XX-name
plan: NN
type: execute
wave: N                     # Execution wave (1, 2, 3...). Pre-computed at plan time.
depends_on: []              # Plan IDs this plan requires (e.g., ["01-01"]).
files_modified: []          # Files this plan modifies.
autonomous: true            # false if plan has checkpoints requiring user interaction
domain: [optional - if domain skill loaded]
---

<objective>
[What this plan accomplishes]

Purpose: [Why this matters for the project]
Output: [What artifacts will be created]
</objective>

<execution_context>
@~/.config/opencode/gsd/workflows/execute-plan.md
@~/.config/opencode/gsd/templates/summary.md
[If plan contains checkpoint tasks (type="checkpoint:*"), add:]
@~/.config/opencode/gsd/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Only reference prior plan SUMMARYs if genuinely needed:
# - This plan uses types/exports from prior plan
# - Prior plan made decision that affects this plan
# Do NOT reflexively chain: Plan 02 refs 01, Plan 03 refs 02...

[Relevant source files:]
@src/path/to/relevant.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: [Action-oriented name]</name>
  <files>path/to/file.ext, another/file.ext</files>
  <action>[Specific implementation - what to do, how to do it, what to avoid and WHY]</action>
  <verify>[Command or check to prove it worked]</verify>
  <done>[Measurable acceptance criteria]</done>
</task>

<task type="auto">
  <name>Task 2: [Action-oriented name]</name>
  <files>path/to/file.ext</files>
  <action>[Specific implementation]</action>
  <verify>[Command or check]</verify>
  <done>[Acceptance criteria]</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <decision>[What needs deciding]</decision>
  <context>[Why this decision matters]</context>
  <options>
    <option id="option-a">
      <name>[Option name]</name>
      <pros>[Benefits and advantages]</pros>
      <cons>[Tradeoffs and limitations]</cons>
    </option>
    <option id="option-b">
      <name>[Option name]</name>
      <pros>[Benefits and advantages]</pros>
      <cons>[Tradeoffs and limitations]</cons>
    </option>
  </options>
  <resume-signal>[How to indicate choice - "Select: option-a or option-b"]</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What Claude just built that needs verification]</what-built>
  <how-to-verify>
    1. Run: [command to start dev server/app]
    2. Visit: [URL to check]
    3. Test: [Specific interactions]
    4. Confirm: [Expected behaviors]
  </how-to-verify>
  <resume-signal>Type "approved" to continue, or describe issues to fix</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] [Specific test command]
- [ ] [Build/type check passes]
- [ ] [Behavior verification]
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings introduced
- [Plan-specific criteria]
  </success_criteria>

<output>
After completion, create `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`
</output>
```

---

## Frontmatter Fields

| Field | Required | Purpose |
|-------|----------|---------|
| `phase` | Yes | Phase identifier (e.g., `01-foundation`) |
| `plan` | Yes | Plan number within phase (e.g., `01`, `02`) |
| `type` | Yes | Always `execute` for standard plans, `tdd` for TDD plans |
| `wave` | Yes | Execution wave number (1, 2, 3...). Pre-computed at plan time. |
| `depends_on` | Yes | Array of plan IDs this plan requires. |
| `files_modified` | Yes | Files this plan touches. |
| `autonomous` | Yes | `true` if no checkpoints, `false` if has checkpoints |
| `domain` | No | Domain skill if loaded (e.g., `next-js`) |

**Wave is pre-computed:** Wave numbers are assigned during `/gsd/plan-phase`. Execute-phase reads `wave` directly from frontmatter and groups plans by wave number. No runtime dependency analysis needed.

---

## Parallel vs Sequential

<parallel_examples>

**Wave 1 candidates (parallel):**

```yaml
# Plan 01 - User feature
wave: 1
depends_on: []
files_modified: [src/models/user.ts, src/api/users.ts]
autonomous: true

# Plan 02 - Product feature (no overlap with Plan 01)
wave: 1
depends_on: []
files_modified: [src/models/product.ts, src/api/products.ts]
autonomous: true

# Plan 03 - Order feature (no overlap)
wave: 1
depends_on: []
files_modified: [src/models/order.ts, src/api/orders.ts]
autonomous: true
```

All three run in parallel (Wave 1) - no dependencies, no file conflicts.

**Sequential (genuine dependency):**

```yaml
# Plan 01 - Auth foundation
wave: 1
depends_on: []
files_modified: [src/lib/auth.ts, src/middleware/auth.ts]
autonomous: true

# Plan 02 - Protected features (needs auth)
wave: 2
depends_on: ["01"]
files_modified: [src/features/dashboard.ts]
autonomous: true
```

Plan 02 in Wave 2 waits for Plan 01 in Wave 1 - genuine dependency on auth types/middleware.

**Checkpoint plan:**

```yaml
# Plan 03 - UI with verification
wave: 3
depends_on: ["01", "02"]
files_modified: [src/components/Dashboard.tsx]
autonomous: false  # Has checkpoint:human-verify
```

Wave 3 runs after Waves 1 and 2. Pauses at checkpoint, orchestrator presents to user, resumes on approval.

</parallel_examples>

---

## Context Section

**Parallel-aware context:**

```markdown
<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Only include SUMMARY refs if genuinely needed:
# - This plan imports types from prior plan
# - Prior plan made decision affecting this plan
# - Prior plan's output is input to this plan
#
# Independent plans need NO prior SUMMARY references.
# Do NOT reflexively chain: 02 refs 01, 03 refs 02...

@src/relevant/source.ts
</context>
```

**Bad pattern (creates false dependencies):**
```markdown
<context>
@.planning/phases/03-features/03-01-SUMMARY.md  # Just because it's earlier
@.planning/phases/03-features/03-02-SUMMARY.md  # Reflexive chaining
</context>
```

---

## Scope Guidance

**Plan sizing:**

- 2-3 tasks per plan
- ~50% context usage maximum
- Complex phases: Multiple focused plans, not one large plan

**When to split:**

- Different subsystems (auth vs API vs UI)
- >3 tasks
- Risk of context overflow
- TDD candidates - separate plans

**Vertical slices preferred:**

```
PREFER: Plan 01 = User (model + API + UI)
        Plan 02 = Product (model + API + UI)

AVOID:  Plan 01 = All models
        Plan 02 = All APIs
        Plan 03 = All UIs
```

---

## TDD Plans

TDD features get dedicated plans with `type: tdd`.

**Heuristic:** Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
→ Yes: Create a TDD plan
→ No: Standard task in standard plan

See `~/.config/opencode/gsd/references/tdd.md` for TDD plan structure.

---

## Task Types

| Type | Use For | Autonomy |
|------|---------|----------|
| `auto` | Everything Claude can do independently | Fully autonomous |
| `checkpoint:human-verify` | Visual/functional verification | Pauses, returns to orchestrator |
| `checkpoint:decision` | Implementation choices | Pauses, returns to orchestrator |
| `checkpoint:human-action` | Truly unavoidable manual steps (rare) | Pauses, returns to orchestrator |

**Checkpoint behavior in parallel execution:**
- Plan runs until checkpoint
- Agent returns with checkpoint details + agent_id
- Orchestrator presents to user
- User responds
- Orchestrator resumes agent with `resume: agent_id`

---

## Examples

**Autonomous parallel plan:**

```markdown
---
phase: 03-features
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/features/user/model.ts, src/features/user/api.ts, src/features/user/UserList.tsx]
autonomous: true
---

<objective>
Implement complete User feature as vertical slice.

Purpose: Self-contained user management that can run parallel to other features.
Output: User model, API endpoints, and UI components.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>
<task type="auto">
  <name>Task 1: Create User model</name>
  <files>src/features/user/model.ts</files>
  <action>Define User type with id, email, name, createdAt. Export TypeScript interface.</action>
  <verify>tsc --noEmit passes</verify>
  <done>User type exported and usable</done>
</task>

<task type="auto">
  <name>Task 2: Create User API endpoints</name>
  <files>src/features/user/api.ts</files>
  <action>GET /users (list), GET /users/:id (single), POST /users (create). Use User type from model.</action>
  <verify>curl tests pass for all endpoints</verify>
  <done>All CRUD operations work</done>
</task>
</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] API endpoints respond correctly
</verification>

<success_criteria>
- All tasks completed
- User feature works end-to-end
</success_criteria>

<output>
After completion, create `.planning/phases/03-features/03-01-SUMMARY.md`
</output>
```

**Plan with checkpoint (non-autonomous):**

```markdown
---
phase: 03-features
plan: 03
type: execute
wave: 2
depends_on: ["03-01", "03-02"]
files_modified: [src/components/Dashboard.tsx]
autonomous: false
---

<objective>
Build dashboard with visual verification.

Purpose: Integrate user and product features into unified view.
Output: Working dashboard component.
</objective>

<execution_context>
@~/.config/opencode/gsd/workflows/execute-plan.md
@~/.config/opencode/gsd/templates/summary.md
@~/.config/opencode/gsd/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-features/03-01-SUMMARY.md
@.planning/phases/03-features/03-02-SUMMARY.md
</context>

<tasks>
<task type="auto">
  <name>Task 1: Build Dashboard layout</name>
  <files>src/components/Dashboard.tsx</files>
  <action>Create responsive grid with UserList and ProductList components. Use Tailwind for styling.</action>
  <verify>npm run build succeeds</verify>
  <done>Dashboard renders without errors</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Responsive dashboard with user and product sections</what-built>
  <how-to-verify>
    1. Run: npm run dev
    2. Visit: http://localhost:3000/dashboard
    3. Desktop: Verify two-column grid
    4. Mobile: Verify stacked layout
    5. Check: No layout shift, no scroll issues
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] Visual verification passed
</verification>

<success_criteria>
- All tasks completed
- User approved visual layout
</success_criteria>

<output>
After completion, create `.planning/phases/03-features/03-03-SUMMARY.md`
</output>
```

---

## Anti-Patterns

**Bad: Reflexive dependency chaining**
```yaml
depends_on: ["03-01"]  # Just because 01 comes before 02
```

**Bad: Horizontal layer grouping**
```
Plan 01: All models
Plan 02: All APIs (depends on 01)
Plan 03: All UIs (depends on 02)
```

**Bad: Missing autonomy flag**
```yaml
# Has checkpoint but no autonomous: false
depends_on: []
files_modified: [...]
# autonomous: ???  <- Missing!
```

**Bad: Vague tasks**
```xml
<task type="auto">
  <name>Set up authentication</name>
  <action>Add auth to the app</action>
</task>
```

---

## Guidelines

- Always use XML structure for Claude parsing
- Include `wave`, `depends_on`, `files_modified`, `autonomous` in every plan
- Prefer vertical slices over horizontal layers
- Only reference prior SUMMARYs when genuinely needed
- Group checkpoints with related auto tasks in same plan
- 2-3 tasks per plan, ~50% context max
