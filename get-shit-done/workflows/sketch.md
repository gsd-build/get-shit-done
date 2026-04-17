<purpose>
Explore design directions through throwaway HTML mockups before committing to implementation.
Each sketch produces 2-3 variants for comparison. Saves artifacts to `.planning/sketches/`.
Companion to `/gsd-sketch-wrap-up`.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@~/.claude/get-shit-done/references/sketch-theme-system.md
@~/.claude/get-shit-done/references/sketch-variant-patterns.md
@~/.claude/get-shit-done/references/sketch-interactivity.md
@~/.claude/get-shit-done/references/sketch-tooling.md
</required_reading>

<process>

<step name="banner">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SKETCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Parse `$ARGUMENTS` for:
- `--quick` flag → set `QUICK_MODE=true`
- `--text` flag → set `TEXT_MODE=true`
- Remaining text → the design idea to sketch

**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
</step>

<step name="setup_directory">
Create `.planning/sketches/` and themes directory if they don't exist:

```bash
mkdir -p .planning/sketches/themes
```

Check for existing sketches to determine numbering:
```bash
ls -d .planning/sketches/[0-9][0-9][0-9]-* 2>/dev/null | sort | tail -1
```

Check `commit_docs` config:
```bash
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
```
</step>

<step name="mood_intake">
**If `QUICK_MODE` is true:** Skip mood intake. Use whatever the user provided in `$ARGUMENTS` as the design direction. Jump to `decompose`.

**Otherwise:**

Before sketching anything, explore the design intent through conversation. Ask one question at a time using AskUserQuestion, with a paragraph of context and reasoning for each.

**Questions to cover (adapt to what the user has already shared):**

1. **Feel:** "What should this feel like? Give me adjectives, emotions, or a vibe." (e.g., "clean and clinical", "warm and playful", "dense and powerful")
2. **References:** "What apps, sites, or products have a similar feel to what you're imagining?" (gives concrete visual anchors)
3. **Core action:** "What's the single most important thing a user does here?" (focuses the sketch on what matters)

You may need more or fewer questions depending on how much the user shares upfront. After each answer, briefly reflect what you heard and how it shapes your thinking.

When you have enough signal, ask: **"I think I have a good sense of the direction. Ready for me to sketch, or want to keep discussing?"**

Only proceed when the user says go.
</step>

<step name="decompose">
Break the idea into 2-5 design questions. Present as a table:

| Sketch | Design question | Approach | Risk |
|--------|----------------|----------|------|
| 001 | Does a two-panel layout feel right? | Sidebar + main, variants: fixed/collapsible/floating | **High** — sets page structure |
| 002 | How should the form controls look? | Grouped cards, variants: stacked/inline/floating labels | Medium |

Each sketch answers one specific visual question. Good sketches:
- "Does this layout feel right?" — build with real-ish content
- "How should these controls be grouped?" — build with actual labels and inputs
- "What does this interaction feel like?" — build the hover/click/transition
- "Does this color palette work?" — apply to actual UI, not a swatch grid

Bad sketches:
- "Design the whole app" — too broad
- "Set up the component library" — that's implementation
- "Pick a color palette" — apply it to UI instead

Present the table and get alignment before building.
</step>

<step name="create_manifest">
Create or update `.planning/sketches/MANIFEST.md`:

```markdown
# Sketch Manifest

## Design Direction
[One paragraph capturing the mood/feel/direction from the intake conversation]

## Reference Points
[Apps/sites the user referenced]

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
```

If MANIFEST.md already exists, append new sketches to the existing table.
</step>

<step name="create_theme">
If no theme exists yet at `.planning/sketches/themes/default.css`, create one based on the mood/direction from the intake step. See `sketch-theme-system.md` for the full template.

Adapt colors, fonts, spacing, and shapes to match the agreed aesthetic — don't use the defaults verbatim unless they match the mood.
</step>

<step name="build_sketches">
Build each sketch in order.

### For Each Sketch:

**a.** Find next available number by checking existing `.planning/sketches/NNN-*/` directories.
Format: three-digit zero-padded + hyphenated descriptive name.

