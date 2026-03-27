/**
 * GSD Dashboard Extension for Pi
 *
 * Interactive TUI dashboard for GSD visualization.
 * Shows phases, plans, progress, and quick actions.
 *
 * Use /gsd:dashboard to open.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface GsdState {
  phase: string;
  plan: string;
  status: string;
  progress: string;
}

interface PhaseInfo {
  number: string;
  name: string;
  plans: number;
  summaries: number;
  status: "pending" | "in-progress" | "complete";
}

/**
 * Parse STATE.md
 */
function parseState(): GsdState | null {
  const statePath = join(process.cwd(), ".planning", "STATE.md");

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, "utf-8");
    const state: GsdState = {
      phase: "Unknown",
      plan: "Unknown",
      status: "Unknown",
      progress: "",
    };

    for (const line of content.split("\n")) {
      if (line.startsWith("Current Phase:")) {
        state.phase = line.replace("Current Phase:", "").trim();
      }
      if (line.startsWith("Current Plan:")) {
        state.plan = line.replace("Current Plan:", "").trim();
      }
      if (line.startsWith("Status:")) {
        state.status = line.replace("Status:", "").trim();
      }
      if (line.startsWith("Progress:")) {
        state.progress = line.replace("Progress:", "").trim();
      }
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Parse ROADMAP.md for phase info
 */
function parseRoadmap(): PhaseInfo[] {
  const roadmapPath = join(process.cwd(), ".planning", "ROADMAP.md");

  if (!existsSync(roadmapPath)) {
    return [];
  }

  try {
    const content = readFileSync(roadmapPath, "utf-8");
    const phases: PhaseInfo[] = [];

    // Extract phases from roadmap table
    const lines = content.split("\n");
    for (const line of lines) {
      // Match: | 01 | Phase Name | status |
      const match = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)/);
      if (match) {
        phases.push({
          number: match[1].trim(),
          name: match[2].trim(),
          plans: 0,
          summaries: 0,
          status: match[3].trim().toLowerCase().includes("complete")
            ? "complete"
            : match[3].trim().toLowerCase().includes("progress")
              ? "in-progress"
              : "pending",
        });
      }
    }

    // Count plans/summaries per phase
    const phasesDir = join(process.cwd(), ".planning", "phases");
    if (existsSync(phasesDir)) {
      for (const phase of phases) {
        const phaseDir = readdirSync(phasesDir).find(d =>
          d.startsWith(phase.number + "-")
        );

        if (phaseDir) {
          const phasePath = join(phasesDir, phaseDir);
          const files = readdirSync(phasePath);
          phase.plans = files.filter(f => f.includes("-PLAN.md")).length;
          phase.summaries = files.filter(f => f.includes("-SUMMARY.md")).length;
        }
      }
    }

    return phases;
  } catch {
    return [];
  }
}

/**
 * Render dashboard
 */
function renderDashboard(state: GsdState | null, phases: PhaseInfo[]): string {
  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════════╗");
  lines.push("║                    🚀 GSD Dashboard                           ║");
  lines.push("╠══════════════════════════════════════════════════════════════╣");

  if (!state) {
    lines.push("║  No project initialized                                      ║");
    lines.push("║                                                              ║");
    lines.push("║  Run /gsd:new-project to start                               ║");
  } else {
    lines.push("║  Current Position                                            ║");
    lines.push("║  ─────────────────                                           ║");
    lines.push(`║  Phase:  ${state.phase.padEnd(48)}║`);
    lines.push(`║  Plan:   ${state.plan.padEnd(48)}║`);
    lines.push(`║  Status: ${state.status.padEnd(48)}║`);

    if (state.progress) {
      lines.push(`║  ${state.progress.padEnd(60)}║`);
    }

    lines.push("╠══════════════════════════════════════════════════════════════╣");
    lines.push("║  Phases                                                      ║");
    lines.push("║  ──────                                                      ║");

    for (const phase of phases.slice(0, 6)) {
      const statusIcon = phase.status === "complete"
        ? "✅"
        : phase.status === "in-progress"
          ? "🔄"
          : "⏳";

      const progress = phase.plans > 0
        ? `[${"█".repeat(phase.summaries)}${"░".repeat(phase.plans - phase.summaries)}]`
        : "[          ]";

      const line = `║  ${statusIcon} Phase ${phase.number}: ${(phase.name + " ").slice(0, 24).padEnd(24)} ${progress}  ║`;
      lines.push(line.slice(0, 63) + "║");
    }
  }

  lines.push("╠══════════════════════════════════════════════════════════════╣");
  lines.push("║  [P]lan   [E]xecute   [V]erify   [S]hip   [H]elp   [Q]uit   ║");
  lines.push("╚══════════════════════════════════════════════════════════════╝");

  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  // Register dashboard command
  pi.registerCommand("gsd-dashboard", {
    description: "Open GSD dashboard",
    handler: async (_args, ctx) => {
      const state = parseState();
      const phases = parseRoadmap();

      // Render dashboard
      const dashboard = renderDashboard(state, phases);
      ctx.ui.notify(dashboard, "info");

      // Set up keyboard handler for interactive mode
      ctx.ui.custom({
        render: () => dashboard,
        onKey: async (key) => {
          switch (key.toLowerCase()) {
            case "p":
              await ctx.runCommand("/gsd:plan-phase");
              break;
            case "e":
              await ctx.runCommand("/gsd:execute-phase");
              break;
            case "v":
              await ctx.runCommand("/gsd:verify-work");
              break;
            case "s":
              await ctx.runCommand("/gsd:ship");
              break;
            case "h":
              await ctx.runCommand("/gsd:help");
              break;
            case "q":
            case "escape":
              ctx.ui.closeCustom();
              break;
          }
        },
      });
    },
  });

  // Quick status command
  pi.registerCommand("gsd-status", {
    description: "Show current GSD status",
    handler: async (_args, ctx) => {
      const state = parseState();

      if (!state) {
        ctx.ui.notify("GSD: No project initialized", "info");
        return;
      }

      ctx.ui.notify(
        `GSD: Phase ${state.phase}, Plan ${state.plan}, Status: ${state.status}`,
        "info"
      );
    },
  });
}