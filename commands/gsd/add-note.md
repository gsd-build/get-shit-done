---
name: gsd:add-note
description: Create structured topic notes through interactive Q&A
argument-hint: <topic>
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<objective>
Create structured topic notes through interactive Q&A that captures Overview, Current State, Rules/Conventions, and Related Files.

Purpose: Enable persistent knowledge management by guiding users through capturing topic-specific documentation.
</objective>

<context>
@.planning/STATE.md
@.planning/config.json
</context>

<process>

<step name="validate_topic">
Parse topic from arguments or prompt if missing.

**Extract topic input:**
```bash
topic_input="$*"
```

**If no topic provided:**
Use AskUserQuestion:
- header: "Topic Name"
- question: "What topic should this note cover?"
- options: [{ label: "Free text input" }]

Result stored in `topic_input` variable.

**Validation rules:**
- Must start with a letter
- Alphanumeric + spaces/hyphens only
- Max 30 characters
- No special characters (/, \, :, etc.)

```bash
if [[ ! "$topic_input" =~ ^[a-zA-Z][a-zA-Z0-9\ -]{0,29}$ ]]; then
  echo "ERROR: Invalid topic name"
  echo ""
  echo "Rules:"
  echo "  - Must start with a letter"
  echo "  - Alphanumeric + spaces/hyphens only"
  echo "  - Max 30 characters"
  echo "  - No special characters"
  echo ""
  echo "Examples: 'API Design', 'Authentication', 'Error Handling'"
  exit 1
fi
```

**Convert to filename:**
Preserve case, convert spaces to hyphens.

```bash
topic_filename=$(echo "$topic_input" | sed 's/ /-/g')
# Example: "API Design" → "API-Design.md"
```

Store both `topic_input` (display name) and `topic_filename` (file name).
</step>

<step name="check_existing">
Check if note already exists.

```bash
if [ -f ".planning/notes/${topic_filename}.md" ]; then
  echo "ERROR: Note already exists: ${topic_filename}.md"
  echo ""
  echo "To modify this note, use: /gsd:update-note ${topic_input}"
  exit 1
fi
```

Exit workflow if note exists — prevent accidental overwrites.
</step>

<step name="collect_overview">
Q&A for Overview section — high-level purpose and scope.

**Ask 2-3 focused questions:**

AskUserQuestion:
- header: "Overview (1/3)"
- question: "What is the high-level purpose of ${topic_input}?"
- options: [{ label: "Free text" }]

Capture response as `overview_1`.

AskUserQuestion:
- header: "Overview (2/3)"
- question: "What are the key concepts or components?"
- options: [{ label: "Free text" }]

Capture response as `overview_2`.

AskUserQuestion:
- header: "Overview (3/3)"
- question: "What problems does ${topic_input} solve?"
- options: [{ label: "Free text" }]

Capture response as `overview_3`.

**Check if user wants more:**

AskUserQuestion:
- header: "Overview Section"
- question: "More about overview, or move to current state?"
- options:
  - { label: "More questions", description: "Dig deeper into overview" }
  - { label: "Next section", description: "Move to current state" }

If "More questions" → ask 2-3 additional questions, check again.
If "Next section" → proceed to collect_current_state.

**Validation:**
Ensure at least one response has content. If all empty, re-prompt: "This section needs content. Let's try again."

Combine all overview responses into `overview_content` variable for note generation.
</step>

<step name="collect_current_state">
Q&A for Current State section — what's currently implemented.

**Ask 2-3 focused questions:**

AskUserQuestion:
- header: "Current State (1/3)"
- question: "What's currently implemented for ${topic_input}?"
- options: [{ label: "Free text" }]

Capture response as `state_1`.

AskUserQuestion:
- header: "Current State (2/3)"
- question: "How does it work now? (files, flow, architecture)"
- options: [{ label: "Free text" }]

Capture response as `state_2`.

AskUserQuestion:
- header: "Current State (3/3)"
- question: "Any recent changes or known issues?"
- options: [{ label: "Free text" }]

Capture response as `state_3`.

**Check if user wants more:**

AskUserQuestion:
- header: "Current State Section"
- question: "More about current state, or move to rules?"
- options:
  - { label: "More questions", description: "Add more context" }
  - { label: "Next section", description: "Move to rules/conventions" }

If "More questions" → ask 2-3 additional questions, check again.
If "Next section" → proceed to collect_rules.

**Validation:**
Ensure at least one response has content.

Combine all state responses into `state_content` variable.
</step>

<step name="collect_rules">
Q&A for Rules/Conventions section — must-follow guidelines.

**Ask 2-3 focused questions:**

AskUserQuestion:
- header: "Rules/Conventions (1/3)"
- question: "What are the must-follow rules for ${topic_input}?"
- options: [{ label: "Free text (one rule per line)" }]

Capture response as `rules_1`.

AskUserQuestion:
- header: "Rules/Conventions (2/3)"
- question: "Any naming conventions or patterns to follow?"
- options: [{ label: "Free text" }]

Capture response as `rules_2`.

AskUserQuestion:
- header: "Rules/Conventions (3/3)"
- question: "What should developers NEVER do with ${topic_input}?"
- options: [{ label: "Free text" }]

Capture response as `rules_3`.

**Check if user wants more:**

AskUserQuestion:
- header: "Rules/Conventions Section"
- question: "More rules to add, or move to related files?"
- options:
  - { label: "More rules", description: "Add more conventions" }
  - { label: "Next section", description: "Move to related files" }

If "More rules" → ask 2-3 additional questions, check again.
If "Next section" → proceed to collect_related_files.

