/**
 * GSD Git Integration Extension for Pi
 *
 * Deeper git workflow integration for GSD:
 * - Create PRs from phase work
 * - Branch management
 * - Phase completion detection
 *
 * Tools: gsd_ship, gsd_branch, gsd_status
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Run git command
 */
function git(args: string[], cwd = process.cwd()): { success: boolean; output: string; error?: string } {
  try {
    const result = execFileSync(
      "git",
      args,
      {
        cwd,
        encoding: "utf-8",
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

/**
 * Get current branch
 */
function getCurrentBranch(): string {
  const result = git(["branch", "--show-current"]);
  return result.success ? result.output : "unknown";
}

/**
 * Check if there are uncommitted changes
 */
function hasUncommittedChanges(): boolean {
  const result = git(["status", "--porcelain"]);
  return result.success && result.output.length > 0;
}

/**
 * Get commits since branch point
 */
function getCommitsSinceMain(): string[] {
  const result = git(["log", "main..HEAD", "--oneline"]);
  if (!result.success) {
    return [];
  }
  return result.output.split("\n").filter(Boolean);
}

/**
 * Parse STATE.md for current phase
 */
function getCurrentPhase(): string | null {
  const statePath = join(process.cwd(), ".planning", "STATE.md");

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, "utf-8");
    for (const line of content.split("\n")) {
      if (line.startsWith("Current Phase:")) {
        return line.replace("Current Phase:", "").trim();
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate PR body from phase work
 */
function generatePrBody(phase: string, commits: string[]): string {
  let body = `## Phase ${phase} Implementation\n\n`;

  body += "### Changes\n\n";
  for (const commit of commits) {
    // Extract commit message
    const message = commit.split(" ").slice(1).join(" ");
    body += `- ${message}\n`;
  }

  body += "\n### Testing\n\n";
  body += "- [ ] Manual testing completed\n";
  body += "- [ ] All tests passing\n";

  body += "\n### Documentation\n\n";
  body += "- [ ] Updated relevant docs\n";

  return body;
}

export default function (pi: ExtensionAPI) {
  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_ship
  // Create PR from current phase work
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_ship",
    label: "GSD Ship",
    description: "Create a PR from current phase work. Checks for uncommitted changes, generates PR body from commits.",
    parameters: Type.Object({
      title: Type.Optional(Type.String({ description: "PR title (auto-generated if not provided)" })),
      draft: Type.Optional(Type.Boolean({ description: "Create as draft PR" })),
      base: Type.Optional(Type.String({ description: "Base branch (default: main)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      // Check for uncommitted changes
      if (hasUncommittedChanges()) {
        return {
          content: [{
            type: "text" as const,
            text: "⚠️ There are uncommitted changes. Please commit or stash them first.",
          }],
          details: { success: false, reason: "uncommitted_changes" },
        };
      }

      // Get current branch and phase
      const branch = getCurrentBranch();
      const phase = getCurrentPhase();
      const commits = getCommitsSinceMain();

      if (commits.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "⚠️ No commits to ship. Make some commits first.",
          }],
          details: { success: false, reason: "no_commits" },
        };
      }

      // Generate PR title
      const title = params.title || `feat(phase-${phase}): implement phase ${phase}`;

      // Generate PR body
      const body = generatePrBody(phase || "unknown", commits);

      // Try to create PR using gh CLI
      const ghArgs = [
        "pr", "create",
        "--title", title,
        "--body", body,
      ];

      if (params.draft) {
        ghArgs.push("--draft");
      }

      if (params.base) {
        ghArgs.push("--base", params.base);
      }

      const ghResult = git(ghArgs.map(String));

      if (!ghResult.success) {
        return {
          content: [{
            type: "text" as const,
            text: `❌ Failed to create PR: ${ghResult.error}\n\nYou can create manually at:\n${branch}`,
          }],
          details: { success: false, error: ghResult.error },
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: `✅ PR created successfully!\n\n${ghResult.output}\n\n**Title:** ${title}\n**Branch:** ${branch}\n**Commits:** ${commits.length}`,
        }],
        details: { success: true, prUrl: ghResult.output },
      };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_branch
  // Branch management
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_branch",
    label: "GSD Branch",
    description: "Create or switch GSD feature branches. Follows GSD naming convention.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("create"),
        Type.Literal("switch"),
        Type.Literal("list"),
      ], { description: "Action to perform" }),
      name: Type.Optional(Type.String({ description: "Branch name (e.g., 'phase-01-auth')" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      if (params.action === "list") {
        const result = git(["branch", "-a"]);
        const branches = result.success
          ? result.output.split("\n").map(b => b.trim()).filter(b => b.includes("gsd/") || b.includes("phase-"))
          : [];

        return {
          content: [{
            type: "text" as const,
            text: `GSD Branches:\n\n${branches.join("\n") || "No GSD branches found"}`,
          }],
          details: { success: true, branches },
        };
      }

      if (!params.name) {
        return {
          content: [{
            type: "text" as const,
            text: "❌ Branch name required for create/switch actions",
          }],
          details: { success: false, reason: "missing_name" },
        };
      }

      const branchName = params.name.startsWith("gsd/") ? params.name : `gsd/${params.name}`;

      if (params.action === "create") {
        const result = git(["checkout", "-b", branchName]);
        return {
          content: [{
            type: "text" as const,
            text: result.success
              ? `✅ Created and switched to branch: ${branchName}`
              : `❌ Failed to create branch: ${result.error}`,
          }],
          details: { success: result.success, branch: branchName },
        };
      }

      if (params.action === "switch") {
        const result = git(["checkout", branchName]);
        return {
          content: [{
            type: "text" as const,
            text: result.success
              ? `✅ Switched to branch: ${branchName}`
              : `❌ Failed to switch branch: ${result.error}`,
          }],
          details: { success: result.success, branch: branchName },
        };
      }

      return {
        content: [{ type: "text" as const, text: "Unknown action" }],
        details: { success: false },
      };
    },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool: gsd_git_status
  // Git status for GSD context
  // ═══════════════════════════════════════════════════════════════════════
  pi.registerTool({
    name: "gsd_git_status",
    label: "GSD Git Status",
    description: "Get git status relevant to GSD workflow: branch, commits, changes.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const branch = getCurrentBranch();
      const phase = getCurrentPhase();
      const commits = getCommitsSinceMain();
      const hasChanges = hasUncommittedChanges();

      const status = {
        branch,
        phase,
        commitsAhead: commits.length,
        uncommittedChanges: hasChanges,
        commits: commits.slice(0, 10),
      };

      let text = `## GSD Git Status\n\n`;
      text += `**Branch:** ${branch}\n`;
      text += `**Phase:** ${phase || "Unknown"}\n`;
      text += `**Commits ahead:** ${commits.length}\n`;
      text += `**Uncommitted changes:** ${hasChanges ? "Yes" : "No"}\n`;

      if (commits.length > 0) {
        text += `\n### Recent Commits\n\n`;
        for (const commit of commits.slice(0, 5)) {
          text += `- ${commit}\n`;
        }
      }

      return {
        content: [{ type: "text" as const, text }],
        details: { success: true, status },
      };
    },
  });

  // Event listener for phase completion
  pi.on("tool_call", async (event, ctx) => {
    // After gsd_advance_plan, check if phase is complete
    if (event.toolName === "gsd_advance_plan") {
      const statePath = join(process.cwd(), ".planning", "STATE.md");

      if (existsSync(statePath)) {
        try {
          const content = readFileSync(statePath, "utf-8");
          if (content.includes("Phase Complete") || content.includes("Status: Complete")) {
            const branch = getCurrentBranch();
            ctx.ui.notify(
              `🎉 Phase complete!\n` +
              `Branch: ${branch}\n` +
              `Run /gsd:ship to create PR?`,
              "info"
            );
          }
        } catch {
          // Ignore errors
        }
      }
    }
  });
}