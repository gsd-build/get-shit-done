---
name: gsd:init-notes
description: Auto-discover topics from codebase and create notes through guided Q&A
argument-hint: [--aggressiveness=moderate]
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Auto-discover documentation topics from codebase scanning and create multiple notes through guided Q&A.

Purpose: Bootstrap documentation by scanning codebase structure, file patterns, and code content to identify topics worth documenting (authentication, API design, testing conventions, etc.), then guiding the user through creating multiple notes in a single session with pre-filled suggestions based on codebase analysis.
</objective>

<context>
@.planning/STATE.md
@.planning/config.json
</context>

<process>

<step name="load_config">
Determine discovery aggressiveness from config or arguments.

**Read config file:**

```bash
config_path=".planning/config.json"

if [ -f "$config_path" ]; then
  # Extract note_discovery_aggressiveness from config
  configured_aggressiveness=$(cat "$config_path" | grep -o '"note_discovery_aggressiveness"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
else
  configured_aggressiveness=""
fi
```

**Parse command line argument:**

```bash
# Check for --aggressiveness flag in arguments
arg_aggressiveness=""
for arg in "$@"; do
  if [[ "$arg" =~ ^--aggressiveness= ]]; then
    arg_aggressiveness="${arg#*=}"
  fi
done
```

**Determine final aggressiveness:**

```bash
# Priority: CLI argument > config file > default
if [ -n "$arg_aggressiveness" ]; then
  aggressiveness="$arg_aggressiveness"
elif [ -n "$configured_aggressiveness" ]; then
  aggressiveness="$configured_aggressiveness"
else
  aggressiveness="moderate"
fi

# Validate aggressiveness value
case "$aggressiveness" in
  conservative|moderate|aggressive)
    echo "Detection mode: $aggressiveness"
    ;;
  *)
    echo "ERROR: Invalid aggressiveness: $aggressiveness"
    echo "Valid options: conservative, moderate, aggressive"
    exit 1
    ;;
esac
```

**Set thresholds based on aggressiveness:**

```bash
case "$aggressiveness" in
  conservative)
    min_files=5
    require_patterns=true
    ;;
  moderate)
    min_files=3
    require_patterns=true
    ;;
  aggressive)
    min_files=2
    require_patterns=false
    ;;
esac

echo "Thresholds: min_files=$min_files, require_patterns=$require_patterns"
```

Store `aggressiveness`, `min_files`, `require_patterns` for use in scanning steps.
</step>

<step name="scan_directories">
Stage 1: Directory-based topic detection.

**Find potential topic directories:**

```bash
# Search for directories with topic-relevant names
# Skip common noise directories (node_modules, build artifacts, etc.)
topic_dirs=$(find . -type d \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/.next/*' \
  -not -path '*/coverage/*' \
  -not -path '*/.turbo/*' \
  -not -path '*/.cache/*' \
  -maxdepth 3 2>/dev/null \
  | grep -iE '(auth|api|route|service|component|util|lib|hook|model|schema|middleware|config|helper|test|feature|domain|controller|handler)')
```

**Filter by file count threshold:**

```bash
directory_signals=""

for dir in $topic_dirs; do
  # Count TypeScript/JavaScript files in directory
  file_count=$(find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l | tr -d ' ')

  # Apply min_files threshold
  if [ "$file_count" -ge "$min_files" ]; then
    # Extract topic name from directory path
    topic_name=$(basename "$dir")

    # Store signal: topic_name|directory_path|file_count
    directory_signals="$directory_signals
$topic_name|$dir|$file_count"
  fi
done

# Remove empty first line
directory_signals=$(echo "$directory_signals" | sed '/^$/d')
```

Display findings:
```
Stage 1: Directory scan
Found N potential topics from directory structure
```

Store `directory_signals` for merging.
</step>

<step name="scan_file_patterns">
Stage 2: File naming pattern detection.

**Define topic keywords to search:**

```bash
# Common topic keywords found in file names
keywords="auth authentication api route service component util helper hook model schema middleware config test testing feature domain controller handler validation error logging database cache"
```

**Search for file clusters by keyword:**

Use Glob tool to find files matching each keyword pattern:

