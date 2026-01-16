<overview>
Hooks are integration points in the GSD lifecycle that allow plugins to respond to key events. Unlike commands (which users invoke explicitly), hooks trigger automatically when GSD performs specific actions.

**Key insight:** Hooks enable passive integration. A knowledge graph plugin can capture research data without requiring users to run extra commands - it just hooks into `post-research` and processes the RESEARCH.md automatically.

**When to use hooks vs commands:**
| Use Case | Mechanism |
|----------|-----------|
| User wants to take action | Command (`/neo4j:query`) |
| Plugin needs to react to GSD events | Hook (`post-research`) |
| Interactive user input required | Command |
| Background processing, no input needed | Hook |
</overview>

<registration>
## Hook Registration

Hooks register in the `gsd.hooks` object of `plugin.json`. Each key is an event name, and the value is the path to the handler file.

**Structure:**
```json
{
  "gsd": {
    "hooks": {
      "post-research": "hooks/capture-research.md",
      "post-summary": "hooks/index-summary.md",
      "post-verify": "hooks/log-verification.md"
    }
  }
}
```

**Multiple plugins on same event:**
When multiple plugins register for the same event, handlers execute in plugin load order. Each handler runs independently - a failure in one doesn't block others.

**Handler files:**
Hook handler files are markdown prompts (like commands) that live in the plugin's `hooks/` directory. They receive event context via XML injection at runtime.
</registration>

<lifecycle_events>
## Available Lifecycle Events

| Event | Triggered When | Context Passed |
|-------|----------------|----------------|
| `post-project-init` | After PROJECT.md created | project_path, project_name |
| `post-roadmap` | After ROADMAP.md created | roadmap_path, phases |
| `post-research` | After RESEARCH.md created | research_path, phase |
| `post-plan` | After PLAN.md created | plan_path, phase, plan_number |
| `pre-execute` | Before plan execution | plan_path, phase, plan_number |
| `post-execute` | After plan execution | summary_path, phase, plan_number, success |
| `post-verify` | After phase verification | verification_path, phase, passed |
| `post-milestone` | After milestone completed | milestone_name, phases_completed |

### Event Details

**post-project-init**
Triggered by `/gsd:new-project` after PROJECT.md is created.
```yaml
project_path: /path/to/project/.planning/PROJECT.md
project_name: my-project
```
*Use case:* Initialize plugin state for new project, register project in external system.

**post-roadmap**
Triggered by `/gsd:create-roadmap` after ROADMAP.md is created.
```yaml
roadmap_path: /path/to/project/.planning/ROADMAP.md
phases:
  - name: 01-setup
    description: Initial setup
  - name: 02-core
    description: Core implementation
```
*Use case:* Index project scope, create external tracking entries.

**post-research**
Triggered by `/gsd:research-phase` after RESEARCH.md is created.
```yaml
research_path: /path/to/project/.planning/phases/02-auth/02-RESEARCH.md
phase: 02-auth
```
*Use case:* Capture research findings into knowledge graph, index discovered patterns and libraries.

**post-plan**
Triggered by `/gsd:plan-phase` after PLAN.md is created.
```yaml
plan_path: /path/to/project/.planning/phases/02-auth/02-01-PLAN.md
phase: 02-auth
plan_number: 01
```
*Use case:* Index planned tasks, create external work items.

**pre-execute**
Triggered by `/gsd:execute-phase` before plan execution starts.
```yaml
plan_path: /path/to/project/.planning/phases/02-auth/02-01-PLAN.md
phase: 02-auth
plan_number: 01
```
*Use case:* Validate prerequisites, prepare external resources.

**post-execute**
Triggered after plan execution completes (whether successful or not).
```yaml
summary_path: /path/to/project/.planning/phases/02-auth/02-01-SUMMARY.md
phase: 02-auth
plan_number: 01
success: true
```
*Use case:* Index execution results, send notifications, update external trackers.

**post-verify**
Triggered after phase verification completes.
```yaml
verification_path: /path/to/project/.planning/phases/02-auth/02-VERIFICATION.md
phase: 02-auth
passed: true
```
*Use case:* Log verification results, trigger downstream actions on pass/fail.

**post-milestone**
Triggered by `/gsd:complete-milestone` after milestone completion.
```yaml
milestone_name: v1.0.0
phases_completed:
  - 01-setup
  - 02-core
  - 03-testing
```
*Use case:* Generate milestone reports, archive to external systems.
</lifecycle_events>

<handler_structure>
## Hook Handler Structure

Hook handlers are markdown files with YAML frontmatter and an XML process block. At runtime, GSD injects context via a `<hook_context>` block.

**Template:**
```markdown
---
hook: [EVENT_NAME]
description: [What this hook does]
---

<objective>
[What this hook accomplishes when triggered]
</objective>

<hook_context>
<!-- Injected by GSD at runtime -->
<!-- Available variables depend on the hook event -->
</hook_context>

<process>
1. [Step 1 - typically read context files]
2. [Step 2 - process/transform data]
3. [Step 3 - store/output results]
</process>

<error_handling>
[How to handle failures gracefully without blocking GSD]
</error_handling>
```

