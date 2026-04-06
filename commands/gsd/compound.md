---
name: gsd:compound
description: Document learnings from a completed phase — extract decisions, lessons, patterns, and surprises
argument-hint: "[phase number, e.g., '4']"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
---
<objective>
Extract and codify learnings from a completed phase. Reads planning artifacts (PLAN, SUMMARY, VERIFICATION, UAT, STATE), identifies decisions, lessons, reusable patterns, and surprises, then produces a COMPOUND.md artifact.

If a capture_thought tool is available in the session (e.g., via an MCP knowledge base), learnings are also captured there. Otherwise, all learnings are written to the artifact only.

Run after /gsd:ship to close the compound engineering loop: plan → execute → verify → ship → compound.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/compound.md
</execution_context>

Execute the compound workflow from @~/.claude/get-shit-done/workflows/compound.md end-to-end.
