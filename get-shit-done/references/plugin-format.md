<overview>
Plugins extend GSD functionality through self-contained packages. This reference defines the plugin manifest schema, folder structure, and registration patterns.

**Key insight:** A plugin is a self-contained folder with a `plugin.json` manifest that tells GSD what the plugin provides (commands, workflows, agents), what it needs (GSD version, services), and how to activate it.
</overview>

<manifest_schema>
Every plugin requires a `plugin.json` manifest in its root directory.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Plugin identifier (kebab-case) |
| `version` | string | Semantic version (MAJOR.MINOR.PATCH) |
| `description` | string | One-line plugin description |
| `author` | string | Author name or contact |

**Example (minimal plugin):**
```json
{
  "name": "git-hooks",
  "version": "1.0.0",
  "description": "Git workflow automation for GSD",
  "author": "Developer Name"
}
```

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `repository` | string | Git URL for plugin source |
| `license` | string | SPDX identifier (MIT, Apache-2.0) |
| `keywords` | array | Discovery tags for search |

## GSD Configuration

The `gsd` object contains plugin-specific configuration:

```json
{
  "gsd": {
    "minVersion": "1.4.0",
    "commands": [],
    "workflows": [],
    "agents": [],
    "hooks": {},
    "services": null
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `minVersion` | string | Minimum GSD version required |
| `commands` | array | Commands the plugin provides |
| `workflows` | array | Workflow files for GSD integration |
| `agents` | array | Agent definitions for subagent spawning |
| `hooks` | object | GSD lifecycle event handlers |
| `services` | object | Docker/service configuration |

</manifest_schema>

<folder_structure>
## Folder Structure

Plugins follow a standardized directory layout that mirrors GSD's core structure.

**Directory layout:**
```
my-plugin/
├── plugin.json          # Manifest (required)
├── README.md            # Plugin documentation (required)
├── commands/            # Commands (optional)
│   └── *.md            # Each file = one slash command
├── agents/              # Subagents (optional)
│   └── *.md            # Each file = one agent
├── workflows/           # Workflows (optional)
│   └── *.md            # Referenced by commands
├── templates/           # Templates (optional)
│   └── *.md            # File templates
├── references/          # Reference docs (optional)
│   └── *.md            # Implementation guides
├── docker/              # Services (optional)
│   ├── docker-compose.yml
│   └── Dockerfile
└── hooks/               # Lifecycle hooks (optional)
    └── *.md            # Hook handlers
