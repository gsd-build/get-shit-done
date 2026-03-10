# Phase 12: MCP Server API - Research

**Researched:** 2026-03-10
**Domain:** MCP (Model Context Protocol) server implementation, JSON-RPC, stdio transport
**Confidence:** HIGH

## Summary

The MCP Server API phase exposes GSD operations as an MCP server for programmatic access from other AI agents and tools. The implementation will use the official `@modelcontextprotocol/sdk` TypeScript SDK with stdio transport, which is the standard pattern for local CLI tool integrations like GSD.

The GSD codebase already has a well-structured command system in `gsd-tools.cjs` with modular lib files (`lib/state.cjs`, `lib/phase.cjs`, `lib/health.cjs`, etc.) that return JSON-serializable results. This architecture maps cleanly to MCP tools: each gsd-tools command becomes an MCP tool with the same parameters.

**Primary recommendation:** Use `@modelcontextprotocol/sdk` v1.x with Zod schemas for tool input validation. Implement a tiered tool model (core read-only tier always available, extended mutation tier via capability negotiation) following the decisions in CONTEXT.md. Auto-register the server in Claude Code's MCP config during GSD installation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tiered access model: core tier always available, extended tier via capability negotiation
- Core tier = read-only operations: progress, health, state reads
- Extended tier = mutations: plan-phase, execute-phase, discuss-phase, settings
- Direct parameter mapping: MCP tool params mirror CLI flags exactly
- Rich descriptions in tool schema with detailed docs, parameter descriptions, and examples
- Envelope pattern for all responses: `{ success: bool, data: {...}, error?: {...} }`
- Actionable errors with recovery suggestions: `{ code: 'PHASE_NOT_FOUND', message: '...', recovery: 'Run /gsd:progress' }`
- Streaming updates for long-running operations (execute-phase, plan-phase)
- Blocking/synchronous for all other operations
- Always include `next_actions` array with suggested follow-up tools
- Stdio transport (standard MCP pattern) - run as subprocess, communicate via stdin/stdout
- Auto-register on GSD install - installer adds MCP config to ~/.claude/settings.json
- Inherit project context from Claude Code workspace (uses cwd automatically)
- No authentication required - same trust model as CLI
- Expose four resources: STATE.md, ROADMAP.md, current phase context, health status
- Parsed JSON format (not raw markdown) - structured data for easy consumption
- On-demand only (no push updates or subscriptions)
- Fixed URIs: `gsd://state`, `gsd://roadmap`, `gsd://phase/current`, `gsd://health`

### Claude's Discretion
- Exact streaming protocol implementation details
- Internal caching strategy for parsed resources
- Tool schema JSON structure beyond required fields

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | MCP server exposes core GSD tools (progress, execute-phase, plan-phase, etc.) | SDK's `McpServer.registerTool()` API, existing gsd-tools.cjs command structure |
| MCP-02 | Tools accept same parameters as CLI commands with JSON responses | Direct parameter mapping, Zod schemas for validation |
| MCP-03 | Server can run standalone or integrate with Claude Code MCP config | Stdio transport, auto-registration via installer |
| MCP-04 | Resources expose project state (STATE.md, ROADMAP.md, current phase) | SDK's resource registration API with fixed URIs |
| MCP-05 | Error handling returns structured errors with recovery suggestions | Envelope pattern with isError flag, recovery suggestions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.x (latest 1.x) | MCP server implementation | Official TypeScript SDK, stable v1.x recommended until Q1 2026 v2 release |
| zod | ^3.25+ | Tool input schema validation | Required peer dependency of MCP SDK, TypeScript-first validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none additional) | - | - | GSD already has all needed deps (node stdlib) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @modelcontextprotocol/sdk | Custom JSON-RPC | SDK handles protocol complexity, custom means maintaining more code |
| Stdio transport | HTTP/SSE transport | HTTP needed for remote servers; stdio simpler for local CLI tools |
| Zod schemas | JSON Schema directly | Zod provides TypeScript inference + runtime validation in one |

