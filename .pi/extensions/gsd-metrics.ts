/**
 * GSD Metrics Extension for Pi
 *
 * Tracks GSD usage metrics:
 * - Phases completed
 * - Plans executed
 * - Session duration
 * - Commands used
 *
 * Stores metrics in .planning/metrics.json
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface SessionMetrics {
  startTime: number;
  phasesCompleted: number;
  plansExecuted: number;
  commandsUsed: Record<string, number>;
  errors: number;
}

interface ProjectMetrics {
  totalPhasesCompleted: number;
  totalPlansExecuted: number;
  totalSessions: number;
  totalDurationMs: number;
  commandsUsed: Record<string, number>;
  lastSession: string | null;
  sessions: SessionSummary[];
}

interface SessionSummary {
  date: string;
  duration: number;
  phases: number;
  plans: number;
  commands: Record<string, number>;
}

const METRICS_PATH = join(process.cwd(), ".planning", "metrics.json");

/**
 * Load metrics
 */
function loadMetrics(): ProjectMetrics {
  if (!existsSync(METRICS_PATH)) {
    return {
      totalPhasesCompleted: 0,
      totalPlansExecuted: 0,
      totalSessions: 0,
      totalDurationMs: 0,
      commandsUsed: {},
      lastSession: null,
      sessions: [],
    };
  }

  try {
    return JSON.parse(readFileSync(METRICS_PATH, "utf-8"));
  } catch {
    return {
      totalPhasesCompleted: 0,
      totalPlansExecuted: 0,
      totalSessions: 0,
      totalDurationMs: 0,
      commandsUsed: {},
      lastSession: null,
      sessions: [],
    };
  }
}

/**
 * Save metrics
 */
