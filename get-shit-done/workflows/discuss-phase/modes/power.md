# --power mode — bulk question generation, async answering

> **Lazy-loaded.** Read this file from `workflows/discuss-phase.md` when
> `--power` is present in `$ARGUMENTS`. The full step-by-step instructions
> live in the existing `discuss-phase-power.md` workflow file (kept stable
> at its original path so installed `@`-references continue to resolve).

## Dispatch

```
Read @~/.claude/get-shit-done/workflows/discuss-phase-power.md
```

Execute it end-to-end. Do not continue with the standard interactive steps.

## Summary of flow

The power user mode generates ALL questions upfront into machine-readable
and human-friendly files, then waits for the user to answer at their own
pace before processing all answers in a single pass.

1. Run the same phase analysis (gray area identification) as standard mode
2. Write all questions to
   `{phase_dir}/{padded_phase}-QUESTIONS.json` and
   `{phase_dir}/{padded_phase}-QUESTIONS.html`
3. Notify user with file paths and wait for a "refresh" or "finalize"
   command
4. On "refresh": read the JSON, process answered questions, update stats
   and HTML
5. On "finalize": read all answers from JSON, generate CONTEXT.md in the
   standard format

## When to use

Large phases with many gray areas, or when users prefer to answer
questions offline / asynchronously rather than interactively in the chat
session.

## Combination rules

- `--power --auto`: power wins. Power mode is incompatible with
  autonomous selection — its purpose is offline answering.
- `--power --chain`: after the power-mode finalize step writes
  CONTEXT.md, the chain auto-advance still applies (Read `chain.md`).
