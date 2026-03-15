---
name: gsd:brainstorm
description: Facilitate structured idea generation
argument-hint: [topic]
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Facilitate structured idea generation to help users think through problems before planning.
Generates ideas through guided conversation and captures output to a file.
</objective>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<process>

<step name="setup">
```bash
mkdir -p .planning/brainstorm
```
</step>

<step name="identify_topic">
**If argument provided:** Use as topic.

**If no argument:**
Use AskUserQuestion:
- header: "Brainstorm"
- question: "What do you want to brainstorm about?"
</step>

<step name="clarify_context">
**Clarify the goal.**

Ask questions to understand:
- What is the context?
- What problem are we solving?
- What are we trying to achieve?

Example:
"What's the current situation?"
"What's the main pain point?"

Continue until you have a clear understanding of the problem space.
</step>

<step name="generate_ideas">
**Generate ideas.**

Based on the context, generate a list of ideas.
- Provide brief descriptions for each.
- Categorize if appropriate.

**Present ideas to the user.**

Use AskUserQuestion or just conversation to refine the list.
Ask: "Do these look good? Any others to add?"
</step>

<step name="save_output">
**Create the output file.**

Generate a slug from the topic (lowercase, hyphens).
File path: `.planning/brainstorm/[slug].md`

Content format:
```markdown
# Brainstorm: [Topic]

**Date:** [Date]

## Context
[Context gathered]

## Ideas

### 1. [Idea Name]
[Description]

### 2. [Idea Name]
[Description]

...
```

Write the file.
</step>

<step name="convert_actions">
Use AskUserQuestion:
- header: "Next Steps"
- question: "Want to save any of these as todos?"
- options:
  - "Yes, select ideas"
  - "No, just save the brainstorm"

**If "Yes":**
Ask user which ideas to convert.
For each selected idea:
1. Generate a todo file in `.planning/todos/pending/` (ensure directory exists).
2. Use format:
   ```markdown
   ---
   created: [Timestamp]
   title: [Idea Name]
   area: brainstorm
   files: []
   ---

   ## Problem
   Derived from brainstorm: [Topic]

   ## Solution
   [Description]
   ```
3. Log "Todo created: .planning/todos/pending/[date]-[slug].md"

**If "No":** Proceed to commit.
</step>

<step name="git_commit">
**Check planning config:**

```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

**If `COMMIT_PLANNING_DOCS=false`:** Skip git operations.

**If `COMMIT_PLANNING_DOCS=true` (default):**

```bash
git add .planning/brainstorm/
# Add any created todos
git add .planning/todos/pending/ 2>/dev/null
git commit -m "$(cat <<'EOF'
docs: capture brainstorm - [topic]

Saved ideas to .planning/brainstorm/
EOF
)"
```
</step>

<step name="finish">
Display summary:
- Brainstorm saved to `.planning/brainstorm/[slug].md`
- Todos created (if any)
</step>

</process>

<success_criteria>
- [ ] Directory `.planning/brainstorm/` created
- [ ] Brainstorm file created with structured content
- [ ] Todos created if requested
- [ ] Changes committed if `commit_docs` is true
</success_criteria>
