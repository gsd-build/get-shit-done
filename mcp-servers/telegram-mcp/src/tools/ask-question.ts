import { appendQuestion } from '../storage/question-queue.js';

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
 * Handler for ask_blocking_question tool
 *
 * Creates a pending question in the JSONL queue and returns question_id.
 * NOTE: Telegram message sending will be added in Plan 04 when bot is integrated.
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

  // Create question in storage
  const question = await appendQuestion({
    question: input.question.trim(),
    context: input.context?.trim()
  });

  // Return response
  return {
    question_id: question.id,
    asked_at: question.created_at,
    status: 'pending'
  };
}