```bash
file_signals=""

for keyword in $keywords; do
  # Use Glob tool to find files with keyword in name
  # Example call: glob "**/*auth*.{ts,tsx,js,jsx}"

  # Count matches for this keyword
  matched_files=$(glob "**/*${keyword}*.{ts,tsx,js,jsx}" 2>/dev/null | wc -l | tr -d ' ')

  # Apply min_files threshold
  if [ "$matched_files" -ge "$min_files" ]; then
    # Store signal: keyword|matched_files
    file_signals="$file_signals
$keyword|$matched_files"
  fi
done

# Remove empty first line
file_signals=$(echo "$file_signals" | sed '/^$/d')
```

Display findings:
```
Stage 2: File pattern scan
Found M topics from file naming patterns
```

Store `file_signals` for merging.
</step>

<step name="scan_content_patterns">
Stage 3: Content-based pattern confirmation.

**Collect candidate topics from stages 1 and 2:**

```bash
# Extract unique topic candidates
candidate_topics=$(echo "$directory_signals" | cut -d'|' -f1
echo "$file_signals" | cut -d'|' -f1)
candidate_topics=$(echo "$candidate_topics" | sort -u)
```

**For each candidate, search for content mentions:**

Use Grep tool to find content evidence:

```bash
content_evidence=""

for topic in $candidate_topics; do
  # Search for topic mentions in code (case-insensitive)
  # Use Grep tool: grep -i "$topic" --type ts --output_mode files_with_matches

  matching_files=$(grep -i "$topic" --type ts --output_mode files_with_matches 2>/dev/null | head -10)
  match_count=$(echo "$matching_files" | wc -l | tr -d ' ')

  if [ -z "$matching_files" ]; then
    match_count=0
  fi

  # Store evidence: topic|match_count|file_list
  content_evidence="$content_evidence
$topic|$match_count|$matching_files"
done

# Remove empty first line
content_evidence=$(echo "$content_evidence" | sed '/^$/d')
```

**Read sample files to extract pattern details:**

For topics with content evidence, read up to 3 sample files (first 50 lines):

```bash
# For each topic with matches, analyze patterns
for topic_line in $content_evidence; do
  topic=$(echo "$topic_line" | cut -d'|' -f1)
  files=$(echo "$topic_line" | cut -d'|' -f3-)

  # Read sample files
  sample_count=0
  for file in $files; do
    if [ "$sample_count" -lt 3 ] && [ -f "$file" ]; then
      # Use Read tool or head to get first 50 lines
      head -50 "$file" > /tmp/topic_sample_${topic}_${sample_count}.txt
      sample_count=$((sample_count + 1))
    fi
  done
done
```

Display findings:
```
Stage 3: Content pattern scan
Found P topics with code evidence
```

**Apply require_patterns filter:**

```bash
if [ "$require_patterns" = "true" ]; then
  # Filter candidates: only keep topics with content evidence
  filtered_content_evidence=""

  for topic_line in $content_evidence; do
    match_count=$(echo "$topic_line" | cut -d'|' -f2)

    if [ "$match_count" -gt 0 ]; then
      filtered_content_evidence="$filtered_content_evidence
$topic_line"
    fi
  done

  content_evidence=$(echo "$filtered_content_evidence" | sed '/^$/d')
fi
```

Store `content_evidence` for merging.
</step>

<step name="merge_signals">
Combine and deduplicate topic signals from all stages.

**Collect all unique topics:**

```bash
all_topics=""

# From directory signals
if [ -n "$directory_signals" ]; then
  all_topics="$all_topics
$(echo "$directory_signals" | cut -d'|' -f1)"
fi

# From file signals
if [ -n "$file_signals" ]; then
  all_topics="$all_topics
$(echo "$file_signals" | cut -d'|' -f1)"
fi

# From content evidence
if [ -n "$content_evidence" ]; then
  all_topics="$all_topics
$(echo "$content_evidence" | cut -d'|' -f1)"
fi

# Deduplicate and normalize
all_topics=$(echo "$all_topics" | sed '/^$/d' | tr '[:upper:]' '[:lower:]' | sort -u)
```

**For each topic, calculate confidence and gather evidence:**