**Installation:**
```bash
npm install @modelcontextprotocol/sdk zod
```

Note: zod is already available if using v3.25+; check existing package.json. The MCP SDK internally imports from zod/v4 but maintains backward compatibility.

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/bin/
├── gsd-tools.cjs          # Existing CLI (unchanged)
├── gsd-mcp-server.cjs     # NEW: MCP server entry point
└── lib/
    ├── mcp/               # NEW: MCP-specific modules
    │   ├── server.cjs     # McpServer setup, transport connection
    │   ├── tools.cjs      # Tool registrations (core + extended tiers)
    │   ├── resources.cjs  # Resource providers
    │   └── errors.cjs     # Structured error helpers
    ├── state.cjs          # Existing (reused by MCP tools)
    ├── phase.cjs          # Existing (reused by MCP tools)
    ├── health.cjs         # Existing (reused by MCP tools)
    └── ...                # Other existing modules
```

### Pattern 1: McpServer with Stdio Transport
**What:** Create server, register tools/resources, connect to stdio transport
**When to use:** Always - this is the standard MCP server pattern for local tools
**Example:**
```javascript
// Source: MCP TypeScript SDK docs
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const server = new McpServer({
  name: 'gsd-mcp-server',
  version: '1.21.1',  // Match GSD version
});

// Register tools...
// Register resources...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Pattern 2: Tool Registration with Zod Schema
**What:** Define tool with name, description, input schema, and async handler
**When to use:** For every GSD operation exposed via MCP
**Example:**
```javascript
// Source: MCP TypeScript SDK registerTool API
server.registerTool('progress', {
  title: 'GSD Progress',
  description: 'Show project progress across phases and milestones',
  inputSchema: {
    format: z.enum(['json', 'table', 'bar']).optional().describe('Output format'),
    milestone: z.string().optional().describe('Filter to specific milestone (e.g., M7)'),
  },
}, async ({ format, milestone }) => {
  // Call existing GSD lib function
  const result = cmdProgressRender(process.cwd(), format || 'json');
  return {
    content: [{ type: 'text', text: JSON.stringify(envelope(result)) }],
  };
});
```

### Pattern 3: Response Envelope
**What:** Consistent response structure for all tools
**When to use:** Every tool response (per CONTEXT.md decision)
**Example:**
```javascript
// Envelope helper
function envelope(data, error = null) {
  if (error) {
    return {
      success: false,
      data: null,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        recovery: error.recovery || null,
      },
      next_actions: error.next_actions || [],
    };
  }
  return {
    success: true,
    data,
    error: null,
    next_actions: suggestNextActions(data),
  };
}
```

### Pattern 4: Resource Provider with Fixed URI
**What:** Register resources with stable URIs that return parsed JSON
**When to use:** For STATE.md, ROADMAP.md, phase context, health status
**Example:**
```javascript
// Source: MCP SDK resource registration
server.registerResource('gsd://state', {
  name: 'GSD Project State',
  description: 'Parsed STATE.md with progress, decisions, blockers',
  mimeType: 'application/json',
}, async () => {
  const state = cmdStateSnapshot(process.cwd());
  return { contents: [{ uri: 'gsd://state', text: JSON.stringify(state) }] };
});
```

### Pattern 5: Tiered Tool Access
**What:** Separate read-only core tools from mutation tools
**When to use:** Per CONTEXT.md tiered access model
**Example:**
```javascript
// Core tier (always registered)
const CORE_TOOLS = ['progress', 'health', 'state_get', 'phase_info', 'roadmap_get'];

// Extended tier (requires capability)
const EXTENDED_TOOLS = ['plan_phase', 'execute_phase', 'discuss_phase', 'state_update'];

function registerTools(server, capabilities = {}) {
  // Always register core tools
  for (const tool of CORE_TOOLS) {
    registerCoreTool(server, tool);
  }

  // Register extended tools if capability granted
  if (capabilities.mutations !== false) {
    for (const tool of EXTENDED_TOOLS) {
      registerExtendedTool(server, tool);
    }
  }
}
```