**Context injection:**
When GSD invokes a hook, it populates the `<hook_context>` block with event-specific variables:

```markdown
<hook_context>
research_path: .planning/phases/02-auth/02-RESEARCH.md
phase: 02-auth
project_path: /path/to/project
</hook_context>
```

The handler can reference these values throughout its process.
</handler_structure>

<execution_model>
## Execution Model

**Synchronous execution:**
Hooks run synchronously after the triggering event completes. GSD waits for hook handlers to finish before proceeding.

**Failure isolation:**
Hook failures are logged but do not block the GSD workflow. A failed hook handler:
- Logs an error message to console
- Does not prevent other hooks from running
- Does not fail the parent GSD command

**Execution order:**
When multiple plugins register for the same event:
1. Plugins execute in their load order (alphabetical by plugin name)
2. Within each plugin, hooks run sequentially
3. Each handler gets its own execution context

**No return values:**
Hooks are fire-and-forget. They cannot return data to the triggering command or modify GSD behavior. For interactive integration, use commands instead.
</execution_model>

<best_practices>
## Best Practices

**Do:**
- Keep hooks focused and fast
- Log meaningful messages for debugging
- Handle errors gracefully (don't throw)
- Write to plugin-specific files/directories
- Use hooks for background processing that doesn't need user input

**Avoid:**
- Long-running operations that block GSD workflows
- External service calls without timeouts
- Modifying GSD core files (STATE.md, ROADMAP.md)
- User prompts or interactive input (use commands instead)
- Complex logic that should be in workflows

**Error handling pattern:**
```markdown
<process>
1. Read the research file at {research_path}
2. IF file parsing fails:
   - Log: "Failed to parse research file: {error}"
   - Exit gracefully (do not throw)
3. Process extracted data
4. IF external service unavailable:
   - Queue for retry (plugin-specific mechanism)
   - Log: "Queued for retry: {reason}"
   - Exit gracefully
5. Confirm completion in plugin log
</process>
```
</best_practices>

<anti_patterns>
## Anti-patterns

**Using hooks for user actions:**
Hooks are passive. If the user needs to decide or provide input, use a command.

```
Wrong: Hook prompts "Do you want to index this research? (y/n)"
Right: Command /neo4j:ingest prompts for confirmation
```

**Blocking on external services:**
Hooks should not wait indefinitely for external services.

```
Wrong: Hook waits for Neo4j connection (30s timeout)
Right: Hook queues data locally, background job syncs to Neo4j
```

**Modifying GSD state:**
Hooks should not write to GSD-managed files.

```
Wrong: Hook appends to STATE.md
Right: Hook writes to plugin-specific state file
```

**Heavy computation:**
Hooks should be lightweight. Heavy processing belongs in workflows or agents.

```
Wrong: Hook runs full codebase analysis
Right: Hook captures metadata, plugin command runs analysis
```
</anti_patterns>

<neo4j_example>
## Example: Neo4j Knowledge Graph Plugin

The motivating use case: passively capture research data into a knowledge graph.

**plugin.json registration:**
```json
{
  "name": "neo4j-knowledge-graph",
  "gsd": {
    "hooks": {
      "post-research": "hooks/capture-research.md",
      "post-execute": "hooks/index-summary.md",
      "post-milestone": "hooks/archive-milestone.md"
    }
  }
}
```

**hooks/capture-research.md:**
```markdown
---
hook: post-research
description: Captures research findings into Neo4j knowledge graph
---

<objective>
Extract structured knowledge from RESEARCH.md and store in Neo4j for future reference.
</objective>

<hook_context>
research_path: {injected at runtime}
phase: {injected at runtime}
</hook_context>

<process>
1. Read the research file at {research_path}
2. Extract structured data:
   - Libraries discovered (name, purpose, URL)
   - Patterns identified (name, description, examples)
   - Decisions made (decision, rationale, alternatives)
3. Write to plugin state file: .neo4j/pending-ingestion.json
4. Log: "Captured research from {phase} for ingestion"
</process>

<error_handling>
If research file cannot be parsed:
- Log warning with file path and error
- Continue without failing (research still usable by GSD)
- User can run /neo4j:ingest manually later
</error_handling>
```

This hook:
- Runs automatically after every research phase
- Captures data without user intervention
- Queues data locally (doesn't block on Neo4j availability)
- Handles errors gracefully
</neo4j_example>

<summary>
## Summary

**Hooks are:**
- Passive integration points in GSD lifecycle
- Registered in plugin.json under `gsd.hooks`
- Markdown prompt files that receive injected context
- Synchronous but failure-isolated

**Available events:**
- `post-project-init`, `post-roadmap`, `post-research`, `post-plan`
- `pre-execute`, `post-execute`, `post-verify`, `post-milestone`

**Key rules:**
- Hooks run automatically (no user invocation)
- Failures don't block GSD workflows
- Don't modify GSD core files
- Use commands for interactive actions

*Hook invocation mechanism implemented in Phase 4 (Plugin Activation)*
</summary>
