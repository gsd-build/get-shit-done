---
name: gsd:discover-and-plan
description: Discover relevant skills then plan a phase (wrapper for /gsd:plan-phase)
argument-hint: "[phase] [--research] [--skip-research] [--gaps] [--skip-verify]"
---

<objective>
Discover relevant skills for a phase, then delegate to /gsd:plan-phase.

Searches local skills (~/.claude/skills/) and skills.sh to surface tools that might help with the phase before planning begins.

**Usage:** `/gsd:discover-and-plan 32` — searches for skills, then plans phase 32
**Alternative:** `/gsd:plan-phase 32` — skips skill discovery, plans directly
</objective>

<context>
Phase number: $ARGUMENTS (passes through to plan-phase)

All flags pass through to /gsd:plan-phase.
</context>

<process>

## 1. Parse Arguments

Extract phase number from $ARGUMENTS for skill search.

```bash
# Normalize phase number for directory lookup
PHASE=$(echo "$ARGUMENTS" | grep -oE '^[0-9]+(\.[0-9]+)?' | head -1)
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  PHASE=$(printf "%02d" "$PHASE")
elif [[ "$PHASE" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
fi
```

## 2. Skill Discovery

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SEARCHING FOR RELEVANT SKILLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.1 Extract Keywords from Phase

```bash
# Get phase name and description from roadmap
PHASE_NAME=$(grep "Phase ${PHASE}:" .planning/ROADMAP.md | sed 's/.*Phase [0-9]*: //')
PHASE_DESC=$(grep -A2 "Phase ${PHASE}:" .planning/ROADMAP.md | tail -1)

# Extract key terms (remove common words, get unique terms)
KEYWORDS=$(echo "${PHASE_NAME} ${PHASE_DESC}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' ' ' | tr ' ' '\n' | grep -v -E '^(the|and|for|with|from|into|that|this|will|have|been|are|was|were|being|has|had|does|did|doing|would|could|should|may|might|must|shall|can|need|want|use|make|add|get|set|new|all|any|both|each|few|more|most|other|some|such|than|too|very|just|also|only|over|same|after|before|between|during|through|above|below|about|into)$' | sort -u | head -5 | tr '\n' ' ')
```

### 2.2 Ensure Skills Index Exists (Lazy Rebuild)

The skills index (`~/.claude/skills/.index.json`) provides fast keyword search without scanning directories.

```bash
INDEX_FILE=~/.claude/skills/.index.json
SKILLS_DIR=~/.claude/skills

# Check if index needs rebuild (missing or older than skills directory)
REBUILD_INDEX=false
if [ ! -f "$INDEX_FILE" ]; then
  REBUILD_INDEX=true
elif [ "$SKILLS_DIR" -nt "$INDEX_FILE" ]; then
  REBUILD_INDEX=true
fi

if [ "$REBUILD_INDEX" = true ]; then
  echo "Rebuilding skills index..."

  # Build index JSON
  echo '{"skills":[' > "$INDEX_FILE.tmp"
  FIRST=true

  for skill_dir in "$SKILLS_DIR"/*/*/; do
    if [ -f "${skill_dir}SKILL.md" ]; then
      owner=$(basename "$(dirname "$skill_dir")")
      name=$(basename "$skill_dir")
      full_name="${owner}/${name}"

      # Skip find-skills (used for remote search, not local matching)
      if [ "$full_name" = "vercel-labs/find-skills" ]; then
        continue
      fi

      # Extract description from SKILL.md
      desc=$(grep -A1 "^description:" "${skill_dir}SKILL.md" 2>/dev/null | tail -1 | sed 's/^[[:space:]]*//' | sed 's/"/\\"/g' | head -c 200)
      if [ -z "$desc" ]; then
        desc=$(head -10 "${skill_dir}SKILL.md" | grep -v "^#" | grep -v "^---" | grep -v "^$" | head -1 | sed 's/"/\\"/g' | head -c 200)
      fi

      # Extract keywords from skill name and description
      keywords=$(echo "$name $desc" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' ' ')

      if [ "$FIRST" = true ]; then
        FIRST=false
      else
        echo ',' >> "$INDEX_FILE.tmp"
      fi

      echo "{\"name\":\"$full_name\",\"description\":\"$desc\",\"keywords\":\"$keywords\"}" >> "$INDEX_FILE.tmp"
    fi
  done 2>/dev/null

  echo '],"updated":"'$(date -Iseconds)'"}' >> "$INDEX_FILE.tmp"
  mv "$INDEX_FILE.tmp" "$INDEX_FILE"
fi
```

