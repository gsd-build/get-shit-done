# TSX Commands & Agents

This directory contains TSX source files that generate markdown command/agent prompts using [react-agentic](https://github.com/Kaenn/react-agentic).

## Directory Structure

```
tsx/
├── commands/           # Command definitions (generate to markdown)
│   └── gsd/            # GSD-namespaced commands
│       ├── help.tsx
│       ├── plan-phase.tsx
│       └── plan-phase.runtime.ts
├── components/         # Reusable UI components
│   └── ui/
│       ├── banner-ui.tsx
│       └── spawning-agent-ui.tsx
├── helpers/            # TypeScript utilities
│   ├── index.ts        # Re-exports all helpers
│   ├── config.ts       # Config operations
│   ├── environment.ts  # Environment validation
│   ├── files.ts        # File discovery
│   ├── frontmatter.ts  # Frontmatter parsing
│   ├── phase.ts        # Phase number operations
│   ├── text.ts         # Text processing
│   └── types.ts        # Type definitions
└── agents/             # Agent definitions (if any)
```

## CLI Commands

Generate markdown from TSX files:

```bash
# Generate all commands
npm run generate:commands

# Generate all agents
npm run generate:agents

# Generate everything
npm run generate:tsx
```

Output goes to:
- Commands: `generated/commands/gsd/`
- Agents: `generated/agents/`

## Writing Commands

Commands use the `Command` component from `react-agentic`:

```tsx
import { Command, XmlBlock } from 'react-agentic';

export default (
  <Command
    name="gsd:my-command"
    description="Short description of what this command does"
  >
    {() => (
      <>
        <XmlBlock name="objective">
          <p>What this command should accomplish.</p>
        </XmlBlock>

        <h2>Instructions</h2>
        <p>Step-by-step instructions...</p>
      </>
    )}
  </Command>
);
```

## Runtime Functions

For complex logic, use runtime functions in a separate `.runtime.ts` file:

```tsx
// my-command.runtime.ts
export function myRuntimeFunction(ctx: ExecutionContext): Result {
  // TypeScript logic here
  return { status: 'success', data: '...' };
}

// my-command.tsx
import { runtimeFn } from 'react-agentic';
import { myRuntimeFunction } from './my-command.runtime.js';

const MyRuntimeFunction = runtimeFn(myRuntimeFunction);

// Use in component:
<MyRuntimeFunction resultVar="result" />
```

## Available Components

From `react-agentic`:

| Component | Purpose |
|-----------|---------|
| `Command` | Define a command with name and description |
| `XmlBlock` | Wrap content in XML tags |
| `If` / `Else` | Conditional rendering |
| `Loop` / `Break` | Iteration control |
| `Return` | Early return from command |
| `AskUser` | Prompt user for input |
| `SpawnAgent` | Spawn a sub-agent |
| `Table` | Render data as table |
| `useRuntimeVar` | Access runtime variables |
| `runtimeFn` | Wrap TypeScript functions |

## Helpers

Import helpers from `../helpers`:

```tsx
import {
  // Config
  readConfig, getModelProfile,

  // Environment
  planningExists, roadmapExists,

  // Phase operations
  normalizePhaseNumber, findPhaseDirectory,

  // Text utilities
  generateSlug, formatDuration,

  // Frontmatter
  parseFrontmatter, serializeFrontmatter,
} from '../helpers';
```

## Development Workflow

1. Create/edit TSX files in `tsx/commands/` or `tsx/agents/`
2. Run `npm run generate:tsx` to build markdown
3. Test the generated command with Claude Code
4. Iterate until satisfied

## TypeScript Configuration

The `tsconfig.json` at project root configures:
- Target: ES2020
- JSX: preserve (for react-agentic)
- Module: ESNext with bundler resolution
- Strict mode enabled
