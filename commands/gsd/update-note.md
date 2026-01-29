---
name: gsd:update-note
description: Conversationally edit existing topic notes
argument-hint: <topic>
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Conversationally edit existing topic notes by inferring context from conversation and git history, collecting updates through Q&A, and applying changes with preview confirmation.

Purpose: Enable users to describe note changes in natural language rather than manually editing markdown files.
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
- question: "Which topic note should I update?"
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

**Check note exists:**
```bash
note_path=".planning/notes/${topic_filename}.md"

if [ ! -f "$note_path" ]; then
  echo "ERROR: Note not found: ${topic_filename}.md"
  echo ""
  echo "To create this note, use: /gsd:add-note ${topic_input}"
  echo ""
  echo "Available notes:"
  ls -1 .planning/notes/*.md 2>/dev/null | sed 's|.planning/notes/||' | sed 's/.md$//' | sed 's/-/ /g' || echo "  (none)"
  exit 1
fi
```

Store both `topic_input` (display name) and `note_path` (file path).
</step>

<step name="load_note">
Read existing note and extract current content.

**Read note file:**
```bash
note_content=$(cat "$note_path")
```

**Validate XML structure:**
Check for required section tags:
```bash
for tag in overview current_state rules related_files; do
  if ! echo "$note_content" | grep -q "<${tag}>"; then
    echo "WARNING: Note missing <${tag}> tags"
    echo ""
    echo "This note may have been created before XML tags were added."
    echo "Consider regenerating it with: /gsd:add-note ${topic_input}"
    echo ""
    # Continue anyway - we'll handle gracefully
  fi
done
```

**Extract existing sections:**
```bash
# Extract each section (content between XML tags, excluding tags themselves)
overview_original=$(echo "$note_content" | sed -n '/<overview>/,/<\/overview>/p' | sed '1d;$d')
state_original=$(echo "$note_content" | sed -n '/<current_state>/,/<\/current_state>/p' | sed '1d;$d')
rules_original=$(echo "$note_content" | sed -n '/<rules>/,/<\/rules>/p' | sed '1d;$d')
related_original=$(echo "$note_content" | sed -n '/<related_files>/,/<\/related_files>/p' | sed '1d;$d')
```

**Extract related files for git analysis:**
```bash
# Find file paths mentioned in related_files section
related_files=$(echo "$related_original" | grep -o '`[^`]*\.(ts|tsx|js|jsx|md|json|yaml|yml)[^`]*`' | tr -d '`' | tr '\n' ' ')
```

Store original content for comparison later.
</step>

<step name="session_inference">
Analyze conversation context and git history to infer what changed.

**Stage 1: Conversation context**
Claude has full access to current conversation history. Analyze naturally:
- Look for mentions of the topic
- Note any code discussions related to topic
- Identify decisions or changes mentioned
- Observe files edited in this session

**Stage 2: Analyze recent commits**
```bash
echo "Checking git history for topic-related changes..."
echo ""

# Find commits mentioning topic (case-insensitive)
topic_commits=$(git log --oneline --all -20 --grep="$topic_input" -i 2>/dev/null)

if [ -n "$topic_commits" ]; then
  echo "Recent commits mentioning ${topic_input}:"
  echo "$topic_commits"
  echo ""
fi

# Find commits affecting related files
if [ -n "$related_files" ]; then
  echo "Recent commits to related files:"
  git log --oneline --all -10 -- $related_files 2>/dev/null
  echo ""
fi
```

**Stage 3: Check uncommitted changes**
```bash
# Check for uncommitted changes to related files
if [ -n "$related_files" ]; then
  echo "Uncommitted changes:"
  changed_files=$(git status --porcelain $related_files 2>/dev/null)

  if [ -n "$changed_files" ]; then
    echo "$changed_files"
    echo ""

    # Show summary of diffs (ignore whitespace)
    echo "Diff summary:"
    git diff -w --stat -- $related_files 2>/dev/null
    echo ""
  else
    echo "  (none)"
    echo ""
  fi
