# Skill Integration

GSD can integrate with Claude Code skills to enhance planning and execution. Skills are reusable prompts that provide specialized capabilities.

## Overview

Skills extend GSD's capabilities by providing:
- Domain-specific expertise (testing, deployment, code review)
- Standardized workflows (commit conventions, PR creation)
- Tool integrations (Jira, Slack, BigQuery, Kubernetes)

**Important:** Skill availability varies by user. GSD discovers skills dynamically from your system - it does NOT assume any specific skills are installed.

## Configuration

Enable skill integration in `.planning/config.json`:

```json
{
  "skills": {
    "enabled": true,
    "discovery": "auto",
    "skill_paths": [],
    "skill_mappings": {}
  }
}
```

**Note:** `skill_mappings` starts empty. Run `/gsd:suggest-skills` to discover what skills are available on YOUR system, then populate mappings accordingly.

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable skill integration |
| `discovery` | string | `"auto"` | How to find skills: `"auto"`, `"manual"`, `"none"` |
| `skill_paths` | string[] | `[]` | Additional paths to search for skills |
| `skill_mappings` | object | `{}` | Map phase types to recommended skills |

## Skill Discovery

GSD discovers skills dynamically from your filesystem. No skills are assumed to exist by default.

### Auto Discovery (`discovery: "auto"`)

GSD automatically discovers available skills by scanning:

1. **User-installed skills** - `~/.claude/commands/*/*.md` (global skills)
2. **Project-local skills** - `.claude/commands/*.md` (project-specific)
3. **Custom Paths** - Paths in `skill_paths` configuration

Run `/gsd:suggest-skills` to see what's available on your system.

### Manual Discovery (`discovery: "manual"`)

Only use skills explicitly listed in `skill_mappings`. You must ensure these skills actually exist.

### No Discovery (`discovery: "none"`)

Disable skill integration entirely.

## Skill Mappings

Skill mappings are **user-customizable** based on what skills YOU have installed. The default is empty:

```json
{
  "skills": {
    "skill_mappings": {}
  }
}
```

### Configuring Your Mappings

After running `/gsd:suggest-skills` to discover your available skills, add mappings:

```json
{
  "skills": {
    "skill_mappings": {
      "category-keyword": ["your-skill-1", "your-skill-2"]
    }
  }
}
```

### Example Configuration

Below is an EXAMPLE showing how mappings MIGHT look if you had these skills installed. **This is NOT the default - populate based on YOUR discovered skills:**

```json
{
  "skills": {
    "skill_mappings": {
      "testing": ["test-gen", "unit-testing"],
      "deployment": ["k8s-deploy"],
      "code-quality": ["code-review"]
    }
  }
}
```

**Steps to configure:**
1. Run `/gsd:suggest-skills` to discover available skills
2. Note which skills exist on your system
3. Map categories to YOUR available skills
4. Only include skills that actually exist

## Usage in Planning

### Phase Planning

During `/gsd:plan-phase`, the planner checks if relevant skills exist:

```markdown
## Skill Recommendations

Based on phase keywords, these skills may help:

| Skill | Relevance | When to Use |
|-------|-----------|-------------|
| `/test-gen` | testing | Generate unit tests for new code |
| `/code-review` | code quality | Review implementation before commit |

Include in plan? These can be referenced in task <action> sections.
```

### Task Actions

Reference skills in task actions:

```xml
<task type="auto">
  <name>Task 3: Generate unit tests</name>
  <files>src/features/user/*.test.ts</files>
  <action>
    Use /test-gen skill to generate comprehensive unit tests for the User feature.
    Ensure coverage of edge cases and error conditions.
  </action>
  <verify>npm test -- --coverage shows >80% coverage for user module</verify>
  <done>All tests pass, coverage meets threshold</done>
</task>
```

## Usage in Execution

### Skill Invocation

The executor invokes skills when referenced in task actions:

1. **Detect skill reference** - Look for `/skill-name` pattern in action
2. **Verify skill available** - Check if skill exists
3. **Invoke skill** - Use `Skill` tool with appropriate arguments
4. **Continue task** - Apply skill output to complete task

### Skill Output Handling

Skill outputs are incorporated into task execution:

- **Code generation skills** - Apply generated code to specified files
- **Analysis skills** - Use findings to inform implementation
- **Workflow skills** - Follow skill's recommended process

## Best Practices

### When to Use Skills

**DO use skills for:**
- Specialized domain tasks (testing, deployment, data processing)
- Standardized workflows (commit, PR, release)
- Tool integrations (Jira, Slack, cloud services)
- Code quality tasks (review, refactoring, smell detection)

**DON'T use skills for:**
- Simple, self-contained tasks
- Tasks where skill overhead exceeds benefit
- Custom logic with no matching skill

### Skill Selection Guidelines

1. **Match phase intent** - Choose skills that align with phase goals
2. **Check skill scope** - Ensure skill applies to current context
3. **Consider dependencies** - Some skills require setup or credentials
4. **Prefer focused skills** - One skill per concern, not catch-all solutions

### Integration Patterns

**Pattern A: Skill-per-task**
```xml
<task type="auto">
  <action>Use /test-gen to create tests</action>
</task>
```

**Pattern B: Skill-before-verify**
```xml
<task type="auto">
  <action>Implement feature</action>
</task>
<task type="auto">
  <action>Use /code-review to check implementation</action>
</task>
```

**Pattern C: Skill-at-phase-boundary**
```xml
<!-- Last task in phase -->
<task type="auto">
  <action>Use /code-review for final review before phase completion</action>
</task>
```

## Skill Categories

Skills are organized by category based on naming conventions. The skills below are EXAMPLES of what might exist - your available skills depend on what's installed on your system.

### Common Skill Naming Patterns

| Category | Skill name might contain |
|----------|--------------------------|
| Workflow | changelog, release, pr, commit |
| Testing | test, spec, coverage, tdd |
| Code Quality | review, lint, refactor, smell |
| DevOps | deploy, k8s, docker, infra |
| Data | db, sql, schema, query, bq |
| Integration | slack, jira, confluence |

### Discovering Your Skills

Run these commands to see what's available:

```bash
# User-installed skills
ls ~/.claude/commands/*/*.md 2>/dev/null

# Project-local skills
ls .claude/commands/*.md 2>/dev/null
```

Or use `/gsd:suggest-skills` for automated discovery and recommendations.

## Troubleshooting

### Skill Not Found

If a referenced skill isn't available:
1. Check skill name spelling
2. Verify skill is installed/registered
3. Check `skill_paths` configuration
4. Try manual discovery mode with explicit mapping

### Skill Execution Fails

If skill execution fails:
1. Check skill prerequisites (auth, dependencies)
2. Review skill documentation for requirements
3. Verify task context matches skill expectations
4. Check for conflicting skill invocations

### Performance Considerations

Skills add context overhead. For optimal performance:
- Limit skills to 1-2 per plan
- Prefer lightweight skills for frequent tasks
- Consider skill caching for repeated invocations
