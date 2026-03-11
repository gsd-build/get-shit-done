---
name: gsd:prd
description: Mature a raw product concept into a structured PRD through three PM/PO/Tech stages with confidence-driven Q&A
argument-hint: "<concept description | file path | URL>"
allowed-tools:
  - Read
  - Write
  - Bash
  - WebFetch
  - AskUserQuestion
---

<objective>
Mature a raw product concept into a structured PRD stored at `.planning/prds/pending/{slug}.md`.

Three sequential stages:
1. PM Discovery — competitive research + confidence-driven Q&A
2. PO/BA Scoping — codebase context + user stories + MVP boundary
3. HL Tech Discovery — technology candidates (no schemas/routes/code)

**Concept input:** $ARGUMENTS (required) — one of:
- Raw text: "Auth system for multi-tenant SaaS"
- File path: ./concept.md
- URL: https://competitor.com/feature-page
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/prd.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<process>
Execute the prd workflow from @~/.claude/get-shit-done/workflows/prd.md end-to-end.
Pass the concept input from $ARGUMENTS as `concept` to the workflow.
</process>
