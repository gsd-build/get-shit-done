/**
 * GSD Dashboard Extension for Pi
 *
 * Interactive TUI dashboard for GSD visualization.
 * Shows phases, plans, progress, and quick actions.
 *
 * Use /gsd:dashboard to open.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";
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
 * Context interface for dashboard component.
 * Note: runCommand may not be available in all pi versions.
 */
interface DashboardContext {
  runCommand?: (cmd: string) => Promise<void>;
  ui: {
    notify: (msg: string, type: string) => void;
    requestRender: () => void;
  };
}

/**
 * GSD Dashboard Component
 */
class GsdDashboardComponent {
  private state: GsdState | null;
  private phases: PhaseInfo[];
  private ctx: DashboardContext;
  private done: () => void;
  private cachedLines?: string[];
  private cachedWidth?: number;

  constructor(
    state: GsdState | null,
    phases: PhaseInfo[],
    ctx: DashboardContext,
    done: () => void
  ) {
    this.state = state;
    this.phases = phases;
    this.ctx = ctx;
    this.done = done;
  }

  render(width: number): string[] {
    // Use cache if width hasn't changed
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];

    lines.push("╔══════════════════════════════════════════════════════════════╗");
    lines.push("║                    🚀 GSD Dashboard                           ║");
    lines.push("╠══════════════════════════════════════════════════════════════╣");

    if (!this.state) {
      lines.push("║  No project initialized                                      ║");
      lines.push("║                                                              ║");
      lines.push("║  Run /gsd:new-project to start                               ║");
    } else {
      lines.push("║  Current Position                                            ║");
      lines.push("║  ─────────────────                                           ║");
      lines.push(`║  Phase:  ${this.state.phase.padEnd(48)}║`);
      lines.push(`║  Plan:   ${this.state.plan.padEnd(48)}║`);
      lines.push(`║  Status: ${this.state.status.padEnd(48)}║`);

      if (this.state.progress) {
        lines.push(`║  ${this.state.progress.padEnd(60)}║`);
      }

      lines.push("╠══════════════════════════════════════════════════════════════╣");
      lines.push("║  Phases                                                      ║");
      lines.push("║  ──────                                                      ║");

      for (const phase of this.phases.slice(0, 6)) {
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

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = undefined;
    this.cachedWidth = undefined;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "p")) {
      this.runCommand("/gsd:plan-phase");
    } else if (matchesKey(data, "e")) {
      this.runCommand("/gsd:execute-phase");
    } else if (matchesKey(data, "v")) {
      this.runCommand("/gsd:verify-work");
    } else if (matchesKey(data, "s")) {
      this.runCommand("/gsd:ship");
    } else if (matchesKey(data, "h")) {
      this.runCommand("/gsd:help");
    } else if (matchesKey(data, "q") || matchesKey(data, "escape")) {
      this.done();
    }
  }

  /**
   * Safely run a command, handling cases where runCommand is not available.
   */
  private runCommand(cmd: string): void {
    if (this.ctx.runCommand) {
      this.ctx.runCommand(cmd).catch(() => {});
    } else {
      this.ctx.ui.notify(
        `Command ${cmd} not available - runCommand not supported in this context`,
        "warning"
      );
    }
  }
}

export default function (pi: ExtensionAPI) {
  // Register dashboard command
  pi.registerCommand("gsd-dashboard", {
    description: "Open GSD dashboard",
    handler: async (_args, ctx) => {
      const state = parseState();
      const phases = parseRoadmap();

      // Use factory function pattern - returns component with render, invalidate, handleInput
      ctx.ui.custom((tui, _theme, _keybindings, done) => {
        // Create component with context for command execution
        const component = new GsdDashboardComponent(state, phases, ctx, done);

        return {
          render: (w: number) => component.render(w),
          invalidate: () => component.invalidate(),
          handleInput: (data: string) => {
            component.handleInput(data);
            tui.requestRender();
          },
        };
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