fi
```

**Stage 4: Synthesize findings**
Based on conversation analysis and git findings, synthesize what likely changed:

```
Based on our conversation and recent git activity, I see:
- [Finding from conversation context]
- [Finding from commit history]
- [Finding from uncommitted changes]
```

Store synthesis for use in next step. This informs which sections to suggest updating.
</step>

<step name="collect_updates">
Q&A to clarify which sections to update and what changes to make.

**Step 1: Section selection with inference-based descriptions**

Based on session_inference findings, suggest sections to update:

AskUserQuestion:
- header: "Update Sections"
- question: "What sections should I update?"
- options:
  - { label: "Overview", description: "[Why based on inference, or 'High-level purpose and scope']" }
  - { label: "Current State", description: "[Why based on inference, or 'What's implemented now']" }
  - { label: "Rules/Conventions", description: "[Why based on inference, or 'Must-follow guidelines']" }
  - { label: "Related Files", description: "[Why based on inference, or 'File paths and patterns']" }
- multiSelect: true

Capture response as `sections_to_update` (array of selected sections).

**Validation:**
If no sections selected, prompt again: "Please select at least one section to update."

**Step 2: Collect changes for each selected section**

For each section in `sections_to_update`:

**If "Overview" selected:**
AskUserQuestion:
- header: "Overview Updates"
- question: "What changes should I make to the Overview section?"
- options: [{ label: "Free text - describe the changes" }]

Capture as `overview_changes`.

**If "Current State" selected:**
AskUserQuestion:
- header: "Current State Updates"
- question: "What's changed in the current implementation?"
- options: [{ label: "Free text - describe what's new or different" }]

Capture as `state_changes`.

**If "Rules/Conventions" selected:**
AskUserQuestion:
- header: "Rules/Conventions Updates"
- question: "What rules should I add, modify, or remove?"
- options: [{ label: "Free text - describe rule changes" }]

Capture as `rules_changes`.

**If "Related Files" selected:**
AskUserQuestion:
- header: "Related Files Updates"
- question: "What file paths or patterns should I add or remove?"
- options: [{ label: "Free text - list file paths or patterns" }]

Capture as `related_changes`.

**Step 3: Additional context**

AskUserQuestion:
- header: "Additional Context"
- question: "Any other updates or context to add?"
- options:
  - { label: "Yes, let me add more", description: "Add additional details" }
  - { label: "No, ready for preview", description: "Generate updated note" }

If "Yes, let me add more":
- AskUserQuestion (free text) for additional context
- Capture as `additional_context`

Store all collected changes for generate_updates step.
</step>

<step name="generate_updates">
Apply described changes to note content.

**For each section to update:**

**Update Overview:**
If `overview_changes` provided:
- Read original `overview_original`
- Apply described changes based on `overview_changes` text
- If changes mention "add [content]" → append content
- If changes mention "replace [old] with [new]" → replace content
- If changes mention "remove [content]" → remove content
- If changes are descriptive ("updated to reflect X") → rewrite section incorporating the changes
- Preserve markdown formatting

Store result as `overview_updated`.

**Update Current State:**
If `state_changes` provided:
- Read original `state_original`
- Apply described changes based on `state_changes` text
- Follow same pattern as Overview
- Focus on implementation details, file structure, recent changes

Store result as `state_updated`.

**Update Rules/Conventions:**
If `rules_changes` provided:
- Read original `rules_original`
- Apply described changes based on `rules_changes` text
- If adding rules: append as numbered items
- If removing rules: delete specified items
- If modifying rules: update specified items
- Renumber rules if structure changes

Store result as `rules_updated`.

**Update Related Files:**
If `related_changes` provided:
- Read original `related_original`
- Apply described changes based on `related_changes` text
- If adding files: append to appropriate section (Patterns or Specific Files)
- If removing files: delete specified entries
- Maintain structure: Patterns section, then Specific Files section

Store result as `related_updated`.

**Preserve unchanged sections:**
For sections NOT in `sections_to_update`, use original content:
- If Overview not updated: `overview_updated = overview_original`
- If Current State not updated: `state_updated = state_original`
- If Rules not updated: `rules_updated = rules_original`
- If Related Files not updated: `related_updated = related_original`

**Update timestamp:**
```bash
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

**Build updated note:**
```markdown
# ${topic_input}

**Created:** [preserve original created date]
**Last Updated:** ${timestamp}

<overview>
${overview_updated}
</overview>

<current_state>
${state_updated}
</current_state>

<rules>
${rules_updated}
</rules>

<related_files>
${related_updated}
</related_files>
```

Store complete updated note as `note_updated`.
</step>

<step name="preview_note">
Show full updated note with change summary before saving.

**Create backup for comparison:**
```bash
cp "$note_path" "$note_path.bak"
```

**Write updated note to temp file for preview:**
```bash
echo "$note_updated" > "$note_path.preview"
```

