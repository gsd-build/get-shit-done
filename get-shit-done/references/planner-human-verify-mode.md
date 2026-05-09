# Planner — Human Verification Mode

> Loaded by `gsd-planner` when deciding whether to emit `<task type="checkpoint:human-verify">` tasks. Read `workflow.human_verify_mode` from `.planning/config.json` (default `mid-flight`).

## The two modes

### `mid-flight` (default — current behavior)

Emit `<task type="checkpoint:human-verify">` tasks at the points where human confirmation is required. The executor halts at each one and asks the user.

```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dev server running at http://localhost:3000</what-built>
  <how-to-verify>
    1. Visit /dashboard
    2. Sidebar collapses at 768px
  </how-to-verify>
  <resume-signal>"approved" or describe issues</resume-signal>
</task>
```

### `end-of-phase` (cost-control — issue #3309)

Do **not** emit any `<task type="checkpoint:human-verify">` tasks. Every mid-flight halt costs a full executor cold-start (CLAUDE.md, MEMORY.md, STATE.md, plan re-read on respawn) because subagent context is discarded across the pause; a plan with N human-verify checkpoints pays the cold-start cost N+1 times. The user opts out of that cost by setting this flag.

Instead, fold each would-be verification step into the relevant `auto` task using a `<verify><human-check>` sub-block:

```xml
<task type="auto">
  <name>Wire dashboard route</name>
  <files>app/dashboard/page.tsx, app/api/dashboard/route.ts</files>
  <action>...</action>
  <verify>
    <automated>npm test -- --filter=dashboard</automated>
    <human-check>
      <test>Visit http://localhost:3000/dashboard</test>
      <expected>Sidebar left, content right on desktop &gt;1024px; collapses to hamburger at 768px</expected>
      <why_human>Visual layout — grep cannot verify breakpoint behavior</why_human>
    </human-check>
  </verify>
  <done>Layout renders correctly across breakpoints</done>
</task>
```

The verifier (Step 8) harvests every `<verify><human-check>` block at end-of-phase and consolidates them into the existing `human_needed` → HUMAN-UAT.md path in `workflows/execute-phase.md`. The user reviews everything in one batch instead of paying a cold-start cost per item.

## What is *not* affected

`checkpoint:decision` and `checkpoint:human-action` tasks are still emitted in `end-of-phase` mode. Those gate the work itself (a choice the executor needs from the user, or an auth step only the user can perform), not post-hoc verification of completed work. Only `checkpoint:human-verify` is suppressed.

## Compatibility with other modes

- **`workflow.tdd_mode`**: orthogonal. TDD tasks still emit `tdd="true"` and `<behavior>`; the `<verify>` block carries the human-check sub-element when `human_verify_mode = end-of-phase`.
- **`MVP_MODE`**: orthogonal. Vertical-slice ordering is unchanged. The first task remains a failing end-to-end test; later auto tasks may carry `<verify><human-check>` instead of standalone checkpoint tasks.
- **`workflow.auto_advance` / `_auto_chain_active`**: in mid-flight mode these auto-approve checkpoint:human-verify halts. In end-of-phase mode there are no halts to auto-approve, so the flags have no effect on this code path.
