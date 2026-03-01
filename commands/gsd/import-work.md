---
name: gsd:import-work
description: Import completed work done outside GSD into planning files (new milestone or extra phases)
argument-hint: "[path/to/tasks or path/to/folder or description]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

<objective>
Import work completed outside of GSD into the `.planning/` directory so that GSD has full context of what was built.

Supports two modes (auto-selected based on current state):
1. **New milestone** — current milestone is idle/complete → create a new completed milestone
2. **Extra phases** — milestone is in-progress → append phases to it

Designed to be fast. The only user checkpoint is the import plan review — everything else is auto-decided from context, config, and the work being imported.
</objective>

<execution_context>
No external workflow file — this command is self-contained.

**Files to read before proceeding:**
- `.planning/MILESTONES.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`
- `.planning/config.json` (for mode: yolo/interactive and commit_docs)
</execution_context>

<context>
Arguments: $ARGUMENTS

Accepts any of:
- Path to a single task file: `/gsd:import-work .agents/tasks/v3/01-feature.md`
- Path to a folder: `/gsd:import-work .agents/tasks/v3/`
- Multiple paths: `/gsd:import-work file1.md file2.md file3.md`
- Freeform description: `/gsd:import-work Added semantic search and skills system`
- Empty (no args): prompts user with a single open-ended question
</context>

<process>

<step name="gather_input">

**Determine the source of completed work.**

If `$ARGUMENTS` is provided:
- If it resolves to a directory → glob `*.md` files, read all
- If it resolves to one or more file paths → read each
- If it doesn't look like a path (no `/`, `\`, or `.md`) → treat as freeform description of the work. Supplement with `git log --oneline -20` to extract commits, files changed, and dates.

If `$ARGUMENTS` is empty, ask ONE open-ended question:

```
What work should I import? You can:
- Paste a path to a file or folder
- Describe what was built
```

Then apply the same detection logic above to the response.
</step>

<step name="read_planning_state">

Read all planning files in parallel:

1. `.planning/MILESTONES.md` — latest version number
2. `.planning/ROADMAP.md` — latest phase number, milestone structure
3. `.planning/STATE.md` — current status (`idle`, `in_progress`, etc.)
4. `.planning/PROJECT.md` — requirements, context, decisions
5. `.planning/config.json` — `mode` (yolo/interactive), `commit_docs`

Extract:
- `latest_milestone_version` (e.g., "v3.0")
- `latest_phase_number` (e.g., 14)
- `current_status` (from STATE.md YAML frontmatter)
- `config_mode` (yolo or interactive)
- `commit_docs` (true/false)
</step>

<step name="analyze_and_decide">

**Analyze the work AND auto-decide import mode in one step.**

For each work item, extract:
- **Title** — what was built
- **Description** — summary of deliverables
- **Files changed** — source files created/modified
- **Dependencies added** — new packages
- **Key decisions** — architectural choices made
- **Commits** — git hashes (if mentioned in task files or git log)
- **Date completed** — from task files, fall back to today

Group related items into logical phases (1 phase per distinct feature/system).

**Auto-decide import mode:**
- If `current_status` is `idle` or contains `complete` → **new milestone**
- If `current_status` is `in_progress` or `executing` → **extra phases** in current milestone
- Only ask the user if status is genuinely ambiguous (rare edge case)

**Auto-generate milestone name** (new milestone mode):
- Synthesize a 2-4 word name from the work themes (e.g., "Smart Memory & Knowledge", "Auth Hardening", "Developer Tools")
- Auto-calculate next version: increment minor (v3.0 → v3.1) for small scope (1-2 phases), increment major (v3.0 → v4.0) for larger scope (3+ phases)

**Gather stats** (run in parallel with analysis):

```bash
# LOC — detect language from project
find src/ -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1
find src/ -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | wc -l
git log --oneline -20
```

Test count (detect framework):
```bash
python -m pytest tests/ --tb=no -q 2>/dev/null | tail -3   # Python
npx jest --passWithNoTests 2>/dev/null | tail -5            # JS/TS
```
</step>

<step name="present_import_plan">

**Single checkpoint — the only place the user reviews before writes happen.**

Present the full import plan:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► IMPORT PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mode: New milestone v{version} "{name}"
      (or: Adding {N} phases to {current_milestone})

Phases to import:

| # | Phase {N}+  | Name                  | Plans | Source        |
|---|-------------|-----------------------|-------|---------------|
| 1 | Phase {N+1} | {name}                | {n}   | {file or desc}|
| 2 | Phase {N+2} | {name}                | {n}   | {file or desc}|

Stats: ~{LOC} LOC | {files} source files | {tests} tests

Files that will be created/updated:
  ○ .planning/MILESTONES.md
  ○ .planning/ROADMAP.md
  ○ .planning/STATE.md
  ○ .planning/PROJECT.md
  ○ .planning/milestones/v{version}-ROADMAP.md
  ○ .planning/milestones/v{version}-phases/{NN}-SUMMARY.md (×{N})
```

**In `yolo` mode:** Auto-approve after displaying. Show `⚡ Auto-approved` and proceed.

**In `interactive` mode:** Wait for user confirmation. User can adjust phase names, groupings, milestone name, or version number. Accept "ok", "approved", "yes", "looks good", etc.
</step>

<step name="execute_import">

**Write all files atomically.** No further user interaction from here.

### For new milestone mode:

1. **Create milestone ROADMAP archive** → `.planning/milestones/v{version}-ROADMAP.md`

```markdown
# v{version} {Name} — Roadmap