**Calculate changes:**
```bash
# Count lines changed per section
overview_diff_lines=$(diff -u <(echo "$overview_original") <(echo "$overview_updated") 2>/dev/null | grep -c '^[+-]' || echo "0")
state_diff_lines=$(diff -u <(echo "$state_original") <(echo "$state_updated") 2>/dev/null | grep -c '^[+-]' || echo "0")
rules_diff_lines=$(diff -u <(echo "$rules_original") <(echo "$rules_updated") 2>/dev/null | grep -c '^[+-]' || echo "0")
related_diff_lines=$(diff -u <(echo "$related_original") <(echo "$related_updated") 2>/dev/null | grep -c '^[+-]' || echo "0")
```

**Display preview:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Preview: ${topic_filename}.md (Updated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Display full note_updated content]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Changes Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[For each section with changes:]
  • [Section name]: [description of change based on diff_lines and user input]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Confirm save:**

AskUserQuestion:
- header: "Save Changes"
- question: "Save these changes to the note?"
- options:
  - { label: "Yes, save it", description: "Write updated note" }
  - { label: "Change Overview", description: "Revise Overview section" }
  - { label: "Change Current State", description: "Revise Current State section" }
  - { label: "Change Rules", description: "Revise Rules section" }
  - { label: "Change Related Files", description: "Revise Related Files section" }
  - { label: "Cancel", description: "Discard changes" }

**If "Yes, save it":** proceed to write_note

**If "Change [section]":**
- Loop back to collect_updates for that specific section
- Re-run generate_updates
- Return to preview_note (show updated preview)

**If "Cancel":**
- Clean up temp files
- Exit: "Update cancelled. No changes made."
</step>

<step name="write_note">
Write the updated note file.

**Write updated note:**
```bash
echo "$note_updated" > "$note_path"
```

**Verify file written:**
```bash
if [ ! -f "$note_path" ]; then
  echo "ERROR: Failed to write updated note"
  # Restore backup
  mv "$note_path.bak" "$note_path"
  exit 1
fi
```

**Clean up temp files:**
```bash
rm -f "$note_path.bak" "$note_path.preview"
```

Confirm: "Note updated: ${topic_filename}.md"
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
Log: "Note updated (not committed - commit_docs: false)"

**If `COMMIT_PLANNING_DOCS=true` (default):**

Build commit message summarizing changes:
```bash
commit_msg="docs(notes): update ${topic_input} note

Updated sections:
"

# Add updated sections to message
for section in $sections_to_update; do
  commit_msg="${commit_msg}- ${section}\n"
done

commit_msg="${commit_msg}
File: .planning/notes/${topic_filename}.md"
```

```bash
git add "$note_path"
git commit -m "$commit_msg"
```

Confirm: "Note updated and committed: docs(notes): update ${topic_input} note"
</step>

<step name="confirm">
Show completion message with summary.

**Calculate section sizes:**
```bash
overview_lines=$(echo "$overview_updated" | wc -l)
state_lines=$(echo "$state_updated" | wc -l)
rules_count=$(echo "$rules_updated" | grep -c '^[0-9]' || echo "0")
related_patterns=$(echo "$related_updated" | grep -c '^- `.*\*' || echo "0")
related_files_count=$(echo "$related_updated" | grep -c '^- `.*\.(ts|tsx|js|jsx)' || echo "0")
```

**Display summary:**
```
✓ Note updated: ${topic_input}

Path: .planning/notes/${topic_filename}.md
Updated: ${timestamp}

Changes:
[For each section in sections_to_update:]
  • [Section name]: [brief description from collect_updates]

Current Sections:
  - Overview: ${overview_lines} lines
  - Current State: ${state_lines} lines
  - Rules/Conventions: ${rules_count} rules
  - Related Files: ${related_patterns} patterns, ${related_files_count} files

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

1. View note - cat .planning/notes/${topic_filename}.md
2. Update another note - /gsd:update-note [topic]
3. Sync with codebase - /gsd:sync-note ${topic_input}
4. Return to work
```

Workflow complete.
</step>

</process>

<output>
- Updated `.planning/notes/{topic}.md` with modified sections and timestamp
- Updated git history (if commit_docs enabled)
</output>

<success_criteria>
- [ ] Topic name validated and note existence confirmed
- [ ] Existing note content loaded and XML sections extracted
- [ ] Session inference analyzes conversation context and git history
- [ ] Multi-select section update flow with inference-based suggestions
- [ ] Free-text Q&A for describing changes to each selected section
- [ ] Changes applied to selected sections, unchanged sections preserved
- [ ] Preview shows full updated note with changes summary
- [ ] User can revise sections before saving
- [ ] Updated note written with new timestamp
- [ ] Git commit respects commit_docs config
- [ ] Confirmation message shows path and change summary
</success_criteria>
