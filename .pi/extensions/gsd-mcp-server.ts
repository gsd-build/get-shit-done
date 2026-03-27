/**
 * GSD MCP Server Extension for Pi
 *
 * Exposes GSD as an MCP (Model Context Protocol) server.
 * Allows other agents and tools to interact with GSD.
 *
 * Resources: PROJECT.md, STATE.md, ROADMAP.md
 * Tools: gsd_query, gsd_execute, gsd_plan
 * Prompts: plan_phase, execute_phase
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// MCP Server configuration
const MCP_SERVER_CONFIG = {
  name: "gsd-server",
  version: "1.0.0",
  description: "GSD - Get Shit Done MCP Server",
};

// Tool definitions
const MCP_TOOLS = [
  {
    name: "gsd_query",
    description: "Query GSD state and artifacts",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
          description: "Query type: state, roadmap, requirements, project",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "gsd_plan",
    description: "Create or get execution plans",
    inputSchema: {
      type: "object" as const,
      properties: {
        phase: {
          type: "string" as const,
          description: "Phase number",
        },
        action: {
          type: "string" as const,
          enum: ["get", "list", "create"],
          description: "Action to perform",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "gsd_record",
    description: "Record decisions, blockers, or progress",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string" as const,
          enum: ["decision", "blocker", "progress"],
          description: "What to record",
        },
        content: {
          type: "string" as const,
          description: "Content to record",
        },
        phase: {
          type: "string" as const,
          description: "Optional phase number",
        },
      },
      required: ["type", "content"],
    },
  },
];

// Resource definitions
const MCP_RESOURCES = [
  {
    uri: "gsd://project",
    name: "Project Vision",
    description: "PROJECT.md - Project vision and constraints",
    mimeType: "text/markdown",
  },
  {
    uri: "gsd://state",
    name: "Current State",
    description: "STATE.md - Current position and decisions",
    mimeType: "text/markdown",
  },
  {
    uri: "gsd://roadmap",
    name: "Roadmap",
    description: "ROADMAP.md - Phase breakdown and progress",
    mimeType: "text/markdown",
  },
  {
    uri: "gsd://requirements",
    name: "Requirements",
    description: "REQUIREMENTS.md - Scoped requirements",
    mimeType: "text/markdown",
  },
];

/**
 * Read GSD resource
 */
function readResource(uri: string): string | null {
  const planningDir = join(process.cwd(), ".planning");

  const resourceMap: Record<string, string> = {
    "gsd://project": join(planningDir, "PROJECT.md"),
    "gsd://state": join(planningDir, "STATE.md"),
    "gsd://roadmap": join(planningDir, "ROADMAP.md"),
    "gsd://requirements": join(planningDir, "REQUIREMENTS.md"),
  };

  const filePath = resourceMap[uri];
  if (!filePath || !existsSync(filePath)) {
    return null;
  }

  return readFileSync(filePath, "utf-8");
}

/**
 * Handle MCP tool call
 */
function handleToolCall(name: string, args: Record<string, unknown>): { content: string; isError?: boolean } {
  switch (name) {
    case "gsd_query": {
      const query = args.query as string;
      const planningDir = join(process.cwd(), ".planning");

      if (!existsSync(planningDir)) {
        return { content: "Error: GSD not initialized. No .planning/ directory.", isError: true };
      }

      switch (query) {
        case "state": {
          const state = readResource("gsd://state");
          return { content: state || "STATE.md not found" };
        }
        case "roadmap": {
          const roadmap = readResource("gsd://roadmap");
          return { content: roadmap || "ROADMAP.md not found" };
        }
        case "requirements": {
          const reqs = readResource("gsd://requirements");
          return { content: reqs || "REQUIREMENTS.md not found" };
        }
        case "project": {
          const project = readResource("gsd://project");
          return { content: project || "PROJECT.md not found" };
        }
        default:
          return { content: `Unknown query: ${query}. Use: state, roadmap, requirements, project`, isError: true };
      }
    }

    case "gsd_plan": {
      const action = args.action as string;
      const phase = args.phase as string | undefined;
      const planningDir = join(process.cwd(), ".planning");

      if (action === "list") {
        // List all plans
        const phasesDir = join(planningDir, "phases");
        if (!existsSync(phasesDir)) {
          return { content: "No phases directory found" };
        }

        // Would list plans - simplified for now
        return { content: "List plans functionality - use gsd-tools.cjs for full implementation" };
      }

      if (action === "get" && phase) {
        const planPath = join(planningDir, "phases", `${phase}-phase`, `${phase}-01-PLAN.md`);
        if (existsSync(planPath)) {
          return { content: readFileSync(planPath, "utf-8") };
        }
        return { content: `Plan not found for phase ${phase}`, isError: true };
      }

      return { content: "Specify action: get, list, or create", isError: true };
    }

    case "gsd_record": {
      const type = args.type as string;
      const content = args.content as string;
      const phase = args.phase as string | undefined;
      const planningDir = join(process.cwd(), ".planning");
      const statePath = join(planningDir, "STATE.md");

      if (!existsSync(statePath)) {
        return { content: "STATE.md not found", isError: true };
      }

      // Append to STATE.md
      const timestamp = new Date().toISOString();
      let entry = "";

      switch (type) {
        case "decision":
          entry = `\n- [${timestamp}] Decision: ${content}${phase ? ` (Phase ${phase})` : ""}`;
          break;
        case "blocker":
          entry = `\n- [${timestamp}] Blocker: ${content}`;
          break;
        case "progress":
          entry = `\n- [${timestamp}] Progress: ${content}`;
          break;
      }

      try {
        const state = readFileSync(statePath, "utf-8");
        // Find Decisions section and append
        const updated = state.includes("## Decisions")
          ? state.replace("## Decisions", `## Decisions${entry}`)
          : state + `\n\n## Decisions${entry}`;

        writeFileSync(statePath, updated);
        return { content: `Recorded: ${type} - ${content}` };
      } catch (err) {
        return { content: `Failed to record: ${(err as Error).message}`, isError: true };
      }
    }

    default:
      return { content: `Unknown tool: ${name}`, isError: true };
  }
}