**Validation:**
Ensure at least one response has content.

**Format as numbered list:**
Convert responses to numbered format:
1. [Rule] — [rationale if provided]
2. [Rule] — [rationale if provided]

Store formatted list as `rules_content` variable.
</step>

<step name="collect_related_files">
Q&A for Related Files section — file paths and glob patterns.

**Step 1: Suggest files based on topic name**

Extract keywords from topic name for searching:

```bash
# Convert topic to search patterns
topic_keywords=$(echo "$topic_input" | tr ' ' '\n' | tr '-' '\n' | tr '[:upper:]' '[:lower:]')
```

Use Glob tool to find related files:

```bash
# Search for files matching topic keywords
for keyword in $topic_keywords; do
  # Search for TypeScript/JavaScript files
  glob "**/*${keyword}*.ts" "**/*${keyword}*.tsx" "**/*${keyword}*.js" "**/*${keyword}*.jsx"
done
```

Present findings to user (if any found):

```
I found these files that might be related to ${topic_input}:

[List of files]
```

AskUserQuestion:
- header: "Related Files"
- question: "Include these files?"
- options:
  - { label: "Yes, include all", description: "Add all found files" }
  - { label: "Let me select", description: "Choose specific files" }
  - { label: "I'll specify manually", description: "Provide your own list" }
  - { label: "Skip file search", description: "No specific files" }

If "Yes, include all" → add all found files to `related_files_list`.
If "Let me select" → present file-by-file selection.
If "I'll specify manually" → prompt for manual entry.
If "Skip file search" → set `related_files_list` to empty, continue.

**Step 2: Ask about glob patterns**

AskUserQuestion:
- header: "File Patterns"
- question: "Any glob patterns to include? (e.g., src/api/**/*.ts)"
- options: [{ label: "Free text (one pattern per line, or 'none')" }]

Capture response as `file_patterns`.

**Step 3: Combine into Related Files content**

Build `related_files_content` from:
- Patterns section (from `file_patterns`)
- Specific files section (from `related_files_list`)

Format:
```markdown
### Patterns
- `pattern1` — Why these files are relevant

### Specific Files
- `path/to/file.ts` — What this file handles
```

**Validation:**
At least one of (patterns OR specific files) should have content. If both empty, note "No specific files documented yet."
</step>

<step name="preview_note">
Show generated note before writing.

**Generate full note content:**

```markdown
# ${topic_input}

**Created:** [ISO timestamp from date -u +"%Y-%m-%dT%H:%M:%SZ"]
**Last Updated:** [Same as created]

<overview>
## Overview

${overview_content}

</overview>

<current_state>
## Current State

${state_content}

</current_state>

<rules>
## Rules/Conventions

${rules_content}

</rules>

<related_files>
## Related Files

${related_files_content}

</related_files>
```

**Display preview:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Preview: ${topic_filename}.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Display full note content]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Confirm creation:**

AskUserQuestion:
- header: "Create Note"
- question: "Create this note?"
- options:
  - { label: "Yes, create it", description: "Save to .planning/notes/" }
  - { label: "No, let me revise", description: "Edit before saving" }

If "Yes, create it" → proceed to write_note.
If "No, let me revise" → ask which section to revise, loop back to that step.
</step>

<step name="write_note">
Create the note file.

**Ensure directory exists:**

```bash
mkdir -p .planning/notes
```

**Write note file:**

```bash
cat > ".planning/notes/${topic_filename}.md" <<'EOF'
[Full note content from preview]
EOF
```

**Verify file created:**

```bash
if [ ! -f ".planning/notes/${topic_filename}.md" ]; then
  echo "ERROR: Failed to create note file"
  exit 1
fi
```

Confirm: "Note file created: .planning/notes/${topic_filename}.md"
</step>

<step name="git_commit">
Commit if enabled.

**Check planning config:**

```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

**If `COMMIT_PLANNING_DOCS=false`:**
Skip git operations.
Log: "Note created (not committed - commit_docs: false)"

**If `COMMIT_PLANNING_DOCS=true` (default):**

```bash
git add ".planning/notes/${topic_filename}.md"
git commit -m "$(cat <<'EOF'
docs(notes): add ${topic_input} note

Topic: ${topic_input}
File: .planning/notes/${topic_filename}.md
EOF
)"
```

Confirm: "Note created and committed: docs(notes): add ${topic_input} note"
</step>

<step name="confirm">
Show completion message and offer next steps.

```
✓ Note created: ${topic_input}

Path: .planning/notes/${topic_filename}.md

Sections:
  - Overview: [X lines]
  - Current State: [X lines]
  - Rules/Conventions: [X rules]
  - Related Files: [X patterns, X files]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

1. View note - cat .planning/notes/${topic_filename}.md
2. Create another - /gsd:add-note [topic]
3. Return to work
```

Workflow complete.
</step>

</process>

<output>
- `.planning/notes/{topic}.md` - Structured note with XML semantic tags
- Updated git history (if commit_docs enabled)
</output>

<success_criteria>
- [ ] Topic name validated (alphanumeric + hyphens, max 30 chars, starts with letter)
- [ ] Duplicate detection (error if note exists)
- [ ] All 4 sections collected (Overview, Current State, Rules, Related Files)
- [ ] XML semantic tags present in note template
- [ ] File suggestion based on topic keywords
- [ ] Preview shown before creation
- [ ] Note written to .planning/notes/
- [ ] Git commit respects commit_docs config
- [ ] Confirmation message shows path and summary
</success_criteria>
