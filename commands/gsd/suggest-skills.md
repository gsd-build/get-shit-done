---
name: suggest-skills
description: Discover and recommend skills for the current project or phase
arguments: "[phase-number]"
---

<command-name>suggest-skills</command-name>

<purpose>
Analyze the current project or specific phase and recommend relevant Claude Code skills that can enhance planning and execution.
</purpose>

<usage>
```text
/gsd:suggest-skills           # Analyze entire project
/gsd:suggest-skills 5         # Analyze specific phase
```

</usage>

<process>

<step name="load_context">
Load project context:

```bash
# Check if project exists
ls .planning/PROJECT.md .planning/ROADMAP.md 2>/dev/null

# Load project description
cat .planning/PROJECT.md 2>/dev/null | head -50

# Load roadmap for phase analysis
cat .planning/ROADMAP.md 2>/dev/null
```

If no project exists:
```bash
No GSD project found in current directory.

To get skill recommendations:
1. Initialize a project: /gsd:new-project
2. Or describe your project/task for general recommendations
```

</step>

<step name="discover_skills">
Discover available skills by scanning actual skill locations:

```bash
# Discover user-installed skills (global)
USER_SKILLS=""
if [ -d ~/.claude/commands ]; then
  for dir in ~/.claude/commands/*/; do
    if [ -d "$dir" ]; then
      for skill in "$dir"*.md; do
        if [ -f "$skill" ]; then
          SKILL_NAME=$(basename "$skill" .md)
          SKILL_DIR=$(basename "$(dirname "$skill")")
          USER_SKILLS="$USER_SKILLS$SKILL_DIR:$SKILL_NAME\n"
        fi
      done
    fi
  done
fi
echo "User skills found:"
echo -e "$USER_SKILLS" | grep -v '^$' | sort

# Discover project-local skills
PROJECT_SKILLS=""
if [ -d .claude/commands ]; then
  for skill in .claude/commands/*.md; do
    if [ -f "$skill" ]; then
      SKILL_NAME=$(basename "$skill" .md)
      PROJECT_SKILLS="$PROJECT_SKILLS$SKILL_NAME\n"
    fi
  done
fi
echo "Project skills found:"
echo -e "$PROJECT_SKILLS" | grep -v '^$' | sort
```

Build available skills inventory from DISCOVERED skills only:
1. **User-installed skills** - `~/.claude/commands/*/*.md` (global skills)
2. **Project-local skills** - `.claude/commands/*.md` (project-specific)

**Important:** Only recommend skills that actually exist on the user's system.
Do NOT assume any specific skills are installed - discover them dynamically.
</step>

<step name="analyze_project">
If no phase specified, analyze entire project:

**Extract keywords from:**
- PROJECT.md description and tech stack
- ROADMAP.md phase names and goals
- REQUIREMENTS.md (if exists)
- Existing codebase patterns

**Match discovered skills to keywords:**

For each discovered skill, extract its purpose from:
1. The skill filename (e.g., `test-gen` suggests testing)
2. The skill's description in frontmatter (if readable)
3. Common naming conventions

**Keyword matching approach:**

| Keywords in Project | Look for Skills Containing |
|---------------------|---------------------------|
| test, coverage, TDD, unit | test, spec, coverage |
| deploy, k8s, kubernetes, docker | deploy, k8s, docker, infra |
| database, sql, query, schema | db, sql, schema, query, bq |
| review, refactor, quality | review, lint, refactor, quality |
| docs, changelog, readme | doc, changelog, readme |
| release, version, tag | release, version, tag, publish |
| commit, pr, branch | commit, pr, git, branch |
| debug, error, trace | debug, trace, error, fix |

**Important:** Only match against DISCOVERED skills, not hypothetical ones.
</step>

<step name="analyze_phase">
If phase specified, analyze that phase:

