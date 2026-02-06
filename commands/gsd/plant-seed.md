---
name: gsd:plant-seed
description: Capture a forward-looking idea with trigger conditions so it surfaces automatically at the right milestone
argument-hint: "[idea summary, e.g., 'benchmark scraping from canada.ca']"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - AskUserQuestion
---

<objective>
Capture an idea that's too big for now but should surface automatically when the right milestone arrives.

Seeds solve context rot: instead of a one-liner in Deferred that nobody reads, a seed preserves the full WHY, WHEN to surface, and breadcrumbs to details. The `/gsd:new-milestone` command scans seeds and presents matches.

**Creates:** `.planning/seeds/SEED-NNN-slug.md`
**Consumed by:** `/gsd:new-milestone` (Phase 1.5: Seed Scan)
</objective>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
</context>

<process>

**Step 1: Pre-flight validation**

Check that an active GSD project exists:

```bash
if [ ! -f .planning/PROJECT.md ]; then
  echo "Seed planting requires an active project with PROJECT.md."
  echo "Run /gsd:new-project first."
  exit 1
fi
```

If validation fails, stop immediately with the error message.

---

**Step 2: Capture the idea**

If `$ARGUMENTS` is provided, use it as the idea summary.

If `$ARGUMENTS` is empty, prompt:

```
AskUserQuestion(
  header: "Seed",
  question: "What's the idea you want to plant for the future?",
  options: (none — free text via "Other")
)
```

Wait — AskUserQuestion needs options. Instead, just ask conversationally:

"What's the idea? Give me the elevator pitch — one or two sentences."

Store response as `$IDEA_SUMMARY`.

---

**Step 3: Gather seed context**

Ask these questions conversationally (not all at once — natural flow):

1. **Why does this matter?** — What problem does it solve or what value does it add?
2. **What triggered this?** — What were you working on when this came up?
3. **When should this surface?** — Which milestone topic, feature area, or keyword should trigger it?
4. **Any breadcrumbs?** — Files, URLs, code references, research that future-you should read?
5. **How big is this?** — Quick task, a phase, or a whole milestone?

Store responses as:
- `$WHY`
- `$TRIGGER_CONTEXT` (what you were doing when the idea came up)
- `$TRIGGER_WHEN` (milestone topic / keyword / condition)
- `$BREADCRUMBS` (files, URLs, references)
- `$SCOPE_ESTIMATE` (quick / phase / milestone)

---

**Step 4: Calculate seed number and create directory**

```bash
mkdir -p .planning/seeds

# Find highest existing seed number and increment
last=$(ls -1 .planning/seeds/SEED-[0-9][0-9][0-9]-* 2>/dev/null | sort -r | head -1 | xargs -I{} basename {} | grep -oE '^SEED-([0-9]+)' | grep -oE '[0-9]+')

if [ -z "$last" ]; then
  next_num="001"
else
  next_num=$(printf "%03d" $((10#$last + 1)))
fi
```

Generate slug from idea summary:
```bash
slug=$(echo "$IDEA_SUMMARY" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)
```

---

**Step 5: Determine current context**

Read STATE.md to extract:
- Current milestone (if any)
- Current phase (if any)
- Date

These go into the `planted_during` metadata.

---

**Step 6: Write seed file**

Write to `.planning/seeds/SEED-${next_num}-${slug}.md`:

```markdown
---
seed: ${next_num}
planted: [today's date]
planted_during: [current milestone/phase or "between milestones"]
status: dormant
trigger_when: "${TRIGGER_WHEN}"
scope: "${SCOPE_ESTIMATE}"
---

# Seed ${next_num}: ${IDEA_SUMMARY}

## The Idea

${IDEA_SUMMARY}

## Why This Matters

${WHY}

## What Triggered This

${TRIGGER_CONTEXT}

## When to Surface

**Trigger condition:** Surface this seed when ANY of:
- [Derive 2-3 specific trigger conditions from $TRIGGER_WHEN]
- [e.g., "Starting a milestone involving [topic]"]
- [e.g., "Planning any phase involving [keyword]"]
- [e.g., "User mentions [related concept]"]

## Breadcrumbs

${BREADCRUMBS}

Format as:
- `path/to/file.md` — what it contains
- `path/to/code.py:L42` — relevant function/class
- `https://url` — external reference

If no breadcrumbs, write: "No existing artifacts. Research needed when harvested."

## Suggested Scope

${SCOPE_ESTIMATE} — [brief justification]

---
*Planted: [date] | Status: dormant | Scan: /gsd:new-milestone*
```

---

**Step 7: Commit**

Check planning config:
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

If `COMMIT_PLANNING_DOCS=true` (default):
```bash
git add .planning/seeds/SEED-${next_num}-${slug}.md
git commit -m "$(cat <<'EOF'
seed(${next_num}): ${IDEA_SUMMARY}

Planted for future milestone. Trigger: ${TRIGGER_WHEN}

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

**Step 8: Confirmation**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SEED PLANTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Seed ${next_num}: ${IDEA_SUMMARY}

| Field          | Value                              |
|----------------|------------------------------------|
| File           | .planning/seeds/SEED-${next_num}-${slug}.md |
| Trigger        | ${TRIGGER_WHEN}                    |
| Scope          | ${SCOPE_ESTIMATE}                  |
| Status         | dormant                            |

This seed will be scanned automatically when you run
/gsd:new-milestone. If the trigger condition matches,
it will be presented for inclusion in the roadmap.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>

<success_criteria>
- [ ] PROJECT.md exists (pre-flight passes)
- [ ] Idea summary captured (from args or conversation)
- [ ] Context gathered: why, trigger, breadcrumbs, scope
- [ ] Seed number calculated (sequential from existing seeds)
- [ ] Seed file written to `.planning/seeds/SEED-NNN-slug.md`
- [ ] All frontmatter fields populated (seed, planted, status, trigger_when, scope)
- [ ] Breadcrumbs include specific file paths or URLs
- [ ] Trigger condition has 2-3 specific, scannable conditions
- [ ] Committed (if planning docs committed)
- [ ] Confirmation output shown with file path
</success_criteria>
