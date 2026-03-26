/**
 * GSD Tools Extension for Pi
 *
 * Exposes gsd-tools.cjs functionality as native pi tools.
 * Allows the LLM to query and manipulate GSD state directly.
 *
 * Tools provided:
 * - gsd_state: Get current project state
 * - gsd_advance_plan: Move to the next plan
 * - gsd_add_decision: Record a decision in STATE.md
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Path to gsd-tools.cjs
 * Uses the installed location (either global or local)
 */
function getGsdToolsPath(): string {
  const projectRoot = process.cwd();

  // Check local installation first
  const localPath = join(projectRoot, "get-shit-done", "bin", "gsd-tools.cjs");
  if (existsSync(localPath)) {
    return localPath;
  }

  // Fall back to global installation
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const globalPath = join(homeDir, ".claude", "get-shit-done", "bin", "gsd-tools.cjs");
  if (existsSync(globalPath)) {
    return globalPath;
  }

  // Return local path as default (will fail gracefully)
  return localPath;
}

/**
 * Run gsd-tools.cjs command and return output
 */
function runGsdTools(args: string[]): { success: boolean; output: string; error?: string } {
  try {
    const toolsPath = getGsdToolsPath();
    const result = execFileSync(
      process.execPath,
      [toolsPath, ...args],
      {
        encoding: "utf-8",
        cwd: process.cwd(),
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    return { success: true, output: result.trim() };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      output: error.stdout?.toString() || "",
      error: error.stderr?.toString() || error.message || "Unknown error",
    };
  }
}

export default function (pi: ExtensionAPI) {
  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_state
  // Get current GSD project state
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_state",
    label: "GSD State",
    description: "Get the current GSD project state including phase, plan, status, and progress. Returns JSON.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const result = runGsdTools(["state", "json"]);

      if (!result.success) {
        return {
          content: [{
            type: "text" as const,
            text: `Error getting GSD state: ${result.error}\n\nMake sure GSD is installed and .planning/ directory exists.`,
          }],
          details: { success: false, error: result.error },
        };
      }

      try {
        // Parse JSON to validate it
        const state = JSON.parse(result.output);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(state, null, 2),
          }],
          details: { success: true, state },
        };
      } catch {
        // Not valid JSON, return raw output
        return {
          content: [{
            type: "text" as const,
            text: result.output,
          }],
          details: { success: true },
        };
      }
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_advance_plan
  // Move to the next plan in the current phase
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_advance_plan",
    label: "GSD Advance Plan",
    description: "Advance the plan counter to the next plan in the current phase. Updates STATE.md.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const result = runGsdTools(["state", "advance-plan"]);

      if (!result.success) {
        return {
          content: [{
            type: "text" as const,
            text: `Error advancing plan: ${result.error}`,
          }],
          details: { success: false, error: result.error },
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: `Plan advanced successfully.\n\n${result.output}`,
        }],
        details: { success: true, output: result.output },
      };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_add_decision
  // Record a decision in STATE.md
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_add_decision",
    label: "GSD Add Decision",
    description: "Record a decision in STATE.md. Decisions are preserved across sessions for project memory.",
    parameters: Type.Object({
      phase: Type.String({
        description: "Phase number (e.g., '01', '02')"
      }),
      summary: Type.String({
        description: "Brief summary of the decision"
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const result = runGsdTools([
        "state", "add-decision",
        "--phase", params.phase,
        "--summary", params.summary,
      ]);

      if (!result.success) {
        return {
          content: [{
            type: "text" as const,
            text: `Error adding decision: ${result.error}`,
          }],
          details: { success: false, error: result.error },
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: `Decision recorded successfully.\n\nPhase: ${params.phase}\nDecision: ${params.summary}`,
        }],
        details: { success: true, phase: params.phase, summary: params.summary },
      };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_progress
  // Get progress summary
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_progress",
    label: "GSD Progress",
    description: "Get a progress summary showing completed phases, current phase, and overall progress.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      // Get state
      const stateResult = runGsdTools(["state", "json"]);

      if (!stateResult.success) {
        return {
          content: [{
            type: "text" as const,
            text: `Error getting progress: ${stateResult.error}`,
          }],
          details: { success: false, error: stateResult.error },
        };
      }

      // Get roadmap
      const roadmapResult = runGsdTools(["roadmap", "list"]);

      let progressText = "## GSD Progress\n\n";

      try {
        const state = JSON.parse(stateResult.output);
        progressText += `**Current Phase:** ${state.currentPhase || 'None'}\n`;
        progressText += `**Current Plan:** ${state.currentPlan || 'None'}\n`;
        progressText += `**Status:** ${state.status || 'Unknown'}\n\n`;

        if (state.progress) {
          progressText += `**Progress:** ${state.progress}\n\n`;
        }

        if (state.decisions?.length > 0) {
          progressText += `**Recent Decisions:**\n`;
          state.decisions.slice(-5).forEach((d: string) => {
            progressText += `- ${d}\n`;
          });
        }
      } catch {
        progressText += stateResult.output;
      }

      if (roadmapResult.success) {
        progressText += `\n## Roadmap\n\n${roadmapResult.output}`;
      }

      return {
        content: [{
          type: "text" as const,
          text: progressText,
        }],
        details: { success: true },
      };
    },
  });
}