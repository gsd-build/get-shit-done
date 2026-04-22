# Design: /gsd-ultraplan-phase [BETA]

**Date:** 2026-04-17
**Status:** Approved — ready for implementation
**Branch:** Beta feature, isolated from core plan pipeline

---

## Summary

A standalone `/gsd-ultraplan-phase` command that offloads GSD's research+plan phase to Claude Code's ultraplan cloud infrastructure. The plan drafts remotely while the terminal stays free, is reviewed in a rich browser UI with inline comments, then imports back into GSD via the existing `/gsd-import --from` workflow.

This is a **beta of a beta**: ultraplan itself is in research preview, so this command is intentionally isolated from the core `/gsd-plan-phase` pipeline to prevent breakage if ultraplan changes.

---

## Scope

**In scope:**
- New `commands/gsd/ultraplan-phase.md` command
- New `get-shit-done/workflows/ultraplan-phase.md` workflow
- Runtime gate: Claude Code only (checks `$CLAUDE_CODE_VERSION`)
- Builds structured ultraplan prompt from GSD phase context
- Return path via existing `/gsd-import --from <file>` (no new import logic)

**Out of scope (future):**
- Parallel next-phase planning during `/gsd-execute-phase`
- Auto-detection of ultraplan's saved file path
- Text mode / non-interactive fallback

---

## Architecture

```text
/gsd-ultraplan-phase [phase]
        │
        ├─ Runtime gate (CLAUDE_CODE_VERSION check)
        ├─ gsd-sdk query init.plan-phase → phase context
        ├─ Build ultraplan prompt (phase scope + requirements + research)
        ├─ Display return-path instructions card
        └─ /ultraplan <prompt>
                │
                [cloud: user reviews, comments, revises]
                │
                [browser: Approve → teleport back to terminal]
                │
                [terminal: Cancel → saves to file]
                │
                /gsd-import --from <saved file path>
                        │
                        ├─ Conflict detection
                        ├─ GSD format conversion
                        ├─ gsd-plan-checker validation
                        ├─ ROADMAP.md update
                        └─ Commit
```

---

## Command File (`commands/gsd/ultraplan-phase.md`)

Frontmatter:
- `name: gsd:ultraplan-phase`
- `description:` includes `[BETA]` marker
- `argument-hint: [phase-number]`
- `allowed-tools:` Read, Bash, Glob, Grep
- References: `@~/.claude/get-shit-done/workflows/ultraplan-phase.md`, ui-brand

---

## Workflow Steps

### 1. Banner
Display GSD `► ULTRAPLAN PHASE [BETA]` banner.

### 2. Runtime Gate
```bash
echo $CLAUDE_CODE_VERSION
```
If unset/empty: print error and exit.
```text
⚠ /gsd-ultraplan-phase requires Claude Code.
  /ultraplan is not available in this runtime.
  Use /gsd-plan-phase for local planning.
```

### 3. Initialize
```bash
INIT=$(gsd-sdk query init.plan-phase "$PHASE")
```
Parse: phase number, phase name, phase slug, phase dir, roadmap path, requirements path, research path.

If no `.planning/` exists: error — run `/gsd-new-project` first.

### 4. Build Ultraplan Prompt
Construct a prompt that includes:
- Phase identification: `"Plan phase {N}: {phase name}"`
- Phase scope block from ROADMAP.md
- Requirements summary (if REQUIREMENTS.md exists)
- Research summary (if RESEARCH.md exists — reduces cloud redundancy)
- Output format instruction: produce a GSD PLAN.md with standard frontmatter fields

### 5. Return-Path Instructions Card
Display prominently before triggering (visible in terminal scroll-back):
```text
When ◆ ultraplan ready:
  1. Open the session link in your browser
  2. Review, comment, and revise the plan
  3. When satisfied: "Approve plan and teleport back to terminal"
  4. At the terminal dialog: choose Cancel (saves plan to file)
  5. Run: /gsd-import --from <the file path Claude prints>
```

### 6. Trigger Ultraplan
```text
/ultraplan <constructed prompt>
```

---

## Return Path

No new code needed. The user runs `/gsd-import --from <path>` after ultraplan saves the file. That workflow handles everything: conflict detection, GSD format conversion, plan-checker, ROADMAP update, commit.

---

## Runtime Detection

`$CLAUDE_CODE_VERSION` is set by Claude Code in the shell environment. If unset, the session is not Claude Code (Gemini CLI, Copilot, etc.) and `/ultraplan` does not exist.

---

## Pricing

Ultraplan runs as a standard Claude Code on the web session. For Pro/Max subscribers this is included in the subscription — no extra usage billing (unlike ultrareview which bills $5–20/run). No cost gate needed.

---

## Beta Markers

- `[BETA]` in command description
- `⚠ BETA` in workflow banner
- Comment in workflow noting ultraplan is in research preview

---

## Test Coverage

`tests/ultraplan-phase.test.cjs` — structural assertions covering:
- File existence (command + workflow)
- Command frontmatter completeness (name, description with `[BETA]`, argument-hint)
- Command references workflow
- Workflow has runtime gate (`CLAUDE_CODE_VERSION`)
- Workflow has beta warning
- Workflow has init step (gsd-sdk query)
- Workflow builds ultraplan prompt with phase context
- Workflow triggers `/ultraplan`
- Workflow has return-path instructions (Cancel path, `/gsd-import --from`)
- Workflow does NOT directly implement plan writing (delegates to `/gsd-import`)
