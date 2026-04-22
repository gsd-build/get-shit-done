# GSD Beta Features

> **Beta features are opt-in and may change or be removed without notice.** They are not covered by the stable API guarantees that apply to the rest of GSD. If a beta feature ships to stable, it will be documented in [COMMANDS.md](COMMANDS.md) and [FEATURES.md](FEATURES.md) with a changelog entry.

---

## `/gsd-ultraplan-phase` — Ultraplan Integration [BETA]

> **Claude Code only · Requires Claude Code v2.1.91+**
> Ultraplan is itself a Claude Code research preview — both this command and the underlying feature may change.

### What it does

`/gsd-ultraplan-phase` offloads GSD's plan-phase drafting to [Claude Code's ultraplan](https://code.claude.ai) cloud infrastructure. Instead of planning locally in the terminal, the plan is drafted in a browser-based session with:

- An **outline sidebar** for navigating the plan structure
- **Inline comments** for annotating and refining tasks
- A persistent browser tab so your terminal stays free while the plan is being drafted

When you're satisfied with the draft, you save it and import it back into GSD — conflict detection, format validation, and plan-checker verification all run automatically.

### Why use it

| Situation | Recommendation |
|-----------|---------------|
| Long, complex phases where you want to read and comment on the plan before it executes | Use `/gsd-ultraplan-phase` |
| Quick phases, familiar domain, or non-Claude Code runtimes | Use `/gsd-plan-phase` (stable) |
| You have a plan from another source (teammate, external AI) | Use `/gsd-import` |

### Requirements

- **Runtime:** Claude Code only. The command exits with an error on Gemini CLI, Copilot CLI, and other runtimes.
- **Version:** Claude Code v2.1.91 or later (the `$CLAUDE_CODE_VERSION` env var must be set).
- **Cost:** No extra charge for Pro and Max subscribers. Ultraplan is included at no additional cost.

### Usage

```bash
/gsd-ultraplan-phase         # Ultraplan the next unplanned phase
/gsd-ultraplan-phase 2       # Ultraplan a specific phase number
```

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to next unplanned phase) |

### How it works

1. **Initialization** — GSD runs the standard plan-phase init, resolving which phase to plan and confirming prerequisites.

2. **Context assembly** — GSD reads `ROADMAP.md`, `REQUIREMENTS.md`, and any existing `RESEARCH.md` for the phase. This context is bundled into a structured prompt so ultraplan has everything it needs without you copying anything manually.

3. **Return-path instructions** — Before launching ultraplan, GSD prints the import command to your terminal so it's visible in your scroll-back buffer after the browser session ends:
   ```
   When done: /gsd-import --from <path-to-saved-plan>
   ```

4. **Ultraplan launches** — The `/ultraplan` command hands off to the browser. Use the outline sidebar and inline comments to review and refine the draft.

5. **Save the plan** — When satisfied, click **Cancel** in Claude Code. Claude Code saves the plan to a local file and returns you to the terminal.

6. **Import back into GSD** — Run the import command that was printed in step 3:
   ```bash
   /gsd-import --from /path/to/saved-plan.md
   ```
   This runs conflict detection against `PROJECT.md`, converts the plan to GSD format, validates it with `gsd-plan-checker`, updates `ROADMAP.md`, and commits — the same path as any external plan import.

### What gets produced

| Step | Output |
|------|--------|
| After ultraplan | External plan file (saved by Claude Code) |
| After `/gsd-import` | `{phase}-{N}-PLAN.md` in `.planning/phases/` |

### What this command does NOT do

- Write `PLAN.md` files directly — all writes go through `/gsd-import`
- Replace `/gsd-plan-phase` — local planning is unaffected and remains the default
- Run research agents — if you need `RESEARCH.md` first, run `/gsd-plan-phase --skip-verify` or a research-only pass before using this command

### Troubleshooting

**"ultraplan is not available in this runtime"**
You're running GSD outside of Claude Code. Switch to a Claude Code terminal session, or use `/gsd-plan-phase` instead.

**Ultraplan browser session never opened**
Check your Claude Code version: `claude --version`. Requires v2.1.91+. Update with `claude update`.

**`/gsd-import` reports conflicts**
Ultraplan may have proposed something that contradicts a decision in `PROJECT.md`. The import step will prompt you to resolve each conflict before writing anything.

**Plan checker fails after import**
The imported plan has structural issues. Review the checker output, edit the saved file to fix them, and re-run `/gsd-import --from <same-file>`.

### Related commands

- [`/gsd-plan-phase`](COMMANDS.md#gsd-plan-phase) — standard local planning (stable, all runtimes)
- [`/gsd-import`](COMMANDS.md#gsd-import) — import any external plan file into GSD
