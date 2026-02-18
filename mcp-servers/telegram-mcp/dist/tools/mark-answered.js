import { getPendingById } from '../storage/question-queue.js';
import { getCurrentSessionId } from '../storage/session-state.js';
import { getSessionPath } from '../storage/session-manager.js';
/**
 * MCP tool definition for mark_question_answered
 */
export const MARK_ANSWERED_TOOL_DEF = {
    name: "mark_question_answered",
    description: "Confirm receipt of an answered question (answer already in session file).",
    inputSchema: {
        type: "object",
        properties: {
            question_id: {
                type: "string",
                description: "The question ID to mark as answered"
            }
        },
        required: ["question_id"]
    }
};
/**
 * Handler for mark_question_answered tool
 *
 * Confirms Claude has received an answered question.
 * Note: The question must already have status="answered" and answer populated
 * (typically set by the Telegram bot when user responds).
 * The answer stays in the session file (no separate archiving).
 *
 * @param args Input arguments conforming to MarkAnsweredInput
 * @returns Output conforming to MarkAnsweredOutput
 * @throws Error if question not found or validation fails
 */
export async function markQuestionAnsweredHandler(args) {
    // Validate input
    if (!args || typeof args !== 'object') {
        throw new Error('Invalid input: expected object');
    }
    const input = args;
    // Validate question_id
    if (!input.question_id || typeof input.question_id !== 'string') {
        throw new Error('Invalid input: question_id is required and must be a string');
    }
    const questionId = input.question_id.trim();
    if (!questionId) {
        throw new Error('Invalid input: question_id cannot be empty');
    }
    // Get current session ID
    const sessionId = getCurrentSessionId();
    // Get the question from this session
    const question = await getPendingById(questionId, sessionId);
    if (!question) {
        throw new Error(`Question not found in current session: ${questionId}`);
    }
    // Verify question has been answered
    if (question.status !== 'answered') {
        throw new Error(`Question ${questionId} is not answered yet (status: ${question.status})`);
    }
    if (!question.answer) {
        throw new Error(`Question ${questionId} is marked answered but has no answer text`);
    }
    // Return session file path (where the answer is stored)
    const sessionPath = getSessionPath(sessionId);
    return {
        success: true,
        archived_to: sessionPath
    };
}
