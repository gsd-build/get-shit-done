<purpose>
Capture a forward-looking idea as a structured seed file with trigger conditions.
Seeds auto-surface during /gsd-new-milestone when trigger conditions match the
new milestone's scope.

Seeds beat deferred items because they:
- Preserve WHY the idea matters (not just WHAT)
- Define WHEN to surface (trigger conditions, not manual scanning)
- Track breadcrumbs (code references, related decisions)
- Auto-present at the right time via new-milestone scan

**One-shot capture**: the seed file is written immediately from the idea text alone.
Trigger / Why / Scope are optional enrichment — they can be provided now or added
later. The file is never gated behind questions.
</purpose>

<process>

<step name="parse-idea">
Parse `$ARGUMENTS` for the idea summary.

First, check for an enrich flag:

```bash
if echo "$ARGUMENTS" | grep -qE '\-\-enrich[[:space:]]+SEED-[0-9]+'; then
  ENRICH_TARGET=$(echo "$ARGUMENTS" | grep -oE 'SEED-[0-9]+')
  SEED_FILE=$(ls .planning/seeds/${ENRICH_TARGET}-*.md 2>/dev/null | head -1)
  # Skip to enrich-seed step — do not prompt for $IDEA
else
  if [ -n "$ARGUMENTS" ]; then
    IDEA="$ARGUMENTS"
  else
    # Ask only when no arguments at all
    # What's the idea? (one sentence)
    IDEA="<user response>"
  fi
fi
```

If `$ENRICH_TARGET` is set, skip straight to the `enrich-seed` step. Do not set `$IDEA` and do not run `create-seed-dir`, `generate-seed-id`, `write-seed`, `collect-breadcrumbs`, `commit-seed`, or `confirm`.

If `$ARGUMENTS` is non-empty and contains no `--enrich` flag, treat the full value as `$IDEA` (no prompt).

Only prompt for the idea when `$ARGUMENTS` is empty and no enrich target is present. Store the response as `$IDEA`.
</step>

<step name="create-seed-dir">
```bash
mkdir -p .planning/seeds
```
</step>

<step name="generate-seed-id">
```bash
# Find next seed number
EXISTING=$( (ls .planning/seeds/SEED-*.md 2>/dev/null || true) | wc -l )
NEXT=$((EXISTING + 1))
PADDED=$(printf "%03d" $NEXT)
```

Generate slug from idea summary.
</step>

<step name="write-seed">
Write `.planning/seeds/SEED-{PADDED}-{slug}.md` immediately with sensible defaults:

- `trigger_when`: default is `"when relevant"` — the seed will surface during any
  new-milestone scan; the user can narrow it later via `--enrich`
- `scope`: default is `"unknown"` — the user can update it via `--enrich`

```markdown
---
id: SEED-{PADDED}
status: dormant
planted: {ISO date}
planted_during: {current milestone/phase from STATE.md, or "unknown" if not in a GSD project}
trigger_when: when relevant
scope: unknown
---

# SEED-{PADDED}: {$IDEA}

## Why This Matters

_To be filled in. Run `/gsd-capture --seed --enrich SEED-{PADDED}` to add context._

## When to Surface

**Trigger:** when relevant

This seed will surface during `/gsd-new-milestone` when the milestone scope matches.

## Scope Estimate

**Unknown** — run `/gsd-capture --seed --enrich SEED-{PADDED}` to estimate effort.

## Breadcrumbs

_No breadcrumbs collected yet._

## Notes

_Captured via one-shot seed capture. Enrich with trigger, why, and scope at your convenience._
```
</step>

<step name="collect-breadcrumbs">
After writing the file, search the codebase for relevant references:

Extract one or two key terms from `$IDEA` (the most distinctive noun or phrase) and store as `$KEYWORD`.

