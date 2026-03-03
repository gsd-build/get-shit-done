<purpose>
Report and track a bug with structured format, severity classification, diagnostic log capture, and optional GitHub issue creation. Enables full bug lifecycle: report -> triage -> investigate -> fix -> resolve.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="init_context">
Load bug context:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init bugs)
```

Extract from init JSON: `commit_docs`, `date`, `timestamp`, `bug_count`, `bugs`, `next_id`, `next_id_padded`, `bugs_dir`, `resolved_dir`, `bugs_dir_exists`.
</step>

<step name="ensure_dirs">
Ensure bug directories exist:

```bash
mkdir -p .planning/bugs .planning/bugs/resolved
```
</step>

<step name="extract_or_gather">
**With arguments:** Use `$ARGUMENTS` as seed description.

**Without arguments:** Analyze recent conversation for bug symptoms, error messages, and unexpected behavior.

Then use AskUserQuestion to gather structured details:

1. **Title** (3-10 words describing the bug)
2. **Actual behavior** (what happened)
3. **Expected behavior** (what should happen)
4. **Reproduction steps** (step-by-step or "unknown")
5. **Related files** (optional file paths)

If `$ARGUMENTS` provides sufficient detail, pre-fill answers and present for confirmation rather than asking from scratch.
</step>

<step name="capture_logs">
Automatically gather diagnostic context:

```bash
# Recent commits
git log --oneline -10

# Working tree state
git diff --stat

# Current branch
git branch --show-current
```

Scan for log files and include tails of recent ones:
- `*.log` files in project root
- `logs/` directory
- `.planning/debug/` active debug sessions

Capture any error output from the current conversation (stack traces, error messages, failed commands).

Bundle everything into a `## Diagnostic Logs` section.
</step>

<step name="infer_severity">
Match keywords in title + description to determine severity:

| Severity | Keywords |
|----------|----------|
| **critical** | crash, data loss, security, vulnerability, corruption, infinite loop, memory leak |
| **high** | broken, fails, error, exception, cannot, blocks, regression, timeout |
| **medium** | incorrect, wrong, unexpected, inconsistent, slow, intermittent |
| **low** | typo, alignment, color, spacing, formatting, cosmetic, minor |

Default: **medium** if no keywords match.

Present inferred severity to user for confirmation via AskUserQuestion:
- header: "Severity"
- question: "Inferred severity: {severity}. Is this correct?"
- options: "Yes", "Critical", "High", "Medium", "Low"
</step>

<step name="infer_area">
Infer area from file paths:

| Path pattern | Area |
|--------------|------|
| `src/api/*`, `api/*`, `routes/*`, `endpoints/*` | `api` |
| `src/auth/*`, `auth/*`, `login` | `auth` |
| `src/components/*`, `src/ui/*`, `pages/*` | `ui` |
| `src/db/*`, `database/*`, `prisma/*`, `migrations/*` | `database` |
| `tests/*`, `__tests__/*`, `*.test.*` | `testing` |
| `docs/*`, `*.md` | `docs` |
| `.planning/*` | `planning` |
| `scripts/*`, `bin/*` | `tooling` |
| No files or unclear | `general` |
</step>

<step name="create_file">
Write bug report to `.planning/bugs/BUG-{next_id_padded}.md`:

```markdown
---
id: BUG-{next_id_padded}
title: "{title}"
severity: {severity}
status: reported
area: {area}
phase: {phase or null}
created: {timestamp}
updated: {timestamp}
github_issue: null
files:
  - {file paths}
---

# BUG-{next_id_padded}: {title}

## Description

{description combining actual behavior context}

## Expected Behavior

{what should happen}

## Actual Behavior

{what actually happens}

## Reproduction Steps

{numbered steps or "Unknown - discovered during development"}

## Environment

- Branch: {current branch}
- Date: {date}

## Related Code

{file paths with relevant line numbers or code snippets}

## Diagnostic Logs

{git log, diff stat, error output, log file tails}
```
</step>

<step name="git_commit">
Commit the bug report:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: report BUG-{next_id_padded} - {title}" --files .planning/bugs/BUG-{next_id_padded}.md
```

Tool respects `commit_docs` config and gitignore automatically.
</step>

<step name="create_github_issue">
Attempt to create a GitHub issue:

```bash
gh issue create \
  --title "BUG-{next_id_padded}: {title}" \
  --body "{bug description, repro steps, severity, diagnostic logs}" \
  --label "bug" --label "severity: {severity}"
```

If `gh` is not available, no remote configured, or the command fails:
- Skip gracefully
- Note in output: "GitHub issue creation skipped (gh not available or no remote)"

If successful:
- Update bug file frontmatter: `github_issue: {issue URL}`
- Amend the commit to include the updated file
</step>

<step name="route_next">
Display summary:

```
Bug reported: .planning/bugs/BUG-{next_id_padded}.md

  BUG-{next_id_padded}: {title}
  Severity: {severity}
  Area: {area}
  {GitHub issue URL if created}
```

Use AskUserQuestion:
- header: "Next step"
- question: "What would you like to do next?"
- options:
  - "Investigate now" — route to `/gsd:debug BUG-{next_id_padded}: {title}`
  - "Plan a fix" — route to `/gsd:add-phase`
  - "Continue working" — return to previous context
  - "Report another" — restart this workflow
</step>

</process>

<success_criteria>
- [ ] Bug directories exist (.planning/bugs/ and .planning/bugs/resolved/)
- [ ] Bug file created with valid frontmatter (id, title, severity, status, area, timestamps)
- [ ] All sections populated (Description, Expected, Actual, Repro Steps, Diagnostic Logs)
- [ ] Severity inferred from keywords and confirmed by user
- [ ] Diagnostic logs captured (git state, error output)
- [ ] Bug file committed to git
- [ ] GitHub issue created if gh available (graceful skip if not)
- [ ] User routed to next action
</success_criteria>
