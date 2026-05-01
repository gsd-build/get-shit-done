<purpose>
Explore design directions through throwaway HTML mockups before committing to implementation.
Each sketch produces 2-3 variants for comparison. Saves artifacts to `.planning/sketches/`.
Companion to `/gsd-sketch --wrap-up`.

Supports two modes:
- **Idea mode** (default) — user describes a design idea to sketch
- **Frontier mode** — no argument or "frontier" / "what should I sketch?" — analyzes existing sketch landscape and proposes consistency and frontier sketches
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
- `frontier` or empty → set `FRONTIER_MODE=true`
- Remaining text → the design idea to sketch

**Text mode:** If TEXT_MODE is enabled, replace AskUserQuestion calls with plain-text numbered lists.
</step>

<step name="route">
## Routing

- **FRONTIER_MODE is true** → Jump to `frontier_mode`
- **Otherwise** → Continue to `setup_directory`
</step>

<step name="frontier_mode">
## Frontier Mode — Propose What to Sketch Next

### Load the Sketch Landscape

If no `.planning/sketches/` directory exists, tell the user there's nothing to analyze and offer to start fresh with an idea instead.

Otherwise, load in this order:

**a. MANIFEST.md** — the design direction, reference points, and sketch table with winners.

**b. Findings skills** — glob `./.claude/skills/sketch-findings-*/SKILL.md` and read any that exist, plus their `references/*.md`. These contain curated design decisions from prior wrap-ups.

**c. All sketch READMEs** — read `.planning/sketches/*/README.md` for design questions, winners, and tags.

### Analyze for Consistency Sketches

Review winning variants across all sketches. Look for:

- **Visual consistency gaps:** Two sketches made independent design choices that haven't been tested together.
- **State combinations:** Individual states validated but not seen in sequence.
- **Responsive gaps:** Validated at one viewport but the real app needs multiple.
- **Theme coherence:** Individual components look good but haven't been composed into a full-page view.

If consistency risks exist, present them as concrete proposed sketches with names and design questions. If no meaningful gaps, say so and skip.

### Analyze for Frontier Sketches

Think laterally about the design direction from MANIFEST.md and what's been explored:

- **Unsketched screens:** UI surfaces assumed but unexplored.
- **Interaction patterns:** Static layouts validated but transitions, loading, drag-and-drop need feeling.
- **Edge case UI:** 0 items, 1000 items, errors, slow connections.
- **Alternative directions:** Fresh takes on "fine but not great" sketches.
- **Polish passes:** Typography, spacing, micro-interactions, empty states.

Present frontier sketches as concrete proposals numbered from the highest existing sketch number.

### Get Alignment and Execute

Present all consistency and frontier candidates, then ask which to run. When the user picks sketches, update `.planning/sketches/MANIFEST.md` and proceed directly to building them starting at `build_sketches`.
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
**If `QUICK_MODE` is true:** Skip mood intake. Use whatever the user provided in `$ARGUMENTS` as the design direction. Jump to `load_spike_context`.

**Otherwise:**

Before sketching anything, explore the design intent through conversation. Ask one question at a time — using AskUserQuestion in normal mode, or a plain-text numbered list if TEXT_MODE is active.

**Questions to cover (adapt to what the user has already shared):**

1. **Feel:** "What should this feel like? Give me adjectives, emotions, or a vibe."
2. **References:** "What apps, sites, or products have a similar feel to what you're imagining?"
3. **Core action:** "What's the single most important thing a user does here?"

After each answer, briefly reflect what you heard and how it shapes your thinking.

When you have enough signal, ask: **"I think I have a good sense of the direction. Ready for me to sketch, or want to keep discussing?"**

Only proceed when the user says go.
</step>

<step name="load_spike_context">
## Load Spike Context

If spikes exist for this project, read them to ground the sketches in reality. Mockups are still pure HTML, but they should reflect what's actually been proven — real data shapes, real component names, real interaction patterns.

**a.** Glob for `./.claude/skills/spike-findings-*/SKILL.md` and read any that exist, plus their `references/*.md`. These contain validated patterns and requirements.

**b.** Read `.planning/spikes/MANIFEST.md` if it exists — check the Requirements section for non-negotiable design constraints (e.g., "must support streaming", "must render markdown"). These requirements should be visible in the mockup even though the mockup doesn't implement them for real.

