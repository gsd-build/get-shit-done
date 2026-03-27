/**
 * GSD Workflow Guard Extension for Pi
 *
 * Detects edits outside GSD workflow context and warns users.
 * Encourages using GSD commands for tracked changes.
 *
 * Opt-in via config: hooks.workflow_guard: true
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Files that are part of GSD workflow
const GSD_PATHS = [
  ".planning/",
  "PROJECT.md",
  "REQUIREMENTS.md",
  "ROADMAP.md",
  "STATE.md",
];

// Files to ignore (always allow)
const IGNORE_PATHS = [
  "node_modules/",
  ".git/",
  "package-lock.json",
  "dist/",
  "build/",
];

/**
 * Check if path is a GSD managed path
 */
function isGsdPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return GSD_PATHS.some(p => normalized.includes(p));
}

/**
 * Check if path should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return IGNORE_PATHS.some(p => normalized.includes(p));
}

/**
 * Check if there's an active GSD command or task
 */
function isGsdContextActive(ctx: unknown): boolean {
  // Check session for active GSD command
  const session = (ctx as { session?: Record<string, unknown> }).session;
  if (session?.gsdActive || session?.gsdCommand) {
    return true;
  }

  // Check if we're in a subagent spawned by GSD
  if (session?.parentAgent?.toString().includes('gsd-')) {
    return true;
  }

  return false;
}

/**
 * Check if workflow guard is enabled
 */
function isWorkflowGuardEnabled(): boolean {
  try {
    const configPath = join(process.cwd(), ".planning", "config.json");
    if (!existsSync(configPath)) {
      return false;
    }

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return config.hooks?.workflow_guard === true;
  } catch {
    return false;
  }
}

export default function (pi: ExtensionAPI) {
  // Track if we've shown warning recently (debounce)
  let lastWarningTime = 0;
  const DEBOUNCE_MS = 60000; // 1 minute

  pi.on("tool_call", async (event, ctx) => {
    // Check if workflow guard is enabled
    if (!isWorkflowGuardEnabled()) {
      return;
    }

    // Only check write/edit operations
    const toolName = event.toolName;
    if (toolName !== "write" && toolName !== "edit") {
      return;
    }

    // Get file path
    const filePath = event.input?.path || event.input?.file || "";
    if (typeof filePath !== "string") {
      return;
    }

    // Skip ignored paths
    if (shouldIgnore(filePath)) {
      return;
    }

    // Allow GSD paths
    if (isGsdPath(filePath)) {
      return;
    }

    // Skip if in active GSD context
    if (isGsdContextActive(ctx)) {
      return;
    }

    // Debounce warnings
    const now = Date.now();
    if (now - lastWarningTime < DEBOUNCE_MS) {
      return;
    }
    lastWarningTime = now;

    // Warn about non-workflow edit
    ctx.ui.notify(
      `⚠️ Editing ${filePath} outside GSD workflow.\n` +
      `Consider using /gsd:quick or /gsd:fast for tracked changes.\n` +
      `Disable in config.json: hooks.workflow_guard: false`,
      "warning"
    );

    // Note: This is advisory, doesn't block
    // To block, return { block: true, reason: "..." }
  });

  // Register command to toggle workflow guard
  pi.registerCommand("gsd-workflow-guard", {
    description: "Toggle workflow guard on/off",
    handler: async (args, ctx) => {
      const action = args?.trim().toLowerCase();

      if (action === "on" || action === "enable") {
        ctx.ui.notify(
          "Workflow guard enabled. Set hooks.workflow_guard: true in config.json",
          "info"
        );
      } else if (action === "off" || action === "disable") {
        ctx.ui.notify(
          "Workflow guard disabled. Set hooks.workflow_guard: false in config.json",
          "info"
        );
      } else {
        const enabled = isWorkflowGuardEnabled();
        ctx.ui.notify(
          `Workflow guard is currently: ${enabled ? "ENABLED" : "DISABLED"}\n` +
          `Use: /gsd-workflow-guard on|off`,
          "info"
        );
      }
    },
  });
}