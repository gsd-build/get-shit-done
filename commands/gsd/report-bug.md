---
name: gsd:report-bug
description: Report a bug with structured format, severity tracking, and GitHub integration
argument-hint: [optional bug description]
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Report and track a bug with structured format, automatic severity classification, diagnostic log capture, and optional GitHub issue creation.

Routes to the report-bug workflow which handles:
- Directory structure creation
- Content extraction from arguments or conversation
- Severity inference from keywords
- Area inference from file paths
- Diagnostic log capture (git state, error output, log files)
- Bug file creation with frontmatter
- Git commits
- GitHub issue creation (if gh available)
- Next-action routing (investigate, plan fix, continue)
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/report-bug.md
</execution_context>

<context>
Arguments: $ARGUMENTS (optional bug description)

State is resolved in-workflow via `init bugs` and targeted reads.
</context>

<process>
**Follow the report-bug workflow** from `@~/.claude/get-shit-done/workflows/report-bug.md`.

The workflow handles all logic including:
1. Directory ensuring
2. Bug detail gathering (title, actual/expected behavior, repro steps)
3. Diagnostic log capture
4. Severity inference and confirmation
5. Area inference from file paths
6. Bug file creation with slug generation
7. Git commits
8. GitHub issue creation
9. Next-action routing
</process>