```bash
# Find phase directory
PHASE_DIR=$(ls -d .planning/phases/$PHASE-* .planning/phases/$(printf "%02d" $PHASE)-* 2>/dev/null | head -1)

# Load phase context
cat "$PHASE_DIR"/*-CONTEXT.md 2>/dev/null
cat "$PHASE_DIR"/*-RESEARCH.md 2>/dev/null
cat "$PHASE_DIR"/*-PLAN.md 2>/dev/null

# Get phase goal from roadmap
grep -A 5 "Phase $PHASE:" .planning/ROADMAP.md 2>/dev/null
```

Extract phase-specific keywords and match to skills.
</step>

<step name="generate_recommendations">
Generate skill recommendations based on DISCOVERED skills:

```markdown
## Skill Recommendations

Based on {project|phase} analysis and discovered skills on your system:

### Discovered Skills

**User-installed skills (~/.claude/commands/):**
{List discovered user skills, or "None found" if empty}

**Project-local skills (.claude/commands/):**
{List discovered project skills, or "None found" if empty}

### Matched Skills

Skills that match your project's keywords:

| Skill | Match Reason | When to Use |
|-------|--------------|-------------|
| `/{discovered-skill}` | {why it matched} | {when to use} |

### Available but Not Matched

These skills exist but didn't match current context:
{List remaining discovered skills that didn't match}

---

## Configuration

To enable skill integration, add to `.planning/config.json`:

\`\`\`json
{
  "skills": {
    "enabled": true,
    "discovery": "auto",
    "skill_mappings": {}
  }
}
\`\`\`

Then add mappings based on YOUR discovered skills:

\`\`\`json
{
  "skills": {
    "skill_mappings": {
      "category": ["your-discovered-skill-1", "your-discovered-skill-2"]
    }
  }
}
\`\`\`

## Next Steps

1. Review discovered skills above
2. Run `/gsd:suggest-skills` to discover what's available
3. Add skill mappings to config.json based on YOUR skills
4. Reference skills in plan task actions:
   \`\`\`xml
   <action>Use /{your-skill} to accomplish the task</action>
   \`\`\`
```
</step>

<step name="offer_configuration">
Offer to configure skills:

```bash
Would you like to:

1. **Add skill mappings to config** - Update .planning/config.json with recommended mappings
2. **View skill details** - Get more information about a specific skill
3. **Skip for now** - Continue without skill configuration

Select option or type skill name for details.
```

</step>

</process>

<skill_discovery_notes>
## Skill Discovery Notes

Skills are discovered dynamically from the user's system. The following locations are scanned:

### Skill Locations

| Location | Type | Example |
|----------|------|---------|
| `~/.claude/commands/*/*.md` | User-installed (global) | `~/.claude/commands/testing/test-gen.md` |
| `.claude/commands/*.md` | Project-local | `.claude/commands/deploy.md` |

### Skill Naming Convention

Skills are named after their filename (without .md extension):
- `~/.claude/commands/testing/test-gen.md` -> skill name: `test-gen`
- `.claude/commands/deploy.md` -> skill name: `deploy`

### Keyword Matching Heuristics

Match discovered skill names against project keywords:

| Skill Name Contains | Likely Category |
|---------------------|-----------------|
| test, spec, coverage | Testing |
| deploy, k8s, docker, infra | Deployment |
| db, sql, schema, query, bq | Database |
| review, lint, refactor | Code Quality |
| doc, changelog, readme | Documentation |
| release, version, tag | Release |
| commit, pr, git | Git/VCS |
| debug, trace, error | Debugging |

**Note:** This table helps categorize discovered skills. It does NOT assume any specific skills exist.
</skill_discovery_notes>

<success_criteria>
- [ ] Project/phase context loaded
- [ ] Available skills discovered from ~/.claude/commands/*/*.md
- [ ] Available skills discovered from .claude/commands/*.md
- [ ] Keywords extracted from project context
- [ ] Only DISCOVERED skills matched to keywords (no assumptions)
- [ ] Recommendations presented with relevance levels
- [ ] Configuration guidance provided (empty skill_mappings as starting point)
- [ ] User informed to populate skill_mappings based on THEIR skills
- [ ] Next steps offered
</success_criteria>
