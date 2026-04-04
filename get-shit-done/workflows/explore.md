<purpose>
Socratic ideation workflow. Guide a structured discovery conversation using questioning.md
principles and domain-probes.md for tech-specific follow-ups. At the end, route outputs to
the correct GSD artifact locations (notes, todos, seeds, research questions, requirements,
or new phases).

Output: Up to 4 artifacts written to .planning/ paths and committed.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting:
@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/references/domain-probes.md
@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<available_agent_types>
Valid GSD subagent types (use exact names):
- gsd-phase-researcher -- Deep-dive research on a topic
</available_agent_types>

<process>

<step name="banner">
Display the explore banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► EXPLORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If `.planning/` exists, read STATE.md and ROADMAP.md inline for project context:

```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/ROADMAP.md 2>/dev/null
```

Display a brief context line if project state was found:
```
Project: {milestone_name} | Phase {N}: {phase_name} | Status: {status}
```

If no `.planning/` exists, display:
```
No active project. Exploring freely.
```
</step>

<step name="socratic_conversation">
Run a Socratic dialogue using questioning.md principles and domain-probes.md patterns.

**Starting the conversation:**

If `$ARGUMENTS` contains a topic or idea:
- Acknowledge the topic and ask an open-ended question to explore it further
- Example: "Interesting -- {topic}. What prompted this? What problem are you trying to solve?"

If `$ARGUMENTS` is empty:
- Ask what's on their mind:
  ```
  AskUserQuestion(
    header: "Explore",
    question: "What idea or question do you want to explore?",
    options: []
  )
  ```

**Conversation flow (5-8 exchanges max):**

1. **Start open.** Let the user dump their mental model. Don't interrupt with structure.

2. **Follow energy.** Whatever they emphasize, dig into that. What excited them? What problem sparked this?

3. **Apply domain probes.** When the user mentions a technology area (auth, database, API, real-time, etc.), use 2-3 relevant probes from domain-probes.md to surface hidden assumptions and trade-offs. Don't run through them as a checklist -- pick the most relevant based on context.

4. **Challenge vagueness.** Never accept fuzzy answers. "Good" means what? "Users" means who? "Simple" means how?

5. **Make the abstract concrete.** "Walk me through using this." "What does that actually look like?"

6. **Mid-conversation research offer.** After 2-3 exchanges, if the topic would benefit from deeper investigation, offer:
   ```
   AskUserQuestion(
     header: "Research?",
     question: "Want me to research this further before we continue?",
     options: [
       { label: "Yes", description: "Spawn a researcher to dig deeper" },
       { label: "No", description: "Keep exploring together" }
     ]
   )
   ```

   If yes, spawn a research subagent:
   ```
   Task(
     subagent_type="gsd-phase-researcher",
     description="Research: {topic}",
     prompt="Research the following topic in depth: {topic}

   Context from conversation so far:
   {summary of key points discussed}

   Focus on:
   - What approaches exist
   - Trade-offs and pitfalls
   - Recommendations for this specific context

   Write findings to .planning/research/{topic-slug}.md"
   )
   ```

   After research completes, summarize key findings and continue the conversation.

7. **Know when to stop.** After 5-8 exchanges, or when the conversation reaches natural closure, move to output routing. Don't force more questions when clarity has been reached.

**Anti-patterns (from questioning.md):**
- Checklist walking -- going through domains regardless of what they said
- Canned questions -- "What's your core value?" regardless of context
- Interrogation -- firing questions without building on answers
- Shallow acceptance -- taking vague answers without probing
</step>

<step name="output_routing">
After the conversation, summarize the key insights discovered, then propose up to 4 concrete outputs from this list:

**Available output types:**

| Type | Description | Destination |
|------|-------------|-------------|
| Note | Captures a thought for later review | `.planning/notes/{YYYY-MM-DD}-{slug}.md` |
| Todo | An actionable task to complete | `.planning/todos/pending/{NNN}-{slug}.md` |
| Seed | A future capability idea with trigger conditions | `.planning/seeds/SEED-{NNN}-{slug}.md` |
| Research question | A question needing deeper investigation | `.planning/research/questions.md` |
| Requirement | A validated requirement for the project | `.planning/REQUIREMENTS.md` |
| New phase | A new phase to add to the roadmap | `.planning/ROADMAP.md` |

**Proposing outputs:**

Present a numbered list of proposed outputs based on what emerged from the conversation:

```
Based on our conversation, here's what I'd suggest capturing:

1. **Note** -- "{summary of the thought}"
2. **Seed** -- "{future capability idea}"
3. **Research question** -- "{question needing investigation}"
4. **Todo** -- "{actionable next step}"
```

Then confirm with the user:

```
AskUserQuestion(
  header: "Outputs?",
  question: "Which outputs should I create? (list numbers, 'all', or 'none')",
  options: [
    { label: "All", description: "Create all proposed outputs" },
    { label: "Let me pick", description: "I'll specify which ones" },
    { label: "None", description: "Just wanted to think out loud" }
  ]
)
```