### 2.3 Search Local Skills Index

```bash
# Search index for keyword matches (single file read, grep search)
MATCHING_LOCAL=""
if [ -f "$INDEX_FILE" ]; then
  for keyword in $KEYWORDS; do
    # grep matching skills, extract name and description
    matches=$(grep -i "\"keywords\":\"[^\"]*${keyword}[^\"]*\"" "$INDEX_FILE" 2>/dev/null | \
      sed 's/.*"name":"\([^"]*\)".*"description":"\([^"]*\)".*/\1: \2/')
    if [ -n "$matches" ]; then
      MATCHING_LOCAL="${MATCHING_LOCAL}${matches}\n"
    fi
  done
  MATCHING_LOCAL=$(echo -e "$MATCHING_LOCAL" | sort -u | grep -v "^$")
fi
```

**If local matches found:**

Display:
```
Local skills that may be relevant:

[matching local skills with descriptions]

```

### 2.4 Search skills.sh for Additional Skills

```bash
# Get list of installed skill names to filter out
INSTALLED_SKILLS=$(grep -o '"name":"[^"]*"' "$INDEX_FILE" 2>/dev/null | sed 's/"name":"//;s/"//' | tr '\n' '|' | sed 's/|$//')

# Search skills.sh and filter out already-installed skills
if [ -n "$INSTALLED_SKILLS" ]; then
  REMOTE_RESULTS=$(npx skills find ${KEYWORDS} 2>&1 | grep -v -E "$INSTALLED_SKILLS" | head -20)
else
  REMOTE_RESULTS=$(npx skills find ${KEYWORDS} 2>&1 | head -20)
fi
```

**If npx/skills not available or no results:**
- Display: `No additional skills found on skills.sh for: ${KEYWORDS}`

**If results found:**

Display:
```
Available on skills.sh:

[REMOTE_RESULTS output - excludes already-installed skills]

```

### 2.5 Present Findings

**If no local matches AND no skills.sh results:**
- Display: `No relevant skills found locally or on skills.sh`
- Continue to step 3

**If any results found (local or remote):**

Use AskUserQuestion:

```
AskUserQuestion([
  {
    question: "Use or install any skills before planning?",
    header: "Skills",
    multiSelect: true,
    options: [
      { label: "Skip", description: "Continue without using/installing skills" },
      { label: "Install all from skills.sh", description: "Install all listed remote skills globally" },
      { label: "Browse skills.sh", description: "Open https://skills.sh/ to explore manually" }
    ]
  }
])
```

**Note:** Local skills are already available — no installation needed. This prompt is primarily for installing new skills from skills.sh.

**If user selects to install:**

```bash
npx skills add <owner/repo@skill> -g -y

# Rebuild index after installation
rm -f ~/.claude/skills/.index.json
```

Display: `Installed: <skill-name>`

## 3. Delegate to /gsd:plan-phase

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DELEGATING TO PLAN-PHASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Invoke: `/gsd:plan-phase $ARGUMENTS`

</process>

<success_criteria>
- [ ] Keywords extracted from phase name/description
- [ ] Local skills index built/updated as needed
- [ ] Relevant skills presented to user
- [ ] User can install from skills.sh
- [ ] All arguments pass through to /gsd:plan-phase
</success_criteria>
