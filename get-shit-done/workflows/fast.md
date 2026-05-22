<purpose>
Execute a trivial task inline without subagent overhead. No PLAN.md, no Task spawning,
no research, no plan checking. Just: understand → do → commit → log.

For tasks like: fix a typo, update a config value, add a missing import, rename a
variable, commit uncommitted work, add a .gitignore entry, bump a version number.

Use /gsd:quick for anything that needs multi-step planning or research.
</purpose>

<process>

<step name="parse_task">
Parse `$ARGUMENTS` for the task description.

If empty, ask:
```
What's the quick fix? (one sentence)
```

Store as `$TASK`.
</step>

<step name="scope_check">
**Before doing anything, verify this is actually trivial.**

A task is trivial if it can be completed in:
- ≤ 3 file edits
- ≤ 1 minute of work
- No new dependencies or architecture changes
- No research needed

If the task seems non-trivial (multi-file refactor, new feature, needs research),
say:

```
This looks like it needs planning. Use /gsd:quick instead:
  /gsd:quick "{task description}"
```

And stop.
</step>

<step name="execute_inline">
Do the work directly:

1. Read the relevant file(s)
2. Make the change(s)
3. Verify the change works (run existing tests if applicable, or do a quick sanity check)

**No PLAN.md.** Just do it.
</step>

<step name="commit">
Commit the change atomically:

```bash
git add -A
git commit -m "fix: {concise description of what changed}"
```

Use conventional commit format: `fix:`, `feat:`, `docs:`, `chore:`, `refactor:` as appropriate.
</step>

<step name="log_to_state">
If `.planning/STATE.md` exists and has a "Quick Tasks Completed" table, append a row
that matches the existing table's schema. If no table exists, skip silently.
If the table's schema is unrecognized, skip with a brief log rather than append a
malformed row.

```bash
# Detect whether STATE.md has a Quick Tasks Completed table
if grep -q "Quick Tasks Completed" .planning/STATE.md 2>/dev/null; then
  # Read the table header line to determine the column schema.
  # quick.md Step 7 creates a 5-column table:
  #   | # | Description | Date | Commit | Directory |
  # Count pipe characters in the header to determine column count.
  HEADER_LINE=$(grep -A2 "Quick Tasks Completed" .planning/STATE.md 2>/dev/null | grep "^|" | head -1)
  # Count columns: number of | separators minus 1 gives column count
  COL_COUNT=$(echo "$HEADER_LINE" | awk -F'|' '{print NF-1}')

  if [ "$COL_COUNT" -eq 5 ] && echo "$HEADER_LINE" | grep -qi "Description" && echo "$HEADER_LINE" | grep -qi "Commit" && echo "$HEADER_LINE" | grep -qi "Directory"; then
    # 5-column schema from quick.md Step 7: | # | Description | Date | Commit | Directory |
    # Determine the next row number by counting existing data rows (non-separator, non-header).
    NEXT_NUM=$(awk '/Quick Tasks Completed/{found=1} found && /^\|/ && !/^[|][-: |]*[|]$/ && !/Description/{count++} END{print count+1}' .planning/STATE.md 2>/dev/null || echo "1")
    # Get the latest commit hash (short)
    COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "—")
    echo "| $NEXT_NUM | $TASK | $(date +%Y-%m-%d) | $COMMIT_HASH | — |" >> .planning/STATE.md
  else
    # Unrecognized table schema — skip to avoid appending a malformed row.
    echo "⚠ fast.md log_to_state: Quick Tasks Completed table has unrecognized schema (${COL_COUNT} columns); skipping STATE.md update."
  fi
fi
```
</step>

<step name="done">
Report completion:

```
✅ Done: {what was changed}
   Commit: {short hash}
   Files: {list of changed files}
```

No next-step suggestions. No workflow routing. Just done.
</step>

</process>

<guardrails>
- NEVER spawn a Task/subagent — this runs inline
- NEVER create PLAN.md or SUMMARY.md files
- NEVER run research or plan-checking
- If the task takes more than 3 file edits, STOP and redirect to /gsd:quick
- If you're unsure how to implement it, STOP and redirect to /gsd:quick
</guardrails>

<success_criteria>
- [ ] Task completed in current context (no subagents)
- [ ] Atomic git commit with conventional message
- [ ] STATE.md updated if it exists
- [ ] Total operation under 2 minutes wall time
</success_criteria>