### Anti-Patterns to Avoid
- **Logging to stdout:** Never write logs to stdout on stdio servers - stdout carries JSON-RPC messages. Log to stderr or a file instead.
- **Blocking on long operations:** For execute-phase and plan-phase, use streaming progress notifications, not synchronous blocking.
- **Raw markdown in resources:** Parse STATE.md/ROADMAP.md to JSON; raw markdown is harder for AI agents to consume programmatically.
- **Inventing new parameter names:** Mirror CLI flags exactly (per CONTEXT.md) so documentation applies to both interfaces.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-RPC protocol | Custom message parsing | @modelcontextprotocol/sdk | Protocol is complex; SDK handles framing, error codes, response correlation |
| Input validation | Manual type checks | Zod schemas | Type inference + runtime validation + auto-generated descriptions |
| Transport layer | Raw stdin/stdout handling | StdioServerTransport | Handles buffering, newline delimiting, proper encoding |
| MCP message types | Custom types | SDK types | TypeScript types for all MCP messages, tools, resources |

**Key insight:** The MCP SDK abstracts significant protocol complexity (JSON-RPC 2.0 compliance, message framing, error code semantics). Hand-rolling any of this would be error-prone and create compatibility issues.

## Common Pitfalls

### Pitfall 1: Stdout Pollution
**What goes wrong:** Server becomes unresponsive or clients receive parse errors
**Why it happens:** Console.log() or debug output written to stdout interferes with JSON-RPC messages
**How to avoid:** All logging must go to stderr: `console.error()` or file logging
**Warning signs:** "Invalid JSON" errors, "Connection closed" from clients

### Pitfall 2: Blocking Long Operations
**What goes wrong:** Timeouts on execute-phase, plan-phase calls
**Why it happens:** Synchronous execution of multi-minute workflows
**How to avoid:** Use MCP progress notifications for streaming updates; consider async task model
**Warning signs:** MCP_TIMEOUT errors, unresponsive server during execution

### Pitfall 3: CWD Context Loss
**What goes wrong:** Server operates on wrong project
**Why it happens:** MCP server doesn't inherit Claude Code's working directory
**How to avoid:** Pass cwd explicitly in tool calls, or read from environment (Claude Code sets it)
**Warning signs:** "Planning directory not found", wrong project state returned

### Pitfall 4: Missing Error Recovery
**What goes wrong:** AI agents get stuck after errors
**Why it happens:** Error messages don't include actionable recovery steps
**How to avoid:** Every error must include `recovery` field with specific command suggestion
**Warning signs:** AI repeatedly calling same failing tool, no recovery path

### Pitfall 5: Schema Type Mismatches
**What goes wrong:** TypeScript errors, runtime validation failures
**Why it happens:** Zod v3 vs v4 compatibility issues with MCP SDK
**How to avoid:** Use zod v3.25+ (SDK maintains backward compatibility)
**Warning signs:** "ZodType missing properties" errors during tool registration

## Code Examples

Verified patterns from official sources:

### Basic MCP Server Setup
```javascript
// Source: MCP TypeScript SDK, https://github.com/modelcontextprotocol/typescript-sdk
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

async function main() {
  const server = new McpServer({
    name: 'gsd-mcp-server',
    version: '1.21.1',
  });

  // Tools and resources registered here...

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP Server error:', err);
  process.exit(1);
});
```