```bash
discovered_topics=""

for topic in $all_topics; do
  # Count signals
  has_directory=false
  has_files=false
  has_content=false

  directory_info=""
  file_count=0
  content_matches=0

  # Check directory signal
  if echo "$directory_signals" | grep -qi "^$topic|"; then
    has_directory=true
    directory_info=$(echo "$directory_signals" | grep -i "^$topic|" | head -1)
  fi

  # Check file signal
  if echo "$file_signals" | grep -qi "^$topic|"; then
    has_files=true
    file_count=$(echo "$file_signals" | grep -i "^$topic|" | head -1 | cut -d'|' -f2)
  fi

  # Check content signal
  if echo "$content_evidence" | grep -qi "^$topic|"; then
    has_content=true
    content_matches=$(echo "$content_evidence" | grep -i "^$topic|" | head -1 | cut -d'|' -f2)
  fi

  # Calculate confidence
  signal_count=0
  [ "$has_directory" = true ] && signal_count=$((signal_count + 1))
  [ "$has_files" = true ] && signal_count=$((signal_count + 1))
  [ "$has_content" = true ] && signal_count=$((signal_count + 1))

  case "$signal_count" in
    3) confidence="high" ;;
    2) confidence="medium" ;;
    1) confidence="low" ;;
    *) confidence="none" ;;
  esac

  # Filter low confidence for conservative mode
  if [ "$aggressiveness" = "conservative" ] && [ "$confidence" = "low" ]; then
    continue
  fi

  # Build evidence string
  evidence=""
  [ "$has_directory" = true ] && evidence="$evidence Directory: $(echo "$directory_info" | cut -d'|' -f2) ($(echo "$directory_info" | cut -d'|' -f3) files)."
  [ "$has_files" = true ] && evidence="$evidence Files: $file_count matches."
  [ "$has_content" = true ] && evidence="$evidence Content: $content_matches mentions."

  # Store: topic|confidence|evidence
  discovered_topics="$discovered_topics
$topic|$confidence|$evidence"
done

# Remove empty lines and deduplicate similar topics
discovered_topics=$(echo "$discovered_topics" | sed '/^$/d' | sort -t'|' -k2,2r -k1,1)
```

**Deduplicate similar topics:**

```bash
# Merge topics with edit distance < 3
# Example: "auth" and "authentication" -> keep longer one
final_topics=""

while IFS='|' read -r topic confidence evidence; do
  # Check if similar topic already exists
  similar_found=false

  for existing in $(echo "$final_topics" | cut -d'|' -f1); do
    # Simple similarity check: prefix match
    if [[ "$topic" == "$existing"* ]] || [[ "$existing" == "$topic"* ]]; then
      similar_found=true
      break
    fi
  done

  if [ "$similar_found" = false ]; then
    final_topics="$final_topics
$topic|$confidence|$evidence"
  fi
done <<< "$discovered_topics"

discovered_topics=$(echo "$final_topics" | sed '/^$/d')
```

**Cap at 15 topics maximum:**

```bash
topic_count=$(echo "$discovered_topics" | wc -l | tr -d ' ')

if [ "$topic_count" -gt 15 ]; then
  echo "Found $topic_count topics, limiting to top 15 by confidence"
  discovered_topics=$(echo "$discovered_topics" | head -15)
fi
```

Display summary:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Topic Discovery Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Detection mode: $aggressiveness
Discovered: $(echo "$discovered_topics" | wc -l) topics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Store `discovered_topics` for presentation.
</step>

<step name="check_existing_notes">
Mark topics that already have notes.

**List existing notes:**

```bash
existing_notes=""

if [ -d ".planning/notes" ]; then
  # Get list of existing note files (without .md extension)
  existing_notes=$(ls .planning/notes/*.md 2>/dev/null | xargs -I {} basename {} .md | tr '[:upper:]' '[:lower:]')
fi
```

**Mark existing topics:**

```bash
annotated_topics=""

while IFS='|' read -r topic confidence evidence; do
  # Check if note exists (case-insensitive)
  note_exists=false

  for existing in $existing_notes; do
    if [ "$(echo "$topic" | tr '[:upper:]' '[:lower:]')" = "$(echo "$existing" | tr '[:upper:]' '[:lower:]')" ]; then
      note_exists=true
      break
    fi
  done

  if [ "$note_exists" = true ]; then
    # Append "(exists)" marker
    annotated_topics="$annotated_topics
$topic|$confidence|$evidence|exists"
  else
    annotated_topics="$annotated_topics
$topic|$confidence|$evidence|new"
  fi
done <<< "$discovered_topics"

discovered_topics=$(echo "$annotated_topics" | sed '/^$/d')
```

