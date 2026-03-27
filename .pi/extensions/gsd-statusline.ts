/**
 * GSD Status Line Extension for Pi
 *
 * Shows current GSD phase/plan position in pi's status line.
 * Reads from .planning/STATE.md to display current position.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface GsdState {
  phase: string | null;
  plan: string | null;
  status: string | null;
}

/**
 * Parse STATE.md to extract current position
 */
function parseStateMd(projectRoot: string): GsdState | null {
  const statePath = join(projectRoot, ".planning", "STATE.md");

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, "utf-8");
    const state: GsdState = {
      phase: null,
      plan: null,
      status: null,
    };

    // Extract Current Phase
    const phaseMatch = content.match(/^Current Phase:\s*(.+)$/m);
    if (phaseMatch) {
      state.phase = phaseMatch[1].trim();
    }

    // Extract Current Plan
    const planMatch = content.match(/^Current Plan:\s*(.+)$/m);
    if (planMatch) {
      state.plan = planMatch[1].trim();
    }

    // Extract Status
    const statusMatch = content.match(/^Status:\s*(.+)$/m);
    if (statusMatch) {
      state.status = statusMatch[1].trim();
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Format status line string
 */
function formatStatus(state: GsdState | null): string {
  if (!state) {
    return "GSD: not initialized";
  }

  const parts: string[] = ["GSD"];

  if (state.phase) {
    parts.push(`Phase ${state.phase}`);
  }

  if (state.plan) {
    parts.push(`Plan ${state.plan}`);
  }

  if (state.status) {
    parts.push(`[${state.status}]`);
  }

  return parts.join(" ");
}

export default function (pi: ExtensionAPI) {
  /**
   * Update the status line with current GSD state
   */
  function updateStatus(ctx: { ui: { setStatus: (id: string, status: string) => void } }) {
    try {
      const projectRoot = process.cwd();
      const state = parseStateMd(projectRoot);
      const status = formatStatus(state);
      ctx.ui.setStatus("gsd", status);
    } catch {
      ctx.ui.setStatus("gsd", "GSD: unavailable");
    }
  }

  // Register status line on session start
  pi.on("session_start", async (_event, ctx) => {
    updateStatus(ctx);
  });

  // Update status on relevant tool calls
  pi.on("tool_call", async (event, ctx) => {
    // Only update on file operations in .planning/
    const toolName = event.toolName;
    if (toolName === "write" || toolName === "edit") {
      const filePath = event.input?.path || event.input?.file || "";
      if (typeof filePath === "string" && filePath.includes(".planning")) {
        updateStatus(ctx);
      }
    }
  });

  // Register a command to manually check status
  pi.registerCommand("gsd-status", {
    description: "Show current GSD project status",
    handler: async (_args, ctx) => {
      try {
        const projectRoot = process.cwd();
        const state = parseStateMd(projectRoot);

        if (!state) {
          ctx.ui.notify("GSD: No project initialized. Run /gsd:new-project first.", "info");
          return;
        }

        const status = formatStatus(state);
        ctx.ui.notify(status, "info");
      } catch (err) {
        ctx.ui.notify(`GSD: Error reading state - ${err}`, "error");
      }
    },
  });
}