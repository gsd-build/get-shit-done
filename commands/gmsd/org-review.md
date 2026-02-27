---
name: gmsd:org-review
description: Review org-mode documents against the project styleguide
argument-hint: "[file path or glob pattern, e.g., '.planning/**/*.org']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---
<objective>
Review org-mode documents for compliance with the project's org-mode style guide.

Purpose: Ensure generated .org files follow consistent conventions for headers, headings, property drawers, markup, tables, source blocks, whitespace, and GMSD-specific frontmatter. Reports issues with severity, location, and suggested fixes.

Output: Structured findings displayed directly to the user with per-file issues, overall quality assessment, and actionable fix suggestions.
</objective>

<execution_context>
@~/.claude/get-my-shit-done/workflows/org-review.md
@~/.claude/get-my-shit-done/references/org-styleguide-full.org
</execution_context>

<context>
Target: $ARGUMENTS (optional)
- If a file path: Review that single file
- If a glob pattern: Review all matching files
- If not provided: Default to `.planning/**/*.org`
</context>

<process>
Execute the org-review workflow from @~/.claude/get-my-shit-done/workflows/org-review.md end-to-end.
Pass $ARGUMENTS as the target scope.
</process>