Store updated `discovered_topics` with existence markers.
</step>

<step name="present_topics">
Show all discovered topics and gather user selection.

**Build topic presentation:**

Group topics by confidence level:

```
Discovered topics in your codebase:

Recommended (high confidence):
─────────────────────────────────
[For each high-confidence topic:]
  ✓ TopicName (note exists)
    Evidence: [evidence string]
  OR
    TopicName
    Evidence: [evidence string]

Possible (medium confidence):
─────────────────────────────────
[For each medium-confidence topic:]
  ...

Consider (low confidence):
─────────────────────────────────
[For each low-confidence topic:]
  ...
```

**Present multi-select question:**

AskUserQuestion:
- header: "Topic Selection"
- question: "Select topics to create notes for:"
- multiSelect: true
- options: Build from `discovered_topics`:
  - For each topic:
    - If status is "exists":
      - label: "[Topic] (note exists)"
      - description: "Evidence: [evidence]. Note already exists, skip or update with /gsd:update-note"
      - disabled: true (or selectable but handled specially)
    - If status is "new":
      - label: "[Topic]"
      - description: "Evidence: [evidence]"
  - Add final option:
    - label: "None - skip automatic discovery"
    - description: "Exit without creating notes"

**Capture user selection:**

Store selected topic names in `selected_topics` variable.

**Handle selection:**

```bash
# Check if user selected "None" or nothing
if [ -z "$selected_topics" ] || echo "$selected_topics" | grep -q "^None"; then
  echo "No topics selected. Use /gsd:add-note [topic] to create individual notes."
  exit 0
fi

# Filter out existing notes from selection
selected_topics_new=""
for topic in $selected_topics; do
  # Check if topic is marked as "exists"
  if ! echo "$discovered_topics" | grep -i "^$topic|" | grep -q "|exists$"; then
    selected_topics_new="$selected_topics_new $topic"
  fi
done
selected_topics="$selected_topics_new"

# Count selected topics
total_topics=$(echo "$selected_topics" | wc -w | tr -d ' ')

if [ "$total_topics" -eq 0 ]; then
  echo "All selected topics already have notes."
  echo "Use /gsd:update-note [topic] to modify existing notes."
  exit 0
fi
```

Store `selected_topics` and `total_topics` for creation loop.
</step>

<step name="initialize_creation_loop">
Set up sequential note creation process.

**Show creation plan:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Creating $total_topics notes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Selected topics:
$(for topic in $selected_topics; do echo "  • $topic"; done)

You can skip any topic during Q&A.
Each note will be created individually with proper Q&A.
```

**Initialize tracking:**

```bash
current_index=0
created_notes=""
skipped_topics=""
```

Store tracking variables for use in loop.
</step>

<step name="create_note_loop">
For each selected topic, gather evidence and run Q&A.

**Loop through selected topics:**

```bash
for topic_input in $selected_topics; do
  current_index=$((current_index + 1))

  # Show progress
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Creating note $current_index of $total_topics: $topic_input"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Convert topic to filename (preserve case, spaces to hyphens)
  topic_filename=$(echo "$topic_input" | sed 's/ /-/g')
```

**Gather codebase evidence for pre-fill:**

```bash
# Extract evidence for this topic from discovered_topics
topic_evidence=$(echo "$discovered_topics" | grep -i "^$topic_input|" | head -1 | cut -d'|' -f3)

# Find related files
related_files=$(grep -i "$topic_input" --type ts --output_mode files_with_matches 2>/dev/null | head -10)

# Read sample files (up to 3, first 50 lines each)
sample_patterns=""
sample_content=""
sample_count=0

for file in $related_files; do
  if [ "$sample_count" -lt 3 ] && [ -f "$file" ]; then
    # Read file content
    file_head=$(head -50 "$file")
    sample_content="$sample_content

File: $file
$file_head"

    # Extract import patterns
    file_imports=$(echo "$file_head" | grep -E "^import " | head -3)
    sample_patterns="$sample_patterns
$file_imports"

    sample_count=$((sample_count + 1))
  fi