export default function (pi: ExtensionAPI) {
  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_mcp_info
  // Get MCP server info
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_mcp_info",
    label: "GSD MCP Info",
    description: "Get GSD MCP server information including available tools and resources.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      let info = `# ${MCP_SERVER_CONFIG.name} v${MCP_SERVER_CONFIG.version}\n\n`;
      info += `${MCP_SERVER_CONFIG.description}\n\n`;

      info += `## Available Tools\n\n`;
      for (const tool of MCP_TOOLS) {
        info += `### ${tool.name}\n\n`;
        info += `${tool.description}\n\n`;
        info += `**Parameters:**\n`;
        for (const [key, prop] of Object.entries(tool.inputSchema.properties || {})) {
          const p = prop as { description?: string; type?: string };
          info += `- \`${key}\`: ${p.description || p.type || "unknown"}\n`;
        }
        info += "\n";
      }

      info += `## Available Resources\n\n`;
      for (const resource of MCP_RESOURCES) {
        info += `- **${resource.uri}**: ${resource.name} - ${resource.description}\n`;
      }

      return {
        content: [{ type: "text" as const, text: info }],
        details: { success: true, server: MCP_SERVER_CONFIG },
      };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_mcp_read
  // Read a GSD resource
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_mcp_read",
    label: "GSD MCP Read",
    description: "Read a GSD resource by URI (e.g., gsd://state, gsd://project)",
    parameters: Type.Object({
      uri: Type.String({ description: "Resource URI (gsd://state, gsd://project, gsd://roadmap, gsd://requirements)" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const content = readResource(params.uri);

      if (!content) {
        return {
          content: [{
            type: "text" as const,
            text: `Resource not found: ${params.uri}\n\nAvailable: gsd://state, gsd://project, gsd://roadmap, gsd://requirements`,
          }],
          details: { success: false, uri: params.uri },
        };
      }

      return {
        content: [{ type: "text" as const, text: content }],
        details: { success: true, uri: params.uri },
      };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_mcp_call
  // Call an MCP tool
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_mcp_call",
    label: "GSD MCP Call",
    description: "Call an MCP tool: gsd_query, gsd_plan, gsd_record",
    parameters: Type.Object({
      tool: Type.String({ description: "Tool name: gsd_query, gsd_plan, gsd_record" }),
      args: Type.Record(Type.String(), Type.Unknown(), { description: "Tool arguments" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const result = handleToolCall(params.tool, params.args as Record<string, unknown>);

      return {
        content: [{ type: "text" as const, text: result.content }],
        details: { success: !result.isError, tool: params.tool },
      };
    },
  });

  // Command to list MCP resources
  pi.registerCommand("gsd-mcp-resources", {
    description: "List GSD MCP resources",
    handler: async (_args, ctx) => {
      let message = "## GSD MCP Resources\n\n";

      for (const resource of MCP_RESOURCES) {
        const exists = existsSync(join(process.cwd(), ".planning", resource.name.toUpperCase() + ".md"));
        message += `${exists ? "✅" : "❌"} **${resource.uri}**\n`;
        message += `   ${resource.name}: ${resource.description}\n\n`;
      }

      ctx.ui.notify(message, "info");
    },
  });

  // Command to list MCP tools
  pi.registerCommand("gsd-mcp-tools", {
    description: "List GSD MCP tools",
    handler: async (_args, ctx) => {
      let message = "## GSD MCP Tools\n\n";

      for (const tool of MCP_TOOLS) {
        message += `**${tool.name}**\n`;
        message += `   ${tool.description}\n\n`;
      }

      ctx.ui.notify(message, "info");
    },
  });
}