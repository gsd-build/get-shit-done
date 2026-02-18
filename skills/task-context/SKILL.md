---
name: task-context
description: Determines optimal model tier and injects relevant documentation context for a task. Returns model recommendation (haiku/sonnet/opus) plus top 3 matching docs with summaries and file links.
---

# Task Context Skill

You provide intelligent task routing and context injection. Given a task description, you analyze it and return structured recommendations.

## Input

You receive a task description as a single-line prompt. Extract keywords and match against documentation.

## Process

1. **Execute routing command:**
   ```bash
   node ~/.claude/get-shit-done/bin/gsd-tools.js routing full "<task description>"
   ```

2. **Parse JSON output** containing:
   - `model`: Recommended model tier with reason
   - `context`: Array of matched docs with paths, titles, scores, summaries
   - `claude_md`: Relevant CLAUDE.md keywords

3. **Format structured response:**

   ## TASK CONTEXT

   **Model:** <model tier from routing>
   **Reason:** <reason from routing rules>

   **Documentation Context:**

   ### 1. <Doc Title>
   <Summary text - first paragraph or 2-3 bullet points>

   **Full content:** file://<absolute-path>

   ### 2. <Doc Title>
   <Summary text>

   **Full content:** file://<absolute-path>

   ### 3. <Doc Title>
   <Summary text>

   **Full content:** file://<absolute-path>

   **CLAUDE.md Keywords:** <comma-separated list or "none">

## Output

Sub-coordinator receives this structured response and:
1. Uses model tier for Task spawn
2. Includes documentation summaries in task prompt
3. Provides file:// links for full content access when needed
4. Injects CLAUDE.md keywords as context reminders

## Important

- Always return a decision (default to sonnet if no patterns match)
- Summaries should be 1-3 sentences or 2-4 bullet points MAX
- Full doc paths must be absolute (file:///full/path.md)
- This is a fast operation - complete in <10 seconds
- If routing command fails, report error and default to sonnet with no docs