**c.** Read `.planning/spikes/CONVENTIONS.md` if it exists — the established stack informs what's buildable and what interaction patterns are idiomatic.

**How spike context improves sketches:**
- Use real field names and data shapes from spike findings instead of generic placeholders
- Show realistic UI states that match what the spikes proved (e.g., if streaming was validated, show a streaming message state)
- Reference real component names and patterns from the target stack
- Include interaction states that reflect what the spikes discovered (loading, error, reconnection states)

**If no spikes exist**, skip this step.
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

<step name="research_stack">
## Research the Target Stack

Before sketching, ground the design in what's actually buildable. Sketches are HTML, but they should reflect real constraints of the target implementation.

**a. Identify the target stack.** Check for package.json, Cargo.toml, etc. If the user mentioned a framework (React, SwiftUI, Flutter, etc.), note it.

**b. Check component/pattern availability.** Use context7 (resolve-library-id → query-docs) or web search to answer:
- What layout primitives does the target framework provide?
- Are there existing component libraries in use? What components are available?
- What interaction patterns are idiomatic?

**c. Note constraints that affect design:**
- Platform conventions (iOS nav patterns, desktop menu bars, terminal grid constraints)
- Framework limitations (what's easy vs requires custom work)
- Existing design tokens or theme systems already in the project

**d. Let research inform variants.** At least one variant should follow the path of least resistance for the target stack.

**Skip when unnecessary.** Greenfield project with no stack, or user says "just explore visually." The point is grounding, not gatekeeping.
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

**a.** Find next available number. Format: three-digit zero-padded + hyphenated descriptive name.

**b.** Create the sketch directory: `.planning/sketches/NNN-descriptive-name/`

**c.** Build `index.html` with 2-3 variants:

**First round — dramatic differences:** 2-3 meaningfully different approaches.
**Subsequent rounds — refinements:** Subtler variations within the chosen direction.

Each variant is a page/tab in the same HTML file. Include:
- Tab navigation to switch between variants (see `sketch-variant-patterns.md`)
- Clear labels: "Variant A: Sidebar Layout", "Variant B: Top Nav", etc.
- The sketch toolbar (see `sketch-tooling.md`)
- All interactive elements functional (see `sketch-interactivity.md`)
- Real-ish content, not lorem ipsum (use real field names from spike context if available)
- Link to `../themes/default.css` for shared theme variables

**All sketches are plain HTML with inline CSS and JS.** No build step, no npm, no framework.

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
- **Pick a direction:** mark winner, move to next sketch
- **Cherry-pick elements:** build synthesis as new variant, show again
- **Want more exploration:** build new variants

Iterate until satisfied.

**g.** Finalize:
1. Mark winning variant in README frontmatter (`winner: "B"`)
2. Add ★ indicator to winning tab in HTML
3. Update `.planning/sketches/MANIFEST.md`

**h.** Commit (if `COMMIT_DOCS` is true):
```bash
gsd-sdk query commit "docs(sketch-NNN): [winning direction] — [key visual insight]" --files .planning/sketches/NNN-descriptive-name/ .planning/sketches/MANIFEST.md
```

**i.** Report:
```
◆ Sketch NNN: {name}
  Winner: Variant {X} — {description}
  Insight: {key visual decision made}
```
</step>

<step name="report">
After all sketches complete:

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

`/gsd-sketch --wrap-up`

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd-sketch` — sketch more (or run with no argument for frontier mode)
- `/gsd-plan-phase` — start building the real UI
- `/gsd-spike` — spike technical feasibility of a design pattern

───────────────────────────────────────────────────────────────
</step>

</process>

<success_criteria>
- [ ] `.planning/sketches/` created (auto-creates if needed, no project init required)
- [ ] Design direction explored conversationally before any code (unless --quick)
- [ ] Spike context loaded — real data shapes, requirements, and conventions inform mockups
- [ ] Target stack researched — component availability, constraints, idioms (unless greenfield/skipped)
- [ ] Each sketch has 2-3 variants for comparison (at least one follows path of least resistance)
- [ ] User can open and interact with sketches in a browser
- [ ] Winning variant selected and marked for each sketch
- [ ] All variants preserved (winner marked, not others deleted)
- [ ] MANIFEST.md is current
- [ ] Commits use `docs(sketch-NNN): [winner]` format
- [ ] Summary presented with next-step routing
</success_criteria>
