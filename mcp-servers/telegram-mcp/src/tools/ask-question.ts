import { appendQuestion, PendingQuestion } from '../storage/question-queue.js';
import { getCurrentSessionId } from '../storage/session-state.js';
import { sendMessage } from '../bot/telegram-bot.js';

/**
 * Input schema for ask_blocking_question tool
 */
export interface AskQuestionInput {
  question: string;           // Question text
  context?: string;           // Optional execution context
  timeout_minutes?: number;   // Max wait time (default: 30)
}

/**
 * Output schema for ask_blocking_question tool
 */
export interface AskQuestionOutput {
  question_id: string;        // UUID for tracking
  asked_at: string;           // ISO timestamp
  status: "pending";
}

/**
 * MCP tool definition for ask_blocking_question
 */
export const ASK_QUESTION_TOOL_DEF = {
  name: "ask_blocking_question",
  description: "Send a blocking question to user via Telegram and wait for response. Creates question in queue and returns question_id for polling.",
  inputSchema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to send to the user"
      },
      context: {
        type: "string",
        description: "Optional execution context (e.g., current task, plan phase)"
      },
      timeout_minutes: {
        type: "number",
        description: "Max wait time in minutes (default: 30)",
        default: 30
      }
    },
    required: ["question"]
  }
};

/**
 * Format question for Telegram message
 */
function formatQuestionMessage(question: PendingQuestion): string {
  // Use first 8 characters of session ID for compact display
  const sessionLabel = question.session_id.slice(0, 8);
  let msg = `❓ **[Session ${sessionLabel}] Question from Claude:**\n\n${question.question}\n\n`;
  msg += `ID: \`${question.id}\`\n`;
  msg += `Session: ${sessionLabel}\n`;
  if (question.context) {
    msg += `Context: ${question.context}\n`;
  }
  msg += `\nReply with your answer or use the Pending Questions button.`;
  return msg;
}

/**
 * Handler for ask_blocking_question tool
 *
 * Creates a pending question in the JSONL queue and sends to Telegram.
 *
 * @param args Input arguments conforming to AskQuestionInput
 * @returns Output conforming to AskQuestionOutput
 * @throws Error if validation fails
 */
export async function askBlockingQuestionHandler(
  args: unknown
): Promise<AskQuestionOutput> {
  // Validate input
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid input: expected object');
  }

  const input = args as Partial<AskQuestionInput>;

  // Validate question (required, non-empty)
  if (!input.question || typeof input.question !== 'string') {
    throw new Error('Invalid input: question is required and must be a string');
  }

  if (!input.question.trim()) {
    throw new Error('Invalid input: question cannot be empty');
  }

  // Validate timeout_minutes if provided
  if (input.timeout_minutes !== undefined) {
    if (typeof input.timeout_minutes !== 'number' || input.timeout_minutes <= 0) {
      throw new Error('Invalid input: timeout_minutes must be a positive number');
    }
  }

  // Get current session ID
  const sessionId = getCurrentSessionId();

  // Create question in storage
  const question = await appendQuestion(sessionId, {
    question: input.question.trim(),
    context: input.context?.trim()
  });

  // Send to Telegram if bot is running and chat ID is set
  const chatId = process.env.TELEGRAM_OWNER_ID;
  if (chatId) {
    try {
      const message = formatQuestionMessage(question);
      await sendMessage(message, { parse_mode: 'Markdown' });
      console.error(`[ask_blocking_question] Sent to Telegram chat ${chatId}`);
    } catch (err: any) {
      // Log error but don't fail - question is still in queue
      console.error(`[ask_blocking_question] Failed to send to Telegram: ${err.message}`);
      console.error('[ask_blocking_question] Question saved to queue for manual checking');
    }
  } else {
    console.error('[ask_blocking_question] TELEGRAM_OWNER_ID not set, skipping Telegram notification');
  }

  // Return response
  return {
    question_id: question.id,
    asked_at: question.created_at,
    status: 'pending'
  };
}
