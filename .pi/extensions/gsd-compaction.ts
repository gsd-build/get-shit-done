/**
 * GSD Compaction Extension for Pi
 *
 * Custom compaction strategy that preserves GSD state files.
 * Ensures PROJECT.md, STATE.md, REQUIREMENTS.md, ROADMAP.md
 * are retained across context compaction.
 *
 * Implements prioritized context retention.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Priority levels for GSD files
const PRIORITY_FILES = {
  critical: [
    ".planning/STATE.md",
    ".planning/PROJECT.md",
  ],
  high: [
    ".planning/REQUIREMENTS.md",
    ".planning/ROADMAP.md",
    ".planning/config.json",
  ],
  medium: [
    ".planning/phases/",
  ],
  low: [
    ".planning/research/",
    ".planning/quick/",
  ],
};

// Files that can be safely summarized
const SUMMARIZABLE = [
  ".planning/research/STACK.md",
  ".planning/research/FEATURES.md",
  ".planning/research/ARCHITECTURE.md",
  ".planning/research/PITFALLS.md",
];

/**
 * Get file priority
 */
function getFilePriority(filePath: string): "critical" | "high" | "medium" | "low" | "none" {
  const normalized = filePath.replace(/\\/g, '/');

  for (const [priority, files] of Object.entries(PRIORITY_FILES)) {
    for (const file of files) {
      if (normalized.includes(file)) {
        return priority as "critical" | "high" | "medium" | "low";
      }
    }
  }

  return "none";
}

/**
 * Check if file is summarizable
 */
function isSummarizable(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return SUMMARIZABLE.some(s => normalized.includes(s));
}

/**
 * Read and summarize a research file
 */
function summarizeResearch(filePath: string): string {
  try {
    if (!existsSync(filePath)) {
      return "";
    }

    const content = readFileSync(filePath, "utf-8");

    // Extract key sections (first line of each major section)
    const lines = content.split("\n");
    const summary: string[] = [];
    let inCodeBlock = false;

    for (const line of lines) {
      if (line.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (!inCodeBlock && line.startsWith("## ")) {
        summary.push(line);
      }
    }

    return summary.slice(0, 10).join("\n");
  } catch {
    return "";
  }
}

/**
 * Get current GSD state summary
 */
function getGsdStateSummary(): string {
  const planningDir = join(process.cwd(), ".planning");

  if (!existsSync(planningDir)) {
    return "GSD: No project initialized";
  }

  try {
    const statePath = join(planningDir, "STATE.md");
    if (!existsSync(statePath)) {
      return "GSD: No state file";
    }

    const state = readFileSync(statePath, "utf-8");
    const lines = state.split("\n").slice(0, 50);

    // Extract key info
    let phase = "Unknown";
    let plan = "Unknown";
    let status = "Unknown";

    for (const line of lines) {
      if (line.startsWith("Current Phase:")) {
        phase = line.replace("Current Phase:", "").trim();
      }
      if (line.startsWith("Current Plan:")) {
        plan = line.replace("Current Plan:", "").trim();
      }
      if (line.startsWith("Status:")) {
        status = line.replace("Status:", "").trim();
      }
    }

    return `GSD State: Phase ${phase}, Plan ${plan}, Status: ${status}`;
  } catch {
    return "GSD: Error reading state";
  }
}

export default function (pi: ExtensionAPI) {
  // Register compaction strategy
  pi.on("compaction", async (event, ctx) => {
    const files = event.files || [];
    const decisions: Array<{ file: string; action: "keep" | "summarize" | "remove" }> = [];

    // Categorize files by priority
    for (const file of files) {
      const priority = getFilePriority(file);
      const summarizable = isSummarizable(file);

      if (priority === "critical") {
        decisions.push({ file, action: "keep" });
      } else if (priority === "high") {
        decisions.push({ file, action: "keep" });
      } else if (summarizable && priority !== "none") {
        decisions.push({ file, action: "summarize" });
      } else if (priority === "medium") {
        // Keep phase files if in active phase
        decisions.push({ file, action: "keep" });
      } else {
        decisions.push({ file, action: "remove" });
      }
    }

    // Generate summary for removed GSD files
    const gsdSummary = getGsdStateSummary();

    // Return compaction decisions
    return {
      decisions,
      summary: gsdSummary,
      preserveContext: `
## GSD Context Preserved

${gsdSummary}

Key files retained:
- STATE.md (current position)
- PROJECT.md (project vision)
- REQUIREMENTS.md (scoped requirements)
- ROADMAP.md (phase breakdown)
`,
    };
  });

  // Command to preview compaction decisions
  pi.registerCommand("gsd-compaction-preview", {
    description: "Preview what would be preserved during compaction",
    handler: async (_args, ctx) => {
      const planningDir = join(process.cwd(), ".planning");

      if (!existsSync(planningDir)) {
        ctx.ui.notify("GSD: No project initialized", "info");
        return;
      }

      let message = "## GSD Compaction Preview\n\n";

      message += "**Critical (always kept):**\n";
      for (const f of PRIORITY_FILES.critical) {
        const exists = existsSync(join(process.cwd(), f));
        message += `  ${exists ? "✅" : "❌"} ${f}\n`;
      }

      message += "\n**High Priority (kept):**\n";
      for (const f of PRIORITY_FILES.high) {
        const exists = existsSync(join(process.cwd(), f));
        message += `  ${exists ? "✅" : "❌"} ${f}\n`;
      }

      message += "\n**Summarizable:**\n";
      for (const f of SUMMARIZABLE) {
        const exists = existsSync(join(process.cwd(), f));
        message += `  ${exists ? "📝" : "❌"} ${f}\n`;
      }

      ctx.ui.notify(message, "info");
    },
  });

  // Command to get GSD state summary
  pi.registerCommand("gsd-state-summary", {
    description: "Get a compact summary of GSD state",
    handler: async (_args, ctx) => {
      const summary = getGsdStateSummary();
      ctx.ui.notify(summary, "info");
    },
  });
}