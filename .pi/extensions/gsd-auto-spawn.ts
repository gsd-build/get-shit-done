/**
 * GSD Auto-Spawn Extension for Pi
 *
 * Detects user intent matching GSD workflows and suggests commands.
 * Optionally auto-spawns agents for recognized patterns.
 *
 * Reduces manual command entry for common workflows.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Intent patterns mapped to GSD commands
const INTENT_PATTERNS = [
  {
    patterns: [
      /i want to (add|create|implement|build) (a |an )?(new )?feature/i,
      /add (a |an )?feature/i,
      /implement (a |an )?feature/i,
      /build (a |an )?feature/i,
      /new feature/i,
    ],
    command: "/gsd:quick",
    suggestion: "Run /gsd:quick to add a feature?",
    description: "Add a new feature",
  },
  {
    patterns: [
      /start (a |an )?new project/i,
      /initialize (a |an )?project/i,
      /create (a |an )?new project/i,
      /new project/i,
    ],
    command: "/gsd:new-project",
    suggestion: "Run /gsd:new-project to initialize?",
    description: "Start a new project",
  },
  {
    patterns: [
      /fix (this |the )?bug/i,
      /debug (this |the )?issue/i,
      /there('s| is) (a |an )?bug/i,
      /broken/i,
      /not working/i,
    ],
    command: "/gsd:debug",
    suggestion: "Run /gsd:debug to investigate?",
    description: "Debug an issue",
  },
  {
    patterns: [
      /what('s| is) (the )?next/i,
      /what should i do next/i,
      /continue working/i,
      /keep going/i,
    ],
    command: "/gsd:next",
    suggestion: "Run /gsd:next to continue?",
    description: "Continue workflow",
  },
  {
    patterns: [
      /show (me )?(the )?progress/i,
      /where am i/i,
      /what('s| is) (the )?status/i,
      /current state/i,
    ],
    command: "/gsd:progress",
    suggestion: "Run /gsd:progress to see status?",
    description: "Show progress",
  },
  {
    patterns: [
      /plan (the |a |an )?next phase/i,
      /create (a |an )?plan/i,
      /plan this/i,
    ],
    command: "/gsd:plan-phase",
    suggestion: "Run /gsd:plan-phase to create plans?",
    description: "Plan next phase",
  },
  {
    patterns: [
      /execute (the |a |an )?plan/i,
      /run (the |a |an )?plan/i,
      /implement (the |a |an )?plan/i,
    ],
    command: "/gsd:execute-phase",
    suggestion: "Run /gsd:execute-phase to execute?",
    description: "Execute plans",
  },
  {
    patterns: [
      /ship (this|the|phase)?/i,
      /create (a |an )?pr/i,
      /pull request/i,
      /merge this/i,
    ],
    command: "/gsd:ship",
    suggestion: "Run /gsd:ship to create PR?",
    description: "Ship work",
  },
];

// Session state for tracking suggestions
interface SessionState {
  lastSuggestion?: string;
  lastSuggestionTime?: number;
  suggestionsGiven: number;
}

/**
 * Detect intent from user message
 */
function detectIntent(message: string): { intent: typeof INTENT_PATTERNS[0] | null; match: string } {
  const lowerMessage = message.toLowerCase();

  for (const intent of INTENT_PATTERNS) {
    for (const pattern of intent.patterns) {
      if (pattern.test(message)) {
        const match = message.match(pattern)?.[0] || "";
        return { intent, match };
      }
    }
  }

  return { intent: null, match: "" };
}

export default function (pi: ExtensionAPI) {
  // Track session state
  const sessionState: SessionState = {
    suggestionsGiven: 0,
  };

  const DEBOUNCE_MS = 30000; // 30 seconds between suggestions
  const MAX_SUGGESTIONS = 5; // Max suggestions per session

  pi.on("user_message", async (event, ctx) => {
    const message = event.message || "";
    if (typeof message !== "string" || message.startsWith("/")) {
      return; // Skip if already a command
    }

    // Check if we've given too many suggestions
    if (sessionState.suggestionsGiven >= MAX_SUGGESTIONS) {
      return;
    }

    // Debounce
    const now = Date.now();
    if (sessionState.lastSuggestionTime && now - sessionState.lastSuggestionTime < DEBOUNCE_MS) {
      return;
    }

    // Detect intent
    const { intent, match } = detectIntent(message);
    if (!intent) {
      return;
    }

    // Don't repeat same suggestion
    if (sessionState.lastSuggestion === intent.command) {
      return;
    }

    // Update state
    sessionState.lastSuggestion = intent.command;
    sessionState.lastSuggestionTime = now;
    sessionState.suggestionsGiven++;

    // Notify user
    ctx.ui.notify(
      `💡 ${intent.suggestion}\n   Matched: "${match}"`,
      "info"
    );
  });

  // Command to manually trigger intent detection
  pi.registerCommand("gsd-detect-intent", {
    description: "Detect GSD workflow intent from text",
    handler: async (args, ctx) => {
      if (!args) {
        ctx.ui.notify("Usage: /gsd-detect-intent <text>", "info");
        return;
      }

      const { intent, match } = detectIntent(args);

      if (intent) {
        ctx.ui.notify(
          `✅ Detected: ${intent.description}\n` +
          `   Command: ${intent.command}\n` +
          `   Matched: "${match}"`,
          "info"
        );
      } else {
        ctx.ui.notify("No GSD intent detected in text", "info");
      }
    },
  });

  // Command to list available intent patterns
  pi.registerCommand("gsd-intents", {
    description: "List all GSD intent patterns",
    handler: async (_args, ctx) => {
      let message = "## GSD Intent Patterns\n\n";

      for (const intent of INTENT_PATTERNS) {
        message += `**${intent.description}**\n`;
        message += `  Command: ${intent.command}\n`;
        message += `  Patterns: ${intent.patterns.length}\n\n`;
      }

      ctx.ui.notify(message, "info");
    },
  });
}