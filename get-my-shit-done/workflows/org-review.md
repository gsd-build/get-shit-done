<purpose>
Review org-mode documents against the project's org-mode style guide. Check structure, formatting, and GMSD-specific conventions. Report findings with severity and fix suggestions.

The full style guide is at @~/.claude/get-my-shit-done/references/org-styleguide-full.org
</purpose>

<process>

<step name="resolve_scope" priority="first">
Determine which files to review.

**If $ARGUMENTS is a file path:**
Verify it exists with `ls`. Review that single file.

**If $ARGUMENTS is a glob pattern:**
```bash
find . -path "$ARGUMENTS" -name "*.org" 2>/dev/null | head -50
```

**If no arguments provided:**
Default to `.planning/**/*.org`:
```bash
find .planning -name "*.org" -type f 2>/dev/null | head -50
```

If no .org files found, inform the user and stop.

Count the files and display:
```
## Org Review Scope

Found N .org files to review.
```
</step>

<step name="review_each_file">
For each file, read it and check against these rule categories. Track findings as (severity, rule, location, detail).

**Severity levels:**
- **error**: Broken syntax or missing required elements
- **warning**: Convention violation that affects readability or export
- **info**: Minor style suggestion

### Category 1: File header
- [ ] Has `#+title:` (error if missing)
- [ ] Has `#+startup: indent` (warning if missing)
- [ ] Has `#+options:` with `^:{}` (warning if missing)
- [ ] All keywords are lowercase (warning if uppercase `#+TITLE:`)
- [ ] No stale or placeholder dates in `#+date:`

### Category 2: Headings
- [ ] Maximum depth is 4 levels (warning if deeper)
- [ ] Top-level (`*`) headings use title case (info)
- [ ] Level 2+ headings use sentence case (info)
- [ ] Headlines under 60 characters (info if longer)
- [ ] No trailing punctuation on headlines (info)
- [ ] One blank line before each headline (warning if missing)
- [ ] No blank line between headline and first content/drawer (warning if present)

### Category 3: Property drawers (GMSD frontmatter)
- [ ] Drawer immediately follows headline — no blank line gap (error)
- [ ] Keys use lowercase with underscores (warning if mixed case)
- [ ] Dot-notation for nested keys (info — check for consistency)
- [ ] Arrays use `[item1, item2]` bracket syntax (warning if inconsistent)
- [ ] GMSD schema compliance: if file is a PLAN, SUMMARY, or VERIFICATION, check required fields against schemas:
  - plan: phase, plan, type, wave, depends_on, files_modified, autonomous, must_haves
  - summary: phase, plan, subsystem, tags, duration, completed
  - verification: phase, verified, status, score

### Category 4: Text markup
- [ ] No backtick usage for inline code (warning — use `~code~` or `=verbatim=`)
- [ ] No nested emphasis markers (warning)
- [ ] Code fragments use `~code~`, paths/commands use `=verbatim=` (info)

### Category 5: Lists
- [ ] Consistent bullet character (`-` only, not `+` or `*`) (warning if mixed)
- [ ] Continuation lines indented 2 spaces (info)

### Category 6: Tables
- [ ] Header row followed by horizontal rule `|---+---|` (warning if missing)
- [ ] Referenceable tables have `#+CAPTION:` (info)

### Category 7: Source blocks
- [ ] Language specified after `#+begin_src` (warning if missing)
- [ ] Block keywords lowercase (warning if uppercase `#+BEGIN_SRC`)
- [ ] Blocks under 30 lines (info if longer)
- [ ] MermaidJS blocks use `:file name.png :exports results` (info)

### Category 8: Whitespace
- [ ] No double blank lines (warning)
- [ ] No trailing whitespace on lines (info)
- [ ] File ends with single newline (info)

</step>

<step name="report_findings">
After reviewing all files, present a structured report.

**Per-file section** (only for files with findings):

```
### filename.org — N issues (E errors, W warnings, I info)

| # | Sev     | Rule              | Location    | Detail                              |
|---|---------|-------------------|-------------|-------------------------------------|
| 1 | error   | Missing #+title   | Line 1      | File has no #+title: keyword        |
| 2 | warning | Heading depth > 4 | Line 42     | ***** level 5 heading found         |
| 3 | info    | Backtick usage    | Line 78     | Use ~code~ instead of `code`        |
```

**Summary section:**

```
## Review Summary

| Metric          | Count |
|-----------------+-------|
| Files reviewed  | N     |
| Files clean     | N     |
| Total errors    | N     |
| Total warnings  | N     |
| Total info      | N     |
```

If all files are clean:
```
All N files pass the org-mode style guide.
```
</step>

<step name="offer_next">
Output this directly:

```
───────────────────────────────────────────────────────

## Next Steps

**Fix issues** — Edit files to resolve errors and warnings.
**Re-run review** — /gmsd:org-review [same scope]
**Review templates** — /gmsd:org-review get-my-shit-done/templates/**/*.org

───────────────────────────────────────────────────────
```
</step>

</process>
