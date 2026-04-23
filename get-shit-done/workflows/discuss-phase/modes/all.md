# --all mode — auto-select ALL gray areas, discuss interactively

> **Lazy-loaded.** Read this file from `workflows/discuss-phase.md` when
> `--all` is present in `$ARGUMENTS`. Behavior overlays the default mode.

## Effect

- In `present_gray_areas`: auto-select ALL gray areas without asking the user
  (skips the AskUserQuestion area-selection step).
- Discussion for each area proceeds **fully interactively** — the user drives
  every question for every area (use the default-mode `discuss_areas` flow).
- Does NOT auto-advance to plan-phase afterward — use `--chain` or `--auto`
  if you want auto-advance.
- Log: `[--all] Auto-selected all gray areas: [list area names].`

## Why this mode exists

This is the "discuss everything" shortcut: skip the selection friction, keep
full interactive control over each individual question.

## Combination rules

- `--all --auto`: `--auto` wins for the discussion phase too (Claude picks
  recommended answers); `--all`'s contribution is just area auto-selection.
- `--all --chain`: areas auto-selected, discussion interactive, then
  auto-advance to plan/execute (chain semantics).
- `--all --batch` / `--all --text` / `--all --analyze`: layered overlays
  apply during discussion as documented in their respective files.