## Milestone Goal

{Synthesized from work items}

## Phases

### Phase {N}: {Name}
**Plans:** {count}
**Status:** ✅ Complete ({date})
**Goal:** {description}

**Deliverables:**
- {bullet points from task files}

**Files changed:** {list}
**Commits:** {hashes}

## Progress Summary

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
{rows}

---
*Created: {date}*
```

2. **Create phase summary files** → `.planning/milestones/v{version}-phases/{NN}-SUMMARY.md`

```markdown
# Phase {N}: {Name} — Summary

**Status:** ✅ Complete
**Completed:** {date}
**Milestone:** v{version} {Name}
**Executed outside GSD:** Yes (retroactively documented)

## Goal
{goal}

## What Was Delivered
{numbered list}

## Key Decisions
{bullets}

## Files Changed
| File | Change |
|------|--------|
{table}

## Commits
{list}

---
*Created: {date}*
```

3. **Append to MILESTONES.md** (after last `---`):

```markdown
## v{version} {Name} (Shipped: {date})

**Phases completed:** {N} phases ({range}), {plans} plans

**Delivered:** {One paragraph summary}

**Key accomplishments:**
1. {accomplishment}
...

**Stats:** ~{LOC} LOC {lang} | {files} source files | {tests} tests | {date}
**Git range:** `{first}` → `{last}`

**Archive:** `.planning/milestones/v{version}-ROADMAP.md`

---
```

4. **Update ROADMAP.md:**
   - Change `📋 **v{version} [TBD]**` to `✅ **v{version} {Name}** — Phases {range} (shipped {date})`
   - Add `<details>` block with phase checkboxes
   - Add rows to Progress table
   - Add next version placeholder
   - Update footer

5. **Update STATE.md:**
   - YAML frontmatter: `milestone: v{version}-complete`, `status: idle`, progress counters
   - Body: project reference, current position, key decisions, session continuity

6. **Update PROJECT.md:**
   - Requirements → Validated: add `- ✓` entries for delivered capabilities
   - Out of Scope: strike through delivered items (`~~text~~ — **delivered in v{version}**`)
   - Context: update LOC, file count, tech stack, architecture
   - Key Decisions: add new table rows
   - Constraints: update if deps/budget changed
   - Footer: update "Last updated"

### For extra phases mode:

Same updates to ROADMAP.md (phases + progress table), STATE.md (counters), and PROJECT.md (requirements, context). No MILESTONES.md entry or milestone archive files.
</step>

<step name="commit_and_finish">

**Auto-commit if `commit_docs` is true in config.json** (default for most GSD setups). If false or config doesn't exist, skip commit silently.

```bash
git add .planning/
git commit -m "docs(planning): import v{version} {name} milestone from external work"
```

Present completion:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► IMPORT COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v{version} {Name} — {N} phases imported

Files updated:
  ✓ .planning/MILESTONES.md
  ✓ .planning/ROADMAP.md
  ✓ .planning/STATE.md
  ✓ .planning/PROJECT.md
  ✓ .planning/milestones/v{version}-ROADMAP.md
  ✓ .planning/milestones/v{version}-phases/ ({N} summaries)

{If committed: "✓ Committed: docs(planning): import v{version} ..."}

---

## ▶ Next Up

**Start Next Milestone** — define scope for v{next}

`/gsd:new-milestone`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:progress` — check current state
- `/gsd:add-phase <description>` — add more phases

---
```
</step>

</process>

<critical_rules>

- **Read before writing:** Always read existing planning files before modifying — never overwrite blindly
- **Preserve structure:** Follow exact GSD markdown conventions (collapsible details, progress tables, status symbols)
- **Phase numbering:** Continue from the last phase number in ROADMAP.md — never reuse or skip
- **Milestone versioning:** Follow existing pattern (v1.0, v2.0, v2.1, v3.0)
- **No fabrication:** Only document what task files or the user describes — do not invent features or decisions
- **One checkpoint only:** Present the import plan, then execute. Do not ask follow-up questions during the write phase.
- **Respect config mode:** In yolo mode, auto-approve the import plan. In interactive mode, wait for confirmation.
- **Respect commit_docs:** Auto-commit if true, skip if false. Never ask.
- **Atomic updates:** Update ALL planning files in one pass — partial updates leave GSD inconsistent
- **Date accuracy:** Use dates from task files when available, fall back to today
- **UI consistency:** Use GSD UI patterns (banners, status symbols, tables)

</critical_rules>

<success_criteria>

- [ ] Work items gathered from args (path, folder, description, or prompted)
- [ ] Import mode auto-decided from STATE.md status
- [ ] Milestone name and version auto-generated
- [ ] Import plan presented (auto-approved in yolo, confirmed in interactive)
- [ ] All planning files updated consistently:
  - [ ] MILESTONES.md (new milestone mode only)
  - [ ] ROADMAP.md (milestone list, phases, progress table)
  - [ ] STATE.md (frontmatter + body)
  - [ ] PROJECT.md (requirements, context, decisions, constraints)
- [ ] Phase summary files created in milestones directory
- [ ] Milestone ROADMAP archive created (new milestone mode only)
- [ ] Stats gathered and included (LOC, files, tests)
- [ ] Auto-committed per config (or skipped)
- [ ] Next steps presented

</success_criteria>