**b.** Create the sketch directory: `.planning/sketches/NNN-descriptive-name/`

**c.** Build `index.html` with 2-3 variants:

**First round — dramatic differences:** Build 2-3 meaningfully different approaches to the design question. Different layouts, different visual structures, different interaction models.

**Subsequent rounds — refinements:** Once the user has picked a direction or cherry-picked elements, build subtler variations within that direction.

Each variant is a page/tab in the same HTML file. Include:
- Tab navigation to switch between variants (see `sketch-variant-patterns.md`)
- Clear labels: "Variant A: Sidebar Layout", "Variant B: Top Nav", etc.
- The sketch toolbar (see `sketch-tooling.md`)
- All interactive elements functional (see `sketch-interactivity.md`)
- Real-ish content, not lorem ipsum
- Link to `../themes/default.css` for shared theme variables

**All sketches are plain HTML with inline CSS and JS.** No build step, no npm, no framework. Opens instantly in a browser.

**d.** Write `README.md`:

```markdown
---
sketch: NNN
name: descriptive-name
question: "What layout structure feels right for the dashboard?"
winner: null
tags: [layout, dashboard]
---

# Sketch NNN: Descriptive Name

## Design Question
[The specific visual question this sketch answers]

## How to View
open .planning/sketches/NNN-descriptive-name/index.html

## Variants
- **A: [name]** — [one-line description of this approach]
- **B: [name]** — [one-line description]
- **C: [name]** — [one-line description]

## What to Look For
[Specific things to pay attention to when comparing variants]
```

**e.** Present to the user with a checkpoint:

╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                           ║
╚══════════════════════════════════════════════════════════════╝

**Sketch {NNN}: {name}**

Open: `open .planning/sketches/NNN-name/index.html`

Compare: {what to look for between variants}

──────────────────────────────────────────────────────────────
→ Which variant feels right? Or cherry-pick elements across variants.
──────────────────────────────────────────────────────────────

**f.** Handle feedback:
- **Pick a direction:** "I like variant B" → mark winner in README, move to next sketch
- **Cherry-pick elements:** "Rounded edges from A, color treatment from C" → build a synthesis as a new variant, show again
- **Want more exploration:** "None of these feel right, try X instead" → build new variants

Iterate until the user is satisfied with a direction for this sketch.

**g.** Finalize:
1. Mark the winning variant in the README frontmatter (`winner: "B"`)
2. Add ★ indicator to the winning tab in the HTML
3. Update `.planning/sketches/MANIFEST.md` with the sketch row

**h.** Commit (if `COMMIT_DOCS` is true):
```bash
gsd-sdk query commit "docs(sketch-NNN): [winning direction] — [key visual insight]" .planning/sketches/NNN-descriptive-name/ .planning/sketches/MANIFEST.md
```

**i.** Report:
```
◆ Sketch NNN: {name}
  Winner: Variant {X} — {description}
  Insight: {key visual decision made}
```
</step>

<step name="report">
After all sketches complete, present the summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SKETCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Design Direction
{what we landed on overall}

## Key Decisions
{layout, palette, typography, spacing, interaction patterns}

## Open Questions
{anything unresolved or worth revisiting}
```

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Package findings** — wrap design decisions into a reusable skill

`/gsd-sketch-wrap-up`

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd-plan-phase` — start building the real UI
- `/gsd-explore` — continue exploring the concept
- `/gsd-spike` — spike technical feasibility of a design pattern

───────────────────────────────────────────────────────────────
</step>

</process>

<success_criteria>
- [ ] `.planning/sketches/` created (auto-creates if needed, no project init required)
- [ ] Design direction explored conversationally before any code (unless --quick)
- [ ] Each sketch has 2-3 variants for comparison
- [ ] User can open and interact with sketches in a browser
- [ ] Winning variant selected and marked for each sketch
- [ ] All variants preserved (winner marked, not others deleted)
- [ ] MANIFEST.md is current
- [ ] Commits use `docs(sketch-NNN): [winner]` format
- [ ] Summary presented with next-step routing
</success_criteria>