done

# Extract unique patterns
sample_patterns=$(echo "$sample_patterns" | sort -u | sed '/^$/d')
```

**Q&A Section 1: Overview with pre-fill**

```bash
# Build pre-filled overview from evidence
echo ""
echo "Based on codebase analysis:"
echo "$topic_evidence"
if [ -n "$sample_patterns" ]; then
  echo ""
  echo "Detected patterns:"
  echo "$sample_patterns"
fi
```

AskUserQuestion:
- header: "Overview (1/4) - $topic_input"
- question: "Does this match your understanding? Describe the high-level purpose:"
- options: [{ label: "Free text (edit or confirm above)" }]

Capture response as `overview_content`.

**Q&A Section 2: Current State with pre-fill**

```bash
# Build pre-filled state from file analysis
echo ""
echo "Current implementation:"
if [ -n "$related_files" ]; then
  echo "Files found:"
  echo "$related_files" | sed 's/^/  - /'
fi

# Get recent git activity
if [ -n "$related_files" ]; then
  echo ""
  echo "Recent activity:"
  git log --oneline -3 -- $related_files 2>/dev/null || echo "  (no recent commits)"
fi
```

AskUserQuestion:
- header: "Current State (2/4) - $topic_input"
- question: "What's currently implemented? Add or correct the details above:"
- options: [{ label: "Free text" }]

Capture response as `state_content`.

**Q&A Section 3: Rules with pre-fill**

```bash
# Infer rules from detected patterns
echo ""
echo "Inferred conventions (from code patterns):"

# Analyze sample content for conventions
inferred_rules=""

# Example rule inference patterns:
# - If JWT found: "Uses JWT for authentication"
# - If /api/ prefix: "All routes use /api/ prefix"
# - If middleware pattern: "Protected routes use middleware"

if echo "$sample_content" | grep -qi "jwt\|jsonwebtoken"; then
  inferred_rules="$inferred_rules
  • Uses JWT tokens for authentication"
fi

if echo "$sample_content" | grep -E "router\.(get|post|put|delete)" | grep -q "/api/"; then
  inferred_rules="$inferred_rules
  • API routes use /api/ prefix"
fi

if echo "$sample_content" | grep -qi "middleware"; then
  inferred_rules="$inferred_rules
  • Uses middleware pattern for request processing"
fi

if echo "$sample_content" | grep -qi "async.*await"; then
  inferred_rules="$inferred_rules
  • Async/await pattern for asynchronous operations"
fi

if [ -n "$inferred_rules" ]; then
  echo "$inferred_rules"
else
  echo "  (no obvious conventions detected)"
fi
```

AskUserQuestion:
- header: "Rules/Conventions (3/4) - $topic_input"
- question: "Confirm or edit these rules. Add any missing conventions:"
- options: [{ label: "Free text" }]

Capture response as `rules_content`.

**Q&A Section 4: Related Files**

```bash
echo ""
echo "Related files found:"
if [ -n "$related_files" ]; then
  echo "$related_files" | sed 's/^/  - /'
else
  echo "  (no files detected)"
fi
```

AskUserQuestion:
- header: "Related Files (4/4) - $topic_input"
- question: "Include these files? Specify patterns or specific paths:"
- options:
  - { label: "Yes, include all found files", description: "Add all discovered files" }
  - { label: "Let me specify patterns", description: "Provide glob patterns" }
  - { label: "Skip file references", description: "No specific files" }

Capture selection as `related_files_choice`.

**Build related files content:**

```bash
case "$related_files_choice" in
  "Yes, include all found files")
    related_files_content="### Specific Files
$(echo "$related_files" | sed 's/^/- `/' | sed 's/$/`/')"
    ;;
  "Let me specify patterns")
    # Ask for patterns
    AskUserQuestion:
    - header: "File Patterns"
    - question: "Enter glob patterns (one per line):"
    - options: [{ label: "Free text" }]

    user_patterns="[captured response]"
    related_files_content="### Patterns
$user_patterns"
    ;;
  "Skip file references")
    related_files_content="No specific files documented yet."
    ;;
esac
```

**Generate note preview:**

```bash
# Build full note content
note_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

note_content="# $topic_input

**Created:** $note_timestamp
**Last Updated:** $note_timestamp

