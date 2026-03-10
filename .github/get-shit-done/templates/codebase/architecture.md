# Architecture Template

Template for `.planning/codebase/ARCHITECTURE.md` - captures conceptual code organization.

**Purpose:** Document how the code is organized at a conceptual level. Complements STRUCTURE.md (which shows physical file locations).

---

## File Template

```markdown
# Architecture

**Analysis Date:** [YYYY-MM-DD]

## Pattern Overview

**Overall:** [Pattern name: e.g., "Monolithic CLI", "Serverless API", "Full-stack MVC"]

**Key Characteristics:**
- [Characteristic 1: e.g., "Single executable"]
- [Characteristic 2: e.g., "Stateless request handling"]
- [Characteristic 3: e.g., "Event-driven"]

## Layers

[Describe the conceptual layers and their responsibilities]

**[Layer Name]:**
- Purpose: [What this layer does]
- Contains: [Types of code: e.g., "route handlers", "business logic"]
- Depends on: [What it uses: e.g., "data layer only"]
- Used by: [What uses it: e.g., "API routes"]

**[Layer Name]:**
- Purpose: [What this layer does]
- Contains: [Types of code]
- Depends on: [What it uses]
- Used by: [What uses it]

## Data Flow

[Describe the typical request/execution lifecycle]

**[Flow Name] (e.g., "HTTP Request", "CLI Command", "Event Processing"):**

1. [Entry point: e.g., "User runs command"]
2. [Processing step: e.g., "Router matches path"]
3. [Processing step: e.g., "Controller validates input"]
4. [Processing step: e.g., "Service executes logic"]
5. [Output: e.g., "Response returned"]

**State Management:**
- [How state is handled: e.g., "Stateless - no persistent state", "Database per request", "In-memory cache"]

## Key Abstractions

[Core concepts/patterns used throughout the codebase]

**[Abstraction Name]:**
- Purpose: [What it represents]
- Examples: [e.g., "UserService, ProjectService"]
- Pattern: [e.g., "Singleton", "Factory", "Repository"]

**[Abstraction Name]:**
- Purpose: [What it represents]
- Examples: [Concrete examples]
- Pattern: [Pattern used]

## Entry Points

[Where execution begins]

**[Entry Point]:**
- Location: [Brief: e.g., "src/index.ts", "API Gateway triggers"]
- Triggers: [What invokes it: e.g., "CLI invocation", "HTTP request"]
- Responsibilities: [What it does: e.g., "Parse args, route to command"]

## Error Handling

**Strategy:** [How errors are handled: e.g., "Exception bubbling to top-level handler", "Per-route error middleware"]

**Patterns:**
- [Pattern: e.g., "try/catch at controller level"]
- [Pattern: e.g., "Error codes returned to user"]

## Cross-Cutting Concerns

[Aspects that affect multiple layers]

**Logging:**
- [Approach: e.g., "Winston logger, injected per-request"]

**Validation:**
- [Approach: e.g., "Zod schemas at API boundary"]

**Authentication:**
- [Approach: e.g., "JWT middleware on protected routes"]

---

*Architecture analysis: [date]*
*Update when major patterns change*
```

<good_examples>
```markdown
# Architecture

**Analysis Date:** 2025-01-20

## Pattern Overview

**Overall:** CLI Application with Plugin System

**Key Characteristics:**
- Single executable with subcommands
- Plugin-based extensibility
- File-based state (no database)
- Synchronous execution model

## Layers

**Command Layer:**
- Purpose: Parse user input and route to appropriate handler
- Contains: Command definitions, argument parsing, help text
- Location: `src/commands/*.ts`
- Depends on: Service layer for business logic
- Used by: CLI entry point (`src/index.ts`)

**Service Layer:**
- Purpose: Core business logic
- Contains: FileService, TemplateService, InstallService
- Location: `src/services/*.ts`
- Depends on: File system utilities, external tools
- Used by: Command handlers

**Utility Layer:**
- Purpose: Shared helpers and abstractions
- Contains: File I/O wrappers, path resolution, string formatting
- Location: `src/utils/*.ts`
- Depends on: Node.js built-ins only
- Used by: Service layer

## Data Flow

**CLI Command Execution:**

1. User runs: `gsd new-project`
2. Commander parses args and flags
3. Command handler invoked (`src/commands/new-project.ts`)
4. Handler calls service methods (`src/services/project.ts` → `create()`)
5. Service reads templates, processes files, writes output
6. Results logged to console
7. Process exits with status code

**State Management:**
- File-based: All state lives in `.planning/` directory
- No persistent in-memory state
- Each command execution is independent

## Key Abstractions

**Service:**
- Purpose: Encapsulate business logic for a domain
- Examples: `src/services/file.ts`, `src/services/template.ts`, `src/services/project.ts`
- Pattern: Singleton-like (imported as modules, not instantiated)

**Command:**
- Purpose: CLI command definition
- Examples: `src/commands/new-project.ts`, `src/commands/plan-phase.ts`
- Pattern: Commander.js command registration

**Template:**
- Purpose: Reusable document structures
- Examples: PROJECT.md, PLAN.md templates
- Pattern: Markdown files with substitution variables

## Entry Points

**CLI Entry:**
- Location: `src/index.ts`
- Triggers: User runs `gsd <command>`
- Responsibilities: Register commands, parse args, display help

**Commands:**
- Location: `src/commands/*.ts`
- Triggers: Matched command from CLI
- Responsibilities: Validate input, call services, format output

## Error Handling

**Strategy:** Throw exceptions, catch at command level, log and exit

**Patterns:**
- Services throw Error with descriptive messages
- Command handlers catch, log error to stderr, exit(1)
- Validation errors shown before execution (fail fast)

## Cross-Cutting Concerns

**Logging:**
- Console.log for normal output
- Console.error for errors
- Chalk for colored output

**Validation:**
- Zod schemas for config file parsing
- Manual validation in command handlers
- Fail fast on invalid input

**File Operations:**
- FileService abstraction over fs-extra
- All paths validated before operations
- Atomic writes (temp file + rename)

---

*Architecture analysis: 2025-01-20*
*Update when major patterns change*
```
</good_examples>

<guidelines>
**What belongs in ARCHITECTURE.md:**
- Overall architectural pattern (monolith, microservices, layered, etc.)
- Conceptual layers and their relationships
- Data flow / request lifecycle
- Key abstractions and patterns
- Entry points
- Error handling strategy
- Cross-cutting concerns (logging, auth, validation)

**What does NOT belong here:**
- Exhaustive file listings (that's STRUCTURE.md)
- Technology choices (that's STACK.md)
- Line-by-line code walkthrough (defer to code reading)
- Implementation details of specific features

**File paths ARE welcome:**
Include file paths as concrete examples of abstractions. Use backtick formatting: `src/services/user.ts`. This makes the architecture document actionable for Claude when planning.

**When filling this template:**
- Read main entry points (index, server, main)
- Identify layers by reading imports/dependencies
- Trace a typical request/command execution
- Note recurring patterns (services, controllers, repositories)
- Keep descriptions conceptual, not mechanical

**Useful for phase planning when:**
- Adding new features (where does it fit in the layers?)
- Refactoring (understanding current patterns)
- Identifying where to add code (which layer handles X?)
- Understanding dependencies between components
</guidelines>
