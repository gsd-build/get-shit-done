---
name: gsd:review
description: Request cross-AI peer review of phase plans from external AI CLIs
argument-hint: "--phase N [--gemini] [--claude] [--codex] [--all]"
agent: gsd-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---
<objective>
Invoke external AI CLIs (Gemini, Claude, Codex) to independently review phase plans. Produces a REVIEWS.md document with structured feedback from each reviewer that can be fed back into planning.

**Flow:** Init → Check CLIs → Build Prompt → Invoke CLIs → Write REVIEWS.md → Commit → Present Results
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/review.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase number: extracted from $ARGUMENTS (required)

**Flags:**
- `--gemini` — Include Gemini CLI review
- `--claude` — Include Claude CLI review
- `--codex` — Include Codex CLI review
- `--all` — Include all available CLIs
</context>

<process>
Execute the review workflow from @~/.claude/get-shit-done/workflows/review.md end-to-end.
</process>