```

**Directory purposes:**

| Directory | Purpose | Required |
|-----------|---------|----------|
| `commands/` | Slash commands users invoke directly | No |
| `agents/` | Subagent definitions for task execution | No |
| `workflows/` | Multi-step procedures called by commands | No |
| `templates/` | Document templates for file generation | No |
| `references/` | Implementation guides and docs | No |
| `hooks/` | GSD lifecycle event handlers | No |
| `docker/` | Docker Compose and service configs | No |

**Installation mapping:**

When a plugin is installed, files are copied to the GSD configuration directory:

| Plugin Path | Installed To |
|-------------|--------------|
| `commands/*.md` | `~/.claude/commands/{plugin-name}/*.md` |
| `agents/*.md` | `~/.claude/agents/*.md` |
| `workflows/*.md` | `~/.claude/{plugin-name}/workflows/*.md` |
| `templates/*.md` | `~/.claude/{plugin-name}/templates/*.md` |
| `references/*.md` | `~/.claude/{plugin-name}/references/*.md` |
| `hooks/*.md` | `~/.claude/{plugin-name}/hooks/*.md` |
| `docker/*` | `~/.claude/{plugin-name}/docker/*` |

**Key insight:** Commands install to a namespaced subdirectory (`commands/{plugin-name}/`) to enable the `/plugin-name:command` pattern. Other files install under the plugin's own directory.
</folder_structure>

<file_conventions>
## File Conventions

**Naming patterns:**

| File Type | Pattern | Example |
|-----------|---------|---------|
| Plugin name | kebab-case | `neo4j-knowledge-graph` |
| Command name | `{plugin}:{command}` | `neo4j:query` |
| Agent name | `{plugin}-{agent}` | `neo4j-kg-indexer` |
| All files | kebab-case.md | `capture-research.md` |

**Command namespacing rules:**
- All commands MUST be prefixed with the plugin name
- Format: `/plugin-name:command-name`
- Prevents collision with core GSD commands (`gsd:*`)
- Multiple commands share the same plugin prefix

**Path references within plugin files:**
- Always use relative paths from plugin root
- Forward slashes only (cross-platform compatibility)
- No `..` traversal outside plugin folder
- Reference other plugin files: `@./workflows/my-workflow.md`
- After installation, paths resolve to: `@~/.claude/{plugin}/workflows/my-workflow.md`

**File format requirements:**
- Commands: YAML frontmatter with name, description, allowed-tools
- Workflows: Process-oriented markdown with clear steps
- Agents: Role/capabilities definition with process section
- Templates: Guideline section explaining usage
- References: Structured documentation with examples
</file_conventions>

<minimal_plugin_example>
## Minimal Plugin Example

The simplest possible plugin - a single command:

**Directory structure:**
```
hello-world/
├── plugin.json
├── README.md
└── commands/
    └── hello.md
```

**plugin.json:**
```json
{
  "name": "hello-world",
  "version": "1.0.0",
  "description": "Simple greeting command for GSD",
  "author": "Developer Name",
  "gsd": {
    "minVersion": "1.4.0",
    "commands": [
      {
        "name": "hello-world:greet",
        "file": "commands/hello.md",
        "description": "Display a friendly greeting"
      }
    ]
  }
}
```

**README.md:**
```markdown
# hello-world

A simple greeting command for GSD.

## Installation

\`\`\`bash
gsd plugin install ./hello-world
\`\`\`

## Commands

| Command | Description |
|---------|-------------|
| `/hello-world:greet` | Display a friendly greeting |

## Usage

\`\`\`
/hello-world:greet
\`\`\`

Outputs a greeting message to the user.
```

**commands/hello.md:**
```markdown
---
name: hello-world:greet
description: Display a friendly greeting
allowed-tools: []
---

<process>
Respond with a friendly greeting to the user.

Say: "Hello from the hello-world plugin! GSD plugin system is working correctly."
</process>
```

This minimal example demonstrates:
- Required files only (plugin.json, README.md, one command)
- Proper command namespacing (`hello-world:greet`)
- Correct manifest structure with gsd.commands array
</minimal_plugin_example>

<complex_plugin_example>
## Complex Plugin Example

A full-featured plugin with services - the Neo4j knowledge graph from PROJECT.md:

**Directory structure:**
```
neo4j-knowledge-graph/
├── plugin.json
├── README.md
├── commands/
│   ├── query.md
│   └── status.md
├── agents/
│   └── neo4j-kg-indexer.md
├── workflows/
│   └── research-capture.md
├── hooks/
│   └── post-research.md
└── docker/
    └── docker-compose.yml
```

**plugin.json:**
```json
{
  "name": "neo4j-knowledge-graph",
  "version": "1.0.0",
  "description": "Knowledge graph for research capture and semantic querying",
  "author": {
    "name": "GSD Team",
    "email": "dev@example.com"
  },
  "repository": "https://github.com/gsd/neo4j-knowledge-graph",
  "license": "MIT",
  "keywords": ["knowledge-graph", "neo4j", "research", "semantic"],
  "gsd": {
    "minVersion": "1.4.0",
    "commands": [
      {
        "name": "neo4j:query",
        "file": "commands/query.md",
        "description": "Query the knowledge graph with Cypher"
      },
      {
        "name": "neo4j:status",
        "file": "commands/status.md",
        "description": "Check Neo4j service status"
      }
    ],
    "workflows": [
      {
        "name": "research-capture",
        "file": "workflows/research-capture.md"
      }
    ],
    "agents": [
      {
        "name": "neo4j-kg-indexer",
        "file": "agents/neo4j-kg-indexer.md"
      }
    ],
    "hooks": {
      "post-research": "hooks/post-research.md"
    },
    "services": {
      "docker-compose": "docker/docker-compose.yml",
      "healthCheck": "docker/health.sh"
    }
  }
}
```

**docker/docker-compose.yml:**
```yaml
version: '3.8'
services:
  neo4j:
    image: neo4j:5.15
    container_name: gsd-neo4j
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/gsd-knowledge
      - NEO4J_PLUGINS=["apoc"]
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    restart: unless-stopped

volumes:
  neo4j_data:
  neo4j_logs:
```

**commands/query.md:**
```markdown
---
name: neo4j:query
description: Query the knowledge graph with Cypher
argument-hint: "<cypher-query>"
allowed-tools: [Bash, Read]
---

<process>
Execute a Cypher query against the Neo4j knowledge graph.

1. Validate the query syntax
2. Execute against Neo4j at bolt://localhost:7687
3. Format and return results

Use cypher-shell for query execution:
\`\`\`bash
cypher-shell -u neo4j -p gsd-knowledge "MATCH (n) RETURN n LIMIT 10"
\`\`\`
</process>
```

**hooks/post-research.md:**
```markdown
---
trigger: post-research
---

<process>
After research phase completion, index discovered concepts into the knowledge graph.

1. Read research summary from .planning/phases/{phase}/research/
2. Extract key concepts, relationships, and decisions
3. Create Cypher statements to add nodes and edges
4. Execute against Neo4j to persist the knowledge

This enables future research phases to query prior discoveries.
</process>
```

This complex example demonstrates:
- Full manifest with all optional fields
- Multiple commands with namespacing
- Custom workflow for research capture
- Subagent for specialized indexing tasks
- Hook integration with GSD lifecycle
- Self-contained Docker services
</complex_plugin_example>

<command_registration>
## Command Registration

Commands register as `/pluginname:command-name` in the GSD command namespace.

**Structure:**
```json
{
  "commands": [
    {
      "name": "neo4j:query",
      "file": "commands/query.md",
      "description": "Query the knowledge graph"
    },
    {
      "name": "neo4j:ingest",
      "file": "commands/ingest.md",
      "description": "Ingest research data into graph"
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Command name (format: `pluginname:command`) |
| `file` | Yes | Path relative to plugin root |
| `description` | No | Help text for command listing |

**Command file format:**
Command files follow the standard GSD command format with YAML frontmatter:

```markdown
---
name: neo4j:query
description: Query the knowledge graph
argument-hint: "<cypher-query>"
allowed-tools: [Read, Write, Bash]
---

<process>
[Command implementation]
</process>
```

**Namespace convention:**
- Plugin commands use the format `pluginname:command`
- Avoids collision with core GSD commands (`gsd:*`)
- Multiple commands per plugin share the same prefix
</command_registration>

<workflow_registration>
## Workflow Registration

Workflows integrate with existing GSD workflows or provide new standalone workflows.

**Structure:**
```json
{
  "workflows": [
    {
      "name": "knowledge-capture",
      "file": "workflows/capture.md"
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Workflow identifier (kebab-case) |
| `file` | Yes | Path relative to plugin root |

**Usage:**
Plugin workflows can be invoked by:
1. Plugin commands that delegate to them
2. GSD hooks that trigger them
3. Direct reference in plans (advanced)

**Integration pattern:**
Plugin workflows follow the same structure as GSD core workflows but live in the plugin folder.
</workflow_registration>

<agent_registration>
## Agent Registration

Agents become available for subagent spawning during plan execution.

**Structure:**
```json
{
  "agents": [
    {
      "name": "neo4j-indexer",
      "file": "agents/indexer.md"
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent identifier (kebab-case) |
| `file` | Yes | Path relative to plugin root |

**Agent file format:**
```markdown
# [Agent Name]

<role>
[Agent's purpose and capabilities]
</role>

<process>
[Execution flow]
</process>
```

**Spawning:**
Plugin agents can be spawned by orchestrator commands when executing plans that require specialized processing.
</agent_registration>

<hooks_overview>
## Hooks Overview

Hooks allow plugins to respond to GSD lifecycle events.

**Structure:**
```json
{
  "hooks": {
    "post-plan": "hooks/capture-context.md",
    "post-execute": "hooks/index-results.md",
    "pre-commit": "hooks/validate-changes.md"
  }
}
```

**Available lifecycle events:**

| Hook | Trigger | Use Case |
|------|---------|----------|
| `post-plan` | After plan creation | Capture planning context |
| `post-execute` | After plan execution | Index results, notify systems |
| `pre-commit` | Before git commit | Validate changes, run checks |
| `post-commit` | After git commit | Trigger external systems |
| `on-error` | When execution fails | Log errors, send alerts |

**Hook file format:**
Hook files are markdown prompts that execute when triggered:

```markdown
# Post-Execute Hook

<trigger>post-execute</trigger>

<process>
[What to do when triggered]
</process>
```

*Detailed hook implementation in Phase 01-03 (Plugin Hooks and Lifecycle Events)*
</hooks_overview>

<services_overview>
## Services Overview

Plugins can include Docker containers and services that run alongside GSD.

**Structure:**
```json
{
  "services": {
    "docker-compose": "services/docker-compose.yml",
    "healthCheck": "services/health.sh"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `docker-compose` | Yes | Path to Docker Compose file |
| `healthCheck` | No | Script to verify service health |

**Example docker-compose.yml:**
```yaml
version: '3.8'
services:
  neo4j:
    image: neo4j:5.15
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/password
    volumes:
      - neo4j_data:/data

volumes:
  neo4j_data:
```

**Note on volumes:**
Named volumes (like `neo4j_data`) persist across container restarts but are deleted on uninstall. For data that should survive uninstall, use bind mounts to a location outside `~/.claude/`.

**Service lifecycle:**

| Event | Action | Command |
|-------|--------|---------|
| Plugin install | Start services | `docker compose up -d` |
| Plugin enable | Start services | `docker compose up -d` |
| Plugin disable | Stop services | `docker compose down` |
| Plugin uninstall | Remove containers + volumes | `docker compose down -v --remove-orphans` |

**Lifecycle details:**

1. **On install:** Services start automatically if Docker is available. Plugin remains installed even if Docker is unavailable.

2. **On enable:** Services start. If Docker is unavailable, plugin is enabled but services won't run (warning shown).

3. **On disable:** Services stop. Containers are stopped but not removed. Data volumes are preserved.

4. **On uninstall:** Full cleanup - containers stopped, removed, and named volumes deleted. This ensures a clean slate for reinstallation.

**Health checks:**

If `healthCheck` script is provided, it runs when:
- Displaying plugin info (`plugin info <name>`)
- The script should exit 0 for healthy, non-zero for unhealthy
- Health check output is captured for error reporting

**Docker requirements:**

- Docker Desktop or Docker Engine must be installed
- `docker compose` (v2) or `docker-compose` (v1) command must be available
- If Docker is unavailable, plugin operations succeed with warnings
- Services are optional - plugins work without Docker if no services defined

**For plugins without services:**
Set `services` to `null` or omit the field entirely.
</services_overview>

<activation_behavior>
## Activation Behavior

Plugins have an enabled/disabled state that controls their availability without removing files.

**Default state:**
- Plugins are enabled by default on installation
- The `_installed.enabled` flag in plugin.json controls activation state
- If `_installed.enabled` is not set, the plugin is considered enabled (backwards compatibility)

**Enabled vs Disabled:**

| State | Commands | Hooks | Services |
|-------|----------|-------|----------|
| Enabled | Visible and usable via `/pluginname:command` | Fire on lifecycle events | Start and run |
| Disabled | Hidden from `/gsd:plugin commands` | Don't fire | Don't start |

**Enable/Disable workflow:**
```bash
# Disable a plugin (keeps all files)
plugin disable my-plugin

# Enable a disabled plugin
plugin enable my-plugin
```

**Key differences from uninstall:**
- `disable` keeps all plugin files in place, just marks as inactive
- `uninstall` removes all plugin files from `~/.claude/`
- Disabled plugins can be instantly re-enabled without reinstallation
- Useful for troubleshooting, testing, or temporarily turning off functionality

**Checking plugin status:**
- `/gsd:plugin list` shows all plugins with `(disabled)` indicator for disabled ones
- `/gsd:plugin commands` shows only commands from enabled plugins
- `/gsd:plugin info <name>` shows detailed information regardless of enabled state

**Example enable/disable workflow:**
```bash
# Troubleshooting: disable a plugin to isolate an issue
plugin disable neo4j-knowledge-graph

# Test without the plugin
# ... run your tests ...

# Re-enable when done
plugin enable neo4j-knowledge-graph
```
</activation_behavior>

<validation_rules>
## Validation Rules

A valid plugin manifest must satisfy these rules:

**Name validation:**
- Kebab-case only: `my-plugin` (valid), `myPlugin` (invalid), `my_plugin` (invalid)
- Lowercase letters, numbers, hyphens
- Must start with a letter
- 3-50 characters

**Version validation:**
- Semantic versioning: `MAJOR.MINOR.PATCH`
- Valid: `1.0.0`, `2.3.1`, `0.1.0`
- Invalid: `1.0`, `v1.0.0`, `1.0.0-beta`

**File path validation:**
- Paths are relative to plugin root
- Referenced files must exist
- Forward slashes only (cross-platform)
- No `..` path traversal

**Command name validation:**
- Format: `pluginname:command-name`
- Plugin prefix must match manifest `name`
- Command portion is kebab-case

**Validation errors:**
```
Error: Invalid plugin name "myPlugin" - must be kebab-case
Error: File not found: commands/missing.md
Error: Command prefix "other" doesn't match plugin name "example"
```
</validation_rules>

<examples>
## Complete Examples

### Simple Command Plugin

```json
{
  "name": "git-stats",
  "version": "1.0.0",
  "description": "Git statistics for GSD projects",
  "author": "Developer",
  "license": "MIT",
  "gsd": {
    "minVersion": "1.4.0",
    "commands": [
      {
        "name": "git-stats:summary",
        "file": "commands/summary.md",
        "description": "Show commit statistics"
      },
      {
        "name": "git-stats:contributors",
        "file": "commands/contributors.md",
        "description": "List contributors"
      }
    ]
  }
}
```

### Complex Plugin with Services

```json
{
  "name": "neo4j-knowledge-graph",
  "version": "1.0.0",
  "description": "Knowledge graph for research capture",
  "author": {
    "name": "Developer Name",
    "email": "dev@example.com"
  },
  "repository": "https://github.com/user/gsd-neo4j-plugin",
  "license": "MIT",
  "keywords": ["knowledge-graph", "neo4j", "research"],
  "gsd": {
    "minVersion": "1.4.0",
    "commands": [
      {
        "name": "neo4j:query",
        "file": "commands/query.md",
        "description": "Query knowledge graph"
      },
      {
        "name": "neo4j:ingest",
        "file": "commands/ingest.md",
        "description": "Ingest research data"
      }
    ],
    "workflows": [
      {
        "name": "capture-research",
        "file": "workflows/capture.md"
      }
    ],
    "agents": [
      {
        "name": "neo4j-indexer",
        "file": "agents/indexer.md"
      }
    ],
    "hooks": {
      "post-plan": "hooks/capture-context.md",
      "post-execute": "hooks/index-results.md"
    },
    "services": {
      "docker-compose": "services/docker-compose.yml",
      "healthCheck": "services/health.sh"
    }
  }
}
```
</examples>

<anti_patterns>
## Anti-patterns

**Avoid these common mistakes:**

<pattern name="wrong-naming">
### Wrong: Non-kebab-case names

```json
{
  "name": "myPlugin",
  "commands": [
    {"name": "myPlugin:doThing"}
  ]
}
```

Correct: Use kebab-case everywhere
```json
{
  "name": "my-plugin",
  "commands": [
    {"name": "my-plugin:do-thing"}
  ]
}
```
</pattern>

<pattern name="missing-prefix">
### Wrong: Command name without plugin prefix

```json
{
  "name": "analytics",
  "commands": [
    {"name": "report", "file": "commands/report.md"}
  ]
}
```

Correct: Prefix commands with plugin name
```json
{
  "name": "analytics",
  "commands": [
    {"name": "analytics:report", "file": "commands/report.md"}
  ]
}
```
</pattern>

<pattern name="absolute-paths">
### Wrong: Absolute or traversal paths

```json
{
  "commands": [
    {"name": "x:y", "file": "/usr/local/commands/x.md"},
    {"name": "x:z", "file": "../other-plugin/cmd.md"}
  ]
}
```

Correct: Relative paths within plugin folder
```json
{
  "commands": [
    {"name": "x:y", "file": "commands/x.md"},
    {"name": "x:z", "file": "commands/z.md"}
  ]
}
```
</pattern>

<pattern name="colliding-namespace">
### Wrong: Using gsd: prefix

```json
{
  "name": "my-extension",
  "commands": [
    {"name": "gsd:my-command", "file": "commands/cmd.md"}
  ]
}
```

Correct: Use plugin name as prefix
```json
{
  "name": "my-extension",
  "commands": [
    {"name": "my-extension:my-command", "file": "commands/cmd.md"}
  ]
}
```
</pattern>

<pattern name="service-without-health">
### Risky: Services without health checks

```json
{
  "services": {
    "docker-compose": "services/docker-compose.yml"
  }
}
```

Better: Include health check for reliability
```json
{
  "services": {
    "docker-compose": "services/docker-compose.yml",
    "healthCheck": "services/health.sh"
  }
}
```
</pattern>
</anti_patterns>

<summary>
## Summary

**Plugin manifest essentials:**
1. Required: `name`, `version`, `description`, `author`
2. Optional: `repository`, `license`, `keywords`
3. GSD config: `minVersion`, `commands`, `workflows`, `agents`, `hooks`, `services`

**Key conventions:**
- Names are kebab-case
- Commands use `pluginname:command` format
- File paths are relative to plugin root
- Services are optional (set to `null` if not needed)

**Validation ensures:**
- Name format is correct
- Version is semver
- Referenced files exist
- Command prefixes match plugin name

*See template at `get-shit-done/templates/plugin/plugin.json`*
</summary>
