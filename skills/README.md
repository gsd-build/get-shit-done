# Get-Shit-Done Agent Skills

This directory contains Agent Skills for the Get-Shit-Done (GSD) project management system. These skills follow the [Agent Skills specification](https://agentskills.io/specification) and provide structured, executable capabilities for project management tasks.

## Skills Structure

Each skill is organized as a directory containing:

```
skill-name/
└── SKILL.md          # Required skill definition
```

## Available Skills

### Project Management Skills

- **add-phase**: Add a new phase to the end of the current milestone
- **add-todo**: Add a todo item to the current phase
- **check-todos**: Review and manage todo items
- **complete-milestone**: Mark a milestone as complete
- **consider-issues**: Analyze potential issues and risks
- **create-roadmap**: Generate a project roadmap
- **debug**: Debug project issues and problems
- **discuss-milestone**: Discuss milestone planning and progress
- **discuss-phase**: Discuss phase planning and execution
- **execute-phase**: Execute a phase plan
- **execute-plan**: Execute a specific plan
- **help**: Provide help and guidance
- **insert-phase**: Insert a phase at a specific position
- **list-phase-assumptions**: List assumptions for a phase
- **map-codebase**: Analyze and map the codebase structure
- **new-milestone**: Create a new milestone
- **new-project**: Initialize a new project
- **pause-work**: Pause work on the current project
- **plan-fix**: Plan fixes for identified issues
- **plan-phase**: Create detailed execution plan for a phase
- **progress**: Check project progress and status
- **remove-phase**: Remove a phase from the roadmap
- **research-phase**: Research requirements for a phase
- **resume-work**: Resume work on a paused project
- **status**: Check current project status
- **verify-work**: Verify completed work

## Skill Format

Each skill follows the Agent Skills specification with:

### Frontmatter (Required)
- `name`: Skill name (lowercase alphanumeric + hyphens)
- `description`: What the skill does and when to use it
- `license`: License information
- `metadata`: Additional metadata (author, version, category)
- `allowed-tools`: Space-delimited list of approved tools

### Body Content
- **Objective**: What the skill accomplishes
- **When to Use**: Appropriate use cases
- **Process**: Step-by-step execution process
- **Success Criteria**: Conditions for successful completion
- **Anti-Patterns**: When not to use the skill
- **Examples**: Usage examples
- **Error Handling**: How errors are handled

## Usage

These skills can be used with any Agent Skills-compatible agent system. Each skill provides structured guidance for completing specific project management tasks within the GSD framework.

## Development

To add new skills:

1. Create a new directory under `skills/gsd/`
2. Add a `SKILL.md` file following the specification
3. Include any supporting files in subdirectories (scripts/, references/, assets/)

## License

All skills are licensed under the MIT license unless otherwise specified.