If "Let me pick" -- ask which numbers to create.
If "None" -- skip to summary step.
If "All" -- create all proposed outputs.
</step>

<step name="create_artifacts">
For each confirmed output, create the artifact at the correct GSD path.

**Slug generation** (used by all artifact types):
```bash
SLUG=$(echo "{title}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
```

---

**Note:**

Write `.planning/notes/{YYYY-MM-DD}-{slug}.md`:

```bash
mkdir -p .planning/notes
```

```markdown
---
date: "{YYYY-MM-DD HH:mm}"
promoted: false
---

{Note content from conversation}
```

---

**Todo:**

Scan for highest existing number:
```bash
HIGHEST=$(ls .planning/todos/pending/*.md .planning/todos/completed/*.md 2>/dev/null | sed 's/.*\///' | grep -oE '^[0-9]+' | sort -n | tail -1)
NEXT=$(printf "%03d" $(( ${HIGHEST:-0} + 1 )))
```

Write `.planning/todos/pending/{NEXT}-{slug}.md`:

```bash
mkdir -p .planning/todos/pending
```

```markdown
---
title: "{todo title}"
status: pending
priority: P2
source: "/gsd-explore"
created: {YYYY-MM-DD}
theme: general
---

## Goal

{Description of what needs to be done}

## Context

Captured during /gsd-explore session on {YYYY-MM-DD}.

## Acceptance Criteria

- [ ] {primary criterion}
```

---

**Seed:**

Scan for highest existing seed number:
```bash
HIGHEST=$(ls .planning/seeds/SEED-*.md 2>/dev/null | sed 's/.*SEED-//' | grep -oE '^[0-9]+' | sort -n | tail -1)
NEXT=$(printf "%03d" $(( ${HIGHEST:-0} + 1 )))
```

Write `.planning/seeds/SEED-{NEXT}-{slug}.md`:

```bash
mkdir -p .planning/seeds
```

```markdown
---
id: SEED-{NEXT}
status: dormant
planted: {YYYY-MM-DD}
trigger_when: "{trigger condition from conversation}"
scope: "{Small|Medium|Large}"
---

# SEED-{NEXT}: {Idea title}

## Why This Matters

{Why this idea is worth capturing}

## When to Surface

**Trigger:** {trigger condition}

This seed should be presented during `/gsd-new-milestone` when the milestone
scope matches these conditions:
- {condition 1}
- {condition 2}

## Scope Estimate

**{scope}** -- {elaboration}

## Notes

Captured during /gsd-explore session on {YYYY-MM-DD}.
```

---

**Research question:**

Append to `.planning/research/questions.md` (create file if it does not exist):

```bash
mkdir -p .planning/research
```

If file does not exist, create it with a header first:
```markdown
# Research Questions

Questions captured for future investigation.

---
```

Append:
```markdown
- [ ] {Question text} -- Source: /gsd-explore ({YYYY-MM-DD})
```

---

**Requirement:**

Append to `.planning/REQUIREMENTS.md` with the next available requirement ID.

Read the file first to find the highest existing ID pattern, then increment.

Append the new requirement following the existing format in the file.

---

**New phase:**

Append a new phase entry to `.planning/ROADMAP.md` following the existing phase format in the file.

Read the file first to determine the next phase number and follow the established structure.
</step>

<step name="commit">
Commit all created artifacts:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(explore): add {output-types} from /gsd-explore session" --files {list of created files}
```

Where `{output-types}` is a comma-separated list of what was created (e.g., "note, seed, todo").
</step>

<step name="summary">
Display completion banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► EXPLORE COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

List artifacts created:
```
Created:
  ✓ Note: .planning/notes/{filename}
  ✓ Seed: .planning/seeds/{filename}
  ✓ Research question: appended to .planning/research/questions.md
```

Display next steps in GSD style:

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**Explore more** -- continue ideating

`/gsd-explore`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd-note` -- quick idea capture (no conversation)
- `/gsd-plant-seed` -- plant a seed with full trigger details
- `/gsd-plan-phase` -- plan next phase from captured ideas

───────────────────────────────────────────────────────────────
```

End workflow.
</step>

</process>

<success_criteria>
- [ ] Socratic conversation uses questioning.md principles (open questions, follow energy, challenge vagueness)
- [ ] Domain probes from domain-probes.md applied when tech topics emerge
- [ ] Mid-conversation research option offered via gsd-phase-researcher Task()
- [ ] Output routing covers all 6 types: notes, todos, seeds, research questions, requirements, new phases
- [ ] User confirms which outputs to create before writing
- [ ] Seeds use SEED-{NNN} sequential numbering
- [ ] Todos use {NNN} sequential numbering from existing files
- [ ] All artifacts written to correct .planning/ paths
- [ ] Created artifacts committed via gsd-tools
- [ ] GSD banner style used throughout (no PBR formatting)
</success_criteria>
