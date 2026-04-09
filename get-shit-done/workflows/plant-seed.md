<purpose>
Capture a forward-looking idea as a structured seed file with trigger conditions.
Seeds auto-surface during /gsd-new-milestone when trigger conditions match the
new milestone's scope.

Seeds beat deferred items because they:
- Preserve WHY the idea matters (not just WHAT)
- Define WHEN to surface (trigger conditions, not manual scanning)
- Track breadcrumbs (code references, related decisions)
- Auto-present at the right time via new-milestone scan
</purpose>

<process>

<step name="parse_idea">
Parse `$ARGUMENTS` for the idea summary.

If empty, ask:
```
What's the idea? (one sentence)
```

Store as `$IDEA`.
</step>

<step name="create_seed_dir">
```bash
mkdir -p .planning/seeds
```
</step>

<step name="gather_context">
Ask focused questions to build a complete seed:

```
AskUserQuestion(
  header: "Trigger",
  question: "When should this idea surface? (e.g., 'when we add user accounts', 'next major version', 'when performance becomes a priority')",
  options: []  // freeform
)
```

Store as `$TRIGGER`.

```
AskUserQuestion(
  header: "Why",
  question: "Why does this matter? What problem does it solve or what opportunity does it create?",
  options: []
)
```

Store as `$WHY`.

```
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
</step>

<step name="collect_breadcrumbs">
Search the codebase for relevant references:

```bash
# Find files related to the idea keywords
grep -rl "$KEYWORD" --include="*.ts" --include="*.js" --include="*.md" . 2>/dev/null | head -10
```

Also check:
- Current STATE.md for related decisions
- ROADMAP.md for related phases
- todos/ for related captured ideas

Store relevant file paths as `$BREADCRUMBS`.
</step>

<step name="generate_seed_id">
```bash
# Find next seed number
EXISTING=$( (ls .planning/seeds/SEED-*.md 2>/dev/null || true) | wc -l )
NEXT=$((EXISTING + 1))
PADDED=$(printf "%03d" $NEXT)
```

Generate slug from idea summary.
</step>

<step name="write_seed">
Write `.planning/seeds/SEED-{PADDED}-{slug}.md`:

```markdown
---
id: SEED-{PADDED}
status: dormant
planted: {ISO date}
planted_during: {current milestone/phase from STATE.md}
trigger_when: {$TRIGGER}
scope: {$SCOPE}
---

# SEED-{PADDED}: {$IDEA}

## Why This Matters

{$WHY}

## When to Surface

**Trigger:** {$TRIGGER}

This seed should be presented during `/gsd-new-milestone` when the milestone
scope matches any of these conditions:
- {trigger condition 1}
- {trigger condition 2}

## Scope Estimate

**{$SCOPE}** — {elaboration based on scope choice}

## Breadcrumbs

Related code and decisions found in the current codebase:

{list of $BREADCRUMBS with file paths}

## Notes

{any additional context from the current session}
```
</step>

<step name="commit_seed">
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: plant seed — {$IDEA}" --files .planning/seeds/SEED-{PADDED}-{slug}.md
```
</step>

<step name="confirm">
```
✅ Seed planted: SEED-{PADDED}

"{$IDEA}"
Trigger: {$TRIGGER}
Scope: {$SCOPE}
File: .planning/seeds/SEED-{PADDED}-{slug}.md

This seed will surface automatically when you run /gsd-new-milestone
and the milestone scope matches the trigger condition.
```
</step>

</process>

<success_criteria>
- [ ] Seed file created in .planning/seeds/
- [ ] Frontmatter includes status, trigger, scope
- [ ] Breadcrumbs collected from codebase
- [ ] Committed to git
- [ ] User shown confirmation with trigger info
</success_criteria>
