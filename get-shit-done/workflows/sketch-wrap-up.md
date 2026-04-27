<purpose>
Curate sketch design findings and package them into a persistent project skill for future
UI implementation. Reads from `.planning/sketches/`, writes skill to `./.claude/skills/sketch-findings-[project]/`
(project-local) and summary to `.planning/sketches/WRAP-UP-SUMMARY.md`.
Companion to `/gsd-sketch`.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="banner">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SKETCH WRAP-UP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="gather">
## Gather Sketch Inventory

1. Read `.planning/sketches/MANIFEST.md` for the design direction and reference points
2. Glob `.planning/sketches/*/README.md` and parse YAML frontmatter from each
3. Check if `./.claude/skills/sketch-findings-*/SKILL.md` exists for this project
   - If yes: read its `processed_sketches` list and filter those out
   - If no: all sketches are candidates

If no unprocessed sketches exist:
```
No unprocessed sketches found in `.planning/sketches/`.
Run `/gsd-sketch` first to create design explorations.
```
Exit.

Check `commit_docs` config:
```bash
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
```
</step>

<step name="curate">
## Curate Sketches One-at-a-Time

Present each unprocessed sketch in ascending order. For each sketch, show:

- **Sketch number and name**
- **Design question:** from frontmatter
- **Winner:** which variant was selected (if any)
- **Tags:** from frontmatter
- **Key decisions:** summarize what was decided visually

Then ask the user:

╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Decision Required                               ║
╚══════════════════════════════════════════════════════════════╝

Sketch {NNN}: {name} — Winner: Variant {X}

{key design decisions summary}

──────────────────────────────────────────────────────────────
→ Include / Exclude / Partial / Let me look at it
──────────────────────────────────────────────────────────────

**If "Let me look at it":**
1. Provide: `open .planning/sketches/NNN-name/index.html`
2. Remind them which variant won and what to look for
3. After they've looked, return to the include/exclude/partial decision

**If "Partial":**
Ask what specifically to include or exclude from this sketch's decisions.
</step>

<step name="group">
## Auto-Group by Design Area

After all sketches are curated:

1. Read all included sketches' tags, names, and content
2. Propose design-area groupings, e.g.:
   - "**Layout & Navigation** — sketches 001, 004"
   - "**Form Controls** — sketches 002, 005"
   - "**Color & Typography** — sketches 003"
3. Present the grouping for approval — user may merge, split, rename, or rearrange

Each group becomes one reference file in the generated skill.
</step>

<step name="skill_name">
## Determine Output Skill Name

Derive from the project directory name: `./.claude/skills/sketch-findings-[project-dir-name]/`

If a skill already exists at that path (append mode), update in place.
</step>

<step name="copy_sources">
## Copy Source Files

For each included sketch:

1. Copy the winning variant's HTML file (or the full index.html with all variants) into `sources/NNN-sketch-name/`
2. Copy the winning theme.css into `sources/themes/`
3. Exclude node_modules, build artifacts, .DS_Store
</step>

<step name="synthesize">
## Synthesize Reference Files

For each design-area group, write a reference file at `references/[design-area-name].md`:

```markdown
# [Design Area Name]

## Design Decisions
[For each validated decision: what was chosen, why it won over alternatives, the key visual properties (colors, spacing, border radius, typography)]

## CSS Patterns
[Key CSS snippets from winning variants — layout structures, component patterns, animation patterns. Extracted and cleaned up for reference.]

## HTML Structures
[Key HTML patterns from winning variants — page layout, component markup, navigation structures.]

## What to Avoid
[Design directions that were tried and rejected. Why they didn't work.]

## Origin
Synthesized from sketches: NNN, NNN
Source files available in: sources/NNN-sketch-name/
```
</step>

<step name="write_skill">
## Write SKILL.md

Create (or update) the generated skill's SKILL.md:

```markdown
---
name: sketch-findings-[project-dir-name]
description: Validated design decisions, CSS patterns, and visual direction from sketch experiments. Auto-loaded during UI implementation on [project-dir-name].
---

<context>
## Project: [project-dir-name]

[Design direction paragraph from MANIFEST.md]
[Reference points mentioned during intake]

Sketch sessions wrapped: [date(s)]
</context>

<design_direction>
## Overall Direction

[Summary of the validated visual direction: palette, typography, spacing system, layout approach, interaction patterns]
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| [Name] | references/[name].md | [One-line summary] |

## Theme

The winning theme file is at `sources/themes/default.css`.

## Source Files

Original sketch HTML files are preserved in `sources/` for complete reference.
</findings_index>

<metadata>
## Processed Sketches

[List of sketch numbers wrapped up]

- 001-sketch-name
- 002-sketch-name
</metadata>
```
</step>

<step name="write_summary">
## Write Planning Summary

Write `.planning/sketches/WRAP-UP-SUMMARY.md` for project history:

```markdown
# Sketch Wrap-Up Summary

**Date:** [date]
**Sketches processed:** [count]
**Design areas:** [list]
**Skill output:** `./.claude/skills/sketch-findings-[project]/`

## Included Sketches
| # | Name | Winner | Design Area |
|---|------|--------|-------------|

## Excluded Sketches
| # | Name | Reason |
|---|------|--------|

## Design Direction
[consolidated design direction summary]

## Key Decisions
[layout, palette, typography, spacing, interaction patterns]
```
</step>

<step name="update_claude_md">
## Update Project CLAUDE.md

Add an auto-load routing line:

```
- **Sketch findings for [project]** (design decisions, CSS patterns, visual direction) → `Skill("sketch-findings-[project-dir-name]")`
```

If this routing line already exists (append mode), leave it as-is.
</step>

<step name="commit">
Commit all artifacts (if `COMMIT_DOCS` is true):

```bash
gsd-sdk query commit "docs(sketch-wrap-up): package [N] sketch findings into project skill" --files .planning/sketches/WRAP-UP-SUMMARY.md
```
</step>

<step name="report">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SKETCH WRAP-UP COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Curated:** {N} sketches ({included} included, {excluded} excluded)
**Design areas:** {list}
**Skill:** `./.claude/skills/sketch-findings-[project]/`
**Summary:** `.planning/sketches/WRAP-UP-SUMMARY.md`
**CLAUDE.md:** routing line added

The sketch-findings skill will auto-load when building the UI.
```

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Explore frontier sketches** — see what else is worth sketching based on what we've explored

`/gsd-sketch` (run with no argument — its frontier mode analyzes the sketch landscape and proposes consistency and frontier sketches)

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd-plan-phase` — start building the real UI
- `/gsd-ui-phase` — generate a UI design contract for a frontend phase
- `/gsd-sketch [idea]` — sketch a specific new design area
- `/gsd-explore` — continue exploring

───────────────────────────────────────────────────────────────
</step>

</process>

<success_criteria>
- [ ] Every unprocessed sketch presented for individual curation
- [ ] Design-area grouping proposed and approved
- [ ] Sketch-findings skill exists at `./.claude/skills/` with SKILL.md, references/, sources/
- [ ] Winning theme.css copied into skill sources
- [ ] Reference files contain design decisions, CSS patterns, HTML structures, anti-patterns
- [ ] `.planning/sketches/WRAP-UP-SUMMARY.md` written for project history
- [ ] Project CLAUDE.md has auto-load routing line
- [ ] Summary presented
- [ ] Next-step options presented (including frontier sketch exploration via `/gsd-sketch`)
</success_criteria>