function saveMetrics(metrics: ProjectMetrics): void {
  try {
    writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2));
  } catch (err) {
    console.warn("[GSD Metrics] Failed to save metrics:", err);
  }
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export default function (pi: ExtensionAPI) {
  // Session state
  const sessionMetrics: SessionMetrics = {
    startTime: Date.now(),
    phasesCompleted: 0,
    plansExecuted: 0,
    commandsUsed: {},
    errors: 0,
  };

  // Track command usage
  pi.on("command", async (event, _ctx) => {
    const command = event.command || "";
    if (command.startsWith("gsd:") || command.startsWith("gsd-")) {
      sessionMetrics.commandsUsed[command] = (sessionMetrics.commandsUsed[command] || 0) + 1;
    }
  });

  // Track tool usage for GSD tools
  pi.on("tool_call", async (event, _ctx) => {
    const toolName = event.toolName || "";

    if (toolName === "gsd_advance_plan") {
      sessionMetrics.plansExecuted++;
    }

    if (toolName.startsWith("gsd_")) {
      sessionMetrics.commandsUsed[`tool:${toolName}`] = (sessionMetrics.commandsUsed[`tool:${toolName}`] || 0) + 1;
    }
  });

  // Track errors
  pi.on("tool_error", async (_event, _ctx) => {
    sessionMetrics.errors++;
  });

  // On session end, save metrics
  pi.on("session_end", async (_event, _ctx) => {
    const duration = Date.now() - sessionMetrics.startTime;

    // Load existing metrics
    const metrics = loadMetrics();

    // Update totals
    metrics.totalPhasesCompleted += sessionMetrics.phasesCompleted;
    metrics.totalPlansExecuted += sessionMetrics.plansExecuted;
    metrics.totalSessions += 1;
    metrics.totalDurationMs += duration;

    // Merge commands
    for (const [cmd, count] of Object.entries(sessionMetrics.commandsUsed)) {
      metrics.commandsUsed[cmd] = (metrics.commandsUsed[cmd] || 0) + count;
    }

    // Add session summary
    const sessionSummary: SessionSummary = {
      date: new Date().toISOString(),
      duration,
      phases: sessionMetrics.phasesCompleted,
      plans: sessionMetrics.plansExecuted,
      commands: { ...sessionMetrics.commandsUsed },
    };

    metrics.sessions.push(sessionSummary);
    metrics.lastSession = sessionSummary.date;

    // Keep only last 100 sessions
    if (metrics.sessions.length > 100) {
      metrics.sessions = metrics.sessions.slice(-100);
    }

    // Save
    saveMetrics(metrics);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_metrics
  // Get metrics
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_metrics",
    label: "GSD Metrics",
    description: "Get GSD usage metrics including phases completed, plans executed, and session history.",
    parameters: Type.Object({
      format: Type.Optional(Type.Union([
        Type.Literal("summary"),
        Type.Literal("detailed"),
        Type.Literal("json"),
      ], { description: "Output format (default: summary)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const metrics = loadMetrics();
      const format = params.format || "summary";

      if (format === "json") {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(metrics, null, 2) }],
          details: { success: true },
        };
      }

      if (format === "detailed") {
        let text = "# GSD Metrics\n\n";

        text += "## Overview\n\n";
        text += `- **Total Sessions:** ${metrics.totalSessions}\n`;
        text += `- **Total Duration:** ${formatDuration(metrics.totalDurationMs)}\n`;
        text += `- **Phases Completed:** ${metrics.totalPhasesCompleted}\n`;
        text += `- **Plans Executed:** ${metrics.totalPlansExecuted}\n\n`;

        text += "## Commands Used\n\n";
        const sortedCommands = Object.entries(metrics.commandsUsed)
          .sort((a, b) => b[1] - a[1]);

        for (const [cmd, count] of sortedCommands.slice(0, 20)) {
          text += `- ${cmd}: ${count}\n`;
        }

        if (metrics.sessions.length > 0) {
          text += "\n## Recent Sessions\n\n";
          for (const session of metrics.sessions.slice(-5).reverse()) {
            text += `### ${session.date}\n`;
            text += `- Duration: ${formatDuration(session.duration)}\n`;
            text += `- Phases: ${session.phases}, Plans: ${session.plans}\n\n`;
          }
        }

        return {
          content: [{ type: "text" as const, text }],
          details: { success: true },
        };
      }

      // Summary format (default)
      const text = `## GSD Metrics Summary

📊 **Sessions:** ${metrics.totalSessions}
⏱️ **Total Time:** ${formatDuration(metrics.totalDurationMs)}
✅ **Phases:** ${metrics.totalPhasesCompleted}
📋 **Plans:** ${metrics.totalPlansExecuted}

**Top Commands:**
${Object.entries(metrics.commandsUsed)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([cmd, count]) => `  - ${cmd}: ${count}`)
          .join("\n")}
`;

      return {
        content: [{ type: "text" as const, text }],
        details: { success: true },
      };
    },
  });

  // Command to show metrics
  pi.registerCommand("gsd-metrics", {
    description: "Show GSD usage metrics",
    handler: async (args, ctx) => {
      const metrics = loadMetrics();
      const format = args?.trim() || "summary";

      if (format === "clear") {
        saveMetrics({
          totalPhasesCompleted: 0,
          totalPlansExecuted: 0,
          totalSessions: 0,
          totalDurationMs: 0,
          commandsUsed: {},
          lastSession: null,
          sessions: [],
        });
        ctx.ui.notify("GSD metrics cleared", "info");
        return;
      }

      let message = `## GSD Metrics\n\n`;
      message += `- Sessions: ${metrics.totalSessions}\n`;
      message += `- Total Time: ${formatDuration(metrics.totalDurationMs)}\n`;
      message += `- Phases: ${metrics.totalPhasesCompleted}\n`;
      message += `- Plans: ${metrics.totalPlansExecuted}\n\n`;

      if (metrics.lastSession) {
        message += `Last session: ${metrics.lastSession}\n`;
      }

      ctx.ui.notify(message, "info");
    },
  });

  // Command to show session stats
  pi.registerCommand("gsd-session-stats", {
    description: "Show current session statistics",
    handler: async (_args, ctx) => {
      const duration = Date.now() - sessionMetrics.startTime;

      let message = `## Current Session\n\n`;
      message += `- Duration: ${formatDuration(duration)}\n`;
      message += `- Plans executed: ${sessionMetrics.plansExecuted}\n`;
      message += `- Phases completed: ${sessionMetrics.phasesCompleted}\n`;
      message += `- Errors: ${sessionMetrics.errors}\n\n`;

      if (Object.keys(sessionMetrics.commandsUsed).length > 0) {
        message += `**Commands used:**\n`;
        for (const [cmd, count] of Object.entries(sessionMetrics.commandsUsed).slice(0, 10)) {
          message += `  - ${cmd}: ${count}\n`;
        }
      }

      ctx.ui.notify(message, "info");
    },
  });
}