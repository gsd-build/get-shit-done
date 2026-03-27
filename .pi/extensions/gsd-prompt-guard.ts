/**
 * GSD Prompt Guard Extension for Pi
 *
 * Scans writes to .planning/ for prompt injection patterns.
 * Blocks or warns about potential injection attacks.
 *
 * Security layer for GSD workflow files.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Injection patterns to detect
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions?|rules?|context)/i,
  /you\s+are\s+now\s+/i,
  /system:\s*/i,
  /forget\s+(everything|all|previous)/i,
  /new\s+instructions?\s*:/i,
  /override\s+(previous|default|all)/i,
  /disregard\s+(all|previous|above)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(if|a|an)\s+/i,
  /jailbreak/i,
  /DAN\s*:/i,
  /developer\s+mode/i,
  /sudo\s+mode/i,
  /\[SYSTEM\]/i,
  /<\/?system>/i,
  /<<\s*SYSTEM\s*>>/i,
];

// Files to protect
const PROTECTED_PATHS = [
  '.planning/',
  'PROJECT.md',
  'REQUIREMENTS.md',
  'ROADMAP.md',
  'STATE.md',
  'CONTEXT.md',
  'PLAN.md',
  'RESEARCH.md',
];

/**
 * Check if path is a protected GSD file
 */
function isProtectedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return PROTECTED_PATHS.some(p =>
    normalized.includes(p) || normalized.endsWith(p.replace('/', ''))
  );
}

/**
 * Detect injection patterns in content
 */
function detectInjection(content: string): { detected: boolean; patterns: string[] } {
  const detected: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      detected.push(pattern.source);
    }
  }

  return {
    detected: detected.length > 0,
    patterns: detected,
  };
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    // Only check write/edit operations
    const toolName = event.toolName;
    if (toolName !== "write" && toolName !== "edit") {
      return;
    }

    // Get file path
    const filePath = event.input?.path || event.input?.file || "";
    if (typeof filePath !== "string" || !isProtectedPath(filePath)) {
      return;
    }

    // Get content to check
    const content = event.input?.content || event.input?.newText || "";
    if (typeof content !== "string" || content.length === 0) {
      return;
    }

    // Check for injection patterns
    const result = detectInjection(content);

    if (result.detected) {
      // Log the detection
      console.warn(`[GSD Prompt Guard] Injection patterns detected in ${filePath}:`);
      result.patterns.forEach(p => console.warn(`  - ${p}`));

      // Block the write
      return {
        block: true,
        reason: `Potential prompt injection detected in ${filePath}. ` +
          `Patterns found: ${result.patterns.length}. ` +
          `If this is a false positive, please review and edit manually.`,
      };
    }
  });

  // Register a command to test content for injection
  pi.registerCommand("gsd-check-injection", {
    description: "Check content for prompt injection patterns",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /gsd-check-injection <text or file path>", "info");
        return;
      }

      const content = args.trim();
      const result = detectInjection(content);

      if (result.detected) {
        ctx.ui.notify(
          `⚠️ Injection patterns detected: ${result.patterns.length}\n${result.patterns.join('\n')}`,
          "warning"
        );
      } else {
        ctx.ui.notify("✅ No injection patterns detected", "info");
      }
    },
  });
}