```bash
# Derive a single keyword for breadcrumb search.
# Lower-case, strip punctuation, take the first token longer than 2 chars.
KEYWORD=$(printf '%s' "$IDEA" \
  | tr '[:upper:]' '[:lower:]' \
  | tr -cs 'a-z0-9' '\n' \
  | awk 'length > 2 {print; exit}')
KEYWORD="${KEYWORD:-seed}"  # fallback to literal "seed" if extraction yields nothing
```

```bash
# Find files related to the idea keywords ($KEYWORD derived from $IDEA)
grep -rl "$KEYWORD" --include="*.ts" --include="*.js" --include="*.md" . 2>/dev/null | head -10
```

Also check:
- Current STATE.md for related decisions
- ROADMAP.md for related phases
- todos/ for related captured ideas

If any breadcrumbs are found, update the Breadcrumbs section of the seed file.
Store relevant file paths as `$BREADCRUMBS`.
</step>

<step name="commit-seed">
```bash
gsd-sdk query commit "docs: plant seed — {$IDEA}" --files .planning/seeds/SEED-{PADDED}-{slug}.md
```
</step>

<step name="confirm">
```text
✅ Seed planted: SEED-{PADDED}

"{$IDEA}"
File: .planning/seeds/SEED-{PADDED}-{slug}.md

Trigger and scope are set to defaults. Run `/gsd-capture --seed --enrich SEED-{PADDED}`
to add trigger conditions, rationale, and scope estimate at your convenience.

This seed will surface automatically when you run /gsd-new-milestone.
```
</step>

<step name="enrich-seed">
**Optional enrichment — only run this step when `--enrich` flag is present.**

If `--enrich` flag is in `$ARGUMENTS`:
- `$ENRICH_TARGET` and `$SEED_FILE` are already set by `parse-idea`. Derive `$SEED_ID` from `$ENRICH_TARGET` (e.g. `SEED_ID="$ENRICH_TARGET"`). If `$SEED_FILE` is empty, fall back to the most-recently modified file in `.planning/seeds/` and set `$SEED_ID` from its filename.
- Ask focused questions to build a complete seed:


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.

```text
AskUserQuestion(
  header: "Trigger",
  question: "When should this idea surface? (e.g., 'when we add user accounts', 'next major version', 'when performance becomes a priority')",
  options: []  // freeform
)
```

Store as `$TRIGGER`.

```text
AskUserQuestion(
  header: "Why",
  question: "Why does this matter? What problem does it solve or what opportunity does it create?",
  options: []
)
```

Store as `$WHY`.

```text
AskUserQuestion(
  header: "Scope",
  question: "How big is this? (rough estimate)",
  options: [
    { label: "Small", description: "A few hours — could be a quick task" },
    { label: "Medium", description: "A phase or two — needs planning" },
    { label: "Large", description: "A full milestone — significant effort" }
  ]
)
```

Store as `$SCOPE`.

Update the seed file's frontmatter and sections with the gathered values:
- Set `trigger_when: {$TRIGGER}`
- Set `scope: {$SCOPE}`
- Fill in `## Why This Matters` with `{$WHY}`
- Fill in `## When to Surface` trigger detail
- Fill in `## Scope Estimate` elaboration

Commit the update:
```bash
gsd-sdk query commit "docs: enrich seed ${SEED_ID} — trigger + why + scope" --files "$SEED_FILE"
```

Confirm:
```text
✅ Seed enriched: ${SEED_ID}
Trigger: {$TRIGGER}
Scope: {$SCOPE}
```
</step>

</process>

<success_criteria>
- [ ] Seed file created in .planning/seeds/ in one step, no questions required
- [ ] Frontmatter includes status, trigger_when (default: "when relevant"), scope (default: "unknown")
- [ ] File is written BEFORE any optional enrichment questions are asked
- [ ] Committed to git
- [ ] User shown confirmation with file path
- [ ] Optional --enrich path available for adding trigger, why, scope post-capture
</success_criteria>