### Tool with Complex Schema
```javascript
// Source: MCP SDK registerTool API
server.registerTool('execute_phase', {
  title: 'Execute GSD Phase',
  description: 'Execute a specific phase plan. Requires extended tier access.',
  inputSchema: {
    phase: z.string().describe('Phase number or M<milestone>/<phase> reference'),
    plan: z.number().optional().describe('Specific plan number (defaults to next incomplete)'),
    dry_run: z.boolean().optional().default(false).describe('Preview actions without executing'),
  },
}, async ({ phase, plan, dry_run }, ctx) => {
  // Stream progress via ctx.mcpReq.log()
  await ctx.mcpReq.log('info', `Starting phase ${phase} execution...`);

  const result = await executePhaseWithProgress(process.cwd(), phase, plan, dry_run, (progress) => {
    ctx.mcpReq.log('info', progress.message);
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(envelope(result)) }],
  };
});
```

### Resource Registration
```javascript
// Source: MCP SDK resource API
server.registerResource('gsd://roadmap', {
  name: 'GSD Roadmap',
  description: 'Parsed ROADMAP.md with phases, progress, and dependencies',
  mimeType: 'application/json',
}, async () => {
  const roadmap = cmdRoadmapAnalyze(process.cwd());
  return {
    contents: [{
      uri: 'gsd://roadmap',
      mimeType: 'application/json',
      text: JSON.stringify(roadmap),
    }],
  };
});
```

### Error with Recovery Suggestion
```javascript
// Structured error pattern
function phaseNotFoundError(phase) {
  return {
    code: 'PHASE_NOT_FOUND',
    message: `Phase ${phase} does not exist in .planning/phases/`,
    recovery: 'Run /gsd:progress to see available phases, or /gsd:plan-phase to create a new phase',
    next_actions: ['progress', 'roadmap_get'],
  };
}
```

### Claude Code MCP Configuration
```json
// Source: Claude Code MCP docs, https://code.claude.com/docs/en/mcp
// ~/.claude.json or .mcp.json
{
  "mcpServers": {
    "gsd": {
      "type": "stdio",
      "command": "node",
      "args": ["~/.claude/get-shit-done/bin/gsd-mcp-server.cjs"],
      "env": {}
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom JSON-RPC | @modelcontextprotocol/sdk | 2024 | Standardized server implementation |
| SSE transport | Streamable HTTP (new) | Q1 2026 | HTTP preferred for remote servers |
| Sync-only tools | Async tasks with progress | 2025 | Long operations don't timeout |
| Raw markdown resources | Parsed JSON resources | Best practice | AI agents consume structured data better |

**Deprecated/outdated:**
- SSE transport: Deprecated in favor of Streamable HTTP for remote servers. Stdio remains standard for local.
- v2 SDK: Not released yet (anticipated Q1 2026). Use v1.x for production.

## Open Questions

1. **Streaming Implementation Details**
   - What we know: MCP supports progress notifications via `ctx.mcpReq.log()`
   - What's unclear: Exact integration with GSD's execute-phase workflow (which spawns subprocesses)
   - Recommendation: Start with synchronous calls, add streaming in follow-up iteration

2. **Auto-Registration Mechanism**
   - What we know: Claude Code reads MCP config from `~/.claude.json` or `.mcp.json`
   - What's unclear: Best hook point in GSD installer (`bin/install.js`)
   - Recommendation: Add to installer, detect existing config, merge safely

3. **Capability Negotiation for Tiers**
   - What we know: CONTEXT.md specifies tiered access (core vs extended)
   - What's unclear: How clients signal capability preferences
   - Recommendation: Default to full access (same trust as CLI), capability restriction is future enhancement

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK, server patterns, registerTool API
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp) - Configuration format, installation scopes, troubleshooting
- [MCP Protocol Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) - Transport specs, JSON-RPC format

### Secondary (MEDIUM confidence)
- [NPM @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - Version info, installation, peer deps
- [Zod Documentation](https://zod.dev/) - Schema validation patterns

### Tertiary (LOW confidence)
- Various Medium articles on MCP streaming - Implementation details may vary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK is well-documented and stable v1.x
- Architecture: HIGH - Patterns match GSD's existing modular structure
- Pitfalls: MEDIUM - Based on general MCP server experience, GSD-specific issues TBD

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (30 days - MCP SDK is stable v1.x)