<overview>
## Overview

$overview_content

</overview>

<current_state>
## Current State

$state_content

</current_state>

<rules>
## Rules/Conventions

$rules_content

</rules>

<related_files>
## Related Files

$related_files_content

</related_files>"
```

**Preview and confirm:**

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Preview: $topic_filename.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$note_content"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

AskUserQuestion:
- header: "Create Note - $topic_input"
- question: "Create this note?"
- options:
  - { label: "Yes, create it", description: "Save and continue to next topic" }
  - { label: "Skip this topic", description: "Don't create, move to next" }
  - { label: "Edit section", description: "Go back and revise a section" }

**Handle confirmation:**

```bash
case "$user_choice" in
  "Yes, create it")
    # Create note directory if needed
    mkdir -p .planning/notes

    # Write note file using Write tool
    # (Write tool call: .planning/notes/$topic_filename.md with $note_content)

    # Track creation
    created_notes="$created_notes $topic_filename"

    # Commit if enabled
    COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
    git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false

    if [ "$COMMIT_PLANNING_DOCS" = "true" ]; then
      git add ".planning/notes/${topic_filename}.md"
      git commit -m "docs(notes): add $topic_input note (via init-notes)"
    fi

    echo "✓ Note created: $topic_filename.md"
    ;;

  "Skip this topic")
    skipped_topics="$skipped_topics $topic_input"
    echo "Skipped: $topic_input"
    ;;

  "Edit section")
    # Ask which section to edit
    AskUserQuestion:
    - header: "Edit Section"
    - question: "Which section to revise?"
    - options:
      - { label: "Overview" }
      - { label: "Current State" }
      - { label: "Rules/Conventions" }
      - { label: "Related Files" }

    # Loop back to appropriate Q&A step
    # (Repeat corresponding AskUserQuestion from above)
    # Then return to preview
    ;;
esac

done  # End of topic loop
```

</step>

<step name="final_summary">
Show completion summary with created and skipped notes.

**Build summary:**

```bash
created_count=$(echo "$created_notes" | wc -w | tr -d ' ')
skipped_count=$(echo "$skipped_topics" | wc -w | tr -d ' ')
existing_count=$(echo "$discovered_topics" | grep -c "|exists$" || echo "0")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Init Notes Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$created_count" -gt 0 ]; then
  echo "Created: $created_count notes"
  for filename in $created_notes; do
    echo "  - .planning/notes/${filename}.md"
  done
  echo ""
fi

if [ "$skipped_count" -gt 0 ]; then
  echo "Skipped: $skipped_count topics"
  for topic in $skipped_topics; do
    echo "  - $topic"
  done
  echo ""
fi

if [ "$existing_count" -gt 0 ]; then
  echo "Existing (unchanged): $existing_count notes"
  echo "$discovered_topics" | grep "|exists$" | cut -d'|' -f1 | sed 's/^/  - /'
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  • View notes: ls .planning/notes/"
echo "  • Update a note: /gsd:update-note [topic]"
echo "  • Sync with codebase: /gsd:sync-note [topic]"
echo "  • Create more notes: /gsd:add-note [topic]"
```

Workflow complete.
</step>

</process>

<output>
- Multiple `.planning/notes/{topic}.md` files - Structured notes with XML semantic tags
- Updated git history (if commit_docs enabled) - One commit per created note
</output>

<success_criteria>
- [ ] Aggressiveness levels affect detection thresholds (conservative/moderate/aggressive)
- [ ] Multi-signal detection: directories + file patterns + content patterns
- [ ] Topic evidence shown for each discovery (why it was detected)
- [ ] All topics shown at once (no pagination) with confidence tiers
- [ ] Multi-select topic selection upfront
- [ ] Sequential Q&A for each selected topic with progress tracking
- [ ] Pre-fill suggestions based on codebase analysis (imports, patterns, conventions)
- [ ] Related files auto-discovered and suggested
- [ ] Preview shown before creating each note
- [ ] Skip option available (partial work not saved)
- [ ] Final summary shows created/skipped/existing notes
- [ ] Git commits respect commit_docs config
- [ ] Existing notes marked but not recreated
- [ ] Cap at 15 topics to prevent overwhelming user
- [ ] Deduplication of similar topics (auth vs authentication)
</success_criteria>
