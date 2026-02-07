# GSD Memory

Cross-project knowledge system for GSD (Get Shit Done). An MCP server that provides semantic search across all your GSD projects, extracting decisions, patterns, pitfalls, and tech stack from YAML frontmatter.

## Features

- **Cross-project search** - Find content across all registered GSD projects
- **Decision extraction** - Query decisions from SUMMARY.md and PROJECT.md
- **Pattern discovery** - Find established patterns from completed phases
- **Pitfall awareness** - Learn from documented pitfalls in RESEARCH.md
- **Tech stack tracking** - Track libraries and tools used across projects
- **QMD integration** - Uses QMD for semantic search when available, falls back to grep

## Installation

### Option 1: Add to Claude Code MCP config (recommended)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "gsd-memory": {
      "command": "npx",
      "args": ["-y", "gsd-memory"]
    }
  }
}
```

### Option 2: Install globally

```bash
npm install -g gsd-memory
```

Then add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "gsd-memory": {
      "command": "gsd-memory"
    }
  }
}
```

### Option 3: With QMD (optional, for semantic search)

Install QMD for better search results:

```bash
bun install -g github:tobi/qmd
```

GSD Memory automatically detects and uses QMD when available.

## MCP Tools

### gsd_memory_register

Register a project with GSD memory.

```json
{
  "path": "/path/to/project",
  "name": "my-project"
}
```

### gsd_memory_search

Search across all registered projects.

```json
{
  "query": "authentication JWT",
  "project": "optional-filter",
  "limit": 20
}
```

### gsd_memory_decisions

Find decisions made across projects.

```json
{
  "query": "database choice",
  "tags": ["postgres", "prisma"]
}
```

### gsd_memory_patterns

Find established patterns.

```json
{
  "query": "error handling"
}
```

### gsd_memory_pitfalls

Find documented pitfalls.

```json
{
  "domain": "authentication"
}
```

### gsd_memory_stack

Find tech stack entries.

```json
{
  "query": "jose"
}
```

### gsd_memory_index

Trigger re-indexing for a project.

```json
{
  "project": "my-project"
}
```

### gsd_memory_status

Get status of the memory system.

```json
{}
```

## How It Works

GSD Memory extracts structured data from GSD's YAML frontmatter:

| Document | Extracted Fields |
|----------|------------------|
| SUMMARY.md | `subsystem`, `tags`, `requires`, `provides`, `tech-stack`, `key-decisions`, `patterns-established` |
| RESEARCH.md | `domain`, `confidence`, standard stack tables, pitfalls sections |
| PROJECT.md | Requirements, constraints, key decisions table |

Data is stored in `~/.gsd/projects.json` (registry) and optionally in QMD collections for semantic search.

## Development

```bash
cd gsd-memory
npm install
npm test          # Run unit tests
npm run build     # Build TypeScript
```

## Architecture

```
gsd-memory/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── qmd.ts            # QMD wrapper with grep fallback
│   ├── registry.ts       # Project registry (~/.gsd/projects.json)
│   ├── extractors/       # Frontmatter and content extractors
│   │   ├── frontmatter.ts
│   │   ├── summary.ts
│   │   ├── research.ts
│   │   └── project.ts
│   └── tools/            # MCP tool implementations
│       ├── search.ts
│       ├── decisions.ts
│       ├── patterns.ts
│       ├── pitfalls.ts
│       ├── stack.ts
│       ├── register.ts
│       ├── index-tool.ts
│       └── status.ts
└── tests/
    ├── fixtures/         # Test fixtures
    ├── extractors/       # Extractor tests
    └── tools/            # Tool tests
```

## License

MIT
