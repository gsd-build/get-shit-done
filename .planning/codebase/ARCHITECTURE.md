# Architecture

**Analysis Date:** 2025-01-10

## Pattern Overview

**Overall:** Plugin-based Meta-prompting System

**Key Characteristics:**
- Markdown-based configuration instead of code
- Claude Code as runtime execution environment
- File-based state management (.planning/ directory)
- Command-driven workflow orchestration
- Template-driven output generation

## Layers

**Commands Layer:**
- Purpose: User interface and command routing
- Contains: Slash command definitions in Markdown format
- Depends on: Workflow layer for execution logic
- Used by: Claude Code runtime
- Location: `commands/gsd/*.md`

**Workflows Layer:**
- Purpose: Process definitions and business logic
- Contains: Step-by-step execution instructions
- Depends on: Template layer for output generation
- Used by: Command handlers
- Location: `get-shit-done/workflows/*.md`

**Templates Layer:**
- Purpose: Output generation and formatting
- Contains: Reusable document structures with variables
- Depends on: None (static templates)
- Used by: Workflows for generating project files
- Location: `get-shit-done/templates/*.md`

**References Layer:**
- Purpose: Knowledge base and reusable guidance
- Contains: Best practices and reference materials
- Depends on: None (static content)
- Used by: Workflows for context injection
- Location: `get-shit-done/references/*.md`

## Data Flow

**Command Execution Flow:**

1. User runs slash command (e.g., `/gsd:new-project`)
2. Claude loads command definition from installed location
3. Command references workflow file for execution logic
4. Workflow reads templates and reference materials
5. Workflow processes project context from .planning/ directory
6. Templates generate output files (plans, summaries, etc.)
7. Project state updated and changes committed
8. Results displayed to user

**State Management:**
- File-based: All state lives in `.planning/` directory
- No persistent in-memory state
- Each command execution is independent

## Key Abstractions

**Project Phases:**
- Purpose: Hierarchical work breakdown units
- Examples: Research phase, planning phase, execution phase
- Pattern: Sequential workflow with dependencies

**Plans:**
- Purpose: Executable task definitions
- Examples: PLAN.md files with frontmatter metadata
- Pattern: Structured task lists with status tracking

**Summaries:**
- Purpose: Completion records and progress tracking
- Examples: SUMMARY.md files with outcome documentation
- Pattern: Frontmatter metadata with timestamps and links

**Context Injection:**
- Purpose: Include external files in workflows
- Examples: @references for file inclusion
- Pattern: @path/to/file.md syntax for content injection

## Entry Points

**CLI Installation:**
- Location: `bin/install.js`
- Triggers: User runs `npm install -g` or `npx get-shit-done-cc`
- Responsibilities: Copy files to Claude configuration directory

**Slash Commands:**
- Location: `commands/gsd/*.md`
- Triggers: User types command in Claude interface
- Responsibilities: Route to appropriate workflow execution

## Error Handling

**Strategy:** Fail-fast approach with descriptive error messages

**Patterns:**
- Command validation before execution
- Clear error messages to user
- No complex error recovery (manual intervention required)

## Cross-Cutting Concerns

**Logging:**
- Console output for user feedback
- No persistent logging infrastructure

**Validation:**
- Input validation in command definitions
- File existence checks in workflows

**File Operations:**
- Atomic file operations where possible
- Path resolution and validation
- Backup and restore patterns

---

*Architecture analysis: 2025-01-10*
*Update when major patterns change*